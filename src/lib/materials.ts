import type { EnterpriseProfile, ProcessingActivity } from "./types";

export type MaterialCategory = "external" | "internal" | "register";

export interface MaterialDefinition {
  code: string;
  name: string;
  description: string;
  category: MaterialCategory;
  defaultAudience: string;
  defaultModules: string[];
}

export const materialCatalog: MaterialDefinition[] = [
  { code: "privacy_notice", name: "个人信息处理规则", description: "对外说明收集什么、为什么使用、保存多久，以及个人如何行使权利。", category: "external", defaultAudience: "相关个人", defaultModules: ["处理活动", "保存期限", "对外提供", "个人权利", "联系渠道"] },
  { code: "b2b_contact_notice", name: "业务联系人个人信息告知", description: "适合仅处理少量客户、供应商和合作方联系人信息的 B2B 企业。", category: "external", defaultAudience: "客户、供应商及合作方联系人", defaultModules: ["业务联系", "来源说明", "保存期限", "个人权利"] },
  { code: "employee_notice", name: "员工个人信息告知", description: "向员工说明招聘、入职、薪酬、考勤和日常管理中的个人信息处理。", category: "external", defaultAudience: "员工和求职者", defaultModules: ["员工管理", "敏感信息", "保存期限", "个人权利"] },
  { code: "internal_policy", name: "个人信息保护内部管理要求", description: "明确负责人、员工操作边界、权限、保存删除和日常检查要求。", category: "internal", defaultAudience: "本单位员工及管理人员", defaultModules: ["职责分工", "最小必要", "权限管理", "保存删除", "检查整改"] },
  { code: "rights_guide", name: "个人信息相关请求处理指引", description: "帮助负责人处理查询、更正、删除和撤回同意等请求。", category: "internal", defaultAudience: "个人信息保护负责人及经办人员", defaultModules: ["请求登记", "身份核验", "办理步骤", "答复留痕"] },
  { code: "incident_plan", name: "个人信息安全事件应急处置要求", description: "发生误发、泄露、账号被盗等情况时使用的处置清单。", category: "internal", defaultAudience: "负责人、IT及相关经办人员", defaultModules: ["事件报告", "立即止损", "影响判断", "通知与复盘"] },
  { code: "processing_register", name: "个人信息处理活动清单", description: "把已确认的业务、信息类型、用途、系统、接收方和保存期限汇总成台账。", category: "register", defaultAudience: "本单位内部合规档案", defaultModules: ["业务场景", "信息类型", "处理目的", "使用系统", "接收方", "保存期限"] },
  { code: "vendor_register", name: "外部服务商及接收方清单", description: "汇总云服务商、合作方和其他可能接收个人信息的单位。", category: "register", defaultAudience: "本单位内部合规档案", defaultModules: ["外部接收方", "使用场景", "待确认事项"] }
];

const join = (values: string[], fallback = "待确认") => values.length ? values.join("、") : fallback;
const yn = (value: string) => value === "yes" ? "涉及" : value === "no" ? "不涉及" : "尚未确认";

function activitySections(activities: ProcessingActivity[]) {
  return activities.map((activity, index) => {
    const facts = activity.facts;
    return `### ${index + 1}. ${activity.name}\n\n- 涉及人员：${join(facts.dataSubjects)}\n- 场景涉及人数：${facts.approximatePersonCount === null ? "待确认" : `约 ${facts.approximatePersonCount} 人`}\n- 使用的个人信息：${join(facts.informationTypes)}\n- 使用目的：${join(facts.purposes)}\n- 信息来源：${join(facts.collectionChannels)}\n- 保存或使用位置：${join(facts.systems)}\n- 可访问岗位：${join(facts.accessRoles)}\n- 系统运维方：${join(facts.systemOperators)}\n- 外部接收方：${join(facts.recipients, "不向外部提供") }\n- 保存期限或删除条件：${facts.retentionPeriod || "待确认"}\n- 到期处理方式：${facts.deletionMethod || "待确认"}\n- 个人权利渠道：${facts.rightsChannel || "待确认"}\n- 自动化决策：${yn(facts.automatedDecision)}\n- 敏感个人信息：${yn(facts.sensitiveInformation)}\n- 不满十四周岁未成年人：${yn(facts.minorsInvolved)}\n- 境外存储或访问：${yn(facts.crossBorderAccess)}`;
  }).join("\n\n");
}

function header(title: string, enterprise: EnterpriseProfile) {
  return `# ${title}\n\n单位：${enterprise.legalName || "待补充单位名称"}\n\n> 本材料由系统根据已确认的企业档案和业务情况生成。发布或签署前，请由负责人核对事实和文字。`;
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
  const contact = enterprise.privacyContactChannel || "待补充联系渠道";
  const activityText = activitySections(activities);

  if (type === "processing_register") {
    return `${header(name, enterprise)}\n\n## 一、台账范围\n\n适用范围：${scope}\n\n本清单共汇总 ${activities.length} 项已选择业务。\n\n## 二、处理活动\n\n${activityText}\n\n## 三、维护要求\n\n业务、信息字段、系统、外部接收方或保存期限发生变化时，应及时更新本清单并重新检查相关合规材料。`;
  }

  if (type === "vendor_register") {
    const rows = activities.map((activity, index) => `${index + 1}. ${activity.name}：${join(activity.facts.recipients, "未记录外部接收方")}；涉及系统：${join(activity.facts.systems)}`).join("\n");
    return `${header(name, enterprise)}\n\n## 一、清单范围\n\n适用范围：${scope}\n\n## 二、按业务汇总\n\n${rows || "尚未选择业务。"}\n\n## 三、逐家确认事项\n\n对每个外部服务商或接收方，应补充确认其单位名称、处理目的、信息范围、处理方式、安全措施、保存期限、删除安排以及是否存在境外访问。\n\n## 四、维护要求\n\n新增或更换服务商前更新本清单；无法确认接收方或处理边界时，先转负责人复核。`;
  }

  if (type === "internal_policy") {
    return `${header(name, enterprise)}\n\n## 一、适用范围\n\n${scope}。适用对象：${audience}。\n\n## 二、职责分工\n\n个人信息保护联系人负责维护业务清单、合规材料、个人请求和事件记录。联系渠道：${contact}。各业务经办人员只在职责所需范围内使用个人信息。\n\n## 三、日常处理要求\n\n1. 只收集完成具体业务所必需的信息，不得擅自增加字段或改作其他用途。\n2. 新增业务、系统、外部服务商或信息类型前，先更新业务情况并完成初步检查。\n3. 按岗位分配访问权限，员工离职或职责变化时及时调整权限。\n4. 达到保存期限或处理目的完成后，按实际系统能力删除或匿名化；依法必须保存的，应限制其他用途。\n5. 对外提供、处理敏感个人信息、涉及未成年人或境外访问时，转负责人确认。\n\n## 四、当前业务范围\n\n${activityText}\n\n## 五、检查与留痕\n\n定期确认业务事实是否变化，保存声明版本、评估结论、整改任务、培训和事件处置记录。发现事实与材料不一致时，应先更新事实，再修订并发布新版本。`;
  }

  if (type === "rights_guide") {
    return `${header(name, enterprise)}\n\n## 一、适用对象\n\n${audience}。\n\n## 二、受理范围\n\n受理个人提出的查阅、复制、更正、补充、删除、撤回同意、解释处理规则等请求。统一联系渠道：${contact}。\n\n## 三、办理步骤\n\n1. 登记请求时间、请求类型、涉及业务和必要联系信息。\n2. 只进行完成本次请求所必需的身份核验，避免额外收集材料。\n3. 根据业务清单定位相关系统、文件和经办人员。\n4. 执行查询、更正、删除或其他处理；不能立即办理的，记录原因和依据。\n5. 向申请人答复处理结果，并保存办理人员、时间、结果和证明。\n\n## 四、当前可能涉及的业务\n\n${activities.map(item => `- ${item.name}：${join(item.facts.systems)}`).join("\n") || "- 尚未选择业务"}\n\n## 五、升级情形\n\n身份存在争议、请求范围过大、涉及他人权益、依法不能删除或可能发生安全事件时，转负责人或专业人员处理。`;
  }

  if (type === "incident_plan") {
    return `${header(name, enterprise)}\n\n## 一、适用范围\n\n适用于误发文件、账号被盗、设备遗失、越权查看、系统攻击、个人信息泄露或丢失等情况。\n\n## 二、报告方式\n\n发现人应立即联系：${contact}，并记录发现时间、事件经过、涉及业务和已经采取的措施。\n\n## 三、立即处置\n\n1. 停止错误发送、共享或公开，必要时冻结账号、撤回文件、断开接口。\n2. 保存日志、邮件、截图等证据，不随意删除现场记录。\n3. 确认涉及的信息类型、人员范围、系统和外部接收方。\n4. 评估可能造成的影响，并采取补救措施。\n5. 由负责人判断是否需要通知相关个人或报告有关部门。\n\n## 四、当前重点系统\n\n${activities.map(item => `- ${item.name}：${join(item.facts.systems)}`).join("\n") || "- 尚未选择业务"}\n\n## 五、复盘归档\n\n事件结束后形成时间线、原因、影响、处置、通知、整改和责任人记录，并更新相关业务事实、权限和材料。`;
  }

  const employeeSpecific = type === "employee_notice";
  const b2bSpecific = type === "b2b_contact_notice";
  const titleIntro = employeeSpecific
    ? "本单位在招聘、建立和履行劳动关系、薪酬福利、考勤及日常管理所需范围内处理员工和求职者个人信息。"
    : b2bSpecific
      ? "本单位在项目沟通、合同履行、供应商管理和日常业务联系所需范围内处理客户、供应商及合作方联系人的个人信息。信息可能由您本人提供，也可能由您所在单位提供。"
      : "本单位在提供产品或服务、履行合同、内部管理及依法履行义务所需范围内处理个人信息。";

  return `${header(name, enterprise)}\n\n## 一、适用对象和范围\n\n适用对象：${audience}。\n\n适用范围：${scope}。\n\n${titleIntro}\n\n## 二、我们怎样使用个人信息\n\n${activityText}\n\n## 三、敏感个人信息和未成年人信息\n\n如具体业务涉及敏感个人信息或不满十四周岁未成年人个人信息，我们将按实际场景补充说明必要性、可能影响和保护措施，并依法完成相应确认程序。未实际涉及的，不会仅因本材料而扩大收集范围。\n\n## 四、委托处理和向其他单位提供\n\n我们仅在业务所需范围内使用必要的服务商或接收方，并结合上述业务逐项确认处理目的、信息范围和安全责任。实际情况与本材料不一致时，以完成核实和更新后的正式版本为准。\n\n## 五、保存和删除\n\n我们按照各业务记录的保存期限或删除条件处理个人信息。处理目的完成、保存期限届满或不再需要时，将依法删除、匿名化或限制其他用途。\n\n## 六、您的权利\n\n您可以就与您相关的个人信息提出查阅、复制、更正、补充、删除、撤回同意或解释处理规则等请求。为保护信息安全，我们可能进行必要的身份核验。\n\n## 七、如何联系我们\n\n如有问题或需要提出个人信息相关请求，请通过以下方式联系：${contact}。\n\n## 八、材料更新\n\n业务、信息类型、系统、接收方或保存期限发生变化时，我们将重新检查本材料，并通过新版本记录修改和发布情况。`;
}

export function materialTypeName(code: string) {
  return materialCatalog.find(item => item.code === code)?.name || "合规材料";
}
