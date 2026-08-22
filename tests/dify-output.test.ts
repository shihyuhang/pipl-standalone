import test from "node:test";
import assert from "node:assert/strict";
import { buildAiConfirmedFacts, parseDifyJsonObject, stabilizeTriageStatus } from "../src/lib/dify.ts";
import { normalizeChinaLegalText, normalizeTriageFinding } from "../src/lib/legal-language.ts";

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

test("快速分流上下文把敏感类别转换为正式名称", () => {
  assert.deepEqual(buildAiConfirmedFacts({ sensitiveInformation: "yes", sensitiveCategories: ["biometric", "location_trajectory"], minorsInvolved: "no" }).sensitiveCategories, ["生物识别信息", "行踪轨迹或精准定位"]);
});

test("只有L0或L1建议时不阻断普通业务", () => {
  assert.equal(stabilizeTriageStatus("needs_input", [
    { title: "补充删除方式", description: "继续完善", riskLevel: "L0" },
    { title: "补充权利渠道", description: "继续完善", riskLevel: "L1" }
  ]), "draft_ready");
});

test("L2保持补充路径，L3强制人工复核", () => {
  assert.equal(stabilizeTriageStatus("needs_review", [
    { title: "确认接收方", description: "需要负责人确认", riskLevel: "L2" }
  ]), "needs_input");
  assert.equal(stabilizeTriageStatus("draft_ready", [
    { title: "复核健康信息", description: "需要专业人员复核", riskLevel: "L3" }
  ]), "needs_review");
});

test("中国法界面不展示 GDPR 角色称谓或内部枚举", () => {
  const finding = normalizeTriageFinding(
    "处理角色标识存在冲突",
    "企业画像中processingRole为independent_processor，但招聘场景中企业对候选人信息通常应作为控制者，该标识与业务逻辑不一致。"
  );
  assert.equal(finding.title, "确认本项业务由谁决定信息用途");
  assert.match(finding.description, /自行决定收集目的/);
  assert.doesNotMatch(`${finding.title}${finding.description}`, /processingRole|independent_processor|控制者|controller/i);
});

test("普通文本中的境外术语转换为个人信息保护法用语", () => {
  const normalized = normalizeChinaLegalText("Controller 应向 data subject 告知，受托处理者按照指示处理");
  assert.equal(normalized, "个人信息处理者 应向 相关个人 告知，受托人按照指示处理");
});
