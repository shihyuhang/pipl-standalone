import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditInstance, listAuditInstances } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(listAuditInstances()); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = z.object({ title: z.string().max(200).optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "自查名称格式无效。" }, { status: 400 });
  return NextResponse.json(createAuditInstance(parsed.data.title), { status: 201 });
}
