import type { ActivityFacts, QualificationInput, QualificationStatus } from "../../src/lib/types.ts";

export interface SmallProcessorScenario {
  id: string;
  name: string;
  description: string;
  qualification: QualificationInput;
  activityFacts: ActivityFacts;
  expectedQualification: QualificationStatus;
  expectedReadyForTriage: boolean;
  expectedLocalTriage: "draft_ready" | "needs_review" | "needs_input";
  expectedTaskCodes: string[];
  expectedFindingTitles: string[];
}

const completeFacts: ActivityFacts = {
  dataSubjects: ["客户和供应商联系人"],
  informationTypes: ["姓名和联系方式", "单位和职务"],
  purposes: ["履行项目或合同"],
  collectionChannels: ["本人或所在单位提供"],
  systems: ["企业邮箱", "CRM或ERP"],
  recipients: ["不向外部提供"],
  approximatePersonCount: 480,
  accessRoles: ["业务经办人员", "部门负责人"],
  systemOperators: ["本单位系统管理员", "云服务商"],
  retentionPeriod: "合作结束后三年删除；依法需要留存的合同材料限制其他用途",
  deletionMethod: "每季度由行政负责人核对到期记录，并在企业邮箱和CRM中删除",
  rightsChannel: "privacy@example.test",
  automatedDecision: "no",
  sensitiveInformation: "no",
  minorsInvolved: "no",
  crossBorderAccess: "no",
  notes: "",
  confirmedAt: "2026-08-11T00:00:00.000Z"
};

const baseQualification: QualificationInput = {
  personCount: 480,
  countVerified: true,
  sensitiveCategories: [],
  minorsPossible: "no",
  crossBorder: "no",
  processingRole: "independent_processor"
};

export const smallProcessorScenarios: SmallProcessorScenario[] = [
  {
    id: "foreign-b2b-low-volume",
    name: "少量联系人信息的外资B2B企业",
    description: "本场景只处理客户和供应商联系人的基础信息，用于项目和合同沟通。",
    qualification: baseQualification,
    activityFacts: completeFacts,
    expectedQualification: "eligible",
    expectedReadyForTriage: true,
    expectedLocalTriage: "draft_ready",
    expectedTaskCodes: [],
    expectedFindingTitles: []
  },
  {
    id: "count-not-verified",
    name: "人数已估算但口径尚未确认",
    description: "企业估算涉及3200人，但尚未完成跨系统去重。",
    qualification: { ...baseQualification, personCount: 3200, countVerified: false },
    activityFacts: completeFacts,
    expectedQualification: "conditional",
    expectedReadyForTriage: true,
    expectedLocalTriage: "draft_ready",
    expectedTaskCodes: ["VERIFY-PERSON-COUNT"],
    expectedFindingTitles: []
  },
  {
    id: "processing-role-unknown",
    name: "B2B系统服务商尚未确认处理角色",
    description: "既可能自主使用联系人信息，也可能按照客户指示处理托管数据。",
    qualification: { ...baseQualification, processingRole: "unknown" },
    activityFacts: completeFacts,
    expectedQualification: "conditional",
    expectedReadyForTriage: true,
    expectedLocalTriage: "draft_ready",
    expectedTaskCodes: ["VERIFY-PROCESSING-ROLE"],
    expectedFindingTitles: []
  },
  {
    id: "employee-health-data",
    name: "员工管理涉及健康信息",
    description: "为病假和福利管理处理员工健康证明。",
    qualification: { ...baseQualification, sensitiveCategories: ["健康信息"] },
    activityFacts: {
      ...completeFacts,
      dataSubjects: ["员工"],
      informationTypes: ["身份信息", "健康证明"],
      purposes: ["员工管理"],
      systems: ["HR或薪酬系统"],
      sensitiveInformation: "yes"
    },
    expectedQualification: "needs_review",
    expectedReadyForTriage: true,
    expectedLocalTriage: "needs_review",
    expectedTaskCodes: ["HIGH-RISK-REVIEW"],
    expectedFindingTitles: ["复核敏感个人信息"]
  },
  {
    id: "minors-unknown",
    name: "官网活动可能收到未成年人信息",
    description: "没有年龄筛选，尚不能排除不满十四周岁用户。",
    qualification: { ...baseQualification, minorsPossible: "unknown" },
    activityFacts: { ...completeFacts, dataSubjects: ["官网访客"], minorsInvolved: "unknown" },
    expectedQualification: "needs_review",
    expectedReadyForTriage: true,
    expectedLocalTriage: "needs_input",
    expectedTaskCodes: ["HIGH-RISK-REVIEW"],
    expectedFindingTitles: ["确认未成年人情况"]
  },
  {
    id: "cross-border-remote-access",
    name: "境外总部远程访问联系人信息",
    description: "境内服务器中的CRM可能被境外总部管理员查看。",
    qualification: { ...baseQualification, crossBorder: "yes" },
    activityFacts: { ...completeFacts, recipients: ["境外总部"], crossBorderAccess: "yes" },
    expectedQualification: "needs_review",
    expectedReadyForTriage: true,
    expectedLocalTriage: "needs_review",
    expectedTaskCodes: ["HIGH-RISK-REVIEW"],
    expectedFindingTitles: ["确认境外访问情况"]
  },
  {
    id: "under-threshold-boundary",
    name: "99999人边界案例",
    description: "人数已经核实，仍低于10万人。",
    qualification: { ...baseQualification, personCount: 99_999 },
    activityFacts: completeFacts,
    expectedQualification: "eligible",
    expectedReadyForTriage: true,
    expectedLocalTriage: "draft_ready",
    expectedTaskCodes: [],
    expectedFindingTitles: []
  },
  {
    id: "out-of-scope-boundary",
    name: "100000人边界案例",
    description: "人数达到10万人，应转出小型处理者路径。",
    qualification: { ...baseQualification, personCount: 100_000 },
    activityFacts: completeFacts,
    expectedQualification: "out_of_scope",
    expectedReadyForTriage: true,
    expectedLocalTriage: "draft_ready",
    expectedTaskCodes: ["QUALIFICATION-OUT-OF-SCOPE"],
    expectedFindingTitles: []
  },
  {
    id: "incomplete-retention",
    name: "业务信息缺少保存期限",
    description: "其他事实已经填写，但不知道信息保存多久。",
    qualification: baseQualification,
    activityFacts: { ...completeFacts, retentionPeriod: "", confirmedAt: null },
    expectedQualification: "eligible",
    expectedReadyForTriage: false,
    expectedLocalTriage: "draft_ready",
    expectedTaskCodes: [],
    expectedFindingTitles: []
  },
  {
    id: "recipient-unknown",
    name: "外部接收方尚不清楚",
    description: "使用云系统，但业务负责人尚未确认服务商和信息流转关系。",
    qualification: baseQualification,
    activityFacts: { ...completeFacts, recipients: ["暂不清楚"] },
    expectedQualification: "eligible",
    expectedReadyForTriage: true,
    expectedLocalTriage: "needs_input",
    expectedTaskCodes: [],
    expectedFindingTitles: ["确认外部接收方"]
  }
];
