import { NextResponse } from "next/server";
import { z } from "zod";
import { updateTaskStatus } from "@/lib/db";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = z.object({ status: z.enum(["open", "in_progress", "completed"]) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "任务状态无效。" }, { status: 400 });
  updateTaskStatus((await context.params).id, parsed.data.status);
  return NextResponse.json({ success: true });
}
