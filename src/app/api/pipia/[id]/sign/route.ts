import { NextResponse } from "next/server";
import { z } from "zod";
import { signPipiaInstance } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = z.object({ responsibleName: z.string().min(1).max(100), responsibleRole: z.string().min(1).max(100) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请填写负责人姓名和角色。" }, { status: 400 });
  try {
    const result = signPipiaInstance(id, parsed.data.responsibleName, parsed.data.responsibleRole);
    return result ? NextResponse.json(result) : NextResponse.json({ message: "未找到该影响评估。" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("VALIDATION:") ? error.message.slice(11).split("|")[0] : "暂时无法确认归档。";
    return NextResponse.json({ message }, { status: 409 });
  }
}
