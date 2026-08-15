import { normalizeChinaLegalText } from "./legal-language.ts";

export interface SystemTaskSnapshot {
  onboardingCompleted: boolean;
  personCount: number | null;
  countVerified: boolean;
  processingRole: string;
  sensitiveCategories: string[];
  minorsPossible: string;
  crossBorder: string;
  activityCount: number;
  externalNoticeCount: number;
  activities: Array<{ id: string; name: string; completeness: number }>;
}

export interface SystemTaskRule {
  code: string;
  title: string;
  description: string;
  category: string;
  priority: "normal" | "high";
  satisfied: boolean;
  completionBasis: string;
  evidenceNote: string;
  createWhenUnsatisfied: boolean;
  activityId?: string;
}

export function buildSystemTaskRules(snapshot: SystemTaskSnapshot): SystemTaskRule[] {
  if (!snapshot.onboardingCompleted) return [];
  const highRisk = snapshot.sensitiveCategories.length > 0 || snapshot.minorsPossible !== "no" || snapshot.crossBorder !== "no";
  const processingRoleDescription = normalizeChinaLegalText(snapshot.processingRole || "尚未确认");
  const rules: SystemTaskRule[] = [
    {
      code: "ADD-FIRST-SCENARIO", title: "添加首个业务场景", description: "选择一项实际业务，确认怎样使用个人信息。",
      category: "我的业务", priority: "normal", satisfied: snapshot.activityCount > 0,
      completionBasis: `系统检测到已建立 ${snapshot.activityCount} 项业务场景。`, evidenceNote: "系统记录：我的业务", createWhenUnsatisfied: true
    },
    {
      code: "CREATE-FIRST-NOTICE", title: "建立首份个人信息处理规则或告知", description: "根据已经确认的企业和业务情况生成首份对外规则或告知草稿。",
      category: "合规材料", priority: "normal", satisfied: snapshot.externalNoticeCount > 0,
      completionBasis: `系统检测到已建立 ${snapshot.externalNoticeCount} 份对外个人信息规则或告知材料。`, evidenceNote: "系统记录：合规材料及版本", createWhenUnsatisfied: true
    },
    {
      code: "VERIFY-PERSON-COUNT", title: "确认个人信息涉及人数", description: "汇总当前仍保存或使用的自然人，去除重复人员，并排除已经删除的数据。",
      category: "适用判断", priority: "high", satisfied: snapshot.personCount !== null && snapshot.countVerified,
      completionBasis: snapshot.personCount === null ? "人数尚未填写。" : `企业档案已确认当前涉及约 ${snapshot.personCount} 人。`, evidenceNote: "系统记录：企业档案的人数及口径确认", createWhenUnsatisfied: true
    },
    {
      code: "VERIFY-PROCESSING-ROLE", title: "确认贵单位怎样决定信息用途", description: "确认是自主决定使用方式，还是主要按照客户指示处理。",
      category: "适用判断", priority: "normal", satisfied: Boolean(snapshot.processingRole && snapshot.processingRole !== "unknown"),
      completionBasis: `企业档案已记录本单位怎样决定信息用途：${processingRoleDescription}。`, evidenceNote: "系统记录：企业档案中的处理方式", createWhenUnsatisfied: true
    },
    {
      code: "HIGH-RISK-REVIEW", title: "完成高风险事项复核", description: "敏感信息、未成年人或境外访问事项需要负责人或专业人员确认。",
      category: "适用判断", priority: "high", satisfied: !highRisk,
      completionBasis: "企业档案当前未记录敏感信息、未成年人或境外访问事项。", evidenceNote: "系统记录：企业档案的专项风险字段", createWhenUnsatisfied: true
    },
    {
      code: "QUALIFICATION-OUT-OF-SCOPE", title: "转入一般个人信息处理者评估", description: "当前人数达到小型处理者范围之外，需要专业人员确认后续适用要求。",
      category: "适用判断", priority: "high", satisfied: snapshot.personCount === null || snapshot.personCount < 100_000,
      completionBasis: snapshot.personCount === null ? "尚未确认人数。" : `企业档案当前人数为 ${snapshot.personCount}，低于10万人。`, evidenceNote: "系统记录：企业档案的人数", createWhenUnsatisfied: true
    }
  ];
  for (const activity of snapshot.activities) rules.push({
    code: `COMPLETE-${activity.id}`, title: `完善“${activity.name}”业务情况`, description: "确认涉及人员、信息字段、访问岗位、删除方式和个人权利渠道。",
    category: "我的业务", priority: "normal", satisfied: activity.completeness >= 1,
    completionBasis: `“${activity.name}”的必要业务信息已全部确认。`, evidenceNote: `系统记录：我的业务 / ${activity.name}`,
    createWhenUnsatisfied: true, activityId: activity.id
  });
  return rules;
}
