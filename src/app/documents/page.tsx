"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileCheck2, FileClock,
  Eye, FilePlus2, FileText, GitCompareArrows, History, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, UploadCloud
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { materialCatalog, materialRequirementName, materialTypeName, type MaterialCategory } from "@/lib/materials";
import { activityMatchesAudience, classifyActivityAudienceGroups, materialAudienceName, materialAudienceOptions } from "@/lib/material-audience";
import type { AuditInstance, BusinessDocument, DocumentChangeImpact, DocumentVersion, MaterialAudienceGroup, PipiaInstance, ProcessingActivity } from "@/lib/types";

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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [activities, setActivities] = useState<ProcessingActivity[]>([]);
  const [audits, setAudits] = useState<AuditInstance[]>([]);
  const [pipias, setPipias] = useState<PipiaInstance[]>([]);
  const [aiStatus, setAiStatus] = useState<MaterialAiStatus>({ configured: false, activeProvider: null, activeModel: null });
  const [selected, setSelected] = useState<BusinessDocument | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [creating, setCreating] = useState(false);
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
  const [editor, setEditor] = useState<{ mode: "view" | "new" | "edit"; versionId?: string } | null>(null);
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [workflow, setWorkflow] = useState<{ version: DocumentVersion } | null>(null);
  const [actor, setActor] = useState("");
  const [channel, setChannel] = useState("");
  const [evidence, setEvidence] = useState("");
  const [compareIds, setCompareIds] = useState<[string, string]>(["", ""]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  const load = async (preferredId?: string) => {
    try {
      const [docResponse, scenarioResponse, auditResponse, pipiaResponse, aiResponse] = await Promise.all([
        fetch("/api/documents", { cache: "no-store" }),
        fetch("/api/scenarios", { cache: "no-store" }),
        fetch("/api/audits", { cache: "no-store" }),
        fetch("/api/pipia", { cache: "no-store" }),
        fetch("/api/settings/ai", { cache: "no-store" }).catch(() => null)
      ]);
      if (!docResponse.ok || !scenarioResponse.ok || !auditResponse.ok || !pipiaResponse.ok) throw new Error("LOAD_FAILED");
      const docs = await docResponse.json();
      const scenarioData = await scenarioResponse.json();
      const auditData = await auditResponse.json();
      const pipiaData = await pipiaResponse.json();
      setDocuments(docs); setActivities(scenarioData.activities || []);
      setAudits(auditData || []); setPipias(pipiaData.instances || []); setError("");
      if (aiResponse?.ok) {
        const aiData = await aiResponse.json();
        setAiStatus(aiData); setGenerationMode(current => current === "ai" || !aiData.configured ? current : "ai");
      }
      setSelected(current => docs.find((item: BusinessDocument) => item.id === (preferredId || current?.id)) || docs[0] || null);
    } catch {
      setError("暂时无法读取材料数据，请稍后刷新页面。");
    }
  };
  useEffect(() => { void load(); }, []);

  const definition = useMemo(() => materialCatalog.find(item => item.code === type)!, [type]);
  const availableDefinitions = useMemo(() => materialCatalog.filter(item => item.audienceGroups.includes(audienceGroup)), [audienceGroup]);
  const selectedActivities = useMemo(() => activities.filter(item => activityIds.includes(item.id)), [activities, activityIds]);
  const missingFacts = selectedActivities.filter(item => item.completeness < 1 || !item.facts.confirmedAt);
  const activeRevision = selected?.versions?.find(version => ["draft", "under_review", "approved"].includes(version.status));
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

  const openCreate = () => {
    const initial = materialCatalog.find(item => item.code === "b2b_contact_notice")!;
    setAudienceGroup("business_contact");
    setType(initial.code); setName(initial.name); setAudience(initial.defaultAudience); setScope(initial.defaultScope);
    setDescription(""); setActivityIds([]); setAiPreview(null); setGenerationMode(aiStatus.configured ? "ai" : "template"); setStep(1); setError(""); setCreating(true);
  };
  const chooseAudienceGroup = (code: MaterialAudienceGroup) => {
    const next = materialCatalog.find(item => item.audienceGroups.includes(code))!;
    setAudienceGroup(code); setActivityIds([]);
    setType(next.code); setName(next.name); setAudience(next.defaultAudience); setScope(next.defaultScope);
  };
  const chooseType = (code: string) => {
    const next = materialCatalog.find(item => item.code === code)!;
    setType(code); setName(next.name); setAudience(next.defaultAudience); setScope(next.defaultScope);
  };
  const toggleActivity = (id: string) => setActivityIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const create = async (aiPreviewConfirmed = false) => {
    setBusy(true); setError("");
    const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, scope, type, audienceGroup, audience, description, activityIds, generationMode, excludedAiFields: aiPreview?.excludedFields || [], aiPreviewConfirmed }) });
    const payload = await response.json();
    if (response.ok) { await load(payload.id); setAiPreview(null); setCreating(false); setTab("versions"); }
    else setError(payload.message || "生成材料失败，请稍后重试。");
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

  const saveRevision = async () => {
    if (!selected || !editor) return;
    setBusy(true); setError("");
    const url = editor.mode === "edit" ? `/api/documents/${selected.id}/versions/${editor.versionId}` : `/api/documents/${selected.id}/versions`;
    const response = await fetch(url, { method: editor.mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, changeSummary: summary, createdBy }) });
    const payload = await response.json();
    if (response.ok) { await load(selected.id); setEditor(null); setTab("versions"); }
    else setError(payload.message || "无法保存草稿。");
    setBusy(false);
  };

  const openPublish = (version: DocumentVersion) => {
    setActor(version.publishedBy || ""); setChannel(version.publishChannel || ""); setEvidence(version.publicationEvidence || "");
    setError(""); setWorkflow({ version });
  };

  const runWorkflow = async () => {
    if (!selected || !workflow) return;
    setBusy(true); setError("");
    const base = `/api/documents/${selected.id}/versions/${workflow.version.id}`;
    const body = { publishedBy: actor, publishChannel: channel, publicationEvidence: evidence };
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

  return <>
    <section className="page-heading"><div><p className="eyebrow">合规材料</p><h1>材料版本中心</h1><p>生成并核对草稿后直接发布；业务变化时提示更新，同时保留每个历史版本和发布记录。</p></div><button className="button primary" onClick={openCreate}><Plus size={17} /> 生成材料</button></section>
    {hasActionItems && <section className="action-items">
      {needsConfirmDocs.length > 0 && <div className="action-item"><AlertTriangle /><div><strong>{needsConfirmDocs.length} 份材料需要确认</strong><span>{needsConfirmDocs.map(item => item.name).slice(0, 3).join("、")}{needsConfirmDocs.length > 3 ? " 等" : ""}：业务发生变化，请核对是否需要修订。</span></div></div>}
      {draftDocs.length > 0 && <div className="action-item"><Clock3 /><div><strong>{draftDocs.length} 份草稿待发布</strong><span>{draftDocs.map(item => item.name).slice(0, 3).join("、")}{draftDocs.length > 3 ? " 等" : ""}：草稿不能作为已建立的正式材料，请核对后直接发布。</span></div></div>}
      {uncoveredGroups.map(item => <div className="action-item" key={item.code}><AlertTriangle /><div><strong>{item.name}尚无有效材料覆盖</strong><span>{item.uncoveredCount} 项相关业务没有已发布的对外告知；同一人群可用一份材料覆盖多项业务。</span></div></div>)}
    </section>}
    {error && !creating && !editor && !workflow && <div className="alert danger">{error}</div>}

    {documents.length ? <div className="document-layout lifecycle-layout"><div className="document-list">{documents.map(document => <button key={document.id} className={selected?.id === document.id ? "document-row selected" : "document-row"} onClick={() => chooseDocument(document)}><div className="doc-icon"><FileText /></div><div><strong>{document.name}</strong><span>{materialAudienceName(document.audienceGroup)} · {materialTypeName(document.type)}</span><small>{document.currentVersion ? `${document.currentVersion.versionNumber} 当前有效` : "尚未发布"} · {healthText[document.healthStatus]}</small></div><StatusBadge status={document.healthStatus} /></button>)}</div><div className="document-detail lifecycle-detail">{selected ? <>
      <div className="detail-header"><div><p className="eyebrow">{materialAudienceName(selected.audienceGroup)} · {materialTypeName(selected.type)} · {healthText[selected.healthStatus]}</p><h2>{selected.name}</h2><p>具体适用对象：{selected.audience || selected.scope}</p></div><div className="detail-header-actions">{activeRevision?.status === "draft" ? <button className="button secondary" onClick={() => openRevision(activeRevision)}><FileClock size={16} /> 继续编辑草稿</button> : !activeRevision && <button className="button secondary" onClick={() => openRevision()}><FilePlus2 size={16} /> 准备新版本</button>}{!selected.currentVersionId && !(selected.versions || []).some(version => version.publishedAt) && <button className="button danger secondary" disabled={busy} onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> 删除材料</button>}</div></div>
      {selected.metadata?.aiFallbackReason && <div className="material-health-alert"><AlertTriangle /><div><strong>本次已使用基础模板</strong><p>AI完整草稿暂未生成：{selected.metadata.aiFallbackReason}。现有草稿仍可编辑和发布，也可以在配置恢复后重新生成。</p></div></div>}
      {!!selected.metadata?.pendingFacts?.length && <div className="material-health-alert"><AlertTriangle /><div><strong>AI标记了发布前待确认事项</strong><p>{selected.metadata.pendingFacts.join("；")}</p></div></div>}
      {selected.reviewReason && <div className="material-health-alert"><AlertTriangle /><div><strong>业务变化后需要确认这份材料</strong><p>{selected.reviewReason}</p></div></div>}
      <nav className="document-tabs">{(["overview", "versions", "records"] as DetailTab[]).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{({ overview: "当前概况", versions: "版本与对比", records: "记录与依据" } as Record<DetailTab, string>)[item]}</button>)}</nav>

      {tab === "overview" && <div className="document-tab-panel"><div className="document-basis"><div><span>当前有效版本</span><strong>{selected.currentVersion?.versionNumber || "尚未发布"}</strong></div><div><span>面向人群/场景</span><strong>{materialAudienceName(selected.audienceGroup)}</strong></div><div><span>覆盖业务</span><strong>{selected.activityIds.length} 项</strong></div></div>{selected.description && <p className="document-description">{selected.description}</p>}{selected.currentVersion ? <article className="current-version-card"><div><FileCheck2 /><div><strong>{selected.currentVersion.versionNumber} 正式版本</strong><span>{selected.currentVersion.publishedAt ? new Date(selected.currentVersion.publishedAt).toLocaleString("zh-CN") : ""}</span></div></div><button className="button secondary small" onClick={() => { setContent(selected.currentVersion!.content); setSummary(selected.currentVersion!.changeSummary); setEditor({ mode: "view", versionId: selected.currentVersion!.id }); }}>查看完整内容</button></article> : <div className="alert warning">目前只有草稿，尚不能作为已完成的正式材料。</div>}
        {!!selected.pendingImpacts?.length && <section className="impact-section"><h3>待处理的业务变化</h3>{selected.pendingImpacts.map(impact => <article key={impact.id} className="impact-card"><AlertTriangle /><div><strong>{impact.reason}</strong><p>建议核对：{impact.affectedSections.join("、")}</p><small>{new Date(impact.createdAt).toLocaleString("zh-CN")}{impact.dueAt ? ` · 计划于 ${new Date(impact.dueAt).toLocaleDateString("zh-CN")} 前处理` : ""}</small></div><div className="impact-actions">{!activeRevision && <button className="button small primary" onClick={() => openRevision()}>创建草稿</button>}<button className="text-link" disabled={busy} onClick={() => handleImpact(impact, "no_change")}>无需修改</button><button className="text-link" disabled={busy} onClick={() => handleImpact(impact, "defer")}>暂缓处理</button></div></article>)}</section>}
      </div>}

      {tab === "versions" && <div className="document-tab-panel"><div className="version-list">{selected.versions?.map(version => <article className="version-card" key={version.id}><div className="version-line"><div><span className="version-number">{version.versionNumber}</span><StatusBadge status={version.status} /></div><time>{new Date(version.createdAt).toLocaleDateString("zh-CN")}</time></div><p>{version.changeSummary}</p><div className="version-meta"><span>创建人：{version.createdBy || "未填写"}</span>{version.approvedBy && <span>历史批准记录：{version.approvedBy}（{version.approverRole}）</span>}{version.contentHash && <span>哈希：{version.contentHash.slice(0, 12)}…</span>}</div><div className="version-actions"><button className="text-link" onClick={() => { setContent(version.content); setSummary(version.changeSummary); setEditor({ mode: "view", versionId: version.id }); }}><FileText size={15} /> 查看内容</button>{version.status === "draft" && <button className="text-link" onClick={() => openRevision(version)}><FileClock size={14} /> 编辑草稿</button>}{["draft", "under_review", "approved"].includes(version.status) && <button className="button small primary" onClick={() => openPublish(version)}><UploadCloud size={14} /> 直接发布</button>}</div></article>)}</div>
        <details className="compare-details"><summary><GitCompareArrows size={15} /> 逐行对比任意两个版本</summary><div className="compare-picker"><label><span>较早版本</span><select value={left?.id || ""} onChange={event => setCompareIds([event.target.value, right?.id || ""])}>{compareVersions.map(version => <option key={version.id} value={version.id}>{version.versionNumber} · {version.changeSummary}</option>)}</select></label><GitCompareArrows /><label><span>较新版本</span><select value={right?.id || ""} onChange={event => setCompareIds([left?.id || "", event.target.value])}>{compareVersions.map(version => <option key={version.id} value={version.id}>{version.versionNumber} · {version.changeSummary}</option>)}</select></label></div>{left?.id === right?.id ? <div className="alert warning">请选择两个不同版本。</div> : <pre className="version-diff">{diff.map((line, index) => <span key={`${index}-${line.kind}`} className={`diff-${line.kind}`}>{line.kind === "added" ? "+ " : line.kind === "removed" ? "- " : "  "}{line.text || " "}{"\n"}</span>)}</pre>}</details>
      </div>}

      {tab === "records" && <div className="document-tab-panel"><div className="document-basis"><div><span>适用范围</span><strong>{selected.scope}</strong></div><div><span>生成依据</span><strong>{selected.metadata?.generationBasis || "人工建立"}</strong></div><div><span>最近更新</span><strong>{selected.updatedAt ? new Date(selected.updatedAt).toLocaleDateString("zh-CN") : "—"}</strong></div></div>{selected.metadata?.legalBasis && <div className="material-legal-basis"><strong>主要法规依据</strong><p>{selected.metadata.legalBasis}</p>{selected.metadata.trigger && <span>适用情形：{selected.metadata.trigger}</span>}</div>}{selected.metadata?.aiPreviewConfirmedAt && <div className="material-legal-basis"><strong>AI 提交记录</strong><p>负责人已于 {new Date(selected.metadata.aiPreviewConfirmedAt).toLocaleString("zh-CN")} 确认提交预览；本次自动脱敏 {selected.metadata.aiRedactionCount || 0} 项，并排除 {selected.metadata.aiExcludedFields?.length || 0} 个可选字段。</p><span>AI 收到的是脱敏内容；真实值在本机恢复后才写入交付草稿。</span></div>}<div className="basis-list">{selected.activityIds.map(id => { const activity = activities.find(item => item.id === id); return activity ? <article key={id}><CheckCircle2 /><div><strong>{activity.name}</strong><p>{activity.facts.informationTypes.join("、")} · {activity.facts.purposes.join("、")}</p><span>事实确认时间：{activity.facts.confirmedAt ? new Date(activity.facts.confirmedAt).toLocaleString("zh-CN") : "尚未确认"}</span></div></article> : null; })}</div></div>}

      {tab === "records" && <div className="document-tab-panel"><div className="publication-list">{selected.versions?.filter(version => version.publishedAt).map(version => <article key={version.id}><FileCheck2 /><div><strong>{version.versionNumber} · {version.status === "effective" ? "当前有效" : "已被替代"}</strong><p>{version.publishChannel || "未记录发布渠道"}{version.publicationEvidence ? ` · ${version.publicationEvidence}` : ""}</p><span>发布人：{version.publishedBy || "未记录"} · {new Date(version.publishedAt!).toLocaleString("zh-CN")}</span><small>内容哈希：{version.contentHash}</small></div></article>)}</div>{!selected.versions?.some(version => version.publishedAt) && <EmptyState icon={FileCheck2} title="还没有发布记录" description="草稿确认并发布后，会在这里保存发布人、渠道、证据和内容哈希。" />}</div>}
    </> : <EmptyState icon={History} title="选择一份材料" description="查看材料状态、版本历史和发布记录。" />}</div></div> : <section className="materials-empty">
      <EmptyState icon={FilePlus2} title="还没有合规材料" description="基础材料用于建立日常保护能力；条件触发材料只在相应业务发生时建立；留痕材料用于证明实际办理情况。" action={<button className="button primary" onClick={openCreate}><Plus size={17} /> 建立首份材料</button>} />
      <div className="legal-material-grid">
        <div className="legal-material-card"><FileText /><span>基础与条件触发</span><strong>对外规则、告知与同意</strong><small>消费者、联系人、员工、候选人和访客分别管理；未成年人、敏感信息、出境和事件通知按条件生成。</small></div>
        <div className="legal-material-card"><ShieldCheck /><span>基础材料</span><strong>内部制度与应急指引</strong><small>轻量内部管理要求、个人请求处理指引和安全事件应急要求。</small></div>
        <div className="legal-material-card"><FileCheck2 /><span>条件触发</span><strong>委托与共同处理协议</strong><small>委托服务商处理，或与合作方共同决定处理目的和方式时使用。</small></div>
        <div className="legal-material-card"><History /><span>台账与留痕</span><strong>业务台账和处理记录</strong><small>处理活动、外部接收方、个人请求、同意撤回和安全事件记录。</small></div>
        <Link className="legal-material-card" href="/self-audit"><FileCheck2 /><span>专门模块</span><strong>合规审计自查表</strong><small>在自查模块逐项核对、整改并签署留存。</small><b>{audits.filter(item => item.signedAt).length}/{audits.length} 已签署</b></Link>
        <Link className="legal-material-card" href="/impact-assessments"><GitCompareArrows /><span>条件触发 · 专门模块</span><strong>个人信息保护影响评估</strong><small>敏感信息、自动化决策、委托或提供、出境等情形触发时评估并签署。</small><b>{pipias.filter(item => item.signedAt).length}/{pipias.length} 已签署</b></Link>
      </div>
    </section>}

    {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}><section className="modal material-wizard" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">建立合规材料 · 第 {step} 步，共 3 步</p><h2>{step === 1 ? "面向谁、建什么材料？" : step === 2 ? "用一份材料覆盖哪些业务？" : "核对生成范围"}</h2></div><button className="icon-button" onClick={() => setCreating(false)}>×</button></div><div className="wizard-progress"><span className={step >= 1 ? "active" : ""} /><span className={step >= 2 ? "active" : ""} /><span className={step >= 3 ? "active" : ""} /></div>
      {step === 1 && <><div className="selection-help"><strong>先确定这份材料给谁用，再选类型</strong><span>前五类是对外告知的对象，应按人群分别建立；最后一类"单位内部和合作方"用于制度、协议、台账和办理记录，不面向具体个人，可覆盖全部业务。"基础材料"建议建立；"条件触发"只在对应情形发生时建立。</span></div><div className="wizard-two-col"><div className="wizard-col"><h3>面向人群 / 场景</h3><div className="audience-choice-grid single"><span className="audience-group-label">对外告知对象</span>{materialAudienceOptions.filter(item => item.external).map(item => <button key={item.code} className={audienceGroup === item.code ? "audience-choice selected" : "audience-choice"} onClick={() => chooseAudienceGroup(item.code)}><div><strong>{item.name}</strong><p>{item.description}</p></div>{audienceGroup === item.code && <Check size={17} />}</button>)}<span className="audience-group-label">内部与合作方</span>{materialAudienceOptions.filter(item => !item.external).map(item => <button key={item.code} className={audienceGroup === item.code ? "audience-choice selected" : "audience-choice"} onClick={() => chooseAudienceGroup(item.code)}><div><strong>{item.name}</strong><p>{item.description}</p></div>{audienceGroup === item.code && <Check size={17} />}</button>)}</div></div><div className="wizard-col"><h3>材料类型</h3><div className="material-type-groups">{(["external", "internal", "agreement", "register", "record"] as MaterialCategory[]).map(category => { const definitions = availableDefinitions.filter(item => item.category === category); return definitions.length ? <section key={category}><h3>{categoryName[category]}</h3><div className="material-type-grid single">{definitions.map(item => <button key={item.code} className={type === item.code ? "material-type selected" : "material-type"} onClick={() => chooseType(item.code)}><div><span className={`material-requirement ${item.requirement || "basic"}`}>{materialRequirementName[item.requirement || "basic"]}</span><strong>{item.name}</strong><p>{item.description}</p>{item.trigger && <small>适用情形：{item.trigger}</small>}</div>{type === item.code && <Check size={17} />}</button>)}</div></section> : null; })}</div></div></div></>}
      {step === 2 && <><div className="selection-help"><strong>默认合并同一人群下的相关业务</strong><span>可一次选择多项业务写入同一份材料。只有告知时点、渠道或责任主体确实不同，才建议另建一份。</span></div><div className="activity-select-list">{activities.map(activity => { const factsReady = activity.completeness === 1 && !!activity.facts.confirmedAt; const audienceReady = activityMatchesAudience(activity, audienceGroup); const disabled = !factsReady || !audienceReady; return <button key={activity.id} disabled={disabled} className={`${activityIds.includes(activity.id) ? "activity-select selected" : "activity-select"}${!audienceReady ? " incompatible" : ""}`} onClick={() => toggleActivity(activity.id)}><span className="check-box">{activityIds.includes(activity.id) && <Check size={14} />}</span><div><strong>{activity.name}</strong><p>{activity.description}</p><small>{!audienceReady ? audienceGroup === "internal" ? "" : `不属于“${materialAudienceName(audienceGroup)}”，应放入对应人群的材料` : factsReady ? "业务事实已确认，可与同人群业务合并" : `仅完成 ${Math.round(activity.completeness * 100)}%，请先完善`}</small></div></button>; })}</div>{!activities.length && <div className="alert warning">还没有业务记录，请先到“我的业务”建立并确认业务。</div>}{activities.length > 0 && !activities.some(activity => activityMatchesAudience(activity, audienceGroup)) && audienceGroup !== "internal" && <div className="alert warning">当前没有识别到属于“{materialAudienceName(audienceGroup)}”的业务。请先完善业务的场景或涉及人员信息。</div>}</>}
      {step === 3 && <div className="material-review"><div className="review-card"><span>{materialAudienceName(audienceGroup)} · {materialRequirementName[definition.requirement || "basic"]}</span><strong>{definition.name}</strong><p>{definition.description}</p>{definition.trigger && <small>适用情形：{definition.trigger}</small>}{definition.legalBasis && <small>主要依据：{definition.legalBasis}</small>}</div><div className="two-column-fields"><label className="field"><span>材料名称</span><input value={name} onChange={event => setName(event.target.value)} /></label><label className="field"><span>具体适用对象</span><input value={audience} onChange={event => setAudience(event.target.value)} /></label></div><label className="field"><span>适用范围</span><input value={scope} onChange={event => setScope(event.target.value)} /></label><label className="field"><span>内部说明（选填）</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label><div className="generation-mode-picker"><button className={generationMode === "ai" ? "selected" : ""} disabled={!aiStatus.configured} onClick={() => setGenerationMode("ai")}><Sparkles /><div><strong>AI生成完整草稿</strong><p>{aiStatus.configured ? `${aiStatus.activeProvider} · ${aiStatus.activeModel}；基于已确认事实完善结构和表达。` : "尚未配置可用AI服务。"}</p></div>{generationMode === "ai" && <Check />}</button><button className={generationMode === "template" ? "selected" : ""} onClick={() => setGenerationMode("template")}><FileText /><div><strong>生成基础模板</strong><p>不调用外部AI，按确定性模板形成可编辑底稿。</p></div>{generationMode === "template" && <Check />}</button></div>{!aiStatus.configured && <div className="ai-config-shortcut"><span>希望使用AI生成完整草稿？先完成服务配置。</span><Link href="/settings/ai">前往 AI 设置</Link></div>}<div className="generation-preview"><strong>一份材料将覆盖以下内容</strong><div className="module-tags">{definition.defaultModules.map(module => <span key={module}><Check size={12} /> {module}</span>)}</div><p>覆盖 {selectedActivities.length} 项业务：{selectedActivities.map(item => item.name).join("、") || "尚未选择"}</p></div>{missingFacts.length > 0 && <div className="alert warning">存在尚未完整确认的业务，请返回重新选择。</div>}{error && <div className="alert danger">{error}</div>}</div>}
      <div className="modal-actions wizard-actions"><button className="button secondary" onClick={() => step === 1 ? setCreating(false) : setStep(current => current - 1)}>{step > 1 && <ChevronLeft size={16} />}{step === 1 ? "取消" : "上一步"}</button>{step < 3 ? <button className="button primary" disabled={step === 2 && activityIds.length === 0} onClick={() => setStep(current => current + 1)}>下一步 <ChevronRight size={16} /></button> : <button className="button primary" disabled={busy || previewBusy || name.length < 2 || !scope || !audience || activityIds.length === 0 || missingFacts.length > 0} onClick={handleGenerate}>{busy || previewBusy ? <RefreshCw size={16} className="spin" /> : generationMode === "ai" ? <Eye size={16} /> : <FilePlus2 size={16} />} {previewBusy ? "正在准备预览…" : busy ? "正在生成…" : generationMode === "ai" ? "预览将发送给AI的内容" : "生成基础模板"}</button>}</div>
    </section></div>}

    {aiPreview && <div className="modal-backdrop ai-preview-backdrop" onClick={() => !busy && setAiPreview(null)}><section className="modal ai-preview-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">AI提交前确认</p><h2>本次将发送以下脱敏内容</h2><p>取消不必要字段后再确认。页面展示的内容与服务端实际提交内容一致。</p></div><button className="icon-button" aria-label="关闭" disabled={busy} onClick={() => setAiPreview(null)}>×</button></div><div className="ai-redaction-summary"><LockKeyhole /><div><strong>已自动脱敏 {aiPreview.redactionCount} 项</strong><p>{aiPreview.redactionLabels.join("、") || "本次未识别到需要替换的直接标识信息"}</p><span>{aiPreview.restorationNotice}</span></div></div><div className="ai-preview-layout"><section className="ai-field-control"><div className="ai-preview-section-title"><strong>选择发送字段</strong><span>核心材料要求、业务名称、涉及人员、信息种类和处理目的始终保留。</span></div>{(["企业信息", "业务信息"] as const).map(group => <div className="ai-field-group" key={group}><h3>{group}</h3>{aiPreview.fields.filter(field => field.group === group).map(field => <label key={field.code}><input type="checkbox" checked={field.included} disabled={previewBusy || busy} onChange={() => void togglePreviewField(field.code, field.included)} /><span><strong>{field.label}</strong><small>{field.description}</small></span></label>)}</div>)}</section><section className="ai-payload-preview"><div className="ai-preview-section-title"><strong>实际发送内容</strong><span>真实单位名称、联系人、联系方式，以及识别出的姓名、邮箱、手机、固定电话和身份证件号码均已替换为占位符。</span></div><pre>{JSON.stringify(aiPreview.payload, null, 2)}</pre></section></div>{previewBusy && <div className="ai-preview-refresh"><RefreshCw className="spin" /> 正在按新的字段范围刷新预览…</div>}{error && <div className="alert danger">{error}</div>}<div className="modal-actions ai-preview-actions"><button className="button secondary" disabled={busy} onClick={() => setAiPreview(null)}>返回修改</button><button className="button primary" disabled={busy || previewBusy} onClick={() => void create(true)}>{busy ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />} {busy ? "AI正在起草…" : "确认并发送给AI"}</button></div></section></div>}

    {editor && selected && <div className="modal-backdrop document-modal-backdrop" onClick={() => setEditor(null)}><section className={`modal editor-modal ${editor.mode === "view" ? "reader-modal" : ""}`} onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">{editor.mode === "view" ? "版本内容（只读）" : editor.mode === "edit" ? "编辑现有草稿" : "准备新版本"}</p><h2>{selected.name}</h2></div><button className="icon-button" aria-label="关闭" onClick={() => setEditor(null)}>×</button></div>{editor.mode === "view" ? <div className="document-reader-wrap"><article className="document-reader"><pre>{content}</pre></article></div> : <div className="document-editor-body"><div className="two-column-fields"><label className="field"><span>修改说明</span><input value={summary} onChange={event => setSummary(event.target.value)} /></label><label className="field"><span>创建或经办人</span><input value={createdBy} onChange={event => setCreatedBy(event.target.value)} placeholder="例如：张三" /></label></div><label className="field"><span>完整内容</span><textarea className="document-editor" value={content} onChange={event => setContent(event.target.value)} /></label>{error && <div className="alert danger">{error}</div>}</div>}<div className="modal-actions"><button className="button secondary" onClick={() => setEditor(null)}>关闭</button>{editor.mode !== "view" && <button className="button primary" disabled={busy || summary.length < 2 || content.length < 20} onClick={saveRevision}><FileClock size={16} /> 保存草稿</button>}</div></section></div>}

    {workflow && <div className="modal-backdrop" onClick={() => setWorkflow(null)}><section className="modal workflow-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">{workflow.version.versionNumber}</p><h2>确认并发布</h2></div><button className="icon-button" onClick={() => setWorkflow(null)}>×</button></div><div className="alert warning">发布后该版本正文将锁定。如需修改，应创建新版本。</div><label className="field"><span>发布人或负责人</span><input value={actor} onChange={event => setActor(event.target.value)} placeholder="例如：负责人姓名" /></label><label className="field"><span>发布渠道</span><input value={channel} onChange={event => setChannel(event.target.value)} placeholder="例如：公司官网、App、员工系统或合同附件" /></label><label className="field"><span>发布证据或地址（选填）</span><textarea value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="例如：页面地址、文件编号或截图存放位置" /></label>{error && <div className="alert danger">{error}</div>}<div className="modal-actions"><button className="button secondary" onClick={() => setWorkflow(null)}>取消</button><button className="button primary" disabled={busy || !actor || !channel} onClick={runWorkflow}><UploadCloud size={16} /> 确认发布</button></div></section></div>}

    {confirmingDelete && selected && <div className="modal-backdrop" onClick={() => !busy && setConfirmingDelete(false)}><section className="modal workflow-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">删除材料</p><h2>{selected.name}</h2></div><button className="icon-button" disabled={busy} onClick={() => setConfirmingDelete(false)}>×</button></div><div className="alert danger">将永久删除这份材料及其 {(selected.versions || []).length} 个草稿版本，操作不可恢复。只有从未发布过的材料可以删除；已有发布记录的材料属于合规证据，系统会拒绝删除。</div><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>取消</button><button className="button danger" disabled={busy} onClick={removeDocument}>{busy ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />} 确认删除</button></div></section></div>}
  </>;
}
