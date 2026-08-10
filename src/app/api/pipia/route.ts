import { NextResponse } from "next/server";
import { z } from "zod";
import { createPipiaInstance, listPipiaInstances, listPipiaRecommendations } from "@/lib/db";

const category = z.enum(["P01", "P02", "P03", "P04", "P05"]);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json({ instances: listPipiaInstances(), recommendations: listPipiaRecommendations() }); }
export async function POST(request: Request) {
  const parsed = z.object({ activityId: z.string().uuid(), categoryCodes: z.array(category).min(1) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请选择业务和至少一种评估情形。" }, { status: 400 });
  try {
    const result = createPipiaInstance(parsed.data.activityId, parsed.data.categoryCodes);
    return result ? NextResponse.json(result, { status: 201 }) : NextResponse.json({ message: "未找到该业务。" }, { status: 404 });
  } catch { return NextResponse.json({ message: "请选择至少一种评估情形。" }, { status: 400 }); }
}
