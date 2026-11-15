import test from "node:test";
import assert from "node:assert/strict";
import { isMeaningfulTaskResult } from "../src/lib/task-result.ts";

test("简短但明确的统计结论可以完成任务", () => {
  assert.equal(isMeaningfulTaskResult("500人"), true);
  assert.equal(isMeaningfulTaskResult("20 户"), true);
});

test("空白或笼统结论不能冒充实际办理结果", () => {
  assert.equal(isMeaningfulTaskResult("无"), false);
  assert.equal(isMeaningfulTaskResult("完成"), false);
  assert.equal(isMeaningfulTaskResult("已处理"), false);
});
