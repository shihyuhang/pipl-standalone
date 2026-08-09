import test from "node:test";
import assert from "node:assert/strict";
import { assessQualification } from "../src/lib/qualification.ts";

const base = {
  personCount: 2300,
  countVerified: true,
  sensitiveCategories: [] as string[],
  minorsPossible: "no" as const,
  crossBorder: "no" as const,
  processingRole: "independent_processor"
};

test("普通小型 B2B 处理者进入简化工作路径", () => {
  assert.equal(assessQualification(base).status, "eligible");
});

test("人数达到十万人时转出小型处理者路径", () => {
  const result = assessQualification({ ...base, personCount: 100000 });
  assert.equal(result.status, "out_of_scope");
  assert.equal(result.tasks[0].code, "QUALIFICATION-OUT-OF-SCOPE");
});

test("人数口径未确认时允许建档但生成待办", () => {
  const result = assessQualification({ ...base, countVerified: false });
  assert.equal(result.status, "conditional");
  assert.ok(result.tasks.some(item => item.code === "VERIFY-PERSON-COUNT"));
});

test("敏感信息或境外访问触发人工复核", () => {
  const result = assessQualification({ ...base, sensitiveCategories: ["health"], crossBorder: "yes" });
  assert.equal(result.status, "needs_review");
  assert.equal(result.tasks.some(item => item.code === "HIGH-RISK-REVIEW"), true);
});
