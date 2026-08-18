"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type {
  AssessmentRun,
  AuditInstance,
  DashboardData,
  PipiaCategoryCode,
  PipiaInstance,
  ProcessingActivity
} from "@/lib/types";

interface Recommendation {
  activity: ProcessingActivity;
  recommendedCodes: PipiaCategoryCode[];
  reasons: string[];
}

interface PipiaData {
  instances: PipiaInstance[];
  recommendations: Recommendation[];
}

export default function ComplianceCheckPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRun[]>([]);
  const [audits, setAudits] = useState<AuditInstance[]>([]);
  const [pipia, setPipia] = useState<PipiaData>({ instances: [], recommendations: [] });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [dashboardData, assessmentData, auditData, pipiaData] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }).then(response => response.json()),
        fetch("/api/assessments", { cache: "no-store" }).then(response => response.json()),
        fetch("/api/audits", { cache: "no-store" }).then(response => response.json()),
        fetch("/api/pipia", { cache: "no-store" }).then(response => response.json())
      ]);
      setDashboard(dashboardData);
      setAssessments(assessmentData || []);
      setAudits(auditData || []);
      setPipia(pipiaData || { instances: [], recommendations: [] });
    } catch {
      setError("暂时无法整理检查进度，请稍后刷新。");
    }
  };

  useEffect(() => { void load(); }, []);

  const latestAssessmentByActivity = useMemo(() => {
    const result = new Map<string, AssessmentRun>();
    for (const assessment of assessments) {
      const current = result.get(assessment.activityId);
      if (!current || assessment.sequence > current.sequence) result.set(assessment.activityId, assessment);
    }
    return result;
  }, [assessments]);

  const runCheck = async (activityId: string) => {
    setBusy(activityId);
    setError("");
    try {
      const response = await fetch("/api/ai/scenario-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "暂时无法完成检查。");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法完成检查。");
    } finally {
      setBusy("");
    }
  };

  if (!dashboard && !error) return <div className="loading"><RefreshCw className="spin" /> 正在整理您的检查进度…</div>;
  if (!dashboard) return <div className="alert danger">{error}</div>;

  const activeAudit = audits.find(item => item.status !== "signed" && item.status !== "archived");
  const signedAudit = audits.find(item => item.status === "signed");
  const recommended = pipia.recommendations.filter(item => item.recommendedCodes.length > 0 && !pipia.instances.some(instance => instance.activityId === item.activity.id && instance.status === "signed"));
  const unfinishedPipia = pipia.instances.filter(item => item.status !== "signed" && item.status !== "archived");
  const signedPipia = pipia.instances.filter(item => item.status === "signed");
  const auditComplete = Boolean(signedAudit && !activeAudit);
  const nextAuditDue = signedAudit?.signedAt ? (() => {
    const date = new Date(signedAudit.signedAt!);
    date.setFullYear(date.getFullYear() + 5);
    return date.toLocaleDateString("zh-CN");
  })() : null;

  return <>
    <section className="page-heading">
      <div>
        <p className="eyebrow">合规检查</p>
        <h1>系统告诉您下一步做什么</h1>
        <p>先检查每项业务；只有出现特定情况时，才需要专项评估。全面检查会复用前面已经确认的信息。</p>
      </div>
      <Link className="button secondary" href="/records"><ClipboardCheck size={16} /> 查看全部记录</Link>
    </section>

    {error && <div className="alert danger">{error}</div>}

    <section className="check-guide card">
      <div className="check-guide-step active"><span>1</span><div><strong>检查具体业务</strong><small>确认填写完整、前后一致</small><span className="check-guide-note">完成后形成检查记录，为第 3 步提供线索</span></div></div>
      <ArrowRight />
      <div className={`check-guide-step ${recommended.length || unfinishedPipia.length ? "attention" : ""}`}><span>2</span><div><strong>必要时专项评估</strong><small>系统触发时才需要填写</small><span className="check-guide-note">敏感信息、自动化决策、出境等情形触发</span></div></div>
      <ArrowRight />
      <div className={`check-guide-step ${auditComplete ? "done" : ""}`}><span>{auditComplete ? <CheckCircle2 /> : "3"}</span><div><strong>全面检查本单位</strong><small>至少每五年一次，也可随时自查</small><span className="check-guide-note">复用前序已确认信息</span></div></div>
    </section>

    <section className="check-section">
      <div className="check-section-heading"><div><p className="eyebrow">先做这里</p><h2>逐项检查当前业务</h2><p>系统分析您已经确认的内容，不要求重复填写，也不会核验事实真伪。</p></div><Link className="text-link" href="/business">管理业务 <ArrowRight size={15} /></Link></div>
      <div className="check-action-list">
        {dashboard.activities.length ? dashboard.activities.map(activity => {
          const latest = latestAssessmentByActivity.get(activity.id);
          const factsReady = activity.completeness >= 1;
          const needsNewCheck = !latest || latest.validity === "outdated";
          return <article className="check-action-card" key={activity.id}>
            <div className={`check-action-icon ${factsReady && !needsNewCheck ? "complete" : ""}`}>{factsReady && !needsNewCheck ? <CheckCircle2 /> : <Building2 />}</div>
            <div className="check-action-main">
              <div><strong>{activity.name}</strong><span>{Math.round(activity.completeness * 100)}% 信息已确认</span></div>
              {!factsReady && <p>业务情况还没有填写完整，请先补充信息类型、用途、系统和保存时间。</p>}
              {factsReady && needsNewCheck && <p>{latest?.validity === "outdated" ? "业务情况已经修改，需要重新检查。" : "信息已经完整，可以开始检查这项业务。"}</p>}
              {factsReady && !needsNewCheck && <p>{latest.summary}</p>}
            </div>
            {!factsReady
              ? <Link className="button small secondary" href="/business">完善业务情况</Link>
              : needsNewCheck
                ? <button className="button small primary" disabled={busy === activity.id} onClick={() => runCheck(activity.id)}>{busy === activity.id ? <RefreshCw className="spin" size={15} /> : <Sparkles size={15} />} 检查这项业务</button>
                : <Link className="button small secondary" href="/assessments"><FileSearch size={15} /> 查看检查结果</Link>}
          </article>;
        }) : <div className="check-empty"><Building2 /><div><strong>还没有记录业务</strong><p>先用熟悉的业务名称说明贵单位怎样使用个人信息。</p></div><Link className="button primary" href="/business">记录第一项业务</Link></div>}
      </div>
    </section>

    {(recommended.length > 0 || unfinishedPipia.length > 0 || signedPipia.length > 0) && <section className="check-section special-check">
      <div className="check-section-heading"><div><p className="eyebrow">按需开展</p><h2>专项评估与历史记录</h2><p>敏感信息、自动化决策、委托处理或对外提供、公开、境外提供以及其他重大影响活动，需要结合具体业务开展影响评估。</p></div></div>
      <div className="check-action-list">
        {(recommended.length > 0 || unfinishedPipia.length > 0) && <div className="special-check-card card"><div className="special-check-icon"><Scale /></div><div><strong>{unfinishedPipia.length ? `${unfinishedPipia.length} 份专项评估尚未完成` : `${recommended.length} 项业务可能需要专项评估`}</strong><p>{unfinishedPipia.length ? "请继续核对目的、可能影响和保护办法。" : recommended.map(item => `${item.activity.name}：${item.reasons.join("、")}`).join("；")}</p></div><Link className="button primary" href="/impact-assessments">{unfinishedPipia.length ? "继续专项评估" : "查看为什么需要评估"}<ArrowRight size={15} /></Link></div>}
        {signedPipia.length > 0 && <div className="special-check-card card archived-assessment-card"><div className="special-check-icon complete"><FileCheck2 /></div><div><strong>已有 {signedPipia.length} 份专项评估确认归档</strong><p>{signedPipia.map(item => item.activityName).slice(0, 3).join("、")}{signedPipia.length > 3 ? "等" : ""}；可随时查看历史事实、负责人和结论，并按官方格式打印或导出PDF。</p></div><Link className="button secondary" href="/impact-assessments">查看与导出<ArrowRight size={15} /></Link></div>}
      </div>
    </section>}

    <section className="check-section">
      <div className="check-section-heading"><div><p className="eyebrow">周期性合规审计，也可主动自查</p><h2>全面检查本单位</h2><p>小型个人信息处理者至少每五年开展一次个人信息保护合规审计；五年是最长间隔。业务变化、发现问题、准备接受检查，或只是希望主动核对时，都可以随时新建一次自查。</p></div></div>
      <div className="full-check-card card">
        <div className={`full-check-status ${auditComplete ? "complete" : ""}`}><ShieldCheck /></div>
        <div><strong>{activeAudit ? `本期全面检查已完成 ${activeAudit.answeredCount}/24 项` : signedAudit ? "本单位已有确认归档的合规审计" : "尚未建立首次合规审计记录"}</strong><p>{activeAudit ? "可以随时继续，已经填写的内容会自动保存。" : signedAudit ? `上次确认：${new Date(signedAudit.signedAt!).toLocaleDateString("zh-CN")}；按五年最长间隔计算，下次应不晚于 ${nextAuditDue}。业务变化时可提前自查。` : "可现在主动开展首次自查；完成确认后，系统将据此计算下一次五年周期提示。"}</p></div>
        <Link className={`button ${auditComplete ? "secondary" : "primary"}`} href="/self-audit">{activeAudit ? "继续全面检查" : signedAudit ? "查看全面检查" : "开始全面检查"}<ArrowRight size={15} /></Link>
      </div>
    </section>

    <section className="check-history-note">
      <AlertTriangle size={16} />
      <span>"业务检查""全面检查"和"专项评估"在后台仍分别保存，便于负责人确认、打印和追溯；这里只把操作入口合并。</span>
    </section>

    <section className="check-history-links">
      <Link href="/assessments" className="history-link"><FileSearch size={15} /> 业务检查记录</Link>
      <Link href="/impact-assessments" className="history-link"><Scale size={15} /> 专项评估记录</Link>
      <Link href="/self-audit" className="history-link"><ShieldCheck size={15} /> 全面检查记录</Link>
    </section>
  </>;
}
