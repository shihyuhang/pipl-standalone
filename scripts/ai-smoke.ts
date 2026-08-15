import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveScenarioTriageProvider, runScenarioTriage } from "../src/lib/ai-gateway.ts";
import { smallProcessorScenarios } from "../tests/fixtures/small-processor-scenarios.ts";

function loadLocalEnvironment() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnvironment();

const provider = resolveScenarioTriageProvider();
if (provider === "local") {
  console.log("SKIP：AI辅助分析尚未配置；本地自动测试不受影响。");
  process.exit(0);
}

const selectedIds = ["foreign-b2b-low-volume", "employee-health-data"];
for (const id of selectedIds) {
  const scenario = smallProcessorScenarios.find(item => item.id === id)!;
  const result = await runScenarioTriage({
    enterprise: {
      id: scenario.id,
      orgType: "有限责任公司",
      businessModel: "B2B",
      ownership: "外商投资企业",
      personCount: scenario.qualification.personCount,
      countVerified: scenario.qualification.countVerified,
      processingRole: scenario.qualification.processingRole,
      subjectCategories: scenario.activityFacts.dataSubjects,
      sensitiveCategories: scenario.qualification.sensitiveCategories,
      minorsPossible: scenario.qualification.minorsPossible,
      crossBorder: scenario.qualification.crossBorder,
      qualificationStatus: scenario.expectedQualification
    },
    scenario: {
      id: scenario.id,
      scenarioCode: scenario.id,
      name: scenario.name,
      description: scenario.description,
      status: "active",
      completeness: scenario.expectedReadyForTriage ? 1 : 0.91,
      facts: scenario.activityFacts,
      createdAt: "2026-08-11T00:00:00.000Z"
    },
    confirmedFacts: { ...scenario.activityFacts }
  });

  if (result.source === "local_rules") {
    console.error(`AI调用未完成：${scenario.name}`, result.warnings.join("；") || result.summary);
  }
  assert.notEqual(result.source, "local_rules", `${scenario.name} 未实际调用AI辅助分析`);
  assert.ok(["draft_ready", "needs_review", "needs_input"].includes(result.status));
  assert.equal(typeof result.summary, "string");
  assert.ok(result.summary.length > 0, `${scenario.name} 没有分析摘要`);
  assert.ok(result.findings.every(item => ["L0", "L1", "L2", "L3"].includes(item.riskLevel)));
  const userVisibleText = [result.summary, ...result.findings.flatMap(item => [item.title, item.description])].join(" ");
  for (const forbidden of ["informationTypes", "purposes", "dataSubjects", "recipients", "systems", "personCount", "countVerified", "sensitiveInformation", "crossBorderAccess", "approximatePersonCount", "accessRoles", "systemOperators", "deletionMethod", "rightsChannel", "automatedDecision"]) {
    assert.equal(userVisibleText.includes(forbidden), false, `用户可见结果不应出现内部字段名 ${forbidden}`);
  }
  for (const forbidden of ["processingRole", "independent_processor", "entrusted_processor", "控制者", "数据主体", "controller", "processor", "data subject"]) {
    assert.equal(userVisibleText.toLowerCase().includes(forbidden.toLowerCase()), false, `用户可见结果不应出现境外术语或内部枚举 ${forbidden}`);
  }

  if (id === "foreign-b2b-low-volume") {
    if (result.status !== "draft_ready") {
      console.log("普通B2B异常升级详情：", JSON.stringify(result, null, 2));
    }
    assert.equal(result.status, "draft_ready", "普通B2B案例应允许继续完善，不应要求暂停");
    assert.equal(result.findings.some(item => item.riskLevel === "L3"), false, "普通B2B案例不应出现阻断级发现");
  }
  if (id === "employee-health-data") {
    assert.equal(result.status, "needs_review", "健康信息案例应进入人工复核路径");
    assert.equal(result.reviewRequired, true, "健康信息案例应要求人工复核");
    assert.ok(result.findings.some(item => item.riskLevel === "L3"), "健康信息案例应至少出现一项L3发现");
  }

  const titles = result.findings.map(item => item.title).join("；") || "无";
  console.log(`PASS：${scenario.name} → ${result.status}，发现 ${result.findings.length} 项：${titles}`);
}
