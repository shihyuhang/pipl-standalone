"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenText, CheckCircle2, ClipboardCheck, ExternalLink, FileCheck2, Plus, Printer, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import type { PipiaCategoryCode, PipiaInstance, PipiaResponse, ProcessingActivity } from "@/lib/types";

interface Recommendation { activity: ProcessingActivity; recommendedCodes: PipiaCategoryCode[]; reasons: string[] }
const categoryNames: Record<PipiaCategoryCode, string> = {
  P01: "处理敏感个人信息", P02: "使用个人信息做自动化决定", P03: "交给服务商处理、提供给其他单位或公开",
  P04: "向境外提供个人信息", P05: "其他可能对个人权益有重大影响的活动"
};
const ynLabels: Record<string, string> = { yes: "是", no: "否", not_applicable: "不适用", unanswered: "尚未判断", has_impact: "有影响或风险", no_impact: "没有明显影响" };

export default function ImpactAssessmentsPage() {
  const [instances, setInstances] = useState<PipiaInstance[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [current, setCurrent] = useState<PipiaInstance | null>(null);
  const [creating, setCreating] = useState(false);
  const [activityId, setActivityId] = useState("");
  const [categoryCodes, setCategoryCodes] = useState<PipiaCategoryCode[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);
  const [responsibleName, setResponsibleName] = useState("");
  const [responsibleRole, setResponsibleRole] = useState("");

  const load = async (selectedId?: string) => {
    const data = await fetch("/api/pipia", { cache: "no-store" }).then(response => response.json());
    setInstances(data.instances || []); setRecommendations(data.recommendations || []);
    const requestedActivityId = new URLSearchParams(window.location.search).get("activity");
    const selected = (data.instances || []).find((item: PipiaInstance) => requestedActivityId && item.activityId === requestedActivityId)
      || (data.instances || []).find((item: PipiaInstance) => !requestedActivityId && item.id === (selectedId || current?.id))
      || (!requestedActivityId ? data.instances?.[0] : undefined);
    if (selected) {
      const full: PipiaInstance = await fetch(`/api/pipia/${selected.id}`, { cache: "no-store" }).then(response => response.json());
      setCurrent(full); setResponsibleName(full.responsibleName || ""); setResponsibleRole(full.responsibleRole || "");
    } else {
      setCurrent(null);
      const requestedRecommendation = (data.recommendations || []).find((item: Recommendation) => item.activity.id === requestedActivityId);
      if (requestedRecommendation) { setActivityId(requestedRecommendation.activity.id); setCategoryCodes(requestedRecommendation.recommendedCodes.length ? requestedRecommendation.recommendedCodes : ["P05"]); setCreating(true); }
    }
  };
  useEffect(() => { void load(); }, []);

  const openCreate = (recommendation?: Recommendation) => {
    const first = recommendation || recommendations[0];
    setActivityId(first?.activity.id || ""); setCategoryCodes(first?.recommendedCodes.length ? first.recommendedCodes : ["P05"]); setError(""); setCreating(true);
  };
  const chooseActivity = (id: string) => {
    setActivityId(id); const item = recommendations.find(value => value.activity.id === id);
    setCategoryCodes(item?.recommendedCodes.length ? item.recommendedCodes : ["P05"]);
  };
  const toggleCategory = (code: PipiaCategoryCode) => setCategoryCodes(value => value.includes(code) ? value.filter(item => item !== code) : [...value, code]);
  const create = async () => {
    setBusy(true); setError("");
    const response = await fetch("/api/pipia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId, categoryCodes }) });
    const payload = await response.json();
    if (response.ok) { setCreating(false); await load(payload.id); } else setError(payload.message || "暂时无法建立影响评估。");
    setBusy(false);
  };
  const patchLocal = (code: PipiaCategoryCode, patch: Partial<PipiaResponse>) => setCurrent(value => value ? ({ ...value, responses: value.responses?.map(item => item.categoryCode === code ? { ...item, ...patch } : item) }) : value);
  const save = async (item: PipiaResponse) => {
    if (!current) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/pipia/${current.id}/responses`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryCode: item.categoryCode, legality: item.legality, impact: item.impact, measureAdequacy: item.measureAdequacy, notes: item.notes, evidenceNote: item.evidenceNote }) });
    const payload = await response.json();
    if (response.ok) await load(current.id); else setError(payload.message || "保存失败。");
    setBusy(false);
  };
  const sign = async () => {
    if (!current) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/pipia/${current.id}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsibleName, responsibleRole }) });
    const payload = await response.json();
    if (response.ok) { setSigning(false); await load(current.id); } else setError(payload.message || "暂时无法确认归档。");
    setBusy(false);
  };
  const selectedRecommendation = useMemo(() => recommendations.find(item => item.activity.id === activityId), [recommendations, activityId]);
  const readOnly = current?.status === "signed" || current?.status === "archived";
  const unfinishedInstances = instances.filter(item => item.status !== "signed" && item.status !== "archived");
  const archivedInstances = instances.filter(item => item.status === "signed" || item.status === "archived");

  return <>
    <section className="page-heading"><div><p className="eyebrow">个人信息保护影响评估</p><h1>只在业务确实触发时开展评估</h1><p>系统根据已确认的业务情况提示可能需要评估的事项，负责人再核对目的、风险和保护措施。</p></div><div className="heading-actions">{current && <button className="button secondary" onClick={() => window.print()}><Printer size={16} /> 按官方格式打印/导出</button>}<button className="button primary" onClick={() => openCreate()} disabled={!recommendations.length}><Plus size={16} /> 建立评估</button></div></section>
    <div className="info-strip"><Scale /><div><strong>不是所有业务都要填写五类评估</strong><span>系统会根据敏感信息、外部接收方、跨境等记录推荐适用情形；无法从现有记录判断时，由负责人补充选择。</span></div></div>
    {archivedInstances.length > 0 && <div className="info-strip archived-pipia-strip"><FileCheck2 /><div><strong>已有 {archivedInstances.length} 份专项评估确认归档</strong><span>已完成记录保留建立时的业务事实、三个判断、负责人和确认时间。请从左侧“已确认归档”选择记录，再使用右上角按钮按官方格式打印，或在打印窗口中保存为PDF。</span></div></div>}
    {error && <div className="alert danger">{error}</div>}

    <div className="pipia-layout">
      <aside className="pipia-side card"><div className="card-header"><div><p className="eyebrow">评估记录</p><h2>{instances.length} 份</h2></div></div>{instances.length ? <>{unfinishedInstances.length > 0 && <><div className="pipia-list-label"><span>待完成</span><b>{unfinishedInstances.length}</b></div>{unfinishedInstances.map(item => <PipiaRecordButton key={item.id} item={item} active={current?.id === item.id} onSelect={() => void load(item.id)} />)}</>}{archivedInstances.length > 0 && <><div className="pipia-list-label archived"><span>已确认归档</span><b>{archivedInstances.length}</b></div>{archivedInstances.map(item => <PipiaRecordButton key={item.id} item={item} active={current?.id === item.id} onSelect={() => void load(item.id)} />)}</>}</> : <div className="empty-mini"><Scale /><p>还没有影响评估。只有业务触发法定情形时才需要建立。</p></div>}</aside>
      <section className="pipia-main card">{current ? <><div className="detail-header"><div><p className="eyebrow">{readOnly ? "已确认归档" : "评估工作底稿"}</p><h2>{current.activityName}</h2><p>已选择 {current.categoryCodes.length} 类评估情形 · 完成 {Math.round(current.progress * 100)}%</p></div>{readOnly && <FileCheck2 className="success-icon" />}</div>{current.contextSnapshot && <details className="snapshot"><summary>查看建立评估时的业务事实快照</summary><div className="snapshot-grid"><div><span>涉及人员</span><strong>{current.contextSnapshot.activity.facts.dataSubjects.join("、") || "尚未填写"}</strong></div><div><span>个人信息</span><strong>{current.contextSnapshot.activity.facts.informationTypes.join("、") || "尚未填写"}</strong></div><div><span>使用目的</span><strong>{current.contextSnapshot.activity.facts.purposes.join("、") || "尚未填写"}</strong></div><div><span>保存期限</span><strong>{current.contextSnapshot.activity.facts.retentionPeriod || "尚未填写"}</strong></div></div></details>}<PipiaLegalReference /><div className="pipia-response-list">{current.responses?.map(item => <article className="pipia-response" key={item.id}><div className="pipia-response-title"><span>{item.categoryCode}</span><div><strong>{item.categoryName}</strong><p>请基于这一项业务的真实做法作出三个判断。</p></div></div>
          <DecisionRow label="1. 这样处理是否有明确目的，并且做法合适、确有必要？" hint="依据：个人信息保护法第五十六条第（一）项" value={item.legality} readOnly={readOnly} options={["yes", "no", "not_applicable"]} onChange={value => patchLocal(item.categoryCode, { legality: value as PipiaResponse["legality"] })} />
          <DecisionRow label="2. 可能给个人带来什么影响或安全风险？" hint="依据：个人信息保护法第五十六条第（二）项" value={item.impact} readOnly={readOnly} options={["has_impact", "no_impact", "not_applicable"]} onChange={value => patchLocal(item.categoryCode, { impact: value as PipiaResponse["impact"] })} />
          <DecisionRow label="3. 已采取的保护办法是否有效，并与风险大小相匹配？" hint="依据：个人信息保护法第五十六条第（三）项" value={item.measureAdequacy} readOnly={readOnly} options={["yes", "no", "not_applicable"]} onChange={value => patchLocal(item.categoryCode, { measureAdequacy: value as PipiaResponse["measureAdequacy"] })} />
          <label className="field"><span>说明实际做法、风险和准备采取的措施</span><textarea readOnly={readOnly} value={item.notes} onChange={event => patchLocal(item.categoryCode, { notes: event.target.value })} placeholder="例如：地址仅用于配送，订单完成后普通客服不能继续查看；系统保留访问记录。" /></label><label className="field"><span>相关证明材料或存放位置（选填）</span><input readOnly={readOnly} value={item.evidenceNote} onChange={event => patchLocal(item.categoryCode, { evidenceNote: event.target.value })} placeholder="例如：系统权限截图、服务商合同、告知页面" /></label><div className="audit-question-actions">{item.taskId && <a className="task-created" href="/tasks"><ClipboardCheck size={14} /> 已生成处理事项</a>}{!readOnly && <button className="button small primary" disabled={busy || [item.legality, item.impact, item.measureAdequacy].includes("unanswered")} onClick={() => save(item)}>保存这一类评估</button>}</div>
        </article>)}</div>{!readOnly && <div className="audit-finish"><div><strong>{current.progress === 1 ? "评估内容已经填写完成" : "请完成所有三项判断"}</strong><p>出现“不合适”“有影响”或“措施不足”时，必须说明风险和改进办法。</p></div><button className="button primary" disabled={current.progress !== 1} onClick={() => setSigning(true)}><FileCheck2 size={16} /> 负责人确认并归档</button></div>}</> : <div className="pipia-empty"><Scale /><h2>从具体业务开始影响评估</h2><p>先选择“我的业务”中的一项记录。平台不会要求一个个人信息很少的 B2B 企业填写与它无关的评估情形。</p>{recommendations.filter(item => item.recommendedCodes.length > 0).map(item => <button key={item.activity.id} onClick={() => openCreate(item)}><ShieldAlert /><div><strong>{item.activity.name}</strong><span>{item.reasons.join("；")}</span></div><Plus /></button>)}</div>}
      </section>
    </div>
    {current && <OfficialPipiaPrint instance={current} />}

    {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}><section className="modal large-modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">建立影响评估</p><h2>先选业务，再确认适用情形</h2><p>系统推荐只是提示，请根据实际业务增减。</p></div><button className="icon-button" onClick={() => setCreating(false)}>×</button></div><label className="field"><span>要评估哪一项业务？</span><select value={activityId} onChange={event => chooseActivity(event.target.value)}><option value="">请选择业务</option>{recommendations.map(item => <option value={item.activity.id} key={item.activity.id}>{item.activity.name}</option>)}</select></label>{selectedRecommendation?.reasons.length ? <div className="alert warning"><AlertTriangle size={16} /> 系统建议关注：{selectedRecommendation.reasons.join("；")}</div> : <div className="source-note">现有业务记录没有自动触发明确情形。如确有重大影响，可选择“其他”。</div>}<div className="pipia-category-choices">{(Object.keys(categoryNames) as PipiaCategoryCode[]).map(code => <button className={categoryCodes.includes(code) ? "selected" : ""} key={code} onClick={() => toggleCategory(code)}><span>{code}</span><div><strong>{categoryNames[code]}</strong>{selectedRecommendation?.recommendedCodes.includes(code) && <small>系统建议</small>}</div></button>)}</div>{error && <div className="alert danger">{error}</div>}<div className="modal-actions"><button className="button secondary" onClick={() => setCreating(false)}>取消</button><button className="button primary" disabled={busy || !activityId || categoryCodes.length === 0} onClick={create}>{busy ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />} 建立评估</button></div></section></div>}
    {signing && <div className="modal-backdrop" onClick={() => setSigning(false)}><section className="modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">负责人确认</p><h2>确认评估内容并归档</h2></div><button className="icon-button" onClick={() => setSigning(false)}>×</button></div><label className="field"><span>确认人姓名</span><input value={responsibleName} onChange={event => setResponsibleName(event.target.value)} /></label><label className="field"><span>在本单位的角色</span><input value={responsibleRole} onChange={event => setResponsibleRole(event.target.value)} /></label>{error && <div className="alert danger">{error}</div>}<div className="source-note">确认后形成只读记录；业务发生变化时应建立新的评估，不覆盖历史结论。</div><div className="alert warning">根据《个人信息保护法》第五十六条，本评估报告需留存三年，请勿删除。</div><div className="modal-actions"><button className="button secondary" onClick={() => setSigning(false)}>取消</button><button className="button primary" disabled={busy || !responsibleName.trim() || !responsibleRole.trim()} onClick={sign}>确认并归档</button></div></section></div>}
  </>;
}

function DecisionRow({ label, hint, value, options, readOnly, onChange }: { label: string; hint?: string; value: string; options: string[]; readOnly: boolean; onChange: (value: string) => void }) {
  return <div className="decision-row"><strong>{label}</strong>{hint && <a className="decision-hint" href="#pipia-legal-reference">{hint}</a>}<div>{options.map(option => <button key={option} disabled={readOnly} className={value === option ? "selected" : ""} onClick={() => onChange(option)}>{ynLabels[option]}</button>)}</div></div>;
}

function PipiaLegalReference() {
  return <details className="pipia-legal-reference" id="pipia-legal-reference"><summary><BookOpenText size={16} /><span><strong>为什么需要做这三项判断？</strong><small>展开查看《个人信息保护法》第五十五条、第五十六条</small></span></summary><div><p><b>第五十五条：</b>处理敏感个人信息、利用个人信息进行自动化决策、委托处理或向其他处理者提供/公开个人信息、向境外提供个人信息，以及其他对个人权益有重大影响的处理活动，应当事前开展个人信息保护影响评估并记录处理情况。</p><p><b>第五十六条：</b>评估应当核对三个方面：</p><ol><li>处理目的、处理方式是否合法、正当、必要；</li><li>对个人权益的影响及安全风险；</li><li>保护措施是否合法、有效并与风险程度相适应。</li></ol><p>评估报告和处理情况记录应当至少保存三年。</p><a href="https://www.npc.gov.cn/npc/c2/c30834/202108/t20210820_313088.html" target="_blank" rel="noreferrer">在中国人大网查看法条原文 <ExternalLink size={13} /></a></div></details>;
}

function PipiaRecordButton({ item, active, onSelect }: { item: PipiaInstance; active: boolean; onSelect: () => void }) {
  const archived = item.status === "signed" || item.status === "archived";
  return <button className={active ? "pipia-row active" : "pipia-row"} onClick={onSelect}><div><strong>{item.activityName}</strong><span>{item.categoryCodes.length} 类情形 · {archived ? `${item.signedAt ? new Date(item.signedAt).toLocaleDateString("zh-CN") : "已归档"}` : `完成 ${Math.round(item.progress * 100)}%`}</span></div>{archived ? <CheckCircle2 /> : <ClipboardCheck />}</button>;
}

const officialCategoryNames: Record<PipiaCategoryCode, string> = {
  P01: "处理敏感个人信息", P02: "利用个人信息进行自动化决策", P03: "委托处理个人信息、向其他个人信息处理者提供个人信息、公开个人信息",
  P04: "向境外提供个人信息", P05: "其他对个人权益有重大影响的个人信息处理活动"
};
const officialYnLabels: Record<string, string> = { yes: "是", no: "否", not_applicable: "不适用", unanswered: "未判断", has_impact: "有影响", no_impact: "无明显影响" };

function OfficialPipiaPrint({ instance }: { instance: PipiaInstance }) {
  const responses = new Map(instance.responses?.map(item => [item.categoryCode, item]) || []);
  return <section className="official-print pipia-print"><h1>小型个人信息处理者个人信息保护影响评估表</h1><p>单位：{instance.contextSnapshot?.enterprise.legalName || "____________"}　业务：{instance.activityName}　状态：{instance.status === "signed" ? "已确认归档" : "工作底稿"}</p><table><thead><tr><th className="col-no">序号</th><th>影响评估情形</th><th>个人信息的处理目的、处理方式等是否合法、正当、必要</th><th>对个人权益的影响及安全风险</th><th>所采取的保护措施是否合法、有效并与风险程度相适应</th><th>备注（如有影响，请说明影响程度、安全风险和采取的保护措施）</th></tr></thead><tbody>{(Object.keys(categoryNames) as PipiaCategoryCode[]).map((code, index) => { const item = responses.get(code); return <tr key={code}><td className="col-no">{index + 1}</td><td>{officialCategoryNames[code]}</td><td>{item ? officialYnLabels[item.legality] : "不适用"}</td><td>{item ? officialYnLabels[item.impact] : "不适用"}</td><td>{item ? officialYnLabels[item.measureAdequacy] : "不适用"}</td><td>{item ? [item.notes, item.evidenceNote].filter(Boolean).join("；") || "—" : "本次业务未选择该评估情形"}</td></tr>; })}</tbody></table><p className="print-declare">本人已对上述事项进行了影响评估，并如实填写影响评估情况，如有不实，承担相应法律责任。</p><footer>影响评估负责人签字：{instance.responsibleName || "____________"}　　日期：{instance.signedAt ? new Date(instance.signedAt).toLocaleDateString("zh-CN") : "____________"}</footer></section>;
}
