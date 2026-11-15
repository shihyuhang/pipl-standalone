import test from "node:test";
import assert from "node:assert/strict";
import { emptyActivityFacts } from "../src/lib/activity-facts.ts";
import { activeDocumentPendingFacts, findDocumentPublicationRisks, findExternalContentQualityRisks } from "../src/lib/document-publication.ts";
import { generateMaterialDraft } from "../src/lib/materials.ts";
import type { BusinessDocument, EnterpriseProfile, ProcessingActivity } from "../src/lib/types.ts";

const publicationEnterprise: EnterpriseProfile = {
  id: "publication-enterprise", legalName: "发布测试有限公司", orgType: "有限责任公司", industry: "软件服务", businessModel: "B2B",
  ownership: "民营企业", processingRole: "个人信息处理者", personCount: 200, countVerified: true,
  subjectCategories: ["客户联系人"], sensitiveCategories: [], minorsPossible: "no", crossBorder: "no",
  privacyContactName: "合规负责人", privacyContactRole: "负责人", privacyContactChannel: "internal@example.test",
  publicContactDepartment: "个人信息权益服务", publicContactChannel: "rights@example.test",
  qualificationStatus: "eligible", qualificationSummary: "适用小型处理者路径", onboardingCompleted: true, updatedAt: "2026-09-11T00:00:00.000Z"
};

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
  assert.ok(risks.some(item => /个人权利章节缺少/.test(item)));
});

test("通用对外材料完整覆盖法定个人权利并通过权利章节检查", () => {
  const safeActivity: ProcessingActivity = {
    ...activity,
    facts: { ...activity.facts, sensitiveInformation: "no", sensitiveCategories: [], minorsInvolved: "no", retentionPeriod: "业务结束后三年", retentionBasis: "争议处理需要", deletionMethod: "每季度删除到期记录" }
  };
  const content = generateMaterialDraft({ type: "privacy_notice", name: "隐私政策", scope: "产品服务", audience: "产品用户", enterprise: publicationEnterprise, activities: [safeActivity] });
  assert.match(content, /符合法定条件时，可以请求将个人信息转移/);
  assert.match(content, /限制处理/);
  assert.match(content, /申请注销账号/);
  const risks = findExternalContentQualityRisks({ type: "privacy_notice", content, activities: [safeActivity], enterprise: publicationEnterprise });
  assert.equal(risks.some(item => /个人权利章节缺少/.test(item)), false);
});

test("旧版正文质量提示会按当前正文重算，已填写版本日期不再永久阻断", () => {
  const legacy = {
    metadata: {
      pendingFacts: ["正文未明确说明处理的个人信息种类", "请确认版本号和生效日期", "确认服务商真实名称"]
    }
  } as Pick<BusinessDocument, "metadata">;
  const content = "版本号：V2\n生效日期：2026年9月14日\n使用的个人信息：姓名和联系方式";
  assert.deepEqual(activeDocumentPendingFacts(legacy, content), ["确认服务商真实名称"]);
});

test("负责人明确核对的AI待确认事实不再阻断发布", () => {
  const confirmed = {
    metadata: { aiPendingFacts: ["确认服务商真实名称"], resolvedPendingFacts: ["确认服务商真实名称"] }
  } as Pick<BusinessDocument, "metadata">;
  assert.deepEqual(activeDocumentPendingFacts(confirmed, "完整正文"), []);
});

test("完整委托协议可发布，但占位合作方和错误处理关系会被阻断", () => {
  const entrustedActivity: ProcessingActivity = {
    ...activity,
    id: "entrusted-activity",
    name: "云端客户管理",
    facts: {
      ...emptyActivityFacts(),
      dataSubjects: ["客户联系人"], informationTypes: ["姓名和联系方式"], informationDetails: "姓名、工作邮箱和工作电话",
      purposes: ["客户关系管理"], collectionChannels: ["客户本人或所在单位提供"], systems: ["CRM"],
      recipients: ["云服务商"], externalProcessingRelationships: ["entrusted_processing"],
      externalRecipientDetails: "示例云服务有限公司；security@vendor.example；仅按指示托管CRM数据",
      approximatePersonCount: 200, accessRoles: ["客户经理"], systemOperators: ["云服务商"],
      retentionPeriod: "合作结束后三年删除", retentionBasis: "合同履行和争议处理需要", deletionMethod: "每季度删除到期记录",
      rightsChannel: "rights@example.test", automatedDecision: "no", sensitiveInformation: "no", minorsInvolved: "no", crossBorderAccess: "no",
      notes: "", confirmedAt: "2026-09-11T00:00:00.000Z"
    }
  };
  const content = generateMaterialDraft({ type: "processor_agreement", name: "个人信息委托处理协议", scope: "CRM托管", audience: "云服务商", enterprise: publicationEnterprise, activities: [entrustedActivity] });
  const baseDocument = { ...document, type: "processor_agreement", activityIds: [entrustedActivity.id] };
  const completeRisks = findDocumentPublicationRisks(baseDocument, [entrustedActivity], [], { content, signedPipiaActivityIds: [entrustedActivity.id], enterprise: publicationEnterprise });
  assert.deepEqual(completeRisks, []);

  const placeholderRisks = findDocumentPublicationRisks(baseDocument, [entrustedActivity], [], { content: content.replace("示例云服务有限公司；security@vendor.example；仅按指示托管CRM数据", "待填写合作方名称"), signedPipiaActivityIds: [entrustedActivity.id], enterprise: publicationEnterprise });
  assert.ok(placeholderRisks.some(item => /协议正文仍含/.test(item)));

  const relationshipRisks = findDocumentPublicationRisks({ ...baseDocument, type: "joint_processing_agreement" }, [entrustedActivity], [], { content, signedPipiaActivityIds: [entrustedActivity.id], enterprise: publicationEnterprise });
  assert.ok(relationshipRisks.some(item => /协议类型不一致/.test(item)));
});

test("完整出境告知允许保留个人签名栏，并带入接收方后通过内容校验", () => {
  const outboundActivity: ProcessingActivity = {
    ...activity,
    id: "outbound-activity",
    name: "境外支持工单",
    facts: {
      ...emptyActivityFacts(),
      dataSubjects: ["产品用户"], informationTypes: ["姓名和联系方式", "服务工单"], informationDetails: "姓名、邮箱和工单内容",
      purposes: ["提供售后支持"], collectionChannels: ["用户提交工单"], systems: ["工单系统"],
      recipients: ["境外总部"], externalProcessingRelationships: ["independent_provision"],
      externalRecipientDetails: "Example Global Pte. Ltd.；privacy@example-global.test；新加坡支持团队处理工单",
      approximatePersonCount: 300, accessRoles: ["客服"], systemOperators: ["系统管理员"],
      retentionPeriod: "工单关闭后三年删除", retentionBasis: "售后争议处理需要", deletionMethod: "每季度删除到期工单",
      rightsChannel: "rights@example.test", automatedDecision: "no", sensitiveInformation: "no", minorsInvolved: "no", crossBorderAccess: "yes",
      notes: "", confirmedAt: "2026-09-11T00:00:00.000Z"
    }
  };
  const content = generateMaterialDraft({ type: "cross_border_notice_consent", name: "个人信息出境告知与单独同意", scope: "境外支持", audience: "产品用户", enterprise: publicationEnterprise, activities: [outboundActivity] });
  const risks = findDocumentPublicationRisks({ ...document, type: "cross_border_notice_consent", activityIds: [outboundActivity.id] }, [outboundActivity], [], { content, signedPipiaActivityIds: [outboundActivity.id], enterprise: publicationEnterprise });
  assert.deepEqual(risks, []);
  assert.match(content, /个人确认：_{6,}/);
});

test("安全事件通知使用事件专属要素，不误要求日常处理目的和保存期限", () => {
  const safeActivity: ProcessingActivity = {
    ...activity,
    id: "incident-activity",
    facts: {
      ...emptyActivityFacts(), recipients: ["不向外部提供"], retentionPeriod: "业务结束后三年删除", retentionBasis: "争议处理需要",
      deletionMethod: "每季度删除到期记录", automatedDecision: "no", sensitiveInformation: "no", minorsInvolved: "no", crossBorderAccess: "no"
    }
  };
  const content = "# 个人信息安全事件通知\n\n单位：发布测试有限公司\n\n## 事件情况\n2026年9月10日发现部分联系人文件被误发，涉及范围已经核实。\n\n## 可能造成的影响\n可能导致工作联系方式被无关人员知悉。\n\n## 已经采取的补救措施\n已撤回文件、停用链接并复核访问记录。\n\n## 您可以采取的措施\n请警惕异常联系。\n\n联系我们：个人信息权益服务；rights@example.test";
  const risks = findExternalContentQualityRisks({ type: "incident_notification", content, activities: [safeActivity], enterprise: publicationEnterprise });
  assert.deepEqual(risks, []);
});
