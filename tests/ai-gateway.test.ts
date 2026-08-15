import test from "node:test";
import assert from "node:assert/strict";
import { callDirectScenarioTriage, resolveScenarioTriageProvider } from "../src/lib/ai-gateway.ts";

const context = {
  enterprise: {
    id: "test-enterprise",
    orgType: "company",
    industry: "软件和信息技术服务",
    ownership: "domestic",
    processingRole: "independent_processor",
    personCount: 80,
    countVerified: true,
    subjectCategories: ["customer_contact"],
    sensitiveCategories: [],
    minorsPossible: "no",
    crossBorder: "no",
    qualificationStatus: "eligible"
  },
  scenario: { id: "test-scenario", name: "客户联系人管理", description: "维护客户企业联系人" },
  confirmedFacts: {
    informationTypes: ["姓名", "工作电话"],
    purposes: ["履行客户合同"],
    dataSubjects: ["客户企业联系人"],
    sensitiveInformation: "no",
    minorsInvolved: "no",
    crossBorderAccess: "no",
    recipients: [],
    automatedDecision: "no"
  }
};

test("自动选择已经配置的直连模型", () => {
  assert.equal(resolveScenarioTriageProvider({ DEEPSEEK_API_KEY: "key" }), "deepseek");
  assert.equal(resolveScenarioTriageProvider({ DASHSCOPE_API_KEY: "key" }), "qwen");
  assert.equal(resolveScenarioTriageProvider({ MOONSHOT_API_KEY: "key" }), "kimi");
});

test("明确指定的模型未配置时安全降级", () => {
  assert.equal(resolveScenarioTriageProvider({ AI_SCENARIO_TRIAGE_PROVIDER: "deepseek" }), "local");
  assert.equal(resolveScenarioTriageProvider({ AI_SCENARIO_TRIAGE_PROVIDER: "local", DEEPSEEK_API_KEY: "key" }), "local");
});

test("没有直连模型时仍可选择已配置的Dify", () => {
  assert.equal(resolveScenarioTriageProvider({ DIFY_ENABLE: "true", DIFY_API_KEY_SCENARIO_TRIAGE: "key" }), "dify");
});

test("直连模型使用统一协议并规范输出语言", async () => {
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  const fetchMock = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: "response-1",
      model: "deepseek-test",
      choices: [{
        finish_reason: "stop",
        message: { content: JSON.stringify({
          status: "needs_input",
          summary: "需要补充一项信息",
          warnings: [],
          findings: [{
            title: "processingRole需要确认",
            description: "请确认企业是controller还是processor，并联系data subject。",
            risk_level: "L2"
          }]
        }) }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const result = await callDirectScenarioTriage(context, "deepseek", fetchMock, {
    DEEPSEEK_API_KEY: "test-key",
    DEEPSEEK_API_BASE_URL: "https://example.test/v1",
    DEEPSEEK_MODEL: "deepseek-test"
  });

  assert.equal(requestUrl, "https://example.test/v1/chat/completions");
  assert.deepEqual(requestBody.response_format, { type: "json_object" });
  assert.match(JSON.stringify(requestBody), /软件和信息技术服务/);
  assert.equal(result.source, "deepseek");
  assert.equal(result.workflowVersion, "scenario-triage-direct-v1");
  const visibleText = [result.summary, ...result.findings.flatMap(item => [item.title, item.description])].join(" ").toLowerCase();
  for (const forbidden of ["processingrole", "controller", "processor", "data subject", "数据主体", "控制者"]) {
    assert.equal(visibleText.includes(forbidden), false, `不应显示境外术语或内部字段：${forbidden}`);
  }
});

test("直连模型拒绝被截断的JSON结果", async () => {
  const fetchMock = (async () => new Response(JSON.stringify({
    choices: [{ finish_reason: "length", message: { content: "{\"status\":\"needs_input\"}" } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  await assert.rejects(
    callDirectScenarioTriage(context, "qwen", fetchMock, { DASHSCOPE_API_KEY: "test-key" }),
    /不完整/
  );
});
