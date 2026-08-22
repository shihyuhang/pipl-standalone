export type ComplianceProgressStatus = "done" | "active" | "pending";

export interface ComplianceProgressInput {
  onboardingCompleted: boolean;
  activityCount: number;
  hasPublishedDocument: boolean;
  signedAuditCount: number;
  followUpRecordCount: number;
}

export interface ComplianceProgressStep {
  code: "profile" | "activities" | "documents" | "audit" | "records";
  label: string;
  status: ComplianceProgressStatus;
}

/**
 * 首页只展示已经由系统证据支持的完成状态。
 * “持续留痕”要求在首次正式自查归档后，又形成新的发布、复核、检查或评估记录。
 */
export function getComplianceProgress(input: ComplianceProgressInput): ComplianceProgressStep[] {
  const completed = [
    input.onboardingCompleted,
    input.activityCount > 0,
    input.hasPublishedDocument,
    input.signedAuditCount > 0,
    input.signedAuditCount > 0 && input.followUpRecordCount > 0
  ];
  const codes: ComplianceProgressStep["code"][] = ["profile", "activities", "documents", "audit", "records"];
  const labels = ["单位建档", "业务记录", "材料发布", "全面检查", "持续留痕"];
  const firstIncomplete = completed.findIndex(value => !value);

  return labels.map((label, index) => ({
    code: codes[index],
    label,
    status: completed[index] ? "done" : index === firstIncomplete ? "active" : "pending"
  }));
}
