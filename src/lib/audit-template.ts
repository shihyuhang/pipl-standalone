import type { AssessmentRun, AuditItemDefinition, AuditSignal, BusinessDocument, EnterpriseProfile, PipiaInstance, ProcessingActivity, TaskItem } from "./types";

export const auditGroups = [
  { code: "G1", name: "收集、使用和告知", description: "为什么使用个人信息，以及是否已经向相关人员说清楚。" },
  { code: "G2", name: "合作方和信息流转", description: "共同处理、委托服务商、对外提供及主体变化。" },
  { code: "G3", name: "特殊信息和高风险场景", description: "自动化决策、公开、监控、敏感信息、未成年人和境外访问。" },
  { code: "G4", name: "删除和个人请求", description: "如何处理查询、更正、删除和规则解释等请求。" },
  { code: "G5", name: "内部管理和安全措施", description: "制度、权限、培训和负责人履职。" },
  { code: "G6", name: "影响评估和安全事件", description: "影响评估、应急准备和事件响应。" }
];

export const auditItems: AuditItemDefinition[] = [
  { code: "A01", number: 1, groupCode: "G1", title: "处理个人信息的依据", question: "每项业务为什么可以使用这些个人信息，是否已经说得清楚？", help: "需要能说明具体业务目的、必要范围，以及依据同意、合同履行或其他适用情形处理。", evidenceExamples: ["业务处理活动清单", "同意记录", "合同或服务规则"] },
  { code: "A02", number: 2, groupCode: "G1", title: "个人信息处理规则", question: "是否已经形成与实际业务一致的个人信息处理规则？", help: "处理规则应覆盖实际收集的信息、目的、方式、保存期限、个人权利和联系渠道。", evidenceExamples: ["当前发布的个人信息处理规则", "历史版本", "发布记录"] },
  { code: "A03", number: 3, groupCode: "G1", title: "履行告知义务", question: "相关人员在信息被使用前，是否能看到清楚、真实的告知？", help: "检查网站、表单、合同附件、员工告知或线下公示是否与实际做法一致。", evidenceExamples: ["告知页面截图", "员工告知", "表单或合同附件"] },
  { code: "A04", number: 4, groupCode: "G2", title: "共同处理", question: "是否与其他单位共同决定为什么、怎样处理个人信息？", help: "如存在，应明确双方责任以及个人如何行使权利；没有则说明为什么不适用。", evidenceExamples: ["合作协议", "双方责任约定", "业务说明"] },
  { code: "A05", number: 5, groupCode: "G2", title: "委托处理", question: "使用云服务商或其他受托方时，是否约定处理边界并进行必要监督？", help: "常见情形包括CRM、薪酬、邮件、云存储、短信或外包服务。", evidenceExamples: ["委托处理条款", "服务商清单", "检查记录"] },
  { code: "A06", number: 6, groupCode: "G2", title: "主体变更时的信息转移", question: "合并、重组、解散等主体变化时，是否有个人信息交接和通知安排？", help: "当前没有相关事项时可以选择不适用，并说明尚未发生。", evidenceExamples: ["主体变更方案", "通知记录", "删除或交接清单"] },
  { code: "A07", number: 7, groupCode: "G2", title: "向其他处理者提供", question: "把个人信息提供给其他独立单位前，是否完成必要告知、同意和评估？", help: "需要区分受托服务商与独立决定用途的接收方。", evidenceExamples: ["接收方清单", "单独同意记录", "影响评估"] },
  { code: "A08", number: 8, groupCode: "G3", title: "自动化决策", question: "是否使用个人信息自动决定推荐、价格、资格或其他对个人有影响的结果？", help: "仅使用普通办公软件并不当然属于自动化决策；没有相关功能时可选择不适用。", evidenceExamples: ["功能说明", "算法或规则说明", "退出入口"] },
  { code: "A09", number: 9, groupCode: "G3", title: "公开个人信息", question: "是否会把个人信息公开展示给不特定的人？", help: "例如官网公开联系人、名单、公示信息或公开发布照片。", evidenceExamples: ["公开页面", "单独同意记录", "影响评估"] },
  { code: "A10", number: 10, groupCode: "G3", title: "公共场所图像和身份识别", question: "门店、办公场所等区域是否使用监控、图像采集或身份识别设备？", help: "如存在，应确认必要性、显著提示、使用范围和访问权限。", evidenceExamples: ["现场标识照片", "设备清单", "查看权限记录"] },
  { code: "A11", number: 11, groupCode: "G3", title: "使用已公开的个人信息", question: "是否从互联网或其他公开渠道取得个人信息并用于业务？", help: "需要确认使用范围是否合理，以及是否尊重个人明确拒绝。", evidenceExamples: ["信息来源说明", "采集规则", "拒绝处理记录"] },
  { code: "A12", number: 12, groupCode: "G3", title: "敏感个人信息", question: "身份证件、金融账户、健康、生物识别等敏感信息是否确有必要并得到特别保护？", help: "涉及时应检查必要性、特别告知、单独同意、影响评估和保护措施。", evidenceExamples: ["敏感信息清单", "单独同意", "影响评估"] },
  { code: "A13", number: 13, groupCode: "G3", title: "不满十四周岁未成年人", question: "是否可能处理不满十四周岁未成年人的个人信息？", help: "涉及时需要监护人同意、专门规则和更严格的保护措施。", evidenceExamples: ["年龄判断方式", "监护人同意", "未成年人专门规则"] },
  { code: "A14", number: 14, groupCode: "G3", title: "向境外提供个人信息", question: "信息是否存到境外，或可能被境外总部、管理员、服务商远程查看？", help: "不能只看服务器位置，还要考虑境外人员和系统权限。", evidenceExamples: ["系统部署说明", "境外访问权限", "影响评估"] },
  { code: "A15", number: 15, groupCode: "G4", title: "删除个人信息", question: "达到删除条件后，是否知道应在什么系统和文件中执行删除？", help: "不能立即删除的，应说明保存依据并限制其他用途。", evidenceExamples: ["保存期限清单", "删除记录", "系统设置截图"] },
  { code: "A16", number: 16, groupCode: "G4", title: "个人权利保障机制", question: "个人是否有清楚、方便的渠道提出查询、更正、删除等请求？", help: "B2B联系人、员工和消费者都可能提出个人信息相关请求。", evidenceExamples: ["联系渠道", "请求处理指引", "申请入口"] },
  { code: "A17", number: 17, groupCode: "G4", title: "响应请求和解释规则", question: "收到个人请求后，是否有登记、核验、办理、答复和留痕步骤？", help: "拒绝或不能立即处理时，应能说明理由。", evidenceExamples: ["请求台账", "答复记录", "处理指引"] },
  { code: "A18", number: 18, groupCode: "G5", title: "内部管理制度和操作要求", question: "员工是否知道可以怎样使用个人信息、哪些行为不能做？", help: "小型处理者可以把要求纳入现有管理文件，不必建设复杂制度体系。", evidenceExamples: ["内部管理要求", "岗位职责", "员工承诺"] },
  { code: "A19", number: 19, groupCode: "G5", title: "技术保护措施", question: "账号、权限、备份、日志等措施是否与实际风险相适应？", help: "至少确认谁能查看、离职后怎样关停权限、重要操作是否留痕。", evidenceExamples: ["权限清单", "系统设置截图", "备份或日志记录"] },
  { code: "A20", number: 20, groupCode: "G5", title: "教育培训", question: "接触个人信息的员工是否接受过与岗位相关的提醒或培训？", help: "小型处理者可以采用简短培训、操作提示和确认记录。", evidenceExamples: ["培训材料", "签到或确认记录", "考核结果"] },
  { code: "A21", number: 21, groupCode: "G5", title: "个人信息保护负责人", question: "是否已经明确由谁负责协调个人信息保护工作？", help: "需要有负责人、职责和可用的联系渠道。", evidenceExamples: ["负责人任命或职责", "企业档案", "公开联系渠道"] },
  { code: "A22", number: 22, groupCode: "G6", title: "个人信息保护影响评估", question: "触发影响评估的业务是否已在开展前完成评估并留档？", help: "敏感信息、自动化决策、对外提供、公开、委托处理、境外提供等情况需要重点判断。", evidenceExamples: ["影响评估表", "事实快照", "整改记录"] },
  { code: "A23", number: 23, groupCode: "G6", title: "安全事件应急准备", question: "发生误发、账号被盗或信息泄露时，员工是否知道先做什么、找谁？", help: "应至少有报告渠道、立即止损步骤、影响判断和通知决策。", evidenceExamples: ["应急处置要求", "联系人清单", "演练或培训记录"] },
  { code: "A24", number: 24, groupCode: "G6", title: "安全事件响应处置", question: "如果发生过安全事件，是否及时查明、补救、通知并复盘？", help: "没有发生过事件时，可结合现有响应机制说明情况。", evidenceExamples: ["事件时间线", "补救记录", "通知和复盘材料"] }
];

export type AuditContext = {
  enterprise: EnterpriseProfile;
  activities: ProcessingActivity[];
  documents: BusinessDocument[];
  tasks: TaskItem[];
  assessments: AssessmentRun[];
  pipias: PipiaInstance[];
};

const hasDocument = (context: AuditContext, type: string) => context.documents.some(document => document.type === type);
const anyActivity = (context: AuditContext, predicate: (activity: ProcessingActivity) => boolean) => context.activities.some(predicate);

export function buildAuditSignals(code: string, context: AuditContext): AuditSignal[] {
  const complete = context.activities.filter(activity => activity.completeness === 1).length;
  const incomplete = context.activities.length - complete;
  const signals: AuditSignal[] = [];
  if (["A01", "A15"].includes(code)) {
    signals.push({ tone: complete ? "positive" : "neutral", text: `已记录 ${context.activities.length} 项业务，其中 ${complete} 项完成事实确认。` });
    if (incomplete) signals.push({ tone: "warning", text: `${incomplete} 项业务尚未完整确认，可能影响本项判断。` });
  }
  if (["A02", "A03"].includes(code)) signals.push({ tone: hasDocument(context, "privacy_notice") || hasDocument(context, "b2b_contact_notice") ? "positive" : "warning", text: hasDocument(context, "privacy_notice") || hasDocument(context, "b2b_contact_notice") ? "已建立对外个人信息告知材料。" : "尚未找到对外个人信息处理规则或联系人告知。" });
  if (["A04", "A05", "A07"].includes(code)) signals.push({ tone: "neutral", text: anyActivity(context, activity => activity.facts.recipients.some(item => item !== "不向外部提供")) ? "部分业务记录了外部接收方或服务商，需要进一步区分处理关系。" : "现有业务未明确记录外部接收方，仍需负责人确认。" });
  if (code === "A08") signals.push({ tone: "neutral", text: anyActivity(context, activity => activity.facts.purposes.includes("营销活动")) ? "存在营销用途，但是否属于自动化决策仍需确认。" : "现有业务未记录自动化决策事实。" });
  if (code === "A10") signals.push({ tone: anyActivity(context, activity => activity.facts.systems.includes("门禁或监控")) ? "warning" : "neutral", text: anyActivity(context, activity => activity.facts.systems.includes("门禁或监控")) ? "已有业务使用门禁或监控，需要核对设备和现场提示。" : "现有业务未记录门禁或监控系统。" });
  if (code === "A11") signals.push({ tone: anyActivity(context, activity => activity.facts.collectionChannels.includes("公开渠道")) ? "warning" : "neutral", text: anyActivity(context, activity => activity.facts.collectionChannels.includes("公开渠道")) ? "有业务从公开渠道收集信息。" : "现有业务未记录从公开渠道收集。" });
  if (code === "A12") signals.push({ tone: anyActivity(context, activity => activity.facts.sensitiveInformation !== "no") || context.enterprise.sensitiveCategories.length > 0 ? "warning" : "positive", text: anyActivity(context, activity => activity.facts.sensitiveInformation !== "no") || context.enterprise.sensitiveCategories.length > 0 ? "存在敏感信息或尚未确认的情况。" : "现有已确认业务均填写为不涉及敏感个人信息。" });
  if (code === "A13") signals.push({ tone: anyActivity(context, activity => activity.facts.minorsInvolved !== "no") || context.enterprise.minorsPossible !== "no" ? "warning" : "positive", text: anyActivity(context, activity => activity.facts.minorsInvolved !== "no") || context.enterprise.minorsPossible !== "no" ? "存在未成年人信息或尚未确认的情况。" : "现有档案填写为不涉及不满十四周岁未成年人。" });
  if (code === "A14") signals.push({ tone: anyActivity(context, activity => activity.facts.crossBorderAccess !== "no") || context.enterprise.crossBorder !== "no" ? "warning" : "positive", text: anyActivity(context, activity => activity.facts.crossBorderAccess !== "no") || context.enterprise.crossBorder !== "no" ? "存在境外访问或尚未确认的情况。" : "现有档案填写为不涉及境外存储或访问。" });
  if (["A16", "A17"].includes(code)) signals.push({ tone: hasDocument(context, "rights_guide") ? "positive" : "warning", text: hasDocument(context, "rights_guide") ? "已建立个人信息相关请求处理指引。" : "尚未找到个人信息相关请求处理指引。" });
  if (code === "A18") signals.push({ tone: hasDocument(context, "internal_policy") ? "positive" : "warning", text: hasDocument(context, "internal_policy") ? "已建立个人信息保护内部管理要求。" : "尚未找到内部管理要求。" });
  if (code === "A21") signals.push({ tone: context.enterprise.privacyContactName && context.enterprise.privacyContactChannel ? "positive" : "warning", text: context.enterprise.privacyContactName && context.enterprise.privacyContactChannel ? `企业档案已记录负责人：${context.enterprise.privacyContactName}。` : "负责人姓名或联系渠道尚未完整填写。" });
  if (code === "A22") signals.push({ tone: context.pipias.some(item => item.status === "signed") ? "positive" : "neutral", text: context.pipias.some(item => item.status === "signed") ? `已有 ${context.pipias.filter(item => item.status === "signed").length} 份影响评估完成确认。` : "尚无已确认归档的影响评估。" });
  if (code === "A23") signals.push({ tone: hasDocument(context, "incident_plan") ? "positive" : "warning", text: hasDocument(context, "incident_plan") ? "已建立个人信息安全事件应急处置要求。" : "尚未找到安全事件应急处置要求。" });
  if (!signals.length) signals.push({ tone: "neutral", text: "系统暂无足够记录自动判断，请根据实际情况确认。" });
  return signals;
}
