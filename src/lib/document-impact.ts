import type { ActivityFacts, EnterpriseProfile } from "./types";

const factLabels: Record<keyof ActivityFacts, string> = {
  dataSubjects: "涉及人员",
  informationTypes: "个人信息种类",
  purposes: "处理目的",
  collectionChannels: "收集方式和来源",
  systems: "使用系统和保存位置",
  recipients: "外部服务商或接收方",
  approximatePersonCount: "涉及人数",
  accessRoles: "访问岗位",
  systemOperators: "系统运维方",
  retentionPeriod: "保存期限",
  deletionMethod: "删除方式",
  rightsChannel: "个人权利渠道",
  automatedDecision: "自动化决策",
  sensitiveInformation: "敏感个人信息",
  minorsInvolved: "不满十四周岁未成年人",
  crossBorderAccess: "境外存储或访问",
  notes: "业务补充说明",
  confirmedAt: "事实确认时间"
};

const sectionMap: Partial<Record<keyof ActivityFacts, string[]>> = {
  dataSubjects: ["适用对象和范围", "个人信息处理活动"],
  informationTypes: ["个人信息处理活动", "敏感个人信息"],
  purposes: ["个人信息处理活动"],
  collectionChannels: ["个人信息处理活动"],
  systems: ["个人信息处理活动", "保存和安全"],
  recipients: ["委托处理和向其他单位提供"],
  approximatePersonCount: ["个人信息处理活动", "影响评估"],
  accessRoles: ["内部权限管理"],
  systemOperators: ["委托处理和向其他单位提供"],
  retentionPeriod: ["保存和删除"],
  deletionMethod: ["保存和删除"],
  rightsChannel: ["个人权利", "如何联系我们"],
  automatedDecision: ["自动化决策"],
  sensitiveInformation: ["敏感个人信息"],
  minorsInvolved: ["不满十四周岁未成年人"],
  crossBorderAccess: ["向境外提供个人信息"]
};

const comparableFacts = (facts: ActivityFacts) => ({ ...facts, confirmedAt: null });

export function changedActivityFactFields(before: ActivityFacts, after: ActivityFacts): Array<keyof ActivityFacts> {
  const previous = comparableFacts(before);
  const next = comparableFacts(after);
  return (Object.keys(previous) as Array<keyof ActivityFacts>).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
}

export function describeActivityImpact(activityName: string, fields: Array<keyof ActivityFacts>) {
  const labels = fields.map(field => factLabels[field]);
  const affectedSections = [...new Set(fields.flatMap(field => sectionMap[field] || ["相关业务说明"]))];
  return {
    changedFields: fields,
    affectedSections,
    reason: `“${activityName}”的${labels.join("、")}发生变化，需要核对材料中的相关表述。`
  };
}

type EnterpriseImpactField = keyof Pick<EnterpriseProfile,
  "legalName" | "privacyContactName" | "privacyContactRole" | "privacyContactChannel" | "sensitiveCategories" | "minorsPossible" | "crossBorder">;

const enterpriseLabels: Record<EnterpriseImpactField, string> = {
  legalName: "单位名称",
  privacyContactName: "个人信息保护联系人",
  privacyContactRole: "联系人职务",
  privacyContactChannel: "联系渠道",
  sensitiveCategories: "敏感个人信息范围",
  minorsPossible: "未成年人情况",
  crossBorder: "境外处理情况"
};

const enterpriseSections: Record<EnterpriseImpactField, string[]> = {
  legalName: ["处理者基本信息", "材料首页"],
  privacyContactName: ["如何联系我们", "个人权利"],
  privacyContactRole: ["如何联系我们", "个人权利"],
  privacyContactChannel: ["如何联系我们", "个人权利"],
  sensitiveCategories: ["敏感个人信息"],
  minorsPossible: ["不满十四周岁未成年人"],
  crossBorder: ["向境外提供个人信息"]
};

export function changedEnterpriseFields(before: EnterpriseProfile, after: Omit<EnterpriseProfile, "id" | "updatedAt">): EnterpriseImpactField[] {
  return (Object.keys(enterpriseLabels) as EnterpriseImpactField[]).filter(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

export function describeEnterpriseImpact(fields: EnterpriseImpactField[]) {
  return {
    changedFields: fields,
    affectedSections: [...new Set(fields.flatMap(field => enterpriseSections[field]))],
    reason: `企业档案中的${fields.map(field => enterpriseLabels[field]).join("、")}发生变化，需要核对相关材料。`
  };
}
