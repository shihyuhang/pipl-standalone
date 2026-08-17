import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveDocumentImpact } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string; impactId: string }> }) {
  const parsed = z.object({
    action: z.enum(["no_change", "defer"]), note: z.string().min(2).max(1000), dueAt: z.string().datetime().nullable().optional()
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请填写处理方式和原因。" }, { status: 400 });
  const params = await context.params;
  try {
    return NextResponse.json(resolveDocumentImpact(params.id, params.impactId, parsed.data));
  } catch {
    return NextResponse.json({ message: "未找到这条材料提醒。" }, { status: 404 });
  }
}
