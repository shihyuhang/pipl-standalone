import { parseAiJsonObject } from "./dify.ts";
import { resolveMaterialAiRuntimeConfiguration } from "./ai-settings.ts";
import { sensitiveCategoryCodes, sensitiveCategoryDefinitions, type SensitiveCategoryCode } from "./sensitive-info.ts";
import type { FactAnswer, MaterialAiRuntimeConfiguration } from "./types.ts";

export type SensitiveConfidence = "high" | "medium" | "low";
export type SensitiveCandidateBasis = "rule" | "ai" | "rule_and_ai";

export interface SensitiveIdentificationInput {
  scenarioCode: string;
  scenarioName: string;
  scenarioDescription: string;
  dataSubjects: string[];
  informationTypes: string[];
  informationDetails: string;
  purposes: string[];
  systems: string[];
  minorsInvolved: FactAnswer;
}

export interface SensitiveCandidate {
  category: SensitiveCategoryCode;
  label: string;
  confidence: SensitiveConfidence;
  evidence: string[];
  reasoning: string;
  question: string;
  basis: SensitiveCandidateBasis;
}

export interface SensitiveIdentificationResult {
  source: "ai_assisted" | "local_rules";
  candidates: SensitiveCandidate[];
  questions: string[];
  boundaryObservations: string[];
  warnings: string[];
  provider: string | null;
  model: string | null;
  promptVersion: string;
  redactionCount: number;
}

type RawAiCandidate = Record<string, unknown>;
type AiResponse = { candidates?: unknown; questions?: unknown; boundary_observations?: unknown };

const promptVersion = "sensitive-identification-v1";
const confidenceRank: Record<SensitiveConfidence, number> = { low: 1, medium: 2, high: 3 };

const ruleDefinitions: Array<{
  category: SensitiveCategoryCode;
  pattern: RegExp;
  reasoning: string;
  question: string;
}> = [
  { category: "biometric", pattern: /人脸识别|人脸比对|刷脸|指纹|掌纹|虹膜|声纹|步态识别|基因/, reasoning: "描述中出现了用于识别身份的生物特征或识别方式。", question: "这些特征是否会经过技术处理，用于识别或验证个人身份？" },
  { category: "religious_belief", pattern: /宗教信仰|宗教组织|宗教活动|宗教习俗|教派/, reasoning: "描述中出现了宗教信仰、组织、活动或习俗信息。", question: "是否会记录具体宗教信仰、所属宗教组织或参加的宗教活动？" },
  { category: "specific_identity", pattern: /残障|残疾|特殊职业身份|不适宜公开的职业|特定身份/, reasoning: "描述中出现了可能不适宜公开的特定身份信息。", question: "该身份泄露后是否容易造成歧视、人格尊严受损或人身安全风险？" },
  { category: "medical_health", pattern: /病症|病史|诊断|体检报告|体检结果|病假证明|就诊|检验报告|检查报告|生育信息|医疗记录|健康档案/, reasoning: "描述中出现了疾病、就诊、检查或健康状况资料。", question: "是否保存具体病症、检查结果或医疗记录，而不只是一般状态结论？" },
  { category: "financial_account", pattern: /银行账户|银行账号|银行卡号|工资卡|支付账号|证券账户|基金账户|保险账户|公积金账户|账户鉴别信息|支付密码|收入明细/, reasoning: "描述中出现了金融账户、账户鉴别信息或个人收入明细。", question: "是否保存具体账户号码、鉴别信息或可反映个人财务状况的明细？" },
  { category: "location_trajectory", pattern: /精准定位|精确位置|实时位置|连续定位|GPS|行踪轨迹|活动轨迹|车辆轨迹|定位权限/, reasoning: "描述中出现了精准位置、连续定位或活动轨迹。", question: "位置精度和采集频率是否足以定位个人，或形成连续活动轨迹？" },
  { category: "other_sensitive", pattern: /身份证照片|身份证正反面|证件影像|征信|信用报告|犯罪记录|性取向|性生活|私密部位/, reasoning: "描述中出现了标准列明或可能符合危害后果标准的其他敏感信息。", question: "是否实际保存这些资料的内容或影像，而不只是完成一次核验？" }
];

const textList = (value: unknown, maxItems = 30, maxLength = 100): string[] => Array.isArray(value)
  ? value.map(String).map(item => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems)
  : [];

const textValue = (value: unknown, maxLength: number): string => String(value || "").trim().slice(0, maxLength);

function categoryLabel(category: SensitiveCategoryCode): string {
  return sensitiveCategoryDefinitions.find(item => item.code === category)?.label || category;
}

function validCategory(value: unknown): SensitiveCategoryCode | null {
  const category = String(value || "") as SensitiveCategoryCode;
  return (sensitiveCategoryCodes as readonly string[]).includes(category) ? category : null;
}

function normalizeConfidence(value: unknown): SensitiveConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function redactText(value: string): { text: string; count: number } {
  let text = value;
  let count = 0;
  const replace = (pattern: RegExp, token: string) => {
    text = text.replace(pattern, () => { count += 1; return token; });
  };
  replace(/\b1\d{10}\b/g, "[已移除手机号]");
  replace(/\b\d{17}[\dXx]\b/g, "[已移除身份证号]");
  replace(/\b\d{16,19}\b/g, "[已移除账户号码]");
  replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[已移除邮箱]");
  return { text, count };
}

export function prepareSensitiveIdentificationInput(value: SensitiveIdentificationInput): { input: SensitiveIdentificationInput; redactionCount: number } {
  const sanitized: SensitiveIdentificationInput = {
    scenarioCode: textValue(value.scenarioCode, 100),
    scenarioName: textValue(value.scenarioName, 200),
    scenarioDescription: textValue(value.scenarioDescription, 1000),
    dataSubjects: textList(value.dataSubjects),
    informationTypes: textList(value.informationTypes),
    informationDetails: textValue(value.informationDetails, 1500),
    purposes: textList(value.purposes),
    systems: textList(value.systems),
    minorsInvolved: ["yes", "no", "unknown"].includes(String(value.minorsInvolved)) ? value.minorsInvolved : ""
  };
  let redactionCount = 0;
  for (const key of ["scenarioDescription", "informationDetails"] as const) {
    const redacted = redactText(sanitized[key]);
    sanitized[key] = redacted.text;
    redactionCount += redacted.count;
  }
  return { input: sanitized, redactionCount };
}

export function runSensitiveIdentificationRules(input: SensitiveIdentificationInput): Pick<SensitiveIdentificationResult, "candidates" | "questions" | "boundaryObservations"> {
  const searchable = [input.scenarioDescription, input.informationDetails, ...input.informationTypes].filter(Boolean).join("；");
  const candidates: SensitiveCandidate[] = [];
  for (const rule of ruleDefinitions) {
    const match = searchable.match(rule.pattern);
    if (!match) continue;
    candidates.push({
      category: rule.category,
      label: categoryLabel(rule.category),
      confidence: "high",
      evidence: [match[0]],
      reasoning: rule.reasoning,
      question: rule.question,
      basis: "rule"
    });
  }
  const boundaryObservations: string[] = [];
  if (/照片|视频|头像/.test(searchable) && (!/人脸识别|人脸比对|刷脸|生物识别/.test(searchable) || /普通|头像/.test(searchable))) {
    boundaryObservations.push("普通照片、视频或头像不当然属于生物识别信息；只有经技术处理用于识别身份时才进入该类别。");
  }
  if (/订单|交易|金额/.test(searchable) && !/银行账户|银行账号|银行卡号|支付账号|证券账户|基金账户|保险账户/.test(searchable)) {
    boundaryObservations.push("普通订单、交易记录或金额不因涉及资金就自动属于金融账户信息。");
  }
  if (/地址|地区|城市|区域/.test(searchable) && !/精准定位|精确位置|实时位置|连续定位|GPS|轨迹/.test(searchable)) {
    boundaryObservations.push("普通地址或粗略地区不等于精准定位或行踪轨迹，需要结合精度、频率和用途判断。");
  }
  const questions = input.minorsInvolved === "yes"
    ? ["本业务涉及不满十四周岁未成年人，其个人信息依法属于敏感个人信息；请确认监护人同意和专门处理规则。"]
    : [];
  return { candidates, questions, boundaryObservations };
}

export function normalizeSensitiveAiOutput(value: AiResponse): Pick<SensitiveIdentificationResult, "candidates" | "questions" | "boundaryObservations"> {
  const candidates: SensitiveCandidate[] = [];
  const rows = Array.isArray(value.candidates) ? value.candidates.slice(0, 14) : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as RawAiCandidate;
    const category = validCategory(item.category);
    if (!category) continue;
    candidates.push({
      category,
      label: categoryLabel(category),
      confidence: normalizeConfidence(item.confidence),
      evidence: textList(item.evidence, 5, 200),
      reasoning: textValue(item.reasoning, 500) || "AI根据业务描述识别出疑似敏感个人信息，需要由用户结合实际情况确认。",
      question: textValue(item.question, 500),
      basis: "ai"
    });
  }
  return {
    candidates,
    questions: textList(value.questions, 10, 500),
    boundaryObservations: textList(value.boundary_observations, 10, 500)
  };
}

function mergeCandidates(ruleItems: SensitiveCandidate[], aiItems: SensitiveCandidate[]): SensitiveCandidate[] {
  const merged = new Map<SensitiveCategoryCode, SensitiveCandidate>();
  for (const item of [...ruleItems, ...aiItems]) {
    const current = merged.get(item.category);
    if (!current) { merged.set(item.category, item); continue; }
    const higher = confidenceRank[item.confidence] > confidenceRank[current.confidence] ? item.confidence : current.confidence;
    merged.set(item.category, {
      ...current,
      confidence: higher,
      evidence: [...new Set([...current.evidence, ...item.evidence])].slice(0, 5),
      reasoning: current.basis === "rule" ? current.reasoning : item.reasoning || current.reasoning,
      question: current.question || item.question,
      basis: "rule_and_ai"
    });
  }
  return [...merged.values()].sort((a, b) => confidenceRank[b.confidence] - confidenceRank[a.confidence]);
}

function sensitiveSystemPrompt(): string {
  const categories = sensitiveCategoryDefinitions.map(item => `${item.code}：${item.label}；示例：${item.examples}；边界：${item.boundary}`).join("\n");
  return `你是中国个人信息保护合规平台中的敏感个人信息辅助识别助手。你只提取候选项、说明证据并提出追问，不作最终法律认定。

判断顺序：
1. 以《个人信息保护法》第二十八条为主，判断泄露或非法使用后是否容易侵害人格尊严或危害人身、财产安全；
2. 参照 GB/T 45574—2025 细化类别、示例和边界；
3. 不满十四周岁未成年人的个人信息依法属于敏感个人信息；
4. 不得仅凭“照片、订单、地址、身份证号”等名称机械认定，应结合处理方式、精度、频率、用途和危害后果；
5. 信息不足时降低置信度并提出一个普通用户能回答的具体问题。

只允许使用以下 category 值：
${categories}

仅输出一个 JSON 对象：
{"candidates":[{"category":"上述受控代码","confidence":"high|medium|low","evidence":["输入中的触发描述"],"reasoning":"为何疑似属于该类以及适用边界","question":"仍需用户确认的具体事实"}],"questions":["跨类别的待确认问题"],"boundary_observations":["为什么某项普通信息不应被自动认定"]}

不得输出新的类别，不得宣称“已经合规”或“确定属于”，不得复述疑似真实的个人信息值。`;
}

export async function callSensitiveIdentificationAi(
  input: SensitiveIdentificationInput,
  config: MaterialAiRuntimeConfiguration,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || 120_000)
): Promise<Pick<SensitiveIdentificationResult, "candidates" | "questions" | "boundaryObservations">> {
  const response = await fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: sensitiveSystemPrompt() },
        { role: "user", content: `请对以下业务字段说明进行辅助识别：\n${JSON.stringify(input)}` }
      ],
      temperature: 0.05,
      response_format: { type: "json_object" },
      max_tokens: 2500,
      stream: false
    }),
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 120_000)
  });
  if (!response.ok) throw new Error(`AI服务返回错误（${response.status}）`);
  const payload = await response.json() as { choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null } }> };
  const choice = payload.choices?.[0];
  if (!choice?.message?.content) throw new Error("AI服务未返回有效识别结果");
  if (choice.finish_reason === "length") throw new Error("AI识别结果不完整");
  return normalizeSensitiveAiOutput(parseAiJsonObject(choice.message.content));
}

export async function identifySensitiveInformation(value: SensitiveIdentificationInput): Promise<SensitiveIdentificationResult> {
  const prepared = prepareSensitiveIdentificationInput(value);
  const rules = runSensitiveIdentificationRules(prepared.input);
  const config = resolveMaterialAiRuntimeConfiguration();
  const base = {
    provider: config?.provider || null,
    model: config?.model || null,
    promptVersion,
    redactionCount: prepared.redactionCount
  };
  if (!config) return {
    ...base,
    source: "local_rules",
    ...rules,
    warnings: ["AI服务当前不可用，本次仅显示法定类别基础规则识别结果。"]
  };
  try {
    const ai = await callSensitiveIdentificationAi(prepared.input, config);
    return {
      ...base,
      source: "ai_assisted",
      candidates: mergeCandidates(rules.candidates, ai.candidates),
      questions: [...new Set([...rules.questions, ...ai.questions])].slice(0, 10),
      boundaryObservations: [...new Set([...rules.boundaryObservations, ...ai.boundaryObservations])].slice(0, 10),
      warnings: []
    };
  } catch (error) {
    return {
      ...base,
      source: "local_rules",
      ...rules,
      warnings: [`AI辅助识别暂时不可用，已安全降级为基础规则：${error instanceof Error ? error.message : "未知错误"}`]
    };
  }
}
