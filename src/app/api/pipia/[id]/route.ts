import { NextResponse } from "next/server";
import { getPipiaInstance } from "@/lib/db";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const result = getPipiaInstance(id);
  return result ? NextResponse.json(result) : NextResponse.json({ message: "未找到该影响评估。" }, { status: 404 });
}
