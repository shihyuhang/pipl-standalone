import test from "node:test";
import assert from "node:assert/strict";
import { emptyActivityFacts } from "../src/lib/activity-facts.ts";
import { findDocumentPublicationRisks, findExternalContentQualityRisks } from "../src/lib/document-publication.ts";
import type { BusinessDocument, ProcessingActivity } from "../src/lib/types.ts";

const activity: ProcessingActivity = {
  id: "risk-activity", scenarioCode: "CUSTOM-MEDICAL", name: "患者售后投诉", description: "患者反馈",
  status: "active", completeness: 1, createdAt: "2026-08-27T00:00:00.000Z",
  facts: {
    ...emptyActivityFacts(), dataSubjects: ["患者或产品使用者"], retentionPeriod: "永久保存",
    retentionBasis: "历史系统没有清理机制", deletionMethod: "目前没有统一删除机制，由客服个案处理",
    sensitiveInformation: "yes", minorsInvolved: "unknown", crossBorderAccess: "no", confirmedAt: "2026-08-27T00:00:00.000Z"
  }
};

const document = {
  activityIds: [activity.id],
  metadata: { materialType: "processing_register", modules: [], generationBasis: "测试", generatedAt: "2026-08-27T00:00:00.000Z" }
} as Pick<BusinessDocument, "activityIds" | "metadata">;

test("永久保存、无删除机制和关键事实不清楚会阻止静默标记为合规有效", () => {
  const risks = findDocumentPublicationRisks(document, [activity]);
  assert.ok(risks.some(item => /保存期限/.test(item)));
  assert.ok(risks.some(item => /删除机制/.test(item)));
  assert.ok(risks.some(item => /未成年人/.test(item)));
});

test("对外材料的占位内容、外部关系和影响评估都是有效发布阻断条件", () => {
  const externalActivity = {
    ...activity,
    facts: {
      ...activity.facts,
      retentionPeriod: "投诉处理完成后三年",
      retentionBasis: "售后争议处理和质量追溯所需",
      deletionMethod: "每季度删除到期工单",
      minorsInvolved: "no" as const,
      recipients: ["仅必要服务商"],
      externalProcessingRelationships: ["entrusted_processing" as const],
      externalRecipientDetails: "XX云科技，按指示托管工单",
      sensitiveInformation: "yes" as const
    }
  };
  const risks = findDocumentPublicationRisks({ ...document, type: "privacy_notice", name: "隐私政策" }, [externalActivity], [], {
    content: "处理必要性：用于投诉处理。\n对个人权益的影响：泄露可能造成权益风险。\n保护措施：限制客服岗位访问。\n接收方：待逐家确认。",
    enterprise: { publicContactDepartment: "法务与合规部", publicContactChannel: "privacy@example.com" }
  });
  assert.ok(risks.some(item => /占位内容/.test(item)));
  assert.ok(risks.some(item => /影响评估/.test(item)));
});

test("对外材料阻止内部渠道外泄并要求敏感处理三项事实", () => {
  const externalActivity = {
    ...activity,
    facts: {
      ...activity.facts,
      retentionPeriod: "投诉处理完成后三年",
      retentionBasis: "质量追溯所需",
      deletionMethod: "每季度删除到期工单",
      minorsInvolved: "no" as const
    }
  };
  const risks = findDocumentPublicationRisks({ ...document, type: "privacy_notice" }, [externalActivity], [], {
    content: "联系渠道：internal@example.com",
    enterprise: { publicContactDepartment: "法务与合规部", publicContactChannel: "rights@example.com", privacyContactChannel: "internal@example.com" }
  });
  assert.ok(risks.some(item => /内部联系人渠道/.test(item)));
  assert.ok(risks.some(item => /充分必要性/.test(item)));
  assert.ok(risks.some(item => /具体影响/.test(item)));
  assert.ok(risks.some(item => /严格保护措施/.test(item)));
});

test("对外正文校验拦截系统占位分类、内部运维细节和不完整接收方机制", () => {
  const provisionActivity: ProcessingActivity = {
    ...activity,
    facts: {
      ...activity.facts,
      recipients: ["客户或合作方"],
      externalProcessingRelationships: ["independent_provision"],
      externalRecipientDetails: "患者就诊医院接收售后调查结果"
    }
  };
  const risks = findExternalContentQualityRisks({
    type: "privacy_notice",
    content: "单位：测试公司\n使用的个人信息：姓名、其他信息\n使用目的：售后处理\n处理方式：收集和使用\n保存期限：三年\n您的权利：可申请删除\n可访问岗位：客服",
    activities: [provisionActivity],
    enterprise: { legalName: "测试公司", publicContactDepartment: "法务部", publicContactChannel: "rights@example.com" }
  });
  assert.ok(risks.some(item => /系统占位分类/.test(item)));
  assert.ok(risks.some(item => /内部处理台账/.test(item)));
  assert.ok(risks.some(item => /另行告知机制/.test(item)));
});
