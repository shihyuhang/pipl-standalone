import test from "node:test";
import assert from "node:assert/strict";
import { activityFactsCompleteness, emptyActivityFacts, isActivityReadyForTriage, normalizeActivityFacts } from "../src/lib/activity-facts.ts";

test("新业务场景从15%开始", () => {
  assert.equal(activityFactsCompleteness(emptyActivityFacts()), 0.15);
});

test("完成全部必要事实后才能进入AI快速分流", () => {
  const facts = {
    ...emptyActivityFacts(),
    dataSubjects: ["客户联系人"],
    informationTypes: ["姓名和联系方式"],
    purposes: ["履行项目或合同"],
    collectionChannels: ["本人主动提供"],
    systems: ["邮箱或通讯工具"],
    recipients: ["不向外部提供"],
    approximatePersonCount: 80,
    accessRoles: ["业务经办人员"],
    systemOperators: ["本单位系统管理员"],
    retentionPeriod: "合作结束后删除",
    deletionMethod: "由业务负责人按季度核对后删除",
    rightsChannel: "privacy@example.test",
    automatedDecision: "no" as const,
    sensitiveInformation: "no" as const,
    minorsInvolved: "no" as const,
    crossBorderAccess: "no" as const
  };
  assert.equal(activityFactsCompleteness(facts), 1);
  assert.equal(isActivityReadyForTriage(facts), true);
});

test("缺少任一必要事实时不能进入AI快速分流", () => {
  const facts = {
    ...emptyActivityFacts(),
    dataSubjects: ["员工"], informationTypes: ["姓名和联系方式"], purposes: ["员工管理"],
    collectionChannels: ["本人主动提供"], systems: ["HR或薪酬系统"], recipients: ["仅必要服务商"],
    approximatePersonCount: 30, accessRoles: ["人力资源岗位"], systemOperators: ["云服务商"],
    retentionPeriod: "在职期间", deletionMethod: "离职后按期限清理", rightsChannel: "hr@example.test",
    automatedDecision: "no" as const, sensitiveInformation: "no" as const, minorsInvolved: "no" as const
  };
  assert.ok(activityFactsCompleteness(facts) < 1);
  assert.equal(isActivityReadyForTriage(facts), false);
});

test("缺少个人权利联系渠道时仍提示完善，不能误判为已完成", () => {
  const facts = {
    ...emptyActivityFacts(),
    dataSubjects: ["客户联系人"], informationTypes: ["姓名和联系方式"], purposes: ["履行项目或合同"],
    collectionChannels: ["本人主动提供"], systems: ["邮箱或通讯工具"], recipients: ["不向外部提供"],
    approximatePersonCount: 20, accessRoles: ["业务经办人员"], systemOperators: ["本单位系统管理员"],
    retentionPeriod: "合作结束后删除", deletionMethod: "由业务负责人删除", automatedDecision: "no" as const,
    sensitiveInformation: "no" as const, minorsInvolved: "no" as const, crossBorderAccess: "no" as const
  };
  assert.equal(isActivityReadyForTriage(facts), false);
});

test("旧数据没有场景人数时保持待确认，不把空值当作0人", () => {
  assert.equal(normalizeActivityFacts({ approximatePersonCount: null }).approximatePersonCount, null);
  assert.equal(normalizeActivityFacts({}).approximatePersonCount, null);
  assert.equal(normalizeActivityFacts({ approximatePersonCount: 0 }).approximatePersonCount, 0);
});

test("不能用笼统的涉及敏感信息替代法定类别确认", () => {
  const base = {
    ...emptyActivityFacts(),
    dataSubjects: ["员工"], informationTypes: ["体检报告"], purposes: ["员工健康管理"],
    collectionChannels: ["本人主动提供"], systems: ["HR系统"], recipients: ["不向外部提供"],
    approximatePersonCount: 30, accessRoles: ["人力资源岗位"], systemOperators: ["本单位系统管理员"],
    retentionPeriod: "在职期间", deletionMethod: "到期删除", rightsChannel: "hr@example.test",
    automatedDecision: "no" as const, sensitiveInformation: "yes" as const,
    minorsInvolved: "no" as const, crossBorderAccess: "no" as const
  };
  assert.equal(isActivityReadyForTriage(base), false);
  assert.equal(isActivityReadyForTriage({ ...base, sensitiveCategories: ["medical_health"] }), false);
  assert.equal(isActivityReadyForTriage({
    ...base,
    sensitiveCategories: ["medical_health"],
    sensitiveNecessity: "体检结果用于确认岗位健康要求，无法由一般状态替代",
    sensitiveRightsImpact: "泄露可能造成健康隐私暴露或不当歧视",
    sensitiveProtectionMeasures: "仅职业健康经办人员访问，加密保存并按期删除"
  }), true);
});

test("不满十四周岁个人信息自动归入敏感个人信息路径", () => {
  const normalized = normalizeActivityFacts({ sensitiveInformation: "no", minorsInvolved: "yes" });
  assert.equal(normalized.sensitiveInformation, "yes");
  assert.deepEqual(normalized.sensitiveCategories, []);
});

test("选择其他信息后必须补充具体类型才能完成", () => {
  const base = {
    ...emptyActivityFacts(),
    dataSubjects: ["员工"], informationTypes: ["姓名和联系方式", "其他信息"], purposes: ["员工管理"],
    collectionChannels: ["本人主动提供"], systems: ["HR系统"], recipients: ["不向外部提供"], approximatePersonCount: 30,
    accessRoles: ["人力资源岗位"], systemOperators: ["本单位系统管理员"], retentionPeriod: "在职期间", deletionMethod: "离职后删除",
    rightsChannel: "hr@example.test", automatedDecision: "no" as const, sensitiveInformation: "no" as const, minorsInvolved: "no" as const, crossBorderAccess: "no" as const
  };
  assert.equal(isActivityReadyForTriage(base), false);
  assert.equal(isActivityReadyForTriage({ ...base, informationTypes: [...base.informationTypes, "职业资格证书"] }), true);
});

test("永久保存未说明依据时不能进入快速检查", () => {
  const base = {
    ...emptyActivityFacts(), dataSubjects: ["客户联系人"], informationTypes: ["姓名和联系方式"], purposes: ["合同沟通"],
    collectionChannels: ["本人主动提供"], systems: ["CRM"], recipients: ["不向外部提供"], approximatePersonCount: 20,
    accessRoles: ["业务经办人员"], systemOperators: ["本单位系统管理员"], retentionPeriod: "永久", deletionMethod: "不删除",
    rightsChannel: "privacy@example.test", automatedDecision: "no" as const, sensitiveInformation: "no" as const, minorsInvolved: "no" as const, crossBorderAccess: "no" as const
  };
  assert.equal(isActivityReadyForTriage(base), false);
  assert.equal(isActivityReadyForTriage({ ...base, retentionBasis: "法定留存要求待负责人核对" }), true);
});
