import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.PIPL_DATABASE_PATH = join(tmpdir(), `pipl-ai-settings-${randomUUID()}.db`);

test("AI密钥加密保存且公共配置不回传明文", async () => {
  const db = await import("../src/lib/db.ts");
  const saved = db.saveMaterialAiConfiguration({ provider: "custom", apiBaseUrl: "https://ai.example.test/v1", model: "legal-model", apiKey: "test-secret" });
  assert.equal(saved.hasApiKey, true);
  assert.equal("apiKey" in saved, false);
  const runtime = db.getStoredMaterialAiRuntimeConfiguration();
  assert.equal(runtime?.apiKey, "test-secret");
  db.saveMaterialAiConfiguration({ provider: "custom", apiBaseUrl: "https://ai.example.test/v1", model: "legal-model-v2" });
  assert.equal(db.getStoredMaterialAiRuntimeConfiguration()?.apiKey, "test-secret");
});

test("AI接口地址拒绝带凭据或非本机HTTP地址", async () => {
  const { normalizeMaterialAiBaseUrl } = await import("../src/lib/ai-settings.ts");
  assert.equal(normalizeMaterialAiBaseUrl("https://ai.example.test/v1/"), "https://ai.example.test/v1");
  assert.equal(normalizeMaterialAiBaseUrl("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1");
  assert.throws(() => normalizeMaterialAiBaseUrl("http://ai.example.test/v1"), /HTTPS/);
  assert.throws(() => normalizeMaterialAiBaseUrl("https://user:pass@ai.example.test/v1"), /用户名或密码/);
});
