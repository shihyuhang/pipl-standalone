import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnterprise, listActivities } from "@/lib/db";
import { generateMaterialDraft, materialCatalog } from "@/lib/materials";
import { incompatibleActivities } from "@/lib/material-audience";
import { buildMaterialAiTransferPreview } from "@/lib/material-ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = z.object({
    name: z.string().min(2),
    type: z.string().min(2),
    audienceGroup: z.enum(["consumer", "business_contact", "employee", "candidate", "visitor", "internal"]),
    scope: z.string().min(1),
    audience: z.string().min(1),
    activityIds: z.array(z.string().uuid()).min(1),
    excludedFields: z.array(z.string().max(100)).max(40).optional()
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请先完成材料范围和关联业务选择。" }, { status: 400 });
  const definition = materialCatalog.find(item => item.code === parsed.data.type);
  if (!definition || !definition.audienceGroups.includes(parsed.data.audienceGroup)) {
    return NextResponse.json({ message: "材料类型和适用人群不匹配。" }, { status: 409 });
  }
  const enterprise = getEnterprise();
  const activities = listActivities().filter(item => parsed.data.activityIds.includes(item.id));
  if (activities.length !== parsed.data.activityIds.length || activities.some(item => item.completeness !== 1 || !item.facts.confirmedAt)) {
    return NextResponse.json({ message: "关联业务不存在或尚未完成事实确认。" }, { status: 409 });
  }
  if (incompatibleActivities(activities, parsed.data.audienceGroup).length) {
    return NextResponse.json({ message: "关联业务中存在不属于当前人群的内容。" }, { status: 409 });
  }
  const baselineDraft = generateMaterialDraft({ ...parsed.data, enterprise, activities });
  return NextResponse.json(buildMaterialAiTransferPreview({
    name: parsed.data.name, scope: parsed.data.scope, audience: parsed.data.audience,
    definition, enterprise, activities, baselineDraft, excludedFields: parsed.data.excludedFields
  }));
}
