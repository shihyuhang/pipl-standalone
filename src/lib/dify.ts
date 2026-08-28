import { randomUUID } from "node:crypto";
import { normalizeChinaLegalText, normalizeTriageFinding } from "./legal-language.ts";
import { sensitiveCategoryDefinitions } from "./sensitive-info.ts";
import { assessRetentionRisk } from "./retention-risk.ts";

export interface TriageContext {
  enterprise: Record<string, unknown>;
  scenario: Record<string, unknown>;
  confirmedFacts?: Record<string, unknown>;
}

export interface TriageResult {
  source: "deepseek" | "qwen" | "kimi" | "dify" | "local_rules";
  status: "draft_ready" | "needs_review" | "needs_input";
  summary: string;
  reviewRequired: boolean;
  findings: Array<{ title: string; description: string; riskLevel: "L0" | "L1" | "L2" | "L3" }>;
  warnings: string[];
  remoteRunId?: string | null;
  workflowVersion?: string;
}

export function stabilizeTriageStatus(
  status: TriageResult["status"],
  findings: TriageResult["findings"],
  deterministicReviewRequired = false
): TriageResult["status"] {
  if (deterministicReviewRequired || findings.some(item => item.riskLevel === "L3")) return "needs_review";
  if (findings.some(item => item.riskLevel === "L2")) return "needs_input";
  if (status === "needs_review") return findings.some(item => item.riskLevel === "L2") ? "needs_input" : "draft_ready";
  if (status === "needs_input" && findings.length > 0 && findings.every(item => item.riskLevel === "L0" || item.riskLevel === "L1")) return "draft_ready";
  return status;
}

type TriageFinding = TriageResult["findings"][number];
const riskWeight: Record<TriageFinding["riskLevel"], number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

function findingTheme(finding: TriageFinding): string {
  const text = `${finding.title} ${finding.description}`;
  if (/保存期限|永久保存|长期保存|删除机制|到期删除|留存/.test(text)) return "retention";
  if (/敏感个人信息|医疗健康|生物识别|金融账户|特定身份|行踪轨迹/.test(text)) return "sensitive";
  if (/未成年人|不满十四周岁/.test(text)) return "minors";
  if (/境外|跨境/.test(text)) return "cross_border";
  if (/自动化决策|自动决定/.test(text)) return "automated_decision";
  if (/访问岗位|权限控制|访问控制|最小权限|账号权限/.test(text)) return "access_control";
  if (/外部接收方|委托处理|服务商|向其他处理者提供|共同处理/.test(text)) return "recipient";
  if (/处理目的|合法性|必要性/.test(text)) return "lawful_purpose";
  return `title:${finding.title.trim()}`;
}

const mergedThemeTitles: Record<string, string> = {
  retention: "完善保存期限与删除机制",
  sensitive: "复核敏感个人信息处理",
  minors: "复核未成年人个人信息处理",
  cross_border: "确认个人信息出境安排",
  automated_decision: "复核自动化决策安排",
  access_control: "完善访问岗位与权限控制",
  recipient: "确认外部接收方与委托处理安排",
  lawful_purpose: "复核处理目的与必要性"
};

export function mergeTriageFindings(findings: TriageFinding[]): TriageFinding[] {
  const groups = new Map<string, TriageFinding[]>();
  for (const finding of findings) {
    const key = findingTheme(finding);
    groups.set(key, [...(groups.get(key) || []), finding]);
  }
  return [...groups.entries()].map(([theme, items]) => {
    if (items.length === 1) return items[0];
    const descriptions = [...new Set(items.map(item => item.description.trim()).filter(Boolean))];
    const riskLevel = items.reduce((highest, item) => riskWeight[item.riskLevel] > riskWeight[highest] ? item.riskLevel : highest, items[0].riskLevel);
    return {
      title: mergedThemeTitles[theme] || items[0].title,
      description: descriptions.map((description, index) => `${index + 1}. ${description}`).join(" "),
      riskLevel
    };
  });
}

const aiLabels: Record<string, string> = {
  company: "公司", branch: "分支机构", individual_business: "个体工商户", partnership: "合伙企业", institution: "其他组织",
  domestic: "非外商投资企业", foreign_invested: "外商投资企业", foreign_branch: "外国企业在华分支",
  independent_processor: "主要由本单位自行决定处理目的和方式",
  entrusted_processor: "主要按照客户或其他单位的指示处理",
  mixed: "不同业务中既有自行决定，也有受托处理",
  employee: "在职员工", candidate: "招聘候选人", customer_contact: "客户企业联系人",
  supplier_contact: "供应商联系人", consumer: "消费者或会员", visitor: "访客",
  ...Object.fromEntries(sensitiveCategoryDefinitions.map(item => [item.code, item.label])),
  yes: "是", no: "否", unknown: "尚未确认",
  eligible: "适合使用小型处理者工作路径", conditional: "完成待确认事项后再判断",
  needs_review: "存在需要人工复核的事项", out_of_scope: "超出小型处理者工作路径"
};

export function buildAiEnterpriseContext(input: Record<string, unknown>): Record<string, unknown> {
  const label = (value: unknown) => String(value).startsWith("other:") ? String(value).slice(6) : aiLabels[String(value)] || value;
  const labels = (value: unknown) => Array.isArray(value) ? value.map(label) : value;
  return {
    ...input,
    orgType: label(input.orgType), industry: input.industry, ownership: label(input.ownership), processingRole: label(input.processingRole),
    subjectCategories: labels(input.subjectCategories), sensitiveCategories: labels(input.sensitiveCategories),
    minorsPossible: label(input.minorsPossible), crossBorder: label(input.crossBorder), qualificationStatus: label(input.qualificationStatus)
  };
}

export function buildAiConfirmedFacts(input: Record<string, unknown>): Record<string, unknown> {
  const label = (value: unknown) => aiLabels[String(value)] || value;
  return {
    ...input,
    sensitiveInformation: label(input.sensitiveInformation),
    sensitiveCategories: Array.isArray(input.sensitiveCategories) ? input.sensitiveCategories.map(label) : [],
    minorsInvolved: label(input.minorsInvolved),
    crossBorderAccess: label(input.crossBorderAccess),
    automatedDecision: label(input.automatedDecision)
  };
}

/**
 * Dify 的模型节点偶尔会在 JSON 前后附加代码围栏或一句说明。
 * 这里只接受第一个完整的 JSON 对象；如果后面还有第二个 JSON 值，
 * 则视为歧义输出并拒绝，避免平台静默采用错误结论。
 */
export function parseDifyJsonObject(input: string): Record<string, unknown> {
  const text = String(input || "").replace(/^\uFEFF/, "").trim();
  const start = text.indexOf("{");
  if (start < 0) throw new Error("AI输出中没有可识别的结构化结果");

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
      if (depth < 0) break;
    }
  }

  if (end < 0 || inString || depth !== 0) throw new Error("AI输出的结构化结果不完整");

  const suffix = text.slice(end).replace(/^\s*```(?:json)?\s*/i, "").trim();
  if (suffix.startsWith("{") || suffix.startsWith("[")) {
    throw new Error("AI输出包含多个相互竞争的结果");
  }

  const value = JSON.parse(text.slice(start, end)) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI输出不是有效的结构化结果");
  }
  return value as Record<string, unknown>;
}

// The parser is shared by Dify and direct model APIs. Keep the old export for
// compatibility with existing workflow tests and integrations.
export const parseAiJsonObject = parseDifyJsonObject;

function humanizeFindingText(input: unknown): string {
  let text = String(input || "");
  text = text
    .replace(/personCount\s*约?\s*(\d+)\s*\(countVerified=false\)/g, "企业估算涉及约$1人，但人数口径尚未确认")
    .replace(/sensitiveInformation\s*=\s*unknown/g, "是否涉及敏感个人信息尚未确认")
    .replace(/crossBorderAccess\s*(?:为|=)\s*[“\"']?no[”\"']?/g, "已填写为不涉及境外存储或访问")
    .replace(/scenario\.facts\./g, "")
    .replace(/enterprise\./g, "");
  const labels: Array<[string, string]> = [
    ["informationTypes", "使用的个人信息"], ["informationDetails", "具体字段或资料名称"], ["purposes", "使用目的"], ["dataSubjects", "涉及人员"],
    ["subjectCategories", "企业档案中的人员类别"], ["sensitiveInformation", "是否涉及敏感个人信息"],
    ["minorsInvolved", "是否涉及不满十四周岁未成年人"], ["crossBorderAccess", "境外存储或访问"],
    ["recipients", "外部接收方"], ["retentionPeriod", "保存期限"], ["retentionBasis", "保存期限依据"], ["systems", "使用的系统"],
    ["approximatePersonCount", "这项业务大约涉及的人数"], ["accessRoles", "可访问岗位"],
    ["systemOperators", "系统运维方"], ["deletionMethod", "到期删除方式"],
    ["rightsChannel", "个人权利渠道"], ["automatedDecision", "是否使用自动化决策"],
    ["countVerified", "人数口径是否确认"], ["personCount", "涉及人数"],
    ["processingRole", "贵单位怎样决定信息用途"], ["confirmed_facts", "已确认的业务事实"],
    ["independent_processor", "主要由本单位自行决定"], ["entrusted_processor", "主要按照客户或其他单位指示处理"],
    ["employee", "员工"], ["candidate", "求职者"], ["consumer", "消费者"], ["visitor", "访客"],
    ["unknown", "尚未确认"]
  ];
  for (const [source, target] of labels) text = text.split(source).join(target);
  return normalizeChinaLegalText(text);
}

export function runLocalScenarioTriage(context: TriageContext, warning: string): TriageResult {
  const enterprise = context.enterprise;
  const facts = context.confirmedFacts || {};
  const findings: TriageResult["findings"] = [];
  if (enterprise.crossBorder !== "no" || facts.crossBorderAccess !== "no") findings.push({ title: "确认境外访问情况", description: "请确认信息是否存到境外，或被境外团队、供应商、管理员远程查看。", riskLevel: facts.crossBorderAccess === "yes" ? "L3" : "L2" });
  if ((Array.isArray(enterprise.sensitiveCategories) && enterprise.sensitiveCategories.length > 0) || facts.sensitiveInformation !== "no") {
    const categories = Array.isArray(facts.sensitiveCategories) ? facts.sensitiveCategories.map(value => aiLabels[String(value)] || String(value)) : [];
    findings.push({
      title: "复核敏感个人信息",
      description: categories.length
        ? `已识别类别：${categories.join("、")}。需要进一步确认特定目的、充分必要性、告知同意和严格保护措施。`
        : facts.minorsInvolved === "yes"
          ? "涉及不满十四周岁未成年人个人信息，依法属于敏感个人信息，需要专项复核。"
          : "法定类别尚未确认，需要先核对具体字段，再确认处理目的、必要性、告知同意和保护措施。",
      riskLevel: facts.sensitiveInformation === "unknown" ? "L2" : "L3"
    });
  }
  if (enterprise.minorsPossible !== "no" || facts.minorsInvolved !== "no") findings.push({ title: "确认未成年人情况", description: "可能涉及不满十四周岁未成年人时，需要专项复核。", riskLevel: facts.minorsInvolved === "unknown" ? "L2" : "L3" });
  if (facts.automatedDecision === "yes") findings.push({ title: "复核自动化决策安排", description: "请确认自动化决策的用途、对个人的影响、告知方式和拒绝渠道，并判断是否需要专项评估。", riskLevel: "L3" });
  else if (facts.automatedDecision === "unknown") findings.push({ title: "确认是否使用自动化决策", description: "请确认系统是否会自动决定推荐、价格、资格或其他对个人有影响的结果。", riskLevel: "L2" });
  if (Array.isArray(facts.recipients) && facts.recipients.includes("暂不清楚")) findings.push({ title: "确认外部接收方", description: "需要确认是否有云服务商、集团公司、客户或合作方接收这些信息。", riskLevel: "L2" });
  const retention = assessRetentionRisk(String(facts.retentionPeriod || ""), String(facts.retentionBasis || ""));
  if (retention.level !== "none") findings.push({
    title: retention.title,
    description: `${retention.message}《个人信息保护法》第十九条要求，除法律、行政法规另有规定外，保存期限应为实现处理目的所必要的最短时间。当前不能仅凭填写内容认定违法，但应补充依据并由负责人复核。`,
    riskLevel: "L2"
  });
  const mergedFindings = mergeTriageFindings(findings);
  return {
    source: "local_rules",
    status: mergedFindings.some(f => f.riskLevel === "L3") ? "needs_review" : mergedFindings.length ? "needs_input" : "draft_ready",
    summary: mergedFindings.length ? `基础规则发现 ${mergedFindings.length} 个需要确认的整改主题。` : "已完成基础规则检查，尚未运行AI快速分流。",
    reviewRequired: mergedFindings.some(f => f.riskLevel === "L3"), findings: mergedFindings,
    warnings: warning ? [warning] : [],
    workflowVersion: "scenario-triage-local-rules-v1"
  };
}

export function normalizeAiTriageResult(
  context: TriageContext,
  value: Record<string, unknown>,
  source: Exclude<TriageResult["source"], "local_rules">,
  remoteRunId?: string | null,
  workflowVersion = `scenario-triage-${source}-v1`
): TriageResult {
  const warnings = Array.isArray(value.warnings) ? value.warnings.map(normalizeChinaLegalText) : [];
  if (String(value.summary || "").includes("未通过格式校验") || warnings.some(item => item.includes("模型输出解析失败"))) {
    throw new Error(warnings[0] || "AI输出未通过格式校验");
  }
  const findings = Array.isArray(value.findings) ? value.findings.map((item: unknown) => {
    const finding = item as Record<string, unknown>;
    const normalized = normalizeTriageFinding(humanizeFindingText(finding.title || "待确认事项"), humanizeFindingText(finding.description || ""));
    return { ...normalized, riskLevel: (["L0", "L1", "L2", "L3"].includes(String(finding.risk_level)) ? finding.risk_level : "L2") as "L0" | "L1" | "L2" | "L3" };
  }) : [];
  const deterministic = runLocalScenarioTriage(context, "");
  for (const required of deterministic.findings.filter(item => item.riskLevel === "L3" || item.title.includes("保存期限"))) {
    if (!findings.some(item => item.title === required.title || (item.title.includes("保存期限") && required.title.includes("保存期限")))) findings.push(required);
  }
  const unmergedCount = findings.length;
  const mergedFindings = mergeTriageFindings(findings);
  const hasL3 = mergedFindings.some(item => item.riskLevel === "L3") || deterministic.reviewRequired;
  const modelStatus = (["draft_ready", "needs_review", "needs_input"].includes(String(value.status)) ? value.status : "needs_review") as TriageResult["status"];
  const status = stabilizeTriageStatus(modelStatus, mergedFindings, deterministic.reviewRequired);
  const modelSummary = humanizeFindingText(value.summary || "系统已完成初步检查，等待负责人确认。");
  const summary = unmergedCount > mergedFindings.length
    ? `系统已将相近问题合并为 ${mergedFindings.length} 个整改主题，请按主题逐项确认。`
    : modelStatus !== "draft_ready" && status === "draft_ready"
    ? "暂未发现需要暂停的事项，可以继续完善普通业务信息。"
    : modelSummary;
  return { source, status, summary, reviewRequired: hasL3, findings: mergedFindings, warnings, remoteRunId, workflowVersion };
}

export async function runDifyScenarioTriage(context: TriageContext): Promise<TriageResult> {
  const enabled = process.env.DIFY_ENABLE === "true";
  const apiKey = process.env.DIFY_API_KEY_SCENARIO_TRIAGE;
  const baseUrl = (process.env.DIFY_API_BASE_URL || "https://dify.legalkit.xyz/v1").replace(/\/$/, "");
  if (!enabled) return runLocalScenarioTriage(context, "AI辅助分析尚未启用，本次只完成基础规则检查，不能视为AI分析结论。");
  if (!apiKey) return runLocalScenarioTriage(context, "AI辅助分析服务尚未配置，本次只完成基础规则检查。");

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/workflows/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: {
          schema_version: "1.0.0",
          run_id: randomUUID(),
          workflow_code: "scenario_triage",
          enterprise_context: JSON.stringify(buildAiEnterpriseContext(context.enterprise)),
          scenario_context: JSON.stringify(context.scenario),
          confirmed_facts: JSON.stringify(buildAiConfirmedFacts(context.confirmedFacts || {}))
        },
        response_mode: "blocking",
        user: `enterprise-${String(context.enterprise.id || "mvp")}`
      }),
      signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok) throw new Error(`AI服务返回错误（${response.status}）`);
      const payload = await response.json() as { workflow_run_id?: string; data?: { id?: string; outputs?: Record<string, unknown> } };
      const raw = payload.data?.outputs?.result ?? payload.data?.outputs?.output ?? payload.data?.outputs;
      const output = typeof raw === "string" ? parseDifyJsonObject(raw) : raw;
      if (!output || typeof output !== "object") throw new Error("AI服务未返回有效结果");
      return normalizeAiTriageResult(context, output as Record<string, unknown>, "dify", payload.workflow_run_id || payload.data?.id || null, "scenario-triage-dify-v1");
    } catch (error) {
      lastError = error;
    }
  }
  const fallback = runLocalScenarioTriage(context, "AI辅助分析调用失败，本次只完成基础规则检查。");
  fallback.warnings = [`AI辅助分析暂时不可用，已安全降级：${lastError instanceof Error ? lastError.message : "未知错误"}`];
  return fallback;
}
