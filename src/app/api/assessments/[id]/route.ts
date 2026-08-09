import { NextResponse } from "next/server";
import { getAssessment } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const assessment = getAssessment(id);
  return assessment
    ? NextResponse.json(assessment)
    : NextResponse.json({ message: "未找到该检查记录。" }, { status: 404 });
}
