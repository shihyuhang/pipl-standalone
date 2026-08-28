import { NextResponse } from "next/server";
import { publishDocumentVersion } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const params = await context.params;
  const parsed = z.object({
    publishedBy: z.string().min(1).max(100), publishChannel: z.string().min(1).max(200), publicationEvidence: z.string().max(1000).optional(),
    publicationMode: z.enum(["effective", "risk_archive"]).optional().default("effective"), riskDecisionNote: z.string().max(1000).optional()
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请填写发布人和发布渠道。" }, { status: 400 });
  try {
    return NextResponse.json(publishDocumentVersion(params.id, params.versionId, parsed.data));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "VERSION_NOT_OWNED" ? "该版本不属于当前材料。" : code === "VERSION_NOT_PUBLISHABLE" ? "该版本已经发布或不能再次发布。" : code === "INCOMPLETE_DOCUMENT" ? "材料内容不完整，暂时不能发布。" : code === "SENSITIVE_FIELDS_INCOMPLETE" ? "请先补全处理必要性、对个人权益的影响和保护措施，这三项是《个人信息保护法》第三十条规定的强制告知事项。" : code === "CROSS_BORDER_RECIPIENT_INCOMPLETE" ? "请先补全境外接收方名称和联系方式，这是《个人信息保护法》第三十九条规定的必填告知事项。" : code === "UNRESOLVED_RISKS_REQUIRE_DECISION" ? "当前仍有风险、占位内容或法定前置任务未完成，只能归档现状；全部解决后才能发布为合规有效版本。" : "发布失败，请稍后重试。";
    return NextResponse.json({ message }, { status: 409 });
  }
}
