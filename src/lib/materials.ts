import type { EnterpriseProfile, MaterialAudienceGroup, ProcessingActivity } from "./types";
import { sensitiveCategoryLabels } from "./sensitive-info.ts";
import { activityDisplayName } from "./activity-label.ts";
import { externalProcessingRelationshipLabel, normalizedExternalProcessingRelationships } from "./external-processing.ts";
import { assessRetentionRisk } from "./retention-risk.ts";

export type MaterialCategory = "external" | "internal" | "agreement" | "register" | "record";
export type MaterialRequirement = "basic" | "conditional" | "evidence";

export interface MaterialDefinition {
  code: string;
  name: string;
  description: string;
  category: MaterialCategory;
  audienceGroups: MaterialAudienceGroup[];
  defaultAudience: string;
  defaultScope: string;
  defaultModules: string[];
  requirement?: MaterialRequirement;
  trigger?: string;
  legalBasis?: string;
}

export const materialCatalog: MaterialDefinition[] = [
  { code: "privacy_notice", name: "消费者个人信息处理规则", description: "面向消费者和产品用户，说明收集、使用、保存和权利行使安排。", category: "external", audienceGroups: ["consumer"], defaultAudience: "消费者和产品用户", defaultScope: "面向消费者提供产品或服务涉及的个人信息处理活动", defaultModules: ["处理活动", "保存期限", "对外提供", "个人权利", "联系渠道"], requirement: "basic", legalBasis: "《个人信息保护法》第十七条；《网络数据安全管理条例》第二十一条" },
  { code: "b2b_contact_notice", name: "业务联系人个人信息告知", description: "面向客户、供应商和合作方中的自然人联系人。", category: "external", audienceGroups: ["business_contact"], defaultAudience: "客户、供应商及合作方联系人", defaultScope: "客户、供应商及合作方联系业务", defaultModules: ["业务联系", "来源说明", "保存期限", "个人权利"], requirement: "basic", legalBasis: "《个人信息保护法》第十七条" },
  { code: "employee_notice", name: "员工个人信息告知", description: "向员工说明入职、薪酬、考勤、绩效、福利和离职管理中的个人信息处理。", category: "external", audienceGroups: ["employee"], defaultAudience: "员工", defaultScope: "入职、薪酬、考勤、绩效、福利和离职管理", defaultModules: ["员工管理", "敏感信息", "保存期限", "个人权利"], requirement: "basic", legalBasis: "《个人信息保护法》第十七条、第十三条" },
  { code: "candidate_notice", name: "候选人个人信息告知", description: "向候选人说明简历收集、招聘筛选、面试、录用及人才库中的个人信息处理。", category: "external", audienceGroups: ["candidate"], defaultAudience: "候选人和求职者", defaultScope: "简历投递、招聘筛选、面试、录用和人才库管理", defaultModules: ["招聘流程", "信息来源", "人才库", "保存期限", "个人权利"], requirement: "basic", legalBasis: "《个人信息保护法》第十七条" },
  { code: "visitor_notice", name: "访客个人信息告知", description: "向访客说明登记、门禁、公共区域视频和现场安全管理中的个人信息处理。", category: "external", audienceGroups: ["visitor"], defaultAudience: "访客和现场人员", defaultScope: "访客登记、门禁、公共区域视频和现场安全管理", defaultModules: ["访客登记", "门禁与视频", "保存期限", "个人权利"], requirement: "basic", legalBasis: "《个人信息保护法》第十七条、第二十六条" },
  { code: "minor_notice", name: "未成年人个人信息专门处理规则", description: "面向不满十四周岁未成年人及其监护人的专门规则。", category: "external", audienceGroups: ["consumer"], defaultAudience: "不满十四周岁未成年人及其监护人", defaultScope: "涉及不满十四周岁未成年人个人信息的产品或服务", defaultModules: ["监护人同意", "处理必要性", "专门保护措施", "个人权利"], requirement: "conditional", trigger: "业务涉及不满十四周岁未成年人时", legalBasis: "《个人信息保护法》第三十一条；《网络数据安全管理条例》第二十一条" },
  { code: "sensitive_consent", name: "敏感个人信息单独同意书", description: "按法定类别说明敏感个人信息处理的必要性和影响，并在以同意为处理基础时单独取得同意。", category: "external", audienceGroups: ["consumer", "business_contact", "employee", "candidate", "visitor"], defaultAudience: "相关个人", defaultScope: "涉及敏感个人信息的处理活动", defaultModules: ["敏感信息种类", "处理必要性", "权益影响", "保护措施", "单独同意"], requirement: "conditional", trigger: "基于同意处理敏感个人信息时", legalBasis: "《个人信息保护法》第二十八条至第三十条；GB/T 45574—2025 第4章、第5章" },
  { code: "cross_border_notice_consent", name: "个人信息出境告知与单独同意", description: "记录境外接收方、出境目的和权利渠道；以同意为处理基础时取得单独同意。", category: "external", audienceGroups: ["consumer", "business_contact", "employee", "candidate", "visitor"], defaultAudience: "个人信息出境涉及的相关个人", defaultScope: "向境外提供个人信息的业务", defaultModules: ["境外接收方", "出境目的", "信息种类", "保存地点", "权利渠道", "单独同意"], requirement: "conditional", trigger: "向境外提供个人信息时；出境程序豁免不当然免除告知，以同意为处理基础时仍需单独同意", legalBasis: "《个人信息保护法》第三十九条；数据出境相关规定" },
  { code: "incident_notification", name: "个人信息安全事件通知", description: "发生安全事件后向受影响个人说明风险和补救措施。", category: "external", audienceGroups: ["consumer", "business_contact", "employee", "candidate", "visitor"], defaultAudience: "受安全事件影响的个人", defaultScope: "已经或可能造成个人权益危害的个人信息安全事件", defaultModules: ["事件情况", "可能影响", "补救措施", "个人防范建议", "联系渠道"], requirement: "conditional", trigger: "发生或可能发生泄露、篡改、丢失且依法需要通知个人时", legalBasis: "《个人信息保护法》第五十七条；《网络数据安全管理条例》第十一条" },
  { code: "internal_policy", name: "个人信息保护内部管理要求", description: "明确负责人、员工操作边界、权限、保存删除和日常检查要求。", category: "internal", audienceGroups: ["internal"], defaultAudience: "本单位员工及管理人员", defaultScope: "本单位全部个人信息处理活动", defaultModules: ["职责分工", "最小必要", "权限管理", "保存删除", "检查整改"], requirement: "basic", legalBasis: "《个人信息保护法》第五十一条；小型处理者简化措施规定" },
  { code: "rights_guide", name: "个人信息相关请求处理指引", description: "帮助负责人处理查询、更正、删除和撤回同意等请求。", category: "internal", audienceGroups: ["internal"], defaultAudience: "个人信息保护负责人及经办人员", defaultScope: "本单位受理的个人信息权利请求", defaultModules: ["请求登记", "身份核验", "办理步骤", "答复留痕"], requirement: "basic", legalBasis: "《个人信息保护法》第五十条；《网络数据安全管理条例》第二十三条" },
  { code: "incident_plan", name: "个人信息安全事件应急处置要求", description: "发生误发、泄露、账号被盗等情况时使用的轻量处置清单。", category: "internal", audienceGroups: ["internal"], defaultAudience: "负责人、IT及相关经办人员", defaultScope: "本单位个人信息安全事件发现与处置", defaultModules: ["事件报告", "立即止损", "影响判断", "通知与复盘"], requirement: "basic", legalBasis: "《个人信息保护法》第五十一条、第五十七条；《网络数据安全管理条例》第十一条" },
  { code: "processor_agreement", name: "个人信息委托处理协议", description: "与云服务商、SaaS、外包机构等约定处理边界和安全义务。", category: "agreement", audienceGroups: ["internal"], defaultAudience: "受托处理个人信息的服务商", defaultScope: "委托外部单位处理个人信息的业务", defaultModules: ["处理目的", "处理期限", "处理方式", "信息种类", "安全措施", "返还删除", "监督检查"], requirement: "conditional", trigger: "委托外部单位处理个人信息时", legalBasis: "《个人信息保护法》第二十一条；《网络数据安全管理条例》第十二条" },
  { code: "joint_processing_agreement", name: "共同处理个人信息权责约定", description: "两个以上主体共同决定处理目的和方式时约定各自责任。", category: "agreement", audienceGroups: ["internal"], defaultAudience: "共同处理个人信息的合作方", defaultScope: "与其他单位共同决定处理目的和方式的业务", defaultModules: ["共同处理范围", "各方职责", "权利响应", "事件报告", "责任承担"], requirement: "conditional", trigger: "与其他单位共同决定处理目的和处理方式时", legalBasis: "《个人信息保护法》第二十条；《网络数据安全管理条例》第十二条" },
  { code: "processing_register", name: "个人信息处理活动清单", description: "把已确认的业务、信息类型、用途、系统、接收方和保存期限汇总成台账。", category: "register", audienceGroups: ["internal"], defaultAudience: "本单位内部合规档案", defaultScope: "全部已确认业务", defaultModules: ["业务场景", "信息类型", "处理目的", "使用系统", "接收方", "保存期限"], requirement: "evidence", legalBasis: "《个人信息保护法》第五十五条；个人信息保护合规审计要求" },
  { code: "vendor_register", name: "外部服务商、接收方及提供记录", description: "汇总接收方、委托处理和对外提供情况，并形成至少三年的记录。", category: "register", audienceGroups: ["internal"], defaultAudience: "本单位内部合规档案", defaultScope: "全部涉及外部服务商或接收方的业务", defaultModules: ["外部接收方", "使用场景", "处理边界", "合同情况", "保存期限"], requirement: "conditional", trigger: "向其他处理者提供或委托处理个人信息时", legalBasis: "《网络数据安全管理条例》第十二条" },
  { code: "rights_request_register", name: "个人权利请求处理记录", description: "记录请求内容、身份核验、办理过程、答复和完成时间。", category: "record", audienceGroups: ["internal"], defaultAudience: "本单位内部合规档案", defaultScope: "个人提出的查阅、更正、删除、撤回同意等请求", defaultModules: ["请求登记", "身份核验", "办理过程", "答复结果", "证据留存"], requirement: "evidence", legalBasis: "《个人信息保护法》第五十条；《网络数据安全管理条例》第二十三条" },
  { code: "consent_record", name: "单独同意及撤回记录", description: "留存敏感信息、对外提供、出境等单独同意及撤回情况。", category: "record", audienceGroups: ["internal"], defaultAudience: "本单位内部合规档案", defaultScope: "依法需要单独同意的个人信息处理活动", defaultModules: ["同意事项", "告知版本", "同意时间", "取得方式", "撤回记录"], requirement: "conditional", trigger: "处理活动依赖个人同意或单独同意时", legalBasis: "《个人信息保护法》第十四条、第二十三条、第二十九条、第三十九条" },
  { code: "incident_record", name: "个人信息安全事件处置记录", description: "记录事件经过、影响范围、补救措施、通知报告和复盘整改。", category: "record", audienceGroups: ["internal"], defaultAudience: "本单位内部合规档案", defaultScope: "已经或可能发生的个人信息安全事件", defaultModules: ["事件时间线", "影响范围", "止损措施", "通知报告", "复盘整改"], requirement: "conditional", trigger: "发生或可能发生个人信息泄露、篡改、丢失时", legalBasis: "《个人信息保护法》第五十七条；《网络数据安全管理条例》第十一条" }
];

export const materialRequirementName: Record<MaterialRequirement, string> = { basic: "基础材料", conditional: "条件触发", evidence: "留痕材料" };

const join = (values: string[], fallback = "待确认") => values.length ? values.join("、") : fallback;
const yn = (value: string) => value === "yes" ? "涉及" : value === "no" ? "不涉及" : "尚未确认";
const materialActivityName = (activity: ProcessingActivity, external = false) => external ? activity.name : activityDisplayName(activity);

function externalPartySummary(activity: ProcessingActivity, fallback = "待填写合作方名称") {
  const details = String(activity.facts.externalRecipientDetails || "").trim().replace(/[。；;，,\s]+$/g, "");
  if (details) return details;
  const recipients = activity.facts.recipients.filter(item => item !== "不向外部提供");
  return join(recipients, fallback);
}

function activityProcessingMethod(activity: ProcessingActivity) {
  const sources = join(activity.facts.collectionChannels, "双方确认的业务渠道");
  const systems = join(activity.facts.systems, "双方确认的业务系统");
  return `通过${sources}收集或接收，并在${systems}中按约定进行记录、使用、传输、保存和删除`;
}

function publicInformationDescription(activity: ProcessingActivity): string {
  const details = String(activity.facts.informationDetails || "").trim();
  if (details) return details;
  const specificTypes = activity.facts.informationTypes.filter(item => item !== "其他信息");
  return join(specificTypes, "待补充具体个人信息字段或资料名称");
}

function activitySections(activities: ProcessingActivity[], options: { external: boolean; rightsChannelOverride?: string }) {
  return activities.map((activity, index) => {
    const facts = activity.facts;
    const retentionAssessment = assessRetentionRisk(facts.retentionPeriod, facts.retentionBasis || "");
    const retentionBasis = facts.retentionBasis || (retentionAssessment.level === "none" ? "以处理目的完成、业务关系结束和上述期限为判断依据" : "待结合处理目的或适用规定确认");
    const sensitiveLabels = sensitiveCategoryLabels(facts.sensitiveCategories);
    const sensitiveSummary = facts.sensitiveInformation === "yes"
      ? join(sensitiveLabels, facts.minorsInvolved === "yes" ? "不满十四周岁未成年人个人信息" : "类别待负责人确认")
      : yn(facts.sensitiveInformation);
    const common = `### ${index + 1}. ${materialActivityName(activity, options.external)}\n\n- 涉及人员：${join(facts.dataSubjects)}\n- 使用的个人信息：${options.external ? publicInformationDescription(activity) : join(facts.informationTypes)}\n${!options.external && facts.informationDetails ? `- 具体字段或资料：${facts.informationDetails}\n` : ""}- 使用目的：${join(facts.purposes)}\n- 信息来源：${join(facts.collectionChannels)}\n- 处理方式：通过上述渠道收集，并在实现所列目的的必要范围内进行记录、使用、传输、提供、保存和删除\n`;
    const internalOperations = options.external ? "" : `- 场景涉及人数：${facts.approximatePersonCount === null ? "待确认" : `约 ${facts.approximatePersonCount} 人`}\n- 保存或使用位置：${join(facts.systems)}\n- 可访问岗位：${join(facts.accessRoles)}\n- 系统运维方：${join(facts.systemOperators)}\n`;
    return `${common}${internalOperations}- 外部接收方：${join(facts.recipients, "不向外部提供")}\n- 外部处理关系：${normalizedExternalProcessingRelationships(facts).map(externalProcessingRelationshipLabel).join("、") || "不涉及"}\n- 外部单位及处理边界：${facts.externalRecipientDetails || (facts.recipients.includes("不向外部提供") ? "不涉及" : "待补充具体单位、联系渠道和处理边界")}\n- 保存期限或删除条件：${facts.retentionPeriod || "待确认"}\n- 保存期限依据：${retentionBasis}\n- 到期处理方式：${facts.deletionMethod || "待确认"}\n- 个人权利渠道：${options.rightsChannelOverride || facts.rightsChannel || "待确认"}\n- 自动化决策：${yn(facts.automatedDecision)}\n- 敏感个人信息：${sensitiveSummary}\n- 不满十四周岁未成年人：${yn(facts.minorsInvolved)}\n- 境外存储或访问：${yn(facts.crossBorderAccess)}`;
  }).join("\n\n");
}

function header(title: string, enterprise: EnterpriseProfile) {
  return `# ${title}\n\n单位：${enterprise.legalName || "待补充单位名称"}`;
}

export function generateMaterialDraft(input: {
  type: string;
  name: string;
  scope: string;
  audience: string;
  description?: string;
  enterprise: EnterpriseProfile;
  activities: ProcessingActivity[];
}) {
  const { type, name, scope, audience, enterprise, activities } = input;
  const isExternal = materialCatalog.find(item => item.code === type)?.category === "external";
  const publicChannel = enterprise.publicContactChannel || "";
  const contactChannel = isExternal ? publicChannel : (publicChannel || enterprise.privacyContactChannel);
  const contact = [enterprise.publicContactDepartment || "个人信息保护联系部门", contactChannel].filter(Boolean).join("；") || "待补充对外权利请求接收部门及联系渠道";
  const activityText = activitySections(activities, { external: isExternal, rightsChannelOverride: isExternal ? publicChannel : undefined });

  if (type === "processing_register") {
    return `${header(name, enterprise)}\n\n## 一、台账范围\n\n适用范围：${scope}\n\n本清单共汇总 ${activities.length} 项已选择业务。\n\n## 二、处理活动\n\n${activityText}\n\n## 三、维护要求\n\n业务、信息字段、系统、外部接收方或保存期限发生变化时，应及时更新本清单并重新检查相关合规材料。`;
  }

  if (type === "vendor_register") {
    const rows = activities.map((activity, index) => {
      const relationships = normalizedExternalProcessingRelationships(activity.facts).map(externalProcessingRelationshipLabel);
      return `### ${index + 1}. ${activityDisplayName(activity)}\n\n- 外部单位：${externalPartySummary(activity, "未记录外部单位")}\n- 处理关系：${join(relationships, "待确认处理关系")}\n- 处理目的：${join(activity.facts.purposes)}\n- 个人信息范围：${publicInformationDescription(activity)}\n- 涉及系统：${join(activity.facts.systems)}\n- 保存期限或删除条件：${activity.facts.retentionPeriod || "待确认"}\n- 到期处理：${activity.facts.deletionMethod || "待确认"}\n- 境外存储或访问：${yn(activity.facts.crossBorderAccess)}\n- 合同或约定状态：待填写`;
    }).join("\n\n");
    return `${header(name, enterprise)}\n\n## 一、清单范围\n\n适用范围：${scope}\n\n## 二、按业务汇总\n\n${rows || "尚未选择业务。"}\n\n## 三、维护要求\n\n新增、更换服务商或者处理边界发生变化时更新本清单；无法确认外部单位或处理关系时，先转负责人复核。合同或约定状态作为日常更新字段，不影响先如实登记现状。`;
  }

  if (type === "processor_agreement" || type === "joint_processing_agreement") {
    const isJoint = type === "joint_processing_agreement";
    const parties = [...new Set(activities.map(item => externalPartySummary(item)).filter(Boolean))];
    const activityRows = activities.map((activity, index) => {
      const relationships = normalizedExternalProcessingRelationships(activity.facts).map(externalProcessingRelationshipLabel);
      const protection = activity.facts.sensitiveProtectionMeasures || `仅限${join(activity.facts.accessRoles, "约定经办人员")}按业务需要访问，并采取权限控制、必要的传输保护和操作留痕`;
      return `### ${index + 1}. ${activityDisplayName(activity)}\n\n- 合作方及处理边界：${externalPartySummary(activity)}\n- 处理关系：${join(relationships, "待确认处理关系")}\n- 处理目的：${join(activity.facts.purposes)}\n- 处理期限：${activity.facts.retentionPeriod || "待确认"}\n- 处理方式：${activityProcessingMethod(activity)}\n- 个人信息种类：${publicInformationDescription(activity)}\n- 保护措施：${protection}\n- 到期返还、删除或匿名化安排：${activity.facts.deletionMethod || "待确认"}`;
    }).join("\n\n");
    return `${header(name, enterprise)}\n\n甲方：${enterprise.legalName || "待填写"}\n\n乙方或合作方：${join(parties, "待填写合作方名称")}\n\n## 一、约定范围\n\n${scope}。\n\n${activityRows || "待选择适用业务。"}\n\n## 二、${isJoint ? "共同处理安排" : "委托处理要求"}\n\n${isJoint ? "双方仅在上述范围内共同决定处理目的和方式，并按照本约定分工履行个人信息保护义务。" : "乙方仅按甲方书面指示并在上述目的、期限、方式和信息范围内处理个人信息；未经书面确认，不得改变处理目的、方式或者扩大信息范围。"}\n\n## 三、双方权利和义务\n\n${isJoint ? "双方应明确各自负责的告知、同意、个人权利响应、安全事件处置和记录保存职责，并共同保障个人合法权益。" : "乙方应采取约定的保护措施，协助甲方响应个人权利请求和安全事件；甲方有权了解并以适当方式检查乙方履约情况。"}\n\n## 四、分包、提供与出境\n\n未经另一方书面同意，不得转委托、向其他单位提供个人信息或者安排境外存储和访问。确有需要的，应在实施前补充约定并完成适用程序。\n\n## 五、返还、删除和证明\n\n约定终止或处理目的完成后，应按上述安排返还、删除或匿名化个人信息，并提供完成证明；依法必须保存的，仅限存储和必要安全保护。\n\n## 六、安全事件\n\n发现或者可能发生泄露、篡改、丢失时，应立即通知另一方，采取止损和补救措施，保留处置记录，并配合依法通知个人和报告有关部门。\n\n## 七、生效与签署\n\n生效日期、有效期、违约责任、争议解决和签署信息由双方在签署时确认。本约定经双方签署后生效。`;
  }

  if (type === "rights_request_register") {
    return `${header(name, enterprise)}\n\n## 使用说明\n\n本记录用于留存个人信息权利请求的受理和处理情况。统一受理渠道：${contact}。每项请求单独复制一份记录。\n\n## 请求登记\n\n- 请求编号：待填写\n- 收到时间：待填写\n- 请求人及联系方式：待填写\n- 请求类型：查阅 / 复制 / 转移 / 更正 / 补充 / 删除 / 撤回同意 / 注销账号 / 限制处理 / 解释处理规则 / 其他\n- 涉及业务：待填写\n\n## 身份核验\n\n- 核验方式及必要性：待填写\n- 核验结果：待填写\n- 是否避免收集无关证明材料：待确认\n\n## 办理过程\n\n- 涉及系统、文件和经办人员：待填写\n- 采取的处理措施：待填写\n- 无法办理或延期原因及依据：待填写\n\n## 答复与完成\n\n- 答复时间和方式：待填写\n- 答复内容：待填写\n- 完成人及完成时间：待填写\n- 证据保存位置：待填写`;
  }

  if (type === "consent_record") {
    return `${header(name, enterprise)}\n\n## 使用说明\n\n本记录用于证明个人在充分知情的前提下作出的同意、单独同意及后续撤回情况。不得以本记录代替实际告知。\n\n## 适用业务\n\n${activities.map(item => `- ${item.name}：${join(item.facts.informationTypes)}；处理目的：${join(item.facts.purposes)}`).join("\n") || "- 待选择业务"}\n\n## 单次记录字段\n\n- 记录编号：待填写\n- 相关个人或可验证的匿名标识：待填写\n- 同意事项：待填写\n- 对应告知材料名称和版本：待填写\n- 同意取得时间：待填写\n- 取得方式及操作证据：待填写\n- 是否属于单独同意：待填写\n- 经办系统或人员：待填写\n- 撤回时间、方式和后续处理：待填写\n\n## 维护要求\n\n处理目的、方式、信息种类或保存期限发生变化时，应重新判断是否需要取得同意，并关联新的告知版本和同意记录。`;
  }

  if (type === "incident_record") {
    return `${header(name, enterprise)}\n\n## 一、事件基本信息\n\n- 事件编号：待填写\n- 发现时间、发现人和报告时间：待填写\n- 事件类型和经过：待填写\n- 涉及业务、系统和外部服务商：待填写\n\n## 二、影响范围\n\n- 涉及个人范围和人数：待填写\n- 涉及个人信息种类：待填写\n- 可能造成的危害：待填写\n\n## 三、止损和补救\n\n- 已采取的紧急措施：待填写\n- 证据和日志保存位置：待填写\n- 风险是否已经控制：待填写\n\n## 四、通知和报告\n\n- 是否通知相关个人、通知时间和方式：待填写\n- 未通知个人的理由：待填写\n- 是否报告有关部门、报告时间和回执：待填写\n- 是否涉嫌犯罪并报案：待填写\n\n## 五、复盘整改\n\n- 事件原因：待填写\n- 整改措施、负责人和完成时间：待填写\n- 相关制度、权限、系统或材料更新情况：待填写`;
  }

  if (type === "minor_notice") {
    const minorDetails = activities.map(item => `### ${materialActivityName(item, true)}\n\n- 处理必要性：${item.facts.sensitiveNecessity || "待结合实际业务补充"}\n- 对个人权益的影响：${item.facts.sensitiveRightsImpact || "待补充"}\n- 专门保护措施：${item.facts.sensitiveProtectionMeasures || "待补充"}\n- 未成年人个人信息保护负责人：由本单位根据适用法律和实际处理方式指定负责人或明确承担该职责的岗位`).join("\n\n");
    const automatedMinorActivities = activities.filter(item => item.facts.automatedDecision === "yes");
    const automatedMinorText = automatedMinorActivities.length
      ? `以下业务涉及自动化决策：${automatedMinorActivities.map(item => materialActivityName(item, true)).join("、")}。我们将以适合未成年人理解的方式说明基本原理、主要影响和可选择的非个性化方式，不利用自动化决策诱导沉迷或作出对未成年人权益有重大影响的不公平决定；监护人可以要求说明，并拒绝仅通过自动化决策作出对未成年人权益有重大影响的决定。`
      : "当前已确认业务不涉及面向不满十四周岁未成年人的自动化决策。";
    return `${header(name, enterprise)}\n\n版本号：待填写\n\n生效日期：待填写\n\n## 一、适用对象\n\n本规则适用于${audience}，覆盖范围为${scope}。\n\n## 二、我们处理的信息\n\n${activityText}\n\n## 三、处理必要性、影响和专门保护\n\n${minorDetails || "待选择涉及未成年人的业务。"}\n\n我们将限制访问人员和使用范围，不将相关信息用于无关目的；发现年龄信息或监护关系存在疑问时，暂停相关处理并核实。\n\n## 四、监护人身份核验与同意\n\n处理不满十四周岁未成年人个人信息前，我们将以清晰易懂的方式向监护人说明处理目的、方式、信息种类、保存期限和可能影响，并取得监护人同意。我们仅收集核验监护身份和关系所必需的信息；核验方式、证据保存范围和有效期应与风险相适应，不以核验为由额外收集无关信息。无法合理确认监护关系时，不启动相关处理。\n\n## 五、同意的更新、撤回和到期处理\n\n处理目的、方式、信息种类发生变化时，我们将重新告知并在需要时重新取得监护人同意。监护人撤回同意后，我们将停止以该同意为基础的处理，并按适用规则删除或匿名化相关信息；法律、行政法规规定应当保存的，仅在规定期限和目的内保存。\n\n## 六、自动化决策和个性化推荐\n\n${automatedMinorText}\n\n## 七、安全保护与事件处置\n\n我们将根据业务风险采取访问权限、身份鉴别、传输和存储保护、操作留痕、人员管理及定期检查等措施。发生或可能发生泄露、篡改、丢失时，我们将立即采取补救措施，并依法履行通知和报告义务。\n\n## 八、权利和联系\n\n未成年人及其监护人可以提出查阅、复制、更正、补充、删除、限制处理、撤回同意或解释处理规则等请求；在符合法定条件时，可以请求将个人信息转移至指定的个人信息处理者；如相关产品或服务提供账号，也可以申请注销账号。为保护未成年人信息，我们可能进行必要且适度的身份核验。联系渠道：${contact}。\n\n## 九、规则更新\n\n规则发生实质变化时，我们将通过适用的产品或服务界面提示更新内容；依法需要重新取得监护人同意的，在取得同意前不按更新后的内容处理。`;
  }

  if (type === "sensitive_consent") {
    return `${header(name, enterprise)}\n\n## 一、需要单独确认的处理\n\n适用对象：${audience}。适用范围：${scope}。\n\n${activities.map(item => `### ${item.name}\n\n- 敏感个人信息：${join(sensitiveCategoryLabels(item.facts.sensitiveCategories), item.facts.minorsInvolved === "yes" ? "不满十四周岁未成年人个人信息" : "类别待负责人确认")}\n- 处理目的：${join(item.facts.purposes)}\n- 处理方式：${activityProcessingMethod(item)}\n- 保存期限：${item.facts.retentionPeriod || "待确认"}\n- 处理必要性：${item.facts.sensitiveNecessity || "待结合实际业务补充"}\n- 对个人权益的影响：${item.facts.sensitiveRightsImpact || "待补充"}\n- 保护措施：${item.facts.sensitiveProtectionMeasures || "待补充"}`).join("\n\n")}\n\n## 二、单独同意\n\n本人已经阅读并理解上述敏感个人信息处理事项，并针对该特定处理自愿、明确作出单独同意。\n\n个人确认：__________  日期：__________\n\n## 三、撤回方式\n\n可以通过${contact}撤回同意。撤回不影响撤回前已经开展的合法处理。`;
  }

  if (type === "cross_border_notice_consent") {
    const outboundRows = activities.map(item => {
      const sensitiveDetails = item.facts.sensitiveInformation === "yes"
        ? `\n- 敏感个人信息处理必要性：${item.facts.sensitiveNecessity || "待补充"}\n- 对个人权益的影响：${item.facts.sensitiveRightsImpact || "待补充"}\n- 保护措施：${item.facts.sensitiveProtectionMeasures || "待补充"}`
        : "";
      return `### ${materialActivityName(item, true)}\n\n- 境外接收方及联系方式：${externalPartySummary(item, "待补充境外接收方及联系方式")}\n- 出境目的：${join(item.facts.purposes)}\n- 处理方式：通过${join(item.facts.collectionChannels, "业务渠道")}收集后，向上述境外接收方提供或开放必要访问\n- 个人信息种类：${publicInformationDescription(item)}\n- 保存期限：${item.facts.retentionPeriod || "待确认"}\n- 向境外接收方行使权利的方式：可以按上述接收方联系方式提出，或通过${contact}，由本单位协助处理${sensitiveDetails}`;
    }).join("\n\n");
    return `${header(name, enterprise)}\n\n## 一、出境处理范围\n\n适用对象：${audience}。适用范围：${scope}。\n\n${outboundRows || "待选择出境业务。"}\n\n## 二、单独同意\n\n本处理活动以个人同意为处理基础时，本人已经了解上述个人信息出境事项，并自愿、明确作出单独同意。\n\n个人确认：__________  日期：__________\n\n## 三、联系和撤回\n\n联系渠道：${contact}。出境程序豁免不当然免除告知义务；是否需要单独同意，应结合具体处理基础核对。`;
  }

  if (type === "incident_notification") {
    return `${header(name, enterprise)}\n\n致：${audience}\n\n我们发现发生或者可能发生个人信息安全事件，现将有关情况通知如下。\n\n## 一、事件情况\n\n发生时间、原因和涉及范围：待核实后填写。\n\n## 二、可能造成的影响\n\n涉及的个人信息种类、可能风险和影响：待核实后填写。\n\n## 三、已经采取的补救措施\n\n止损、账号或权限处置、系统修复和风险控制情况：待填写。\n\n## 四、您可以采取的措施\n\n建议根据实际风险更换密码、警惕异常联系或采取其他必要措施。请勿填写与本次事件无关的泛化建议。\n\n## 五、联系我们\n\n如需了解情况或行使个人信息权利，请联系：${contact}。`;
  }

  if (type === "internal_policy") {
    return `${header(name, enterprise)}\n\n## 一、适用范围\n\n${scope}。适用对象：${audience}。\n\n## 二、职责分工\n\n个人信息保护联系人负责维护业务清单、合规材料、个人请求和事件记录。联系渠道：${contact}。各业务经办人员只在职责所需范围内使用个人信息。\n\n## 三、日常处理要求\n\n1. 只收集完成具体业务所必需的信息，不得擅自增加字段或改作其他用途。\n2. 新增业务、系统、外部服务商或信息类型前，先更新业务情况并完成初步检查。\n3. 按岗位分配访问权限，员工离职或职责变化时及时调整权限。\n4. 达到保存期限或处理目的完成后，按实际系统能力删除或匿名化；依法必须保存的，应限制其他用途。\n5. 对外提供、处理敏感个人信息、涉及未成年人或境外访问时，转负责人确认。\n\n## 四、当前业务范围\n\n${activityText}\n\n## 五、检查与留痕\n\n定期确认业务事实是否变化，保存声明版本、评估结论、整改任务、培训和事件处置记录。发现事实与材料不一致时，应先更新事实，再修订并发布新版本。`;
  }

  if (type === "rights_guide") {
    return `${header(name, enterprise)}\n\n## 一、适用对象\n\n${audience}。\n\n## 二、受理范围\n\n受理个人提出的查阅、复制、转移、更正、补充、删除、限制处理、撤回同意、注销账号（如适用）和解释处理规则等请求。个人信息转移请求仅在符合法定条件时办理。统一联系渠道：${contact}。\n\n## 三、办理步骤\n\n1. 登记请求时间、请求类型、涉及业务和必要联系信息。\n2. 只进行完成本次请求所必需的身份核验，避免额外收集材料。\n3. 根据业务清单定位相关系统、文件和经办人员。\n4. 执行查询、更正、删除或其他处理；不能立即办理的，记录原因和依据。\n5. 向申请人答复处理结果，并保存办理人员、时间、结果和证明。\n\n## 四、当前可能涉及的业务\n\n${activities.map(item => `- ${item.name}：${join(item.facts.systems)}`).join("\n") || "- 尚未选择业务"}\n\n## 五、升级情形\n\n身份存在争议、请求范围过大、涉及他人权益、依法不能删除或可能发生安全事件时，转负责人或专业人员处理。`;
  }

  if (type === "incident_plan") {
    return `${header(name, enterprise)}\n\n## 一、适用范围\n\n适用于误发文件、账号被盗、设备遗失、越权查看、系统攻击、个人信息泄露或丢失等情况。\n\n## 二、报告方式\n\n发现人应立即联系：${contact}，并记录发现时间、事件经过、涉及业务和已经采取的措施。\n\n## 三、立即处置\n\n1. 停止错误发送、共享或公开，必要时冻结账号、撤回文件、断开接口。\n2. 保存日志、邮件、截图等证据，不随意删除现场记录。\n3. 确认涉及的信息类型、人员范围、系统和外部接收方。\n4. 评估可能造成的影响，并采取补救措施。\n5. 由负责人判断是否需要通知相关个人或报告有关部门。\n\n## 四、当前重点系统\n\n${activities.map(item => `- ${item.name}：${join(item.facts.systems)}`).join("\n") || "- 尚未选择业务"}\n\n## 五、复盘归档\n\n事件结束后形成时间线、原因、影响、处置、通知、整改和责任人记录，并更新相关业务事实、权限和材料。`;
  }

  const employeeSpecific = type === "employee_notice";
  const candidateSpecific = type === "candidate_notice";
  const b2bSpecific = type === "b2b_contact_notice";
  const visitorSpecific = type === "visitor_notice";
  const titleIntro = employeeSpecific
    ? "本单位在建立和履行劳动关系、薪酬福利、考勤、绩效、培训及日常管理所需范围内处理员工个人信息。"
    : candidateSpecific
      ? "本单位在简历收集、候选人筛选、面试、背景核验、录用及经授权的人才库管理所需范围内处理候选人个人信息。"
      : b2bSpecific
        ? "本单位在项目沟通、合同履行、供应商管理和日常业务联系所需范围内处理客户、供应商及合作方联系人的个人信息。信息可能由您本人提供，也可能由您所在单位提供。"
        : visitorSpecific
          ? "本单位在访客预约和登记、门禁通行、公共区域视频及现场安全管理所需范围内处理访客个人信息。"
          : "本单位在向消费者提供产品或服务、履行合同及依法履行义务所需范围内处理个人信息。";

  const sensitiveActivities = activities.filter(item => item.facts.sensitiveInformation === "yes");
  const minorActivities = activities.filter(item => item.facts.minorsInvolved === "yes");
  const crossBorderActivities = activities.filter(item => item.facts.crossBorderAccess === "yes");
  const recipientRows = activities.filter(item => item.facts.recipients.some(recipient => recipient !== "不向外部提供")).map(item => {
    const relationships = normalizedExternalProcessingRelationships(item.facts).map(externalProcessingRelationshipLabel);
    return `- ${materialActivityName(item, true)}：关系类型为${join(relationships, "待确认处理关系")}；外部单位和联系渠道：${externalPartySummary(item, "待补充")}；处理目的：${join(item.facts.purposes)}；涉及信息：${join(item.facts.informationTypes)}。`;
  });
  const sensitiveDisclosure = sensitiveActivities.map(item => {
    const categories = join(sensitiveCategoryLabels(item.facts.sensitiveCategories), item.facts.minorsInvolved === "yes" ? "不满十四周岁未成年人个人信息" : "待确认具体敏感类别");
    return `### ${materialActivityName(item, true)}\n\n- 敏感个人信息种类：${categories}\n- 处理必要性：${item.facts.sensitiveNecessity || "待结合实际业务补充"}\n- 对个人权益的影响：${item.facts.sensitiveRightsImpact || "待补充"}\n- 保护措施：${item.facts.sensitiveProtectionMeasures || "待补充"}`;
  }).join("\n\n");
  const riskyRetentionActivities = activities.filter(item => assessRetentionRisk(item.facts.retentionPeriod, item.facts.retentionBasis || "").level !== "none" || /没有|尚未|暂无|未建立|不删除|永久/.test(item.facts.deletionMethod || ""));

  const automatedActivities = activities.filter(item => item.facts.automatedDecision === "yes");
  const automatedDecisionText = automatedActivities.length
    ? `以下业务涉及自动化决策：${automatedActivities.map(item => materialActivityName(item, true)).join("、")}。我们将保证决策透明度和结果公平、公正，不对个人在交易价格等交易条件上实行不合理的差别待遇。通过自动化决策进行信息推送或商业营销时，我们将同时提供非针对个人特征的选项或者便捷的拒绝方式；对个人权益有重大影响的决定，个人有权要求说明，并有权拒绝仅通过自动化决策作出决定。具体功能入口和说明方式应在相应产品界面中明确。`
    : "当前已确认业务不涉及自动化决策。";

  return `${header(name, enterprise)}\n\n版本号：待填写\n\n生效日期：待填写\n\n## 一、适用对象和范围\n\n适用对象：${audience}。\n\n适用范围：${scope}。\n\n${titleIntro}\n\n## 二、我们怎样处理个人信息\n\n${activityText}\n\n我们仅在实现所列目的所必需的范围内处理个人信息。具体处理所依据的同意、合同履行、劳动人事管理、法定义务或其他适用情形，由负责人结合各项业务实际核对；需要取得同意或单独同意的，将在处理前依法完成。\n\n## 三、敏感个人信息\n\n${sensitiveActivities.length ? sensitiveDisclosure : "当前已确认业务不涉及敏感个人信息。业务情况发生变化时，我们将重新核对并更新本材料。"}\n\n## 四、不满十四周岁未成年人个人信息\n\n${minorActivities.length ? `以下业务涉及不满十四周岁未成年人个人信息：${minorActivities.map(item => materialActivityName(item, true)).join("、")}。本材料不能代替专门的未成年人个人信息处理规则；在取得监护人同意并发布专门规则前，不应启动相关处理。` : "当前已确认业务不涉及不满十四周岁未成年人个人信息。如业务可能面向此类人员，将在处理前制定专门规则并取得监护人同意。"}\n\n## 五、自动化决策\n\n${automatedDecisionText}\n\n## 六、外部处理关系\n\n${recipientRows.length ? recipientRows.join("\n") : "当前已确认业务未记录向外部单位提供个人信息。"}\n\n委托处理时，受托方仅按本单位指示处理；向其他个人信息处理者提供时，应另行说明接收方名称和联系方式、处理目的、处理方式、个人信息种类及权利行使方式；共同处理和依法报送分别按其实际法律关系办理。\n\n## 七、向境外提供个人信息\n\n${crossBorderActivities.length ? `以下业务存在境外存储或访问：${crossBorderActivities.map(item => materialActivityName(item, true)).join("、")}。正式开展前还需逐项确认境外接收方、联系方式、处理目的和方式、信息种类、保存地点以及权利行使渠道，并完成适用的告知、单独同意和其他程序。` : "当前已确认业务不涉及向境外提供个人信息或境外访问。"}\n\n## 八、保存和删除\n\n${riskyRetentionActivities.length ? `当前登记的以下业务存在保存期限或删除机制待整改事项：${riskyRetentionActivities.map(item => materialActivityName(item, true)).join("、")}。本段仅记录当前实际情况，不构成已经满足最短必要期限要求的承诺；完成整改并更新业务记录前，本材料只能归档现状，不能作为合规有效版本发布。` : "我们按照各业务记录的保存期限或删除条件处理个人信息。处理目的完成、保存期限届满或不再需要时，将依法删除、匿名化或限制其他用途。"}\n\n## 九、安全保护与事件处置\n\n我们将根据个人信息种类、处理规模和风险采取与之相适应的访问权限、身份鉴别、传输和存储保护、操作留痕、人员管理、备份恢复及定期检查措施。发生或可能发生个人信息泄露、篡改、丢失时，我们将立即采取补救措施，并依法履行通知个人和报告有关部门的义务。\n\n## 十、您的权利\n\n您可以就与您相关的个人信息提出查阅、复制、更正、补充、删除、限制处理、撤回同意或解释处理规则等请求；在符合法定条件时，可以请求将个人信息转移至指定的个人信息处理者；如相关产品或服务提供账号，也可以申请注销账号。为保护信息安全，我们可能进行必要且适度的身份核验。撤回同意不影响撤回前基于同意已开展处理的效力。\n\n## 十一、如何联系我们\n\n个人信息权利请求接收部门及联系渠道：${contact}。\n\n## 十二、材料更新\n\n业务、信息类型、处理方式、系统、接收方或保存期限发生变化时，我们将重新检查本材料。发生实质变化时，我们将通过适用的产品或服务界面提示更新内容；依法需要重新取得同意的，在取得同意前不按更新后的内容处理。`;
}

export function materialTypeName(code: string) {
  return materialCatalog.find(item => item.code === code)?.name || "合规材料";
}
