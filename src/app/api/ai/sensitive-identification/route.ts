import { NextResponse } from "next/server";
import { z } from "zod";
import { identifySensitiveInformation } from "@/lib/sensitive-identification";
import { addAuditEvent } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const answer = z.enum(["yes", "no", "unknown", ""]);
  const shortList = z.array(z.string().min(1).max(100)).max(30);
  const schema = z.object({
    scenarioCode: z.string().max(100),
    scenarioName: z.string().min(1).max(200),
    scenarioDescription: z.string().max(1000),
    dataSubjects: shortList,
    informationTypes: shortList,
    informationDetails: z.string().max(1500),
    purposes: shortList,
    systems: shortList,
    minorsInvolved: answer
  });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请先填写有效的业务和个人信息字段说明。" }, { status: 400 });
  if (!parsed.data.informationTypes.length && !parsed.data.informationDetails.trim()) {
    return NextResponse.json({ message: "请先选择信息类型，或填写具体字段和资料名称。" }, { status: 409 });
  }
  const result = await identifySensitiveInformation(parsed.data);
  addAuditEvent(
    "ai.sensitive_identification.completed",
    `完成敏感个人信息辅助识别：${result.source === "ai_assisted" ? "AI与规则联合识别" : "基础规则识别"}，形成${result.candidates.length}项候选；规则版本${result.promptVersion}${result.model ? `，模型${result.model}` : ""}。`
  );
  return NextResponse.json(result);
}
