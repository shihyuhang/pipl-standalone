import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ActivityFacts, AuditEvent, BusinessDocument, DashboardData, DocumentVersion, EnterpriseProfile, ProcessingActivity, TaskItem } from "./types";
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
  const existing = instance.prepare("SELECT id FROM enterprise LIMIT 1").get();
  if (!existing) instance.prepare("INSERT INTO enterprise (id, updated_at) VALUES (?, ?)").run(randomUUID(), now());
  globalForDb.piplDb = instance;
  return instance;
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

export function upsertTask(input: { code: string; title: string; description: string; priority?: string; category?: string }) {
  const exists = getDb().prepare("SELECT id FROM task WHERE code=? AND status!='completed'").get(input.code);
  if (!exists) getDb().prepare("INSERT INTO task VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL)").run(
    randomUUID(), input.code, input.title, input.description, input.category || "基础档案", input.priority || "normal", now()
  );
}

export function listTasks(): TaskItem[] {
  return (getDb().prepare("SELECT * FROM task ORDER BY CASE priority WHEN 'high' THEN 0 ELSE 1 END, created_at DESC").all() as Record<string, unknown>[]).map(row => ({
    id: String(row.id), code: String(row.code), title: String(row.title), description: String(row.description),
    category: String(row.category), priority: String(row.priority) as TaskItem["priority"], status: String(row.status) as TaskItem["status"],
    createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null
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

export function updateActivityFacts(id: string, input: ActivityFacts): ProcessingActivity | null {
  const current = getActivity(id);
  if (!current) return null;
  const facts = normalizeActivityFacts(input);
  const completeness = activityFactsCompleteness(facts);
  facts.confirmedAt = completeness === 1 ? now() : null;
  getDb().prepare("UPDATE processing_activity SET facts_json=?, completeness=? WHERE id=?")
    .run(JSON.stringify(facts), completeness, id);
  if (completeness === 1) {
    getDb().prepare("UPDATE task SET status='completed', completed_at=? WHERE code=? AND status!='completed'")
      .run(now(), `COMPLETE-${id}`);
  }
  addAuditEvent("activity.facts.updated", completeness === 1 ? `完成业务场景事实确认：${current.name}` : `保存业务场景进度：${current.name}`);
  return getActivity(id);
}

export function createDocument(input: { name: string; type: string; scope: string; content: string; changeSummary?: string }): BusinessDocument {
  const documentId = randomUUID(); const versionId = randomUUID();
  getDb().prepare("INSERT INTO business_document VALUES (?, ?, ?, ?, NULL)").run(documentId, input.name, input.type, input.scope);
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
  return { id: String(row.id), name: String(row.name), type: String(row.type), scope: String(row.scope), currentVersionId: row.current_version_id ? String(row.current_version_id) : null, currentVersion: versions.find(v => v.id === row.current_version_id) || null, versions };
}
export function listDocuments(): BusinessDocument[] {
  return (getDb().prepare("SELECT id FROM business_document ORDER BY name").all() as { id: string }[]).map(row => getDocument(row.id)!).filter(Boolean);
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
