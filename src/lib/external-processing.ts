import type { ActivityFacts, ExternalProcessingRelationship } from "./types.ts";

export const externalProcessingRelationshipOptions: Array<{ code: ExternalProcessingRelationship; label: string; help: string }> = [
  { code: "entrusted_processing", label: "委托外部服务商处理", help: "例如云服务、SaaS、外包客服；对方只按本单位指示处理。" },
  { code: "independent_provision", label: "向其他处理者提供", help: "对方收到后可独立决定其处理目的或方式。" },
  { code: "joint_processing", label: "与其他单位共同处理", help: "双方共同决定处理目的和处理方式。" },
  { code: "statutory_disclosure", label: "依法向有权机关提供", help: "基于明确的法定义务或有权机关要求提供。" },
  { code: "unknown", label: "暂不清楚关系", help: "先如实登记，系统会要求负责人进一步确认。" }
];

export const externalProcessingRelationshipLabel = (code: ExternalProcessingRelationship) =>
  externalProcessingRelationshipOptions.find(item => item.code === code)?.label || code;

export function hasExternalRecipient(facts: Pick<ActivityFacts, "recipients">): boolean {
  return facts.recipients.some(item => item !== "不向外部提供");
}

export function inferExternalProcessingRelationships(recipients: string[]): ExternalProcessingRelationship[] {
  if (!recipients.some(item => item !== "不向外部提供")) return [];
  const values = new Set<ExternalProcessingRelationship>();
  if (recipients.some(item => /服务商|云|外包|SaaS/i.test(item))) values.add("entrusted_processing");
  if (recipients.some(item => /政府|法定机构|监管|司法/.test(item))) values.add("statutory_disclosure");
  if (recipients.some(item => /客户|合作方|集团|接收方/.test(item))) values.add("independent_provision");
  if (!values.size) values.add("unknown");
  return [...values];
}

export function normalizedExternalProcessingRelationships(facts: Pick<ActivityFacts, "recipients" | "externalProcessingRelationships">): ExternalProcessingRelationship[] {
  return facts.externalProcessingRelationships?.length
    ? facts.externalProcessingRelationships
    : inferExternalProcessingRelationships(facts.recipients);
}
