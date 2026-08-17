import { NextResponse } from "next/server";
import { deleteDocument, getDocument } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const document = getDocument((await context.params).id);
  if (!document) return NextResponse.json({ message: "材料不存在。" }, { status: 404 });
  return NextResponse.json(document);
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
