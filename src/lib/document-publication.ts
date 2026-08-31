import type { BusinessDocument, EnterpriseProfile, ProcessingActivity } from "./types.ts";
import { assessRetentionRisk } from "./retention-risk.ts";
import { hasExternalRecipient, normalizedExternalProcessingRelationships } from "./external-processing.ts";

const missingDeletionMechanism = /没有|尚未|暂无|未建立|无统一|不删除|永不删除|自行处理|个案处理/;
const unresolvedPlaceholder = /待逐(?:家|项)|待补充|待确认|待填写|_{6,}|【[^】]+】/;
const genericPublicFact = /(?:使用的个人信息|涉及人员)[：:][^\n]*(?:其他信息|其他人员)|^###?\s+(?:\d+\.\s*)?其他业务\s*$/m;
const internalOperationDetail = /^(?:-\s*)?(?:可访问岗位|系统运维方|保存或使用位置)[：:]/m;
const externalNoticeTypes = new Set(["privacy_notice", "b2b_contact_notice", "employee_notice", "candidate_notice", "visitor_notice", "minor_notice", "sensitive_consent", "cross_border_notice_consent", "incident_notification"]);

export type DocumentPublicationContext = {
  content?: string;
  signedPipiaActivityIds?: string[];
  effectiveMinorRuleActivityIds?: string[];
  enterprise?: Pick<EnterpriseProfile, "publicContactDepartment" | "publicContactChannel"> & Partial<Pick<EnterpriseProfile, "privacyContactChannel" | "legalName">>;
};

function requiresPipia(activity: ProcessingActivity): boolean {
  return activity.facts.sensitiveInformation === "yes"
    || activity.facts.automatedDecision === "yes"
    || hasExternalRecipient(activity.facts)
    || activity.facts.crossBorderAccess === "yes";
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
  if (unresolvedPlaceholder.test(content)) risks.push("对外正文仍含“待补充/待确认”等占位内容");
  if (genericPublicFact.test(content)) risks.push("对外正文仍含“其他信息/其他人员/其他业务”等系统占位分类，请改成具体事实");
  if (internalOperationDetail.test(content)) risks.push("对外正文包含可访问岗位、系统运维方或内部存放位置，应移入内部处理台账");
  if (!input.enterprise?.publicContactDepartment?.trim() || !input.enterprise?.publicContactChannel?.trim()) risks.push("尚未设置独立的对外权利请求接收部门和联系渠道");
  if (input.enterprise?.legalName?.trim() && !content.includes(input.enterprise.legalName.trim())) risks.push("正文未明确个人信息处理者名称");
  if (input.enterprise?.publicContactChannel?.trim() && !content.includes(input.enterprise.publicContactChannel.trim())) risks.push("正文未写入对外权利请求联系渠道");
  if (!/使用目的[：:]|处理目的[：:]/.test(content)) risks.push("正文未明确说明个人信息处理目的");
  if (!/处理方式[：:]/.test(content)) risks.push("正文未明确说明个人信息处理方式");
  if (!/(使用的个人信息|个人信息种类|涉及信息)[：:]/.test(content)) risks.push("正文未明确说明处理的个人信息种类");
  if (!/(保存期限或删除条件|保存期限)[：:]/.test(content)) risks.push("正文未明确说明个人信息保存期限或确定规则");
  if (!/(您的权利|个人权利渠道|权利请求)/.test(content)) risks.push("正文未明确说明个人权利及行使方式");
  for (const activity of input.activities) {
    const relationships = normalizedExternalProcessingRelationships(activity.facts);
    if (!relationships.some(item => item === "independent_provision" || item === "joint_processing")) continue;
    const details = String(activity.facts.externalRecipientDetails || "");
    const hasContactOrNoticeMechanism = /(?:联系(?:人|方式|渠道)|电话|邮箱|@|提供前.{0,8}告知|另行告知|个案告知)/.test(details);
    if (!hasContactOrNoticeMechanism) risks.push(`“${activity.name}”向其他个人信息处理者提供信息，但尚未记录接收方联系方式或提供前另行告知机制`);
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
      if (String(activity.facts.externalRecipientDetails || "").trim().length < 5) risks.push(`${prefix}尚未补全外部单位、联系渠道和处理边界`);
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
    if (linkedActivities.some(activity => activity.facts.sensitiveInformation === "yes") && content) {
      if (!/处理必要性[：:]\s*[^\n]{8,}/.test(content)) risks.push("正文未具体说明敏感个人信息处理必要性");
      if (!/对个人权益的影响[：:]\s*[^\n]{8,}/.test(content)) risks.push("正文未具体说明敏感个人信息处理对个人权益的影响");
      if (!/(保护措施|保护安排)[：:]\s*[^\n]{8,}/.test(content)) risks.push("正文未具体说明敏感个人信息保护措施");
    }
  }

  for (const pendingFact of document.metadata?.pendingFacts || []) risks.push(`材料仍有待确认事实：${pendingFact}`);
  risks.push(...unresolvedAssessmentFindings);
  return [...new Set(risks)].slice(0, 12);
}
