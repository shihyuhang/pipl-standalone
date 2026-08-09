import { NextResponse } from "next/server";
import { publishDocumentVersion } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(_: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const params = await context.params;
  publishDocumentVersion(params.id, params.versionId);
  return NextResponse.json({ success: true });
}
