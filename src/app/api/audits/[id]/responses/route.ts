import { NextResponse } from "next/server";
import { z } from "zod";
import { saveAuditResponse } from "@/lib/db";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = z.object({
    itemCode: z.string().regex(/^A\d{2}$/), conclusion: z.enum(["unanswered", "compliant", "non_compliant", "not_applicable"]),
    explanation: z.string().max(4000), evidenceNote: z.string().max(4000)
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请检查本项结论和说明。" }, { status: 400 });
  try {
    const result = saveAuditResponse(id, parsed.data);
    return result ? NextResponse.json(result) : NextResponse.json({ message: "未找到该自查记录。" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error && error.message === "SIGNED_FORM" ? "已确认归档的自查不能修改，请创建更正实例。" : "暂时无法保存本项。" }, { status: 409 });
  }
}
