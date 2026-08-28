import test from "node:test";
import assert from "node:assert/strict";
import { assessRetentionRisk } from "../src/lib/retention-risk.ts";
import { mergeTriageFindings, normalizeAiTriageResult, runLocalScenarioTriage } from "../src/lib/dify.ts";

test("永久保存触发依据必填和负责人复核提示", () => {
  const result = assessRetentionRisk("永久");
  assert.equal(result.level, "high");
  assert.equal(result.requiresBasis, true);
  assert.match(result.message, /法律、行政法规/);
});

test("补充依据后可以完成事实记录但仍保留风险提示", () => {
  const result = assessRetentionRisk("长期保存", "劳动争议处理所需，具体期限待负责人按适用规定核对");
  assert.equal(result.level, "high");
  assert.equal(result.requiresBasis, false);
});

test("明确的目的终止点和期限不被机械判定异常", () => {
  assert.equal(assessRetentionRisk("合作期间，合作结束后保留3年").level, "none");
});

test("本地规则和AI结果都不会漏掉永久保存风险", () => {
  const context = {
    enterprise: { crossBorder: "no", minorsPossible: "no", sensitiveCategories: [] },
    scenario: {},
    confirmedFacts: { crossBorderAccess: "no", sensitiveInformation: "no", minorsInvolved: "no", automatedDecision: "no", recipients: [], retentionPeriod: "永久", retentionBasis: "" }
  };
  const local = runLocalScenarioTriage(context, "");
  assert.ok(local.findings.some(item => /保存期限/.test(item.title)));
  const combined = normalizeAiTriageResult(context, { status: "draft_ready", findings: [], warnings: [], summary: "未发现问题" }, "deepseek");
  assert.ok(combined.findings.some(item => /保存期限/.test(item.title)));
  assert.equal(combined.status, "needs_input");
});

test("同一整改主题的AI与规则结果合并为一项", () => {
  const merged = mergeTriageFindings([
    { title: "保存期限可能超过必要范围", description: "当前填写为长期保存。", riskLevel: "L2" },
    { title: "永久保存且无删除机制", description: "需要补充到期删除安排。", riskLevel: "L3" },
    { title: "确认境外访问情况", description: "境外管理员可能远程访问。", riskLevel: "L2" }
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, "完善保存期限与删除机制");
  assert.equal(merged[0].riskLevel, "L3");
  assert.match(merged[0].description, /1\..*2\./);
});

test("敏感个人信息的重复判断合并但不吞并未成年人专项", () => {
  const merged = mergeTriageFindings([
    { title: "涉及医疗健康敏感信息，需法律专业复核", description: "出现体检报告。", riskLevel: "L3" },
    { title: "复核敏感个人信息", description: "确认特定目的和严格保护措施。", riskLevel: "L2" },
    { title: "确认未成年人情况", description: "可能涉及不满十四周岁未成年人。", riskLevel: "L3" }
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, "复核敏感个人信息处理");
  assert.equal(merged[1].title, "确认未成年人情况");
});
