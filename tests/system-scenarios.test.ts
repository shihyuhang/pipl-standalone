import test from "node:test";
import assert from "node:assert/strict";
import { assessQualification } from "../src/lib/qualification.ts";
import { isActivityReadyForTriage } from "../src/lib/activity-facts.ts";
import { runScenarioTriage } from "../src/lib/ai-gateway.ts";
import { smallProcessorScenarios } from "./fixtures/small-processor-scenarios.ts";

process.env.AI_SCENARIO_TRIAGE_PROVIDER = "local";

for (const scenario of smallProcessorScenarios) {
  test(`场景测试：${scenario.name}`, async () => {
    const qualification = assessQualification(scenario.qualification);
    assert.equal(qualification.status, scenario.expectedQualification, `${scenario.id} 的适用路径不符合预期`);
    for (const code of scenario.expectedTaskCodes) {
      assert.ok(qualification.tasks.some(item => item.code === code), `${scenario.id} 缺少待办 ${code}`);
    }

    assert.equal(
      isActivityReadyForTriage(scenario.activityFacts),
      scenario.expectedReadyForTriage,
      `${scenario.id} 的业务完整度判断不符合预期`
    );

    const triage = await runScenarioTriage({
      enterprise: {
        id: scenario.id,
        personCount: scenario.qualification.personCount,
        countVerified: scenario.qualification.countVerified,
        processingRole: scenario.qualification.processingRole,
        sensitiveCategories: scenario.qualification.sensitiveCategories,
        minorsPossible: scenario.qualification.minorsPossible,
        crossBorder: scenario.qualification.crossBorder
      },
      scenario: { id: scenario.id, name: scenario.name, description: scenario.description },
      confirmedFacts: { ...scenario.activityFacts }
    });
    assert.equal(triage.source, "local_rules");
    assert.equal(triage.status, scenario.expectedLocalTriage, `${scenario.id} 的基础规则分流不符合预期`);
    for (const title of scenario.expectedFindingTitles) {
      assert.ok(triage.findings.some(item => item.title === title), `${scenario.id} 缺少发现：${title}`);
    }
  });
}
