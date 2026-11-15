import test from "node:test";
import assert from "node:assert/strict";
import { emptyActivityFacts } from "../src/lib/activity-facts.ts";
import { duplicateDocumentKey, findPotentialDuplicateDocuments, findSensitiveCategoryGaps } from "../src/lib/material-consistency.ts";
import type { BusinessDocument, ProcessingActivity } from "../src/lib/types.ts";

const activity = (id: string, categories: string[] = []): ProcessingActivity => ({
  id, scenarioCode: "CUSTOM", name: id, description: "测试业务", status: "active", completeness: 1,
  createdAt: "2026-09-14T00:00:00.000Z",
  facts: { ...emptyActivityFacts(), sensitiveInformation: categories.length ? "yes" : "no", sensitiveCategories: categories }
});

const document = (id: string, activityIds: string[], status: "draft" | "effective" = "draft"): BusinessDocument => ({
  id, name: "隐私政策", type: "privacy_notice", scope: "消费者业务", audienceGroup: "consumer", description: "", audience: "消费者",
  activityIds, metadata: { materialType: "privacy_notice", modules: [], generationBasis: "测试", generatedAt: "2026-09-14T00:00:00.000Z" },
  currentVersionId: status === "effective" ? `${id}-version` : null, currentVersion: null, healthStatus: "updating", reviewReason: "", reviewDueAt: null,
  updatedAt: "2026-09-14T00:00:00.000Z", versions: [{
    id: `${id}-version`, documentId: id, versionNumber: "V1", status, content: "测试正文", changeSummary: "测试", createdAt: "2026-09-14T00:00:00.000Z",
    publishedAt: null, sourceVersionId: null, contentHash: "hash", factsSnapshot: {}, createdBy: "测试",
    submittedAt: null, reviewedAt: null, reviewNote: "", approvedBy: "", approverRole: "", approvedAt: null,
    publishedBy: "", publishChannel: "", publicationEvidence: "", publicationClassification: "", publicationRiskSummary: ""
  }], pendingImpacts: []
});

test("只提示企业敏感类别中尚未落实到具体业务的部分", () => {
  const result = findSensitiveCategoryGaps({ sensitiveCategories: ["medical_health", "financial_account"] }, [activity("a1", ["medical_health"])]);
  assert.deepEqual(result.codes, ["financial_account"]);
  assert.equal(result.labels.length, 1);
});

test("重复材料只匹配相同类型、人群、业务集合且仍有活动草稿的材料", () => {
  const duplicate = document("d1", ["a2", "a1"]);
  const published = document("d2", ["a1", "a2"], "effective");
  const result = findPotentialDuplicateDocuments([duplicate, published], { type: "privacy_notice", audienceGroup: "consumer", activityIds: ["a1", "a2"] });
  assert.deepEqual(result.map(item => item.id), ["d1"]);
  assert.equal(duplicateDocumentKey(duplicate), "privacy_notice::consumer::a1|a2");
});
