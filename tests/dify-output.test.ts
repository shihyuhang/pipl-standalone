import test from "node:test";
import assert from "node:assert/strict";
import { parseDifyJsonObject } from "../src/lib/dify.ts";

test("解析标准 Dify JSON 输出", () => {
  assert.deepEqual(parseDifyJsonObject('{"status":"draft_ready","findings":[]}'), {
    status: "draft_ready",
    findings: []
  });
});

test("兼容 Markdown 围栏和 JSON 后的说明文字", () => {
  const output = `结果如下：\n\`\`\`json\n{
    "status": "needs_input",
    "summary": "请补充说明 {业务用途}",
    "findings": []
  }\n\`\`\`\n以上为初步检查。`;
  assert.equal(parseDifyJsonObject(output).status, "needs_input");
});

test("正确处理 JSON 字符串中的引号和花括号", () => {
  const output = '{"summary":"说明 \\"字段 {A}\\" 的用途","findings":[]}';
  assert.equal(parseDifyJsonObject(output).summary, '说明 "字段 {A}" 的用途');
});

test("拒绝模型返回两个相互竞争的 JSON 结果", () => {
  assert.throws(
    () => parseDifyJsonObject('{"status":"draft_ready"}\n{"status":"needs_review"}'),
    /多个相互竞争的结果/
  );
});

test("拒绝不完整 JSON", () => {
  assert.throws(() => parseDifyJsonObject('{"status":"needs_input"'), /结构化结果不完整/);
});
