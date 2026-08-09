import { NextResponse } from "next/server";
import { z } from "zod";
import { createDocument, getEnterprise, listDocuments } from "@/lib/db";

export const runtime = "nodejs";
export async function GET() { return NextResponse.json(listDocuments()); }
export async function POST(request: Request) {
  const parsed = z.object({ name: z.string().min(2), type: z.string().default("privacy_notice"), scope: z.string().min(1), content: z.string().optional() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "请填写文档名称和适用范围。" }, { status: 400 });
  const enterprise = getEnterprise();
  const content = parsed.data.content || `${enterprise.legalName || "本单位"}重视个人信息保护。\n\n一、我们处理的信息\n我们仅在具体业务所需范围内处理员工、客户或供应商联系人等相关个人的信息。\n\n二、处理目的\n用于业务联系、合同履行、内部管理及依法履行相关义务。\n\n三、保存与保护\n我们按照实现处理目的所需的最短时间保存，并采取与风险相适应的保护措施。\n\n四、您的权利\n如需查询、更正、删除个人信息或提出其他请求，请通过以下方式联系我们：${enterprise.privacyContactChannel || "待补充"}。\n\n本文件为系统辅助生成的草稿，发布前应由负责人结合具体业务事实确认。`;
  return NextResponse.json(createDocument({ ...parsed.data, content }), { status: 201 });
}
