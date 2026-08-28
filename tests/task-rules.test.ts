import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemTaskRules, shouldCreateUnsatisfiedSystemTask, type SystemTaskSnapshot } from "../src/lib/task-rules.ts";

const base: SystemTaskSnapshot = {
  onboardingCompleted: true, personCount: 80, countVerified: true, processingRole: "个人信息处理者",
  sensitiveCategories: [], minorsPossible: "no", crossBorder: "no", activityCount: 1, externalNoticeCount: 1,
  activities: [{ id: "activity-1", name: "客户联系人", completeness: 1 }]
};

test("已有业务、材料和确认事实时系统任务均可自动完成", () => {
  const rules = buildSystemTaskRules(base);
  assert.equal(rules.find(item => item.code === "ADD-FIRST-SCENARIO")?.satisfied, true);
  assert.equal(rules.find(item => item.code === "CREATE-FIRST-NOTICE")?.satisfied, true);
  assert.equal(rules.find(item => item.code === "VERIFY-PERSON-COUNT")?.satisfied, true);
  assert.equal(rules.find(item => item.code === "COMPLETE-activity-1")?.satisfied, true);
});

test("缺少客观事实时任务保持待办", () => {
  const rules = buildSystemTaskRules({ ...base, activityCount: 0, externalNoticeCount: 0, personCount: null, countVerified: false, activities: [] });
  assert.equal(rules.find(item => item.code === "ADD-FIRST-SCENARIO")?.satisfied, false);
  assert.equal(rules.find(item => item.code === "CREATE-FIRST-NOTICE")?.satisfied, false);
  assert.equal(rules.find(item => item.code === "VERIFY-PERSON-COUNT")?.satisfied, false);
});

test("高风险事实仍存在时不能自动关闭复核任务", () => {
  const rules = buildSystemTaskRules({ ...base, sensitiveCategories: ["健康信息"] });
  assert.equal(rules.find(item => item.code === "HIGH-RISK-REVIEW")?.satisfied, false);
});

test("任务完成依据不展示内部处理角色枚举", () => {
  const rules = buildSystemTaskRules({ ...base, processingRole: "independent_processor" });
  const roleRule = rules.find(item => item.code === "VERIFY-PROCESSING-ROLE")!;
  assert.match(roleRule.completionBasis, /主要由本单位自行决定/);
  assert.doesNotMatch(roleRule.completionBasis, /independent_processor|processingRole/);
});

test("人工复核完成后不因风险事实仍存在而立即重新置顶", () => {
  const rule = buildSystemTaskRules({ ...base, sensitiveCategories: ["medical_health"] }).find(item => item.code === "HIGH-RISK-REVIEW")!;
  assert.equal(shouldCreateUnsatisfiedSystemTask(rule, { completionMode: "manual", completedAt: "2026-08-26T10:00:00.000Z" }, "2026-08-26T09:00:00.000Z"), false);
  assert.equal(shouldCreateUnsatisfiedSystemTask(rule, { completionMode: "manual", completedAt: "2026-08-26T08:00:00.000Z" }, "2026-08-26T09:00:00.000Z"), true);
});

test("同类业务的场景备注进入任务名称以便区分", () => {
  const rules = buildSystemTaskRules({ ...base, activities: [{ id: "activity-1", name: "消费者或会员", remark: "小程序会员", completeness: 0.4 }] });
  const activityRule = rules.find(item => item.code === "COMPLETE-activity-1")!;
  assert.match(activityRule.title, /消费者或会员 · 小程序会员/);
  assert.match(activityRule.evidenceNote, /小程序会员/);
});

test("具体业务触发影响评估后建立发布前任务并承接总体风险提醒", () => {
  const rules = buildSystemTaskRules({ ...base, sensitiveCategories: ["medical_health"], activities: [{ id: "activity-1", name: "员工管理", completeness: 1, specialRiskCovered: true, pipiaRequired: true, pipiaComplete: false, pipiaReasons: ["处理敏感个人信息"] }] });
  assert.equal(rules.find(item => item.code === "HIGH-RISK-REVIEW")?.satisfied, true);
  const pipia = rules.find(item => item.code === "PIPIA-activity-1")!;
  assert.equal(pipia.satisfied, false);
  assert.equal(pipia.priority, "high");
  assert.match(pipia.description, /发布为合规有效版本/);
});
