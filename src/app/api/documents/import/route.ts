import { NextResponse } from "next/server";
import { z } from "zod";
import { createImportedDocument, listActivities } from "@/lib/db";
import { previewImportedFile } from "@/lib/document-import";
import { materialCatalog } from "@/lib/materials";

export const runtime = "nodejs";

const fieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().min(2).max(80),
  audienceGroup: z.enum(["consumer", "business_contact", "employee", "candidate", "visitor", "internal"]),
  scope: z.string().trim().min(1).max(500),
  audience: z.string().trim().min(1).max(300),
  description: z.string().trim().max(1000).default(""),
  createdBy: z.string().trim().max(100).default(""),
  content: z.string().trim().min(20).max(500_000),
  activityIds: z.array(z.string().uuid()).max(100).default([])
});

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "请选择要导入的原文件。" }, { status: 400 });
    let activityIds: unknown = [];
    try { activityIds = JSON.parse(String(form.get("activityIds") || "[]")); } catch { return NextResponse.json({ message: "关联业务格式不正确。" }, { status: 400 }); }
    const parsed = fieldsSchema.safeParse({
      name: form.get("name"), type: form.get("type"), audienceGroup: form.get("audienceGroup"),
      scope: form.get("scope"), audience: form.get("audience"), description: form.get("description") || "",
      createdBy: form.get("createdBy") || "", content: form.get("content"), activityIds
    });
    if (!parsed.success) return NextResponse.json({ message: "请补全材料类型、名称、适用范围和不少于 20 个字的正文。" }, { status: 400 });

    const definition = materialCatalog.find(item => item.code === parsed.data.type);
    if (!definition || !definition.audienceGroups.includes(parsed.data.audienceGroup)) {
      return NextResponse.json({ message: "材料类型与适用人群不匹配，请重新选择。" }, { status: 409 });
    }
    const knownActivityIds = new Set(listActivities().map(item => item.id));
    if (parsed.data.activityIds.some(id => !knownActivityIds.has(id))) return NextResponse.json({ message: "关联业务中有记录已不存在，请刷新后重试。" }, { status: 409 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = previewImportedFile(file.name, file.type, buffer);
    const importedAt = new Date().toISOString();
    return NextResponse.json(createImportedDocument({
      ...parsed.data,
      metadata: {
        materialType: parsed.data.type, modules: definition.defaultModules,
        generationBasis: `导入已有材料 · ${preview.fileName}`,
        generatedAt: importedAt, importedAt, generationMethod: "import",
        requirementLevel: definition.requirement || "basic", trigger: definition.trigger, legalBasis: definition.legalBasis,
        importedFileName: preview.fileName, importedMimeType: preview.mimeType, importedFileSize: preview.byteSize,
        importedFileHash: preview.contentHash, importExtractionMethod: preview.extractionMethod
      },
      attachment: { fileName: preview.fileName, mimeType: preview.mimeType, byteSize: preview.byteSize, contentHash: preview.contentHash, content: buffer }
    }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error && error.message === "IMPORT_FILE_TOO_LARGE" ? "单个文件不能超过 10MB。" : "导入失败，请检查文件后重试。" }, { status: 400 });
  }
}
