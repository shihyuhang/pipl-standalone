import { NextResponse } from "next/server";
import { z } from "zod";
import { addAuditEvent, updateEnterprise, upsertTask } from "@/lib/db";
import { assessQualification } from "@/lib/qualification";

export const runtime = "nodejs";

const schema = z.object({
  legalName: z.string().min(2).max(200), orgType: z.string().min(1), industry: z.string().trim().min(2).max(100),
  businessModel: z.enum(["B2B", "B2C", "both", "internal_only"]), ownership: z.string().min(1),
  processingRole: z.string().min(1), personCount: z.number().int().nonnegative().nullable(), countVerified: z.boolean(),
  subjectCategories: z.array(z.string()), sensitiveCategories: z.array(z.string()),
  minorsPossible: z.enum(["yes", "no", "unknown"]), crossBorder: z.enum(["yes", "no", "unknown"]),
  privacyContactName: z.string().min(1), privacyContactRole: z.string().min(1), privacyContactChannel: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请检查尚未填写的内容。", errors: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const result = assessQualification(input);
  const enterprise = updateEnterprise({ ...input, qualificationStatus: result.status, qualificationSummary: result.summary, onboardingCompleted: true });
  for (const task of result.tasks) upsertTask({ ...task, category: "适用判断" });
  if (result.status !== "out_of_scope") {
    upsertTask({ code: "ADD-FIRST-SCENARIO", title: "添加首个业务场景", description: "选择一项实际业务，确认怎样使用个人信息。", category: "我的业务", priority: "normal" });
    upsertTask({ code: "CREATE-FIRST-NOTICE", title: "建立首份个人信息处理规则", description: "根据已经确认的企业和业务情况生成并审核首份草稿。", category: "合规材料", priority: "normal" });
  }
  addAuditEvent("enterprise.onboarded", `完成企业快速建档，路径判断：${result.status}`);
  return NextResponse.json({ enterprise, qualification: result });
}
