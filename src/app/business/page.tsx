"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BriefcaseBusiness, CheckCircle2, ClipboardCheck, ClipboardList,
  Pencil, Plus, RefreshCw, Trash2
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { emptyActivityFacts } from "@/lib/activity-facts";
import type { ActivityFacts, AssessmentRun, EnterpriseProfile, FactAnswer, ProcessingActivity } from "@/lib/types";

type Scenario = { code: string; name: string; description: string; recommended: string };
const optionGroups = {
  dataSubjects: ["客户联系人", "供应商联系人", "消费者或会员", "员工", "求职者", "访客", "其他人员"],
  informationTypes: ["姓名和联系方式", "单位和职务", "身份证件", "订单和交易", "薪酬和考勤", "地址或位置", "账号或设备信息", "照片或视频", "其他信息"],
  purposes: ["履行项目或合同", "客户和供应商联系", "员工管理", "提供产品或服务", "安全和门禁", "营销活动", "履行法定义务"],
  collectionChannels: ["本人主动提供", "企业客户或供应商提供", "网站或小程序", "邮件或电话", "设备自动采集", "公开渠道"],
  systems: ["邮箱或通讯工具", "Excel或本地文件", "网站后台", "CRM或ERP", "HR或薪酬系统", "云端SaaS", "门禁或监控", "纸质文件"],
  recipients: ["不向外部提供", "仅必要服务商", "集团内其他主体", "客户或合作方", "政府或法定机构", "暂不清楚"],
  accessRoles: ["业务经办人员", "部门负责人", "销售或客户服务", "人力资源岗位", "财务或行政人员", "系统管理员", "暂不清楚"],
  systemOperators: ["本单位系统管理员", "云服务商", "外包服务人员", "集团信息技术人员", "不涉及专门运维", "暂不清楚"]
} satisfies Record<string, string[]>;

const answerOptions: Array<{ value: Exclude<FactAnswer, "">; label: string }> = [
  { value: "no", label: "不涉及" },
  { value: "yes", label: "涉及" },
  { value: "unknown", label: "不清楚" }
];

const triageTitles: Record<string, string> = {
  draft_ready: "可以继续建立合规材料",
  needs_input: "还需要补充业务情况",
  needs_review: "需要负责人或专业人员确认"
};

const orgTypeOptions = [["company", "公司"], ["branch", "分支机构"], ["individual_business", "个体工商户"], ["partnership", "合伙企业"], ["institution", "其他组织"]];
const businessModelOptions = [["B2B", "主要面向企业"], ["B2C", "主要面向个人"], ["both", "两者都有"], ["internal_only", "主要是内部员工管理"]];
const ownershipOptions = [["domestic", "不是"], ["foreign_invested", "外商投资企业"], ["foreign_branch", "外国企业在华分支"], ["unknown", "不清楚"]];
const processingRoleOptions = [["independent_processor", "主要由我们自己决定"], ["entrusted_processor", "主要按照客户或其他公司的指示处理"], ["mixed", "两种情况都有"], ["unknown", "不清楚"]];
const subjectOptions = [["employee", "在职员工"], ["candidate", "招聘候选人"], ["customer_contact", "客户企业联系人"], ["supplier_contact", "供应商联系人"], ["consumer", "消费者或会员"], ["visitor", "访客"]];
const sensitiveOptions = [["identity_document", "身份证件"], ["financial_account", "金融账户"], ["health", "健康信息"], ["biometric", "人脸或指纹"], ["precise_location", "精确位置"]];
const ynOptions = [["no", "没有"], ["yes", "有"], ["unknown", "不清楚"]];
const industrySuggestions = ["软件和信息技术服务", "专业服务", "制造业", "批发和零售", "住宿和餐饮", "租赁和商务服务", "房地产和物业管理", "交通运输和物流", "教育培训", "医疗健康", "文化、体育和娱乐"];

function labelOf(options: string[][], value: string) { return options.find(([v]) => v === value)?.[1] || value || "—"; }

const factSteps = [
  { number: 1, title: "业务对象", description: "涉及哪些人、哪些信息和大致人数" },
  { number: 2, title: "使用方式", description: "为什么使用、从哪里取得和保存在哪里" },
  { number: 3, title: "管理安排", description: "访问岗位、运维、保存删除和联系渠道" },
  { number: 4, title: "特别情况", description: "敏感信息、未成年人、境外和自动决策" }
];

type FactRequirement = { no: number; step: number; label: string; filled: (facts: ActivityFacts) => boolean };
const factRequirements: FactRequirement[] = [
  { no: 1, step: 1, label: "涉及哪些人员", filled: f => f.dataSubjects.length > 0 },
  { no: 2, step: 1, label: "使用哪些个人信息", filled: f => f.informationTypes.length > 0 },
  { no: 3, step: 1, label: "大约涉及多少人", filled: f => f.approximatePersonCount !== null },
  { no: 4, step: 2, label: "为什么需要这些信息", filled: f => f.purposes.length > 0 },
  { no: 5, step: 2, label: "信息从哪里取得", filled: f => f.collectionChannels.length > 0 },
  { no: 6, step: 2, label: "信息保存或使用在哪里", filled: f => f.systems.length > 0 },
  { no: 7, step: 2, label: "是否会交给外部单位", filled: f => f.recipients.length > 0 },
  { no: 8, step: 3, label: "哪些岗位可以查看或使用", filled: f => f.accessRoles.length > 0 },
  { no: 9, step: 3, label: "谁负责维护这些系统", filled: f => f.systemOperators.length > 0 },
  { no: 10, step: 3, label: "通常保存多长时间", filled: f => f.retentionPeriod.trim().length > 0 },
  { no: 11, step: 3, label: "保存期满后怎样处理", filled: f => f.deletionMethod.trim().length > 0 },
  { no: 12, step: 3, label: "个人联系渠道", filled: f => f.rightsChannel.trim().length > 0 },
  { no: 13, step: 4, label: "是否包含敏感个人信息", filled: f => f.sensitiveInformation !== "" },
  { no: 14, step: 4, label: "是否涉及未成年人", filled: f => f.minorsInvolved !== "" },
  { no: 15, step: 4, label: "是否可能从境外存储或访问", filled: f => f.crossBorderAccess !== "" },
  { no: 16, step: 4, label: "是否有自动化决策", filled: f => f.automatedDecision !== "" }
];

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
  const [factStep, setFactStep] = useState(1);
  const [defaultRightsChannel, setDefaultRightsChannel] = useState("");
  const [error, setError] = useState("");
  const [enterprise, setEnterprise] = useState<EnterpriseProfile | null>(null);
  const [entForm, setEntForm] = useState<EnterpriseProfile | null>(null);
  const [entEditing, setEntEditing] = useState(false);
  const [entSaving, setEntSaving] = useState(false);
  const [entError, setEntError] = useState("");

  const load = () => fetch("/api/scenarios", { cache: "no-store" })
    .then(response => response.json())
    .then(data => { setCatalog(data.catalog); setActivities(data.activities); });

  useEffect(() => {
    void load();
    void fetch("/api/enterprise", { cache: "no-store" })
      .then(response => response.json())
      .then(data => {
        setDefaultRightsChannel(String(data.privacyContactChannel || ""));
        setEnterprise(data);
      })
      .catch(() => undefined);
  }, []);

  const openEnterpriseEdit = () => { setEntForm(enterprise ? { ...enterprise } : null); setEntError(""); setEntEditing(true); };
  const setEnt = <K extends keyof EnterpriseProfile>(key: K, value: EnterpriseProfile[K]) => setEntForm(old => old ? { ...old, [key]: value } : old);
  const toggleEnt = (key: "subjectCategories" | "sensitiveCategories", value: string) => setEntForm(old => old ? { ...old, [key]: old[key].includes(value) ? old[key].filter(v => v !== value) : [...old[key], value] } : old);
  const saveEnterprise = async () => {
    if (!entForm) return;
    setEntSaving(true); setEntError("");
    const response = await fetch("/api/enterprise", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entForm, personCount: entForm.personCount === null ? null : Number(entForm.personCount) }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setEnterprise(payload.enterprise); setEntEditing(false); }
    else setEntError(payload.message || "保存失败，请检查填写内容。");
    setEntSaving(false);
  };
  const existing = useMemo(() => new Set(activities.map(item => item.scenarioCode)), [activities]);
  const missingFacts = useMemo(() => factRequirements.filter(item => !item.filled(facts)), [facts]);
  const isMissing = (no: number) => missingFacts.some(item => item.no === no);

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
    setFactStep(1);
    setEditing(activity);
    setFacts({
      ...emptyActivityFacts(), ...activity.facts,
      dataSubjects: [...activity.facts.dataSubjects], informationTypes: [...activity.facts.informationTypes],
      purposes: [...activity.facts.purposes], collectionChannels: [...activity.facts.collectionChannels],
      systems: [...activity.facts.systems], recipients: [...activity.facts.recipients],
      accessRoles: [...activity.facts.accessRoles], systemOperators: [...activity.facts.systemOperators],
      rightsChannel: activity.facts.rightsChannel || defaultRightsChannel
    });
  };

  const toggle = (field: keyof typeof optionGroups, value: string) => {
    setFacts(current => {
      const values = current[field] as string[];
      return { ...current, [field]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
    });
  };

  const saveFacts = async (closeAfter = true) => {
    if (!editing) return false;
    setBusy(editing.id); setError("");
    const response = await fetch("/api/scenarios", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, facts })
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.message || "保存失败，请稍后重试。"); setBusy(""); return false; }
    await load();
    if (closeAfter) setEditing(null);
    setBusy("");
    return true;
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

  const missingTag = (no: number) => isMissing(no) ? <span className="fact-missing-tag">待填</span> : null;

  const multiChoice = (no: number, field: keyof typeof optionGroups, title: string, help: string) => (
    <section className="fact-section">
      <div className="fact-title"><strong>{title}</strong><span className="fact-title-tags">{missingTag(no)}<span>可多选 · 必填</span></span></div>
      <p>{help}</p>
      <div className="tag-choices">
        {optionGroups[field].map(option => <button type="button" className={(facts[field] as string[]).includes(option) ? "selected" : ""} key={option} onClick={() => toggle(field, option)}>{option}</button>)}
      </div>
    </section>
  );

  const answerChoice = (no: number, field: "sensitiveInformation" | "minorsInvolved" | "crossBorderAccess" | "automatedDecision", title: string, help: string) => (
    <section className="fact-section compact-fact">
      <div><strong>{title}{missingTag(no)}</strong><p>{help}</p></div>
      <div className="segmented">
        {answerOptions.map(option => <button type="button" className={facts[field] === option.value ? "selected" : ""} key={option.value} onClick={() => setFacts(current => ({ ...current, [field]: option.value }))}>{option.label}</button>)}
      </div>
    </section>
  );

  return <>
    <section className="page-heading">
      <div><p className="eyebrow">我的业务</p><h1>贵单位怎样使用个人信息</h1><p>以业务名称为单位记录个人信息处理情况，系统据此匹配法定义务。</p></div>
      <button className="button primary" onClick={() => setAdding(true)}><Plus size={17} /> 添加业务</button>
    </section>

    {enterprise && <section className="card enterprise-card">
      <div className="card-header"><div><p className="eyebrow">单位信息</p><h2>{enterprise.legalName}</h2></div>{!entEditing && <button className="button secondary small" onClick={openEnterpriseEdit}><Pencil size={15} /> 修改单位信息</button>}</div>
      {!entEditing ? <div className="enterprise-summary">
        <div><span>单位类型</span><strong>{labelOf(orgTypeOptions, enterprise.orgType)}</strong></div>
        <div><span>所属行业</span><strong>{enterprise.industry || "—"}</strong></div>
        <div><span>业务面向</span><strong>{labelOf(businessModelOptions, enterprise.businessModel)}</strong></div>
        <div><span>涉及人数</span><strong>{enterprise.personCount === null ? "待确认" : `约 ${enterprise.personCount} 人`}</strong></div>
        <div><span>处理角色</span><strong>{labelOf(processingRoleOptions, enterprise.processingRole)}</strong></div>
        <div><span>未成年人</span><strong>{labelOf(ynOptions, enterprise.minorsPossible)}</strong></div>
        <div><span>境外存储/访问</span><strong>{labelOf(ynOptions, enterprise.crossBorder)}</strong></div>
        <div><span>负责人</span><strong>{[enterprise.privacyContactName, enterprise.privacyContactRole].filter(Boolean).join(" · ") || "—"}</strong></div>
        <div><span>联系渠道</span><strong>{enterprise.privacyContactChannel || "—"}</strong></div>
      </div> : entForm && <div className="enterprise-edit">
        <div className="two-column-fields">
          <label className="field"><span>单位名称</span><input value={entForm.legalName} onChange={e => setEnt("legalName", e.target.value)} /></label>
          <label className="field"><span>所属行业</span><input list="ent-industry-suggestions" value={entForm.industry} onChange={e => setEnt("industry", e.target.value)} /><datalist id="ent-industry-suggestions">{industrySuggestions.map(item => <option value={item} key={item} />)}</datalist></label>
        </div>
        <div className="field"><span>单位类型</span><div className="segmented">{orgTypeOptions.map(([v, l]) => <button type="button" className={entForm.orgType === v ? "selected" : ""} key={v} onClick={() => setEnt("orgType", v)}>{l}</button>)}</div></div>
        <div className="field"><span>主要业务面向谁？</span><div className="segmented">{businessModelOptions.map(([v, l]) => <button type="button" className={entForm.businessModel === v ? "selected" : ""} key={v} onClick={() => setEnt("businessModel", v as EnterpriseProfile["businessModel"])}>{l}</button>)}</div></div>
        <div className="field"><span>是否为外商投资企业或外国企业在华分支？</span><div className="segmented">{ownershipOptions.map(([v, l]) => <button type="button" className={entForm.ownership === v ? "selected" : ""} key={v} onClick={() => setEnt("ownership", v)}>{l}</button>)}</div><small className="field-help">仅用于记录和生成材料时的背景说明，不影响适用性判断和材料推荐。</small></div>
        <div className="two-column-fields">
          <label className="field"><span>涉及自然人人数</span><div className="input-suffix"><input type="number" min="0" value={entForm.personCount ?? ""} onChange={e => setEnt("personCount", e.target.value === "" ? null : Number(e.target.value))} placeholder="例如 2300" /><span>人</span></div></label>
          <label className="check-line"><input type="checkbox" checked={entForm.countVerified} onChange={e => setEnt("countVerified", e.target.checked)} /><span><strong>已合并各系统中的自然人</strong><small>不确定也可以继续，系统会生成确认任务。</small></span></label>
        </div>
        <div className="field"><span>通常由谁决定为什么收集和怎样使用这些信息？</span><div className="segmented">{processingRoleOptions.map(([v, l]) => <button type="button" className={entForm.processingRole === v ? "selected" : ""} key={v} onClick={() => setEnt("processingRole", v)}>{l}</button>)}</div></div>
        <div className="field"><span>目前保存哪些人的信息？</span><div className="tag-choices">{subjectOptions.map(([v, l]) => <button type="button" className={entForm.subjectCategories.includes(v) ? "selected" : ""} key={v} onClick={() => toggleEnt("subjectCategories", v)}>{l}</button>)}</div></div>
        <div className="field"><span>是否处理以下较敏感的信息？</span><div className="tag-choices">{sensitiveOptions.map(([v, l]) => <button type="button" className={entForm.sensitiveCategories.includes(v) ? "selected" : ""} key={v} onClick={() => toggleEnt("sensitiveCategories", v)}>{l}</button>)}</div><small className="field-help">都不涉及时不用选择。</small></div>
        <div className="two-column-fields">
          <div className="field"><span>可能包括不满十四周岁的未成年人吗？</span><div className="segmented">{ynOptions.map(([v, l]) => <button type="button" className={entForm.minorsPossible === v ? "selected" : ""} key={v} onClick={() => setEnt("minorsPossible", v as EnterpriseProfile["minorsPossible"])}>{l}</button>)}</div></div>
          <div className="field"><span>会存到境外或被境外人员远程查看吗？</span><div className="segmented">{ynOptions.map(([v, l]) => <button type="button" className={entForm.crossBorder === v ? "selected" : ""} key={v} onClick={() => setEnt("crossBorder", v as EnterpriseProfile["crossBorder"])}>{l}</button>)}</div></div>
        </div>
        <div className="three-inputs">
          <label><span>负责人姓名</span><input value={entForm.privacyContactName} onChange={e => setEnt("privacyContactName", e.target.value)} /></label>
          <label><span>岗位</span><input value={entForm.privacyContactRole} onChange={e => setEnt("privacyContactRole", e.target.value)} /></label>
          <label><span>联系渠道</span><input value={entForm.privacyContactChannel} onChange={e => setEnt("privacyContactChannel", e.target.value)} /></label>
        </div>
        {entError && <div className="alert danger">{entError}</div>}
        <div className="enterprise-edit-actions"><button className="button secondary" onClick={() => setEntEditing(false)}>取消</button><button className="button primary" disabled={entSaving} onClick={saveEnterprise}>{entSaving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />} 保存单位信息</button></div>
        <p className="field-help">人数口径、处理角色、敏感情况、未成年人或出境情况变化时，保存后系统会重新判断适用路径。</p>
      </div>}
    </section>}

    {error && !editing && <div className="alert danger">{error}</div>}

    {activities.length ? <div className="activity-table">
      <div className="activity-table-head"><span>业务名称</span><span>涉及人数</span><span>记录状态</span><span>操作</span></div>
      {activities.map(item => {
      const ready = item.completeness === 1;
      return <article className="activity-row" key={item.id}>
        <div className="activity-main activity-business-cell">
          <div className="activity-title"><h3>{item.name}</h3></div>
          <p>{item.description}</p>
        </div>
        <div className="activity-count"><strong>{item.facts.approximatePersonCount === null ? "待确认" : `约 ${item.facts.approximatePersonCount} 人`}</strong><span>{item.facts.dataSubjects.slice(0, 2).join("、") || "尚未填写涉及人员"}</span></div>
        <div className="activity-record-status"><StatusBadge status={item.status} /><span>{ready ? "业务情况已完整" : `已填写 ${Math.round(item.completeness * 100)}%`}</span></div>
        {ready
          ? <div className="activity-actions"><button className="button secondary" onClick={() => openFacts(item)}><Pencil size={15} /> 修改</button><button className="button primary" disabled={busy === item.id} onClick={() => assess(item)}>{busy === item.id ? <RefreshCw size={16} className="spin" /> : <ClipboardCheck size={16} />} 检查业务情况</button><button className="icon-button danger-icon" disabled={busy === `delete-${item.id}`} aria-label={`删除${item.name}`} title="删除业务" onClick={() => remove(item)}>{busy === `delete-${item.id}` ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />}</button></div>
          : <div className="activity-actions"><button className="button secondary" onClick={() => openFacts(item)}><ClipboardList size={16} /> 完善业务情况</button><button className="icon-button danger-icon" disabled={busy === `delete-${item.id}`} aria-label={`删除${item.name}`} title="删除业务" onClick={() => remove(item)}>{busy === `delete-${item.id}` ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />}</button></div>}
      </article>;
    })}</div> : <EmptyState icon={BriefcaseBusiness} title="还没有记录业务" description="从客户联系人、员工管理或官网联系表单开始，通常10分钟内可以完成首个场景。" action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={17} /> 添加首个业务</button>} />}

    {adding && <div className="modal-backdrop" onClick={() => setAdding(false)}><section className="modal large-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">添加业务场景</p><h2>贵单位在哪些工作中使用个人信息？</h2><p>先选最接近的一项，之后可以继续完善。</p></div><button className="icon-button" onClick={() => setAdding(false)}>×</button></div>
      <div className="scenario-grid">{catalog.map(item => <button disabled={busy === item.code} className={`scenario-choice ${existing.has(item.code) ? "already" : ""}`} key={item.code} onClick={() => add(item)}><div className="scenario-choice-icon"><BriefcaseBusiness /></div><div><strong>{item.name}</strong><span>{item.description}</span>{existing.has(item.code) && <small><CheckCircle2 size={13} /> 已添加，可再次建立独立场景</small>}</div><ArrowRight /></button>)}</div>
    </section></div>}

    {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><section className="modal fact-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">完善业务情况</p><h2>{editing.name}</h2><p>按实际情况填写；企业档案中已有的统一联系渠道会自动带入，同一事实不必重复填写。</p></div><button className="icon-button" onClick={() => setEditing(null)}>×</button></div>
      <nav className="fact-wizard-nav" aria-label="业务情况填写步骤">
        {factSteps.map(step => <button type="button" key={step.number} className={factStep === step.number ? "active" : factStep > step.number ? "passed" : ""} onClick={() => setFactStep(step.number)}><span>{factStep > step.number ? "✓" : step.number}</span><div><strong>{step.title}</strong><small>{step.description}</small></div></button>)}
      </nav>
      <div className="fact-step-content">
        {factStep === 1 && <>
          <div className="fact-step-heading"><span>第 1 步</span><h3>这项业务涉及谁和哪些信息？</h3><p>先记录业务范围，不需要使用法律术语。</p></div>
          {multiChoice(1, "dataSubjects", "1. 这项业务涉及哪些人员？", "例如企业客户联系人、员工或访客。")}
          {multiChoice(2, "informationTypes", "2. 会使用哪些个人信息？", "只选择这项业务实际需要的信息类型。")}
          <section className="fact-section"><div className="fact-title"><strong>3. 这项业务大约涉及多少人？</strong><span className="fact-title-tags">{missingTag(3)}<span>必填</span></span></div><p>填写当前大致人数即可；同一个人不要因为出现在多个系统中重复计算。</p><input className="fact-input" type="number" min="0" step="1" value={facts.approximatePersonCount ?? ""} onChange={event => setFacts(current => ({ ...current, approximatePersonCount: event.target.value === "" ? null : Number(event.target.value) }))} placeholder="例如：80" /></section>
        </>}
        {factStep === 2 && <>
          <div className="fact-step-heading"><span>第 2 步</span><h3>这些信息怎样进入和使用？</h3><p>确认目的、来源、保存位置和外部接收方。</p></div>
          {multiChoice(4, "purposes", "4. 为什么需要这些信息？", "选择最直接、具体的业务目的。")}
          {multiChoice(5, "collectionChannels", "5. 信息从哪里取得？", "确认由本人提供、其他企业提供，还是由设备采集。")}
          {multiChoice(6, "systems", "6. 信息保存或使用在哪里？", "包括云端系统、本地表格、邮箱和纸质材料。")}
          {multiChoice(7, "recipients", "7. 是否会交给外部单位？", "服务商受托处理也需要选择；完全不提供时选择第一项。")}
        </>}
        {factStep === 3 && <>
          <div className="fact-step-heading"><span>第 3 步</span><h3>单位内部怎样管理？</h3><p>这些安排会直接进入合规材料和后续办理事项。</p></div>
          {multiChoice(8, "accessRoles", "8. 单位内哪些岗位可以查看或使用？", "选择实际能够接触这些信息的岗位；暂时没有分清权限时可选“不清楚”。")}
          {multiChoice(9, "systemOperators", "9. 谁负责维护保存这些信息的系统？", "例如本单位管理员、云服务商或外包人员；只有纸质材料且无人专门运维时，可选“不涉及专门运维”。")}
          <section className="fact-section"><div className="fact-title"><strong>10. 通常保存多长时间？</strong><span className="fact-title-tags">{missingTag(10)}<span>必填</span></span></div><p>可以先用业务语言描述，例如“合作期间，结束后保留3年”。</p><input className="fact-input" value={facts.retentionPeriod} onChange={event => setFacts(current => ({ ...current, retentionPeriod: event.target.value }))} placeholder="请输入保存期限或删除条件" /></section>
          <section className="fact-section"><div className="fact-title"><strong>11. 保存期满后实际怎样处理？</strong><span className="fact-title-tags">{missingTag(11)}<span>必填</span></span></div><p>说明由谁、在什么系统中、按什么方式删除、匿名化或限制继续使用。</p><textarea className="fact-input fact-notes" value={facts.deletionMethod} onChange={event => setFacts(current => ({ ...current, deletionMethod: event.target.value }))} placeholder="例如：每季度由行政负责人核对到期记录，并在邮箱和客户表格中删除" /></section>
          <section className="fact-section"><div className="fact-title"><strong>12. 个人需要查询、更正或删除时，通过什么方式联系？</strong><span className="fact-title-tags">{missingTag(12)}<span>必填</span></span></div><p>{defaultRightsChannel ? "已从企业档案带入统一联系渠道；如本业务使用其他渠道，可以在这里修改。" : "可以填写邮箱、电话、网站表单或其他真实可用的联系入口。"}</p><input className="fact-input" value={facts.rightsChannel} onChange={event => setFacts(current => ({ ...current, rightsChannel: event.target.value }))} placeholder="例如：privacy@example.com 或客服电话" /></section>
        </>}
        {factStep === 4 && <>
          <div className="fact-step-heading"><span>第 4 步</span><h3>是否存在需要特别关注的情况？</h3><p>不确定时可以选择“不清楚”，系统会保留为待确认事项。</p></div>
          {answerChoice(13, "sensitiveInformation", "13. 是否包含敏感个人信息？", "例如身份证件、金融账户、健康、生物识别或精确位置。")}
          {answerChoice(14, "minorsInvolved", "14. 是否可能涉及不满十四周岁未成年人？", "普通B2B联系人和员工场景通常选择“不涉及”。")}
          {answerChoice(15, "crossBorderAccess", "15. 是否可能从境外存储或访问？", "包括境外云服务，以及境外总部或管理员远程查看。")}
          {answerChoice(16, "automatedDecision", "16. 系统是否会自动决定推荐、价格、资格或其他对个人有影响的结果？", "普通表格、邮箱、CRM记录本身通常不属于这种情况；如果只是人工查看后作决定，请选择“不涉及”。")}
          <section className="fact-section"><div className="fact-title"><strong>补充说明</strong><span>选填</span></div><textarea className="fact-input fact-notes" value={facts.notes} onChange={event => setFacts(current => ({ ...current, notes: event.target.value }))} placeholder="还有哪些情况希望系统在检查时考虑？" /></section>
        </>}
      </div>
      {missingFacts.length > 0 && <div className="fact-missing-summary">
        <div className="fact-missing-heading"><AlertTriangle size={16} /><strong>还有 {missingFacts.length} 项未填写</strong><span>完成后才能运行业务检查</span></div>
        <div className="fact-missing-groups">
          {factSteps.map(step => {
            const items = missingFacts.filter(item => item.step === step.number);
            if (!items.length) return null;
            return <div className="fact-missing-group" key={step.number}>
              <span className="fact-missing-step">第 {step.number} 步 · {step.title}</span>
              <div className="fact-missing-items">{items.map(item => <button type="button" key={item.no} className="fact-missing-item" onClick={() => setFactStep(item.step)}>{item.no}. {item.label}<ArrowRight size={12} /></button>)}</div>
            </div>;
          })}
        </div>
      </div>}
      {missingFacts.length === 0 && <div className="fact-complete-note"><CheckCircle2 size={15} /> 16 项业务事实已全部填写，保存后即可运行业务检查。</div>}
      {error && <div className="alert danger">{error}</div>}
      <div className="modal-actions wizard-actions fact-wizard-actions"><span>第 {factStep} 步，共 4 步</span><div>{factStep > 1 && <button className="button secondary" onClick={() => setFactStep(current => current - 1)}>上一步</button>}{factStep < 4 ? <><button className="button secondary" disabled={busy === editing.id} onClick={() => void saveFacts(true)}>{busy === editing.id ? "保存中…" : "保存并退出"}</button><button className="button primary" onClick={() => setFactStep(current => current + 1)}>下一步 <ArrowRight size={15} /></button></> : <button className="button primary" disabled={busy === editing.id} onClick={() => void saveFacts(true)}>{busy === editing.id ? "保存中…" : "保存业务情况"}</button>}</div></div>
    </section></div>}

    {triage && <div className="modal-backdrop" onClick={() => setTriage(null)}><section className="modal" onClick={event => event.stopPropagation()}>
      <div className="triage-head"><div className="step-icon"><ClipboardCheck /></div><div><p className="eyebrow">业务检查结果</p><h2>{triageTitles[triage.status] || "检查已完成"}</h2><p className="triage-summary">{triage.summary}</p></div></div>
      <div className="triage-purpose"><strong>这页在检查什么？</strong><span>根据您填写的内容，检查信息是否完整、前后是否一致，以及是否需要进一步评估。它不会判断您填写的事实是否真实；负责人仍需结合合同、系统设置和实际记录确认。</span></div>
      {triage.warnings.length > 0 && <div className="triage-warnings">{triage.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      {triage.findings.length ? <div className="finding-list">{triage.findings.map(finding => <div className="finding finding-action" key={finding.id}><span className={`risk risk-${finding.riskLevel}`}>{riskLabels[finding.riskLevel] || "待确认"}</span><div><strong>{finding.title}</strong><p>{finding.description}</p></div>{finding.taskId ? <span className="task-created"><CheckCircle2 size={14} /> 已生成待办</span> : <button className="button small secondary" disabled={busy === finding.id} onClick={() => createFindingTask(finding.id)}>{busy === finding.id ? "生成中…" : "生成待办"}</button>}</div>)}</div> : triage.status === "draft_ready" ? <div className="all-clear"><CheckCircle2 /><div><strong>根据目前填写的内容，暂未发现需要暂停的事项</strong><p>这表示可以继续完善合规档案，不代表实际情况已经核验或认定合规。</p></div></div> : <div className="alert warning"><AlertTriangle size={18} /><div><strong>本次没有形成可确认的检查项</strong><p>请重新运行初步检查；如果仍然出现该提示，请由负责人或专业人员结合实际业务确认。</p></div></div>}
      <div className={`check-method-note ${triage.source !== "local_rules" ? "" : "fallback-note"}`}>系统通过{triage.source !== "local_rules" ? "规则和AI辅助" : "基础规则"}完成本次内容检查。本结果不是合规认证或事实核验结论。</div>
      <div className="modal-actions"><Link className="button secondary" href="/assessments">查看检查记录</Link><button className="button primary" onClick={() => setTriage(null)}>完成</button></div>
    </section></div>}
  </>;
}
