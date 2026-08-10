import { NextResponse } from "next/server";
import { z } from "zod";
import { savePipiaResponse } from "@/lib/db";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const yesNo = z.enum(["unanswered", "yes", "no", "not_applicable"]);
  const parsed = z.object({
    categoryCode: z.enum(["P01", "P02", "P03", "P04", "P05"]), legality: yesNo,
    impact: z.enum(["unanswered", "has_impact", "no_impact", "not_applicable"]), measureAdequacy: yesNo,
    notes: z.string().max(5000), evidenceNote: z.string().max(4000)
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请检查三个判断及说明。" }, { status: 400 });
  try {
    const result = savePipiaResponse(id, parsed.data);
    return result ? NextResponse.json(result) : NextResponse.json({ message: "未找到该影响评估。" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error && error.message === "SIGNED_FORM" ? "已确认归档的影响评估不能修改。" : "暂时无法保存。" }, { status: 409 });
  }
}
