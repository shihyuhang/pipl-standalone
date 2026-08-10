"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Archive, CheckCircle2, Download, FileText, History, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import type { DashboardData } from "@/lib/types";

export default function RecordsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  useEffect(() => { fetch("/api/dashboard", { cache: "no-store" }).then(response => response.json()).then(setData); }, []);
  return <>
    <section className="page-heading"><div><p className="eyebrow">记录与导出</p><h1>清楚证明做过哪些工作</h1><p>企业情况、材料版本、自查、影响评估和任务办理都会形成时间记录。</p></div><button className="button secondary" onClick={() => window.print()}><Download size={17} /> 打印当前档案</button></section>
    <div className="records-grid">
      <section className="card"><div className="card-header"><div><p className="eyebrow">合规时间线</p><h2>最近记录</h2></div><History /></div>{data?.recentEvents.length ? <div className="timeline">{data.recentEvents.map(event => <div className="timeline-item" key={event.id}><span /><div><strong>{event.summary}</strong><time>{new Date(event.createdAt).toLocaleString("zh-CN", { hour12: false })}</time></div></div>)}</div> : <div className="empty-mini"><Archive /><p>完成建档或创建材料后，这里会自动形成记录。</p></div>}</section>
      <section className="card archive-card"><div className="card-header"><div><p className="eyebrow">档案概览</p><h2>当前可归集内容</h2></div><LockKeyhole /></div>
        <div className="archive-row"><CheckCircle2 /><div><strong>企业基本情况</strong><span>{data?.enterprise.onboardingCompleted ? "已建立" : "待建立"}</span></div></div>
        <div className="archive-row"><FileText /><div><strong>业务场景</strong><span>{data?.counts.activities || 0} 项</span></div></div>
        <div className="archive-row"><FileText /><div><strong>隐私声明及版本</strong><span>{data?.counts.documents || 0} 份</span></div></div>
        <Link className="archive-row archive-link" href="/self-audit"><ShieldCheck /><div><strong>官方合规自查</strong><span>{data?.counts.signedAudits || 0} 份已确认 / {data?.counts.audits || 0} 份记录</span></div></Link>
        <Link className="archive-row archive-link" href="/impact-assessments"><Scale /><div><strong>个人信息保护影响评估</strong><span>{data?.counts.impactAssessments || 0} 份</span></div></Link>
        <div className="archive-row"><CheckCircle2 /><div><strong>整改和任务记录</strong><span>{data?.counts.completedTasks || 0} 项已完成</span></div></div>
        <div className="source-note">已确认的自查和影响评估会冻结负责人、确认时间及内容哈希。进入相应页面可按官方顺序打印归档表。</div>
      </section>
    </div>
  </>;
}
