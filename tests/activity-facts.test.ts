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
