import { NextResponse } from "next/server";
import { testMaterialAiConnection } from "@/lib/material-ai";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await testMaterialAiConnection();
    return NextResponse.json({ ...result, message: "连接成功，可以用于生成材料草稿。" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "AI连接测试失败。" }, { status: 502 });
  }
}
