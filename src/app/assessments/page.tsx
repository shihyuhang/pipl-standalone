"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, ClipboardCheck, History, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { AssessmentRun } from "@/lib/types";

const statusText = { draft_ready: "可继续完善", needs_input: "需要补充", needs_review: "需要复核" };
const riskText = { L0: "待补充", L1: "建议完善", L2: "负责人确认", L3: "专业复核" };

export default function AssessmentsPage() {
  const [items, setItems] = useState<AssessmentRun[]>([]);
  const [selected, setSelected] = useState<AssessmentRun | null>(null);
  const [busy, setBusy] = useState("");

  const load = async (selectedId?: string) => {
    const result = await fetch("/api/assessments", { cache: "no-store" }).then(response => response.json()) as AssessmentRun[];
    setItems(result);
    setSelected(current => result.find(item => item.id === (selectedId || current?.id)) || result[0] || null);
  };
  useEffect(() => { void load(); }, []);

  const toTask = async (assessmentId: string, findingId: string) => {
    setBusy(findingId);
    await fetch(`/api/assessments/${assessmentId}/findings/${findingId}/task`, { method: "POST" });
    await load(assessmentId);
    setBusy("");
  };

  return <>
    <section className="page-heading"><div><p className="eyebrow">初步检查</p><h1>每次检查都有记录</h1><p>这里保存当时使用的业务情况、检查结果和后续待办；业务修改后，旧结论会自动标记为“已过时”。</p></div><Link className="button primary" href="/business"><RefreshCw size={16} /> 开始新检查</Link></section>
    {items.length ? <div className="assessment-layout">
      <div className="assessment-list">{items.map(item => <button key={item.id} className={selected?.id === item.id ? "assessment-row selected" : "assessment-row"} onClick={() => setSelected(item)}><div><strong>{item.activityName}</strong><span>第 {item.sequence} 次 · {new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</span></div><small className={item.validity === "outdated" ? "validity outdated" : "validity"}>{item.validity === "outdated" ? "已过时" : statusText[item.status]}</small></button>)}</div>
      <section className="assessment-detail">{selected && <>
        <div className="detail-header"><div><p className="eyebrow">{selected.source === "dify" ? "Dify 辅助分析" : "本地规则检查"}</p><h2>{selected.activityName}</h2><p>第 {selected.sequence} 次检查 · {selected.workflowVersion}</p></div><span className={selected.validity === "outdated" ? "validity outdated large" : "validity large"}>{selected.validity === "outdated" ? "业务已修改，结果仅供追溯" : statusText[selected.status]}</span></div>
        {selected.validity === "outdated" && <div className="alert warning"><AlertTriangle size={16} /> 这次检查所依据的业务情况后来发生了变化，请以新的业务事实重新检查。</div>}
        <div className="assessment-summary"><Bot /><div><strong>检查结论</strong><p>{selected.summary}</p></div></div>
        <div className="snapshot-note"><strong>结论边界</strong><span>系统检查填写内容的完整性和一致性，不核验合同、系统设置或实际操作是否与填写内容相同。</span></div>
        <h3 className="section-title">发现与后续处理</h3>
        {selected.findings.length ? <div className="finding-list">{selected.findings.map(finding => <div className="finding finding-action" key={finding.id}><span className={`risk risk-${finding.riskLevel}`}>{riskText[finding.riskLevel]}</span><div><strong>{finding.title}</strong><p>{finding.description}</p></div>{finding.taskId ? <Link className="task-created" href="/tasks"><CheckCircle2 size={14} /> 查看待办</Link> : <button className="button small secondary" disabled={busy === finding.id} onClick={() => toTask(selected.id, finding.id)}>{busy === finding.id ? "生成中…" : "生成待办"}</button>}</div>)}</div> : <div className="all-clear"><CheckCircle2 /><div><strong>本次未形成需要办理的发现</strong><p>仍应由负责人确认填写事实与实际业务一致。</p></div></div>}
        <details className="snapshot"><summary>查看本次使用的业务情况快照</summary><div className="snapshot-grid"><div><span>涉及人员</span><strong>{selected.factsSnapshot.dataSubjects.join("、") || "未填写"}</strong></div><div><span>个人信息</span><strong>{selected.factsSnapshot.informationTypes.join("、") || "未填写"}</strong></div><div><span>使用目的</span><strong>{selected.factsSnapshot.purposes.join("、") || "未填写"}</strong></div><div><span>保存期限</span><strong>{selected.factsSnapshot.retentionPeriod || "未填写"}</strong></div></div></details>
      </>}</section>
    </div> : <EmptyState icon={History} title="还没有初步检查记录" description="先完善一项业务情况，再运行初步检查。结果会自动保存在这里。" action={<Link className="button primary" href="/business"><ClipboardCheck size={16} /> 前往我的业务</Link>} />}
  </>;
}
