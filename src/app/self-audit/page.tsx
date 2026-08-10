"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, FileCheck2, Printer, RefreshCw, ShieldCheck } from "lucide-react";
import { auditGroups } from "@/lib/audit-template";
import type { AuditConclusion, AuditInstance, AuditResponse } from "@/lib/types";

const conclusionLabels: Record<AuditConclusion, string> = {
  unanswered: "尚未判断", compliant: "符合", non_compliant: "暂不符合", not_applicable: "与本单位无关"
};

export default function SelfAuditPage() {
  const [instances, setInstances] = useState<AuditInstance[]>([]);
  const [current, setCurrent] = useState<AuditInstance | null>(null);
  const [groupCode, setGroupCode] = useState("G1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);
  const [responsibleName, setResponsibleName] = useState("");
  const [responsibleRole, setResponsibleRole] = useState("");

  const load = async (selectedId?: string) => {
    const list: AuditInstance[] = await fetch("/api/audits", { cache: "no-store" }).then(response => response.json());
    setInstances(list);
    const selected = list.find(item => item.id === (selectedId || current?.id)) || list[0];
    if (selected) {
      const full: AuditInstance = await fetch(`/api/audits/${selected.id}`, { cache: "no-store" }).then(response => response.json());
      setCurrent(full);
      setResponsibleName(full.responsibleName || "");
      setResponsibleRole(full.responsibleRole || "");
    } else setCurrent(null);
  };
  useEffect(() => { void load(); }, []);

  const start = async () => {
    setBusy(true); setError("");
    const response = await fetch("/api/audits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const payload = await response.json();
    if (response.ok) await load(payload.id); else setError(payload.message || "暂时无法开始自查。");
    setBusy(false);
  };

  const save = async (responseItem: AuditResponse) => {
    if (!current) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/audits/${current.id}/responses`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemCode: responseItem.itemCode, conclusion: responseItem.conclusion, explanation: responseItem.explanation, evidenceNote: responseItem.evidenceNote })
    });
    const payload = await response.json();
    if (response.ok) await load(current.id); else setError(payload.message || "本项保存失败。");
    setBusy(false);
  };

  const patchLocal = (itemCode: string, patch: Partial<AuditResponse>) => setCurrent(value => value ? ({ ...value, responses: value.responses?.map(item => item.itemCode === itemCode ? { ...item, ...patch } : item) }) : value);

  const sign = async () => {
    if (!current) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/audits/${current.id}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsibleName, responsibleRole }) });
    const payload = await response.json();
    if (response.ok) { setSigning(false); await load(current.id); } else setError(payload.message || "暂时无法确认归档。");
    setBusy(false);
  };

  const groupResponses = useMemo(() => current?.responses?.filter(item => item.definition.groupCode === groupCode) || [], [current, groupCode]);
  const readOnly = current?.status === "signed" || current?.status === "archived";
  const latestSigned = instances.find(item => item.status === "signed");
  const nextDue = latestSigned?.signedAt ? (() => { const date = new Date(latestSigned.signedAt!); date.setFullYear(date.getFullYear() + 5); return date.toLocaleDateString("zh-CN"); })() : null;

  return <>
    <section className="page-heading"><div><p className="eyebrow">官方合规审计自查</p><h1>按六组日常问题，完成 24 项自查</h1><p>系统先带入已有业务、材料和评估线索；负责人根据实际情况判断并补充证明。</p></div>{current && <div className="heading-actions"><button className="button secondary" onClick={() => window.print()}><Printer size={16} /> 按官方格式打印/导出</button>{readOnly && <button className="button primary" onClick={start} disabled={busy}><ClipboardCheck size={16} /> 开始新一期</button>}</div>}</section>
    <div className="info-strip audit-cycle-strip"><CalendarClock /><div><strong>什么时候需要做全面检查？</strong><span>作为小型个人信息处理者，合规审计至少每五年开展一次，五年是最长间隔；也可以因业务变化、问题整改、检查准备或日常管理需要随时主动自查。{latestSigned?.signedAt ? ` 上次确认于 ${new Date(latestSigned.signedAt).toLocaleDateString("zh-CN")}，下次应不晚于 ${nextDue}。` : " 当前尚无已确认记录，可以先开展首次自查。"}</span></div></div>
    <div className="info-strip"><ShieldCheck /><div><strong>系统提供线索，不替您证明事实</strong><span>“符合”表示负责人已核对实际情况；“暂不符合”会自动形成整改事项；“与本单位无关”必须说明原因。</span></div></div>
    {error && <div className="alert danger">{error}</div>}

    {!current ? <section className="audit-start card"><div className="step-icon"><FileCheck2 /></div><h2>建立本单位第一份合规审计自查记录</h2><p>可以现在主动开展，也可以按不超过五年的周期安排。系统会创建官方 24 项工作底稿，并按容易理解的六组问题逐步完成。</p><button className="button primary large" onClick={start} disabled={busy}>{busy ? <RefreshCw className="spin" size={17} /> : <ClipboardCheck size={17} />} 开始自查</button></section> : <>
      <section className="audit-overview card"><div><span>当前进度</span><strong>{current.answeredCount} / 24</strong><small>{current.status === "signed" ? `已由 ${current.responsibleName} 确认归档` : "回答会自动保存在本期记录中"}</small></div><div className="audit-progress"><span style={{ width: `${current.progress * 100}%` }} /></div><div className="audit-stats"><span><CheckCircle2 /> 已判断 {current.answeredCount}</span><span className={current.nonCompliantCount ? "warning-text" : ""}><AlertTriangle /> 待整改 {current.nonCompliantCount}</span></div></section>
      <div className="audit-layout">
        <aside className="audit-groups">{auditGroups.map(group => {
          const items = current.responses?.filter(item => item.definition.groupCode === group.code) || [];
          const answered = items.filter(item => item.conclusion !== "unanswered").length;
          return <button key={group.code} className={groupCode === group.code ? "active" : ""} onClick={() => setGroupCode(group.code)}><span>{group.code.slice(1)}</span><div><strong>{group.name}</strong><small>{answered}/{items.length} 已判断</small></div><ChevronRight /></button>;
        })}</aside>
        <section className="audit-workspace"><div className="audit-group-head"><p className="eyebrow">{groupCode}</p><h2>{auditGroups.find(item => item.code === groupCode)?.name}</h2><p>{auditGroups.find(item => item.code === groupCode)?.description}</p></div><div className="audit-question-list">{groupResponses.map(item => <article className="audit-question" key={item.id}>
          <div className="audit-question-title"><span>{item.definition.number}</span><div><strong>{item.definition.question}</strong><p>{item.definition.title} · {item.definition.help}</p></div></div>
          {item.signals.length > 0 && <div className="audit-signals"><strong>系统从已有记录中发现</strong>{item.signals.map((signal, index) => <p className={`signal-${signal.tone}`} key={`${item.itemCode}-${index}`}>{signal.text}</p>)}</div>}
          <div className="conclusion-choices">{(["compliant", "non_compliant", "not_applicable"] as AuditConclusion[]).map(value => <button key={value} disabled={readOnly} className={item.conclusion === value ? `selected choice-${value}` : ""} onClick={() => patchLocal(item.itemCode, { conclusion: value })}>{conclusionLabels[value]}</button>)}</div>
          <label className="field"><span>{item.conclusion === "not_applicable" ? "为什么与本单位无关（必填）" : item.conclusion === "non_compliant" ? "实际情况和准备怎样整改（必填）" : "判断说明（建议填写）"}</span><textarea readOnly={readOnly} value={item.explanation} onChange={event => patchLocal(item.itemCode, { explanation: event.target.value })} placeholder="请用实际业务语言说明，不必照抄法规。" /></label>
          <label className="field"><span>证明材料或存放位置（选填）</span><input readOnly={readOnly} value={item.evidenceNote} onChange={event => patchLocal(item.itemCode, { evidenceNote: event.target.value })} placeholder={`例如：${item.definition.evidenceExamples.join("、")}`} /></label>
          <div className="audit-question-actions">{item.taskId && <a className="task-created" href="/tasks"><ClipboardCheck size={14} /> 已生成整改事项</a>} {!readOnly && <button className="button small primary" disabled={busy || item.conclusion === "unanswered" || ((item.conclusion === "non_compliant" || item.conclusion === "not_applicable") && !item.explanation.trim())} onClick={() => save(item)}>保存本项</button>}</div>
        </article>)}</div></section>
      </div>
      {!readOnly && <section className="audit-finish card"><div><strong>{current.answeredCount === 24 ? "24 项已经完成判断" : `还需判断 ${24 - current.answeredCount} 项`}</strong><p>正式确认后，本期答案、负责人、时间和内容哈希将冻结，不能直接修改。</p></div><button className="button primary" disabled={current.answeredCount !== 24} onClick={() => setSigning(true)}><FileCheck2 size={16} /> 负责人确认并归档</button></section>}
      <OfficialAuditPrint instance={current} />
    </>}

    {signing && current && <div className="modal-backdrop" onClick={() => setSigning(false)}><section className="modal" onClick={event => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">负责人确认</p><h2>确认本期自查内容</h2><p>请确认答案来自本单位实际情况，并已说明所有不符合和不适用项目。</p></div><button className="icon-button" onClick={() => setSigning(false)}>×</button></div><label className="field"><span>确认人姓名</span><input value={responsibleName} onChange={event => setResponsibleName(event.target.value)} /></label><label className="field"><span>在本单位的角色</span><input value={responsibleRole} onChange={event => setResponsibleRole(event.target.value)} placeholder="例如：负责人、行政经理" /></label>{error && <div className="alert danger">{error}</div>}<div className="source-note">确认后生成只读归档记录。以后情况变化时，请开始新一期自查，不覆盖历史记录。</div><div className="modal-actions"><button className="button secondary" onClick={() => setSigning(false)}>取消</button><button className="button primary" disabled={busy || !responsibleName.trim() || !responsibleRole.trim()} onClick={sign}>确认并归档</button></div></section></div>}
  </>;
}

function OfficialAuditPrint({ instance }: { instance: AuditInstance }) {
  return <section className="official-print audit-print"><h1>小型个人信息处理者个人信息保护合规审计自查表</h1><p>自查记录：{instance.title}　状态：{instance.status === "signed" ? "已确认归档" : "工作底稿"}</p><table><thead><tr><th>序号</th><th>审计事项</th><th>结论</th><th>说明及整改情况</th></tr></thead><tbody>{instance.responses?.map(item => <tr key={item.itemCode}><td>{item.definition.number}</td><td>{item.definition.title}</td><td>{conclusionLabels[item.conclusion]}</td><td>{item.explanation || item.evidenceNote || "—"}</td></tr>)}</tbody></table><footer>负责人：{instance.responsibleName || "____________"}　角色：{instance.responsibleRole || "____________"}　日期：{instance.signedAt ? new Date(instance.signedAt).toLocaleDateString("zh-CN") : "____________"}</footer></section>;
}
