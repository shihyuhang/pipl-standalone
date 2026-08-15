import { NextResponse } from "next/server";
import { z } from "zod";
import { createAssessmentRun, getActivity, getEnterprise } from "@/lib/db";
import { runScenarioTriage } from "@/lib/ai-gateway";
import { isActivityReadyForTriage } from "@/lib/activity-facts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const parsed = z.object({ activityId: z.string().uuid() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请选择有效的业务场景。" }, { status: 400 });
  const activity = getActivity(parsed.data.activityId);
  if (!activity) return NextResponse.json({ message: "未找到该业务场景。" }, { status: 404 });
  if (!isActivityReadyForTriage(activity.facts)) {
    return NextResponse.json({ message: "请先完成业务情况确认，再开始AI快速分流。" }, { status: 409 });
  }
  const enterprise = getEnterprise();
  const minimizedEnterpriseContext = {
    id: enterprise.id,
    orgType: enterprise.orgType,
    industry: enterprise.industry,
    businessModel: enterprise.businessModel,
    ownership: enterprise.ownership,
    processingRole: enterprise.processingRole,
    personCount: enterprise.personCount,
    countVerified: enterprise.countVerified,
    subjectCategories: enterprise.subjectCategories,
    sensitiveCategories: enterprise.sensitiveCategories,
    minorsPossible: enterprise.minorsPossible,
    crossBorder: enterprise.crossBorder,
    qualificationStatus: enterprise.qualificationStatus
  };
  const result = await runScenarioTriage({
    enterprise: minimizedEnterpriseContext,
    scenario: activity as unknown as Record<string, unknown>,
    confirmedFacts: activity.facts as unknown as Record<string, unknown>
  });
  return NextResponse.json(createAssessmentRun(activity, minimizedEnterpriseContext, result), { status: 201 });
}
