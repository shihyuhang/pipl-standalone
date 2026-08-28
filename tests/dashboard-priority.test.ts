import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardTaskGuidance, prioritizeDashboardTasks } from "../src/lib/dashboard-priority.ts";

const task = (overrides: Record<string, unknown> = {}) => ({
  code: "OTHER",
  category: "常规事项",
  priority: "normal" as const,
  sourceType: null,
  status: "open" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  ...overrides
});

test("超出适用范围的判断排在常规材料之前", () => {
  const ordered = prioritizeDashboardTasks([
    task({ code: "CREATE-FIRST-NOTICE", category: "合规材料" }),
    task({ code: "QUALIFICATION-OUT-OF-SCOPE", category: "适用判断", priority: "high" })
  ]);
  assert.equal(ordered[0].code, "QUALIFICATION-OUT-OF-SCOPE");
  assert.equal(getDashboardTaskGuidance(ordered[0]).label, "现在先确认");
});

test("高风险事项排在基础事实和普通待办之前", () => {
  const ordered = prioritizeDashboardTasks([
    task({ code: "ADD-FIRST-SCENARIO" }),
    task({ code: "OTHER" }),
    task({ code: "HIGH-RISK-REVIEW", priority: "high" })
  ]);
  assert.deepEqual(ordered.map(item => item.code), ["HIGH-RISK-REVIEW", "ADD-FIRST-SCENARIO", "OTHER"]);
});

test("尚无业务时先记录首项业务，再进行高风险复核", () => {
  const context = { activityCount: 0 };
  const ordered = prioritizeDashboardTasks([
    task({ code: "HIGH-RISK-REVIEW", priority: "high" }),
    task({ code: "ADD-FIRST-SCENARIO" })
  ], context);
  assert.deepEqual(ordered.map(item => item.code), ["ADD-FIRST-SCENARIO", "HIGH-RISK-REVIEW"]);
  assert.equal(getDashboardTaskGuidance(ordered[0], context).label, "现在先记录");
  assert.match(getDashboardTaskGuidance(ordered[1], context).reason, /具体业务事实/);
});

test("人数确认即使是高优先级也展示具体的排序原因", () => {
  const guidance = getDashboardTaskGuidance(task({ code: "VERIFY-PERSON-COUNT", priority: "high" }));
  assert.equal(guidance.label, "基础先做");
  assert.match(guidance.reason, /人数口径/);
});

test("同一优先级中继续办理的事项排在尚未开始的事项之前", () => {
  const ordered = prioritizeDashboardTasks([
    task({ code: "OTHER-A", status: "open" }),
    task({ code: "OTHER-B", status: "in_progress" })
  ]);
  assert.equal(ordered[0].code, "OTHER-B");
});
