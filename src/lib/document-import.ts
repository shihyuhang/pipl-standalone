import { createHash } from "node:crypto";
import { extname } from "node:path";
import { inflateRawSync } from "node:zlib";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARACTERS = 500_000;
export const acceptedImportExtensions = [".txt", ".md", ".html", ".htm", ".docx", ".pdf"] as const;

export interface ImportedFilePreview {
  fileName: string;
  mimeType: string;
  byteSize: number;
  contentHash: string;
  extension: string;
  content: string;
  extractionMethod: "plain_text" | "html_text" | "docx_xml" | "manual_required";
  requiresManualText: boolean;
  notice: string;
}

const decodeEntities = (value: string) => value
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&apos;/gi, "'");

const normalizeText = (value: string) => value
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim()
  .slice(0, MAX_EXTRACTED_CHARACTERS);

export function extractHtmlText(html: string) {
  return normalizeText(decodeEntities(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")));
}

function findZipEntry(zip: Buffer, targetName: string): Buffer {
  let eocd = -1;
  const minimum = Math.max(0, zip.length - 65_557);
  for (let offset = zip.length - 22; offset >= minimum; offset--) {
    if (zip.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("DOCX_INVALID_ZIP");
  const entries = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("DOCX_INVALID_DIRECTORY");
    const flags = zip.readUInt16LE(offset + 8);
    const compression = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === targetName) {
      if (flags & 1) throw new Error("DOCX_ENCRYPTED");
      if (uncompressedSize > 5 * 1024 * 1024) throw new Error("DOCX_CONTENT_TOO_LARGE");
      if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("DOCX_INVALID_ENTRY");
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = zip.subarray(start, start + compressedSize);
      if (compression === 0) return compressed;
      if (compression === 8) return inflateRawSync(compressed, { maxOutputLength: 5 * 1024 * 1024 });
      throw new Error("DOCX_UNSUPPORTED_COMPRESSION");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("DOCX_DOCUMENT_XML_MISSING");
}

export function extractDocxText(zip: Buffer) {
  const xml = findZipEntry(zip, "word/document.xml").toString("utf8");
  return normalizeText(decodeEntities(xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n\n")
    .replace(/<[^>]+>/g, "")));
}

export function previewImportedFile(fileName: string, mimeType: string, buffer: Buffer): ImportedFilePreview {
  const safeName = fileName.trim().replace(/[\\/]/g, "_").slice(0, 180);
  const extension = extname(safeName).toLowerCase();
  if (!acceptedImportExtensions.includes(extension as typeof acceptedImportExtensions[number])) throw new Error("IMPORT_TYPE_NOT_SUPPORTED");
  if (!buffer.length) throw new Error("IMPORT_FILE_EMPTY");
  if (buffer.length > MAX_IMPORT_BYTES) throw new Error("IMPORT_FILE_TOO_LARGE");
  if (extension === ".docx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) throw new Error("DOCX_INVALID_ZIP");
  if (extension === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("PDF_INVALID");

  let content = "";
  let extractionMethod: ImportedFilePreview["extractionMethod"] = "plain_text";
  if ([".txt", ".md"].includes(extension)) content = normalizeText(buffer.toString("utf8"));
  else if ([".html", ".htm"].includes(extension)) { content = extractHtmlText(buffer.toString("utf8")); extractionMethod = "html_text"; }
  else if (extension === ".docx") { content = extractDocxText(buffer); extractionMethod = "docx_xml"; }
  else extractionMethod = "manual_required";

  return {
    fileName: safeName, mimeType: mimeType || "application/octet-stream", byteSize: buffer.length,
    contentHash: createHash("sha256").update(buffer).digest("hex"), extension, content, extractionMethod,
    requiresManualText: extractionMethod === "manual_required",
    notice: extractionMethod === "manual_required"
      ? "PDF 原件将完整保留。当前版本请粘贴或补充可编辑正文后再导入。"
      : "已提取可编辑正文；请核对排版、表格和附件内容。原文件会同时保留。"
  };
}
