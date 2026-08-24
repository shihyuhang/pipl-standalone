import test from "node:test";
import assert from "node:assert/strict";
import { extractDocxText, previewImportedFile } from "../src/lib/document-import.ts";

function storedZip(name: string, data: Buffer) {
  const fileName = Buffer.from(name);
  const local = Buffer.alloc(30 + fileName.length + data.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(fileName.length, 26);
  fileName.copy(local, 30); data.copy(local, 30 + fileName.length);
  const central = Buffer.alloc(46 + fileName.length);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(fileName.length, 28);
  fileName.copy(central, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, end]);
}

test("导入文本和 HTML 时提取可编辑正文并计算文件哈希", () => {
  const text = previewImportedFile("privacy.md", "text/markdown", Buffer.from("# 隐私政策\n\n这是完整正文。"));
  assert.match(text.content, /隐私政策/);
  assert.equal(text.requiresManualText, false);
  assert.equal(text.contentHash.length, 64);

  const html = previewImportedFile("policy.html", "text/html", Buffer.from("<h1>隐私政策</h1><script>secret()</script><p>正文内容</p>"));
  assert.equal(html.content, "隐私政策\n正文内容");
  assert.doesNotMatch(html.content, /secret/);
});

test("DOCX 提取段落、换行和 XML 实体", () => {
  const xml = Buffer.from('<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>隐私&amp;安全</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p></w:body></w:document>');
  const content = extractDocxText(storedZip("word/document.xml", xml));
  assert.equal(content, "隐私&安全\n\n第二段");
});

test("PDF 保留原件但要求人工补充可编辑正文", () => {
  const preview = previewImportedFile("policy.pdf", "application/pdf", Buffer.from("%PDF-1.7\nexample"));
  assert.equal(preview.requiresManualText, true);
  assert.equal(preview.content, "");
  assert.equal(preview.extractionMethod, "manual_required");
});
