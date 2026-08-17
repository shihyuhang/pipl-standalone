import test from "node:test";
import assert from "node:assert/strict";
import { buildMaterialAiTransferPreview, callMaterialDraftAi } from "../src/lib/material-ai.ts";
import { materialCatalog } from "../src/lib/materials.ts";
import type { EnterpriseProfile, MaterialAiRuntimeConfiguration, ProcessingActivity } from "../src/lib/types.ts";

const enterprise = {
  id: "e1", legalName: "示例科技有限公司", orgType: "有限责任公司", industry: "软件服务", businessModel: "B2B",
  ownership: "民营", processingRole: "个人信息处理者", personCount: 100, countVerified: true, subjectCategories: ["客户联系人"],
  sensitiveCategories: [], minorsPossible: "no", crossBorder: "no", privacyContactName: "张三", privacyContactRole: "负责人",
  privacyContactChannel: "privacy@example.com", qualificationStatus: "eligible", qualificationSummary: "", onboardingCompleted: true, updatedAt: "2026-08-16"
} as EnterpriseProfile;

const activity = {
  id: "a1", scenarioCode: "B2B-CONTACT", name: "客户联系", description: "合同沟通", status: "active", completeness: 1, createdAt: "2026-08-16",
  facts: { dataSubjects: ["客户联系人"], informationTypes: ["姓名", "电话"], purposes: ["合同沟通"], collectionChannels: ["客户提供"], systems: ["CRM"], recipients: [], approximatePersonCount: 100, accessRoles: ["销售"], systemOperators: ["管理员"], retentionPeriod: "合作结束后三年", deletionMethod: "到期删除", rightsChannel: "privacy@example.com", automatedDecision: "no", sensitiveInformation: "no", minorsInvolved: "no", crossBorderAccess: "no", notes: "", confirmedAt: "2026-08-16" }
} as ProcessingActivity;

const config: MaterialAiRuntimeConfiguration = { provider: "deepseek", apiBaseUrl: "https://example.test/v1", model: "test-model", apiKey: "secret-key" };
const definition = materialCatalog.find(item => item.code === "b2b_contact_notice")!;

test("AI完整草稿使用所选服务并返回正文与待确认事项", async () => {
  let requestedUrl = ""; let requestBody = ""; let authorization = "";
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(url); requestBody = String(init?.body || ""); authorization = String((init?.headers as Record<string, string>)?.Authorization || "");
    return new Response(JSON.stringify({ id: "run-1", choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ content: `# 【单位名称】业务联系人个人信息告知\n\n联系渠道：【联系渠道】\n\n${"完整正文。".repeat(60)}`, pending_facts: ["确认服务商名称"], summary: "根据已确认事实形成草稿" }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const result = await callMaterialDraftAi({ name: definition.name, scope: definition.defaultScope, audience: definition.defaultAudience, definition, enterprise, activities: [activity], baselineDraft: "# 基础模板\n\n单位：示例科技有限公司\n\n联系：privacy@example.com" }, config, fetchMock, 1000);
  assert.equal(requestedUrl, "https://example.test/v1/chat/completions");
  assert.equal(authorization, "Bearer secret-key");
  assert.doesNotMatch(requestBody, /示例科技有限公司|privacy@example\.com/);
  assert.match(requestBody, /【单位名称】/);
  assert.match(requestBody, /【联系渠道】/);
  assert.match(requestBody, /不得编造/);
  assert.match(result.content, /完整正文/);
  assert.match(result.content, /示例科技有限公司/);
  assert.match(result.content, /privacy@example\.com/);
  assert.deepEqual(result.pendingFacts, ["确认服务商名称"]);
  assert.equal(result.provider, "deepseek");
  assert.equal(result.remoteRunId, "run-1");
});

test("提交预览采用默认最小字段并且不展示可恢复的真实值", () => {
  const preview = buildMaterialAiTransferPreview({ name: definition.name, scope: definition.defaultScope, audience: definition.defaultAudience, definition, enterprise, activities: [{ ...activity, facts: { ...activity.facts, notes: "负责人：李四，手机13800138000" } }], baselineDraft: "单位：示例科技有限公司；联系：privacy@example.com" });
  const serialized = JSON.stringify(preview.payload);
  assert.doesNotMatch(serialized, /示例科技有限公司|privacy@example\.com|13800138000|李四/);
  assert.match(serialized, /【单位名称】|【联系渠道】/);
  assert.ok(preview.excludedFields.includes("activity.notes"));
  assert.equal(preview.fields.find(item => item.code === "activity.notes")?.included, false);
  assert.ok(preview.redactionCount >= 3);
  const withNotes = buildMaterialAiTransferPreview({ name: definition.name, scope: definition.defaultScope, audience: definition.defaultAudience, definition, enterprise, activities: [{ ...activity, facts: { ...activity.facts, notes: "负责人：李四，手机13800138000，联系电话：010-12345678" } }], baselineDraft: "单位：示例科技有限公司；联系：privacy@example.com", excludedFields: preview.excludedFields.filter(item => item !== "activity.notes") });
  assert.doesNotMatch(JSON.stringify(withNotes.payload), /李四|13800138000|010-12345678/);
  assert.ok(withNotes.redactionLabels.includes("手机号码"));
  assert.ok(withNotes.redactionLabels.includes("固定电话号码"));
  assert.ok(withNotes.redactionLabels.includes("自由文本中的姓名"));
});

test("AI删除必要占位符时拒绝结果，避免交付材料缺少本地数据", async () => {
  const fetchMock = (async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ content: `# 未保留占位符\n\n${"正文。".repeat(100)}`, pending_facts: [], summary: "草稿" }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  await assert.rejects(() => callMaterialDraftAi({ name: definition.name, scope: definition.defaultScope, audience: definition.defaultAudience, definition, enterprise, activities: [activity], baselineDraft: "单位：示例科技有限公司；联系：privacy@example.com" }, config, fetchMock, 1000), /未保留必要脱敏占位符/);
});

test("AI返回截断内容时拒绝作为材料草稿", async () => {
  const fetchMock = (async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  await assert.rejects(() => callMaterialDraftAi({ name: definition.name, scope: definition.defaultScope, audience: definition.defaultAudience, definition, enterprise, activities: [activity], baselineDraft: "基础模板" }, config, fetchMock, 1000), /截断/);
});
