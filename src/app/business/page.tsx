"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BriefcaseBusiness, Check, CheckCircle2, ClipboardCheck, ClipboardList,
  Pencil, Plus, RefreshCw, Sparkles, Trash2
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { emptyActivityFacts, hasRequiredInformationTypeDetail } from "@/lib/activity-facts";
import { activityOptionGroups as optionGroups, applyScenarioDefaults, emptyCustomFactInputs, getScenarioGuidance, type GuidedFactField } from "@/lib/scenario-guidance";
import { sensitiveCategoryDefinitions } from "@/lib/sensitive-info";
import type { SensitiveIdentificationResult } from "@/lib/sensitive-identification";
import { activityDisplayName } from "@/lib/activity-label";
import { enterpriseSubjectLabel, enterpriseSubjectOptions as subjectOptions, getCustomSubjectDescription, mergeEnterpriseSubjectCategories } from "@/lib/enterprise-subjects";
import { assessRetentionRisk } from "@/lib/retention-risk";
import { externalProcessingRelationshipOptions, hasExternalRecipient, inferExternalProcessingRelationships } from "@/lib/external-processing";
import type { ActivityFacts, AssessmentRun, EnterpriseProfile, FactAnswer, ProcessingActivity } from "@/lib/types";

type Scenario = { code: string; name: string; description: string; recommended: string };
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
const businessModelOptions = [["B2B", "企业客户或合作伙伴相关"], ["B2C", "消费者或其他个人相关"], ["both", "上述两类都有"], ["internal_only", "仅涉及单位内部人员"]];
const ownershipOptions = [["domestic", "不是"], ["foreign_invested", "外商投资企业"], ["foreign_branch", "外国企业在华分支"], ["unknown", "不清楚"]];
const processingRoleOptions = [["independent_processor", "主要由我们自己决定"], ["entrusted_processor", "主要按照客户或其他公司的指示处理"], ["mixed", "两种情况都有"], ["unknown", "不清楚"]];
const ynOptions = [["no", "没有"], ["yes", "有"], ["unknown", "不清楚"]];
const industrySuggestions = ["软件和信息技术服务", "专业服务", "制造业", "批发和零售", "住宿和餐饮", "租赁和商务服务", "房地产和物业管理", "交通运输和物流", "教育培训", "医疗健康", "文化、体育和娱乐"];

function labelOf(options: ReadonlyArray<readonly string[]>, value: string) { return options.find(([v]) => v === value)?.[1] || value || "—"; }

const factSteps = [
  { number: 1, title: "业务对象", description: "涉及哪些人、哪些信息和大致人数" },
  { number: 2, title: "使用方式", description: "为什么使用、从哪里取得和保存在哪里" },
  { number: 3, title: "管理安排", description: "访问岗位、运维、保存删除和联系渠道" },
  { number: 4, title: "特别情况", description: "敏感信息、未成年人、境外和自动决策" }
];

type FactRequirement = { no: number; step: number; label: string; filled: (facts: ActivityFacts) => boolean };
const factRequirements: FactRequirement[] = [
  { no: 1, step: 1, label: "涉及哪些人员", filled: f => f.dataSubjects.length > 0 },
  { no: 2, step: 1, label: "使用哪些个人信息（选择其他时需说明）", filled: hasRequiredInformationTypeDetail },
  { no: 3, step: 1, label: "大约涉及多少人", filled: f => f.approximatePersonCount !== null },
  { no: 4, step: 2, label: "为什么需要这些信息", filled: f => f.purposes.length > 0 },
  { no: 5, step: 2, label: "信息从哪里取得", filled: f => f.collectionChannels.length > 0 },
  { no: 6, step: 2, label: "信息保存或使用在哪里", filled: f => f.systems.length > 0 },
  { no: 7, step: 2, label: "外部单位及其处理关系", filled: f => { const relationships = f.externalProcessingRelationships || []; return f.recipients.length > 0 && (!hasExternalRecipient(f) || (relationships.length > 0 && (relationships.includes("unknown") || String(f.externalRecipientDetails || "").trim().length >= 5))); } },
  { no: 8, step: 3, label: "哪些岗位可以查看或使用", filled: f => f.accessRoles.length > 0 },
  { no: 9, step: 3, label: "谁负责维护这些系统", filled: f => f.systemOperators.length > 0 },
  { no: 10, step: 3, label: "保存期限及必要性依据", filled: f => f.retentionPeriod.trim().length > 0 && !assessRetentionRisk(f.retentionPeriod, f.retentionBasis).requiresBasis },
  { no: 11, step: 3, label: "保存期满后怎样处理", filled: f => f.deletionMethod.trim().length > 0 },
  { no: 12, step: 3, label: "个人联系渠道", filled: f => f.rightsChannel.trim().length > 0 },
  { no: 13, step: 4, label: "是否包含敏感个人信息", filled: f => f.sensitiveInformation !== "" && (f.sensitiveInformation !== "yes" || (f.sensitiveCategories?.length || 0) > 0 || f.minorsInvolved === "yes") },
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
  const [activityRemark, setActivityRemark] = useState("");
  const [customInputs, setCustomInputs] = useState(emptyCustomFactInputs());
  const customInputRefs = useRef<Partial<Record<GuidedFactField, HTMLInputElement | null>>>({});
  const factContentRef = useRef<HTMLDivElement | null>(null);
  const businessDeepLinkHandled = useRef(false);
  const [sensitiveAnalysis, setSensitiveAnalysis] = useState<SensitiveIdentificationResult | null>(null);
  const [sensitiveChecking, setSensitiveChecking] = useState(false);
  const [sensitiveError, setSensitiveError] = useState("");
  const [dismissedSensitive, setDismissedSensitive] = useState<string[]>([]);
  const [factStep, setFactStep] = useState(1);
  const [defaultRightsChannel, setDefaultRightsChannel] = useState("");
  const [sensitiveAiAvailable, setSensitiveAiAvailable] = useState(false);
  const [error, setError] = useState("");
  const [enterprise, setEnterprise] = useState<EnterpriseProfile | null>(null);
  const [entForm, setEntForm] = useState<EnterpriseProfile | null>(null);
  const [entEditing, setEntEditing] = useState(false);
  const [entSaving, setEntSaving] = useState(false);
  const [entError, setEntError] = useState("");
  const [showEntCustomSubject, setShowEntCustomSubject] = useState(false);
  const [entCustomSubject, setEntCustomSubject] = useState("");

  const load = () => fetch("/api/scenarios", { cache: "no-store" })
    .then(response => response.json())
    .then(data => { setCatalog(data.catalog); setActivities(data.activities); });

  useEffect(() => {
    void load();
    void fetch("/api/enterprise", { cache: "no-store" })
      .then(response => response.json())
      .then(data => {
        setDefaultRightsChannel(String(data.publicContactChannel || data.privacyContactChannel || ""));
        setEnterprise(data);
      })
      .catch(() => undefined);
    void fetch("/api/settings/ai", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(data => setSensitiveAiAvailable(Boolean(data?.configured))).catch(() => setSensitiveAiAvailable(false));
  }, []);

  const openEnterpriseEdit = () => { const custom = getCustomSubjectDescription(enterprise?.subjectCategories || []); setEntForm(enterprise ? { ...enterprise, publicContactDepartment: enterprise.publicContactDepartment || "个人信息保护联系部门", publicContactChannel: enterprise.publicContactChannel || enterprise.privacyContactChannel || "" } : null); setEntCustomSubject(custom); setShowEntCustomSubject(Boolean(custom) || Boolean(enterprise?.subjectCategories.includes("other"))); setEntError(""); setEntEditing(true); };
  const setEnt = <K extends keyof EnterpriseProfile>(key: K, value: EnterpriseProfile[K]) => setEntForm(old => old ? { ...old, [key]: value } : old);
  const toggleEnt = (key: "subjectCategories" | "sensitiveCategories", value: string) => setEntForm(old => old ? { ...old, [key]: old[key].includes(value) ? old[key].filter(v => v !== value) : [...old[key], value] } : old);
  const saveEnterprise = async () => {
    if (!entForm) return;
    setEntSaving(true); setEntError("");
    const response = await fetch("/api/enterprise", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entForm, subjectCategories: mergeEnterpriseSubjectCategories(entForm.subjectCategories, showEntCustomSubject ? entCustomSubject : ""), personCount: entForm.personCount === null ? null : Number(entForm.personCount) }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setEnterprise(payload.enterprise); setEntEditing(false); }
    else setEntError(payload.message || "保存失败，请检查填写内容。");
    setEntSaving(false);
  };
  const existing = useMemo(() => new Set(activities.map(item => item.scenarioCode)), [activities]);
  const missingFacts = useMemo(() => factRequirements.filter(item => !item.filled(facts)), [facts]);
  const retentionAssessment = useMemo(() => assessRetentionRisk(facts.retentionPeriod, facts.retentionBasis), [facts.retentionPeriod, facts.retentionBasis]);
  const isMissing = (no: number) => missingFacts.some(item => item.no === no);

  useEffect(() => {
    if (!editing) return;
    const frame = window.requestAnimationFrame(() => factContentRef.current?.scrollTo({ top: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [editing, factStep]);

  const add = async (scenario: Scenario) => {
    setBusy(scenario.code); setError("");
    const response = await fetch("/api/scenarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioCode: scenario.code, name: scenario.name, description: scenario.description })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const created = payload as ProcessingActivity;
      setActivities(current => [...current, created]);
      setAdding(false);
      openFacts(created, true);
      void load();
    } else {
      setError(payload.message || "添加业务失败，请稍后重试。");
    }
    setBusy("");
  };

  const remove = async (activity: ProcessingActivity) => {
    if (!confirm(`确认删除“${activityDisplayName(activity)}”？\n\n未被引用的业务会连同对应的“完善业务情况”待办一起删除。已有检查记录或合规材料引用时，系统会阻止删除。`)) return;
    setBusy(`delete-${activity.id}`); setError("");
    const response = await fetch("/api/scenarios", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activity.id })
    });
    const payload = await response.json();
    if (response.ok) await load();
    else setError(payload.message || "暂时无法删除该业务。");
    setBusy("");
  };

  const openFacts = (activity: ProcessingActivity, useScenarioDefaults = false) => {
    setError("");
    setFactStep(1);
    setEditing(activity);
    setActivityRemark(String(activity.remark || ""));
    const editableFacts = {
      ...emptyActivityFacts(), ...activity.facts,
      dataSubjects: [...activity.facts.dataSubjects], informationTypes: [...activity.facts.informationTypes],
      purposes: [...activity.facts.purposes], collectionChannels: [...activity.facts.collectionChannels],
      systems: [...activity.facts.systems], recipients: [...activity.facts.recipients],
      externalProcessingRelationships: activity.facts.externalProcessingRelationships?.length ? [...activity.facts.externalProcessingRelationships] : inferExternalProcessingRelationships(activity.facts.recipients),
      externalRecipientDetails: activity.facts.externalRecipientDetails || "",
      accessRoles: [...activity.facts.accessRoles], systemOperators: [...activity.facts.systemOperators],
      sensitiveCategories: [...(activity.facts.sensitiveCategories || [])],
      rightsChannel: activity.facts.rightsChannel || defaultRightsChannel
    };
    const nextFacts = useScenarioDefaults ? applyScenarioDefaults(editableFacts, activity.scenarioCode) : editableFacts;
    setFacts({ ...nextFacts, externalProcessingRelationships: nextFacts.externalProcessingRelationships?.length ? nextFacts.externalProcessingRelationships : inferExternalProcessingRelationships(nextFacts.recipients) });
    setCustomInputs(emptyCustomFactInputs());
    setSensitiveAnalysis(null);
    setSensitiveError("");
    setDismissedSensitive([]);
  };

  useEffect(() => {
    if (businessDeepLinkHandled.current || activities.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const activityId = params.get("activity");
    if (!activityId) { businessDeepLinkHandled.current = true; return; }
    const activity = activities.find(item => item.id === activityId);
    if (!activity) return;
    businessDeepLinkHandled.current = true;
    openFacts(activity);
    const targetStep = Number(params.get("step"));
    if ([1, 2, 3, 4].includes(targetStep)) setFactStep(targetStep);
  }, [activities]);

  const toggle = (field: keyof typeof optionGroups, value: string) => {
    if (["dataSubjects", "informationTypes", "purposes", "systems"].includes(field)) {
      setSensitiveAnalysis(null); setSensitiveError(""); setDismissedSensitive([]);
    }
    const selectingOtherInformation = field === "informationTypes" && value === "其他信息" && !(facts.informationTypes || []).includes(value);
    setFacts(current => {
      const values = current[field] as string[];
      if (field === "recipients") {
        if (value === "不向外部提供") return { ...current, recipients: values.includes(value) ? [] : [value], externalProcessingRelationships: [], externalRecipientDetails: "" };
        const withoutNone = values.filter(item => item !== "不向外部提供");
        return { ...current, recipients: withoutNone.includes(value) ? withoutNone.filter(item => item !== value) : [...withoutNone, value] };
      }
      return { ...current, [field]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
    });
    if (selectingOtherInformation) setTimeout(() => customInputRefs.current.informationTypes?.focus(), 0);
  };

  const addCustomOption = (field: GuidedFactField) => {
    const value = customInputs[field].trim();
    if (!value) return;
    setFacts(current => {
      const values = current[field] as string[];
      return values.includes(value) || values.length >= 30 ? current : { ...current, [field]: [...values, value] };
    });
    setCustomInputs(current => ({ ...current, [field]: "" }));
  };

  const toggleSensitiveCategory = (code: string) => setFacts(current => {
    const categories = current.sensitiveCategories || [];
    const next = categories.includes(code) ? categories.filter(item => item !== code) : [...categories, code];
    return { ...current, sensitiveCategories: next, sensitiveInformation: next.length > 0 || current.minorsInvolved === "yes" ? "yes" : "" };
  });

  const runSensitiveIdentification = async () => {
    if (!editing) return;
    setSensitiveChecking(true); setSensitiveError(""); setDismissedSensitive([]);
    const response = await fetch("/api/ai/sensitive-identification", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioCode: editing.scenarioCode,
        scenarioName: editing.name,
        scenarioDescription: editing.description,
        dataSubjects: facts.dataSubjects,
        informationTypes: facts.informationTypes,
        informationDetails: facts.informationDetails || "",
        purposes: facts.purposes,
        systems: facts.systems,
        minorsInvolved: facts.minorsInvolved
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setSensitiveAnalysis(payload as SensitiveIdentificationResult);
    else setSensitiveError(payload.message || "暂时无法完成敏感个人信息辅助识别。");
    setSensitiveChecking(false);
  };

  const acceptSensitiveCandidate = (category: string) => setFacts(current => ({
    ...current,
    sensitiveInformation: "yes",
    sensitiveCategories: [...new Set([...(current.sensitiveCategories || []), category])]
  }));

  const saveFacts = async (closeAfter = true) => {
    if (!editing) return false;
    setBusy(editing.id); setError("");
    const response = await fetch("/api/scenarios", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, remark: activityRemark, facts })
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

  const multiChoice = (no: number, field: GuidedFactField, title: string, help: string) => {
    const recommended = new Set(getScenarioGuidance(editing?.scenarioCode || "").recommended?.[field] || []);
    const customRequired = field === "informationTypes" && facts.informationTypes.includes("其他信息") && !hasRequiredInformationTypeDetail(facts);
    const customPlaceholder: Record<GuidedFactField, string> = {
      dataSubjects: "补充其他人员，例如患者、产品使用者或经销商联系人", informationTypes: "补充具体信息，例如职业资格证书",
      purposes: "补充实际目的，例如售后回访", collectionChannels: "补充其他来源，例如线下活动报名表",
      systems: "补充实际系统或载体名称", recipients: "补充其他接收方类型",
      accessRoles: "补充实际可访问岗位", systemOperators: "补充实际运维主体"
    };
    return <section className="fact-section">
      <div className="fact-title"><strong>{title}</strong><span className="fact-title-tags">{missingTag(no)}<span>可多选 · 必填</span></span></div>
      <p>{help}</p>
      <div className="tag-choices">
        {optionGroups[field].map(option => {
          const selected = (facts[field] as string[]).includes(option);
          const isRecommended = recommended.has(option);
          return <button type="button" className={`${selected ? "selected" : ""} ${isRecommended ? "recommended" : ""}`} key={option} onClick={() => toggle(field, option)}>{option}{isRecommended && <small>场景建议</small>}</button>;
        })}
        {(facts[field] as string[]).filter(option => !(optionGroups[field] as readonly string[]).includes(option)).map(option => <button type="button" className="selected custom-selected" key={option} onClick={() => toggle(field, option)}>{option}<small>自定义</small></button>)}
      </div>
      {recommended.size > 0 && <div className="scenario-guidance-note"><Sparkles size={13} /><span>蓝色为根据“{editing?.name}”给出的常见建议；高置信度项目在新建时已预选，所有项目都可取消或补充。</span></div>}
      {customRequired && <div className="custom-option-required"><AlertTriangle size={14} /><span>已选择“其他信息”，请在下方说明具体信息类型后添加。该项现为必填。</span></div>}
      <div className={`custom-option-row ${customRequired ? "required" : ""}`}><input ref={element => { customInputRefs.current[field] = element; }} aria-required={customRequired} aria-invalid={customRequired} maxLength={100} value={customInputs[field]} onChange={event => setCustomInputs(current => ({ ...current, [field]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustomOption(field); } }} placeholder={customPlaceholder[field]} /><button type="button" className={`button small ${customRequired ? "primary" : "secondary"}`} disabled={!customInputs[field].trim()} onClick={() => addCustomOption(field)}><Plus size={14} /> {customRequired ? "填写并添加" : "添加自定义"}</button></div>
    </section>;
  };

  const answerChoice = (no: number, field: "sensitiveInformation" | "minorsInvolved" | "crossBorderAccess" | "automatedDecision", title: string, help: string) => (
    <section className="fact-section compact-fact">
      <div><strong>{title}{missingTag(no)}</strong><p>{help}</p></div>
      <div className="segmented">
        {answerOptions.map(option => <button type="button" className={facts[field] === option.value ? "selected" : ""} key={option.value} onClick={() => setFacts(current => ({ ...current, [field]: option.value, ...(field === "minorsInvolved" && option.value === "yes" ? { sensitiveInformation: "yes" as const } : {}) }))}>{option.label}</button>)}
      </div>
    </section>
  );

  return <>
    <section className="page-heading">
      <div><p className="eyebrow">我的业务</p><h1>贵单位怎样使用个人信息</h1><p>以业务名称为单位记录个人信息处理情况，系统据此匹配法定义务。</p></div>
      <button className="button primary" onClick={() => { setError(""); setAdding(true); }}><Plus size={17} /> 添加业务</button>
    </section>

    {enterprise && <section className="card enterprise-card">
      <div className="card-header"><div><p className="eyebrow">单位信息</p><h2>{enterprise.legalName}</h2></div>{!entEditing && <button className="button secondary small" onClick={openEnterpriseEdit}><Pencil size={15} /> 修改单位信息</button>}</div>
      {!entEditing ? <div className="enterprise-summary">
        <div><span>单位类型</span><strong>{labelOf(orgTypeOptions, enterprise.orgType)}</strong></div>
        <div><span>所属行业</span><strong>{enterprise.industry || "—"}</strong></div>
        <div><span>主要处理关系</span><strong>{labelOf(businessModelOptions, enterprise.businessModel)}</strong></div>
        <div><span>涉及主体</span><strong>{enterprise.subjectCategories.map(enterpriseSubjectLabel).join("、") || "待确认"}</strong></div>
        <div><span>涉及人数</span><strong>{enterprise.personCount === null ? "待确认" : `约 ${enterprise.personCount} 人`}</strong></div>
        <div><span>处理角色</span><strong>{labelOf(processingRoleOptions, enterprise.processingRole)}</strong></div>
        <div><span>未成年人</span><strong>{labelOf(ynOptions, enterprise.minorsPossible)}</strong></div>
        <div><span>境外存储/访问</span><strong>{labelOf(ynOptions, enterprise.crossBorder)}</strong></div>
        <div><span>负责人</span><strong>{[enterprise.privacyContactName, enterprise.privacyContactRole].filter(Boolean).join(" · ") || "—"}</strong></div>
        <div><span>内部联系渠道</span><strong>{enterprise.privacyContactChannel || "—"}</strong></div>
        <div><span>对外权利请求渠道</span><strong>{[enterprise.publicContactDepartment, enterprise.publicContactChannel].filter(Boolean).join(" · ") || "待补充"}</strong></div>
      </div> : entForm && <div className="enterprise-edit">
        <div className="two-column-fields">
          <label className="field"><span>单位名称</span><input value={entForm.legalName} onChange={e => setEnt("legalName", e.target.value)} /></label>
          <label className="field"><span>所属行业</span><input list="ent-industry-suggestions" value={entForm.industry} onChange={e => setEnt("industry", e.target.value)} /><datalist id="ent-industry-suggestions">{industrySuggestions.map(item => <option value={item} key={item} />)}</datalist></label>
        </div>
        <div className="field"><span>单位类型</span><div className="segmented">{orgTypeOptions.map(([v, l]) => <button type="button" className={entForm.orgType === v ? "selected" : ""} key={v} onClick={() => setEnt("orgType", v)}>{l}</button>)}</div></div>
        <div className="field"><span>贵单位主要在什么关系中处理个人信息？</span><div className="segmented">{businessModelOptions.map(([v, l]) => <button type="button" className={entForm.businessModel === v ? "selected" : ""} key={v} onClick={() => setEnt("businessModel", v as EnterpriseProfile["businessModel"])}>{l}</button>)}</div><small className="field-help">这里不是问产品卖给谁，而是初步了解个人信息来自哪些关系。</small></div>
        <div className="field"><span>是否为外商投资企业或外国企业在华分支？</span><div className="segmented">{ownershipOptions.map(([v, l]) => <button type="button" className={entForm.ownership === v ? "selected" : ""} key={v} onClick={() => setEnt("ownership", v)}>{l}</button>)}</div><small className="field-help">仅用于记录和生成材料时的背景说明，不影响适用性判断和材料推荐。</small></div>
        <div className="two-column-fields">
          <label className="field"><span>涉及自然人人数</span><div className="input-suffix"><input type="number" min="0" value={entForm.personCount ?? ""} onChange={e => setEnt("personCount", e.target.value === "" ? null : Number(e.target.value))} placeholder="例如 2300" /><span>人</span></div></label>
          <label className="check-line"><input type="checkbox" checked={entForm.countVerified} onChange={e => setEnt("countVerified", e.target.checked)} /><span><strong>已合并各系统中的自然人</strong><small>不确定也可以继续，系统会生成确认任务。</small></span></label>
        </div>
        <div className="field"><span>通常由谁决定为什么收集和怎样使用这些信息？</span><div className="segmented">{processingRoleOptions.map(([v, l]) => <button type="button" className={entForm.processingRole === v ? "selected" : ""} key={v} onClick={() => setEnt("processingRole", v)}>{l}</button>)}</div></div>
        <div className="field"><span>目前保存或使用哪些自然人的信息？</span><div className="tag-choices">{subjectOptions.map(([v, l]) => <button type="button" className={entForm.subjectCategories.includes(v) ? "selected" : ""} key={v} onClick={() => toggleEnt("subjectCategories", v)}>{l}</button>)}<button type="button" className={showEntCustomSubject ? "selected" : ""} onClick={() => { setShowEntCustomSubject(value => !value); if (showEntCustomSubject) setEntCustomSubject(""); }}>其他（自行说明）</button></div><small className="field-help">按个人信息所涉主体选择，不以购买方或合同相对方为限。</small>{showEntCustomSubject && <label className="custom-subject-box"><span>其他主体类型及相关场景</span><textarea maxLength={300} value={entCustomSubject} onChange={event => setEntCustomSubject(event.target.value)} placeholder="例如：患者或产品使用者——医疗器械可能由医院提供，本单位在售后服务或投诉处理中收集其反馈和联系方式" /><small>该说明会用于后续 AI 判断和材料生成；建立具体业务时还可以进一步拆分场景。</small></label>}</div>
        <div className="field"><span>根据法定口径，是否处理以下敏感个人信息？</span><div className="sensitive-category-grid compact">{sensitiveCategoryDefinitions.map(item => <button type="button" className={entForm.sensitiveCategories.includes(item.code) ? "selected" : ""} key={item.code} onClick={() => toggleEnt("sensitiveCategories", item.code)}><span><strong>{item.label}</strong></span><small>{item.examples}</small><em>{item.boundary}</em></button>)}</div><small className="field-help">依据《个人信息保护法》第二十八条识别，GB/T 45574—2025 用于细化类别和边界；不满十四周岁未成年人的全部个人信息在下方单独确认。</small></div>
        <div className="two-column-fields">
          <div className="field"><span>可能包括不满十四周岁的未成年人吗？</span><div className="segmented">{ynOptions.map(([v, l]) => <button type="button" className={entForm.minorsPossible === v ? "selected" : ""} key={v} onClick={() => setEnt("minorsPossible", v as EnterpriseProfile["minorsPossible"])}>{l}</button>)}</div></div>
          <div className="field"><span>会存到境外或被境外人员远程查看吗？</span><div className="segmented">{ynOptions.map(([v, l]) => <button type="button" className={entForm.crossBorder === v ? "selected" : ""} key={v} onClick={() => setEnt("crossBorder", v as EnterpriseProfile["crossBorder"])}>{l}</button>)}</div></div>
        </div>
        <div className="contact-box"><strong>内部负责人（不自动对外公开）</strong><div className="three-inputs">
          <label><span>负责人姓名</span><input value={entForm.privacyContactName} onChange={e => setEnt("privacyContactName", e.target.value)} /></label>
          <label><span>岗位</span><input value={entForm.privacyContactRole} onChange={e => setEnt("privacyContactRole", e.target.value)} /></label>
          <label><span>内部联系渠道</span><input value={entForm.privacyContactChannel} onChange={e => setEnt("privacyContactChannel", e.target.value)} /></label>
        </div></div>
        <div className="contact-box public-contact-box"><strong>对外权利请求渠道（进入告知材料）</strong><div className="two-column-fields"><label><span>接收部门</span><input value={entForm.publicContactDepartment || ""} onChange={e => setEnt("publicContactDepartment", e.target.value)} placeholder="例如：法务与合规部" /></label><label><span>公开渠道</span><input value={entForm.publicContactChannel || ""} onChange={e => setEnt("publicContactChannel", e.target.value)} placeholder="例如：privacy@example.com" /></label></div></div>
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
          <div className="activity-title"><h3>{item.remark || item.name}</h3>{item.remark && <span className="activity-scenario-label">{item.name}</span>}</div>
          <p>{item.description}</p>
        </div>
        <div className="activity-count"><strong>{item.facts.approximatePersonCount === null ? "待确认" : `约 ${item.facts.approximatePersonCount} 人`}</strong><span>{item.facts.dataSubjects.slice(0, 2).join("、") || "尚未填写涉及人员"}</span></div>
        <div className="activity-record-status"><StatusBadge status={item.status} /><span>{ready ? "业务情况已完整" : `已填写 ${Math.round(item.completeness * 100)}%`}</span></div>
        {ready
          ? <div className="activity-actions"><button className="button secondary" onClick={() => openFacts(item)}><Pencil size={15} /> 修改</button><button className="button primary" disabled={busy === item.id} onClick={() => assess(item)}>{busy === item.id ? <RefreshCw size={16} className="spin" /> : <ClipboardCheck size={16} />} 检查业务情况</button><button className="icon-button danger-icon" disabled={busy === `delete-${item.id}`} aria-label={`删除${item.name}`} title="删除业务" onClick={() => remove(item)}>{busy === `delete-${item.id}` ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />}</button></div>
          : <div className="activity-actions"><button className="button secondary" onClick={() => openFacts(item)}><ClipboardList size={16} /> 完善业务情况</button><button className="icon-button danger-icon" disabled={busy === `delete-${item.id}`} aria-label={`删除${item.name}`} title="删除业务" onClick={() => remove(item)}>{busy === `delete-${item.id}` ? <RefreshCw size={16} className="spin" /> : <Trash2 size={16} />}</button></div>}
      </article>;
    })}</div> : <EmptyState icon={BriefcaseBusiness} title="还没有记录业务" description="从客户联系人、员工管理或官网联系表单开始，通常10分钟内可以完成首个场景。" action={<button className="button primary" onClick={() => { setError(""); setAdding(true); }}><Plus size={17} /> 添加首个业务</button>} />}

    {adding && <div className="modal-backdrop" onClick={() => setAdding(false)}><section className="modal large-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">添加业务场景</p><h2>贵单位在哪些工作中使用个人信息？</h2><p>先选最接近的一项，之后可以继续完善。</p></div><button className="icon-button" onClick={() => setAdding(false)}>×</button></div>
      {error && <div className="alert danger">{error}</div>}
      <div className="scenario-grid">{catalog.map(item => <button disabled={busy === item.code} className={`scenario-choice ${existing.has(item.code) ? "already" : ""}`} key={item.code} onClick={() => add(item)}><div className="scenario-choice-icon"><BriefcaseBusiness /></div><div><strong>{item.name}</strong><span>{item.description}</span><small className="scenario-outcome">完成后用于：业务检查、材料生成和专项评估判断</small>{existing.has(item.code) && <small><CheckCircle2 size={13} /> 已添加，可再次建立独立场景</small>}</div><ArrowRight /></button>)}</div>
    </section></div>}

    {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><section className="modal fact-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">完善业务情况</p><h2>{activityDisplayName({ ...editing, remark: activityRemark })}</h2><p>按实际情况填写；企业档案中已有的统一联系渠道会自动带入，同一事实不必重复填写。</p></div><button className="icon-button" onClick={() => setEditing(null)}>×</button></div>
      <label className="activity-remark-field"><span>场景备注 / 区分名称 <small>选填</small></span><div className="activity-remark-control"><input maxLength={200} value={activityRemark} onChange={event => setActivityRemark(event.target.value)} placeholder={`例如：${editing.name === "员工管理" ? "上海分公司正式员工" : editing.name === "消费者或会员" ? "小程序会员" : "华东区域或具体产品线"}`} /><em>同一类场景可以建立多条记录，用备注区分地区、产品、渠道或人群；不会改变系统对场景类型的判断。</em></div></label>
      <nav className="fact-wizard-nav" aria-label="业务情况填写步骤">
        {factSteps.map(step => <button type="button" key={step.number} className={factStep === step.number ? "active" : factStep > step.number ? "passed" : ""} onClick={() => setFactStep(step.number)}><span>{factStep > step.number ? "✓" : step.number}</span><div><strong>{step.title}</strong><small>{step.description}</small></div></button>)}
      </nav>
      <div className="fact-step-content" ref={factContentRef}>
        {factStep === 1 && <>
          <div className="fact-step-heading"><span>第 1 步</span><h3>这项业务涉及谁和哪些信息？</h3><p>先记录业务范围，不需要使用法律术语。</p></div>
          {multiChoice(1, "dataSubjects", "1. 这项业务涉及哪些人员？", "例如企业客户联系人、员工或访客。")}
          {multiChoice(2, "informationTypes", "2. 会使用哪些个人信息？", "只选择这项业务实际需要的信息类型。")}
          <section className="fact-section information-detail-field">
            <div className="fact-title"><strong>具体字段或资料名称</strong><span>选填 · 建议填写</span></div>
            <p>用业务语言列出字段名称即可，例如“工资卡号、体检报告、门禁人脸比对”；不要填写任何人的真实号码、姓名或资料内容。系统将在第4步结合用途和处理方式进行 AI 辅助识别。</p>
            <textarea className="fact-input fact-notes" maxLength={1500} value={facts.informationDetails || ""} onChange={event => { setFacts(current => ({ ...current, informationDetails: event.target.value })); setSensitiveAnalysis(null); setSensitiveError(""); setDismissedSensitive([]); }} placeholder="例如：姓名、工作邮箱、工资卡号、年度体检报告；门禁系统使用人脸进行身份核验" />
          </section>
          <section className="fact-section"><div className="fact-title"><strong>3. 这项业务大约涉及多少人？</strong><span className="fact-title-tags">{missingTag(3)}<span>必填</span></span></div><p>填写当前大致人数即可；同一个人不要因为出现在多个系统中重复计算。</p><input className="fact-input" type="number" min="0" step="1" value={facts.approximatePersonCount ?? ""} onChange={event => setFacts(current => ({ ...current, approximatePersonCount: event.target.value === "" ? null : Number(event.target.value) }))} placeholder="例如：80" /></section>
        </>}
        {factStep === 2 && <>
          <div className="fact-step-heading"><span>第 2 步</span><h3>这些信息怎样进入和使用？</h3><p>确认目的、来源、保存位置和外部接收方。</p></div>
          {multiChoice(4, "purposes", "4. 为什么需要这些信息？", "选择最直接、具体的业务目的。")}
          {multiChoice(5, "collectionChannels", "5. 信息从哪里取得？", "确认由本人提供、其他企业提供，还是由设备采集。")}
          {multiChoice(6, "systems", "6. 信息保存或使用在哪里？", "包括云端系统、本地表格、邮箱和纸质材料。")}
          {multiChoice(7, "recipients", "7. 是否会交给外部单位？", "服务商受托处理也需要选择；完全不提供时选择第一项。")}
          {hasExternalRecipient(facts) && <section className="fact-section external-relationship-section">
            <div className="fact-title"><strong>7A. 外部单位与贵单位是什么关系？</strong><span className="fact-title-tags">{missingTag(7)}<span>可多选 · 必填</span></span></div>
            <p>法律要求会因关系不同而变化。请按实际决定权选择，不要只按合同名称判断。</p>
            <div className="external-relationship-grid">{externalProcessingRelationshipOptions.map(item => {
              const selected = (facts.externalProcessingRelationships || []).includes(item.code);
              return <button type="button" className={selected ? "selected" : ""} key={item.code} onClick={() => setFacts(current => ({ ...current, externalProcessingRelationships: selected ? (current.externalProcessingRelationships || []).filter(code => code !== item.code) : [...(current.externalProcessingRelationships || []).filter(code => code !== "unknown"), item.code] }))}><span>{selected && <Check size={14} />}<strong>{item.label}</strong></span><small>{item.help}</small></button>;
            })}</div>
            <label className="external-recipient-detail"><span>外部单位、联系渠道及处理边界 <em>{(facts.externalProcessingRelationships || []).includes("unknown") ? "建议补充" : "必填"}</em></span><textarea className="fact-input fact-notes" aria-invalid={!(facts.externalProcessingRelationships || []).includes("unknown") && String(facts.externalRecipientDetails || "").trim().length < 5} value={facts.externalRecipientDetails || ""} onChange={event => setFacts(current => ({ ...current, externalRecipientDetails: event.target.value }))} placeholder="例如：XX云科技（support@example.com），仅按本单位指示托管CRM数据；XX医院，接收不良事件报告后独立履行诊疗或监管义务" /><small>至少说明单位名称或可识别主体、联系渠道，以及其受托处理、独立接收、共同决定或依法接收的边界；暂不清楚时可先继续，系统会生成确认事项。</small></label>
          </section>}
        </>}
        {factStep === 3 && <>
          <div className="fact-step-heading"><span>第 3 步</span><h3>单位内部怎样管理？</h3><p>这些安排会直接进入合规材料和后续办理事项。</p></div>
          {multiChoice(8, "accessRoles", "8. 单位内哪些岗位可以查看或使用？", "选择实际能够接触这些信息的岗位；暂时没有分清权限时可选“不清楚”。")}
          {multiChoice(9, "systemOperators", "9. 谁负责维护保存这些信息的系统？", "例如本单位管理员、云服务商或外包人员；只有纸质材料且无人专门运维时，可选“不涉及专门运维”。")}
          <section className="fact-section retention-section"><div className="fact-title"><strong>10. 通常保存多长时间？</strong><span className="fact-title-tags">{missingTag(10)}<span>必填</span></span></div><p>请如实填写当前做法。系统会检查表述是否可能超过实现处理目的所必要的最短时间，但不会脱离具体业务直接认定违法或给出统一年限。</p><input className="fact-input" value={facts.retentionPeriod} onChange={event => setFacts(current => ({ ...current, retentionPeriod: event.target.value }))} placeholder="例如：合作期间，合作结束后保留3年" />{retentionAssessment.level !== "none" && <><div className={`retention-risk-note risk-${retentionAssessment.level}`}><AlertTriangle size={17} /><div><strong>{retentionAssessment.title}</strong><p>{retentionAssessment.message}</p></div></div><label className="retention-basis-field"><span>保存期限依据 <b>{retentionAssessment.requiresBasis ? "必填" : "已填写"}</b></span><textarea className="fact-input fact-notes" value={facts.retentionBasis || ""} onChange={event => setFacts(current => ({ ...current, retentionBasis: event.target.value }))} placeholder="说明持续保存对应的处理目的、起算点；如法律、行政法规另有规定，请写明规定名称、适用数据范围和期限" /><small>补充依据后仍会进入业务检查，由负责人结合实际记录确认。</small></label></>}</section>
          <section className="fact-section"><div className="fact-title"><strong>11. 保存期满后实际怎样处理？</strong><span className="fact-title-tags">{missingTag(11)}<span>必填</span></span></div><p>说明由谁、在什么系统中、按什么方式删除、匿名化或限制继续使用。</p><textarea className="fact-input fact-notes" value={facts.deletionMethod} onChange={event => setFacts(current => ({ ...current, deletionMethod: event.target.value }))} placeholder="例如：每季度由行政负责人核对到期记录，并在邮箱和客户表格中删除" /></section>
          <section className="fact-section"><div className="fact-title"><strong>12. 个人需要查询、更正或删除时，通过什么方式联系？</strong><span className="fact-title-tags">{missingTag(12)}<span>必填</span></span></div><p>{defaultRightsChannel ? "已从企业档案带入统一联系渠道；如本业务使用其他渠道，可以在这里修改。" : "可以填写邮箱、电话、网站表单或其他真实可用的联系入口。"}</p><input className="fact-input" value={facts.rightsChannel} onChange={event => setFacts(current => ({ ...current, rightsChannel: event.target.value }))} placeholder="例如：privacy@example.com 或客服电话" /></section>
        </>}
        {factStep === 4 && <>
          <div className="fact-step-heading"><span>第 4 步</span><h3>是否存在需要特别关注的情况？</h3><p>不确定时可以选择“不清楚”，系统会保留为待确认事项。</p></div>
          <section className="fact-section sensitive-identification">
            <div className="fact-title"><strong>13. 按法定口径识别敏感个人信息</strong><span className="fact-title-tags">{missingTag(13)}<span>必填</span></span></div>
            <p>先核对实际保存的字段和资料内容，再判断是否落入法定类别；系统给出的是候选和追问，不会替您自动作出最终确认。</p>
            {editing.scenarioCode === "SCN-HR-EMPLOYEE" && <div className="sensitive-scenario-guide"><div><Sparkles size={15} /><strong>员工管理建议先逐项核对</strong></div><ul><li>入职档案：是否留存身份证件照片或复印件</li><li>薪酬福利：是否留存工资卡、账户鉴别信息或工资收入明细</li><li>健康事项：是否留存体检报告、病假诊断、工伤、生育、医疗报销或保险理赔资料</li><li>考勤门禁：是否使用人脸、指纹等特征识别身份</li><li>员工福利和活动：是否处理员工子女信息，尤其是不满十四周岁未成年人信息</li></ul><small>仅出现“员工管理”“薪酬和考勤”等概括名称不足以完成识别，请在第1步的“具体字段或资料名称”中补充实际字段。</small></div>}
            <div className="sensitive-ai-box">
              <div className="sensitive-ai-heading"><div><span className="ai-mark"><Sparkles size={14} /> {sensitiveAiAvailable ? "AI + 法定规则识别" : "法定规则辅助识别"}</span><strong>让系统先找出疑似类别、说明判断边界并提出可回答的事实问题</strong><small>{sensitiveAiAvailable ? "当前AI服务已就绪；结果仍需按候选卡片中的事实问题人工确认。" : "当前未检测到可用AI配置，本次将直接使用法定类别基础规则，不会假装已经调用AI。"}</small></div><button type="button" className="button secondary" disabled={sensitiveChecking || (!facts.informationTypes.length && !(facts.informationDetails || "").trim())} onClick={runSensitiveIdentification}>{sensitiveChecking ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} />} {sensitiveChecking ? "正在识别…" : sensitiveAnalysis ? "重新识别" : sensitiveAiAvailable ? "开始AI识别" : "运行基础规则"}</button></div>
              {sensitiveError && <div className="alert danger">{sensitiveError}</div>}
              {sensitiveAnalysis && <div className="sensitive-ai-results">
                <div className="sensitive-ai-meta"><span>{sensitiveAnalysis.source === "ai_assisted" ? "AI + 法定规则联合识别" : "基础规则识别"}</span>{sensitiveAnalysis.redactionCount > 0 && <em>发送前已遮蔽 {sensitiveAnalysis.redactionCount} 处疑似个人信息值</em>}</div>
                {sensitiveAnalysis.candidates.filter(item => !dismissedSensitive.includes(item.category)).length > 0 ? <div className="sensitive-candidate-list">
                  {sensitiveAnalysis.candidates.filter(item => !dismissedSensitive.includes(item.category)).map(item => {
                    const accepted = (facts.sensitiveCategories || []).includes(item.category);
                    return <article className={`sensitive-candidate confidence-${item.confidence}`} key={item.category}>
                      <div className="sensitive-candidate-title"><strong>{item.label}</strong><span>{item.basis === "rule_and_ai" ? "AI与规则共同提示" : item.basis === "rule" ? "规则提示" : "AI建议"}</span><em>{item.confidence === "high" ? "较高相关" : item.confidence === "medium" ? "需要确认" : "低置信提示"}</em></div>
                      {item.evidence.length > 0 && <p><b>触发描述：</b>{item.evidence.join("、")}</p>}
                      <p>{item.reasoning}</p>
                      {item.question && <p className="sensitive-candidate-question"><b>请确认：</b>{item.question}</p>}
                      <div className="sensitive-candidate-actions"><button type="button" className={`button small ${accepted ? "secondary" : "primary"}`} disabled={accepted} onClick={() => acceptSensitiveCandidate(item.category)}>{accepted ? <><CheckCircle2 size={14} /> 已确认加入</> : "确认加入此类别"}</button>{!accepted && <button type="button" className="button small ghost" onClick={() => setDismissedSensitive(current => [...current, item.category])}>暂不采纳</button>}</div>
                    </article>;
                  })}
                </div> : <div className="sensitive-ai-none"><CheckCircle2 size={17} /><span>本次没有识别出明确的敏感类别候选。仍需由您结合实际情况确认，系统不会自动选择“不涉及”。</span></div>}
                {sensitiveAnalysis.questions.length > 0 && <div className="sensitive-ai-questions"><strong>还需要确认</strong>{sensitiveAnalysis.questions.map((item, index) => <p key={index}>{index + 1}. {item}</p>)}</div>}
                {sensitiveAnalysis.boundaryObservations.length > 0 && <div className="sensitive-ai-boundaries"><strong>识别边界</strong>{sensitiveAnalysis.boundaryObservations.map((item, index) => <p key={index}>{item}</p>)}</div>}
                {sensitiveAnalysis.warnings.map((item, index) => <div className="alert warning" key={index}>{item}</div>)}
              </div>}
            </div>
            <div className="sensitive-category-grid">{sensitiveCategoryDefinitions.map(item => <button type="button" className={(facts.sensitiveCategories || []).includes(item.code) ? "selected" : ""} key={item.code} onClick={() => toggleSensitiveCategory(item.code)}><span>{(facts.sensitiveCategories || []).includes(item.code) && <CheckCircle2 size={14} />}<strong>{item.label}</strong></span><small>{item.examples}</small><em>{item.boundary}</em></button>)}</div>
            <div className="segmented sensitive-result"><button type="button" className={facts.sensitiveInformation === "no" ? "selected" : ""} onClick={() => setFacts(current => ({ ...current, sensitiveCategories: [], sensitiveInformation: "no" }))}>确认均不涉及</button><button type="button" className={facts.sensitiveInformation === "unknown" ? "selected" : ""} onClick={() => setFacts(current => ({ ...current, sensitiveCategories: [], sensitiveInformation: "unknown" }))}>暂不清楚，交负责人确认</button></div>
            {facts.minorsInvolved === "yes" && <div className="alert warning">本业务涉及不满十四周岁未成年人，其全部个人信息依法属于敏感个人信息，系统已自动纳入敏感信息处理路径。</div>}
            <small className="field-help">主要依据：《个人信息保护法》第二十八条；GB/T 45574—2025 第4章、附录A。居民身份证照片属于标准列明项，但普通证件号码或证件核验仍应结合泄露后危害判断；普通照片不等于生物识别，粗略位置不等于精准定位或连续轨迹。</small>
          </section>
          {answerChoice(14, "minorsInvolved", "14. 是否可能涉及不满十四周岁未成年人？", "请按实际参与人员和资料判断；除直接面向儿童的产品外，员工家属商业保险、家庭日、亲子活动、员工子女福利等也可能涉及。无法确认时请选择“不清楚”。")}
          {answerChoice(15, "crossBorderAccess", "15. 是否可能从境外存储或访问？", "包括境外云服务，以及境外总部或管理员远程查看。")}
          {answerChoice(16, "automatedDecision", "16. 系统是否会自动决定推荐、价格、资格或其他对个人有影响的结果？", "普通表格、邮箱、CRM记录本身通常不属于这种情况；如果只是人工查看后作决定，请选择“不涉及”。")}
          <section className="fact-section"><div className="fact-title"><strong>补充说明</strong><span>选填</span></div><textarea className="fact-input fact-notes" value={facts.notes} onChange={event => setFacts(current => ({ ...current, notes: event.target.value }))} placeholder="还有哪些情况希望系统在检查时考虑？" /></section>
        </>}
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
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="modal-actions wizard-actions fact-wizard-actions"><span>第 {factStep} 步，共 4 步</span><div>{factStep > 1 && <button className="button secondary" onClick={() => setFactStep(current => current - 1)}>上一步</button>}{factStep < 4 ? <><button className="button secondary" disabled={busy === editing.id} onClick={() => void saveFacts(true)}>{busy === editing.id ? "保存中…" : "保存并退出"}</button><button className="button primary" onClick={() => setFactStep(current => current + 1)}>下一步 <ArrowRight size={15} /></button></> : <button className="button primary" disabled={busy === editing.id} onClick={() => void saveFacts(true)}>{busy === editing.id ? "保存中…" : "保存业务情况"}</button>}</div></div>
    </section></div>}

    {triage && <div className="modal-backdrop" onClick={() => setTriage(null)}><section className="modal" onClick={event => event.stopPropagation()}>
      <div className="triage-head"><div className="step-icon"><ClipboardCheck /></div><div><p className="eyebrow">业务检查结果</p><h2>{triageTitles[triage.status] || "检查已完成"}</h2><p className="triage-summary">{triage.summary}</p></div></div>
      <div className="triage-purpose"><strong>这页在检查什么？</strong><span>根据您填写的内容，检查信息是否完整、前后是否一致，以及是否需要进一步评估。它不会判断您填写的事实是否真实；负责人仍需结合合同、系统设置和实际记录确认。</span></div>
      {triage.warnings.length > 0 && <div className="triage-warnings">{triage.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      {triage.findings.length ? <div className="finding-list">{triage.findings.map(finding => <div className="finding finding-action" key={finding.id}><span className={`risk risk-${finding.riskLevel}`}>{riskLabels[finding.riskLevel] || "待确认"}</span><div><strong>{finding.title}</strong><p>{finding.description}</p></div>{finding.taskId ? <span className="task-created"><CheckCircle2 size={14} /> 已生成待办</span> : <button className="button small secondary" disabled={busy === finding.id} onClick={() => createFindingTask(finding.id)}>{busy === finding.id ? "生成中…" : "生成待办"}</button>}</div>)}</div> : triage.status === "draft_ready" ? <div className="all-clear"><CheckCircle2 /><div><strong>根据目前填写的内容，暂未发现需要暂停的事项</strong><p>这表示可以继续完善合规档案，不代表实际情况已经核验或认定合规。</p></div></div> : <div className="alert warning"><AlertTriangle size={18} /><div><strong>本次没有形成可确认的检查项</strong><p>请重新运行初步检查；如果仍然出现该提示，请由负责人或专业人员结合实际业务确认。</p></div></div>}
      <div className="triage-next-step"><strong>接下来怎么做？</strong><p>{triage.findings.length ? triage.findings.some(finding => finding.taskId) ? "已生成的事项可在“办理事项”中继续处理；尚未生成的检查项可在上方逐项建立待办。" : "需要持续跟进的检查项，请先在上方生成待办；系统会保留检查依据和处理记录。" : "可以继续建立或更新合规材料，并在发布前由负责人核对正文。"}</p></div>
      <div className={`check-method-note ${triage.source !== "local_rules" ? "" : "fallback-note"}`}>系统通过{triage.source !== "local_rules" ? "规则和AI辅助" : "基础规则"}完成本次内容检查。本结果不是合规认证或事实核验结论。</div>
      <div className="modal-actions"><Link className="button secondary" href="/assessments">查看检查记录</Link>{triage.findings.some(finding => finding.taskId) ? <Link className="button primary" href="/tasks">继续办理事项 <ArrowRight size={15} /></Link> : triage.findings.length === 0 ? <Link className="button primary" href="/documents">继续建立材料 <ArrowRight size={15} /></Link> : <button className="button primary" onClick={() => setTriage(null)}>返回检查项</button>}</div>
    </section></div>}
  </>;
}
