"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bot, BriefcaseBusiness, Building2, CheckCircle2, ClipboardList,
  Globe2, Pencil, Plus, RefreshCw, Sparkles, Trash2, Users
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { emptyActivityFacts } from "@/lib/activity-facts";
import type { ActivityFacts, AssessmentRun, FactAnswer, ProcessingActivity } from "@/lib/types";

type Scenario = { code: string; name: string; description: string; recommended: string };
const optionGroups = {
  dataSubjects: ["客户联系人", "供应商联系人", "消费者或会员", "员工", "求职者", "访客", "其他人员"],
  informationTypes: ["姓名和联系方式", "单位和职务", "身份证件", "订单和交易", "薪酬和考勤", "地址或位置", "账号或设备信息", "照片或视频", "其他信息"],
  purposes: ["履行项目或合同", "客户和供应商联系", "员工管理", "提供产品或服务", "安全和门禁", "营销活动", "履行法定义务"],
  collectionChannels: ["本人主动提供", "企业客户或供应商提供", "网站或小程序", "邮件或电话", "设备自动采集", "公开渠道"],
  systems: ["邮箱或通讯工具", "Excel或本地文件", "网站后台", "CRM或ERP", "HR或薪酬系统", "云端SaaS", "门禁或监控", "纸质文件"],
  recipients: ["不向外部提供", "仅必要服务商", "集团内其他主体", "客户或合作方", "政府或法定机构", "暂不清楚"]
} satisfies Record<string, string[]>;

const answerOptions: Array<{ value: Exclude<FactAnswer, "">; label: string }> = [
  { value: "no", label: "不涉及" },
  { value: "yes", label: "涉及" },
  { value: "unknown", label: "不清楚" }
];

const triageTitles: Record<string, string> = {
  draft_ready: "初步检查已完成，可以继续完善合规档案",
  needs_input: "还需要补充一些业务情况",
  needs_review: "有几项情况需要负责人或专业人员确认"
};

const riskLabels: Record<string, string> = {
  L0: "待补充",
  L1: "建议完善",
  L2: "负责人确认",
  L3: "专业复核"
};

export default function BusinessPage() {
  const [catalog, setCatalog] = useState<Scenario[]>([]);
  const [activities, setActivities] = useState<ProcessingActivity[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState("");
  const [triage, setTriage] = useState<AssessmentRun | null>(null);
  const [editing, setEditing] = useState<ProcessingActivity | null>(null);
  const [facts, setFacts] = useState<ActivityFacts>(emptyActivityFacts());
  const [error, setError] = useState("");

  const load = () => fetch("/api/scenarios", { cache: "no-store" })
    .then(response => response.json())
    .then(data => { setCatalog(data.catalog); setActivities(data.activities); });

  useEffect(() => { void load(); }, []);
  const existing = useMemo(() => new Set(activities.map(item => item.scenarioCode)), [activities]);

  const add = async (scenario: Scenario) => {
    setBusy(scenario.code);
    const response = await fetch("/api/scenarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioCode: scenario.code, name: scenario.name, description: scenario.description })
    });
    if (response.ok) { await load(); setAdding(false); }
    setBusy("");
  };

  const remove = async (activity: ProcessingActivity) => {
    if (!confirm(`确认删除“${activity.name}”？\n\n未被引用的业务会连同对应的“完善业务情况”待办一起删除。已有检查记录或合规材料引用时，系统会阻止删除。`)) return;
    setBusy(`delete-${activity.id}`); setError("");
    const response = await fetch("/api/scenarios", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activity.id })
    });
    const payload = await response.json();
    if (response.ok) await load();
    else setError(payload.message || "暂时无法删除该业务。");
    setBusy("");
  };

  const openFacts = (activity: ProcessingActivity) => {
    setError("");
    setEditing(activity);
    setFacts({
      ...emptyActivityFacts(), ...activity.facts,
      dataSubjects: [...activity.facts.dataSubjects], informationTypes: [...activity.facts.informationTypes],
      purposes: [...activity.facts.purposes], collectionChannels: [...activity.facts.collectionChannels],
      systems: [...activity.facts.systems], recipients: [...activity.facts.recipients]
    });
  };

  const toggle = (field: keyof typeof optionGroups, value: string) => {
    setFacts(current => {
      const values = current[field] as string[];
      return { ...current, [field]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
    });
  };

  const saveFacts = async () => {
    if (!editing) return;
    setBusy(editing.id); setError("");
    const response = await fetch("/api/scenarios", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, facts })
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.message || "保存失败，请稍后重试。"); setBusy(""); return; }
    await load(); setEditing(null); setBusy("");
  };

  const assess = async (activity: ProcessingActivity) => {
    setBusy(activity.id); setTriage(null); setError("");
    const response = await fetch("/api/ai/scenario-triage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: activity.id })
    });
    const payload = await response.json();
    if (response.ok) setTriage(payload);
    else setError(payload.message || "暂时无法运行快速分流。");
    setBusy("");
  };

  const createFindingTask = async (findingId: string) => {
    if (!triage) return;
    setBusy(findingId);
    const response = await fetch(`/api/assessments/${triage.id}/findings/${findingId}/task`, { method: "POST" });
    if (response.ok) {
      const refreshed = await fetch(`/api/assessments/${triage.id}`, { cache: "no-store" }).then(item => item.json());
      setTriage(refreshed);
    }
    setBusy("");
  };

  const multiChoice = (field: keyof typeof optionGroups, title: string, help: string) => (
    <section className="fact-section">
      <div className="fact-title"><strong>{title}</strong><span>可多选</span></div>
      <p>{help}</p>
      <div className="tag-choices">
        {optionGroups[field].map(option => <button type="button" className={(facts[field] as string[]).includes(option) ? "selected" : ""} key={option} onClick={() => toggle(field, option)}>{option}</button>)}
      </div>
    </section>
  );

  const answerChoice = (field: "sensitiveInformation" | "minorsInvolved" | "crossBorderAccess", title: string, help: string) => (
    <section className="fact-section compact-fact">
      <div><strong>{title}</strong><p>{help}</p></div>
      <div className="segmented">
        {answerOptions.map(option => <button type="button" className={facts[field] === option.value ? "selected" : ""} key={option.value} onClick={() => setFacts(current => ({ ...current, [field]: option.value }))}>{option.label}</button>)}
      </div>
    </section>
  );

  return <>
    <section className="page-heading">
      <div><p className="eyebrow">我的业务</p><h1>贵单位怎样使用个人信息</h1><p>用熟悉的业务名称记录，不需要先理解法律术语。</p></div>
      <button className="button primary" onClick={() => setAdding(true)}><Plus size={17} /> 添加业务</button>
    </section>

    <div className="info-strip"><Building2 /><div><strong>先确认业务情况，再做初步检查</strong><span>系统检查填写内容是否完整、前后一致，以及是否需要进一步评估；不会自动核验事实真伪。</span></div></div>
    {error && !editing && <div className="alert danger">{error}</div>}

    {activities.length ? <div className="activity-grid">{activities.map(item => {
      const ready = item.completeness === 1;
      return <article className="activity-card" key={item.id}>
        <div className="activity-icon">{item.scenarioCode.includes("HR") ? <Users /> : item.scenarioCode.includes("WEBSITE") ? <Globe2 /> : <BriefcaseBusiness />}</div>
        <div className="activity-main">
          <div className="activity-title"><h3>{item.name}</h3><StatusBadge status={item.status} /></div>
          <p>{item.description}</p>
          <div className="completion"><div><span style={{ width: `${item.completeness * 100}%` }} /></div><small>已确认 {Math.round(item.completeness * 100)}%</small></div>
        </div>
        {ready
          ? <div className="activity-actions"><button className="button secondary" onClick={() => openFacts(item)}><Pencil size={15} /> 修改业务情况</button><button className="button subtle" disabled={busy === item.id} onClick={() => assess(item)}>{busy === item.id ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />} 开始初步检查</button><button className="icon-button danger-icon" disabled={busy === `delete-${item.id}`} aria-label={`删除${item.name}`} title="删除业务" onClick={() => remove(item)}>{busy === `delete-${item.id}` ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />}</button></div>
          : <div className="activity-actions"><button className="button secondary" onClick={() => openFacts(item)}><ClipboardList size={16} /> 完善业务情况</button><button className="icon-button danger-icon" disabled={busy === `delete-${item.id}`} aria-label={`删除${item.name}`} title="删除业务" onClick={() => remove(item)}>{busy === `delete-${item.id}` ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />}</button></div>}
      </article>;
    })}</div> : <EmptyState icon={BriefcaseBusiness} title="还没有记录业务" description="从客户联系人、员工管理或官网联系表单开始，通常10分钟内可以完成首个场景。" action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={17} /> 添加首个业务</button>} />}

    {adding && <div className="modal-backdrop" onClick={() => setAdding(false)}><section className="modal large-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">添加业务场景</p><h2>贵单位在哪些工作中使用个人信息？</h2><p>先选最接近的一项，之后可以继续完善。</p></div><button className="icon-button" onClick={() => setAdding(false)}>×</button></div>
      <div className="scenario-grid">{catalog.map(item => <button disabled={busy === item.code} className={`scenario-choice ${existing.has(item.code) ? "already" : ""}`} key={item.code} onClick={() => add(item)}><div className="scenario-choice-icon"><BriefcaseBusiness /></div><div><strong>{item.name}</strong><span>{item.description}</span>{existing.has(item.code) && <small><CheckCircle2 size={13} /> 已添加，可再次建立独立场景</small>}</div><ArrowRight /></button>)}</div>
    </section></div>}

    {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><section className="modal fact-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">完善业务情况</p><h2>{editing.name}</h2><p>按实际情况选择；不确定时可以选择“不清楚”，交给后续分流判断。</p></div><button className="icon-button" onClick={() => setEditing(null)}>×</button></div>
      {multiChoice("dataSubjects", "1. 这项业务涉及哪些人员？", "例如企业客户联系人、员工或访客。")}
      {multiChoice("informationTypes", "2. 会使用哪些个人信息？", "只选择这项业务实际需要的信息类型。")}
      {multiChoice("purposes", "3. 为什么需要这些信息？", "选择最直接、具体的业务目的。")}
      {multiChoice("collectionChannels", "4. 信息从哪里取得？", "确认由本人提供、其他企业提供，还是由设备采集。")}
      {multiChoice("systems", "5. 信息保存或使用在哪里？", "包括云端系统、本地表格、邮箱和纸质材料。")}
      {multiChoice("recipients", "6. 是否会交给外部单位？", "服务商受托处理也需要选择；完全不提供时选择第一项。")}
      <section className="fact-section"><div className="fact-title"><strong>7. 通常保存多长时间？</strong><span>必填</span></div><p>可以先用业务语言描述，例如“合作期间，结束后保留3年”。</p><input className="fact-input" value={facts.retentionPeriod} onChange={event => setFacts(current => ({ ...current, retentionPeriod: event.target.value }))} placeholder="请输入保存期限或删除条件" /></section>
      {answerChoice("sensitiveInformation", "8. 是否包含敏感个人信息？", "例如身份证件、金融账户、健康、生物识别或精确位置。")}
      {answerChoice("minorsInvolved", "9. 是否可能涉及不满十四周岁未成年人？", "普通B2B联系人和员工场景通常选择“不涉及”。")}
      {answerChoice("crossBorderAccess", "10. 是否可能从境外存储或访问？", "包括境外云服务，以及境外总部或管理员远程查看。")}
      <section className="fact-section"><div className="fact-title"><strong>补充说明</strong><span>选填</span></div><textarea className="fact-input fact-notes" value={facts.notes} onChange={event => setFacts(current => ({ ...current, notes: event.target.value }))} placeholder="还有哪些情况希望系统在分流时考虑？" /></section>
      {error && <div className="alert danger">{error}</div>}
      <div className="modal-actions"><button className="button secondary" onClick={() => setEditing(null)}>稍后再填</button><button className="button primary" disabled={busy === editing.id} onClick={saveFacts}>{busy === editing.id ? "保存中…" : "保存业务情况"}</button></div>
    </section></div>}

    {triage && <div className="modal-backdrop" onClick={() => setTriage(null)}><section className="modal" onClick={event => event.stopPropagation()}>
      <div className="triage-head"><div className="step-icon"><Bot /></div><div><p className="eyebrow">业务情况初步检查</p><h2>{triageTitles[triage.status] || "初步检查已完成"}</h2><p className="triage-summary">{triage.summary}</p></div></div>
      <div className="triage-purpose"><strong>这页在检查什么？</strong><span>根据您填写的内容，检查信息是否完整、前后是否一致，以及是否需要进一步评估。它不会判断您填写的事实是否真实；负责人仍需结合合同、系统设置和实际记录确认。</span></div>
      <div className={`source-note ${triage.source === "dify" ? "" : "fallback-note"}`}>检查方式：{triage.source === "dify" ? "Dify辅助分析" : "本地基础规则检查"}；本页不是合规认证或事实核验结果。</div>
      {triage.warnings.length > 0 && <div className="triage-warnings">{triage.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      {triage.findings.length ? <div className="finding-list">{triage.findings.map(finding => <div className="finding finding-action" key={finding.id}><span className={`risk risk-${finding.riskLevel}`}>{riskLabels[finding.riskLevel] || "待确认"}</span><div><strong>{finding.title}</strong><p>{finding.description}</p></div>{finding.taskId ? <span className="task-created"><CheckCircle2 size={14} /> 已生成待办</span> : <button className="button small secondary" disabled={busy === finding.id} onClick={() => createFindingTask(finding.id)}>{busy === finding.id ? "生成中…" : "生成待办"}</button>}</div>)}</div> : triage.source === "dify" ? <div className="all-clear"><CheckCircle2 /><div><strong>根据目前填写的内容，暂未发现需要暂停的事项</strong><p>这表示可以继续完善合规档案，不代表实际情况已经核验或认定合规。</p></div></div> : null}
      <div className="modal-actions"><Link className="button secondary" href="/assessments">查看检查记录</Link><button className="button primary" onClick={() => setTriage(null)}>完成</button></div>
    </section></div>}
  </>;
}
