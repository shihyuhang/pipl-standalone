import { NextResponse } from "next/server";
import { getDocumentAttachment } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await context.params;
  const attachment = getDocumentAttachment(id, attachmentId);
  if (!attachment) return NextResponse.json({ message: "没有找到该原文件。" }, { status: 404 });
  const asciiName = attachment.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(new Uint8Array(attachment.content), {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(attachment.byteSize),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
