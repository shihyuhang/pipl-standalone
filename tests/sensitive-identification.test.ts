import assert from "node:assert/strict";
import test from "node:test";
import {
  callSensitiveIdentificationAi,
  normalizeSensitiveAiOutput,
  prepareSensitiveIdentificationInput,
  runSensitiveIdentificationRules,
  type SensitiveIdentificationInput
} from "../src/lib/sensitive-identification.ts";

const input: SensitiveIdentificationInput = {
  scenarioCode: "SCN-HR-EMPLOYEE",
  scenarioName: "员工管理",
  scenarioDescription: "入职、薪酬、考勤和离职管理",
  dataSubjects: ["员工"],
  informationTypes: ["薪酬和考勤"],
  informationDetails: "工资卡号、年度体检报告，门禁使用人脸比对；另保存普通员工头像和办公城市",
  purposes: ["员工管理"],
  systems: ["HR或薪酬系统"],
  minorsInvolved: "no"
};

test("基础规则从具体字段和处理方式识别候选类别", () => {
  const result = runSensitiveIdentificationRules(input);
  assert.deepEqual(result.candidates.map(item => item.category), ["biometric", "medical_health", "financial_account"]);
  assert.ok(result.boundaryObservations.some(item => /普通照片/.test(item)));
  assert.ok(result.boundaryObservations.some(item => /普通地址或粗略地区/.test(item)));
});

test("发送AI前遮蔽疑似真实个人信息值", () => {
  const result = prepareSensitiveIdentificationInput({
    ...input,
    informationDetails: "联系人13800138000，身份证110101199001011234，邮箱test@example.com，工资卡6222021234567890123"
  });
  assert.equal(result.redactionCount, 4);
  assert.doesNotMatch(result.input.informationDetails, /13800138000|110101199001011234|test@example\.com|6222021234567890123/);
});

test("AI只能返回平台受控的法定类别", () => {
  const result = normalizeSensitiveAiOutput({
    candidates: [
      { category: "medical_health", confidence: "medium", evidence: ["病假证明"], reasoning: "涉及健康状况", question: "是否保存证明内容？" },
      { category: "商业秘密", confidence: "high", evidence: ["报价"], reasoning: "模型自行创建的类别" }
    ],
    questions: ["是否保存原件？"],
    boundary_observations: ["普通订单不当然属于金融账户信息。"]
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].category, "medical_health");
});

test("AI调用使用结构化低温输出并规范化结果", async () => {
  let requestBody: any = null;
  const fetchMock = async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ candidates: [{ category: "financial_account", confidence: "high", evidence: ["工资卡号"], reasoning: "涉及金融账户", question: "是否保存卡号？" }], questions: [], boundary_observations: [] }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await callSensitiveIdentificationAi(input, {
    provider: "custom", apiBaseUrl: "https://ai.example.test/v1", model: "test-model", apiKey: "secret"
  }, fetchMock as typeof fetch, 2_000);
  assert.equal(result.candidates[0].category, "financial_account");
  assert.equal(requestBody?.temperature, 0.05);
  assert.deepEqual(requestBody?.response_format, { type: "json_object" });
});
