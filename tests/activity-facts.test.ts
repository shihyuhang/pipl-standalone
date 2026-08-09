import test from "node:test";
import assert from "node:assert/strict";
import { activityFactsCompleteness, emptyActivityFacts, isActivityReadyForTriage } from "../src/lib/activity-facts.ts";

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
    retentionPeriod: "合作结束后删除",
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
    retentionPeriod: "在职期间", sensitiveInformation: "no" as const, minorsInvolved: "no" as const
  };
  assert.ok(activityFactsCompleteness(facts) < 1);
  assert.equal(isActivityReadyForTriage(facts), false);
});
