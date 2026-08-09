import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ActivityFacts, AssessmentFinding, AssessmentRun, AuditEvent, BusinessDocument, DashboardData, DocumentMetadata, DocumentVersion, EnterpriseProfile, ProcessingActivity, TaskItem } from "./types";
import { activityFactsCompleteness, emptyActivityFacts, normalizeActivityFacts } from "./activity-facts";

const databasePath = resolve(process.cwd(), process.env.PIPL_DATABASE_PATH || "./data/pipl-mvp.db");
mkdirSync(dirname(databasePath), { recursive: true });

const globalForDb = globalThis as unknown as { piplDb?: DatabaseSync };
const schemaSql = `
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS enterprise (
    id TEXT PRIMARY KEY, legal_name TEXT NOT NULL DEFAULT '', org_type TEXT NOT NULL DEFAULT '',
    business_model TEXT NOT NULL DEFAULT '', ownership TEXT NOT NULL DEFAULT '', processing_role TEXT NOT NULL DEFAULT '',
    person_count INTEGER, count_verified INTEGER NOT NULL DEFAULT 0, subject_categories TEXT NOT NULL DEFAULT '[]',
    sensitive_categories TEXT NOT NULL DEFAULT '[]', minors_possible TEXT NOT NULL DEFAULT 'unknown',
    cross_border TEXT NOT NULL DEFAULT 'unknown', privacy_contact_name TEXT NOT NULL DEFAULT '',
    privacy_contact_role TEXT NOT NULL DEFAULT '', privacy_contact_channel TEXT NOT NULL DEFAULT '',
    qualification_status TEXT NOT NULL DEFAULT 'not_assessed', qualification_summary TEXT NOT NULL DEFAULT '',
    onboarding_completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS processing_activity (
    id TEXT PRIMARY KEY, scenario_code TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft', completeness REAL NOT NULL DEFAULT 0.15,
    facts_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS task (
    id TEXT PRIMARY KEY, code TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '基础档案', priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL, completed_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS task_code_open_idx ON task(code) WHERE status != 'completed';
  CREATE TABLE IF NOT EXISTS business_document (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, scope TEXT NOT NULL DEFAULT '', current_version_id TEXT
  );
  CREATE TABLE IF NOT EXISTS document_version (
    id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES business_document(id), version_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', content TEXT NOT NULL DEFAULT '', change_summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_event (
    id TEXT PRIMARY KEY, action TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assessment_run (
    id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES processing_activity(id), sequence INTEGER NOT NULL,
    source TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL, review_required INTEGER NOT NULL DEFAULT 0,
    warnings_json TEXT NOT NULL DEFAULT '[]', facts_snapshot_json TEXT NOT NULL DEFAULT '{}',
    enterprise_snapshot_json TEXT NOT NULL DEFAULT '{}', workflow_code TEXT NOT NULL DEFAULT 'scenario_triage',
    workflow_version TEXT NOT NULL DEFAULT 'scenario-triage-mvp-v1', remote_run_id TEXT,
    validity TEXT NOT NULL DEFAULT 'current', invalidated_at TEXT, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS assessment_activity_idx ON assessment_run(activity_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS assessment_finding (
    id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL REFERENCES assessment_run(id), title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', risk_level TEXT NOT NULL DEFAULT 'L2', status TEXT NOT NULL DEFAULT 'open',
    task_id TEXT, created_at TEXT NOT NULL
  );
`;

const now = () => new Date().toISOString();
const parseArray = (value: unknown): string[] => {
  try { return JSON.parse(String(value || "[]")); } catch { return []; }
};

function getDb(): DatabaseSync {
  if (globalForDb.piplDb) return globalForDb.piplDb;
  const instance = new DatabaseSync(databasePath);
  instance.exec(schemaSql);
  const activityColumns = instance.prepare("PRAGMA table_info(processing_activity)").all() as { name: string }[];
  if (!activityColumns.some(column => column.name === "facts_json")) {
    instance.exec("ALTER TABLE processing_activity ADD COLUMN facts_json TEXT NOT NULL DEFAULT '{}'");
  }
  ensureColumn(instance, "task", "source_type", "TEXT");
  ensureColumn(instance, "task", "source_id", "TEXT");
  ensureColumn(instance, "task", "activity_id", "TEXT");
  ensureColumn(instance, "business_document", "description", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "business_document", "audience", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "business_document", "activity_ids_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(instance, "business_document", "metadata_json", "TEXT NOT NULL DEFAULT '{}'");
  const existing = instance.prepare("SELECT id FROM enterprise LIMIT 1").get();
  if (!existing) instance.prepare("INSERT INTO enterprise (id, updated_at) VALUES (?, ?)").run(randomUUID(), now());
  globalForDb.piplDb = instance;
  return instance;
}

function ensureColumn(instance: DatabaseSync, table: string, name: string, definition: string) {
  const columns = instance.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some(column => column.name === name)) instance.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

export function getEnterprise(): EnterpriseProfile {
  const row = getDb().prepare("SELECT * FROM enterprise LIMIT 1").get() as Record<string, unknown>;
  return {
    id: String(row.id), legalName: String(row.legal_name), orgType: String(row.org_type),
    businessModel: String(row.business_model) as EnterpriseProfile["businessModel"], ownership: String(row.ownership),
    processingRole: String(row.processing_role), personCount: row.person_count === null ? null : Number(row.person_count),
    countVerified: Boolean(row.count_verified), subjectCategories: parseArray(row.subject_categories),
    sensitiveCategories: parseArray(row.sensitive_categories), minorsPossible: String(row.minors_possible) as EnterpriseProfile["minorsPossible"],
    crossBorder: String(row.cross_border) as EnterpriseProfile["crossBorder"], privacyContactName: String(row.privacy_contact_name),
    privacyContactRole: String(row.privacy_contact_role), privacyContactChannel: String(row.privacy_contact_channel),
    qualificationStatus: String(row.qualification_status) as EnterpriseProfile["qualificationStatus"],
    qualificationSummary: String(row.qualification_summary), onboardingCompleted: Boolean(row.onboarding_completed),
    updatedAt: String(row.updated_at)
  };
}

export function updateEnterprise(profile: Omit<EnterpriseProfile, "id" | "updatedAt">): EnterpriseProfile {
  const current = getEnterprise();
  getDb().prepare(`UPDATE enterprise SET legal_name=?, org_type=?, business_model=?, ownership=?, processing_role=?,
    person_count=?, count_verified=?, subject_categories=?, sensitive_categories=?, minors_possible=?, cross_border=?,
    privacy_contact_name=?, privacy_contact_role=?, privacy_contact_channel=?, qualification_status=?,
    qualification_summary=?, onboarding_completed=?, updated_at=? WHERE id=?`).run(
      profile.legalName, profile.orgType, profile.businessModel, profile.ownership, profile.processingRole,
      profile.personCount, profile.countVerified ? 1 : 0, JSON.stringify(profile.subjectCategories),
      JSON.stringify(profile.sensitiveCategories), profile.minorsPossible, profile.crossBorder,
      profile.privacyContactName, profile.privacyContactRole, profile.privacyContactChannel,
      profile.qualificationStatus, profile.qualificationSummary, profile.onboardingCompleted ? 1 : 0, now(), current.id
    );
  return getEnterprise();
}

export function upsertTask(input: { code: string; title: string; description: string; priority?: string; category?: string; sourceType?: string; sourceId?: string; activityId?: string }) {
  const exists = getDb().prepare("SELECT id FROM task WHERE code=? AND status!='completed'").get(input.code);
  if (!exists) getDb().prepare(`INSERT INTO task
    (id, code, title, description, category, priority, status, created_at, completed_at, source_type, source_id, activity_id)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?, ?)`).run(
    randomUUID(), input.code, input.title, input.description, input.category || "基础档案", input.priority || "normal", now(),
    input.sourceType || null, input.sourceId || null, input.activityId || null
  );
}

export function listTasks(): TaskItem[] {
  return (getDb().prepare("SELECT * FROM task ORDER BY CASE priority WHEN 'high' THEN 0 ELSE 1 END, created_at DESC").all() as Record<string, unknown>[]).map(row => ({
    id: String(row.id), code: String(row.code), title: String(row.title), description: String(row.description),
    category: String(row.category), priority: String(row.priority) as TaskItem["priority"], status: String(row.status) as TaskItem["status"],
    createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null,
    sourceType: row.source_type ? String(row.source_type) : null,
    sourceId: row.source_id ? String(row.source_id) : null,
    activityId: row.activity_id ? String(row.activity_id) : null
  }));
}

export function updateTaskStatus(id: string, status: TaskItem["status"]) {
  getDb().prepare("UPDATE task SET status=?, completed_at=? WHERE id=?").run(status, status === "completed" ? now() : null, id);
  addAuditEvent("task.updated", status === "completed" ? "完成一项合规待办" : "更新一项合规待办");
}

export function createActivity(input: { scenarioCode: string; name: string; description?: string }): ProcessingActivity {
  const item = { id: randomUUID(), scenarioCode: input.scenarioCode, name: input.name, description: input.description || "", status: "draft" as const, completeness: 0.15, facts: emptyActivityFacts(), createdAt: now() };
  getDb().prepare("INSERT INTO processing_activity (id, scenario_code, name, description, status, completeness, facts_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(item.id, item.scenarioCode, item.name, item.description, item.status, item.completeness, JSON.stringify(item.facts), item.createdAt);
  upsertTask({ code: `COMPLETE-${item.id}`, title: `完善“${item.name}”业务情况`, description: "确认涉及人员、信息字段、使用系统、保存期限和权利渠道。", category: "我的业务" });
  addAuditEvent("activity.created", `新增业务场景：${item.name}`);
  return item;
}

export function listActivities(): ProcessingActivity[] {
  return (getDb().prepare("SELECT * FROM processing_activity ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(mapActivity);
}

function mapActivity(row: Record<string, unknown>): ProcessingActivity {
  let rawFacts: unknown = {};
  try { rawFacts = JSON.parse(String(row.facts_json || "{}")); } catch { rawFacts = {}; }
  return {
    id: String(row.id), scenarioCode: String(row.scenario_code), name: String(row.name), description: String(row.description),
    status: String(row.status) as ProcessingActivity["status"], completeness: Number(row.completeness),
    facts: normalizeActivityFacts(rawFacts), createdAt: String(row.created_at)
  };
}

export function getActivity(id: string): ProcessingActivity | null {
  const row = getDb().prepare("SELECT * FROM processing_activity WHERE id=?").get(id) as Record<string, unknown> | undefined;
  return row ? mapActivity(row) : null;
}

export function deleteActivity(id: string): { deleted: boolean; message: string } {
  const activity = getActivity(id);
  if (!activity) return { deleted: false, message: "未找到该业务。" };

  const assessmentCount = Number((getDb().prepare("SELECT COUNT(*) AS value FROM assessment_run WHERE activity_id=?").get(id) as { value: number }).value);
  const linkedDocuments = (getDb().prepare("SELECT name, activity_ids_json FROM business_document").all() as Record<string, unknown>[])
    .filter(row => {
      try { return (JSON.parse(String(row.activity_ids_json || "[]")) as string[]).includes(id); } catch { return false; }
    })
    .map(row => String(row.name));

  if (assessmentCount > 0 || linkedDocuments.length > 0) {
    const reasons = [
      assessmentCount > 0 ? `${assessmentCount} 次初步检查记录` : "",
      linkedDocuments.length > 0 ? `${linkedDocuments.length} 份合规材料（${linkedDocuments.join("、")}）` : ""
    ].filter(Boolean).join("和");
    return { deleted: false, message: `这项业务已关联${reasons}，为保留合规记录，暂不能直接删除。` };
  }

  getDb().exec("BEGIN");
  try {
    getDb().prepare("DELETE FROM task WHERE activity_id=? OR code=?").run(id, `COMPLETE-${id}`);
    getDb().prepare("DELETE FROM processing_activity WHERE id=?").run(id);
    getDb().exec("COMMIT");
  } catch (error) { getDb().exec("ROLLBACK"); throw error; }
  addAuditEvent("activity.deleted", `删除未被引用的业务场景：${activity.name}`);
  return { deleted: true, message: "业务已删除。" };
}

export function updateActivityFacts(id: string, input: ActivityFacts): ProcessingActivity | null {
  const current = getActivity(id);
  if (!current) return null;
  const facts = normalizeActivityFacts(input);
  const completeness = activityFactsCompleteness(facts);
  const withoutConfirmation = (value: ActivityFacts) => ({ ...value, confirmedAt: null });
  const changed = JSON.stringify(withoutConfirmation(current.facts)) !== JSON.stringify(withoutConfirmation(facts));
  facts.confirmedAt = completeness === 1 ? (changed ? now() : current.facts.confirmedAt || now()) : null;
  getDb().prepare("UPDATE processing_activity SET facts_json=?, completeness=? WHERE id=?")
    .run(JSON.stringify(facts), completeness, id);
  if (changed) getDb().prepare("UPDATE assessment_run SET validity='outdated', invalidated_at=? WHERE activity_id=? AND validity='current'")
    .run(now(), id);
  if (completeness === 1) {
    getDb().prepare("UPDATE task SET status='completed', completed_at=? WHERE code=? AND status!='completed'")
      .run(now(), `COMPLETE-${id}`);
  }
  if (changed) addAuditEvent("activity.facts.updated", completeness === 1 ? `完成业务场景事实确认：${current.name}` : `保存业务场景进度：${current.name}`);
  return getActivity(id);
}

export function createDocument(input: { name: string; type: string; scope: string; description?: string; audience?: string; activityIds?: string[]; metadata?: DocumentMetadata; content: string; changeSummary?: string }): BusinessDocument {
  const documentId = randomUUID(); const versionId = randomUUID();
  getDb().prepare(`INSERT INTO business_document
    (id, name, type, scope, current_version_id, description, audience, activity_ids_json, metadata_json)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`)
    .run(documentId, input.name, input.type, input.scope, input.description || "", input.audience || "", JSON.stringify(input.activityIds || []), JSON.stringify(input.metadata || {}));
  getDb().prepare("INSERT INTO document_version VALUES (?, ?, 'v0.1', 'draft', ?, ?, ?, NULL)").run(versionId, documentId, input.content, input.changeSummary || "建立首个草稿", now());
  addAuditEvent("document.created", `创建文档草稿：${input.name}`);
  return getDocument(documentId)!;
}

export function createDocumentVersion(documentId: string, input: { content: string; changeSummary: string }): DocumentVersion {
  const versions = getDocument(documentId)?.versions || [];
  const next = `v0.${versions.length + 1}`; const id = randomUUID();
  getDb().prepare("INSERT INTO document_version VALUES (?, ?, ?, 'draft', ?, ?, ?, NULL)").run(id, documentId, next, input.content, input.changeSummary, now());
  addAuditEvent("document.version.created", `创建隐私声明版本 ${next}`);
  return getVersion(id)!;
}

export function publishDocumentVersion(documentId: string, versionId: string) {
  getDb().exec("BEGIN");
  try {
    getDb().prepare("UPDATE document_version SET status='superseded' WHERE document_id=? AND status='effective'").run(documentId);
    getDb().prepare("UPDATE document_version SET status='effective', published_at=? WHERE id=? AND document_id=?").run(now(), versionId, documentId);
    getDb().prepare("UPDATE business_document SET current_version_id=? WHERE id=?").run(versionId, documentId);
    getDb().exec("COMMIT");
    addAuditEvent("document.published", "发布新的隐私声明版本");
  } catch (error) { getDb().exec("ROLLBACK"); throw error; }
}

function getVersion(id: string): DocumentVersion | null {
  const row = getDb().prepare("SELECT * FROM document_version WHERE id=?").get(id) as Record<string, unknown> | undefined;
  return row ? mapVersion(row) : null;
}
function mapVersion(row: Record<string, unknown>): DocumentVersion {
  return { id: String(row.id), documentId: String(row.document_id), versionNumber: String(row.version_number), status: String(row.status) as DocumentVersion["status"], content: String(row.content), changeSummary: String(row.change_summary), createdAt: String(row.created_at), publishedAt: row.published_at ? String(row.published_at) : null };
}
export function getDocument(id: string): BusinessDocument | null {
  const row = getDb().prepare("SELECT * FROM business_document WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const versions = (getDb().prepare("SELECT * FROM document_version WHERE document_id=? ORDER BY created_at DESC").all(id) as Record<string, unknown>[]).map(mapVersion);
  let activityIds: string[] = []; let metadata = {} as DocumentMetadata;
  try { activityIds = JSON.parse(String(row.activity_ids_json || "[]")); } catch { activityIds = []; }
  try { metadata = JSON.parse(String(row.metadata_json || "{}")); } catch { metadata = {} as DocumentMetadata; }
  return {
    id: String(row.id), name: String(row.name), type: String(row.type), scope: String(row.scope),
    description: String(row.description || ""), audience: String(row.audience || ""), activityIds, metadata,
    currentVersionId: row.current_version_id ? String(row.current_version_id) : null,
    currentVersion: versions.find(v => v.id === row.current_version_id) || null, versions
  };
}
export function listDocuments(): BusinessDocument[] {
  return (getDb().prepare("SELECT id FROM business_document ORDER BY name").all() as { id: string }[]).map(row => getDocument(row.id)!).filter(Boolean);
}

type AssessmentInput = {
  source: AssessmentRun["source"];
  status: AssessmentRun["status"];
  summary: string;
  reviewRequired: boolean;
  warnings: string[];
  findings: Array<{ title: string; description: string; riskLevel: AssessmentFinding["riskLevel"] }>;
  remoteRunId?: string | null;
};

export function createAssessmentRun(activity: ProcessingActivity, enterpriseSnapshot: Record<string, unknown>, result: AssessmentInput): AssessmentRun {
  const db = getDb(); const id = randomUUID(); const createdAt = now();
  const sequenceRow = db.prepare("SELECT COALESCE(MAX(sequence), 0) AS value FROM assessment_run WHERE activity_id=?").get(activity.id) as { value: number };
  const sequence = Number(sequenceRow.value) + 1;
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE assessment_run SET validity='outdated', invalidated_at=? WHERE activity_id=? AND validity='current'").run(createdAt, activity.id);
    db.prepare(`INSERT INTO assessment_run
      (id, activity_id, sequence, source, status, summary, review_required, warnings_json, facts_snapshot_json,
       enterprise_snapshot_json, workflow_code, workflow_version, remote_run_id, validity, invalidated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scenario_triage', 'scenario-triage-mvp-v1', ?, 'current', NULL, ?)`)
      .run(id, activity.id, sequence, result.source, result.status, result.summary, result.reviewRequired ? 1 : 0,
        JSON.stringify(result.warnings), JSON.stringify(activity.facts), JSON.stringify(enterpriseSnapshot), result.remoteRunId || null, createdAt);
    const statement = db.prepare(`INSERT INTO assessment_finding
      (id, assessment_id, title, description, risk_level, status, task_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'open', NULL, ?)`);
    for (const finding of result.findings) statement.run(randomUUID(), id, finding.title, finding.description, finding.riskLevel, createdAt);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  addAuditEvent("assessment.created", `完成“${activity.name}”第 ${sequence} 次初步检查`);
  return getAssessment(id)!;
}

function mapFinding(row: Record<string, unknown>): AssessmentFinding {
  return {
    id: String(row.id), assessmentId: String(row.assessment_id), title: String(row.title), description: String(row.description),
    riskLevel: String(row.risk_level) as AssessmentFinding["riskLevel"], status: String(row.status) as AssessmentFinding["status"],
    taskId: row.task_id ? String(row.task_id) : null, createdAt: String(row.created_at)
  };
}

function mapAssessment(row: Record<string, unknown>): AssessmentRun {
  const parseObject = (value: unknown) => { try { return JSON.parse(String(value || "{}")); } catch { return {}; } };
  const parseList = (value: unknown) => { try { return JSON.parse(String(value || "[]")); } catch { return []; } };
  const findings = (getDb().prepare("SELECT * FROM assessment_finding WHERE assessment_id=? ORDER BY created_at, id").all(String(row.id)) as Record<string, unknown>[]).map(mapFinding);
  return {
    id: String(row.id), activityId: String(row.activity_id), activityName: String(row.activity_name || "业务场景"), sequence: Number(row.sequence),
    source: String(row.source) as AssessmentRun["source"], status: String(row.status) as AssessmentRun["status"], summary: String(row.summary),
    reviewRequired: Boolean(row.review_required), warnings: parseList(row.warnings_json), factsSnapshot: normalizeActivityFacts(parseObject(row.facts_snapshot_json)),
    enterpriseSnapshot: parseObject(row.enterprise_snapshot_json), workflowCode: String(row.workflow_code), workflowVersion: String(row.workflow_version),
    remoteRunId: row.remote_run_id ? String(row.remote_run_id) : null, validity: String(row.validity) as AssessmentRun["validity"],
    invalidatedAt: row.invalidated_at ? String(row.invalidated_at) : null, createdAt: String(row.created_at), findings
  };
}

export function getAssessment(id: string): AssessmentRun | null {
  const row = getDb().prepare(`SELECT ar.*, pa.name AS activity_name FROM assessment_run ar
    JOIN processing_activity pa ON pa.id=ar.activity_id WHERE ar.id=?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapAssessment(row) : null;
}

export function listAssessments(activityId?: string): AssessmentRun[] {
  const rows = (activityId
    ? getDb().prepare(`SELECT ar.*, pa.name AS activity_name FROM assessment_run ar JOIN processing_activity pa ON pa.id=ar.activity_id WHERE ar.activity_id=? ORDER BY ar.created_at DESC`).all(activityId)
    : getDb().prepare(`SELECT ar.*, pa.name AS activity_name FROM assessment_run ar JOIN processing_activity pa ON pa.id=ar.activity_id ORDER BY ar.created_at DESC`).all()) as Record<string, unknown>[];
  return rows.map(mapAssessment);
}

export function createTaskFromFinding(assessmentId: string, findingId: string): TaskItem | null {
  const finding = getDb().prepare("SELECT * FROM assessment_finding WHERE id=? AND assessment_id=?").get(findingId, assessmentId) as Record<string, unknown> | undefined;
  if (!finding) return null;
  if (finding.task_id) return listTasks().find(item => item.id === finding.task_id) || null;
  const assessment = getAssessment(assessmentId);
  if (!assessment) return null;
  const taskId = randomUUID();
  getDb().prepare(`INSERT INTO task
    (id, code, title, description, category, priority, status, created_at, completed_at, source_type, source_id, activity_id)
    VALUES (?, ?, ?, ?, '初步检查', ?, 'open', ?, NULL, 'assessment_finding', ?, ?)`)
    .run(taskId, `FINDING-${findingId}`, String(finding.title), String(finding.description), String(finding.risk_level) === "L3" ? "high" : "normal", now(), findingId, assessment.activityId);
  getDb().prepare("UPDATE assessment_finding SET status='task_created', task_id=? WHERE id=?").run(taskId, findingId);
  addAuditEvent("assessment.finding.task_created", `将检查发现转为待办：${String(finding.title)}`);
  return listTasks().find(item => item.id === taskId) || null;
}

export function addAuditEvent(action: string, summary: string) {
  getDb().prepare("INSERT INTO audit_event VALUES (?, ?, ?, ?)").run(randomUUID(), action, summary, now());
}
export function listAuditEvents(): AuditEvent[] {
  return (getDb().prepare("SELECT * FROM audit_event ORDER BY created_at DESC LIMIT 30").all() as Record<string, unknown>[]).map(row => ({ id: String(row.id), action: String(row.action), summary: String(row.summary), createdAt: String(row.created_at) }));
}

export function getDashboard(): DashboardData {
  const tasks = listTasks(); const activities = listActivities(); const documents = listDocuments();
  return { enterprise: getEnterprise(), counts: { activities: activities.length, openTasks: tasks.filter(t => t.status !== "completed").length, completedTasks: tasks.filter(t => t.status === "completed").length, documents: documents.length }, tasks, activities, documents, recentEvents: listAuditEvents() };
}
