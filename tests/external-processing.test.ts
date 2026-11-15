import test from "node:test";
import assert from "node:assert/strict";
import { hasMeaningfulExternalRecipientDetails } from "../src/lib/external-processing.ts";

test("短但可识别的外部单位名称不被字符数门槛拦截", () => {
  assert.equal(hasMeaningfulExternalRecipientDetails("医院"), true);
  assert.equal(hasMeaningfulExternalRecipientDetails("阿里云"), true);
});

test("占位和未确认表述不能冒充外部单位事实", () => {
  assert.equal(hasMeaningfulExternalRecipientDetails(""), false);
  assert.equal(hasMeaningfulExternalRecipientDetails("无"), false);
  assert.equal(hasMeaningfulExternalRecipientDetails("待确认"), false);
  assert.equal(hasMeaningfulExternalRecipientDetails("XX公司"), false);
});
