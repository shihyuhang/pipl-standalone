import { NextResponse } from "next/server";
import { z } from "zod";
import { getOnboardingDraft, saveOnboardingDraft } from "@/lib/db";

export const runtime = "nodejs";

const draftSchema = z.object({
  form: z.record(z.string(), z.unknown()),
  customSubject: z.string().max(300).default(""),
  showCustomSubject: z.boolean().default(false),
  step: z.number().int().min(1).max(3)
});

export async function GET() {
  return NextResponse.json({ draft: getOnboardingDraft() });
}

export async function PATCH(request: Request) {
  const parsed = draftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "建档草稿格式不正确。" }, { status: 400 });
  return NextResponse.json({ draft: saveOnboardingDraft(parsed.data) });
}
