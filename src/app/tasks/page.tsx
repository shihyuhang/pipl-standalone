"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CheckCircle2, Circle, Clock3, ExternalLink, FileCheck2, RefreshCw } from "lucide-react";
import type { DashboardData, TaskItem } from "@/lib/types";

function sourceLink(task: TaskItem): { href: string; label: string } | null {
  if (task.code === "HIGH-RISK-REVIEW") return { href: "/business", label: "前往相关业务逐项核对" };
  if (task.sourceType === "audit_response" || task.category === "合规自查") return { href: "/self-audit", label: "前往合规检查补充" };
  if (task.sourceType === "pipia_response" || task.category === "影响评估") return { href: task.activityId ? `/impact-assessments?activity=${task.activityId}` : "/impact-assessments", label: "前往影响评估补充" };
  if (task.sourceType === "assessment_finding" || task.category === "初步检查") return { href: task.activityId ? `/business?activity=${task.activityId}&step=3` : "/business", label: "修改相关业务情况" };
  if (task.activityId || task.category === "我的业务") return { href: task.activityId ? `/business?activity=${task.activityId}` : "/business", label: "前往对应业务补充" };
  if (task.category === "适用判断") return { href: "/onboarding", label: "前往企业档案补充" };
  if (task.category === "合规材料") return { href: "/documents", label: "前往合规材料补充" };
  return null;
}

function completesFromSource(task: TaskItem): boolean {
  return task.code === "ADD-FIRST-SCENARIO" || task.code === "CREATE-FIRST-NOTICE" ||
    task.code === "VERIFY-PERSON-COUNT" || task.code === "VERIFY-PROCESSING-ROLE" ||
    task.code === "QUALIFICATION-OUT-OF-SCOPE" || task.code.startsWith("COMPLETE-") || task.code.startsWith("PIPIA-");
}

function completionText(task: TaskItem): string {
  if (task.code === "ADD-FIRST-SCENARIO") return "在“我的业务”建立任一业务后，系统自动完成";
  if (task.code === "CREATE-FIRST-NOTICE") return "建立首份对外规则或告知材料后，系统自动完成";
  if (task.code === "VERIFY-PERSON-COUNT") return "在企业档案确认人数和统计口径后，系统自动完成";
  if (task.code === "VERIFY-PROCESSING-ROLE") return "在企业档案确认处理角色后，系统自动完成";
  if (task.code === "QUALIFICATION-OUT-OF-SCOPE") return "更新人数后由系统重新判断，超出范围时转专业人员";
  if (task.code.startsWith("COMPLETE-")) return "业务必要信息达到完整状态后，系统自动完成";
  if (task.code.startsWith("PIPIA-")) return "完成影响评估全部判断并由负责人确认归档后，系统自动完成";
  return taskFormConfig(task).completionCondition;
}

type TaskFormConfig = {
  guide: string;
  resultLabel: string;
  resultPlaceholder: string;
  resultHelp: string;
  evidenceLabel: string;
  evidencePlaceholder: string;
  confirmationTitle: string;
  confirmationHelp: string;
  completionCondition: string;
};

function taskFormConfig(task: TaskItem): TaskFormConfig {
  const text = `${task.title} ${task.description}`;
  if (task.code === "HIGH-RISK-REVIEW") return {
    guide: "分别核对当前实际涉及的敏感个人信息、不满十四周岁未成年人和境外存储或访问情况；记录触发业务、具体信息、处理目的及负责人结论。企业档案只能记录总体提示，具体事实应在“我的业务”中逐项确认。",
    resultLabel: "专项复核结论",
    resultPlaceholder: "例如：员工管理涉及体检报告和工资卡号，已确认处理目的、必要性、访问范围和保护措施；家庭日活动可能涉及员工子女，活动开展前补充监护人告知同意；当前没有境外存储或访问。",
    resultHelp: "不要只写“已复核”，应分别说明哪些业务触发、核对了什么以及是否仍需整改或评估。",
    evidenceLabel: "相关业务记录、评估或证明材料位置",
    evidencePlaceholder: "例如：员工管理业务记录、敏感个人信息单独同意、影响评估、系统配置截图。",
    confirmationTitle: "我已按具体业务逐项核对高风险事实并记录结论",
    confirmationHelp: "完成后该事项不会因同一批企业档案事实立即重新置顶；相关风险事实变化时系统会再次提示。",
    completionCondition: "逐项确认敏感个人信息、未成年人和境外处理事实，并记录结论及依据"
  };
  if (/涉及人数|人数口径/.test(text)) return {
    guide: "写明统计日期、覆盖哪些人员、是否去重，以及最终确认的人数或估算范围。",
    resultLabel: "人数统计结果",
    resultPlaceholder: "例如：截至2026年8月10日，仍保存或使用个人信息共涉及约860人，其中员工42人、求职者120人、客户和供应商联系人698人；已按手机号或人员编号去重，并排除已经删除的数据。",
    resultHelp: "需要写出最终人数或合理估算范围，并说明统计范围和去重方法。",
    evidenceLabel: "人数统计依据或台账位置",
    evidencePlaceholder: "例如：HR在职及历史员工名单、招聘台账、CRM联系人去重统计表；存放于内部共享盘/个保档案/人数统计。",
    confirmationTitle: "我已按统一口径核对并确认上述人数结果",
    confirmationHelp: "已覆盖当前仍保存或使用的信息，并排除已删除数据和重复人员。",
    completionCondition: "确认统计日期、人员范围、去重口径和最终人数"
  };
  if (/删除|保存期限/.test(text)) return {
    guide: "写明哪些系统或文件需要删除、何时触发、由谁执行，以及不能立即删除时如何限制使用。",
    resultLabel: "删除机制和落实结果",
    resultPlaceholder: "例如：合作终止3年后，由行政负责人按季度检查CRM、邮箱和纸质合同；到期数据执行删除，依法暂不能删除的转入限制访问的归档区。",
    resultHelp: "说明删除条件、涉及系统、执行人员和不能立即删除时的处理方式。",
    evidenceLabel: "删除设置、记录或存放位置",
    evidencePlaceholder: "例如：CRM保存期限设置截图、季度删除记录；存放于内部共享盘/个保档案/删除记录。",
    confirmationTitle: "我已核对删除机制可以在实际系统和文件中执行",
    confirmationHelp: "不是只写制度要求，相关负责人知道何时、在哪里以及怎样删除。",
    completionCondition: "明确删除条件、执行范围、负责人和留痕方式"
  };
  if (/权利|查询|更正/.test(text)) return {
    guide: "写明个人可以通过哪个邮箱、电话或表单提出请求，以及由谁登记、办理和答复。",
    resultLabel: "个人提出请求的渠道和办理安排",
    resultPlaceholder: "例如：员工和业务联系人可通过privacy@example.com提出查询、更正或删除请求，由行政负责人登记，并协调HR、CRM负责人办理和答复。",
    resultHelp: "至少说明可用的联系渠道、受理人员和基本处理步骤。",
    evidenceLabel: "渠道页面、内部指引或台账位置",
    evidencePlaceholder: "例如：隐私声明中的联系页面、请求登记表；存放于内部共享盘/个保档案/个人请求。",
    confirmationTitle: "我已确认该渠道真实可用并有人负责处理",
    confirmationHelp: "个人可以实际联系到企业，而不是仅在文本中保留一个无效入口。",
    completionCondition: "明确请求渠道、受理人、办理和答复方式"
  };
  if (/访问岗位|操作权限|权限控制|账号权限|未经授权的?访问|查看或导出|查阅、复制、传输/.test(text.replace(/境外访问/g, ""))) return {
    guide: "这项要求应对应到产生该待办的具体业务或检查发现，并非要求所有场景填写相同答案。请列出该业务中实际可以查看或导出信息的岗位，并说明授权、离职关停和定期检查方式。《个人信息保护法》第五十一条第（四）项要求合理确定个人信息处理的操作权限。",
    resultLabel: "可访问岗位和权限控制结果",
    resultPlaceholder: "例如：CRM仅销售经理和客户服务岗位可查看，导出权限仅限部门负责人；员工离职当日由管理员关闭账号，每季度复核一次权限。",
    resultHelp: "说明哪些岗位可以查看、修改或导出，以及权限开通、关闭和复核方式。",
    evidenceLabel: "权限清单、系统截图或存放位置",
    evidencePlaceholder: "例如：CRM角色权限截图、账号权限清单；存放于内部共享盘/个保档案/权限检查。",
    confirmationTitle: "我已结合实际账号和系统设置核对上述权限",
    confirmationHelp: "确认记录与当前在用账号、岗位和系统配置一致。",
    completionCondition: "明确访问岗位、权限范围及开通和关停机制"
  };
  if (/怎样决定信息用途|处理角色/.test(text)) return {
    guide: "结合合同和实际业务，确认贵单位是自主决定使用目的和方式，还是主要按照客户的书面指示处理。",
    resultLabel: "处理角色确认结果",
    resultPlaceholder: "例如：客户联系人信息由本单位决定用于项目沟通和合同履行，本单位属于个人信息处理者；托管系统中的客户数据仅按客户指示处理，属于受托处理。",
    resultHelp: "如不同业务中的角色不同，应分别说明，不要只按企业类型判断。",
    evidenceLabel: "合同条款或业务说明位置",
    evidencePlaceholder: "例如：客户服务合同第8条、系统服务协议数据处理附件。",
    confirmationTitle: "我已结合合同和实际业务确认处理角色",
    confirmationHelp: "确认结果不是仅依据公司名称或B2B/B2C属性作出。",
    completionCondition: "按具体业务确认处理角色及判断依据"
  };
  return {
    guide: "请记录实际核对结果、已经采取的措施及仍需继续处理的内容，不要只填写“已处理”。",
    resultLabel: "实际确认结果或已采取的措施",
    resultPlaceholder: "请具体说明核对了什么、确认结果是什么、已经采取哪些措施，以及是否还有未完成事项。",
    resultHelp: "请填写具体结果，不要只写“已办理”或“已确认”。",
    evidenceLabel: "证明材料或存放位置",
    evidencePlaceholder: "例如：制度、表格、系统截图或内部记录的名称和存放位置。",
    confirmationTitle: "我已根据实际业务核对以上内容",
    confirmationHelp: "勾选后才能确认完成；保存进度时不要求勾选。",
    completionCondition: "填写具体办理结果、负责人和必要的证明线索"
  };
}

export default function TasksPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [filter, setFilter] = useState<"open" | "completed">("open");
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [handlingNote, setHandlingNote] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async (selectedId?: string) => {
    const next = await fetch(`/api/dashboard?fresh=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    }).then(response => response.json()) as DashboardData;
    setData(next);
    if (selectedId) {
      const task = next.tasks.find(item => item.id === selectedId) || null;
      setSelected(task);
      if (task) {
        setHandlingNote(task.handlingNote);
        setEvidenceNote(task.evidenceNote);
        setResponsibleName(task.responsibleName || next.enterprise.privacyContactName || "");
        setConfirmed(task.status === "completed");
      }
    }
  };
  useEffect(() => {
    const selectedId = new URLSearchParams(window.location.search).get("task") || undefined;
    void load(selectedId);
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const openTask = (task: TaskItem) => {
    setSelected(task);
    setHandlingNote(task.handlingNote);
    setEvidenceNote(task.evidenceNote);
    setResponsibleName(task.responsibleName || data?.enterprise.privacyContactName || "");
    setConfirmed(task.status === "completed");
    setError("");
  };

  const save = async (status: TaskItem["status"]) => {
    if (!selected) return;
    setBusy(status); setError("");
    const response = await fetch(`/api/tasks/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, handlingNote, evidenceNote, responsibleName, completionConfirmed: confirmed })
    });
    const result = await response.json() as TaskItem | { message?: string };
    if (!response.ok) {
      setError("message" in result ? result.message || "保存失败，请重试。" : "保存失败，请重试。");
      setBusy(""); return;
    }
    await load(selected.id); setBusy("");
    if (status === "completed" || status === "open") setSelected(null);
  };

  const tasks = data?.tasks || [];
  const visible = tasks.filter(task => filter === "completed" ? task.status === "completed" : task.status !== "completed");
  const relatedLink = selected ? sourceLink(selected) : null;
  const formConfig = selected ? taskFormConfig(selected) : null;

  return <>
    <section className="page-heading"><div><p className="eyebrow">办理事项</p><h1>待办与整改</h1><p>可由企业档案、业务记录或评估结果确认的事项由系统自动办结；其余事项需记录实际整改结果。</p></div></section>
    <div className="tab-bar"><button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>需要办理 <span>{tasks.filter(task => task.status !== "completed").length}</span></button><button className={filter === "completed" ? "active" : ""} onClick={() => setFilter("completed")}>已经完成 <span>{tasks.filter(task => task.status === "completed").length}</span></button></div>
    <section className="card task-board">{visible.length ? visible.map(task => <article className="task-item" key={task.id}>
      <div className={`task-check ${task.status === "completed" ? "done" : ""}`} aria-hidden>{task.status === "completed" ? <Check size={17} /> : <Circle size={17} />}</div>
      <div className="task-body"><div><span className="task-category">{task.category}</span>{task.completionMode === "automatic" && <span className="auto-complete-badge"><CheckCircle2 size={12} /> 系统自动完成</span>}{task.status !== "completed" && completesFromSource(task) && <span className="auto-complete-badge"><RefreshCw size={12} /> 完成后系统核验</span>}{task.priority === "high" && task.status !== "completed" && <span className="priority"><AlertTriangle size={13} /> 优先确认</span>}</div><h3>{task.title}</h3><p>{task.description}</p><div className="acceptance"><CheckCircle2 size={15} /> 完成条件：{completionText(task)}。</div></div>
      {task.status !== "completed" && completesFromSource(task) && sourceLink(task) ? <Link className="button small primary" href={sourceLink(task)!.href}><ExternalLink size={14} /> 前往完成</Link> : <button className="button small secondary" onClick={() => openTask(task)}>{task.status === "completed" ? <FileCheck2 size={14} /> : <Clock3 size={14} />} {task.status === "completed" ? "查看完成依据" : task.status === "open" ? "开始办理" : "继续办理"}</button>}
    </article>) : <div className="all-clear centered"><CheckCircle2 /><div><strong>{filter === "completed" ? "还没有已完成记录" : "当前事项都已处理"}</strong><p>{filter === "completed" ? "完成任务后会自动出现在这里。" : "有业务变化时，系统会生成新的待办。"}</p></div></div>}</section>

    {selected && formConfig && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal task-handle-modal" onClick={event => event.stopPropagation()}>
      <div className="modal-header"><div><p className="eyebrow">{selected.status === "completed" ? "办理记录" : "办理事项"}</p><h2>{selected.title}</h2><p>{selected.description}</p></div><button className="icon-button" onClick={() => setSelected(null)}>×</button></div>
      <div className="task-guide"><strong>{selected.completionMode === "automatic" ? "系统完成依据" : "建议怎样补充"}</strong><p>{selected.completionMode === "automatic" ? selected.completionBasis : formConfig.guide}</p>{selected.completionMode !== "automatic" && relatedLink && <Link href={relatedLink.href} className="text-link"><ExternalLink size={14} /> {relatedLink.label}</Link>}</div>
      {selected.completionMode !== "automatic" && <><label className="field"><span>{formConfig.resultLabel} <b>必填</b></span><textarea disabled={selected.status === "completed"} value={handlingNote} onChange={event => setHandlingNote(event.target.value)} placeholder={formConfig.resultPlaceholder} /><small className="field-help">{formConfig.resultHelp}</small></label>
      <label className="field"><span>负责人 <b>必填</b></span><input disabled={selected.status === "completed"} value={responsibleName} onChange={event => setResponsibleName(event.target.value)} placeholder="填写实际核对或落实本事项的人员" /></label>
      <label className="field"><span>{formConfig.evidenceLabel} <em>选填</em></span><textarea disabled={selected.status === "completed"} value={evidenceNote} onChange={event => setEvidenceNote(event.target.value)} placeholder={formConfig.evidencePlaceholder} /></label></>}
      {selected.status === "completed" && <div className="task-record-meta"><CheckCircle2 size={17} /><div><strong>{selected.completionMode === "automatic" ? "系统已根据现有记录自动完成" : "已形成人工办理记录"}</strong><p>{selected.completionMode === "automatic" ? selected.completionBasis : `负责人：${selected.responsibleName || "历史记录未填写"}`} · 完成时间：{selected.completedAt ? new Date(selected.completedAt).toLocaleString("zh-CN", { hour12: false }) : "未记录"}</p></div></div>}
      {selected.status !== "completed" && <label className="check-line"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span><strong>{formConfig.confirmationTitle}</strong><small>{formConfig.confirmationHelp}</small></span></label>}
      {error && <div className="alert danger">{error}</div>}
      <div className="modal-actions">{selected.status === "completed" ? <><button className="button secondary" onClick={() => setSelected(null)}>关闭</button>{selected.completionMode !== "automatic" && <button className="button secondary" disabled={busy === "open"} onClick={() => save("open")}>{busy === "open" && <RefreshCw size={15} className="spin" />} 重新打开</button>}</> : <><button className="button secondary" disabled={Boolean(busy)} onClick={() => save("in_progress")}>{busy === "in_progress" ? "保存中…" : "保存进度"}</button><button className="button primary" disabled={Boolean(busy) || !confirmed} onClick={() => save("completed")}>{busy === "completed" ? "确认中…" : "确认完成"}</button></>}</div>
    </section></div>}
  </>;
}
