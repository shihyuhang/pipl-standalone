"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ClipboardList, FileText, Plus, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { getComplianceProgress } from "@/lib/dashboard-progress";
import { getDashboardTaskGuidance, prioritizeDashboardTasks } from "@/lib/dashboard-priority";
import { assessQualification } from "@/lib/qualification";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"guided" | "full">("guided");
  const load = () => fetch("/api/dashboard", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setError("暂时无法读取工作台，请稍后刷新。"));
  useEffect(() => { void load(); setViewMode(window.localStorage.getItem("pipl-home-view") === "full" ? "full" : "guided"); }, []);
  const changeViewMode = (mode: "guided" | "full") => { setViewMode(mode); window.localStorage.setItem("pipl-home-view", mode); };
  if (error) return <div className="alert danger">{error}</div>;
  if (!data) return <div className="loading"><RefreshCw className="spin" /> 正在整理您的合规工作台…</div>;
  if (!data.enterprise.onboardingCompleted) return <Welcome />;

  const priorityContext = { activityCount: data.counts.activities };
  const openTasks = prioritizeDashboardTasks(data.tasks.filter(t => t.status !== "completed"), priorityContext).slice(0, 4);
  const primaryTask = openTasks[0];
  const primaryGuidance = primaryTask ? getDashboardTaskGuidance(primaryTask, priorityContext) : null;
  const staleDocuments = data.documents.filter(d => d.healthStatus === "needs_review" || d.healthStatus === "overdue");
  const qualification = assessQualification(data.enterprise);
  const progress = getComplianceProgress({
    onboardingCompleted: data.enterprise.onboardingCompleted,
    activityCount: data.counts.activities,
    hasPublishedDocument: data.documents.some(document => Boolean(document.currentVersionId)),
    signedAuditCount: data.counts.signedAudits,
    followUpRecordCount: data.counts.followUpRecords
  });
  return <>
    <section className="page-heading"><div><p className="eyebrow">工作台首页</p><h1>您好，{data.enterprise.legalName}</h1><p>{viewMode === "guided" ? "先完成系统排在最前的一项；需要查看全部进度时可切换完整视图。" : "根据业务变化，系统持续整理适用义务、材料和待办。"}</p></div><div className="heading-actions"><button className="button secondary" onClick={() => changeViewMode(viewMode === "guided" ? "full" : "guided")}>{viewMode === "guided" ? "查看完整进度" : "返回引导视图"}</button><Link className="button secondary" href="/business"><Plus size={17} /> 记录业务</Link></div></section>

    {staleDocuments.length > 0 && <Link href="/documents" className="alert warning change-alert"><AlertTriangle size={16} /><div><strong>单位或业务情况已更新</strong><span>{staleDocuments.length} 份合规材料需复核更新，涉及：{staleDocuments.slice(0, 2).map(d => d.name).join("、")}{staleDocuments.length > 2 ? ` 等 ${staleDocuments.length} 份` : ""}。</span></div><ArrowRight size={15} /></Link>}

    <section className={`hero-status tone-${qualification.status}`}>
      <div className="hero-status-icon">{qualification.status === "eligible" ? <CheckCircle2 /> : <ShieldAlert />}</div>
      <div className="hero-status-copy"><span>当前工作路径</span><h2>{qualification.summary}</h2><StatusBadge status={qualification.status} />{qualification.status === "conditional" && <p className="hero-status-hint">还需确认人数口径和处理角色后才能形成正式判断。</p>}{qualification.status === "needs_review" && <p className="hero-status-hint">涉及敏感信息、未成年人或出境，需负责人专项确认。</p>}{qualification.status === "out_of_scope" && <p className="hero-status-hint">人数已达 10 万，建议转专业人员评估。</p>}</div>
      <Link href="/business" className="button secondary small">单位情况有变化？前往修改 <ArrowRight size={15} /></Link>
    </section>

    <div className="home-main-layout">
    {viewMode === "full" && <section className="card progress-card">
      <div className="progress-card-label">合规建设进度</div>
      <div className="progress-steps">
        {progress.map((step, index) => <div className="progress-fragment" key={step.code}>
          {index > 0 && <div className={`progress-line ${step.status === "done" ? "done" : step.status === "active" ? "active" : ""}`} />}
          <div className={`progress-step ${step.status}`}><div className="progress-dot">{step.status === "done" ? "✓" : index + 1}</div><span>{step.label}</span></div>
        </div>)}
      </div>
    </section>}

    {viewMode === "full" && <div className="metric-grid">
      <Link href="/business" className="metric-card"><Building2 /><div><strong>{data.counts.activities}</strong><span>已记录业务</span></div><ArrowRight className="metric-arrow" /></Link>
      <Link href="/documents" className="metric-card"><FileText /><div><strong>{data.counts.documents}</strong><span>合规材料</span></div><ArrowRight className="metric-arrow" /></Link>
      <Link href="/compliance-check" className="metric-card"><ShieldCheck /><div><strong>{data.counts.signedAudits}/{data.counts.audits}</strong><span>已归档 / 全面检查</span></div><ArrowRight className="metric-arrow" /></Link>
      <Link href="/tasks" className="metric-card"><ClipboardList /><div><strong>{data.counts.openTasks}</strong><span>待办理事项</span></div><ArrowRight className="metric-arrow" /></Link>
    </div>}

    <div className={`dashboard-grid ${viewMode === "guided" ? "guided" : ""}`}>
      <section className="card priority-card"><div className="card-header"><div><p className="eyebrow">系统已按影响排序</p><h2>现在先做什么</h2></div><Link href="/tasks" className="text-link">查看全部 <ArrowRight size={15} /></Link></div>
        <p className="dashboard-priority-note">先判断适用范围和高风险事项，再补齐基础事实，最后完善常规材料。</p>
        {primaryTask && primaryGuidance ? <>
          <Link href={`/tasks?task=${primaryTask.id}`} className={`primary-task-callout urgency-${primaryGuidance.urgency}`}>
            <div className="primary-task-icon">{primaryGuidance.urgency === "immediate" ? <ShieldAlert size={21} /> : <ClipboardList size={21} />}</div>
            <div className="primary-task-copy"><span className={`task-urgency-badge urgency-${primaryGuidance.urgency}`}>{primaryGuidance.label}</span><h3>{primaryTask.title}</h3><p><strong>为什么排在最前：</strong>{primaryGuidance.reason}</p></div>
            <span className="primary-task-action">开始处理 <ArrowRight size={16} /></span>
          </Link>
          {openTasks.length > 1 && <div className="next-task-heading">完成上项后，再按此顺序办理</div>}
          <div className="task-list compact">{openTasks.slice(1).map(task => {
            const guidance = getDashboardTaskGuidance(task, priorityContext);
            return <Link href={`/tasks?task=${task.id}`} className="task-row" key={task.id}><span className={`task-urgency-badge urgency-${guidance.urgency}`}>{guidance.label}</span><div><strong>{task.title}</strong><p>{guidance.reason}</p></div><ArrowRight size={17} /></Link>;
          })}</div>
        </> : <div className="all-clear"><CheckCircle2 /><div><strong>当前没有待办</strong><p>业务发生变化时，请及时更新企业情况。</p></div></div>}
      </section>
      {viewMode === "full" && <section className="card quick-card"><div className="card-header"><div><p className="eyebrow">其他入口</p><h2>按需使用</h2></div></div><p className="quick-card-hint">以下是快捷入口，不代表当前优先顺序。</p>
        <Link href="/business"><div className="quick-icon blue"><Plus /></div><div><strong>记录一项业务</strong><span>说明怎样使用个人信息</span></div><ArrowRight /></Link>
        <Link href="/documents"><div className="quick-icon green"><FileText /></div><div><strong>建立隐私声明</strong><span>生成草稿并管理版本</span></div><ArrowRight /></Link>
        <Link href="/compliance-check"><div className="quick-icon green"><ShieldCheck /></div><div><strong>继续合规检查</strong><span>系统根据当前业务告诉您下一步</span></div><ArrowRight /></Link>
        <Link href="/records"><div className="quick-icon amber"><ClipboardList /></div><div><strong>查看合规记录</strong><span>了解已经完成的工作</span></div><ArrowRight /></Link>
      </section>}
    </div>
    </div>
  </>;
}

function Welcome() {
  return <div className="welcome-page"><div className="welcome-glow" /><div className="welcome-mark"><ShieldAlert size={32} /></div><p className="eyebrow">欢迎使用个保轻舟</p><h1>用简单步骤，建立贵单位的<br />个人信息保护档案</h1><p className="welcome-lead">不需要先读懂法规。回答几个业务问题，我们会判断适用路径、生成待办，并开始整理合规材料。</p><div className="welcome-steps"><div><span>1</span><strong>了解企业</strong><p>确认单位性质和大致人数</p></div><div><span>2</span><strong>判断路径</strong><p>识别需要关注的特殊情况</p></div><div><span>3</span><strong>开始办理</strong><p>形成材料、任务和可追溯记录</p></div></div><Link className="button primary large" href="/onboarding">开始快速建档 <ArrowRight size={18} /></Link><small>预计 5 分钟，可随时继续完善</small></div>;
}
