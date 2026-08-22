import type { ActivityFacts } from "./types.ts";

export const activityOptionGroups = {
  dataSubjects: ["客户联系人", "供应商联系人", "消费者或会员", "员工", "求职者", "访客", "其他人员"],
  informationTypes: ["姓名和联系方式", "单位和职务", "身份证件", "订单和交易", "薪酬和考勤", "地址或位置", "账号或设备信息", "照片或视频", "其他信息"],
  purposes: ["履行项目或合同", "客户和供应商联系", "招聘与录用", "员工管理", "提供产品或服务", "咨询与商务联系", "安全和门禁", "营销活动", "履行法定义务"],
  collectionChannels: ["本人主动提供", "企业客户或供应商提供", "网站或小程序", "邮件或电话", "设备自动采集", "公开渠道"],
  systems: ["邮箱或通讯工具", "Excel或本地文件", "网站后台", "CRM或ERP", "HR或薪酬系统", "云端SaaS", "门禁或监控", "纸质文件"],
  recipients: ["不向外部提供", "仅必要服务商", "集团内其他主体", "客户或合作方", "政府或法定机构", "暂不清楚"],
  accessRoles: ["业务经办人员", "部门负责人", "销售或客户服务", "人力资源岗位", "财务或行政人员", "系统管理员", "暂不清楚"],
  systemOperators: ["本单位系统管理员", "云服务商", "外包服务人员", "集团信息技术人员", "不涉及专门运维", "暂不清楚"]
} as const;

export type GuidedFactField = keyof typeof activityOptionGroups;
export const guidedFactFields = Object.keys(activityOptionGroups) as GuidedFactField[];

export type ScenarioGuidance = {
  defaults?: Partial<Record<GuidedFactField, readonly string[]>>;
  recommended?: Partial<Record<GuidedFactField, readonly string[]>>;
};

export const scenarioGuidanceCatalog: Record<string, ScenarioGuidance> = {
  "SCN-B2B-CONTACT": {
    recommended: {
      dataSubjects: ["客户联系人", "供应商联系人"], informationTypes: ["姓名和联系方式", "单位和职务"],
      purposes: ["履行项目或合同", "客户和供应商联系"], collectionChannels: ["企业客户或供应商提供", "邮件或电话"],
      systems: ["邮箱或通讯工具", "CRM或ERP"], accessRoles: ["业务经办人员", "部门负责人"],
      systemOperators: ["本单位系统管理员", "云服务商"]
    }
  },
  "SCN-HR-EMPLOYEE": {
    defaults: { dataSubjects: ["员工"], purposes: ["员工管理"] },
    recommended: {
      dataSubjects: ["员工"], informationTypes: ["姓名和联系方式", "身份证件", "薪酬和考勤"], purposes: ["员工管理", "履行法定义务"],
      collectionChannels: ["本人主动提供", "设备自动采集"], systems: ["HR或薪酬系统", "Excel或本地文件", "纸质文件"],
      recipients: ["仅必要服务商", "政府或法定机构"], accessRoles: ["人力资源岗位", "财务或行政人员", "部门负责人"],
      systemOperators: ["本单位系统管理员", "云服务商"]
    }
  },
  "SCN-HR-RECRUIT": {
    defaults: { dataSubjects: ["求职者"], purposes: ["招聘与录用"] },
    recommended: {
      dataSubjects: ["求职者"], informationTypes: ["姓名和联系方式", "身份证件", "照片或视频"], purposes: ["招聘与录用"],
      collectionChannels: ["本人主动提供", "网站或小程序", "邮件或电话", "公开渠道"], systems: ["邮箱或通讯工具", "HR或薪酬系统", "云端SaaS"],
      recipients: ["仅必要服务商"], accessRoles: ["人力资源岗位", "部门负责人"], systemOperators: ["本单位系统管理员", "云服务商"]
    }
  },
  "SCN-WEBSITE-CONTACT": {
    defaults: { purposes: ["咨询与商务联系"], collectionChannels: ["网站或小程序"] },
    recommended: {
      dataSubjects: ["客户联系人", "消费者或会员"], informationTypes: ["姓名和联系方式", "单位和职务", "账号或设备信息"],
      purposes: ["咨询与商务联系", "客户和供应商联系"], collectionChannels: ["网站或小程序"], systems: ["网站后台", "邮箱或通讯工具"],
      recipients: ["仅必要服务商"], accessRoles: ["业务经办人员", "销售或客户服务"], systemOperators: ["本单位系统管理员", "云服务商"]
    }
  },
  "SCN-CONSUMER-MEMBER": {
    defaults: { dataSubjects: ["消费者或会员"], purposes: ["提供产品或服务"] },
    recommended: {
      dataSubjects: ["消费者或会员"], informationTypes: ["姓名和联系方式", "订单和交易", "账号或设备信息", "地址或位置"],
      purposes: ["提供产品或服务"], collectionChannels: ["本人主动提供", "网站或小程序", "设备自动采集"], systems: ["网站后台", "CRM或ERP", "云端SaaS"],
      recipients: ["仅必要服务商"], accessRoles: ["销售或客户服务", "业务经办人员"], systemOperators: ["本单位系统管理员", "云服务商"]
    }
  },
  "SCN-MARKETING": {
    defaults: { purposes: ["营销活动"] },
    recommended: {
      dataSubjects: ["消费者或会员", "客户联系人"], informationTypes: ["姓名和联系方式", "单位和职务", "账号或设备信息"], purposes: ["营销活动"],
      collectionChannels: ["本人主动提供", "网站或小程序", "公开渠道"], systems: ["CRM或ERP", "邮箱或通讯工具", "云端SaaS"],
      recipients: ["仅必要服务商"], accessRoles: ["销售或客户服务", "业务经办人员"], systemOperators: ["本单位系统管理员", "云服务商"]
    }
  },
  "SCN-VISITOR": {
    defaults: { dataSubjects: ["访客"], purposes: ["安全和门禁"] },
    recommended: {
      dataSubjects: ["访客"], informationTypes: ["姓名和联系方式", "身份证件", "照片或视频"], purposes: ["安全和门禁"],
      collectionChannels: ["本人主动提供", "网站或小程序", "设备自动采集"], systems: ["门禁或监控", "纸质文件", "Excel或本地文件"],
      accessRoles: ["财务或行政人员", "业务经办人员"], systemOperators: ["本单位系统管理员", "外包服务人员"]
    }
  },
  "SCN-OTHER": {}
};

export function getScenarioGuidance(scenarioCode: string): ScenarioGuidance {
  return scenarioGuidanceCatalog[scenarioCode] || {};
}

export function applyScenarioDefaults(facts: ActivityFacts, scenarioCode: string): ActivityFacts {
  const defaults = getScenarioGuidance(scenarioCode).defaults || {};
  const next = { ...facts };
  const writable = next as unknown as Record<GuidedFactField, string[]>;
  for (const field of guidedFactFields) {
    const values = defaults[field];
    if (values?.length && (facts[field] as string[]).length === 0) writable[field] = [...values];
  }
  return next;
}

export function emptyCustomFactInputs(): Record<GuidedFactField, string> {
  return Object.fromEntries(guidedFactFields.map(field => [field, ""])) as Record<GuidedFactField, string>;
}
