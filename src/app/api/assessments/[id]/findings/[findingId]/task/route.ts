import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createTaskFromFinding } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string; findingId: string }> }) {
  const { id, findingId } = await context.params;
  const task = createTaskFromFinding(id, findingId);
  if (task) {
    revalidatePath("/");
    revalidatePath("/tasks");
    revalidatePath("/business");
  }
  return task
    ? NextResponse.json(task, { status: 201 })
    : NextResponse.json({ message: "未找到该检查发现。" }, { status: 404 });
}
