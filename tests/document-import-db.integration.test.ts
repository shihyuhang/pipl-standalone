import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.PIPL_DATABASE_PATH = join(tmpdir(), `pipl-document-import-${randomUUID()}.db`);

test("导入材料建立 V1 草稿、保留原件且删除未发布材料时一并清理", async () => {
  const db = await import("../src/lib/db.ts");
  const original = Buffer.from("# 现有隐私政策\n\n这是一份用于导入回归测试的完整材料正文。");
  const hash = createHash("sha256").update(original).digest("hex");
  const document = db.createImportedDocument({
    name: "现有隐私政策", type: "privacy_notice", scope: "官网和产品", audienceGroup: "consumer",
    audience: "消费者和产品用户", content: original.toString("utf8"), createdBy: "测试经办人",
    metadata: {
      materialType: "privacy_notice", modules: [], generationBasis: "导入已有材料 · policy.md",
      generatedAt: new Date().toISOString(), generationMethod: "import", importedFileName: "policy.md",
      importedFileHash: hash, importedFileSize: original.length, importedMimeType: "text/markdown"
    },
    attachment: { fileName: "policy.md", mimeType: "text/markdown", byteSize: original.length, contentHash: hash, content: original }
  });
  assert.equal(document.metadata.generationMethod, "import");
  assert.equal(document.versions?.[0].versionNumber, "V1");
  assert.equal(document.versions?.[0].status, "draft");
  assert.equal(document.versions?.[0].createdBy, "测试经办人");
  assert.equal(document.attachments?.length, 1);
  const attachment = db.getDocumentAttachment(document.id, document.attachments![0].id)!;
  assert.deepEqual(attachment.content, original);
  db.deleteDocument(document.id);
  assert.equal(db.getDocumentAttachment(document.id, attachment.id), null);
});
