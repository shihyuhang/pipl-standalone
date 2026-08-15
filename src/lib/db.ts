import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ActivityFacts, AssessmentFinding, AssessmentRun, AuditConclusion, AuditInstance, AuditResponse, AuditEvent, BusinessDocument, DashboardData, DocumentMetadata, DocumentVersion, EnterpriseProfile, FormStatus, ImpactAnswer, PipiaCategoryCode, PipiaInstance, PipiaResponse, ProcessingActivity, TaskItem, YesNoNA } from "./types";
import { activityFactsCompleteness, emptyActivityFacts, normalizeActivityFacts } from "./activity-facts.ts";
import { auditItems, buildAuditSignals } from "./audit-template.ts";
import { buildSystemTaskRules } from "./task-rules.ts";
import { normalizeChinaLegalText, normalizeTriageFinding } from "./legal-language.ts";

const databasePath = resolve(process.cwd(), process.env.PIPL_DATABASE_PATH || "./data/pipl-mvp.db");
mkdirSync(dirname(databasePath), { recursive: true });

const globalForDb = globalThis as unknown as { piplDb?: DatabaseSync };
const schemaSql = `
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS enterprise (
    id TEXT PRIMARY KEY, legal_name TEXT NOT NULL DEFAULT '', org_type TEXT NOT NULL DEFAULT '',
    industry TEXT NOT NULL DEFAULT '', business_model TEXT NOT NULL DEFAULT '', ownership TEXT NOT NULL DEFAULT '', processing_role TEXT NOT NULL DEFAULT '',
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
  CREATE TABLE IF NOT EXISTS audit_instance (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    template_version TEXT NOT NULL DEFAULT 'official-v1', responsible_name TEXT NOT NULL DEFAULT '',
    responsible_role TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    signed_at TEXT, signed_content_hash TEXT, context_snapshot_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS audit_response (
    id TEXT PRIMARY KEY, instance_id TEXT NOT NULL REFERENCES audit_instance(id), item_code TEXT NOT NULL,
    conclusion TEXT NOT NULL DEFAULT 'unanswered', explanation TEXT NOT NULL DEFAULT '',
    evidence_note TEXT NOT NULL DEFAULT '', task_id TEXT, updated_at TEXT NOT NULL,
    UNIQUE(instance_id, item_code)
  );
  CREATE TABLE IF NOT EXISTS pipia_instance (
    id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES processing_activity(id), status TEXT NOT NULL DEFAULT 'draft',
    category_codes_json TEXT NOT NULL DEFAULT '[]', responsible_name TEXT NOT NULL DEFAULT '',
    responsible_role TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    signed_at TEXT, signed_content_hash TEXT, context_snapshot_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS pipia_response (
    id TEXT PRIMARY KEY, instance_id TEXT NOT NULL REFERENCES pipia_instance(id), category_code TEXT NOT NULL,
    legality TEXT NOT NULL DEFAULT 'unanswered', impact TEXT NOT NULL DEFAULT 'unanswered',
    measure_adequacy TEXT NOT NULL DEFAULT 'unanswered', notes TEXT NOT NULL DEFAULT '',
    evidence_note TEXT NOT NULL DEFAULT '', task_id TEXT, updated_at TEXT NOT NULL,
    UNIQUE(instance_id, category_code)
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
  ensureColumn(instance, "enterprise", "industry", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "task", "source_id", "TEXT");
  ensureColumn(instance, "task", "activity_id", "TEXT");
  ensureColumn(instance, "task", "handling_note", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "task", "evidence_note", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "task", "responsible_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "task", "started_at", "TEXT");
  ensureColumn(instance, "task", "completion_mode", "TEXT NOT NULL DEFAULT 'manual'");
  ensureColumn(instance, "task", "completion_basis", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "business_document", "description", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "business_document", "audience", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(instance, "business_document", "activity_ids_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(instance, "business_document", "metadata_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(instance, "audit_instance", "context_snapshot_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(instance, "pipia_instance", "context_snapshot_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(instance, "pipia_response", "task_id", "TEXT");
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
    id: String(row.id), legalName: String(row.legal_name), orgType: String(row.org_type), industry: String(row.industry || ""),
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
  getDb().prepare(`UPDATE enterprise SET legal_name=?, org_type=?, industry=?, business_model=?, ownership=?, processing_role=?,
    person_count=?, count_verified=?, subject_categories=?, sensitive_categories=?, minors_possible=?, cross_border=?,
    privacy_contact_name=?, privacy_contact_role=?, privacy_contact_channel=?, qualification_status=?,
    qualification_summary=?, onboarding_completed=?, updated_at=? WHERE id=?`).run(
      profile.legalName, profile.orgType, profile.industry, profile.businessModel, profile.ownership, profile.processingRole,
      profile.personCount, profile.countVerified ? 1 : 0, JSON.stringify(profile.subjectCategories),
      JSON.stringify(profile.sensitiveCategories), profile.minorsPossible, profile.crossBorder,
      profile.privacyContactName, profile.privacyContactRole, profile.privacyContactChannel,
      profile.qualificationStatus, profile.qualificationSummary, profile.onboardingCompleted ? 1 : 0, now(), current.id
    );
  return getEnterprise();
}

export function upsertTask(input: { code: string; title: string; description: string; priority?: string; category?: string; sourceType?: string; sourceId?: string; activityId?: string }) {
  const exists = getDb().prepare("SELECT id FROM task WHERE code=? AND status!='completed'").get(input.code) as { id: string } | undefined;
  if (exists) getDb().prepare(`UPDATE task SET title=?, description=?, category=?, priority=?, source_type=COALESCE(?, source_type),
    source_id=COALESCE(?, source_id), activity_id=COALESCE(?, activity_id) WHERE id=?`).run(
      input.title, input.description, input.category || "基础档案", input.priority || "normal",
      input.sourceType || null, input.sourceId || null, input.activityId || null, exists.id
    );
  else getDb().prepare(`INSERT INTO task
    (id, code, title, description, category, priority, status, created_at, completed_at, source_type, source_id, activity_id)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?, ?)`).run(
    randomUUID(), input.code, input.title, input.description, input.category || "基础档案", input.priority || "normal", now(),
    input.sourceType || null, input.sourceId || null, input.activityId || null
  );
}

function reconcileSystemTasks() {
  const db = getDb();
  const enterprise = getEnterprise();
  const activities = (db.prepare("SELECT * FROM processing_activity").all() as Record<string, unknown>[]).map(row => {
    const activity = mapActivity(row);
    return { id: activity.id, name: activity.name, completeness: activity.completeness };
  });
  const externalNoticeCount = Number((db.prepare("SELECT COUNT(*) AS value FROM business_document WHERE type IN ('privacy_notice','b2b_contact_notice','employee_notice')").get() as { value: number }).value);
  const rules = buildSystemTaskRules({
    onboardingCompleted: enterprise.onboardingCompleted, personCount: enterprise.personCount, countVerified: enterprise.countVerified,
    processingRole: enterprise.processingRole, sensitiveCategories: enterprise.sensitiveCategories, minorsPossible: enterprise.minorsPossible,
    crossBorder: enterprise.crossBorder, activityCount: activities.length, externalNoticeCount, activities
  });
  const timestamp = now();
  for (const rule of rules) {
    const open = db.prepare("SELECT id FROM task WHERE code=? AND status!='completed' ORDER BY created_at DESC LIMIT 1").get(rule.code) as { id: string } | undefined;
    if (rule.satisfied && open) {
      db.prepare(`UPDATE task SET status='completed', completed_at=?, started_at=COALESCE(started_at, ?),
        handling_note=?, evidence_note=?, responsible_name='系统自动核验', completion_mode='automatic', completion_basis=? WHERE id=?`)
        .run(timestamp, timestamp, rule.completionBasis, rule.evidenceNote, rule.completionBasis, open.id);
      db.prepare("INSERT INTO audit_event VALUES (?, 'task.auto_completed', ?, ?)").run(randomUUID(), `系统自动完成办理事项：${rule.title}`, timestamp);
    } else if (!rule.satisfied && rule.createWhenUnsatisfied) {
      upsertTask({ code: rule.code, title: rule.title, description: rule.description, category: rule.category, priority: rule.priority, activityId: rule.activityId });
    }
  }

  const oldFindingTasks = db.prepare(`SELECT t.id AS task_id, t.title, af.id AS finding_id, ar.activity_id
    FROM task t JOIN assessment_finding af ON af.id=t.source_id JOIN assessment_run ar ON ar.id=af.assessment_id
    WHERE t.source_type='assessment_finding' AND t.status!='completed' AND ar.validity='outdated'`).all() as Record<string, unknown>[];
  for (const item of oldFindingTasks) {
    const latest = db.prepare("SELECT id FROM assessment_run WHERE activity_id=? AND validity='current' ORDER BY created_at DESC LIMIT 1").get(String(item.activity_id)) as { id: string } | undefined;
    if (!latest) continue;
    const repeated = db.prepare("SELECT id FROM assessment_finding WHERE assessment_id=? AND title=? LIMIT 1").get(latest.id, String(item.title));
    if (!repeated) {
      const basis = "业务更新后已重新完成初步检查，新的检查结果未再出现同一事项。";
      db.prepare(`UPDATE task SET status='completed', completed_at=?, started_at=COALESCE(started_at, ?), handling_note=?,
        evidence_note='系统记录：最新业务初步检查', responsible_name='系统自动核验', completion_mode='automatic', completion_basis=? WHERE id=?`)
        .run(timestamp, timestamp, basis, basis, String(item.task_id));
      db.prepare("UPDATE assessment_finding SET status='resolved' WHERE id=?").run(String(item.finding_id));
      db.prepare("INSERT INTO audit_event VALUES (?, 'task.auto_completed', ?, ?)").run(randomUUID(), `系统根据最新检查关闭旧事项：${String(item.title)}`, timestamp);
    }
  }
}

export function listTasks(): TaskItem[] {
  reconcileSystemTasks();
  return (getDb().prepare("SELECT * FROM task ORDER BY CASE priority WHEN 'high' THEN 0 ELSE 1 END, created_at DESC").all() as Record<string, unknown>[]).map(row => {
    const normalized = row.source_type === "assessment_finding"
      ? normalizeTriageFinding(row.title, row.description)
      : { title: String(row.title), description: String(row.description) };
    return {
    id: String(row.id), code: String(row.code), title: normalized.title, description: normalized.description,
    category: String(row.category), priority: String(row.priority) as TaskItem["priority"], status: String(row.status) as TaskItem["status"],
    createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null,
    sourceType: row.source_type ? String(row.source_type) : null,
    sourceId: row.source_id ? String(row.source_id) : null,
    activityId: row.activity_id ? String(row.activity_id) : null,
    handlingNote: String(row.handling_note || ""), evidenceNote: String(row.evidence_note || ""),
    responsibleName: String(row.responsible_name || ""), startedAt: row.started_at ? String(row.started_at) : null,
    completionMode: String(row.completion_mode || "manual") as TaskItem["completionMode"], completionBasis: String(row.completion_basis || "")
  }; });
}

export function updateTask(id: string, input: {
  status: TaskItem["status"];
  handlingNote?: string;
  evidenceNote?: string;
  responsibleName?: string;
}) {
  const current = getDb().prepare("SELECT * FROM task WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!current) return null;
  const handlingNote = String(input.handlingNote ?? current.handling_note ?? "").trim();
  const evidenceNote = String(input.evidenceNote ?? current.evidence_note ?? "").trim();
  const responsibleName = String(input.responsibleName ?? current.responsible_name ?? "").trim();
  const timestamp = now();
  const existingStartedAt = current.started_at ? String(current.started_at) : null;
  getDb().prepare(`UPDATE task SET status=?, handling_note=?, evidence_note=?, responsible_name=?,
    started_at=?, completed_at=?, completion_mode='manual', completion_basis='' WHERE id=?`).run(
      input.status, handlingNote, evidenceNote, responsibleName,
      input.status === "open" ? existingStartedAt : existingStartedAt || timestamp,
      input.status === "completed" ? timestamp : null, id
    );
  addAuditEvent("task.updated", input.status === "completed" ? `完成办理事项：${String(current.title)}` : `更新办理事项：${String(current.title)}`);
  return listTasks().find(item => item.id === id) || null;
}

export function createActivity(input: { scenarioCode: string; name: string; description?: string }): ProcessingActivity {
  const initialFacts = emptyActivityFacts();
  initialFacts.rightsChannel = getEnterprise().privacyContactChannel;
  const item = { id: randomUUID(), scenarioCode: input.scenarioCode, name: input.name, description: input.description || "", status: "draft" as const, completeness: 0.15, facts: initialFacts, createdAt: now() };
  getDb().prepare("INSERT INTO processing_activity (id, scenario_code, name, description, status, completeness, facts_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(item.id, item.scenarioCode, item.name, item.description, item.status, item.completeness, JSON.stringify(item.facts), item.createdAt);
  upsertTask({ code: `COMPLETE-${item.id}`, title: `完善“${item.name}”业务情况`, description: "确认涉及人员、信息字段、访问岗位、删除方式和个人权利渠道。", category: "我的业务" });
  addAuditEvent("activity.created", `新增业务场景：${item.name}`);
  return item;
}

export function listActivities(): ProcessingActivity[] {
  return (getDb().prepare("SELECT * FROM processing_activity ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(mapActivity);
}

function mapActivity(row: Record<string, unknown>): ProcessingActivity {
  let rawFacts: unknown = {};
  try { rawFacts = JSON.parse(String(row.facts_json || "{}")); } catch { rawFacts = {}; }
  const facts = normalizeActivityFacts(rawFacts);
  return {
    id: String(row.id), scenarioCode: String(row.scenario_code), name: String(row.name), description: String(row.description),
    status: String(row.status) as ProcessingActivity["status"], completeness: activityFactsCompleteness(facts),
    facts, createdAt: String(row.created_at)
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
  const pipiaCount = Number((getDb().prepare("SELECT COUNT(*) AS value FROM pipia_instance WHERE activity_id=?").get(id) as { value: number }).value);
  const linkedDocuments = (getDb().prepare("SELECT name, activity_ids_json FROM business_document").all() as Record<string, unknown>[])
    .filter(row => {
      try { return (JSON.parse(String(row.activity_ids_json || "[]")) as string[]).includes(id); } catch { return false; }
    })
    .map(row => String(row.name));

  if (assessmentCount > 0 || pipiaCount > 0 || linkedDocuments.length > 0) {
    const reasons = [
      assessmentCount > 0 ? `${assessmentCount} 次初步检查记录` : "",
      pipiaCount > 0 ? `${pipiaCount} 份影响评估` : "",
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
    const timestamp = now();
    const completionBasis = `“${current.name}”的必要业务信息已经全部确认。`;
    getDb().prepare(`UPDATE task SET status='completed', completed_at=?, started_at=COALESCE(started_at, ?),
      handling_note=?, evidence_note='系统记录：业务场景事实档案', responsible_name='系统自动核验',
      completion_mode='automatic', completion_basis=? WHERE code=? AND status!='completed'`)
      .run(timestamp, timestamp, completionBasis, completionBasis, `COMPLETE-${id}`);
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
  workflowVersion?: string;
};

export function createAssessmentRun(activity: ProcessingActivity, enterpriseSnapshot: Record<string, unknown>, result: AssessmentInput): AssessmentRun {
  const db = getDb(); const id = randomUUID(); const createdAt = now();
  const normalizedSummary = normalizeChinaLegalText(result.summary);
  const normalizedWarnings = result.warnings.map(normalizeChinaLegalText);
  const normalizedFindings = result.findings.map(finding => ({ ...finding, ...normalizeTriageFinding(finding.title, finding.description) }));
  const sequenceRow = db.prepare("SELECT COALESCE(MAX(sequence), 0) AS value FROM assessment_run WHERE activity_id=?").get(activity.id) as { value: number };
  const sequence = Number(sequenceRow.value) + 1;
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE assessment_run SET validity='outdated', invalidated_at=? WHERE activity_id=? AND validity='current'").run(createdAt, activity.id);
    db.prepare(`INSERT INTO assessment_run
      (id, activity_id, sequence, source, status, summary, review_required, warnings_json, facts_snapshot_json,
       enterprise_snapshot_json, workflow_code, workflow_version, remote_run_id, validity, invalidated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scenario_triage', ?, ?, 'current', NULL, ?)`)
      .run(id, activity.id, sequence, result.source, result.status, normalizedSummary, result.reviewRequired ? 1 : 0,
        JSON.stringify(normalizedWarnings), JSON.stringify(activity.facts), JSON.stringify(enterpriseSnapshot),
        result.workflowVersion || `scenario-triage-${result.source}-v1`, result.remoteRunId || null, createdAt);
    const statement = db.prepare(`INSERT INTO assessment_finding
      (id, assessment_id, title, description, risk_level, status, task_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'open', NULL, ?)`);
    for (const finding of normalizedFindings) statement.run(randomUUID(), id, finding.title, finding.description, finding.riskLevel, createdAt);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  addAuditEvent("assessment.created", `完成“${activity.name}”第 ${sequence} 次初步检查`);
  return getAssessment(id)!;
}

function mapFinding(row: Record<string, unknown>): AssessmentFinding {
  const normalized = normalizeTriageFinding(row.title, row.description);
  return {
    id: String(row.id), assessmentId: String(row.assessment_id), title: normalized.title, description: normalized.description,
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
    source: String(row.source) as AssessmentRun["source"], status: String(row.status) as AssessmentRun["status"], summary: normalizeChinaLegalText(row.summary),
    reviewRequired: Boolean(row.review_required), warnings: parseList(row.warnings_json).map(normalizeChinaLegalText), factsSnapshot: normalizeActivityFacts(parseObject(row.facts_snapshot_json)),
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
  const normalized = normalizeTriageFinding(finding.title, finding.description);
  getDb().prepare(`INSERT INTO task
    (id, code, title, description, category, priority, status, created_at, completed_at, source_type, source_id, activity_id)
    VALUES (?, ?, ?, ?, '初步检查', ?, 'open', ?, NULL, 'assessment_finding', ?, ?)`)
    .run(taskId, `FINDING-${findingId}`, normalized.title, normalized.description, String(finding.risk_level) === "L3" ? "high" : "normal", now(), findingId, assessment.activityId);
  getDb().prepare("UPDATE assessment_finding SET status='task_created', task_id=? WHERE id=?").run(taskId, findingId);
  addAuditEvent("assessment.finding.task_created", `将检查发现转为待办：${normalized.title}`);
  return listTasks().find(item => item.id === taskId) || null;
}

function auditContext() {
  return {
    enterprise: getEnterprise(), activities: listActivities(), documents: listDocuments(), tasks: listTasks(),
    assessments: listAssessments(), pipias: listPipiaInstances()
  };
}

function auditValidation(responses: AuditResponse[]) {
  const errors: string[] = [];
  for (const response of responses) {
    if (response.conclusion === "unanswered") errors.push(`${response.definition.number}. ${response.definition.title}尚未确认`);
    if (["non_compliant", "not_applicable"].includes(response.conclusion) && response.explanation.trim().length < 2) {
      errors.push(`${response.definition.number}. ${response.definition.title}需要填写${response.conclusion === "not_applicable" ? "不适用理由" : "问题及整改说明"}`);
    }
  }
  return errors;
}

function parseObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function mapAuditInstance(row: Record<string, unknown>, includeResponses = false): AuditInstance {
  const rawResponses = (getDb().prepare("SELECT * FROM audit_response WHERE instance_id=? ORDER BY item_code").all(String(row.id)) as Record<string, unknown>[]);
  const context = includeResponses ? auditContext() : null;
  const responses = rawResponses.map(raw => {
    const definition = auditItems.find(item => item.code === String(raw.item_code))!;
    return {
      id: String(raw.id), instanceId: String(raw.instance_id), itemCode: String(raw.item_code),
      conclusion: String(raw.conclusion) as AuditConclusion, explanation: String(raw.explanation), evidenceNote: String(raw.evidence_note),
      taskId: raw.task_id ? String(raw.task_id) : null, updatedAt: String(raw.updated_at), definition,
      signals: context ? buildAuditSignals(String(raw.item_code), context) : []
    } satisfies AuditResponse;
  });
  const answeredCount = responses.filter(item => item.conclusion !== "unanswered").length;
  const nonCompliantCount = responses.filter(item => item.conclusion === "non_compliant").length;
  return {
    id: String(row.id), title: String(row.title), status: String(row.status) as FormStatus, templateVersion: String(row.template_version),
    progress: auditItems.length ? answeredCount / auditItems.length : 0, answeredCount, nonCompliantCount,
    responsibleName: String(row.responsible_name), responsibleRole: String(row.responsible_role),
    startedAt: String(row.started_at), updatedAt: String(row.updated_at), signedAt: row.signed_at ? String(row.signed_at) : null,
    signedContentHash: row.signed_content_hash ? String(row.signed_content_hash) : null,
    contextSnapshot: parseObject(row.context_snapshot_json),
    responses: includeResponses ? responses : undefined, validationErrors: includeResponses ? auditValidation(responses) : undefined
  };
}

export function createAuditInstance(title?: string): AuditInstance {
  const existing = getDb().prepare("SELECT id FROM audit_instance WHERE status!='signed' AND status!='archived' ORDER BY started_at DESC LIMIT 1").get() as { id: string } | undefined;
  if (existing) return getAuditInstance(existing.id)!;
  const id = randomUUID(); const timestamp = now();
  getDb().exec("BEGIN");
  try {
    getDb().prepare(`INSERT INTO audit_instance
      (id, title, status, template_version, responsible_name, responsible_role, started_at, updated_at, signed_at, signed_content_hash)
      VALUES (?, ?, 'collecting', 'official-v1', '', '', ?, ?, NULL, NULL)`)
      .run(id, title || `个人信息保护合规自查 ${new Date().toLocaleDateString("zh-CN")}`, timestamp, timestamp);
    const statement = getDb().prepare(`INSERT INTO audit_response
      (id, instance_id, item_code, conclusion, explanation, evidence_note, task_id, updated_at)
      VALUES (?, ?, ?, 'unanswered', '', '', NULL, ?)`);
    for (const item of auditItems) statement.run(randomUUID(), id, item.code, timestamp);
    getDb().exec("COMMIT");
  } catch (error) { getDb().exec("ROLLBACK"); throw error; }
  addAuditEvent("audit.created", "开始一次个人信息保护合规自查");
  return getAuditInstance(id)!;
}

export function listAuditInstances(): AuditInstance[] {
  return (getDb().prepare("SELECT * FROM audit_instance ORDER BY started_at DESC").all() as Record<string, unknown>[]).map(row => mapAuditInstance(row));
}

export function getAuditInstance(id: string): AuditInstance | null {
  const row = getDb().prepare("SELECT * FROM audit_instance WHERE id=?").get(id) as Record<string, unknown> | undefined;
  return row ? mapAuditInstance(row, true) : null;
}

export function saveAuditResponse(instanceId: string, input: { itemCode: string; conclusion: AuditConclusion; explanation: string; evidenceNote: string }): AuditInstance | null {
  const instance = getAuditInstance(instanceId);
  if (!instance) return null;
  if (instance.status === "signed" || instance.status === "archived") throw new Error("SIGNED_FORM");
  if (!auditItems.some(item => item.code === input.itemCode)) throw new Error("INVALID_ITEM");
  const current = getDb().prepare("SELECT * FROM audit_response WHERE instance_id=? AND item_code=?").get(instanceId, input.itemCode) as Record<string, unknown>;
  let taskId = current.task_id ? String(current.task_id) : null;
  if (input.conclusion === "non_compliant" && !taskId) {
    taskId = randomUUID(); const definition = auditItems.find(item => item.code === input.itemCode)!;
    getDb().prepare(`INSERT INTO task
      (id, code, title, description, category, priority, status, created_at, completed_at, source_type, source_id, activity_id)
      VALUES (?, ?, ?, ?, '合规自查', ?, 'open', ?, NULL, 'audit_response', ?, NULL)`)
      .run(taskId, `AUDIT-${instanceId}-${input.itemCode}`, `整改：${definition.title}`, input.explanation || definition.question, ["A12", "A13", "A14", "A22", "A24"].includes(input.itemCode) ? "high" : "normal", now(), String(current.id));
  }
  if (taskId && input.conclusion === "non_compliant") {
    getDb().prepare("UPDATE task SET status='open', completed_at=NULL, description=?, completion_mode='manual', completion_basis='' WHERE id=?").run(input.explanation || "该自查事项仍需整改。", taskId);
  } else if (taskId) {
    const basis = `关联的合规自查项目已更新为“${input.conclusion === "compliant" ? "符合" : "与本单位无关"}”。`;
    getDb().prepare(`UPDATE task SET status='completed', completed_at=?, started_at=COALESCE(started_at, ?), handling_note=?,
      evidence_note=?, responsible_name='系统自动核验', completion_mode='automatic', completion_basis=? WHERE id=? AND status!='completed'`)
      .run(now(), now(), basis, input.evidenceNote, basis, taskId);
  }
  getDb().prepare(`UPDATE audit_response SET conclusion=?, explanation=?, evidence_note=?, task_id=?, updated_at=?
    WHERE instance_id=? AND item_code=?`).run(input.conclusion, input.explanation, input.evidenceNote, taskId, now(), instanceId, input.itemCode);
  const updated = getAuditInstance(instanceId)!;
  const nextStatus: FormStatus = updated.answeredCount < auditItems.length ? "collecting" : updated.nonCompliantCount > 0 ? "remediation" : "ready_to_sign";
  getDb().prepare("UPDATE audit_instance SET status=?, updated_at=? WHERE id=?").run(nextStatus, now(), instanceId);
  return getAuditInstance(instanceId)!;
}

export function signAuditInstance(id: string, responsibleName: string, responsibleRole: string): AuditInstance | null {
  const instance = getAuditInstance(id);
  if (!instance) return null;
  if (instance.status === "signed") return instance;
  const errors = auditValidation(instance.responses || []);
  if (!responsibleName.trim() || !responsibleRole.trim()) errors.push("请填写负责人姓名和角色");
  if (errors.length) throw new Error(`VALIDATION:${errors.join("|")}`);
  const signedAt = now();
  const contextSnapshot = auditContext();
  const hash = createHash("sha256").update(JSON.stringify({
    templateVersion: instance.templateVersion, responses: instance.responses?.map(item => ({ code: item.itemCode, conclusion: item.conclusion, explanation: item.explanation, evidenceNote: item.evidenceNote })),
    responsibleName, responsibleRole, signedAt, contextSnapshot
  })).digest("hex");
  getDb().prepare(`UPDATE audit_instance SET status='signed', responsible_name=?, responsible_role=?, signed_at=?,
    signed_content_hash=?, context_snapshot_json=?, updated_at=? WHERE id=?`).run(responsibleName, responsibleRole, signedAt, hash, JSON.stringify(contextSnapshot), signedAt, id);
  addAuditEvent("audit.signed", `完成并确认合规审计自查表：${instance.title}`);
  return getAuditInstance(id);
}

const pipiaCategories: Record<PipiaCategoryCode, string> = {
  P01: "处理敏感个人信息", P02: "利用个人信息进行自动化决策", P03: "委托处理、向其他处理者提供或公开个人信息",
  P04: "向境外提供个人信息", P05: "其他对个人权益有重大影响的处理活动"
};

export function listPipiaRecommendations() {
  return listActivities().map(activity => {
    const recommendedCodes: PipiaCategoryCode[] = []; const reasons: string[] = [];
    if (activity.facts.sensitiveInformation === "yes") { recommendedCodes.push("P01"); reasons.push("业务填写为涉及敏感个人信息"); }
    if (activity.facts.purposes.includes("营销活动")) { recommendedCodes.push("P02"); reasons.push("存在营销用途，需确认是否采用自动化决策"); }
    if (activity.facts.recipients.some(item => item !== "不向外部提供")) { recommendedCodes.push("P03"); reasons.push("记录了服务商或其他外部接收方"); }
    if (activity.facts.crossBorderAccess === "yes") { recommendedCodes.push("P04"); reasons.push("业务填写为存在境外存储或访问"); }
    return { activity, recommendedCodes: [...new Set(recommendedCodes)], reasons };
  });
}

function pipiaValidation(responses: PipiaResponse[]) {
  const errors: string[] = [];
  for (const response of responses) {
    if ([response.legality, response.impact, response.measureAdequacy].includes("unanswered")) errors.push(`${response.categoryName}尚未完成三个判断`);
    if ((response.legality === "no" || response.impact === "has_impact" || response.measureAdequacy === "no") && response.notes.trim().length < 2) errors.push(`${response.categoryName}需要填写风险和措施说明`);
  }
  return errors;
}

function mapPipiaInstance(row: Record<string, unknown>, includeResponses = false): PipiaInstance {
  let categoryCodes: PipiaCategoryCode[] = [];
  try { categoryCodes = JSON.parse(String(row.category_codes_json || "[]")); } catch { categoryCodes = []; }
  const raw = (getDb().prepare("SELECT * FROM pipia_response WHERE instance_id=? ORDER BY category_code").all(String(row.id)) as Record<string, unknown>[]);
  const responses = raw.map(item => ({
    id: String(item.id), instanceId: String(item.instance_id), categoryCode: String(item.category_code) as PipiaCategoryCode,
    categoryName: pipiaCategories[String(item.category_code) as PipiaCategoryCode], legality: String(item.legality) as YesNoNA,
    impact: String(item.impact) as ImpactAnswer, measureAdequacy: String(item.measure_adequacy) as YesNoNA,
    notes: String(item.notes), evidenceNote: String(item.evidence_note), taskId: item.task_id ? String(item.task_id) : null, updatedAt: String(item.updated_at)
  }));
  const activity = getActivity(String(row.activity_id));
  const rawContext = parseObject(row.context_snapshot_json);
  const contextSnapshot = rawContext.enterprise && rawContext.activity
    ? rawContext as unknown as { enterprise: EnterpriseProfile; activity: ProcessingActivity }
    : null;
  const complete = responses.filter(item => ![item.legality, item.impact, item.measureAdequacy].includes("unanswered")).length;
  return {
    id: String(row.id), activityId: String(row.activity_id), activityName: activity?.name || "已删除业务", status: String(row.status) as FormStatus,
    categoryCodes, progress: responses.length ? complete / responses.length : 0, responsibleName: String(row.responsible_name),
    responsibleRole: String(row.responsible_role), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    signedAt: row.signed_at ? String(row.signed_at) : null, signedContentHash: row.signed_content_hash ? String(row.signed_content_hash) : null,
    contextSnapshot,
    responses: includeResponses ? responses : undefined, validationErrors: includeResponses ? pipiaValidation(responses) : undefined
  };
}

export function createPipiaInstance(activityId: string, categoryCodes: PipiaCategoryCode[]): PipiaInstance | null {
  const activity = getActivity(activityId); if (!activity) return null;
  const uniqueCodes = [...new Set(categoryCodes)].filter(code => pipiaCategories[code]);
  if (!uniqueCodes.length) throw new Error("NO_CATEGORIES");
  const existing = getDb().prepare("SELECT id FROM pipia_instance WHERE activity_id=? AND status!='signed' AND status!='archived' ORDER BY created_at DESC LIMIT 1").get(activityId) as { id: string } | undefined;
  if (existing) {
    const current = getPipiaInstance(existing.id)!;
    const mergedCodes = [...new Set([...current.categoryCodes, ...uniqueCodes])];
    const statement = getDb().prepare(`INSERT OR IGNORE INTO pipia_response
      (id, instance_id, category_code, legality, impact, measure_adequacy, notes, evidence_note, task_id, updated_at)
      VALUES (?, ?, ?, 'unanswered', 'unanswered', 'unanswered', '', '', NULL, ?)`);
    for (const code of mergedCodes) statement.run(randomUUID(), existing.id, code, now());
    const refreshed = getPipiaInstance(existing.id)!;
    getDb().prepare("UPDATE pipia_instance SET category_codes_json=?, status=?, updated_at=? WHERE id=?")
      .run(JSON.stringify(mergedCodes), refreshed.progress === 1 ? "ready_to_sign" : "collecting", now(), existing.id);
    return getPipiaInstance(existing.id);
  }
  const id = randomUUID(); const timestamp = now();
  const contextSnapshot = { enterprise: getEnterprise(), activity };
  getDb().exec("BEGIN");
  try {
    getDb().prepare(`INSERT INTO pipia_instance
      (id, activity_id, status, category_codes_json, responsible_name, responsible_role, created_at, updated_at, signed_at, signed_content_hash, context_snapshot_json)
      VALUES (?, ?, 'collecting', ?, '', '', ?, ?, NULL, NULL, ?)`).run(id, activityId, JSON.stringify(uniqueCodes), timestamp, timestamp, JSON.stringify(contextSnapshot));
    const statement = getDb().prepare(`INSERT INTO pipia_response
      (id, instance_id, category_code, legality, impact, measure_adequacy, notes, evidence_note, task_id, updated_at)
      VALUES (?, ?, ?, 'unanswered', 'unanswered', 'unanswered', '', '', NULL, ?)`);
    for (const code of uniqueCodes) statement.run(randomUUID(), id, code, timestamp);
    getDb().exec("COMMIT");
  } catch (error) { getDb().exec("ROLLBACK"); throw error; }
  addAuditEvent("pipia.created", `开始“${activity.name}”个人信息保护影响评估`);
  return getPipiaInstance(id);
}

export function listPipiaInstances(): PipiaInstance[] {
  return (getDb().prepare("SELECT * FROM pipia_instance ORDER BY created_at DESC").all() as Record<string, unknown>[]).map(row => mapPipiaInstance(row));
}

export function getPipiaInstance(id: string): PipiaInstance | null {
  const row = getDb().prepare("SELECT * FROM pipia_instance WHERE id=?").get(id) as Record<string, unknown> | undefined;
  return row ? mapPipiaInstance(row, true) : null;
}

export function savePipiaResponse(instanceId: string, input: { categoryCode: PipiaCategoryCode; legality: YesNoNA; impact: ImpactAnswer; measureAdequacy: YesNoNA; notes: string; evidenceNote: string }): PipiaInstance | null {
  const instance = getPipiaInstance(instanceId); if (!instance) return null;
  if (instance.status === "signed" || instance.status === "archived") throw new Error("SIGNED_FORM");
  if (!instance.categoryCodes.includes(input.categoryCode)) throw new Error("INVALID_CATEGORY");
  const current = getDb().prepare("SELECT * FROM pipia_response WHERE instance_id=? AND category_code=?").get(instanceId, input.categoryCode) as Record<string, unknown>;
  const hasRisk = input.legality === "no" || input.impact === "has_impact" || input.measureAdequacy === "no";
  let taskId = current.task_id ? String(current.task_id) : null;
  if (hasRisk && !taskId) {
    taskId = randomUUID();
    getDb().prepare(`INSERT INTO task
      (id, code, title, description, category, priority, status, created_at, completed_at, source_type, source_id, activity_id)
      VALUES (?, ?, ?, ?, '影响评估', 'high', 'open', ?, NULL, 'pipia_response', ?, ?)`)
      .run(taskId, `PIPIA-${instanceId}-${input.categoryCode}`, `处理影响评估发现：${pipiaCategories[input.categoryCode]}`, input.notes || "请补充保护措施并重新确认评估结论。", now(), String(current.id), instance.activityId);
  }
  if (taskId && hasRisk) getDb().prepare("UPDATE task SET status='open', completed_at=NULL, description=?, completion_mode='manual', completion_basis='' WHERE id=?").run(input.notes || "该影响评估事项仍需处理。", taskId);
  if (taskId && !hasRisk) {
    const basis = "关联影响评估已重新判断，当前未再保留需要整改的风险结论。";
    getDb().prepare(`UPDATE task SET status='completed', completed_at=?, started_at=COALESCE(started_at, ?), handling_note=?,
      evidence_note=?, responsible_name='系统自动核验', completion_mode='automatic', completion_basis=? WHERE id=? AND status!='completed'`)
      .run(now(), now(), basis, input.evidenceNote, basis, taskId);
  }
  getDb().prepare(`UPDATE pipia_response SET legality=?, impact=?, measure_adequacy=?, notes=?, evidence_note=?, task_id=?, updated_at=?
    WHERE instance_id=? AND category_code=?`).run(input.legality, input.impact, input.measureAdequacy, input.notes, input.evidenceNote, taskId, now(), instanceId, input.categoryCode);
  const updated = getPipiaInstance(instanceId)!;
  getDb().prepare("UPDATE pipia_instance SET status=?, updated_at=? WHERE id=?")
    .run(updated.progress === 1 ? "ready_to_sign" : "collecting", now(), instanceId);
  return getPipiaInstance(instanceId);
}

export function signPipiaInstance(id: string, responsibleName: string, responsibleRole: string): PipiaInstance | null {
  const instance = getPipiaInstance(id); if (!instance) return null;
  if (instance.status === "signed") return instance;
  const errors = pipiaValidation(instance.responses || []);
  if (!responsibleName.trim() || !responsibleRole.trim()) errors.push("请填写负责人姓名和角色");
  if (errors.length) throw new Error(`VALIDATION:${errors.join("|")}`);
  const signedAt = now();
  const hash = createHash("sha256").update(JSON.stringify({ activityId: instance.activityId, categoryCodes: instance.categoryCodes, contextSnapshot: instance.contextSnapshot, responses: instance.responses, responsibleName, responsibleRole, signedAt })).digest("hex");
  getDb().prepare(`UPDATE pipia_instance SET status='signed', responsible_name=?, responsible_role=?, signed_at=?,
    signed_content_hash=?, updated_at=? WHERE id=?`).run(responsibleName, responsibleRole, signedAt, hash, signedAt, id);
  addAuditEvent("pipia.signed", `完成并确认影响评估：${instance.activityName}`);
  return getPipiaInstance(id);
}

export function addAuditEvent(action: string, summary: string) {
  getDb().prepare("INSERT INTO audit_event VALUES (?, ?, ?, ?)").run(randomUUID(), action, summary, now());
}
export function listAuditEvents(): AuditEvent[] {
  return (getDb().prepare("SELECT * FROM audit_event ORDER BY created_at DESC LIMIT 30").all() as Record<string, unknown>[]).map(row => ({ id: String(row.id), action: String(row.action), summary: String(row.summary), createdAt: String(row.created_at) }));
}

export function getDashboard(): DashboardData {
  const tasks = listTasks(); const activities = listActivities(); const documents = listDocuments();
  const audits = listAuditInstances(); const pipias = listPipiaInstances();
  return { enterprise: getEnterprise(), counts: { activities: activities.length, openTasks: tasks.filter(t => t.status !== "completed").length, completedTasks: tasks.filter(t => t.status === "completed").length, documents: documents.length, audits: audits.length, signedAudits: audits.filter(item => item.status === "signed").length, impactAssessments: pipias.length }, tasks, activities, documents, recentEvents: listAuditEvents() };
}
