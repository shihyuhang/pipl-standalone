import { parseAiJsonObject } from "./dify.ts";
import { resolveMaterialAiRuntimeConfiguration } from "./ai-settings.ts";
import type { EnterpriseProfile, MaterialAiRuntimeConfiguration, ProcessingActivity } from "./types.ts";
import type { MaterialDefinition } from "./materials.ts";
import { normalizeChinaLegalText } from "./legal-language.ts";
import { sensitiveCategoryLabels } from "./sensitive-info.ts";
import { activityDisplayName } from "./activity-label.ts";
import { enterpriseSubjectLabel } from "./enterprise-subjects.ts";
import { externalProcessingRelationshipLabel, normalizedExternalProcessingRelationships } from "./external-processing.ts";

const promptVersion = "material-complete-draft-v2-preview-redaction";

interface ChatCompletionResponse {
  id?: string;
  choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null } }>;
}

export interface MaterialAiDraftInput {
  name: string;
  scope: string;
  audience: string;
  definition: MaterialDefinition;
  enterprise: EnterpriseProfile;
  activities: ProcessingActivity[];
  baselineDraft: string;
  excludedFields?: string[];
}

export interface MaterialAiFieldOption {
  code: string;
  group: "企业信息" | "业务信息";
  label: string;
  description: string;
  included: boolean;
}

export interface MaterialAiTransferPreview {
  payload: Record<string, unknown>;
  fields: MaterialAiFieldOption[];
  excludedFields: string[];
  redactionCount: number;
  redactionLabels: string[];
  restorationNotice: string;
}

export interface MaterialAiDraftResult {
  content: string;
  pendingFacts: string[];
  summary: string;
  provider: string;
  model: string;
  promptVersion: string;
  remoteRunId: string | null;
  redactionCount: number;
  excludedFields: string[];
}

const fieldDefinitions: Array<Omit<MaterialAiFieldOption, "included">> = [
  { code: "enterprise.orgType", group: "企业信息", label: "单位类型", description: "例如有限责任公司、事业单位等。" },
  { code: "enterprise.industry", group: "企业信息", label: "所属行业", description: "帮助AI调整材料表达。" },
  { code: "enterprise.businessModel", group: "企业信息", label: "业务模式", description: "B2B、B2C或内部管理。" },
  { code: "enterprise.ownership", group: "企业信息", label: "单位性质", description: "民营、外商投资等信息。" },
  { code: "enterprise.personCount", group: "企业信息", label: "整体涉及人数", description: "企业层面的估算人数和确认状态。" },
  { code: "enterprise.subjectCategories", group: "企业信息", label: "整体人员类别", description: "企业档案汇总的相关个人类别。" },
  { code: "enterprise.sensitiveCategories", group: "企业信息", label: "整体敏感信息类别", description: "企业档案汇总的敏感信息类别。" },
  { code: "enterprise.minorsPossible", group: "企业信息", label: "企业层面未成年人情况", description: "企业档案中的总体判断。" },
  { code: "enterprise.crossBorder", group: "企业信息", label: "企业层面境外情况", description: "企业档案中的总体判断。" },
  { code: "activity.description", group: "业务信息", label: "业务补充描述", description: "业务名称之外的场景说明。" },
  { code: "activity.informationDetails", group: "业务信息", label: "具体字段或资料名称", description: "可能包含敏感描述或误填的个人信息值，默认不发送。" },
  { code: "activity.collectionChannels", group: "业务信息", label: "收集渠道", description: "信息从何处取得。" },
  { code: "activity.systems", group: "业务信息", label: "使用系统", description: "信息保存或使用的系统。" },
  { code: "activity.recipients", group: "业务信息", label: "外部接收方", description: "服务商或其他接收方。" },
  { code: "activity.externalProcessingRelationships", group: "业务信息", label: "外部处理关系", description: "区分委托处理、独立提供、共同处理或依法报送。" },
  { code: "activity.externalRecipientDetails", group: "业务信息", label: "外部单位和处理边界", description: "单位名称、联系渠道和实际处理边界。" },
  { code: "activity.approximatePersonCount", group: "业务信息", label: "场景涉及人数", description: "单项业务估算人数。" },
  { code: "activity.accessRoles", group: "业务信息", label: "可访问岗位", description: "内部可接触信息的岗位。" },
  { code: "activity.systemOperators", group: "业务信息", label: "系统运维方", description: "本单位或外部运维方。" },
  { code: "activity.retentionPeriod", group: "业务信息", label: "保存期限", description: "保存时间或删除条件。" },
  { code: "activity.retentionBasis", group: "业务信息", label: "保存期限依据", description: "处理目的、起算点或法律法规另有规定的依据。" },
  { code: "activity.deletionMethod", group: "业务信息", label: "到期处理方式", description: "删除、匿名化或限制使用安排。" },
  { code: "activity.rightsChannel", group: "业务信息", label: "个人权利渠道", description: "相关个人提出请求的渠道。" },
  { code: "activity.automatedDecision", group: "业务信息", label: "自动化决策情况", description: "该业务是否涉及自动化决策。" },
  { code: "activity.sensitiveInformation", group: "业务信息", label: "敏感个人信息情况", description: "该业务是否涉及敏感个人信息。" },
  { code: "activity.sensitiveCategories", group: "业务信息", label: "敏感个人信息法定类别", description: "依据《个人信息保护法》第二十八条识别，并参照 GB/T 45574—2025 细化的类别。" },
  { code: "activity.minorsInvolved", group: "业务信息", label: "未成年人情况", description: "该业务是否涉及不满十四周岁未成年人。" },
  { code: "activity.crossBorderAccess", group: "业务信息", label: "境外存储或访问", description: "该业务是否存在境外存储或访问。" },
  { code: "activity.notes", group: "业务信息", label: "自由填写的补充说明", description: "可能包含不必要的具体信息，默认不发送。" },
  { code: "activity.confirmedAt", group: "业务信息", label: "事实确认时间", description: "业务档案的确认时间，通常不影响正文。" }
];

const alwaysExcluded = new Set([
  "enterprise.orgType", "enterprise.businessModel", "enterprise.ownership", "enterprise.personCount",
  "enterprise.subjectCategories", "enterprise.sensitiveCategories", "activity.description", "activity.informationDetails",
  "activity.approximatePersonCount", "activity.notes", "activity.confirmedAt"
]);

function defaultExcludedFields(definition: MaterialDefinition): string[] {
  const excluded = new Set(alwaysExcluded);
  if (definition.category === "external") {
    excluded.add("activity.accessRoles"); excluded.add("activity.systemOperators");
  }
  return [...excluded];
}

function systemPrompt(): string {
  return `你是中国小型个人信息处理者合规平台中的材料起草助手。请根据系统已经确定的材料类型、适用人群和已确认业务事实，形成一份结构完整、语言清楚、可由负责人核对的中文材料草稿。

必须遵守：
- 只能使用输入中的企业信息和业务事实，不得编造接收方、保存期限、安全措施、联系渠道、处理基础或其他事实。
- 缺少的关键信息必须在正文相应位置明确写“待确认”，并列入 pending_facts。
- 输入中的【单位名称】、【联系渠道】、【本地脱敏字段1】等占位符是本机脱敏标记；需要使用时必须逐字保留，不得猜测、改写或展开。系统会在本机交付草稿前恢复真实值。
- 同一材料可以覆盖输入中的多项业务，但不得扩大到未输入的业务或其他人群。
- 保留基础模板中的必要章节和主要法规边界，可改善结构、合并重复内容并改写为自然中文。
- 不得声称企业“已经合规”、已经完成认证或已经履行尚未确认的义务。
- 使用中国个人信息保护法律语境，不使用 GDPR 的 controller、processor、data subject 或其直译。
- 只输出一个 JSON 对象，不得输出 Markdown 围栏、解释文字或第二个 JSON。

输出结构：
{
  "content": "完整材料正文，使用 Markdown 标题和自然段",
  "pending_facts": ["发布前仍需负责人确认的具体事实"],
  "summary": "一句话说明草稿如何形成"
}`;
}

function include(excluded: Set<string>, code: string, key: string, value: unknown, target: Record<string, unknown>) {
  if (!excluded.has(code)) target[key] = value;
}

function filteredBaselineDraft(baseline: string, excluded: Set<string>): string {
  const linePatterns: Record<string, RegExp> = {
    "activity.collectionChannels": /^- 信息来源：.*\r?\n?/gm,
    "activity.informationDetails": /^- 具体字段或资料名称：.*\r?\n?/gm,
    "activity.systems": /^- 保存或使用位置：.*\r?\n?/gm,
    "activity.recipients": /^- 外部接收方：.*\r?\n?/gm,
    "activity.externalProcessingRelationships": /^- 外部处理关系：.*\r?\n?/gm,
    "activity.externalRecipientDetails": /^- 外部单位及处理边界：.*\r?\n?/gm,
    "activity.approximatePersonCount": /^- 场景涉及人数：.*\r?\n?/gm,
    "activity.accessRoles": /^- 可访问岗位：.*\r?\n?/gm,
    "activity.systemOperators": /^- 系统运维方：.*\r?\n?/gm,
    "activity.retentionPeriod": /^- 保存期限或删除条件：.*\r?\n?/gm,
    "activity.retentionBasis": /^- 保存期限依据：.*\r?\n?/gm,
    "activity.deletionMethod": /^- 到期处理方式：.*\r?\n?/gm,
    "activity.rightsChannel": /^- 个人权利渠道：.*\r?\n?/gm,
    "activity.automatedDecision": /^- 自动化决策：.*\r?\n?/gm,
    "activity.sensitiveInformation": /^- 敏感个人信息：.*\r?\n?/gm,
    "activity.sensitiveCategories": /^- 敏感个人信息类别：.*\r?\n?/gm,
    "activity.minorsInvolved": /^- 不满十四周岁未成年人：.*\r?\n?/gm,
    "activity.crossBorderAccess": /^- 境外存储或访问：.*\r?\n?/gm
  };
  let result = baseline;
  for (const code of excluded) if (linePatterns[code]) result = result.replace(linePatterns[code], "");
  return result;
}

function rawContext(input: MaterialAiDraftInput, excluded: Set<string>): Record<string, unknown> {
  const enterprise: Record<string, unknown> = {
    单位名称: input.enterprise.legalName,
    个人信息保护联系人: input.enterprise.publicContactDepartment || "个人信息保护联系部门",
    联系人职务: "权利请求接收部门",
    联系渠道: input.enterprise.publicContactChannel || input.enterprise.privacyContactChannel || ""
  };
  include(excluded, "enterprise.orgType", "单位类型", input.enterprise.orgType, enterprise);
  include(excluded, "enterprise.industry", "所属行业", input.enterprise.industry, enterprise);
  include(excluded, "enterprise.businessModel", "业务模式", input.enterprise.businessModel, enterprise);
  include(excluded, "enterprise.ownership", "单位性质", input.enterprise.ownership, enterprise);
  if (!excluded.has("enterprise.personCount")) {
    enterprise.整体涉及人数 = input.enterprise.personCount;
    enterprise.人数口径已确认 = input.enterprise.countVerified;
  }
  include(excluded, "enterprise.subjectCategories", "整体人员类别", input.enterprise.subjectCategories.map(enterpriseSubjectLabel), enterprise);
  include(excluded, "enterprise.sensitiveCategories", "整体敏感信息法定类别", sensitiveCategoryLabels(input.enterprise.sensitiveCategories), enterprise);
  include(excluded, "enterprise.minorsPossible", "企业层面是否可能涉及未成年人", input.enterprise.minorsPossible, enterprise);
  include(excluded, "enterprise.crossBorder", "企业层面是否涉及境外", input.enterprise.crossBorder, enterprise);

  const confirmedActivities = input.activities.map(activity => {
    const result: Record<string, unknown> = {
      业务名称: activityDisplayName(activity),
      涉及人员: activity.facts.dataSubjects,
      个人信息种类: activity.facts.informationTypes,
      处理目的: activity.facts.purposes
    };
    include(excluded, "activity.description", "业务说明", activity.description, result);
    include(excluded, "activity.informationDetails", "具体字段或资料名称", activity.facts.informationDetails, result);
    include(excluded, "activity.collectionChannels", "收集渠道", activity.facts.collectionChannels, result);
    include(excluded, "activity.systems", "使用系统", activity.facts.systems, result);
    include(excluded, "activity.recipients", "外部接收方", activity.facts.recipients, result);
    include(excluded, "activity.externalProcessingRelationships", "外部处理关系", normalizedExternalProcessingRelationships(activity.facts).map(externalProcessingRelationshipLabel), result);
    include(excluded, "activity.externalRecipientDetails", "外部单位及处理边界", activity.facts.externalRecipientDetails, result);
    include(excluded, "activity.approximatePersonCount", "涉及人数", activity.facts.approximatePersonCount, result);
    include(excluded, "activity.accessRoles", "可访问岗位", activity.facts.accessRoles, result);
    include(excluded, "activity.systemOperators", "系统运维方", activity.facts.systemOperators, result);
    include(excluded, "activity.retentionPeriod", "保存期限", activity.facts.retentionPeriod, result);
    include(excluded, "activity.retentionBasis", "保存期限依据", activity.facts.retentionBasis, result);
    include(excluded, "activity.deletionMethod", "到期处理方式", activity.facts.deletionMethod, result);
    include(excluded, "activity.rightsChannel", "权利请求渠道", activity.facts.rightsChannel, result);
    include(excluded, "activity.automatedDecision", "自动化决策", activity.facts.automatedDecision, result);
    include(excluded, "activity.sensitiveInformation", "敏感个人信息", activity.facts.sensitiveInformation, result);
    include(excluded, "activity.sensitiveCategories", "敏感个人信息法定类别", sensitiveCategoryLabels(activity.facts.sensitiveCategories), result);
    include(excluded, "activity.minorsInvolved", "不满十四周岁未成年人", activity.facts.minorsInvolved, result);
    include(excluded, "activity.crossBorderAccess", "境外存储或访问", activity.facts.crossBorderAccess, result);
    include(excluded, "activity.notes", "补充说明", activity.facts.notes, result);
    include(excluded, "activity.confirmedAt", "事实确认时间", activity.facts.confirmedAt, result);
    return result;
  });

  return {
    材料要求: {
      name: input.name,
      type: input.definition.name,
      description: input.definition.description,
      requirement: input.definition.requirement,
      trigger: input.definition.trigger,
      legalBasis: input.definition.legalBasis,
      scope: input.scope,
      audience: input.audience,
      requiredModules: input.definition.defaultModules
    },
    企业信息: enterprise,
    已确认业务: confirmedActivities,
    基础模板: filteredBaselineDraft(input.baselineDraft, excluded)
  };
}

type Replacement = { token: string; value: string; label: string; required: boolean };

function prepareTransfer(input: MaterialAiDraftInput): { preview: MaterialAiTransferPreview; replacements: Replacement[]; requiredTokens: string[] } {
  const excludedFields = input.excludedFields || defaultExcludedFields(input.definition);
  const excluded = new Set(excludedFields);
  const context = rawContext(input, excluded);
  const replacements: Replacement[] = [];
  const tokenFor = (value: string, label: string, token?: string, required = false) => {
    const normalized = value.trim();
    if (!normalized) return "";
    const existing = replacements.find(item => item.value === normalized);
    if (existing) return existing.token;
    const next = token || `【本地脱敏字段${replacements.length + 1}】`;
    replacements.push({ token: next, value: normalized, label, required });
    return next;
  };
  tokenFor(input.enterprise.legalName, "单位名称", "【单位名称】", true);
  tokenFor(input.enterprise.publicContactDepartment || "", "对外接收部门", "【个人信息保护联系部门】");
  tokenFor(input.enterprise.publicContactChannel || input.enterprise.privacyContactChannel || "", "对外联系渠道", "【联系渠道】", true);

  const maskString = (source: string): string => {
    let value = source;
    for (const replacement of [...replacements].sort((a, b) => b.value.length - a.value.length)) value = value.split(replacement.value).join(replacement.token);
    value = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, match => tokenFor(match, "电子邮箱"));
    value = value.replace(/((?:电话|座机|联系电话)[：:]?\s*)(0\d{2,3}[-\s]?\d{7,8})/g, (_match, prefix: string, phone: string) => `${prefix}${tokenFor(phone, "固定电话号码")}`);
    value = value.replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, match => tokenFor(match, "手机号码"));
    value = value.replace(/(?<!\d)\d{17}[\dXx](?!\d)/g, match => tokenFor(match, "身份证件号码"));
    value = value.replace(/((?:联系人|负责人|经办人|姓名)[：:]\s*)([\u4e00-\u9fa5·]{2,8})/g, (_match, prefix: string, name: string) => `${prefix}${tokenFor(name, "自由文本中的姓名")}`);
    return value;
  };
  const maskUnknown = (value: unknown): unknown => {
    if (typeof value === "string") return maskString(value);
    if (Array.isArray(value)) return value.map(maskUnknown);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, maskUnknown(item)]));
    return value;
  };
  const payload = maskUnknown(context) as Record<string, unknown>;
  const maskedBaseline = String(payload.基础模板 || "");
  const requiredTokens = replacements.filter(item => item.required && maskedBaseline.includes(item.token)).map(item => item.token);
  return {
    preview: {
      payload,
      fields: fieldDefinitions.map(item => ({ ...item, included: !excluded.has(item.code) })),
      excludedFields,
      redactionCount: replacements.length,
      redactionLabels: [...new Set(replacements.map(item => item.label))],
      restorationNotice: "占位符仅发送给所选AI服务；AI返回后，系统会在本机恢复真实值，再保存为材料草稿。"
    },
    replacements,
    requiredTokens
  };
}

export function buildMaterialAiTransferPreview(input: MaterialAiDraftInput): MaterialAiTransferPreview {
  return prepareTransfer(input).preview;
}

function restoreValues(value: string, replacements: Replacement[]): string {
  let restored = value;
  for (const replacement of replacements) restored = restored.split(replacement.token).join(replacement.value);
  return restored;
}

export async function callMaterialDraftAi(
  input: MaterialAiDraftInput,
  config: MaterialAiRuntimeConfiguration,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || 120_000)
): Promise<MaterialAiDraftResult> {
  const transfer = prepareTransfer(input);
  const response = await fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: `请起草以下材料：\n${JSON.stringify(transfer.preview.payload)}` }
      ],
      temperature: 0.15,
      response_format: { type: "json_object" },
      max_tokens: 8000,
      stream: false
    }),
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 120_000)
  });
  if (!response.ok) throw new Error(`AI服务返回错误（${response.status}）`);
  const payload = await response.json() as ChatCompletionResponse;
  const choice = payload.choices?.[0];
  if (!choice?.message?.content) throw new Error("AI服务未返回材料正文");
  if (choice.finish_reason === "length") throw new Error("AI生成内容被截断");
  const parsed = parseAiJsonObject(choice.message.content);
  const maskedContent = normalizeChinaLegalText(parsed.content).trim();
  if (maskedContent.length < 200) throw new Error("AI生成的材料正文不完整");
  const missingRequiredToken = transfer.requiredTokens.find(token => !maskedContent.includes(token));
  if (missingRequiredToken) throw new Error("AI未保留必要脱敏占位符，已停止使用该结果");
  const maskedPendingFacts = Array.isArray(parsed.pending_facts) ? parsed.pending_facts.map(normalizeChinaLegalText).map(item => item.trim()).filter(Boolean) : [];
  return {
    content: restoreValues(maskedContent, transfer.replacements),
    pendingFacts: maskedPendingFacts.map(item => restoreValues(item, transfer.replacements)),
    summary: restoreValues(String(parsed.summary || "根据已确认企业和业务事实生成完整草稿"), transfer.replacements),
    provider: config.provider,
    model: config.model,
    promptVersion,
    remoteRunId: payload.id || null,
    redactionCount: transfer.preview.redactionCount,
    excludedFields: transfer.preview.excludedFields
  };
}

export async function generateCompleteMaterialDraft(input: MaterialAiDraftInput): Promise<MaterialAiDraftResult> {
  const config = resolveMaterialAiRuntimeConfiguration();
  if (!config) throw new Error("尚未配置可用的材料草稿AI服务");
  return callMaterialDraftAi(input, config);
}

export async function testMaterialAiConnection(fetchImpl: typeof fetch = fetch): Promise<{ provider: string; model: string }> {
  const config = resolveMaterialAiRuntimeConfiguration();
  if (!config) throw new Error("尚未配置可用的材料草稿AI服务");
  const response = await fetchImpl(`${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: "仅回复：连接成功" }], temperature: 0, max_tokens: 20, stream: false }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`连接失败，AI服务返回 ${response.status}`);
  const payload = await response.json() as ChatCompletionResponse;
  if (!payload.choices?.[0]?.message?.content) throw new Error("连接成功，但AI服务未返回有效内容");
  return { provider: config.provider, model: config.model };
}
