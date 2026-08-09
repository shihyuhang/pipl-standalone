"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileClock, FilePlus2,
  FileText, History, Plus, RefreshCw, Send, ShieldCheck
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { materialCatalog, materialTypeName, type MaterialCategory } from "@/lib/materials";
import type { BusinessDocument, DocumentVersion, ProcessingActivity } from "@/lib/types";

const categoryName: Record<MaterialCategory, string> = { external: "对外告知", internal: "内部要求", register: "内部台账" };

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [activities, setActivities] = useState<ProcessingActivity[]>([]);
  const [selected, setSelected] = useState<BusinessDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("b2b_contact_notice");
  const [name, setName] = useState("业务联系人个人信息告知");
  const [scope, setScope] = useState("客户、供应商及合作方联系业务");
  const [audience, setAudience] = useState("客户、供应商及合作方联系人");
  const [description, setDescription] = useState("");
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [versionMode, setVersionMode] = useState<"view" | "new" | null>(null);
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [docs, scenarioData] = await Promise.all([
      fetch("/api/documents", { cache: "no-store" }).then(response => response.json()),
      fetch("/api/scenarios", { cache: "no-store" }).then(response => response.json())
    ]);
    setDocuments(docs);
    setActivities(scenarioData.activities || []);
    setSelected(current => docs.find((item: BusinessDocument) => item.id === current?.id) || null);
  };
  useEffect(() => { void load(); }, []);

  const definition = useMemo(() => materialCatalog.find(item => item.code === type)!, [type]);
  const selectedActivities = useMemo(() => activities.filter(item => activityIds.includes(item.id)), [activities, activityIds]);
  const missingFacts = selectedActivities.filter(item => item.completeness < 1);

  const openCreate = () => {
    const defaultType = materialCatalog.find(item => item.code === "b2b_contact_notice")!;
    setType(defaultType.code); setName(defaultType.name); setAudience(defaultType.defaultAudience);
    setScope("客户、供应商及合作方联系业务"); setDescription(""); setActivityIds([]); setStep(1); setError(""); setCreating(true);
  };

  const chooseType = (code: string) => {
    const next = materialCatalog.find(item => item.code === code)!;
    setType(code); setName(next.name); setAudience(next.defaultAudience);
  };

  const toggleActivity = (id: string) => setActivityIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const create = async () => {
    setBusy(true); setError("");
    const response = await fetch("/api/documents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scope, type, audience, description, activityIds, modules: definition.defaultModules })
    });
    const payload = await response.json();
    if (response.ok) { await load(); setSelected(payload); setCreating(false); }
    else setError(payload.message || "生成材料失败，请稍后重试。");
    setBusy(false);
  };

  const newVersion = async () => {
    if (!selected) return;
    setBusy(true);
    const response = await fetch(`/api/documents/${selected.id}/versions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, changeSummary: summary })
    });
    if (response.ok) { await load(); setVersionMode(null); }
    setBusy(false);
  };

  const publish = async (version: DocumentVersion) => {
    if (!selected || !confirm(`确认将 ${version.versionNumber} 发布为当前版本？原当前版本会保留在历史记录中。`)) return;
    setBusy(true);
    await fetch(`/api/documents/${selected.id}/versions/${version.id}/publish`, { method: "POST" });
    await load(); setBusy(false);
  };

  return <>
    <section className="page-heading"><div><p className="eyebrow">合规材料</p><h1>把已经确认的业务整理成材料</h1><p>选择材料用途和关联业务，系统带入已确认事实形成草稿；每次修改都会保留独立版本。</p></div><button className="button primary" onClick={openCreate}><Plus size={17} /> 建立材料</button></section>
    <div className="info-strip"><ShieldCheck /><div><strong>材料不是空白模板</strong><span>草稿会使用企业名称、联系渠道、业务场景、个人信息类型、用途、系统、接收方和保存期限；缺失事实会先提示补充。</span></div></div>
    <div className="document-summary"><div><FileText /><strong>{documents.length}</strong><span>全部材料</span></div><div><CheckCircle2 /><strong>{documents.filter(item => item.currentVersion).length}</strong><span>已有发布版本</span></div><div><Clock3 /><strong>{documents.reduce((count, item) => count + (item.versions?.filter(version => version.status === "draft").length || 0), 0)}</strong><span>待确认草稿</span></div></div>

    {documents.length ? <div className="document-layout"><div className="document-list">{documents.map(document => <button key={document.id} className={selected?.id === document.id ? "document-row selected" : "document-row"} onClick={() => setSelected(document)}><div className="doc-icon"><FileText /></div><div><strong>{document.name}</strong><span>{materialTypeName(document.type)} · {document.audience || document.scope}</span><small>{document.currentVersion ? `${document.currentVersion.versionNumber} 当前发布` : "尚未发布"} · {document.versions?.length || 0} 个版本</small></div></button>)}</div><div className="document-detail">{selected ? <>
      <div className="detail-header"><div><p className="eyebrow">{materialTypeName(selected.type)} · 版本管理</p><h2>{selected.name}</h2><p>适用对象：{selected.audience || selected.scope}</p></div><button className="button secondary" onClick={() => { const base = selected.versions?.[0]; setContent(base?.content || ""); setSummary(""); setVersionMode("new"); }}><FilePlus2 size={16} /> 准备新版本</button></div>
      <div className="document-basis"><div><span>适用范围</span><strong>{selected.scope}</strong></div><div><span>关联业务</span><strong>{selected.activityIds.length} 项</strong></div><div><span>生成依据</span><strong>{selected.metadata?.generationBasis || "人工建立"}</strong></div></div>
      {selected.description && <p className="document-description">{selected.description}</p>}
      <div className="version-list">{selected.versions?.map(version => <article className="version-card" key={version.id}><div className="version-line"><div><span className="version-number">{version.versionNumber}</span><StatusBadge status={version.status} /></div><time>{new Date(version.createdAt).toLocaleDateString("zh-CN")}</time></div><p>{version.changeSummary}</p><div className="version-actions"><button className="text-link" onClick={() => { setContent(version.content); setSummary(version.changeSummary); setVersionMode("view"); }}><FileText size={15} /> 查看完整内容</button>{version.status === "draft" && <button className="button small primary" disabled={busy} onClick={() => publish(version)}><Send size={14} /> 确认并发布</button>}</div></article>)}</div>
    </> : <EmptyState icon={History} title="选择一份材料" description="查看材料依据、当前版本和完整历史记录。" />}</div></div> : <EmptyState icon={FilePlus2} title="还没有合规材料" description="建立材料时先选择用途和业务，系统会带入已经确认的实际情况，而不是只生成一份通用模板。" action={<button className="button primary" onClick={openCreate}><Plus size={17} /> 建立首份材料</button>} />}

    {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}><section className="modal material-wizard" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">建立合规材料 · 第 {step} 步，共 3 步</p><h2>{step === 1 ? "这份材料要解决什么问题？" : step === 2 ? "材料依据哪些实际业务？" : "核对生成范围"}</h2><p>{step === 1 ? "先选用途，系统会准备对应结构。" : step === 2 ? "只选择确实适用的业务，避免把无关内容写进材料。" : "确认名称、对象和将要带入的事实。"}</p></div><button className="icon-button" onClick={() => setCreating(false)}>×</button></div>
      <div className="wizard-progress"><span className={step >= 1 ? "active" : ""} /><span className={step >= 2 ? "active" : ""} /><span className={step >= 3 ? "active" : ""} /></div>

      {step === 1 && <div className="material-type-groups">{(["external", "internal", "register"] as MaterialCategory[]).map(category => <section key={category}><h3>{categoryName[category]}</h3><div className="material-type-grid">{materialCatalog.filter(item => item.category === category).map(item => <button key={item.code} className={type === item.code ? "material-type selected" : "material-type"} onClick={() => chooseType(item.code)}><div><strong>{item.name}</strong><p>{item.description}</p></div>{type === item.code && <Check size={17} />}</button>)}</div></section>)}</div>}

      {step === 2 && <><div className="selection-help"><strong>选择要写入材料的业务</strong><span>建议先选择“已确认 100%”的业务。尚未完善的业务不能可靠生成具体内容。</span></div><div className="activity-select-list">{activities.map(activity => <button key={activity.id} className={activityIds.includes(activity.id) ? "activity-select selected" : "activity-select"} onClick={() => toggleActivity(activity.id)}><span className="check-box">{activityIds.includes(activity.id) && <Check size={14} />}</span><div><strong>{activity.name}</strong><p>{activity.description}</p><small>已确认 {Math.round(activity.completeness * 100)}% · {activity.facts.informationTypes.length} 类信息 · {activity.facts.systems.length} 个使用位置</small></div></button>)}</div>{!activities.length && <div className="alert warning">还没有业务记录，请先到“我的业务”建立并确认一项业务。</div>}</>}

      {step === 3 && <div className="material-review"><div className="review-card"><span>材料类型</span><strong>{definition.name}</strong><p>{definition.description}</p></div><div className="two-column-fields"><label className="field"><span>材料名称</span><input value={name} onChange={event => setName(event.target.value)} /></label><label className="field"><span>适用对象</span><input value={audience} onChange={event => setAudience(event.target.value)} /></label></div><label className="field"><span>适用范围</span><input value={scope} onChange={event => setScope(event.target.value)} placeholder="例如：客户和供应商日常联系" /></label><label className="field"><span>这份材料的内部说明（选填）</span><textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="例如：用于官网发布和合同附件" /></label><div className="generation-preview"><strong>系统将带入以下内容</strong><div className="module-tags">{definition.defaultModules.map(module => <span key={module}><Check size={12} /> {module}</span>)}</div><p>关联 {selectedActivities.length} 项业务：{selectedActivities.map(item => item.name).join("、") || "尚未选择"}</p></div>{missingFacts.length > 0 && <div className="alert warning">{missingFacts.map(item => item.name).join("、")} 尚未完整确认。请先完善业务情况，避免草稿包含“待确认”内容。</div>}{error && <div className="alert danger">{error}</div>}<div className="source-note">生成的是可编辑草稿，不会自动发布。负责人核对业务事实和完整文字后，才可确认发布。</div></div>}

      <div className="modal-actions wizard-actions"><button className="button secondary" onClick={() => step === 1 ? setCreating(false) : setStep(current => current - 1)}>{step > 1 && <ChevronLeft size={16} />}{step === 1 ? "取消" : "上一步"}</button>{step < 3 ? <button className="button primary" disabled={step === 2 && activityIds.length === 0} onClick={() => setStep(current => current + 1)}>下一步 <ChevronRight size={16} /></button> : <button className="button primary" disabled={busy || name.length < 2 || !scope || !audience || activityIds.length === 0 || missingFacts.length > 0} onClick={create}>{busy ? <RefreshCw size={16} className="spin" /> : <FilePlus2 size={16} />} 生成完整草稿</button>}</div>
    </section></div>}

    {versionMode && selected && <div className="modal-backdrop" onClick={() => setVersionMode(null)}><section className="modal editor-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">{versionMode === "view" ? "版本内容（只读）" : "准备新版本"}</p><h2>{selected.name}</h2></div><button className="icon-button" onClick={() => setVersionMode(null)}>×</button></div>{versionMode === "new" && <label className="field"><span>修改说明</span><input value={summary} onChange={event => setSummary(event.target.value)} placeholder="例如：新增官网联系表单，补充保存期限" /></label>}<label className="field"><span>完整内容</span><textarea readOnly={versionMode === "view"} className="document-editor" value={content} onChange={event => setContent(event.target.value)} /></label><div className="modal-actions"><button className="button secondary" onClick={() => setVersionMode(null)}>关闭</button>{versionMode === "new" && <button className="button primary" disabled={busy || summary.length < 2 || content.length < 20} onClick={newVersion}><FileClock size={16} /> 另存为新草稿</button>}</div></section></div>}
  </>;
}
