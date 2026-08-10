import { randomUUID } from "node:crypto";

export interface TriageContext {
  enterprise: Record<string, unknown>;
  scenario: Record<string, unknown>;
  confirmedFacts?: Record<string, unknown>;
}

export interface TriageResult {
  source: "dify" | "local_rules";
  status: "draft_ready" | "needs_review" | "needs_input";
  summary: string;
  reviewRequired: boolean;
  findings: Array<{ title: string; description: string; riskLevel: "L0" | "L1" | "L2" | "L3" }>;
  warnings: string[];
  remoteRunId?: string | null;
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

function humanizeFindingText(input: unknown): string {
  let text = String(input || "");
  text = text
    .replace(/personCount\s*约?\s*(\d+)\s*\(countVerified=false\)/g, "企业估算涉及约$1人，但人数口径尚未确认")
    .replace(/sensitiveInformation\s*=\s*unknown/g, "是否涉及敏感个人信息尚未确认")
    .replace(/crossBorderAccess\s*(?:为|=)\s*[“\"']?no[”\"']?/g, "已填写为不涉及境外存储或访问")
    .replace(/scenario\.facts\./g, "")
    .replace(/enterprise\./g, "");
  const labels: Array<[string, string]> = [
    ["informationTypes", "使用的个人信息"], ["purposes", "使用目的"], ["dataSubjects", "涉及人员"],
    ["subjectCategories", "企业档案中的人员类别"], ["sensitiveInformation", "是否涉及敏感个人信息"],
    ["minorsInvolved", "是否涉及不满十四周岁未成年人"], ["crossBorderAccess", "境外存储或访问"],
    ["recipients", "外部接收方"], ["retentionPeriod", "保存期限"], ["systems", "使用的系统"],
    ["countVerified", "人数口径是否确认"], ["personCount", "涉及人数"],
    ["employee", "员工"], ["candidate", "求职者"], ["consumer", "消费者"], ["visitor", "访客"],
    ["unknown", "尚未确认"]
  ];
  for (const [source, target] of labels) text = text.split(source).join(target);
  return text;
}

function localFallback(context: TriageContext, warning: string): TriageResult {
  const enterprise = context.enterprise;
  const facts = context.confirmedFacts || {};
  const findings: TriageResult["findings"] = [];
  if (enterprise.crossBorder !== "no" || facts.crossBorderAccess !== "no") findings.push({ title: "确认境外访问情况", description: "请确认信息是否存到境外，或被境外团队、供应商、管理员远程查看。", riskLevel: facts.crossBorderAccess === "yes" ? "L3" : "L2" });
  if ((Array.isArray(enterprise.sensitiveCategories) && enterprise.sensitiveCategories.length > 0) || facts.sensitiveInformation !== "no") findings.push({ title: "复核敏感个人信息", description: "需要进一步确认处理目的、必要性、告知同意和保护措施。", riskLevel: facts.sensitiveInformation === "unknown" ? "L2" : "L3" });
  if (enterprise.minorsPossible !== "no" || facts.minorsInvolved !== "no") findings.push({ title: "确认未成年人情况", description: "可能涉及不满十四周岁未成年人时，需要专项复核。", riskLevel: facts.minorsInvolved === "unknown" ? "L2" : "L3" });
  if (Array.isArray(facts.recipients) && facts.recipients.includes("暂不清楚")) findings.push({ title: "确认外部接收方", description: "需要确认是否有云服务商、集团公司、客户或合作方接收这些信息。", riskLevel: "L2" });
  return {
    source: "local_rules",
    status: findings.some(f => f.riskLevel === "L3") ? "needs_review" : findings.length ? "needs_input" : "draft_ready",
    summary: findings.length ? `基础规则发现 ${findings.length} 项需要确认的情况。` : "已完成基础规则检查，尚未运行AI快速分流。",
    reviewRequired: findings.some(f => f.riskLevel === "L3"), findings,
    warnings: [warning]
  };
}

export async function runScenarioTriage(context: TriageContext): Promise<TriageResult> {
  const enabled = process.env.DIFY_ENABLE === "true";
  const apiKey = process.env.DIFY_API_KEY_SCENARIO_TRIAGE;
  const baseUrl = (process.env.DIFY_API_BASE_URL || "https://dify.legalkit.xyz/v1").replace(/\/$/, "");
  if (!enabled) return localFallback(context, "AI辅助分析尚未启用，本次只完成基础规则检查，不能视为AI分析结论。");
  if (!apiKey) return localFallback(context, "AI辅助分析服务尚未配置，本次只完成基础规则检查。");

  try {
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: {
          schema_version: "1.0.0",
          run_id: randomUUID(),
          workflow_code: "scenario_triage",
          enterprise_context: JSON.stringify(context.enterprise),
          scenario_context: JSON.stringify(context.scenario),
          confirmed_facts: JSON.stringify(context.confirmedFacts || {})
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
    const value = output as Record<string, unknown>;
    return {
      source: "dify",
      status: (["draft_ready", "needs_review", "needs_input"].includes(String(value.status)) ? value.status : "needs_review") as TriageResult["status"],
      summary: humanizeFindingText(value.summary || "系统已完成初步检查，等待负责人确认。"),
      reviewRequired: value.review_required !== false,
      findings: Array.isArray(value.findings) ? value.findings.map((item: unknown) => {
        const finding = item as Record<string, unknown>;
        return { title: humanizeFindingText(finding.title || "待确认事项"), description: humanizeFindingText(finding.description || ""), riskLevel: (["L0", "L1", "L2", "L3"].includes(String(finding.risk_level)) ? finding.risk_level : "L2") as "L0" | "L1" | "L2" | "L3" };
      }) : [],
      warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
      remoteRunId: payload.workflow_run_id || payload.data?.id || null
    };
  } catch (error) {
    const fallback = localFallback(context, "AI辅助分析调用失败，本次只完成基础规则检查。");
    fallback.warnings = [`AI辅助分析暂时不可用，已安全降级：${error instanceof Error ? error.message : "未知错误"}`];
    return fallback;
  }
}
