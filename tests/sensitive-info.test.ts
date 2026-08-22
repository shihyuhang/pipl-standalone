import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSensitiveCategoryCodes, sensitiveCategoryDefinitions, sensitiveCategoryLabels } from "../src/lib/sensitive-info.ts";

test("只保留受控的敏感个人信息类别并兼容旧数据", () => {
  assert.deepEqual(
    normalizeSensitiveCategoryCodes(["health", "medical_health", "precise_location", "用户随便填写", "medical_health"]),
    ["medical_health", "location_trajectory"]
  );
});

test("材料和AI使用法定类别中文名称", () => {
  assert.deepEqual(
    sensitiveCategoryLabels(["biometric", "financial_account", "other_sensitive"]),
    ["生物识别信息", "金融账户信息", "其他敏感个人信息"]
  );
});

test("每个受控类别都提供识别示例和排除边界", () => {
  assert.equal(sensitiveCategoryDefinitions.length, 7);
  for (const item of sensitiveCategoryDefinitions) {
    assert.ok(item.examples.length > 5);
    assert.ok(item.boundary.length > 5);
  }
});
