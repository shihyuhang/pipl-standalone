import test from "node:test";
import assert from "node:assert/strict";
import { generateMaterialDraft, materialCatalog } from "../src/lib/materials.ts";
import type { EnterpriseProfile, ProcessingActivity } from "../src/lib/types.ts";

const enterprise: EnterpriseProfile = {
  id: "enterprise-1", legalName: "示例科技有限公司", orgType: "有限责任公司", industry: "软件和信息技术服务", businessModel: "B2B",
  ownership: "外商投资企业", processingRole: "个人信息处理者", personCount: 120, countVerified: true,
  subjectCategories: ["客户联系人"], sensitiveCategories: [], minorsPossible: "no", crossBorder: "no",
  privacyContactName: "张负责人", privacyContactRole: "行政负责人", privacyContactChannel: "privacy@example.com",
  publicContactDepartment: "个人信息保护联系部门", publicContactChannel: "privacy@example.com",
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
  assert.match(result, /处理方式：/);
  assert.doesNotMatch(result, /可访问岗位：|系统运维方：|保存或使用位置：/);
});

test("对外材料优先使用具体字段并清除其他信息占位分类", () => {
  const detailedActivity: ProcessingActivity = {
    ...activity,
    facts: { ...activity.facts, informationTypes: ["姓名和联系方式", "其他信息"], informationDetails: "姓名、手机号、产品序列号、不良事件描述和诊断结论" }
  };
  const result = generateMaterialDraft({
    type: "privacy_notice", name: "隐私政策", scope: "患者售后服务", audience: "患者或产品使用者", enterprise, activities: [detailedActivity]
  });
  assert.match(result, /姓名、手机号、产品序列号、不良事件描述和诊断结论/);
  assert.doesNotMatch(result, /使用的个人信息：[^\n]*其他信息/);
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

test("材料按法定类别输出敏感个人信息，不回退为普通信息字段", () => {
  const sensitiveActivity: ProcessingActivity = {
    ...activity,
    facts: { ...activity.facts, sensitiveInformation: "yes", sensitiveCategories: ["financial_account"] }
  };
  const result = generateMaterialDraft({
    type: "sensitive_consent", name: "敏感个人信息单独同意书", scope: "工资账户处理",
    audience: "员工", enterprise, activities: [sensitiveActivity]
  });
  assert.match(result, /金融账户信息/);
  assert.doesNotMatch(result, /姓名和联系方式、单位和职务/);
});

test("对外材料只使用公开联系渠道并带入已确认的敏感信息说明", () => {
  const sensitiveActivity: ProcessingActivity = {
    ...activity,
    facts: {
      ...activity.facts,
      rightsChannel: "internal-owner@example.com",
      sensitiveInformation: "yes",
      sensitiveCategories: ["medical_health"],
      sensitiveNecessity: "处理诊断证明是完成保险理赔所必需",
      sensitiveRightsImpact: "泄露可能造成健康隐私暴露和歧视",
      sensitiveProtectionMeasures: "仅福利专员访问，加密传输并按期删除"
    }
  };
  const result = generateMaterialDraft({
    type: "employee_notice", name: "员工个人信息告知", scope: "员工福利",
    audience: "员工", enterprise: { ...enterprise, privacyContactChannel: "internal-owner@example.com", publicContactChannel: "rights@example.com" }, activities: [sensitiveActivity]
  });
  assert.match(result, /rights@example\.com/);
  assert.doesNotMatch(result, /internal-owner@example\.com/);
  assert.match(result, /完成保险理赔所必需/);
  assert.match(result, /仅福利专员访问/);
});

test("员工告知与候选人告知使用不同的处理范围说明", () => {
  const employee = generateMaterialDraft({ type: "employee_notice", name: "员工个人信息告知", scope: "员工管理", audience: "员工", enterprise, activities: [activity] });
  const candidate = generateMaterialDraft({ type: "candidate_notice", name: "候选人个人信息告知", scope: "招聘管理", audience: "候选人", enterprise, activities: [activity] });

  assert.match(employee, /建立和履行劳动关系/);
  assert.doesNotMatch(employee, /简历收集、候选人筛选/);
  assert.match(candidate, /简历收集、候选人筛选/);
  assert.doesNotMatch(candidate, /建立和履行劳动关系/);
});

test("委托处理协议形成处理边界、安全事件和删除要求", () => {
  const result = generateMaterialDraft({
    type: "processor_agreement", name: "个人信息委托处理协议", scope: "CRM云服务",
    audience: "云服务商", enterprise, activities: [activity]
  });
  assert.match(result, /仅按甲方书面指示/);
  assert.match(result, /客户与供应商联系/);
  assert.match(result, /返还、删除和证明/);
  assert.match(result, /安全事件/);
});

test("权利请求、同意和事件记录均提供可直接使用的留痕字段", () => {
  const rights = generateMaterialDraft({ type: "rights_request_register", name: "权利请求记录", scope: "全部请求", audience: "内部", enterprise, activities: [activity] });
  const consent = generateMaterialDraft({ type: "consent_record", name: "同意记录", scope: "单独同意", audience: "内部", enterprise, activities: [activity] });
  const incident = generateMaterialDraft({ type: "incident_record", name: "事件记录", scope: "安全事件", audience: "内部", enterprise, activities: [activity] });
  assert.match(rights, /身份核验/);
  assert.match(rights, /答复时间和方式/);
  assert.match(consent, /对应告知材料名称和版本/);
  assert.match(consent, /撤回时间/);
  assert.match(incident, /事件时间线|事件基本信息/);
  assert.match(incident, /通知和报告/);
});

test("材料目录标明基础、条件触发或留痕属性及主要法规依据", () => {
  assert.ok(materialCatalog.length >= 18);
  assert.ok(materialCatalog.every(item => item.requirement));
  assert.ok(materialCatalog.every(item => item.legalBasis));
  assert.equal(materialCatalog.find(item => item.code === "sensitive_consent")?.requirement, "conditional");
});
