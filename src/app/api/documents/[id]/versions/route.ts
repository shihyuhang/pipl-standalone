import { NextResponse } from "next/server";
import { z } from "zod";
import { createDocumentVersion } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = z.object({ content: z.string().min(20), changeSummary: z.string().min(2), createdBy: z.string().max(100).optional() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请填写版本内容和修改说明。" }, { status: 400 });
  try {
    return NextResponse.json(createDocumentVersion((await context.params).id, parsed.data), { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message === "ACTIVE_REVISION_EXISTS" ? "已有一份草稿或待审批版本，请先完成当前修订。" : "无法创建新版本。";
    return NextResponse.json({ message }, { status: 409 });
  }
}
