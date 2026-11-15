import type { BusinessDocument, EnterpriseProfile, ProcessingActivity } from "./types.ts";
import { assessRetentionRisk } from "./retention-risk.ts";
import { hasExternalRecipient, hasMeaningfulExternalRecipientDetails, normalizedExternalProcessingRelationships } from "./external-processing.ts";

const missingDeletionMechanism = /没有|尚未|暂无|未建立|无统一|不删除|永不删除|自行处理|个案处理/;
const unresolvedPlaceholder = /待逐(?:家|项)|待补充|待确认|待填写|_{6,}|【[^】]+】/;
const genericPublicFact = /(?:使用的个人信息|涉及人员)[：:][^\n]*(?:其他信息|其他人员)|^###?\s+(?:\d+\.\s*)?其他业务\s*$/m;
const internalOperationDetail = /^(?:-\s*)?(?:可访问岗位|系统运维方|保存或使用位置)[：:]/m;
const externalNoticeTypes = new Set(["privacy_notice", "b2b_contact_notice", "employee_notice", "candidate_notice", "visitor_notice", "minor_notice", "sensitive_consent", "cross_border_notice_consent", "incident_notification"]);
const generalNoticeTypes = new Set(["privacy_notice", "b2b_contact_notice", "employee_notice", "candidate_notice", "visitor_notice", "minor_notice"]);
const agreementTypes = new Set(["processor_agreement", "joint_processing_agreement"]);
const generalRightsRequirements: Array<[RegExp, string]> = [
  [/查阅/, "查阅"], [/复制/, "复制"], [/(请求|申请).{0,12}转移|转移.{0,12}(个人信息|请求)/, "依法请求转移"],
  [/更正/, "更正"], [/补充/, "补充"], [/删除/, "删除"], [/限制.{0,6}处理/, "限制处理"],
  [/撤回.{0,4}同意/, "撤回同意"], [/(注销.{0,4}账号|账号.{0,8}(不适用|未提供|不提供))/, "注销账号（如适用）"],
  [/解释.{0,8}处理规则/, "解释处理规则"]
];

export type DocumentPublicationContext = {
  content?: string;
  signedPipiaActivityIds?: string[];
  effectiveMinorRuleActivityIds?: string[];
  enterprise?: Pick<EnterpriseProfile, "publicContactDepartment" | "publicContactChannel"> & Partial<Pick<EnterpriseProfile, "privacyContactChannel" | "legalName">>;
};

const generatedQualityIssue = /^(?:正文|对外正文|协议正文|协议尚未|单独同意书|出境告知|安全事件通知|“.+”已登记|“.+”向其他|尚未设置独立的对外)/;

function factValue(content: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content.match(new RegExp(`^${escaped}[：:]\\s*(.+)$`, "m"))?.[1]?.trim() || "";
}

function resolvedByCurrentContent(message: string, content: string): boolean {
  const isFilled = (value: string) => Boolean(value && !/待填|待补充|待确认|尚未确认|_{4,}/.test(value));
  const needsVersion = /版本号/.test(message);
  const needsEffectiveDate = /(生效日期|生效时间)/.test(message);
  if (needsVersion || needsEffectiveDate) {
    return (!needsVersion || isFilled(factValue(content, "版本号")))
      && (!needsEffectiveDate || isFilled(factValue(content, "生效日期")));
  }
  return false;
}

/** 返回仍然有效的人工待确认事实。正文质量问题始终按当前版本重新计算，避免旧提示永久阻断发布。 */
export function activeDocumentPendingFacts(
  document: Pick<BusinessDocument, "metadata">,
  content: string
): string[] {
  const metadata = document.metadata || {};
  const resolved = new Set(metadata.resolvedPendingFacts || []);
  const raw = [...(metadata.aiPendingFacts || []), ...(metadata.pendingFacts || [])];
  return [...new Set(raw.map(item => String(item).trim()).filter(Boolean))]
    .filter(item => !resolved.has(item) && !generatedQualityIssue.test(item) && !resolvedByCurrentContent(item, content));
}

function requiresPipia(activity: ProcessingActivity): boolean {
  return activity.facts.sensitiveInformation === "yes"
    || activity.facts.automatedDecision === "yes"
    || hasExternalRecipient(activity.facts)
    || activity.facts.crossBorderAccess === "yes";
}

function unresolvedContent(content: string) {
  return content
    .replace(/个人确认[：:]\s*_{6,}\s+日期[：:]\s*_{6,}/g, "个人确认和日期由本人填写")
    // 正式版本号和生效时间由平台发布记录生成，不属于业务事实缺口。
    .replace(/^版本号：待填写\s*$/gm, "版本号：以平台发布记录为准")
    .replace(/^生效日期：待填写\s*$/gm, "生效日期：以平台发布记录为准");
}

function registeredRecipientMissingFromContent(activity: ProcessingActivity, content: string) {
  const details = String(activity.facts.externalRecipientDetails || "").trim();
  if (!details) return false;
  const recipientName = details.split(/[；;，,\n]/).map(item => item.trim()).find(Boolean) || "";
  const email = details.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  return Boolean((recipientName.length >= 2 && !content.includes(recipientName)) || (email && !content.includes(email)));
}

function findAgreementContentQualityRisks(type: string, content: string, activities: ProcessingActivity[]): string[] {
  if (!agreementTypes.has(type)) return [];
  const risks: string[] = [];
  if (unresolvedPlaceholder.test(content)) risks.push("协议正文仍含“待补充/待确认/待填写”等占位内容");
  if (!/甲方[：:]/.test(content) || !/(乙方|合作方)[：:]/.test(content)) risks.push("协议尚未明确双方主体");
  if (!/处理目的[：:]/.test(content)) risks.push("协议尚未约定处理目的");
  if (!/处理期限[：:]/.test(content)) risks.push("协议尚未约定处理期限");
  if (!/处理方式[：:]/.test(content)) risks.push("协议尚未约定处理方式");
  if (!/个人信息种类[：:]/.test(content)) risks.push("协议尚未约定个人信息种类");
  if (!/保护措施[：:]/.test(content)) risks.push("协议尚未约定个人信息保护措施");
  if (!/(双方权利和义务|双方责任)/.test(content)) risks.push("协议尚未约定双方权利和义务");
  for (const activity of activities) {
    const relationships = normalizedExternalProcessingRelationships(activity.facts);
    const expected = type === "processor_agreement" ? "entrusted_processing" : "joint_processing";
    if (!relationships.includes(expected)) risks.push(`“${activity.name}”记录的外部处理关系与本协议类型不一致`);
    if (registeredRecipientMissingFromContent(activity, content)) risks.push(`“${activity.name}”已登记的合作方名称或联系方式未写入协议正文`);
  }
  return [...new Set(risks)];
}

export function findExternalContentQualityRisks(input: {
  type?: string;
  content: string;
  activities: ProcessingActivity[];
  enterprise?: DocumentPublicationContext["enterprise"];
}): string[] {
  if (!input.type || !externalNoticeTypes.has(input.type)) return [];
  const content = String(input.content || "");
  const risks: string[] = [];
  if (unresolvedPlaceholder.test(unresolvedContent(content))) risks.push("对外正文仍含“待补充/待确认”等占位内容");
  if (genericPublicFact.test(content)) risks.push("对外正文仍含“其他信息/其他人员/其他业务”等系统占位分类，请改成具体事实");
  if (internalOperationDetail.test(content)) risks.push("对外正文包含可访问岗位、系统运维方或内部存放位置，应移入内部处理台账");
  if (!input.enterprise?.publicContactDepartment?.trim() || !input.enterprise?.publicContactChannel?.trim()) risks.push("尚未设置独立的对外权利请求接收部门和联系渠道");
  if (input.enterprise?.legalName?.trim() && !content.includes(input.enterprise.legalName.trim())) risks.push("正文未明确个人信息处理者名称");
  if (input.enterprise?.publicContactChannel?.trim() && !content.includes(input.enterprise.publicContactChannel.trim())) risks.push("正文未写入对外权利请求联系渠道");
  if (generalNoticeTypes.has(input.type)) {
    if (!/使用目的[：:]|处理目的[：:]/.test(content)) risks.push("正文未明确说明个人信息处理目的");
    if (!/处理方式[：:]/.test(content)) risks.push("正文未明确说明个人信息处理方式");
    if (!/(使用的个人信息|个人信息种类|涉及信息)[：:]/.test(content)) risks.push("正文未明确说明处理的个人信息种类");
    if (!/(保存期限或删除条件|保存期限)[：:]/.test(content)) risks.push("正文未明确说明个人信息保存期限或确定规则");
    if (!/(您的权利|个人权利渠道|权利请求|权利和联系)/.test(content)) risks.push("正文未明确说明个人权利及行使方式");
    const missingRights = generalRightsRequirements.filter(([pattern]) => !pattern.test(content)).map(([, label]) => label);
    if (missingRights.length) risks.push(`正文个人权利章节缺少：${missingRights.join("、")}`);
  } else if (input.type === "sensitive_consent") {
    if (!/敏感个人信息[：:]/.test(content)) risks.push("单独同意书未明确敏感个人信息种类");
    if (!/处理目的[：:]/.test(content)) risks.push("单独同意书未明确处理目的");
    if (!/处理方式[：:]/.test(content)) risks.push("单独同意书未明确处理方式");
    if (!/保存期限[：:]/.test(content)) risks.push("单独同意书未明确保存期限");
    if (!/单独同意/.test(content)) risks.push("正文未形成单独同意确认");
    if (!/撤回/.test(content)) risks.push("正文未说明撤回同意方式");
  } else if (input.type === "cross_border_notice_consent") {
    if (!/境外接收方及联系方式[：:]/.test(content)) risks.push("出境告知未明确境外接收方及联系方式");
    if (!/出境目的[：:]/.test(content)) risks.push("出境告知未明确处理目的");
    if (!/处理方式[：:]/.test(content)) risks.push("出境告知未明确处理方式");
    if (!/个人信息种类[：:]/.test(content)) risks.push("出境告知未明确个人信息种类");
    if (!/向境外接收方行使权利的方式[：:]/.test(content)) risks.push("出境告知未明确向境外接收方行使权利的方式和程序");
  } else if (input.type === "incident_notification") {
    if (!/事件情况/.test(content)) risks.push("安全事件通知未说明事件情况");
    if (!/(可能造成的影响|可能风险和影响)/.test(content)) risks.push("安全事件通知未说明可能造成的危害");
    if (!/(补救措施|风险控制)/.test(content)) risks.push("安全事件通知未说明已经采取的补救措施");
    if (!/(您可以采取的措施|防范建议)/.test(content)) risks.push("安全事件通知未说明个人可以采取的减轻危害措施");
  }
  for (const activity of input.activities) {
    const relationships = normalizedExternalProcessingRelationships(activity.facts);
    if (!relationships.some(item => item === "independent_provision" || item === "joint_processing")) continue;
    const details = String(activity.facts.externalRecipientDetails || "");
    const hasContactOrNoticeMechanism = /(?:联系(?:人|方式|渠道)|电话|邮箱|@|提供前.{0,8}告知|另行告知|个案告知)/.test(details);
    if (!hasContactOrNoticeMechanism) risks.push(`“${activity.name}”向其他个人信息处理者提供信息，但尚未记录接收方联系方式或提供前另行告知机制`);
    if (input.type === "cross_border_notice_consent" && registeredRecipientMissingFromContent(activity, content)) risks.push(`“${activity.name}”已登记的境外接收方名称或联系方式未写入正文`);
  }
  return [...new Set(risks)];
}

export function findDocumentPublicationRisks(
  document: Pick<BusinessDocument, "activityIds" | "metadata"> & Partial<Pick<BusinessDocument, "type" | "name">>,
  activities: ProcessingActivity[],
  unresolvedAssessmentFindings: string[] = [],
  context: DocumentPublicationContext = {}
): string[] {
  const linkedActivities = activities.filter(activity => document.activityIds.includes(activity.id));
  const risks: string[] = [];
  const signedPipiaIds = new Set(context.signedPipiaActivityIds || []);
  const effectiveMinorRuleIds = new Set(context.effectiveMinorRuleActivityIds || []);

  for (const activity of linkedActivities) {
    const prefix = `“${activity.name}”`;
    const retention = assessRetentionRisk(activity.facts.retentionPeriod, activity.facts.retentionBasis || "");
    if (retention.level !== "none") risks.push(`${prefix}${retention.title}`);
    if (missingDeletionMechanism.test(activity.facts.deletionMethod || "")) risks.push(`${prefix}尚未建立明确删除机制`);
    if (activity.facts.sensitiveInformation === "unknown") risks.push(`${prefix}敏感个人信息范围尚未确认`);
    if (activity.facts.sensitiveInformation === "yes") {
      if (String(activity.facts.sensitiveNecessity || "").trim().length < 8) risks.push(`${prefix}尚未逐项说明敏感个人信息处理的充分必要性`);
      if (String(activity.facts.sensitiveRightsImpact || "").trim().length < 8) risks.push(`${prefix}尚未说明敏感个人信息处理对个人权益的具体影响`);
      if (String(activity.facts.sensitiveProtectionMeasures || "").trim().length < 8) risks.push(`${prefix}尚未记录敏感个人信息的严格保护措施`);
    }
    if (activity.facts.minorsInvolved === "unknown") risks.push(`${prefix}是否涉及不满十四周岁未成年人尚未确认`);
    if (activity.facts.crossBorderAccess === "unknown") risks.push(`${prefix}境外存储或访问情况尚未确认`);
    if (hasExternalRecipient(activity.facts)) {
      const relationships = normalizedExternalProcessingRelationships(activity.facts);
      if (!relationships.length || relationships.includes("unknown")) risks.push(`${prefix}与外部单位的处理关系尚未确认`);
      if (!hasMeaningfulExternalRecipientDetails(activity.facts.externalRecipientDetails)) risks.push(`${prefix}尚未补全可识别的外部单位或实际处理范围`);
    }
    if (requiresPipia(activity) && !signedPipiaIds.has(activity.id)) risks.push(`${prefix}尚未完成并归档个人信息保护影响评估`);
    if (activity.facts.minorsInvolved === "yes" && document.type !== "minor_notice" && !effectiveMinorRuleIds.has(activity.id)) {
      risks.push(`${prefix}尚无已发布的未成年人个人信息专门处理规则`);
    }
  }

  const content = String(context.content || "");
  if (document.type && externalNoticeTypes.has(document.type)) {
    risks.push(...findExternalContentQualityRisks({ type: document.type, content, activities: linkedActivities, enterprise: context.enterprise }));
    const internalChannel = context.enterprise?.privacyContactChannel?.trim();
    const publicChannel = context.enterprise?.publicContactChannel?.trim();
    if (content && internalChannel && publicChannel && internalChannel !== publicChannel && content.includes(internalChannel)) risks.push("对外正文仍含企业内部联系人渠道，请改用对外权利请求渠道");
    if (document.type !== "incident_notification" && linkedActivities.some(activity => activity.facts.sensitiveInformation === "yes") && content) {
      if (!/处理必要性[：:]\s*[^\n]{8,}/.test(content)) risks.push("正文未具体说明敏感个人信息处理必要性");
      if (!/对个人权益的影响[：:]\s*[^\n]{8,}/.test(content)) risks.push("正文未具体说明敏感个人信息处理对个人权益的影响");
      if (!/(保护措施|保护安排)[：:]\s*[^\n]{8,}/.test(content)) risks.push("正文未具体说明敏感个人信息保护措施");
    }
  }
  if (document.type && agreementTypes.has(document.type)) risks.push(...findAgreementContentQualityRisks(document.type, content, linkedActivities));

  for (const pendingFact of activeDocumentPendingFacts(document, content)) risks.push(`材料仍有待确认事实：${pendingFact}`);
  risks.push(...unresolvedAssessmentFindings);
  return [...new Set(risks)].slice(0, 12);
}
