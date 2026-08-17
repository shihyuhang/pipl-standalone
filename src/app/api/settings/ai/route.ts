import { NextResponse } from "next/server";
import { z } from "zod";
import { getMaterialAiStatus, materialAiProviderOptions, normalizeMaterialAiBaseUrl, providerDefaults } from "@/lib/ai-settings";
import { saveMaterialAiConfiguration } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const provider = z.enum(["auto", "deepseek", "qwen", "kimi", "custom", "disabled"]);

export async function GET() {
  return NextResponse.json({
    ...getMaterialAiStatus(),
    options: materialAiProviderOptions,
    defaults: Object.fromEntries(materialAiProviderOptions.map(item => [item.code, providerDefaults(item.code)]))
  });
}

export async function PUT(request: Request) {
  const parsed = z.object({
    provider,
    apiBaseUrl: z.string().max(500).optional().default(""),
    model: z.string().max(200).optional().default(""),
    apiKey: z.string().max(1000).optional(),
    clearApiKey: z.boolean().optional().default(false)
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "AI配置信息格式无效。" }, { status: 400 });
  try {
    const fallback = providerDefaults(parsed.data.provider);
    const apiBaseUrl = normalizeMaterialAiBaseUrl(parsed.data.apiBaseUrl || fallback.apiBaseUrl);
    const model = (parsed.data.model || fallback.model).trim();
    if (!["auto", "disabled"].includes(parsed.data.provider) && (!apiBaseUrl || !model)) {
      return NextResponse.json({ message: "请填写AI接口地址和模型名称。" }, { status: 400 });
    }
    saveMaterialAiConfiguration({ ...parsed.data, apiBaseUrl, model, apiKey: parsed.data.apiKey?.trim() || undefined });
    return NextResponse.json(getMaterialAiStatus());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法保存AI配置。" }, { status: 400 });
  }
}
