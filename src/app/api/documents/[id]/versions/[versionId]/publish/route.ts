import { NextResponse } from "next/server";
import { publishDocumentVersion } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const params = await context.params;
  const parsed = z.object({
    publishedBy: z.string().min(1).max(100), publishChannel: z.string().min(1).max(200), publicationEvidence: z.string().max(1000).optional()
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请填写发布人和发布渠道。" }, { status: 400 });
  try {
    return NextResponse.json(publishDocumentVersion(params.id, params.versionId, parsed.data));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "VERSION_NOT_OWNED" ? "该版本不属于当前材料。" : code === "VERSION_NOT_PUBLISHABLE" ? "该版本已经发布或不能再次发布。" : code === "INCOMPLETE_DOCUMENT" ? "材料内容不完整，暂时不能发布。" : "发布失败，请稍后重试。";
    return NextResponse.json({ message }, { status: 409 });
  }
}
