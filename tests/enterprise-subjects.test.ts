import test from "node:test";
import assert from "node:assert/strict";
import { enterpriseSubjectLabel, getCustomSubjectDescription, hasCompleteCustomSubjectSelection, mergeEnterpriseSubjectCategories } from "../src/lib/enterprise-subjects.ts";

test("自定义主体说明与标准人员类型一起保存", () => {
  const categories = mergeEnterpriseSubjectCategories(
    ["employee", "consumer", "other:旧说明"],
    "患者或产品使用者——通过医院取得器械，在售后或投诉中提供反馈"
  );
  assert.deepEqual(categories, [
    "employee",
    "consumer",
    "other:患者或产品使用者——通过医院取得器械，在售后或投诉中提供反馈"
  ]);
});

test("自定义主体说明可从企业档案恢复并展示为自然语言", () => {
  const stored = "other:患者——医疗器械售后与投诉";
  assert.equal(getCustomSubjectDescription(["employee", stored]), "患者——医疗器械售后与投诉");
  assert.equal(enterpriseSubjectLabel(stored), "患者——医疗器械售后与投诉");
});

test("选择其他主体后必须保存具体说明", () => {
  assert.equal(hasCompleteCustomSubjectSelection(["employee"], true), false);
  assert.equal(hasCompleteCustomSubjectSelection(["employee", "other:患者或产品使用者"], true), true);
  assert.equal(hasCompleteCustomSubjectSelection(["employee"], false), true);
});
