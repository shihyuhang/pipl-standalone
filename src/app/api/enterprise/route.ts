import { NextResponse } from "next/server";
import { z } from "zod";
import { addAuditEvent, getEnterprise, updateEnterprise, upsertTask } from "@/lib/db";
import { assessQualification } from "@/lib/qualification";

export const runtime = "nodejs";
export async function GET() { return NextResponse.json(getEnterprise()); }

const schema = z.object({
  legalName: z.string().min(2).max(200), orgType: z.string().min(1), industry: z.string().trim().min(2).max(100),
  businessModel: z.enum(["B2B", "B2C", "both", "internal_only"]), ownership: z.string().min(1),
  processingRole: z.string().min(1), personCount: z.number().int().nonnegative().nullable(), countVerified: z.boolean(),
  subjectCategories: z.array(z.string()), sensitiveCategories: z.array(z.string()),
  minorsPossible: z.enum(["yes", "no", "unknown"]), crossBorder: z.enum(["yes", "no", "unknown"]),
  privacyContactName: z.string().min(1), privacyContactRole: z.string().min(1), privacyContactChannel: z.string().min(1)
});

// 更新单位基本信息；人数口径、处理角色、敏感情况等变化可能影响适用路径，因此同步重新评估。
export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请检查尚未填写的内容。", errors: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const result = assessQualification(input);
  const enterprise = updateEnterprise({ ...input, qualificationStatus: result.status, qualificationSummary: result.summary, onboardingCompleted: true });
  for (const task of result.tasks) upsertTask({ ...task, category: "适用判断" });
  addAuditEvent("enterprise.updated", `更新单位基本信息，路径判断：${result.status}`);
  return NextResponse.json({ enterprise, qualification: result });
}
