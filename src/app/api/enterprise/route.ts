import { NextResponse } from "next/server";
import { getEnterprise } from "@/lib/db";

export const runtime = "nodejs";
export async function GET() { return NextResponse.json(getEnterprise()); }
