import type { MaterialAudienceGroup, ProcessingActivity } from "./types";

export const materialAudienceOptions: Array<{
  code: MaterialAudienceGroup;
  name: string;
  description: string;
  external: boolean;
}> = [
  { code: "consumer", name: "消费者和产品用户", description: "注册、会员、订单、客服、营销等面向消费者或普通用户的业务。", external: true },
  { code: "business_contact", name: "客户和合作方联系人", description: "客户、供应商、渠道商及合作伙伴中的自然人联系人。", external: true },
  { code: "employee", name: "员工", description: "入职、薪酬、考勤、绩效、福利和离职管理。", external: true },
  { code: "candidate", name: "候选人", description: "简历投递、招聘筛选、面试、录用和人才库管理。", external: true },
  { code: "visitor", name: "访客和现场人员", description: "访客登记、门禁、公共区域视频及现场安全管理。", external: true },
  { code: "internal", name: "单位内部和合作方", description: "不面向具体个人：内部制度、应急要求、处理协议、业务台账和办理记录，可覆盖全部业务。", external: false }
];

export const materialAudienceName = (code: MaterialAudienceGroup) => materialAudienceOptions.find(item => item.code === code)?.name || "未分类人群";

export function inferMaterialAudienceGroup(type: string): MaterialAudienceGroup {
  if (type === "b2b_contact_notice") return "business_contact";
  if (type === "employee_notice") return "employee";
  if (type === "candidate_notice") return "candidate";
  if (type === "visitor_notice") return "visitor";
  if ([
    "internal_policy", "rights_guide", "incident_plan",
    "processor_agreement", "joint_processing_agreement",
    "processing_register", "vendor_register", "rights_request_register", "consent_record", "incident_record"
  ].includes(type)) return "internal";
  return "consumer";
}

export function classifyActivityAudienceGroups(activity: ProcessingActivity): MaterialAudienceGroup[] {
  if (activity.scenarioCode.includes("HR-EMPLOYEE") || activity.scenarioCode.includes("EMPLOYEE-HR")) return ["employee"];
  if (activity.scenarioCode.includes("HR-RECRUIT") || activity.scenarioCode.includes("RECRUITMENT")) return ["candidate"];
  if (activity.scenarioCode.includes("B2B-CONTACT")) return ["business_contact"];
  if (activity.scenarioCode.includes("CONSUMER-MEMBER") || activity.scenarioCode.includes("MEMBER-SERVICE")) return ["consumer"];
  if (activity.scenarioCode.includes("VISITOR") || activity.scenarioCode.includes("CCTV")) return ["visitor"];

  const subjects = activity.facts.dataSubjects.join("、").toLowerCase();
  const groups = new Set<MaterialAudienceGroup>();
  if (/员工|雇员|在职人员|离职员工/.test(subjects)) groups.add("employee");
  if (/求职|候选人|应聘|招聘对象/.test(subjects)) groups.add("candidate");
  if (/供应商|合作方|合作伙伴|客户联系人|企业联系人|渠道商|商务联系人/.test(subjects)) groups.add("business_contact");
  if (/访客|来访|现场人员|出入人员|监控区域/.test(subjects)) groups.add("visitor");
  if (/消费者|用户|会员|顾客|咨询人|购买人|收货人|订单联系人/.test(subjects)) groups.add("consumer");
  return [...groups];
}

export function activityMatchesAudience(activity: ProcessingActivity, audienceGroup: MaterialAudienceGroup): boolean {
  return audienceGroup === "internal" || classifyActivityAudienceGroups(activity).includes(audienceGroup);
}

export function incompatibleActivities(activities: ProcessingActivity[], audienceGroup: MaterialAudienceGroup): ProcessingActivity[] {
  return activities.filter(activity => !activityMatchesAudience(activity, audienceGroup));
}
