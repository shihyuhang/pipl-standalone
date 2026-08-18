import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emptyActivityFacts } from "../src/lib/activity-facts.ts";

process.env.PIPL_DATABASE_PATH = join(tmpdir(), `pipl-system-flow-${randomUUID()}.db`);

test("完整业务流会自动关闭可由系统核验的任务", async () => {
  const db = await import("../src/lib/db.ts");
  db.updateEnterprise({
    legalName: "测试外资B2B有限公司",
    orgType: "有限责任公司",
    industry: "专业服务",
    businessModel: "B2B",
    ownership: "外商投资企业",
    processingRole: "independent_processor",
    personCount: 480,
    countVerified: true,
    subjectCategories: ["员工", "求职者", "客户和供应商联系人"],
    sensitiveCategories: [],
    minorsPossible: "no",
    crossBorder: "no",
    privacyContactName: "测试负责人",
    privacyContactRole: "行政负责人",
    privacyContactChannel: "privacy@example.test",
    qualificationStatus: "eligible",
    qualificationSummary: "适用小型处理者工作路径",
    onboardingCompleted: true
  });
  assert.equal(db.getEnterprise().industry, "专业服务");
  db.upsertTask({ code: "ADD-FIRST-SCENARIO", title: "添加首个业务场景", description: "添加业务", category: "我的业务" });
  db.upsertTask({ code: "CREATE-FIRST-NOTICE", title: "建立首份告知", description: "建立材料", category: "合规材料" });

  const activity = db.createActivity({ scenarioCode: "B2B_CONTACT", name: "客户和供应商联系" });
  let tasks = db.listTasks();
  assert.equal(tasks.find(item => item.code === "ADD-FIRST-SCENARIO")?.completionMode, "automatic");
  assert.notEqual(tasks.find(item => item.code === `COMPLETE-${activity.id}`)?.status, "completed");

  db.updateActivityFacts(activity.id, {
    ...emptyActivityFacts(),
    dataSubjects: ["客户和供应商联系人"],
    informationTypes: ["姓名和联系方式", "单位和职务"],
    purposes: ["履行项目或合同"],
    collectionChannels: ["本人或所在单位提供"],
    systems: ["企业邮箱", "CRM或ERP"],
    recipients: ["不向外部提供"],
    approximatePersonCount: 480,
    accessRoles: ["业务经办人员", "部门负责人"],
    systemOperators: ["本单位系统管理员", "云服务商"],
    retentionPeriod: "合作结束后三年删除",
    deletionMethod: "每季度由行政负责人核对并删除到期记录",
    rightsChannel: "privacy@example.test",
    automatedDecision: "no",
    sensitiveInformation: "no",
    minorsInvolved: "no",
    crossBorderAccess: "no"
  });
  const document = db.createDocument({
    name: "业务联系人个人信息告知",
    type: "b2b_contact_notice",
    scope: "客户和供应商联系",
    audience: "客户和供应商联系人",
    activityIds: [activity.id],
    content: "这是一份用于验证材料生命周期的完整测试告知内容，包含必要的业务说明。"
  });
  tasks = db.listTasks();
  assert.equal(tasks.find(item => item.code === `COMPLETE-${activity.id}`)?.completionMode, "automatic");
  assert.notEqual(tasks.find(item => item.code === "CREATE-FIRST-NOTICE")?.status, "completed");

  const draft = document.versions![0];
  db.publishDocumentVersion(document.id, draft.id, { publishedBy: "测试负责人", publishChannel: "测试官网" });
  tasks = db.listTasks();
  assert.equal(tasks.find(item => item.code === "CREATE-FIRST-NOTICE")?.completionMode, "automatic");
  assert.equal(tasks.filter(item => item.status !== "completed").length, 0);
});

test("材料草稿可由负责人直接发布且不能跨材料操作", async () => {
  const db = await import("../src/lib/db.ts");
  const activity = db.listActivities()[0];
  const second = db.createDocument({
    name: "第二份测试材料", type: "privacy_notice", scope: "测试范围", audience: "测试人员", activityIds: [activity.id],
    content: "这是第二份用于验证版本归属和发布约束的完整测试材料内容。"
  });
  const secondDraft = second.versions![0];
  const first = db.listDocuments().find(item => item.name === "业务联系人个人信息告知")!;
  assert.throws(() => db.publishDocumentVersion(first.id, secondDraft.id, { publishedBy: "测试人员", publishChannel: "官网" }), /VERSION_NOT_OWNED/);

  db.publishDocumentVersion(second.id, secondDraft.id, { publishedBy: "测试负责人", publishChannel: "官网", publicationEvidence: "测试页面" });
  const published = db.getDocument(second.id)!;
  assert.equal(published.currentVersion?.status, "effective");
  assert.equal(published.currentVersion?.publishedBy, "测试负责人");
  assert.ok(published.currentVersion?.contentHash);
});

test("业务事实变化会提示关联材料复核并支持新版本闭环", async () => {
  const db = await import("../src/lib/db.ts");
  const activity = db.listActivities()[0];
  db.updateActivityFacts(activity.id, { ...activity.facts, retentionPeriod: "合作结束后五年删除" });
  const affected = db.listDocuments().find(item => item.name === "业务联系人个人信息告知")!;
  assert.equal(affected.healthStatus, "needs_review");
  assert.match(affected.reviewReason, /保存期限/);
  assert.ok(affected.pendingImpacts?.[0].affectedSections.includes("保存和删除"));

  const revision = db.createDocumentVersion(affected.id, {
    content: `${affected.currentVersion!.content}\n\n保存期限已根据最新业务情况调整为合作结束后五年。`,
    changeSummary: "更新保存期限", createdBy: "测试经办人"
  });
  assert.equal(db.getDocument(affected.id)?.healthStatus, "updating");
  db.publishDocumentVersion(affected.id, revision.id, { publishedBy: "测试负责人", publishChannel: "官网" });
  const refreshed = db.getDocument(affected.id)!;
  assert.equal(refreshed.healthStatus, "current");
  assert.equal(refreshed.currentVersion?.id, revision.id);
  assert.equal(refreshed.pendingImpacts?.length, 0);

  const pending = db.createDocumentVersion(affected.id, {
    content: `${refreshed.currentVersion!.content}\n\n准备补充新的接收方说明。`, changeSummary: "准备更新接收方", createdBy: "测试经办人"
  });
  db.updateActivityFacts(activity.id, { ...db.getActivity(activity.id)!.facts, recipients: ["某云服务商"] });
  const invalidatedApproval = db.getDocument(affected.id)!;
  assert.equal(invalidatedApproval.versions?.find(item => item.id === pending.id)?.status, "draft");
  assert.equal(invalidatedApproval.healthStatus, "updating");
  assert.match(invalidatedApproval.reviewReason, /外部服务商或接收方/);
});

test("官方自查整改任务会随结论更新自动关闭", async () => {
  const db = await import("../src/lib/db.ts");
  const audit = db.createAuditInstance("测试合规自查");
  let updated = db.saveAuditResponse(audit.id, {
    itemCode: "A02",
    conclusion: "non_compliant",
    explanation: "告知材料尚未覆盖保存期限",
    evidenceNote: "待修订"
  });
  const taskId = updated?.responses?.find(item => item.itemCode === "A02")?.taskId;
  assert.ok(taskId);
  assert.notEqual(db.listTasks().find(item => item.id === taskId)?.status, "completed");

  updated = db.saveAuditResponse(audit.id, {
    itemCode: "A02",
    conclusion: "compliant",
    explanation: "已补充保存期限并完成负责人核对",
    evidenceNote: "业务联系人告知 v0.2"
  });
  const task = db.listTasks().find(item => item.id === taskId);
  assert.equal(updated?.responses?.find(item => item.itemCode === "A02")?.conclusion, "compliant");
  assert.equal(task?.status, "completed");
  assert.equal(task?.completionMode, "automatic");
});

test("影响评估风险消除后自动关闭关联任务", async () => {
  const db = await import("../src/lib/db.ts");
  const activity = db.listActivities()[0];
  const pipia = db.createPipiaInstance(activity.id, ["P01"]);
  assert.ok(pipia);
  let updated = db.savePipiaResponse(pipia!.id, {
    categoryCode: "P01",
    legality: "no",
    impact: "has_impact",
    measureAdequacy: "no",
    notes: "必要性和保护措施尚未确认",
    evidenceNote: ""
  });
  const taskId = updated?.responses?.find(item => item.categoryCode === "P01")?.taskId;
  assert.ok(taskId);
  assert.notEqual(db.listTasks().find(item => item.id === taskId)?.status, "completed");

  updated = db.savePipiaResponse(pipia!.id, {
    categoryCode: "P01",
    legality: "yes",
    impact: "no_impact",
    measureAdequacy: "yes",
    notes: "已确认目的、必要性和保护措施",
    evidenceNote: "影响评估工作底稿"
  });
  const task = db.listTasks().find(item => item.id === taskId);
  assert.equal(updated?.responses?.find(item => item.categoryCode === "P01")?.measureAdequacy, "yes");
  assert.equal(task?.status, "completed");
  assert.equal(task?.completionMode, "automatic");
});

test("历史检查结果和关联待办不会泄露 GDPR 术语或内部枚举", async () => {
  const db = await import("../src/lib/db.ts");
  const activity = db.listActivities()[0];
  const assessment = db.createAssessmentRun(activity, {}, {
    source: "dify",
    status: "needs_input",
    summary: "需要确认 controller 与 processor 的法律角色",
    reviewRequired: false,
    warnings: [],
    findings: [{
      title: "处理角色标识存在冲突",
      description: "企业画像中processingRole为independent_processor，但本场景通常应作为控制者，需确认实际法律角色。",
      riskLevel: "L2"
    }]
  });
  const visible = db.getAssessment(assessment.id)!;
  assert.doesNotMatch(`${visible.summary}${visible.findings[0].title}${visible.findings[0].description}`, /processingRole|independent_processor|控制者|controller|processor/i);

  const task = db.createTaskFromFinding(visible.id, visible.findings[0].id)!;
  assert.doesNotMatch(`${task.title}${task.description}`, /processingRole|independent_processor|控制者|controller|processor/i);
});

test("只有从未发布的材料可以删除，已发布材料拒绝删除", async () => {
  const db = await import("../src/lib/db.ts");
  const activity = db.listActivities()[0];
  const deletable = db.createDocument({
    name: "待删除的纯草稿材料", type: "privacy_notice", scope: "删除测试范围", audience: "测试人员", activityIds: [activity.id],
    content: "这是一份从未发布、用于验证删除能力的完整测试材料内容。"
  });
  const removed = db.deleteDocument(deletable.id);
  assert.equal(removed.id, deletable.id);
  assert.equal(db.getDocument(deletable.id), null);
  assert.throws(() => db.deleteDocument(deletable.id), /DOCUMENT_NOT_FOUND/);

  const published = db.listDocuments().find(item => item.currentVersion)!;
  assert.throws(() => db.deleteDocument(published.id), /DOCUMENT_HAS_PUBLISHED_VERSION/);
  assert.ok(db.getDocument(published.id), "已发布材料应保留");
});

test("首次建档不会误触发已发布材料的复核，后续真实变更才会", async () => {
  const db = await import("../src/lib/db.ts");
  const activity = db.listActivities()[0];
  // 直接验证修复分支：在"尚未完成建档"状态下修改企业信息，不生成 enterprise_change 影响
  const base = db.getEnterprise();
  db.updateEnterprise({ ...base, onboardingCompleted: false });
  const clean = db.createDocument({
    name: "建档影响专用观察材料", type: "privacy_notice", scope: "建档影响测试", audience: "测试人员", activityIds: [activity.id],
    content: "这是一份用于验证首次建档是否误触发复核的完整测试材料内容，发布为当前版本。"
  });
  db.publishDocumentVersion(clean.id, clean.versions![0].id, { publishedBy: "测试负责人", publishChannel: "官网" });
  assert.equal(db.getDocument(clean.id)!.healthStatus, "current");

  // 首次完成建档：字段大量变化，但前态 onboardingCompleted=false，属初始建立，不应生成影响
  db.updateEnterprise({
    ...base, legalName: "首次建档单位有限公司", privacyContactName: "新负责人", privacyContactChannel: "new@example.test",
    sensitiveCategories: ["identity_document"], minorsPossible: "yes", onboardingCompleted: true
  });
  const afterFirst = db.getDocument(clean.id)!;
  assert.equal(afterFirst.healthStatus, "current", "首次建档不应把已发布材料打成 needs_review");
  assert.equal(afterFirst.pendingImpacts?.length ?? 0, 0, "首次建档不应生成 enterprise_change 影响");

  // 之后真实修改企业信息（已完成建档状态下），应正常触发复核
  db.updateEnterprise({ ...db.getEnterprise(), privacyContactChannel: "changed@example.test" });
  const afterChange = db.getDocument(clean.id)!;
  assert.equal(afterChange.healthStatus, "needs_review", "建档完成后的真实变更应触发复核");
  assert.match(afterChange.reviewReason, /联系渠道/);
});
