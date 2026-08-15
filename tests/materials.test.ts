import test from "node:test";
import assert from "node:assert/strict";
import { generateMaterialDraft } from "../src/lib/materials.ts";
import type { EnterpriseProfile, ProcessingActivity } from "../src/lib/types.ts";

const enterprise: EnterpriseProfile = {
  id: "enterprise-1", legalName: "示例科技有限公司", orgType: "有限责任公司", industry: "软件和信息技术服务", businessModel: "B2B",
  ownership: "外商投资企业", processingRole: "个人信息处理者", personCount: 120, countVerified: true,
  subjectCategories: ["客户联系人"], sensitiveCategories: [], minorsPossible: "no", crossBorder: "no",
  privacyContactName: "张负责人", privacyContactRole: "行政负责人", privacyContactChannel: "privacy@example.com",
  qualificationStatus: "eligible", qualificationSummary: "适用小型处理者路径", onboardingCompleted: true, updatedAt: "2026-08-09T00:00:00.000Z"
};

const activity: ProcessingActivity = {
  id: "activity-1", scenarioCode: "B2B_CONTACT", name: "客户与供应商联系", description: "项目和合同沟通",
  status: "active", completeness: 1, createdAt: "2026-08-09T00:00:00.000Z",
  facts: {
    dataSubjects: ["客户联系人", "供应商联系人"], informationTypes: ["姓名和联系方式", "单位和职务"],
    purposes: ["履行项目或合同"], collectionChannels: ["企业客户或供应商提供"], systems: ["邮箱或通讯工具", "CRM或ERP"],
    recipients: ["仅必要服务商"], approximatePersonCount: 120, accessRoles: ["业务经办人员", "部门负责人"],
    systemOperators: ["本单位系统管理员", "云服务商"], retentionPeriod: "合作期间，结束后保留3年",
    deletionMethod: "由行政负责人按季度核对并删除到期记录", rightsChannel: "privacy@example.com", automatedDecision: "no", sensitiveInformation: "no",
    minorsInvolved: "no", crossBorderAccess: "no", notes: "", confirmedAt: "2026-08-09T00:00:00.000Z"
  }
};

test("B2B联系人告知会带入已确认企业和业务事实", () => {
  const result = generateMaterialDraft({
    type: "b2b_contact_notice", name: "业务联系人个人信息告知", scope: "客户和供应商联系",
    audience: "客户和供应商联系人", enterprise, activities: [activity]
  });
  assert.match(result, /示例科技有限公司/);
  assert.match(result, /客户与供应商联系/);
  assert.match(result, /姓名和联系方式/);
  assert.match(result, /合作期间，结束后保留3年/);
  assert.match(result, /privacy@example.com/);
});

test("处理活动清单按场景输出信息、目的、系统和接收方", () => {
  const result = generateMaterialDraft({
    type: "processing_register", name: "个人信息处理活动清单", scope: "全部已确认业务",
    audience: "内部合规档案", enterprise, activities: [activity]
  });
  assert.match(result, /履行项目或合同/);
  assert.match(result, /CRM或ERP/);
  assert.match(result, /仅必要服务商/);
  assert.match(result, /业务经办人员/);
  assert.match(result, /按季度核对并删除/);
  assert.match(result, /privacy@example.com/);
});
