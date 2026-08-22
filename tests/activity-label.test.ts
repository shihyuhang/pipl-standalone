import test from "node:test";
import assert from "node:assert/strict";
import { activityDisplayName } from "../src/lib/activity-label.ts";

test("有备注时保留系统场景名并追加用户区分名称", () => {
  assert.equal(activityDisplayName({ name: "消费者或会员", remark: "上海门店会员" }), "消费者或会员 · 上海门店会员");
  assert.equal(activityDisplayName({ name: "消费者或会员", remark: "" }), "消费者或会员");
});
