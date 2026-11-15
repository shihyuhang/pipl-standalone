import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteDocument, getDocument, resolveDocumentPendingFact } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const document = getDocument((await context.params).id);
  if (!document) return NextResponse.json({ message: "材料不存在。" }, { status: 404 });
  return NextResponse.json(document);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = z.object({ resolvePendingFact: z.string().trim().min(1).max(1000) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请选择需要确认的事项。" }, { status: 400 });
  try {
    return NextResponse.json(resolveDocumentPendingFact((await context.params).id, parsed.data.resolvePendingFact));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { message: code === "DOCUMENT_NOT_FOUND" ? "材料不存在。" : "该待确认事项已经变化，请刷新后重试。" },
      { status: code === "DOCUMENT_NOT_FOUND" ? 404 : 409 }
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const removed = deleteDocument((await context.params).id);
    return NextResponse.json({ id: removed.id, name: removed.name, deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ message: "材料不存在或已被删除。" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "DOCUMENT_HAS_PUBLISHED_VERSION") {
      return NextResponse.json({ message: "这份材料已有发布记录，属于合规证据，不能删除。如不再使用，请发布新版本说明废止原因。" }, { status: 409 });
    }
    return NextResponse.json({ message: "删除失败，请稍后重试。" }, { status: 500 });
  }
}
