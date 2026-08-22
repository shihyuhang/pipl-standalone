import { NextResponse } from "next/server";
import { z } from "zod";
import { createActivity, deleteActivity, listActivities, updateActivityFacts } from "@/lib/db";
import { scenarios } from "@/lib/scenarios";
import { sensitiveCategoryCodes } from "@/lib/sensitive-info";

export const runtime = "nodejs";
export async function GET() { return NextResponse.json({ catalog: scenarios, activities: listActivities() }); }
export async function POST(request: Request) {
  const schema = z.object({ scenarioCode: z.string(), name: z.string().min(1).max(200), remark: z.string().max(200).optional(), description: z.string().max(1000).optional() });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !scenarios.some(item => item.code === parsed.data?.scenarioCode)) return NextResponse.json({ message: "请选择有效的业务场景。" }, { status: 400 });
  return NextResponse.json(createActivity(parsed.data), { status: 201 });
}

export async function PATCH(request: Request) {
  const answer = z.enum(["yes", "no", "unknown", ""]);
  const schema = z.object({
    id: z.string().uuid(),
    remark: z.string().max(200).optional(),
    facts: z.object({
      dataSubjects: z.array(z.string().min(1).max(100)).max(30),
      informationTypes: z.array(z.string().min(1).max(100)).max(30),
      informationDetails: z.string().max(1500).optional().default(""),
      purposes: z.array(z.string().min(1).max(100)).max(30),
      collectionChannels: z.array(z.string().min(1).max(100)).max(30),
      systems: z.array(z.string().min(1).max(100)).max(30),
      recipients: z.array(z.string().min(1).max(100)).max(30),
      approximatePersonCount: z.number().int().nonnegative().nullable(),
      accessRoles: z.array(z.string().min(1).max(100)).max(30),
      systemOperators: z.array(z.string().min(1).max(100)).max(30),
      retentionPeriod: z.string().max(500),
      deletionMethod: z.string().max(1000),
      rightsChannel: z.string().max(500),
      automatedDecision: answer,
      sensitiveInformation: answer,
      sensitiveCategories: z.array(z.enum(sensitiveCategoryCodes)).max(20).optional().default([]),
      minorsInvolved: answer,
      crossBorderAccess: answer,
      notes: z.string().max(2000),
      confirmedAt: z.string().nullable()
    })
  });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "业务情况格式无效，请检查后重试。" }, { status: 400 });
  const activity = updateActivityFacts(parsed.data.id, parsed.data.facts, parsed.data.remark);
  return activity ? NextResponse.json(activity) : NextResponse.json({ message: "未找到该业务场景。" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请选择有效的业务。" }, { status: 400 });
  const result = deleteActivity(parsed.data.id);
  if (result.deleted) return NextResponse.json(result);
  return NextResponse.json({ message: result.message }, { status: result.message === "未找到该业务。" ? 404 : 409 });
}
