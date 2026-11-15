import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.PIPL_DATABASE_PATH = join(tmpdir(), `pipl-document-pending-${randomUUID()}.db`);

test("负责人确认 AI 待核事实后保留确认记录", async () => {
  const db = await import("../src/lib/db.ts");
  const pendingFact = "确认境外接收方的实际联系方式";
  const document = db.createDocument({
    name: "出境告知测试",
    type: "cross_border_notice_consent",
    scope: "测试业务",
    audienceGroup: "consumer",
    audience: "测试用户",
    activityIds: [],
    content: "测试正文",
    metadata: {
      materialType: "cross_border_notice_consent",
      modules: [],
      generationBasis: "测试",
      generatedAt: new Date().toISOString(),
      aiPendingFacts: [pendingFact]
    }
  });

  const resolved = db.resolveDocumentPendingFact(document.id, pendingFact);
  assert.deepEqual(resolved.metadata.resolvedPendingFacts, [pendingFact]);
  assert.throws(() => db.resolveDocumentPendingFact(document.id, "不存在的事项"), /PENDING_FACT_NOT_FOUND/);
});
