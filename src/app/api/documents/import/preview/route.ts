import { NextResponse } from "next/server";
import { previewImportedFile } from "@/lib/document-import";

export const runtime = "nodejs";

const importErrorMessage = (code: string) => ({
  IMPORT_TYPE_NOT_SUPPORTED: "仅支持 TXT、Markdown、HTML、DOCX 和 PDF 文件。",
  IMPORT_FILE_EMPTY: "所选文件为空，请重新选择。",
  IMPORT_FILE_TOO_LARGE: "单个文件不能超过 10MB。",
  DOCX_INVALID_ZIP: "该文件不是有效的 DOCX 文件，或文件已经损坏。",
  DOCX_DOCUMENT_XML_MISSING: "DOCX 中没有找到可读取的正文。",
  DOCX_ENCRYPTED: "暂不支持导入加密的 DOCX 文件。",
  DOCX_CONTENT_TOO_LARGE: "DOCX 解压后的正文过大。",
  DOCX_UNSUPPORTED_COMPRESSION: "该 DOCX 使用了暂不支持的压缩方式。",
  PDF_INVALID: "该文件不是有效的 PDF 文件。"
} as Record<string, string>)[code] || "文件暂时无法读取，请检查后重试。";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "请选择要导入的文件。" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    return NextResponse.json(previewImportedFile(file.name, file.type, buffer));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: importErrorMessage(code) }, { status: 400 });
  }
}
