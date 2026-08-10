import { NextResponse } from "next/server";
import { getAuditInstance } from "@/lib/db";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const result = getAuditInstance(id);
  return result ? NextResponse.json(result) : NextResponse.json({ message: "未找到该自查记录。" }, { status: 404 });
}
