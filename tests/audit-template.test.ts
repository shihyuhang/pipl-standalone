import test from "node:test";
import assert from "node:assert/strict";
import { auditGroups, auditItems, buildAuditSignals } from "../src/lib/audit-template.ts";
import type { EnterpriseProfile, ProcessingActivity } from "../src/lib/types.ts";

const enterprise: EnterpriseProfile = {
  id: "enterprise-1", legalName: "示例外资咨询有限公司", orgType: "有限责任公司", businessModel: "B2B",
  ownership: "外商投资企业", processingRole: "个人信息处理者", personCount: 80, countVerified: true,
  subjectCategories: ["客户联系人"], sensitiveCategories: [], minorsPossible: "no", crossBorder: "no",
  privacyContactName: "王经理", privacyContactRole: "行政经理", privacyContactChannel: "privacy@example.com",
  qualificationStatus: "eligible", qualificationSummary: "适合小型处理者路径", onboardingCompleted: true, updatedAt: "2026-08-09T00:00:00.000Z"
};

const activity: ProcessingActivity = {
  id: "activity-1", scenarioCode: "B2B_CONTACT", name: "客户联系人管理", description: "项目联系",
  status: "active", completeness: 1, createdAt: "2026-08-09T00:00:00.000Z",
  facts: {
    dataSubjects: ["客户联系人"], informationTypes: ["姓名和联系方式"], purposes: ["履行项目或合同"],
    collectionChannels: ["企业客户提供"], systems: ["企业邮箱"], recipients: ["不向外部提供"],
    retentionPeriod: "合作结束后3年", sensitiveInformation: "no", minorsInvolved: "no", crossBorderAccess: "no", notes: "", confirmedAt: "2026-08-09T00:00:00.000Z"
  }
};

test("官方自查模板完整保留24项且编号唯一有序", () => {
  assert.equal(auditItems.length, 24);
  assert.deepEqual(auditItems.map(item => item.code), Array.from({ length: 24 }, (_, index) => `A${String(index + 1).padStart(2, "0")}`));
  assert.equal(new Set(auditItems.map(item => item.code)).size, 24);
  assert.ok(auditItems.every(item => item.title && item.question && item.help));
});

test("24项被归入六个面向用户的分组且没有遗漏", () => {
  assert.equal(auditGroups.length, 6);
  const groupCodes = new Set(auditGroups.map(group => group.code));
  assert.ok(auditItems.every(item => groupCodes.has(item.groupCode)));
  assert.ok(auditGroups.every(group => auditItems.some(item => item.groupCode === group.code)));
});

test("自查线索使用企业和业务事实，不把线索当作自动结论", () => {
  const signals = buildAuditSignals("A12", { enterprise, activities: [activity], documents: [], assessments: [], pipias: [], tasks: [] });
  assert.ok(signals.some(signal => /不涉及敏感个人信息/.test(signal.text)));
  assert.ok(signals.every(signal => ["positive", "warning", "neutral"].includes(signal.tone)));
});
