import type { BusinessDocument, EnterpriseProfile, ProcessingActivity } from "./types.ts";
import { assessRetentionRisk } from "./retention-risk.ts";
import { hasExternalRecipient, normalizedExternalProcessingRelationships } from "./external-processing.ts";

const missingDeletionMechanism = /没有|尚未|暂无|未建立|无统一|不删除|永不删除|自行处理|个案处理/;
const unresolvedPlaceholder = /待逐(?:家|项)|待补充|待确认|待填写|_{6,}|【[^】]+】/;
const externalNoticeTypes = new Set(["privacy_notice", "b2b_contact_notice", "employee_notice", "candidate_notice", "visitor_notice", "minor_notice", "sensitive_consent", "cross_border_notice_consent", "incident_notification"]);

export type DocumentPublicationContext = {
  content?: string;
  signedPipiaActivityIds?: string[];
  effectiveMinorRuleActivityIds?: string[];
  enterprise?: Pick<EnterpriseProfile, "publicContactDepartment" | "publicContactChannel">;
};

function requiresPipia(activity: ProcessingActivity): boolean {
  return activity.facts.sensitiveInformation === "yes"
    || activity.facts.automatedDecision === "yes"
    || hasExternalRecipient(activity.facts)
    || activity.facts.crossBorderAccess === "yes";
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
    if (content && unresolvedPlaceholder.test(content)) risks.push("对外正文仍含“待补充/待确认”等占位内容");
    if (!context.enterprise?.publicContactDepartment?.trim() || !context.enterprise?.publicContactChannel?.trim()) risks.push("尚未设置独立的对外权利请求接收部门和联系渠道");
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
