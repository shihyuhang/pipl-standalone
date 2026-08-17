import { NextResponse } from "next/server";
import { z } from "zod";
import { updateDocumentDraft } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const parsed = z.object({ content: z.string().min(20), changeSummary: z.string().min(2), createdBy: z.string().max(100).optional() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请填写完整内容和修改说明。" }, { status: 400 });
  const params = await context.params;
  try {
    return NextResponse.json(updateDocumentDraft(params.id, params.versionId, parsed.data));
  } catch (error) {
    const message = error instanceof Error && error.message === "VERSION_IMMUTABLE" ? "已提交或已发布的版本不能修改。" : "无法保存草稿。";
    return NextResponse.json({ message }, { status: 409 });
  }
}
