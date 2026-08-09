import { NextResponse } from "next/server";
import { listAssessments } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const activityId = new URL(request.url).searchParams.get("activityId") || undefined;
  return NextResponse.json(listAssessments(activityId));
}
