import test from "node:test";
import assert from "node:assert/strict";
import { emptyActivityFacts } from "../src/lib/activity-facts.ts";
import { activityOptionGroups, applyScenarioDefaults, guidedFactFields, scenarioGuidanceCatalog } from "../src/lib/scenario-guidance.ts";

test("员工和招聘场景只预填高置信度事实", () => {
  const employee = applyScenarioDefaults(emptyActivityFacts(), "SCN-HR-EMPLOYEE");
  assert.deepEqual(employee.dataSubjects, ["员工"]);
  assert.deepEqual(employee.purposes, ["员工管理"]);
  assert.deepEqual(employee.informationTypes, []);

  const recruit = applyScenarioDefaults(emptyActivityFacts(), "SCN-HR-RECRUIT");
  assert.deepEqual(recruit.dataSubjects, ["求职者"]);
  assert.deepEqual(recruit.purposes, ["招聘与录用"]);
});

test("场景预设不覆盖用户已经填写的内容", () => {
  const facts = { ...emptyActivityFacts(), dataSubjects: ["实习申请人"], purposes: ["校园招聘"] };
  const result = applyScenarioDefaults(facts, "SCN-HR-RECRUIT");
  assert.deepEqual(result.dataSubjects, ["实习申请人"]);
  assert.deepEqual(result.purposes, ["校园招聘"]);
});

test("所有场景建议都来自可取消的公共选项，自由场景不作预判", () => {
  for (const guidance of Object.values(scenarioGuidanceCatalog)) {
    for (const field of guidedFactFields) {
      for (const value of [...(guidance.defaults?.[field] || []), ...(guidance.recommended?.[field] || [])]) {
        assert.ok((activityOptionGroups[field] as readonly string[]).includes(value), `${field} 存在未登记建议：${value}`);
      }
    }
  }
  assert.deepEqual(scenarioGuidanceCatalog["SCN-OTHER"], {});
});
