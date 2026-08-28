import test from "node:test";
import assert from "node:assert/strict";
import { emptyActivityFacts } from "../src/lib/activity-facts.ts";
import { activityMatchesAudience, classifyActivityAudienceGroups, incompatibleActivities, inferMaterialAudienceGroup } from "../src/lib/material-audience.ts";
import { materialCatalog } from "../src/lib/materials.ts";
import type { ProcessingActivity } from "../src/lib/types.ts";

function activity(scenarioCode: string, dataSubjects: string[]): ProcessingActivity {
  return {
    id: `${scenarioCode}-id`, scenarioCode, name: scenarioCode, description: "测试业务",
    status: "active", completeness: 1, createdAt: "2026-08-16T00:00:00.000Z",
    facts: { ...emptyActivityFacts(), dataSubjects, confirmedAt: "2026-08-16T00:00:00.000Z" }
  };
}

test("员工和候选人被识别为两个独立材料人群", () => {
  const employee = activity("SCN-HR-EMPLOYEE", ["员工"]);
  const candidate = activity("SCN-HR-RECRUIT", ["候选人"]);

  assert.deepEqual(classifyActivityAudienceGroups(employee), ["employee"]);
  assert.deepEqual(classifyActivityAudienceGroups(candidate), ["candidate"]);
  assert.equal(activityMatchesAudience(employee, "candidate"), false);
  assert.equal(activityMatchesAudience(candidate, "employee"), false);
  assert.deepEqual(incompatibleActivities([employee, candidate], "employee").map(item => item.id), [candidate.id]);
});

test("同一人群的多个业务可合并，内部材料可覆盖不同人群", () => {
  const payroll = activity("SCN-HR-EMPLOYEE", ["员工"]);
  const attendance = activity("CUSTOM-HR", ["在职人员"]);
  const recruit = activity("SCN-HR-RECRUIT", ["求职者"]);

  assert.equal(incompatibleActivities([payroll, attendance], "employee").length, 0);
  assert.equal(incompatibleActivities([payroll, attendance, recruit], "internal").length, 0);
});

test("患者和产品使用者等自定义主体可映射到产品用户材料", () => {
  const patientSupport = activity("CUSTOM-MEDICAL-SUPPORT", ["患者或产品使用者"]);
  assert.deepEqual(classifyActivityAudienceGroups(patientSupport), ["consumer"]);
  assert.equal(activityMatchesAudience(patientSupport, "consumer"), true);
});

test("员工告知和候选人告知分别限定适用人群", () => {
  assert.deepEqual(materialCatalog.find(item => item.code === "employee_notice")?.audienceGroups, ["employee"]);
  assert.deepEqual(materialCatalog.find(item => item.code === "candidate_notice")?.audienceGroups, ["candidate"]);
});

test("协议、台账和办理记录均归入内部材料入口", () => {
  ["processor_agreement", "joint_processing_agreement", "rights_request_register", "consent_record", "incident_record"].forEach(type => {
    assert.equal(inferMaterialAudienceGroup(type), "internal");
  });
});
