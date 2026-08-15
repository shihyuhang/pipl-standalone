import {
  buildAiEnterpriseContext,
  normalizeAiTriageResult,
  parseAiJsonObject,
  runDifyScenarioTriage,
  runLocalScenarioTriage,
  type TriageContext,
  type TriageResult
} from "./dify.ts";

export type AiProvider = "auto" | "deepseek" | "qwen" | "kimi" | "dify" | "local";
type DirectAiProvider = Exclude<AiProvider, "auto" | "dify" | "local">;
type Environment = Record<string, string | undefined>;

interface DirectProviderConfig {
  provider: DirectAiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
}

const providerPriority: DirectAiProvider[] = ["deepseek", "qwen", "kimi"];
const promptVersion = "scenario-triage-direct-v1";

const providerDefaults: Record<DirectAiProvider, { baseUrl: string; model: string; keyName: string }> = {
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", keyName: "DEEPSEEK_API_KEY" },
  qwen: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", keyName: "DASHSCOPE_API_KEY" },
  kimi: { baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k2.6", keyName: "MOONSHOT_API_KEY" }
};

function readProviderConfig(provider: DirectAiProvider, env: Environment): DirectProviderConfig | null {
  const defaults = providerDefaults[provider];
  const apiKey = String(env[defaults.keyName] || "").trim();
  if (!apiKey) return null;
  const prefix = provider === "qwen" ? "QWEN" : provider === "kimi" ? "KIMI" : "DEEPSEEK";
  return {
    provider,
    apiKey,
    baseUrl: String(env[`${prefix}_API_BASE_URL`] || defaults.baseUrl).replace(/\/$/, ""),
    model: String(env[`${prefix}_MODEL`] || defaults.model)
  };
}

function configuredDify(env: Environment): boolean {
  return env.DIFY_ENABLE === "true" && Boolean(String(env.DIFY_API_KEY_SCENARIO_TRIAGE || "").trim());
}

export function resolveScenarioTriageProvider(env: Environment = process.env): Exclude<AiProvider, "auto"> {
  const requested = String(env.AI_SCENARIO_TRIAGE_PROVIDER || "auto").toLowerCase() as AiProvider;
  if (requested === "local") return "local";
  if (requested === "dify") return configuredDify(env) ? "dify" : "local";
  if (providerPriority.includes(requested as DirectAiProvider)) {
    return readProviderConfig(requested as DirectAiProvider, env) ? requested as DirectAiProvider : "local";
  }
  for (const provider of providerPriority) {
    if (readProviderConfig(provider, env)) return provider;
  }
  return configuredDify(env) ? "dify" : "local";
}

function buildDirectAiContext(context: TriageContext): Record<string, unknown> {
  const enterprise = buildAiEnterpriseContext(context.enterprise);
  const { processingRole, ...safeEnterprise } = enterprise;
  const scenario = context.scenario;
  return {
    enterprise: {
      ...safeEnterprise,
      informationUseDecisionMode: processingRole
    },
    scenario: {
      id: scenario.id,
      scenarioCode: scenario.scenarioCode,
      name: scenario.name,
      description: scenario.description,
      status: scenario.status,
      completeness: scenario.completeness
    },
    confirmedFacts: context.confirmedFacts || {}
  };
}

function systemPrompt(): string {
  return `你是中国小型个人信息处理者合规平台中的业务情况初步检查助手。

你的任务仅限于：
1. 检查用户填写的信息是否完整；
2. 检查不同回答之间是否存在明显矛盾；
3. 判断是否需要补充事实、开展个人信息保护影响评估或由负责人、专业人员复核；
4. 用普通企业人员能理解的中文说明下一步。

必须遵守：
- 只使用中国个人信息保护法律语境中的表述，例如“个人信息处理者”“受托处理”“共同处理”“相关个人”。
- 不得使用 GDPR 的 controller、processor、data subject 或其直译“控制者”“数据主体”。
- 不得在输出中出现输入 JSON 的英文键名、枚举值或程序字段。
- 不判断用户陈述是否真实，不作合规认证，不使用“已经合规”“通过认证”等结论。
- 信息不足时明确提出需要补充的事实；涉及敏感个人信息、不满十四周岁未成年人、自动化决策、境外提供或重大权益影响时，不得直接放行。
- 仅输出一个 JSON 对象，不要输出 Markdown、解释文字或第二个 JSON。

输出结构：
{
  "status": "draft_ready | needs_input | needs_review",
  "summary": "面向用户的一句话结论",
  "warnings": ["必要的限制或提醒"],
  "findings": [
    {
      "title": "通俗、具体的事项名称",
      "description": "说明缺什么、为何要确认以及用户下一步做什么",
      "risk_level": "L0 | L1 | L2 | L3"
    }
  ]
}

分级原则：L0为记录性提示；L1为普通完善事项；L2为补充信息后再判断；L3为需要负责人或专业人员复核。`;
}

export async function callDirectScenarioTriage(
  context: TriageContext,
  provider: DirectAiProvider,
  fetchImpl: typeof fetch = fetch,
  env: Environment = process.env
): Promise<TriageResult> {
  const config = readProviderConfig(provider, env);
  if (!config) throw new Error("AI服务尚未完成配置");
  const timeoutMs = Number(env.AI_REQUEST_TIMEOUT_MS || 120_000);
  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: `请根据以下已确认资料完成初步检查：\n${JSON.stringify(buildDirectAiContext(context))}` }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 2500,
      stream: false
    }),
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 120_000)
  });
  if (!response.ok) throw new Error(`AI服务返回错误（${response.status}）`);
  const payload = await response.json() as ChatCompletionResponse;
  const choice = payload.choices?.[0];
  if (!choice?.message?.content) throw new Error("AI服务未返回有效结果");
  if (choice.finish_reason === "length") throw new Error("AI结果不完整，请稍后重试");
  const output = parseAiJsonObject(choice.message.content);
  return normalizeAiTriageResult(
    context,
    output,
    provider,
    payload.id || null,
    promptVersion
  );
}

function fallbackPreference(env: Environment): "dify" | "local" {
  return env.AI_SCENARIO_TRIAGE_FALLBACK_PROVIDER === "dify" && configuredDify(env) ? "dify" : "local";
}

export async function runScenarioTriage(context: TriageContext): Promise<TriageResult> {
  const provider = resolveScenarioTriageProvider();
  if (provider === "local") {
    return runLocalScenarioTriage(context, "AI辅助分析尚未配置，本次仅完成基础规则检查。");
  }
  if (provider === "dify") return runDifyScenarioTriage(context);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await callDirectScenarioTriage(context, provider);
    } catch (error) {
      lastError = error;
    }
  }

  if (fallbackPreference(process.env) === "dify") {
    const result = await runDifyScenarioTriage(context);
    if (result.source !== "local_rules") result.warnings.push("首选AI服务暂不可用，已使用备用分析服务。");
    return result;
  }

  const reason = lastError instanceof Error ? lastError.message : "未知错误";
  return runLocalScenarioTriage(context, `AI辅助分析暂时不可用，已安全降级为基础规则检查。${reason ? `（${reason}）` : ""}`);
}
