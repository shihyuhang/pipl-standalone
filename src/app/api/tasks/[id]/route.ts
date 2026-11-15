import { NextResponse } from "next/server";
import { z } from "zod";
import { isMeaningfulTaskResult } from "@/lib/task-result";
import { updateTask } from "@/lib/db";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = z.object({
    status: z.enum(["open", "in_progress", "completed"]),
    handlingNote: z.string().max(4000).optional(),
    evidenceNote: z.string().max(2000).optional(),
    responsibleName: z.string().max(100).optional(),
    completionConfirmed: z.boolean().optional()
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "任务状态无效。" }, { status: 400 });
  if (parsed.data.status === "completed") {
    if (!isMeaningfulTaskResult(parsed.data.handlingNote || "")) return NextResponse.json({ message: "请填写具体结果；可以简短填写，如“500人”，不要只写“已处理”。" }, { status: 400 });
    if ((parsed.data.responsibleName || "").trim().length < 2) return NextResponse.json({ message: "请填写本事项的负责人。" }, { status: 400 });
    if (parsed.data.completionConfirmed !== true) return NextResponse.json({ message: "请确认办理记录与实际情况一致。" }, { status: 400 });
  }
  const task = updateTask((await context.params).id, parsed.data);
  return task ? NextResponse.json(task) : NextResponse.json({ message: "未找到该办理事项。" }, { status: 404 });
}
