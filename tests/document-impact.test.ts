import test from "node:test";
import assert from "node:assert/strict";
import { changedActivityFactFields, describeActivityImpact } from "../src/lib/document-impact.ts";
import { emptyActivityFacts } from "../src/lib/activity-facts.ts";

test("业务事实变化会定位到明确材料章节", () => {
  const before = { ...emptyActivityFacts(), recipients: ["不向外部提供"], retentionPeriod: "一年" };
  const after = { ...before, recipients: ["某云服务商"], retentionPeriod: "三年", confirmedAt: "2026-08-16T00:00:00.000Z" };
  const fields = changedActivityFactFields(before, after);
  assert.deepEqual(fields, ["recipients", "retentionPeriod"]);
  const impact = describeActivityImpact("客户服务", fields);
  assert.match(impact.reason, /外部服务商或接收方/);
  assert.ok(impact.affectedSections.includes("委托处理和向其他单位提供"));
  assert.ok(impact.affectedSections.includes("保存和删除"));
});
