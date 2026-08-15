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
  db.createDocument({
    name: "业务联系人个人信息告知",
    type: "b2b_contact_notice",
    scope: "客户和供应商联系",
    audience: "客户和供应商联系人",
    activityIds: [activity.id],
    content: "测试告知内容"
  });
  tasks = db.listTasks();
  assert.equal(tasks.find(item => item.code === `COMPLETE-${activity.id}`)?.completionMode, "automatic");
  assert.equal(tasks.find(item => item.code === "CREATE-FIRST-NOTICE")?.completionMode, "automatic");
  assert.equal(tasks.filter(item => item.status !== "completed").length, 0);
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
