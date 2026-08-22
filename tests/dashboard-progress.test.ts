import test from "node:test";
import assert from "node:assert/strict";
import { getComplianceProgress } from "../src/lib/dashboard-progress.ts";

const base = {
  onboardingCompleted: true,
  activityCount: 0,
  hasPublishedDocument: false,
  signedAuditCount: 0,
  followUpRecordCount: 0
};

test("首页进度只把第一个未完成阶段标为当前阶段", () => {
  const progress = getComplianceProgress(base);
  assert.deepEqual(progress.map(step => step.status), ["done", "active", "pending", "pending", "pending"]);
});

test("材料草稿不能被算作材料发布完成", () => {
  const progress = getComplianceProgress({ ...base, activityCount: 1, hasPublishedDocument: false });
  assert.deepEqual(progress.map(step => step.status), ["done", "done", "active", "pending", "pending"]);
});

test("普通建档事件不能被算作持续留痕", () => {
  const progress = getComplianceProgress({ ...base, activityCount: 1, hasPublishedDocument: true, signedAuditCount: 1 });
  assert.deepEqual(progress.map(step => step.status), ["done", "done", "done", "done", "active"]);
});

test("正式自查后形成后续记录才完成持续留痕", () => {
  const progress = getComplianceProgress({ ...base, activityCount: 1, hasPublishedDocument: true, signedAuditCount: 1, followUpRecordCount: 1 });
  assert.ok(progress.every(step => step.status === "done"));
});
