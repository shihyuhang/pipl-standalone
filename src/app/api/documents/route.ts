import { NextResponse } from "next/server";
import { z } from "zod";
import { createDocument, getEnterprise, listActivities, listDocuments } from "@/lib/db";
import { generateMaterialDraft, materialCatalog } from "@/lib/materials";
import { incompatibleActivities } from "@/lib/material-audience";
import { generateCompleteMaterialDraft } from "@/lib/material-ai";
import { findExternalContentQualityRisks } from "@/lib/document-publication";

export const runtime = "nodejs";

function friendlyAiFallbackReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/配置|密钥|服务/.test(message)) return "当前AI服务配置不可用，系统已安全改用基础模板";
  if (/timeout|超时|abort/i.test(message)) return "AI生成等待超时，系统已安全改用基础模板";
  return "AI服务暂时未能完成本次生成，系统已安全改用基础模板";
}

export async function GET() { return NextResponse.json(listDocuments()); }

export async function POST(request: Request) {
  const parsed = z.object({
    name: z.string().min(2),
    type: z.string().min(2),
    audienceGroup: z.enum(["consumer", "business_contact", "employee", "candidate", "visitor", "internal"]),
    scope: z.string().min(1),
    audience: z.string().min(1),
    description: z.string().optional().default(""),
    activityIds: z.array(z.string().uuid()).min(1),
    audienceOverrideActivityIds: z.array(z.string().uuid()).max(100).optional().default([]),
    modules: z.array(z.string()).optional(),
    generationMode: z.enum(["ai", "template"]).optional().default("template"),
    excludedAiFields: z.array(z.string().max(100)).max(40).optional().default([]),
    aiPreviewConfirmed: z.boolean().optional().default(false)
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请完成材料类型、适用对象和关联业务的选择。" }, { status: 400 });

  const enterprise = getEnterprise();
  const activities = listActivities().filter(item => parsed.data.activityIds.includes(item.id));
  if (activities.length !== parsed.data.activityIds.length) return NextResponse.json({ message: "关联的业务中有内容已不存在，请重新选择。" }, { status: 409 });
  if (activities.some(item => item.completeness !== 1 || !item.facts.confirmedAt)) {
    return NextResponse.json({ message: "关联业务尚未完成事实确认，请先完善业务情况。" }, { status: 409 });
  }
  const definition = materialCatalog.find(item => item.code === parsed.data.type);
  if (!definition) return NextResponse.json({ message: "暂不支持该材料类型。" }, { status: 400 });
  if (!definition.audienceGroups.includes(parsed.data.audienceGroup)) {
    return NextResponse.json({ message: "该材料类型不适用于所选人群，请重新选择。" }, { status: 409 });
  }
  const overrideIds = new Set(parsed.data.audienceOverrideActivityIds);
  if ([...overrideIds].some(id => !parsed.data.activityIds.includes(id))) {
    return NextResponse.json({ message: "人工确认的人群映射必须属于本次关联业务。" }, { status: 409 });
  }
  const incompatible = incompatibleActivities(activities, parsed.data.audienceGroup).filter(item => !overrideIds.has(item.id));
  if (incompatible.length) {
    return NextResponse.json({ message: `以下业务不属于“${parsed.data.audience}”范围：${incompatible.map(item => item.name).join("、")}。请分开建立材料。` }, { status: 409 });
  }
  if (parsed.data.generationMode === "ai" && !parsed.data.aiPreviewConfirmed) {
    return NextResponse.json({ message: "请先预览并确认将发送给AI的内容。" }, { status: 409 });
  }

  const baselineContent = generateMaterialDraft({
    ...parsed.data, enterprise, activities
  });
  let content = baselineContent;
  let generationMethod: "ai" | "template" = "template";
  let aiMetadata: { aiProvider?: string; aiModel?: string; aiPromptVersion?: string; aiRemoteRunId?: string | null; aiFallbackReason?: string; pendingFacts?: string[]; aiRedactionCount?: number; aiExcludedFields?: string[]; aiPreviewConfirmedAt?: string } = {};
  if (parsed.data.generationMode === "ai") {
    try {
      const aiDraft = await generateCompleteMaterialDraft({
        name: parsed.data.name, scope: parsed.data.scope, audience: parsed.data.audience,
        definition, enterprise, activities, baselineDraft: baselineContent, excludedFields: parsed.data.excludedAiFields
      });
      content = aiDraft.content; generationMethod = "ai";
      aiMetadata = { aiProvider: aiDraft.provider, aiModel: aiDraft.model, aiPromptVersion: aiDraft.promptVersion, aiRemoteRunId: aiDraft.remoteRunId, pendingFacts: aiDraft.pendingFacts, aiRedactionCount: aiDraft.redactionCount, aiExcludedFields: aiDraft.excludedFields, aiPreviewConfirmedAt: new Date().toISOString() };
    } catch (error) {
      aiMetadata = { aiFallbackReason: friendlyAiFallbackReason(error), aiExcludedFields: parsed.data.excludedAiFields, aiPreviewConfirmedAt: new Date().toISOString() };
    }
  }
  const qualityIssues = findExternalContentQualityRisks({ type: parsed.data.type, content, activities, enterprise });
  aiMetadata.pendingFacts = [...new Set([...(aiMetadata.pendingFacts || []), ...qualityIssues])];
  return NextResponse.json(createDocument({
    name: parsed.data.name,
    type: parsed.data.type,
    scope: parsed.data.scope,
    audienceGroup: parsed.data.audienceGroup,
    audience: parsed.data.audience,
    description: parsed.data.description,
    activityIds: parsed.data.activityIds,
    content,
    metadata: {
      materialType: parsed.data.type,
      modules: definition.defaultModules,
      generationBasis: `${generationMethod === "ai" ? "AI完整草稿" : "基础模板"} · 企业档案 + ${activities.length} 项已确认业务`,
      generatedAt: new Date().toISOString(),
      requirementLevel: definition.requirement || "basic",
      trigger: definition.trigger,
      legalBasis: definition.legalBasis,
      generationMethod,
      manualAudienceOverrideActivityIds: parsed.data.audienceOverrideActivityIds,
      ...aiMetadata
    }
  }), { status: 201 });
}
