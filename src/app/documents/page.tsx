"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileCheck2, FileClock,
  Eye, FilePlus2, FileText, GitCompareArrows, History, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, UploadCloud
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { materialCatalog, materialRequirementName, materialTypeName, type MaterialCategory } from "@/lib/materials";
import { activityMatchesAudience, classifyActivityAudienceGroups, materialAudienceName, materialAudienceOptions } from "@/lib/material-audience";
import { activeDocumentPendingFacts, findDocumentPublicationRisks } from "@/lib/document-publication";
import { activityDisplayName } from "@/lib/activity-label";
import type { AuditInstance, BusinessDocument, DocumentChangeImpact, DocumentVersion, EnterpriseProfile, MaterialAudienceGroup, PipiaInstance, ProcessingActivity, TaskItem } from "@/lib/types";

const categoryName: Record<MaterialCategory, string> = {
  external: "对外告知与同意",
  internal: "内部制度与指引",
  agreement: "协议与权责约定",
  register: "业务台账",
  record: "处理记录"
};
const healthText = { unpublished: "尚未发布", current: "内容一致", needs_review: "需要确认", updating: "草稿待发布", pending_approval: "草稿待发布", overdue: "逾期未处理", archived: "已归档" } as const;
type DetailTab = "overview" | "versions" | "records";
type MaterialAiStatus = { configured: boolean; activeProvider: string | null; activeModel: string | null };
type MaterialAiPreview = {
  payload: Record<string, unknown>;
  fields: Array<{ code: string; group: "企业信息" | "业务信息"; label: string; description: string; included: boolean }>;
  excludedFields: string[];
  redactionCount: number;
  redactionLabels: string[];
  restorationNotice: string;
};
type ImportPreview = {
  fileName: string; mimeType: string; byteSize: number; contentHash: string; extension: string;
  content: string; extractionMethod: string; requiresManualText: boolean; notice: string; suggestedTitle: string | null;
};

function buildLineDiff(before: string, after: string) {
  const oldLines = before.split("\n"); const newLines = after.split("\n");
  const table = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0) as number[]);
  for (let i = oldLines.length - 1; i >= 0; i--) for (let j = newLines.length - 1; j >= 0; j--) {
    table[i][j] = oldLines[i] === newLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const result: Array<{ kind: "same" | "added" | "removed"; text: string }> = []; let i = 0; let j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) { result.push({ kind: "same", text: oldLines[i] }); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { result.push({ kind: "removed", text: oldLines[i++] }); }
    else result.push({ kind: "added", text: newLines[j++] });
  }
  while (i < oldLines.length) result.push({ kind: "removed", text: oldLines[i++] });
  while (j < newLines.length) result.push({ kind: "added", text: newLines[j++] });
  return result;
}

function publicationRiskAction(risk: string): { href: string; label: string } | null {
  if (/影响评估/.test(risk)) return { href: "/impact-assessments", label: "前往完成影响评估" };
  if (/发布前待办|待办未完成/.test(risk)) return { href: "/tasks", label: "前往办理待办" };
  if (/敏感个人信息|外部单位|接收方|处理关系|保存期限|删除机制|权利请求/.test(risk)) return { href: "/business", label: "前往补充业务事实" };
  return null;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ProcessingActivity[]>([]);
  const [audits, setAudits] = useState<AuditInstance[]>([]);
  const [pipias, setPipias] = useState<PipiaInstance[]>([]);
  const [enterprise, setEnterprise] = useState<EnterpriseProfile | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [aiStatus, setAiStatus] = useState<MaterialAiStatus>({ configured: false, activeProvider: null, activeModel: null });
  const [selected, setSelected] = useState<BusinessDocument | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importName, setImportName] = useState("");
  const [importType, setImportType] = useState("privacy_notice");
  const [importAudienceGroup, setImportAudienceGroup] = useState<MaterialAudienceGroup>("consumer");
  const [importAudience, setImportAudience] = useState("");
  const [importScope, setImportScope] = useState("");
  const [importDescription, setImportDescription] = useState("");
  const [importCreatedBy, setImportCreatedBy] = useState("");
  const [importContent, setImportContent] = useState("");
  const [importActivityIds, setImportActivityIds] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [audienceGroup, setAudienceGroup] = useState<MaterialAudienceGroup>("business_contact");
  const [type, setType] = useState("b2b_contact_notice");
  const [name, setName] = useState("业务联系人个人信息告知");
  const [scope, setScope] = useState("客户、供应商及合作方联系业务");
  const [audience, setAudience] = useState("客户、供应商及合作方联系人");
  const [description, setDescription] = useState("");
  const [generationMode, setGenerationMode] = useState<"ai" | "template">("template");
  const [aiPreview, setAiPreview] = useState<MaterialAiPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [audienceOverrideActivityIds, setAudienceOverrideActivityIds] = useState<string[]>([]);
  const [coverageTarget, setCoverageTarget] = useState<MaterialAudienceGroup | null>(null);
  const [editor, setEditor] = useState<{ mode: "view" | "new" | "edit"; versionId?: string; justCreated?: boolean } | null>(null);
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [workflow, setWorkflow] = useState<{ version: DocumentVersion } | null>(null);
  const [actor, setActor] = useState("");
  const [channel, setChannel] = useState("");
  const [evidence, setEvidence] = useState("");
  const [publicationMode, setPublicationMode] = useState<"effective" | "risk_archive">("effective");
  const [riskDecisionNote, setRiskDecisionNote] = useState("");
  const [compareIds, setCompareIds] = useState<[string, string]>(["", ""]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const materialWizardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!creating) return;
    const frame = window.requestAnimationFrame(() => materialWizardRef.current?.scrollTo({ top: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [creating, step]);

  const load = async (preferredId?: string) => {
    try {
      const [docResponse, scenarioResponse, auditResponse, pipiaResponse, dashboardResponse, aiResponse] = await Promise.all([
        fetch("/api/documents", { cache: "no-store" }),
        fetch("/api/scenarios", { cache: "no-store" }),
        fetch("/api/audits", { cache: "no-store" }),
        fetch("/api/pipia", { cache: "no-store" }),
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/settings/ai", { cache: "no-store" }).catch(() => null)
      ]);
      if (!docResponse.ok || !scenarioResponse.ok || !auditResponse.ok || !pipiaResponse.ok || !dashboardResponse.ok) throw new Error("LOAD_FAILED");
      const docs = await docResponse.json();
      const scenarioData = await scenarioResponse.json();
      const auditData = await auditResponse.json();
      const pipiaData = await pipiaResponse.json();
      const dashboardData = await dashboardResponse.json();
      setDocuments(docs); setActivities(scenarioData.activities || []);
      setAudits(auditData || []); setPipias(pipiaData.instances || []); setEnterprise(dashboardData.enterprise); setTasks(dashboardData.tasks || []); setError("");
      if (aiResponse?.ok) {
        const aiData = await aiResponse.json();
        setAiStatus(aiData); setGenerationMode(current => current === "ai" || !aiData.configured ? current : "ai");
      }
      setSelected(current => docs.find((item: BusinessDocument) => item.id === (preferredId || current?.id)) || docs[0] || null);
    } catch {
      setError("暂时无法读取材料数据，请稍后刷新页面。");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const definition = useMemo(() => materialCatalog.find(item => item.code === type)!, [type]);
  const availableDefinitions = useMemo(() => materialCatalog.filter(item => item.audienceGroups.includes(audienceGroup)), [audienceGroup]);
  const selectedActivities = useMemo(() => activities.filter(item => activityIds.includes(item.id)), [activities, activityIds]);
  const missingFacts = selectedActivities.filter(item => item.completeness < 1 || !item.facts.confirmedAt);
  const activeRevision = selected?.versions?.find(version => ["draft", "under_review", "approved"].includes(version.status));
  const signedPipiaActivityIds = pipias.filter(item => item.status === "signed").map(item => item.activityId);
  const effectiveMinorRuleActivityIds = documents.filter(item => item.type === "minor_notice" && item.currentVersionId).flatMap(item => item.activityIds);
  const blockingTaskRisks = selected ? tasks.filter(task => selected.activityIds.includes(task.activityId || "") && task.status !== "completed" && task.priority === "high" && (task.sourceType === "assessment_finding" || task.category === "影响评估")).map(task => `发布前待办未完成：${task.title}`) : [];
  const publicationRisks = selected ? findDocumentPublicationRisks(selected, activities, blockingTaskRisks, { content: workflow?.version.content || activeRevision?.content || "", signedPipiaActivityIds, effectiveMinorRuleActivityIds, enterprise: enterprise || undefined }) : [];
  const activePendingFacts = selected ? activeDocumentPendingFacts(selected, activeRevision?.content || selected.currentVersion?.content || selected.versions?.[0]?.content || "") : [];
  const resolvePendingFact = async (pendingFact: string) => {
    if (!selected || !window.confirm(`请确认已经根据实际业务核对以下事项：\n\n${pendingFact}`)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/documents/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolvePendingFact: pendingFact }) });
    const payload = await response.json();
    if (response.ok) await load(selected.id); else setError(payload.message || "暂时无法确认该事项。");
    setBusy(false);
  };
  const compareVersions = selected?.versions || [];
  const left = compareVersions.find(version => version.id === compareIds[0]) || compareVersions[compareVersions.length - 1];
  const right = compareVersions.find(version => version.id === compareIds[1]) || compareVersions[0];
  const diff = left && right ? buildLineDiff(left.content, right.content) : [];
  const audienceCoverage = useMemo(() => materialAudienceOptions.filter(item => item.external).map(item => {
    const matchedActivities = activities.filter(activity => classifyActivityAudienceGroups(activity).includes(item.code));
    const matchedDocuments = documents.filter(document => document.audienceGroup === item.code);
    const coveredIds = new Set(matchedDocuments.filter(document => document.currentVersion).flatMap(document => document.activityIds));
    return { ...item, activityCount: matchedActivities.length, documentCount: matchedDocuments.length, uncoveredCount: matchedActivities.filter(activity => !coveredIds.has(activity.id)).length };
  }), [activities, documents]);

  const openCreate = (target?: MaterialAudienceGroup) => {
    const initialGroup = target || "business_contact";
    const initial = materialCatalog.find(item => item.audienceGroups.includes(initialGroup) && item.requirement === "basic")
      || materialCatalog.find(item => item.audienceGroups.includes(initialGroup))!;
    setCoverageTarget(target || null);
    setAudienceGroup(initialGroup);
    setType(initial.code); setName(initial.name); setAudience(initial.defaultAudience); setScope(initial.defaultScope);
    const matched = target ? activities.filter(activity => activity.completeness === 1 && !!activity.facts.confirmedAt && activityMatchesAudience(activity, target)).map(activity => activity.id) : [];
    setDescription(""); setActivityIds(matched); setAudienceOverrideActivityIds([]); setAiPreview(null); setGenerationMode(aiStatus.configured ? "ai" : "template"); setStep(1); setError(""); setCreating(true);
  };
  const chooseAudienceGroup = (code: MaterialAudienceGroup) => {
    if (coverageTarget && code !== coverageTarget && !window.confirm(`当前正在补齐“${materialAudienceName(coverageTarget)}”的材料覆盖。切换后将不能消除该覆盖缺口，是否继续？`)) return;
    if (coverageTarget && code !== coverageTarget) setCoverageTarget(null);
    const next = materialCatalog.find(item => item.audienceGroups.includes(code))!;
    setAudienceGroup(code); setActivityIds([]); setAudienceOverrideActivityIds([]);
    setType(next.code); setName(next.name); setAudience(next.defaultAudience); setScope(next.defaultScope);
  };
  const chooseType = (code: string) => {
    const next = materialCatalog.find(item => item.code === code)!;
    setType(code); setName(next.name); setAudience(next.defaultAudience); setScope(next.defaultScope);
  };
  const toggleActivityForAudience = (activity: ProcessingActivity) => {
    if (activityIds.includes(activity.id)) {
      setActivityIds(current => current.filter(id => id !== activity.id));
      setAudienceOverrideActivityIds(current => current.filter(id => id !== activity.id));
      return;
    }
    const compatible = activityMatchesAudience(activity, audienceGroup);
    if (!compatible && !audienceOverrideActivityIds.includes(activity.id)) {
      setAudienceOverrideActivityIds(current => [...current, activity.id]);
    }
    setActivityIds(current => [...current, activity.id]);
  };

  const create = async (aiPreviewConfirmed = false, allowDuplicate = false) => {
    setBusy(true); setError("");
    const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, scope, type, audienceGroup, audience, description, activityIds, audienceOverrideActivityIds, generationMode, excludedAiFields: aiPreview?.excludedFields || [], aiPreviewConfirmed, allowDuplicate }) });
    const payload = await response.json();
    if (response.ok) {
      const created = payload as BusinessDocument;
      const draft = created.versions?.find(version => version.status === "draft") || created.versions?.[0];
      setDocuments(current => [created, ...current.filter(document => document.id !== created.id)]);
      setSelected(created); setAiPreview(null); setCreating(false); setTab("versions");
      if (draft) {
        setContent(draft.content); setSummary(draft.changeSummary); setCreatedBy(draft.createdBy || "");
        setEditor({ mode: "edit", versionId: draft.id, justCreated: true });
      }
      void load(created.id);
    }
    else if (response.status === 409 && payload.code === "DUPLICATE_DOCUMENT") {
      setBusy(false);
      const existing = payload.duplicates?.[0];
      const createAnother = window.confirm(`相同类型、人群和业务范围下已有草稿“${existing?.name || "未命名材料"}”。\n\n确定仍要新建吗？`);
      if (createAnother) await create(aiPreviewConfirmed, true);
      else if (existing?.id) { setCreating(false); setAiPreview(null); await load(existing.id); }
      return;
    }
    else setError(payload.message || "生成材料失败，请稍后重试。");
    setBusy(false);
  };
  const openImport = () => {
    const initial = materialCatalog.find(item => item.code === "privacy_notice") || materialCatalog[0];
    setImportFile(null); setImportPreview(null); setImportName(""); setImportContent(""); setImportDescription("");
    setImportCreatedBy(""); setImportActivityIds([]); setImportType(initial.code); setImportAudienceGroup(initial.audienceGroups[0]);
    setImportAudience(initial.defaultAudience); setImportScope(initial.defaultScope); setError(""); setImporting(true);
  };
  const chooseImportType = (code: string) => {
    const next = materialCatalog.find(item => item.code === code)!;
    setImportType(code); setImportAudienceGroup(next.audienceGroups[0]);
    setImportAudience(next.defaultAudience); setImportScope(next.defaultScope);
  };
  const previewImportFile = async (file: File | null) => {
    setImportFile(file); setImportPreview(null); setImportContent(""); setError("");
    if (!file) return;
    setBusy(true);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/documents/import/preview", { method: "POST", body: form });
    const payload = await response.json();
    if (response.ok) {
      setImportPreview(payload); setImportContent(payload.content || "");
      setImportName(payload.suggestedTitle || file.name.replace(/\.(txt|md|html?|docx|pdf)$/i, ""));
    } else setError(payload.message || "文件读取失败，请重新选择。");
    setBusy(false);
  };
  const importDocument = async () => {
    if (!importFile) return;
    setBusy(true); setError("");
    const form = new FormData();
    form.append("file", importFile); form.append("name", importName); form.append("type", importType);
    form.append("audienceGroup", importAudienceGroup); form.append("audience", importAudience); form.append("scope", importScope);
    form.append("description", importDescription); form.append("createdBy", importCreatedBy); form.append("content", importContent);
    form.append("activityIds", JSON.stringify(importActivityIds));
    const response = await fetch("/api/documents/import", { method: "POST", body: form });
    const payload = await response.json();
    if (response.ok) {
      const created = payload as BusinessDocument;
      const draft = created.versions?.find(version => version.status === "draft") || created.versions?.[0];
      setDocuments(current => [created, ...current.filter(document => document.id !== created.id)]);
      setSelected(created); setImporting(false); setTab("versions");
      if (draft) {
        setContent(draft.content); setSummary(draft.changeSummary); setCreatedBy(draft.createdBy || "");
        setEditor({ mode: "edit", versionId: draft.id, justCreated: true });
      }
      void load(created.id);
    } else setError(payload.message || "导入失败，请检查后重试。");
    setBusy(false);
  };

  const loadAiPreview = async (excludedFields?: string[]) => {
    setPreviewBusy(true); setError("");
    const response = await fetch("/api/ai/material-draft-preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scope, type, audienceGroup, audience, activityIds, excludedFields })
    });
    const payload = await response.json();
    if (response.ok) setAiPreview(payload);
    else setError(payload.message || "无法生成AI提交预览。");
    setPreviewBusy(false);
  };

  const togglePreviewField = async (code: string, included: boolean) => {
    if (!aiPreview) return;
    const excluded = included ? [...aiPreview.excludedFields, code] : aiPreview.excludedFields.filter(item => item !== code);
    await loadAiPreview(excluded);
  };

  const handleGenerate = () => generationMode === "ai" ? void loadAiPreview() : void create(false);

  const openRevision = (version?: DocumentVersion) => {
    const base = version || selected?.currentVersion || selected?.versions?.[0];
    setContent(base?.content || ""); setSummary(version?.changeSummary || selected?.reviewReason || "根据最新业务情况修订材料");
    setCreatedBy(version?.createdBy || ""); setError(""); setEditor({ mode: version?.status === "draft" ? "edit" : "new", versionId: version?.status === "draft" ? version.id : undefined });
  };

  const saveRevision = async (nextAction: "close" | "publish" = "close") => {
    if (!selected || !editor) return;
    setBusy(true); setError("");
    const url = editor.mode === "edit" ? `/api/documents/${selected.id}/versions/${editor.versionId}` : `/api/documents/${selected.id}/versions`;
    const response = await fetch(url, { method: editor.mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, changeSummary: summary, createdBy }) });
    const payload = await response.json();
    if (response.ok) {
      const savedVersion = payload as DocumentVersion;
      await load(selected.id); setEditor(null); setTab("versions");
      if (nextAction === "publish") openPublish(savedVersion);
    }
    else setError(payload.message || "无法保存草稿。");
    setBusy(false);
  };

  const openPublish = (version: DocumentVersion) => {
    setActor(version.publishedBy || ""); setChannel(version.publishChannel || ""); setEvidence(version.publicationEvidence || "");
    const risks = selected ? findDocumentPublicationRisks(selected, activities, blockingTaskRisks, { content: version.content, signedPipiaActivityIds, effectiveMinorRuleActivityIds, enterprise: enterprise || undefined }) : [];
    setPublicationMode(risks.length > 0 ? "risk_archive" : "effective"); setRiskDecisionNote("");
    setError(""); setWorkflow({ version });
  };

  const runWorkflow = async () => {
    if (!selected || !workflow) return;
    setBusy(true); setError("");
    const base = `/api/documents/${selected.id}/versions/${workflow.version.id}`;
    const body = { publishedBy: actor, publishChannel: channel, publicationEvidence: evidence, publicationMode, riskDecisionNote };
    const response = await fetch(`${base}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (response.ok) { await load(selected.id); setWorkflow(null); }
    else setError(payload.message || "操作失败，请检查填写内容。");
    setBusy(false);
  };

  const handleImpact = async (impact: DocumentChangeImpact, action: "no_change" | "defer") => {
    if (!selected) return;
    const noteValue = window.prompt(action === "no_change" ? "请说明为什么本次变化不需要修改材料：" : "请说明暂缓原因：");
    if (!noteValue?.trim()) return;
    let dueAt: string | null = null;
    if (action === "defer") {
      const date = window.prompt("请输入计划完成日期（例如 2026-08-30）：");
      if (!date) return;
      const parsedDate = new Date(`${date}T23:59:59`); if (Number.isNaN(parsedDate.getTime())) return;
      dueAt = parsedDate.toISOString();
    }
    setBusy(true);
    await fetch(`/api/documents/${selected.id}/impacts/${impact.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: noteValue, dueAt }) });
    await load(selected.id); setBusy(false);
  };

  const chooseDocument = (document: BusinessDocument) => {
    setSelected(document); setTab("overview"); setConfirmingDelete(false);
    const versions = document.versions || []; setCompareIds([versions[versions.length - 1]?.id || "", versions[0]?.id || ""]);
  };

  const removeDocument = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/documents/${selected.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setConfirmingDelete(false); setSelected(null); await load(); }
    else { setError(payload.message || "删除失败，请稍后重试。"); setConfirmingDelete(false); }
    setBusy(false);
  };

  const needsConfirmDocs = documents.filter(item => ["needs_review", "overdue"].includes(item.healthStatus));
  const draftDocs = documents.filter(item => ["updating", "pending_approval"].includes(item.healthStatus));
  const uncoveredGroups = audienceCoverage.filter(item => item.uncoveredCount > 0);
  const hasActionItems = needsConfirmDocs.length > 0 || draftDocs.length > 0 || uncoveredGroups.length > 0;

  if (loading) return <div className="loading"><RefreshCw className="spin" /> 正在读取材料与版本记录…</div>;

  return <>
    <section className="page-heading"><div><p className="eyebrow">合规材料</p><h1>材料版本中心</h1><p>生成或导入已有材料，核对草稿后发布；业务变化时提示更新，同时保留历史版本、原文件和发布记录。</p></div><div className="heading-actions"><button className="button secondary" onClick={openImport}><UploadCloud size={17} /> 导入已有材料</button><button className="button primary" onClick={() => openCreate()}><Plus size={17} /> 生成材料</button></div></section>
    {hasActionItems && <section className="action-items">
      {needsConfirmDocs.length > 0 && <div className="action-item"><AlertTriangle /><div><strong>{needsConfirmDocs.length} 份材料需要确认</strong><span>{needsConfirmDocs.map(item => item.name).slice(0, 3).join("、")}{needsConfirmDocs.length > 3 ? " 等" : ""}：业务发生变化，请核对是否需要修订。</span></div></div>}
      {draftDocs.length > 0 && <div className="action-item"><Clock3 /><div><strong>{draftDocs.length} 份草稿待发布</strong><span>{draftDocs.map(item => item.name).slice(0, 3).join("、")}{draftDocs.length > 3 ? " 等" : ""}：草稿不能作为已建立的正式材料，请核对后直接发布。</span></div></div>}
      {uncoveredGroups.map(item => <button type="button" className="action-item coverage-action" key={item.code} onClick={() => openCreate(item.code)}><AlertTriangle /><div><strong>{item.name}尚无有效材料覆盖</strong><span>{item.uncoveredCount} 项相关业务没有已发布的对外告知；点击后将按该人群预选材料和已确认业务。</span></div><ChevronRight size={18} /></button>)}
    </section>}
    {error && !creating && !importing && !editor && !workflow && <div className="alert danger">{error}</div>}

    {documents.length ? <div className="document-layout lifecycle-layout"><div className="document-list">{documents.map(document => <button key={document.id} className={selected?.id === document.id ? "document-row selected" : "document-row"} onClick={() => chooseDocument(document)}><div className="doc-icon"><FileText /></div><div><strong>{document.name}</strong><span>{materialAudienceName(document.audienceGroup)} · {materialTypeName(document.type)}</span><small>{document.currentVersion ? `${document.currentVersion.versionNumber} 当前有效` : "尚未发布"} · {healthText[document.healthStatus]}</small></div><StatusBadge status={document.healthStatus} /></button>)}</div><div className="document-detail lifecycle-detail">{selected ? <>
      <div className="detail-header"><div><p className="eyebrow">{materialAudienceName(selected.audienceGroup)} · {materialTypeName(selected.type)} · {healthText[selected.healthStatus]}</p><h2>{selected.name}</h2><p>具体适用对象：{selected.audience || selected.scope}</p></div><div className="detail-header-actions">{activeRevision?.status === "draft" ? <button className="button secondary" onClick={() => openRevision(activeRevision)}><FileClock size={16} /> 继续编辑草稿</button> : !activeRevision && <button className="button secondary" onClick={() => openRevision()}><FilePlus2 size={16} /> 准备新版本</button>}{!selected.currentVersionId && !(selected.versions || []).some(version => version.publishedAt) && <button className="button danger secondary" disabled={busy} onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> 删除材料</button>}</div></div>
      {selected.metadata?.aiFallbackReason && <div className="material-health-alert"><AlertTriangle /><div><strong>本次已使用基础模板</strong><p>AI完整草稿暂未生成：{selected.metadata.aiFallbackReason}。现有草稿仍可编辑和发布，也可以在配置恢复后重新生成。</p></div></div>}
      {activePendingFacts.length > 0 && <div className="material-health-alert"><AlertTriangle /><div><strong>AI 标记了发布前待确认事项</strong>{activePendingFacts.map(item => <p key={item}>{item} <button className="text-link" disabled={busy} onClick={() => void resolvePendingFact(item)}>已核对并确认</button></p>)}</div></div>}
      {selected.reviewReason && <div className="material-health-alert"><AlertTriangle /><div><strong>业务变化后需要确认这份材料</strong><p>{selected.reviewReason}</p></div></div>}
      <nav className="document-tabs">{(["overview", "versions", "records"] as DetailTab[]).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{({ overview: "当前概况", versions: "版本与对比", records: "记录与依据" } as Record<DetailTab, string>)[item]}</button>)}</nav>
      {!!selected.attachments?.length && tab === "overview" && <div className="imported-source-card"><FileText /><div><strong>导入原文件</strong><span>{selected.attachments[0].fileName} · {(selected.attachments[0].byteSize / 1024).toFixed(1)} KB</span><small>SHA-256：{selected.attachments[0].contentHash.slice(0, 16)}…</small></div><a className="button secondary small" href={`/api/documents/${selected.id}/attachments/${selected.attachments[0].id}`}>下载原文件</a></div>}

      {tab === "overview" && <div className="document-tab-panel"><div className="document-basis"><div><span>当前有效版本</span><strong>{selected.currentVersion?.versionNumber || "尚无合规有效版本"}</strong></div><div><span>面向人群/场景</span><strong>{materialAudienceName(selected.audienceGroup)}</strong></div><div><span>覆盖业务</span><strong>{selected.activityIds.length} 项</strong></div></div>{selected.description && <p className="document-description">{selected.description}</p>}{selected.currentVersion ? <article className="current-version-card"><div><FileCheck2 /><div><strong>{selected.currentVersion.versionNumber} 合规有效版本</strong><span>{selected.currentVersion.publishedAt ? new Date(selected.currentVersion.publishedAt).toLocaleString("zh-CN") : ""}</span></div></div><button className="button secondary small" onClick={() => { setContent(selected.currentVersion!.content); setSummary(selected.currentVersion!.changeSummary); setEditor({ mode: "view", versionId: selected.currentVersion!.id }); }}>查看完整内容</button></article> : selected.versions?.some(version => version.publicationClassification === "current_state_risk_archive") ? <div className="alert warning">已有“现状归档（含整改项）”记录，但尚无合规有效版本；请完成风险事项后建立新版本。</div> : <div className="alert warning">目前只有草稿，尚不能作为已完成的正式材料。</div>}
        {!!selected.pendingImpacts?.length && <section className="impact-section"><h3>待处理的业务变化</h3>{selected.pendingImpacts.map(impact => <article key={impact.id} className="impact-card"><AlertTriangle /><div><strong>{impact.reason}</strong><p>建议核对：{impact.affectedSections.join("、")}</p><small>{new Date(impact.createdAt).toLocaleString("zh-CN")}{impact.dueAt ? ` · 计划于 ${new Date(impact.dueAt).toLocaleDateString("zh-CN")} 前处理` : ""}</small></div><div className="impact-actions">{!activeRevision && <button className="button small primary" onClick={() => openRevision()}>创建草稿</button>}<button className="text-link" disabled={busy} onClick={() => handleImpact(impact, "no_change")}>无需修改</button><button className="text-link" disabled={busy} onClick={() => handleImpact(impact, "defer")}>暂缓处理</button></div></article>)}</section>}
      </div>}

      {tab === "versions" && <div className="document-tab-panel"><div className="version-list">{selected.versions?.map(version => <article className="version-card" key={version.id}><div className="version-line"><div><span className="version-number">{version.versionNumber}</span><StatusBadge status={version.status} /></div><time>{new Date(version.createdAt).toLocaleDateString("zh-CN")}</time></div><p>{version.changeSummary}</p><div className="version-meta"><span>创建人：{version.createdBy || "未填写"}</span>{version.approvedBy && <span>历史批准记录：{version.approvedBy}（{version.approverRole}）</span>}{version.contentHash && <span>哈希：{version.contentHash.slice(0, 12)}…</span>}</div><div className="version-actions"><button className="text-link" onClick={() => { setContent(version.content); setSummary(version.changeSummary); setEditor({ mode: "view", versionId: version.id }); }}><FileText size={15} /> 查看内容</button>{version.status === "draft" && <button className="text-link" onClick={() => openRevision(version)}><FileClock size={14} /> 编辑草稿</button>}{["draft", "under_review", "approved"].includes(version.status) && <button className="button small primary" onClick={() => openPublish(version)}><UploadCloud size={14} /> 直接发布</button>}</div></article>)}</div>
        <section className="compare-panel"><div className="compare-panel-header"><GitCompareArrows size={16} /><strong>对比两个版本</strong><span className="compare-panel-hint">查看任意两个版本的逐行差异</span></div><div className="compare-picker"><label><span>较早版本</span><select value={left?.id || ""} onChange={event => setCompareIds([event.target.value, right?.id || ""])}>{compareVersions.map(version => <option key={version.id} value={version.id}>{version.versionNumber} · {version.changeSummary}</option>)}</select></label><GitCompareArrows /><label><span>较新版本</span><select value={right?.id || ""} onChange={event => setCompareIds([left?.id || "", event.target.value])}>{compareVersions.map(version => <option key={version.id} value={version.id}>{version.versionNumber} · {version.changeSummary}</option>)}</select></label></div>{left?.id === right?.id ? <div className="alert warning">请选择两个不同版本。</div> : <pre className="version-diff">{diff.map((line, index) => <span key={`${index}-${line.kind}`} className={`diff-${line.kind}`}>{line.kind === "added" ? "+ " : line.kind === "removed" ? "- " : "  "}{line.text || " "}{"\n"}</span>)}</pre>}</section>
      </div>}

      {tab === "records" && <div className="document-tab-panel"><div className="document-basis"><div><span>适用范围</span><strong>{selected.scope}</strong></div><div><span>生成依据</span><strong>{selected.metadata?.generationBasis || "人工建立"}</strong></div><div><span>最近更新</span><strong>{selected.updatedAt ? new Date(selected.updatedAt).toLocaleDateString("zh-CN") : "—"}</strong></div></div>{selected.metadata?.legalBasis && <div className="material-legal-basis"><strong>主要法规依据</strong><p>{selected.metadata.legalBasis}</p>{selected.metadata.trigger && <span>适用情形：{selected.metadata.trigger}</span>}</div>}{selected.metadata?.aiPreviewConfirmedAt && <div className="material-legal-basis"><strong>AI 提交记录</strong><p>负责人已于 {new Date(selected.metadata.aiPreviewConfirmedAt).toLocaleString("zh-CN")} 确认提交预览；本次自动脱敏 {selected.metadata.aiRedactionCount || 0} 项，并排除 {selected.metadata.aiExcludedFields?.length || 0} 个可选字段。</p><span>AI 收到的是脱敏内容；真实值在本机恢复后才写入交付草稿。</span></div>}<div className="basis-list">{selected.activityIds.map(id => { const activity = activities.find(item => item.id === id); return activity ? <article key={id}><CheckCircle2 /><div><strong>{activityDisplayName(activity)}</strong><p>{activity.facts.informationTypes.join("、")} · {activity.facts.purposes.join("、")}</p><span>事实确认时间：{activity.facts.confirmedAt ? new Date(activity.facts.confirmedAt).toLocaleString("zh-CN") : "尚未确认"}</span></div></article> : null; })}</div></div>}

      {tab === "records" && <div className="document-tab-panel"><div className="publication-list">{selected.versions?.filter(version => version.publishedAt).map(version => <article key={version.id}><FileCheck2 /><div><strong>{version.versionNumber} · {version.publicationClassification === "current_state_risk_archive" ? "现状归档（含整改项）" : version.status === "effective" ? "合规有效" : "已被替代"}</strong><p>{version.publishChannel || "未记录发布渠道"}{version.publicationEvidence ? ` · ${version.publicationEvidence}` : ""}</p>{version.publicationRiskSummary && <p className="publication-risk-summary">{version.publicationRiskSummary}</p>}<span>发布人：{version.publishedBy || "未记录"} · {new Date(version.publishedAt!).toLocaleString("zh-CN")}</span><small>内容哈希：{version.contentHash}</small></div></article>)}</div>{!selected.versions?.some(version => version.publishedAt) && <EmptyState icon={FileCheck2} title="还没有发布记录" description="草稿确认并发布后，会在这里保存发布人、渠道、证据和内容哈希。" />}</div>}
    </> : <EmptyState icon={History} title="选择一份材料" description="查看材料状态、版本历史和发布记录。" />}</div></div> : <section className="materials-empty">
      <EmptyState icon={FilePlus2} title="还没有合规材料" description="基础材料用于建立日常保护能力；条件触发材料只在相应业务发生时建立；留痕材料用于证明实际办理情况。" action={<button className="button primary" onClick={() => openCreate()}><Plus size={17} /> 建立首份材料</button>} />
      <div className="legal-material-grid">
        <div className="legal-material-card"><FileText /><span>基础与条件触发</span><strong>对外规则、告知与同意</strong><small>消费者、联系人、员工、候选人和访客分别管理；未成年人、敏感信息、出境和事件通知按条件生成。</small></div>
        <div className="legal-material-card"><ShieldCheck /><span>基础材料</span><strong>内部制度与应急指引</strong><small>轻量内部管理要求、个人请求处理指引和安全事件应急要求。</small></div>
        <div className="legal-material-card"><FileCheck2 /><span>条件触发</span><strong>委托与共同处理协议</strong><small>委托服务商处理，或与合作方共同决定处理目的和方式时使用。</small></div>
        <div className="legal-material-card"><History /><span>台账与留痕</span><strong>业务台账和处理记录</strong><small>处理活动、外部接收方、个人请求、同意撤回和安全事件记录。</small></div>
        <Link className="legal-material-card" href="/self-audit"><FileCheck2 /><span>专门模块</span><strong>合规审计自查表</strong><small>在自查模块逐项核对、整改并签署留存。</small><b>{audits.filter(item => item.signedAt).length}/{audits.length} 已签署</b></Link>
        <Link className="legal-material-card" href="/impact-assessments"><GitCompareArrows /><span>条件触发 · 专门模块</span><strong>个人信息保护影响评估</strong><small>敏感信息、自动化决策、委托或提供、出境等情形触发时评估并签署。</small><b>{pipias.filter(item => item.signedAt).length}/{pipias.length} 已签署</b></Link>
      </div>
    </section>}

    {importing && <div className="modal-backdrop" onClick={() => !busy && setImporting(false)}><section className="modal import-material-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">导入已有材料</p><h2>把现有规范纳入版本管理</h2><p>原文件完整保留；提取正文作为 V1 草稿，可继续编辑、复核和发布。</p></div><button className="icon-button" aria-label="关闭" disabled={busy} onClick={() => setImporting(false)}>×</button></div>
      <div className="import-flow-note"><UploadCloud /><div><strong>支持 TXT、Markdown、HTML、DOCX 和 PDF，单个文件不超过 10MB</strong><span>PDF 首版保留原件并由您补充可编辑正文；其他格式会自动提取正文供核对。</span></div></div>
      <label className="field import-file-field"><span>选择原文件</span><input type="file" accept=".txt,.md,.html,.htm,.docx,.pdf" disabled={busy} onChange={event => void previewImportFile(event.target.files?.[0] || null)} /></label>
      {importPreview && <><div className="import-file-summary"><FileText /><div><strong>{importPreview.fileName}</strong><span>{(importPreview.byteSize / 1024).toFixed(1)} KB · SHA-256 {importPreview.contentHash.slice(0, 12)}…</span></div></div><div className={`alert ${importPreview.requiresManualText ? "warning" : "success"}`}>{importPreview.notice}</div>
        <div className="two-column-fields"><label className="field"><span>材料名称</span><input value={importName} onChange={event => setImportName(event.target.value)} /></label><label className="field"><span>材料类型</span><select value={importType} onChange={event => chooseImportType(event.target.value)}>{materialCatalog.map(item => <option key={item.code} value={item.code}>{categoryName[item.category]} · {item.name}</option>)}</select></label></div>
        <div className="two-column-fields"><label className="field"><span>面向人群 / 使用对象</span><select value={importAudienceGroup} onChange={event => setImportAudienceGroup(event.target.value as MaterialAudienceGroup)}>{materialAudienceOptions.filter(item => materialCatalog.find(def => def.code === importType)?.audienceGroups.includes(item.code)).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="field"><span>具体适用对象</span><input value={importAudience} onChange={event => setImportAudience(event.target.value)} /></label></div>
        <label className="field"><span>适用范围</span><input value={importScope} onChange={event => setImportScope(event.target.value)} /></label><div className="two-column-fields"><label className="field"><span>内部说明（选填）</span><input value={importDescription} onChange={event => setImportDescription(event.target.value)} placeholder="例如：现行官网版本、2026 年内部制度" /></label><label className="field"><span>导入或经办人（选填）</span><input value={importCreatedBy} onChange={event => setImportCreatedBy(event.target.value)} /></label></div>
        {!!activities.length && <div className="import-activity-picker"><strong>关联业务（选填）</strong><span>关联后，业务事实变化时会提示复核这份材料。</span><div>{activities.map(activity => <label key={activity.id}><input type="checkbox" checked={importActivityIds.includes(activity.id)} onChange={() => setImportActivityIds(current => current.includes(activity.id) ? current.filter(id => id !== activity.id) : [...current, activity.id])} /> {activityDisplayName(activity)}</label>)}</div></div>}
        <label className="field import-content-field"><span>可编辑正文</span><textarea value={importContent} onChange={event => setImportContent(event.target.value)} placeholder={importPreview.requiresManualText ? "请从 PDF 中复制正文，或填写用于版本管理的完整文本（至少 20 个字）" : "请核对自动提取的正文"} /><small className="field-help">导入后将立即打开这份草稿；发布前请重点核对表格、页眉页脚、签章和附件引用。</small></label>
      </>}
      {error && <div className="alert danger">{error}</div>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setImporting(false)}>取消</button><button className="button primary" disabled={busy || !importFile || !importPreview || importName.trim().length < 2 || !importAudience.trim() || !importScope.trim() || importContent.trim().length < 20} onClick={importDocument}>{busy ? <RefreshCw size={16} className="spin" /> : <UploadCloud size={16} />} {busy ? "正在处理…" : "导入并打开草稿"}</button></div></section></div>}

    {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}><section className="modal material-wizard" ref={materialWizardRef} onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">建立合规材料 · 第 {step} 步，共 3 步</p><h2>{step === 1 ? "面向谁、建什么材料？" : step === 2 ? "用一份材料覆盖哪些业务？" : "核对生成范围"}</h2></div><button className="icon-button" onClick={() => setCreating(false)}>×</button></div><div className="wizard-progress"><span className={step >= 1 ? "active" : ""} /><span className={step >= 2 ? "active" : ""} /><span className={step >= 3 ? "active" : ""} /></div>
      {coverageTarget && step === 1 && <div className="alert warning coverage-target"><AlertTriangle size={17} /><div><strong>正在补齐：{materialAudienceName(coverageTarget)}材料</strong><p>系统已按覆盖缺口预选人群、基础材料及匹配业务；如切换人群，本次将不能消除原覆盖缺口。</p></div></div>}
      {step === 1 && <><div className="selection-help"><strong>先确定这份材料给谁用，再选类型</strong><span>前五类是对外告知的对象，应按人群分别建立；最后一类"单位内部和合作方"用于制度、协议、台账和办理记录，不面向具体个人，可覆盖全部业务。"基础材料"建议建立；"条件触发"只在对应情形发生时建立。</span></div><div className="wizard-two-col"><div className="wizard-col"><h3>面向人群 / 场景</h3><div className="audience-choice-grid single"><span className="audience-group-label">对外告知对象</span>{materialAudienceOptions.filter(item => item.external).map(item => <button key={item.code} className={audienceGroup === item.code ? "audience-choice selected" : "audience-choice"} onClick={() => chooseAudienceGroup(item.code)}><div><strong>{item.name}</strong><p>{item.description}</p></div>{audienceGroup === item.code && <Check size={17} />}</button>)}<span className="audience-group-label">内部与合作方</span>{materialAudienceOptions.filter(item => !item.external).map(item => <button key={item.code} className={audienceGroup === item.code ? "audience-choice selected" : "audience-choice"} onClick={() => chooseAudienceGroup(item.code)}><div><strong>{item.name}</strong><p>{item.description}</p></div>{audienceGroup === item.code && <Check size={17} />}</button>)}</div></div><div className="wizard-col"><h3>材料类型</h3><div className="material-type-groups">{(["external", "internal", "agreement", "register", "record"] as MaterialCategory[]).map(category => { const definitions = availableDefinitions.filter(item => item.category === category); return definitions.length ? <section key={category}><h3>{categoryName[category]}</h3><div className="material-type-grid single">{definitions.map(item => <button key={item.code} className={type === item.code ? "material-type selected" : "material-type"} onClick={() => chooseType(item.code)}><div><span className={`material-requirement ${item.requirement || "basic"}`}>{materialRequirementName[item.requirement || "basic"]}</span><strong>{item.name}</strong><p>{item.description}</p>{item.trigger && <small>适用情形：{item.trigger}</small>}</div>{type === item.code && <Check size={17} />}</button>)}</div></section> : null; })}</div></div></div></>}
      {step === 2 && <><div className="selection-help"><strong>默认合并同一人群下的相关业务</strong><span>可一次选择多项业务写入同一份材料。系统未自动识别的自定义主体仍可选择；首次选择即表示您确认该业务适用于当前人群，系统会保留这次人工映射记录。</span></div><div className="activity-select-list">{activities.map(activity => { const factsReady = activity.completeness === 1 && !!activity.facts.confirmedAt; const audienceReady = activityMatchesAudience(activity, audienceGroup); const manuallyConfirmed = audienceOverrideActivityIds.includes(activity.id); const disabled = !factsReady; return <button key={activity.id} disabled={disabled} className={`${activityIds.includes(activity.id) ? "activity-select selected" : "activity-select"}${!audienceReady ? " incompatible" : ""}${manuallyConfirmed ? " manual-confirmed" : ""}`} onClick={() => toggleActivityForAudience(activity)}><span className="check-box">{activityIds.includes(activity.id) && <Check size={14} />}</span><div><strong>{activityDisplayName(activity)}</strong><p>{activity.description}</p><small>{!factsReady ? `仅完成 ${Math.round(activity.completeness * 100)}%，请先完善` : audienceReady ? "业务事实已确认，可与同人群业务合并" : manuallyConfirmed ? `已由您确认属于“${materialAudienceName(audienceGroup)}”` : `系统未自动识别；选择即可确认属于“${materialAudienceName(audienceGroup)}”`}</small></div></button>; })}</div>{!activities.length && <div className="alert warning">还没有业务记录，请先到“我的业务”建立并确认业务。</div>}{activities.length > 0 && !activities.some(activity => activityMatchesAudience(activity, audienceGroup)) && audienceGroup !== "internal" && <div className="alert warning">当前没有自动识别到属于“{materialAudienceName(audienceGroup)}”的业务；如业务确实适用，可直接选择并人工确认。</div>}</>}
      {step === 3 && <div className="material-review"><div className="review-card"><span>{materialAudienceName(audienceGroup)} · {materialRequirementName[definition.requirement || "basic"]}</span><strong>{definition.name}</strong><p>{definition.description}</p>{definition.trigger && <small>适用情形：{definition.trigger}</small>}{definition.legalBasis && <small>主要依据：{definition.legalBasis}</small>}</div><div className="two-column-fields"><label className="field"><span>材料名称</span><input value={name} onChange={event => setName(event.target.value)} /><small className="field-help">对外发布时请修改为正式名称，如"隐私政策""个人信息保护规则"或"员工个人信息告知书"。</small></label><label className="field"><span>具体适用对象</span><input value={audience} onChange={event => setAudience(event.target.value)} /></label></div><label className="field"><span>适用范围</span><input value={scope} onChange={event => setScope(event.target.value)} /></label><label className="field"><span>内部说明（选填）</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label><div className="generation-mode-picker"><button className={generationMode === "ai" ? "selected" : ""} disabled={!aiStatus.configured} onClick={() => setGenerationMode("ai")}><Sparkles /><div><strong>AI生成完整草稿</strong><p>{aiStatus.configured ? `${aiStatus.activeProvider} · ${aiStatus.activeModel}；基于已确认事实完善结构和表达。` : "尚未配置可用AI服务。"}</p></div>{generationMode === "ai" && <Check />}</button><button className={generationMode === "template" ? "selected" : ""} onClick={() => setGenerationMode("template")}><FileText /><div><strong>生成基础模板</strong><p>不调用外部AI，按确定性模板形成可编辑底稿。</p></div>{generationMode === "template" && <Check />}</button></div>{!aiStatus.configured && <div className="ai-config-shortcut"><span>希望使用AI生成完整草稿？先完成服务配置。</span><Link href="/settings/ai">前往 AI 设置</Link></div>}<div className="generation-preview"><strong>一份材料将覆盖以下内容</strong><div className="module-tags">{definition.defaultModules.map(module => <span key={module}><Check size={12} /> {module}</span>)}</div><p>覆盖 {selectedActivities.length} 项业务：{selectedActivities.map(activityDisplayName).join("、") || "尚未选择"}</p></div>{missingFacts.length > 0 && <div className="alert warning">存在尚未完整确认的业务，请返回重新选择。</div>}{error && <div className="alert danger">{error}</div>}</div>}
      <div className="modal-actions wizard-actions"><button className="button secondary" onClick={() => step === 1 ? setCreating(false) : setStep(current => current - 1)}>{step > 1 && <ChevronLeft size={16} />}{step === 1 ? "取消" : "上一步"}</button>{step < 3 ? <button className="button primary" disabled={step === 2 && activityIds.length === 0} onClick={() => setStep(current => current + 1)}>下一步 <ChevronRight size={16} /></button> : <button className="button primary" disabled={busy || previewBusy || name.length < 2 || !scope || !audience || activityIds.length === 0 || missingFacts.length > 0} onClick={handleGenerate}>{busy || previewBusy ? <RefreshCw size={16} className="spin" /> : generationMode === "ai" ? <Eye size={16} /> : <FilePlus2 size={16} />} {previewBusy ? "正在准备预览…" : busy ? "正在生成…" : generationMode === "ai" ? "预览将发送给AI的内容" : "生成基础模板"}</button>}</div>
    </section></div>}

    {aiPreview && <div className="modal-backdrop ai-preview-backdrop" onClick={() => !busy && setAiPreview(null)}><section className="modal ai-preview-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">AI提交前确认</p><h2>本次将发送以下脱敏内容</h2><p>取消不必要字段后再确认。页面展示的内容与服务端实际提交内容一致。</p></div><button className="icon-button" aria-label="关闭" disabled={busy} onClick={() => setAiPreview(null)}>×</button></div><div className="ai-redaction-summary"><LockKeyhole /><div><strong>已自动脱敏 {aiPreview.redactionCount} 项</strong><p>{aiPreview.redactionLabels.join("、") || "本次未识别到需要替换的直接标识信息"}</p><span>{aiPreview.restorationNotice}</span></div></div><div className="ai-preview-layout"><section className="ai-field-control"><div className="ai-preview-section-title"><strong>选择发送字段</strong><span>核心材料要求、业务名称、涉及人员、信息种类和处理目的始终保留。</span></div>{(["企业信息", "业务信息"] as const).map(group => <div className="ai-field-group" key={group}><h3>{group}</h3>{aiPreview.fields.filter(field => field.group === group).map(field => <label key={field.code}><input type="checkbox" checked={field.included} disabled={previewBusy || busy} onChange={() => void togglePreviewField(field.code, field.included)} /><span><strong>{field.label}</strong><small>{field.description}</small></span></label>)}</div>)}</section><section className="ai-payload-preview"><div className="ai-preview-section-title"><strong>实际发送内容</strong><span>真实单位名称、联系人、联系方式，以及识别出的姓名、邮箱、手机、固定电话和身份证件号码均已替换为占位符。</span></div><pre>{JSON.stringify(aiPreview.payload, null, 2)}</pre></section></div>{previewBusy && <div className="ai-preview-refresh"><RefreshCw className="spin" /> 正在按新的字段范围刷新预览…</div>}{error && <div className="alert danger">{error}</div>}<div className="modal-actions ai-preview-actions"><button className="button secondary" disabled={busy} onClick={() => setAiPreview(null)}>返回修改</button><button className="button primary" disabled={busy || previewBusy} onClick={() => void create(true)}>{busy ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />} {busy ? "AI正在起草…" : "确认并发送给AI"}</button></div></section></div>}

    {editor && selected && <div className="modal-backdrop document-modal-backdrop" onClick={() => setEditor(null)}>
      <section className={`modal editor-modal ${editor.mode === "view" ? "reader-modal" : ""}`} onClick={event => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">{editor.justCreated ? selected.metadata?.generationMethod === "import" ? "材料已导入 · 请核对草稿" : "材料已生成 · 请核对草稿" : editor.mode === "view" ? "版本内容（只读）" : editor.mode === "edit" ? "编辑现有草稿" : "准备新版本"}</p><h2>{selected.name}</h2></div><button className="icon-button" aria-label="关闭" onClick={() => setEditor(null)}>×</button></div>
        {editor.mode === "view" ? <div className="document-reader-wrap"><article className="document-reader"><pre>{content}</pre></article></div> : <div className="document-editor-body">
          <div className="two-column-fields"><label className="field"><span>修改说明</span><input value={summary} onChange={event => setSummary(event.target.value)} /></label><label className="field"><span>创建或经办人</span><input value={createdBy} onChange={event => setCreatedBy(event.target.value)} placeholder="例如：张三" /></label></div>
          {editor.justCreated && <div className="alert success document-created-note">{selected.metadata?.generationMethod === "import" ? "已为您打开刚刚导入的草稿。原文件已保留；请核对提取正文后保存或发布。" : "已为您打开刚刚生成的草稿。核对并按需修改后，可保存草稿或直接进入负责人发布确认。"}</div>}
          <label className="field document-editor-field"><span>完整内容</span><textarea className="document-editor" value={content} onChange={event => setContent(event.target.value)} /></label>
          {error && <div className="alert danger">{error}</div>}
        </div>}
        <div className="modal-actions"><button className="button secondary" onClick={() => setEditor(null)}>关闭</button>{editor.mode !== "view" && <><button className="button secondary" disabled={busy || summary.length < 2 || content.length < 20} onClick={() => void saveRevision("close")}><FileClock size={16} /> 保存草稿</button><button className="button primary" disabled={busy || summary.length < 2 || content.length < 20} onClick={() => void saveRevision("publish")}><UploadCloud size={16} /> 保存并发布</button></>}</div>
      </section>
    </div>}

    {workflow && <div className="modal-backdrop" onClick={() => setWorkflow(null)}><section className="modal workflow-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">{workflow.version.versionNumber}</p><h2>确认发布状态</h2></div><button className="icon-button" onClick={() => setWorkflow(null)}>×</button></div>
      <div className="alert warning">发布后该版本正文将锁定。如需修改，应创建新版本。{selected?.type === "privacy_notice" || selected?.type === "b2b_contact_notice" || selected?.type === "employee_notice" || selected?.type === "candidate_notice" || selected?.type === "visitor_notice" ? " 请确认材料名称已修改为正式对外名称（如“隐私政策”），而非内部代号。" : ""}</div>
      {publicationRisks.length > 0 && <div className="publication-risk-panel"><strong>发现 {publicationRisks.length} 项有效发布阻断条件</strong><p>这些事项不能通过填写一段说明直接豁免。请按下方入口补齐事实或程序；也可以先归档当前实际情况。</p><ul>{publicationRisks.map(item => { const action = publicationRiskAction(item); return <li key={item}><span>{item}</span>{action ? <Link href={action.href}>{action.label} <ChevronRight size={13} /></Link> : <button type="button" onClick={() => { setWorkflow(null); if (activeRevision) openRevision(activeRevision); }}>返回编辑正文 <ChevronRight size={13} /></button>}</li>; })}</ul><div className="choice-grid cols-2"><button className={publicationMode === "risk_archive" ? "choice selected" : "choice"} onClick={() => setPublicationMode("risk_archive")}><div><strong>归档现状（含整改项）</strong><small>保留事实和版本记录，但不标记为合规有效材料。</small></div>{publicationMode === "risk_archive" && <Check size={16} />}</button><button className="choice disabled" disabled><div><strong>发布为合规有效版本</strong><small>阻断条件全部解决后才会开放。</small></div><LockKeyhole size={16} /></button></div><label className="field"><span>现状归档说明 <em>选填</em></span><textarea value={riskDecisionNote} onChange={event => setRiskDecisionNote(event.target.value)} placeholder="可记录整改负责人、计划完成时间或现状依据" /></label></div>}
      <label className="field"><span>发布人或负责人</span><input value={actor} onChange={event => setActor(event.target.value)} placeholder="例如：负责人姓名" /></label><label className="field"><span>发布渠道</span><input value={channel} onChange={event => setChannel(event.target.value)} placeholder={publicationMode === "risk_archive" ? "例如：内部合规档案、整改台账" : "例如：公司官网、App、员工系统或合同附件"} /></label><label className="field"><span>发布证据或地址（选填）</span><textarea value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="例如：页面地址、文件编号或截图存放位置" /></label>{error && <div className="alert danger">{error}</div>}<div className="modal-actions"><button className="button secondary" onClick={() => setWorkflow(null)}>取消</button><button className="button primary" disabled={busy || !actor || !channel || (publicationRisks.length > 0 && publicationMode === "effective")} onClick={runWorkflow}><UploadCloud size={16} /> {publicationMode === "risk_archive" ? "确认归档现状" : "确认发布有效版本"}</button></div>
    </section></div>}

    {confirmingDelete && selected && <div className="modal-backdrop" onClick={() => !busy && setConfirmingDelete(false)}><section className="modal workflow-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">删除材料</p><h2>{selected.name}</h2></div><button className="icon-button" disabled={busy} onClick={() => setConfirmingDelete(false)}>×</button></div><div className="alert danger">将永久删除这份材料及其 {(selected.versions || []).length} 个草稿版本，操作不可恢复。只有从未发布过的材料可以删除；已有发布记录的材料属于合规证据，系统会拒绝删除。</div><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>取消</button><button className="button danger" disabled={busy} onClick={removeDocument}>{busy ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />} 确认删除</button></div></section></div>}
  </>;
}
