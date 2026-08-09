import { NextResponse } from "next/server";
import { z } from "zod";
import { createDocument, getEnterprise, listActivities, listDocuments } from "@/lib/db";
import { generateMaterialDraft, materialCatalog } from "@/lib/materials";

export const runtime = "nodejs";

export async function GET() { return NextResponse.json(listDocuments()); }

export async function POST(request: Request) {
  const parsed = z.object({
    name: z.string().min(2),
    type: z.string().min(2),
    scope: z.string().min(1),
    audience: z.string().min(1),
    description: z.string().optional().default(""),
    activityIds: z.array(z.string().uuid()).min(1),
    modules: z.array(z.string()).optional(),
    content: z.string().optional()
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请完成材料类型、适用对象和关联业务的选择。" }, { status: 400 });

  const enterprise = getEnterprise();
  const activities = listActivities().filter(item => parsed.data.activityIds.includes(item.id));
  if (activities.length !== parsed.data.activityIds.length) return NextResponse.json({ message: "关联的业务中有内容已不存在，请重新选择。" }, { status: 409 });
  const definition = materialCatalog.find(item => item.code === parsed.data.type);
  if (!definition) return NextResponse.json({ message: "暂不支持该材料类型。" }, { status: 400 });

  const content = parsed.data.content || generateMaterialDraft({
    ...parsed.data, enterprise, activities
  });
  return NextResponse.json(createDocument({
    name: parsed.data.name,
    type: parsed.data.type,
    scope: parsed.data.scope,
    audience: parsed.data.audience,
    description: parsed.data.description,
    activityIds: parsed.data.activityIds,
    content,
    metadata: {
      materialType: parsed.data.type,
      modules: parsed.data.modules?.length ? parsed.data.modules : definition.defaultModules,
      generationBasis: `企业档案 + ${activities.length} 项已确认业务`,
      generatedAt: new Date().toISOString()
    }
  }), { status: 201 });
}
