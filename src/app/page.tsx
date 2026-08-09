"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ClipboardList, FileText, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const load = () => fetch("/api/dashboard", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setError("暂时无法读取工作台，请稍后刷新。"));
  useEffect(() => { void load(); }, []);
  if (error) return <div className="alert danger">{error}</div>;
  if (!data) return <div className="loading"><RefreshCw className="spin" /> 正在整理您的合规工作台…</div>;
  if (!data.enterprise.onboardingCompleted) return <Welcome />;

  const openTasks = data.tasks.filter(t => t.status !== "completed").slice(0, 4);
  return <>
    <section className="page-heading"><div><p className="eyebrow">工作台首页</p><h1>您好，{data.enterprise.legalName}</h1><p>先完成最重要的几件事，系统会同步整理材料和记录。</p></div><Link className="button secondary" href="/business"><Plus size={17} /> 业务有变化</Link></section>

    <section className={`hero-status tone-${data.enterprise.qualificationStatus}`}>
      <div className="hero-status-icon">{data.enterprise.qualificationStatus === "eligible" ? <CheckCircle2 /> : <ShieldAlert />}</div>
      <div className="hero-status-copy"><span>当前工作路径</span><h2>{data.enterprise.qualificationSummary}</h2><StatusBadge status={data.enterprise.qualificationStatus} /></div>
      <Link href="/onboarding" className="text-link">更新企业情况 <ArrowRight size={16} /></Link>
    </section>

    <div className="metric-grid">
      <Link href="/business" className="metric-card"><Building2 /><div><strong>{data.counts.activities}</strong><span>已记录业务</span></div><ArrowRight className="metric-arrow" /></Link>
      <Link href="/documents" className="metric-card"><FileText /><div><strong>{data.counts.documents}</strong><span>合规材料</span></div><ArrowRight className="metric-arrow" /></Link>
      <Link href="/tasks" className="metric-card"><ClipboardList /><div><strong>{data.counts.openTasks}</strong><span>待办理事项</span></div><ArrowRight className="metric-arrow" /></Link>
    </div>

    <div className="dashboard-grid">
      <section className="card"><div className="card-header"><div><p className="eyebrow">今天需要处理</p><h2>下一步做什么</h2></div><Link href="/tasks" className="text-link">查看全部 <ArrowRight size={15} /></Link></div>
        {openTasks.length ? <div className="task-list compact">{openTasks.map((task, index) => <Link href="/tasks" className="task-row" key={task.id}><span className="task-index">{index + 1}</span><div><strong>{task.title}</strong><p>{task.description}</p></div>{task.priority === "high" && <AlertTriangle size={17} className="warning-icon" />}<ArrowRight size={17} /></Link>)}</div> : <div className="all-clear"><CheckCircle2 /><div><strong>当前没有待办</strong><p>业务发生变化时，请及时更新企业情况。</p></div></div>}
      </section>
      <section className="card quick-card"><div className="card-header"><div><p className="eyebrow">常用操作</p><h2>快速开始</h2></div></div>
        <Link href="/business"><div className="quick-icon blue"><Plus /></div><div><strong>记录一项业务</strong><span>说明怎样使用个人信息</span></div><ArrowRight /></Link>
        <Link href="/documents"><div className="quick-icon green"><FileText /></div><div><strong>建立隐私声明</strong><span>生成草稿并管理版本</span></div><ArrowRight /></Link>
        <Link href="/records"><div className="quick-icon amber"><ClipboardList /></div><div><strong>查看合规记录</strong><span>了解已经完成的工作</span></div><ArrowRight /></Link>
      </section>
    </div>
  </>;
}

function Welcome() {
  return <div className="welcome-page"><div className="welcome-glow" /><div className="welcome-mark"><ShieldAlert size={32} /></div><p className="eyebrow">欢迎使用个保轻舟</p><h1>用简单步骤，建立贵单位的<br />个人信息保护档案</h1><p className="welcome-lead">不需要先读懂法规。回答几个业务问题，我们会判断适用路径、生成待办，并开始整理合规材料。</p><div className="welcome-steps"><div><span>1</span><strong>了解企业</strong><p>确认单位性质和大致人数</p></div><div><span>2</span><strong>判断路径</strong><p>识别需要关注的特殊情况</p></div><div><span>3</span><strong>开始办理</strong><p>形成材料、任务和可追溯记录</p></div></div><Link className="button primary large" href="/onboarding">开始快速建档 <ArrowRight size={18} /></Link><small>预计 5 分钟，可随时继续完善</small></div>;
}
