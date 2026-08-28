import { normalizeChinaLegalText } from "./legal-language.ts";
import { activityDisplayName } from "./activity-label.ts";

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
  activities: Array<{ id: string; name: string; remark?: string; completeness: number; specialRiskCovered?: boolean; pipiaRequired?: boolean; pipiaComplete?: boolean; pipiaReasons?: string[] }>;
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

export function shouldCreateUnsatisfiedSystemTask(
  rule: SystemTaskRule,
  latestCompleted: { completionMode: string; completedAt: string | null } | null,
  enterpriseUpdatedAt: string
): boolean {
  if (rule.satisfied || !rule.createWhenUnsatisfied) return false;
  if (rule.code !== "HIGH-RISK-REVIEW") return true;
  return !(latestCompleted?.completionMode === "manual" && latestCompleted.completedAt && latestCompleted.completedAt >= enterpriseUpdatedAt);
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
      category: "适用判断", priority: "high", satisfied: !highRisk || snapshot.activities.some(activity => activity.specialRiskCovered),
      completionBasis: snapshot.activities.some(activity => activity.specialRiskCovered) ? "具体业务已记录相应专项风险；后续由场景检查和影响评估任务承接，不再保留重复的总体复核事项。" : "企业档案当前未记录敏感信息、未成年人或境外访问事项。", evidenceNote: "系统记录：企业档案及具体业务", createWhenUnsatisfied: true
    },
    {
      code: "QUALIFICATION-OUT-OF-SCOPE", title: "转入一般个人信息处理者评估", description: "当前人数达到小型处理者范围之外，需要专业人员确认后续适用要求。",
      category: "适用判断", priority: "high", satisfied: snapshot.personCount === null || snapshot.personCount < 100_000,
      completionBasis: snapshot.personCount === null ? "尚未确认人数。" : `企业档案当前人数为 ${snapshot.personCount}，低于10万人。`, evidenceNote: "系统记录：企业档案的人数", createWhenUnsatisfied: true
    }
  ];
  for (const activity of snapshot.activities) rules.push({
    code: `COMPLETE-${activity.id}`, title: `完善“${activityDisplayName(activity)}”业务情况`, description: "补齐这项业务仍未确认的必要事实；访问岗位和权限只按该场景的实际情况记录，不要求所有业务使用相同答案。",
    category: "我的业务", priority: "normal", satisfied: activity.completeness >= 1,
    completionBasis: `“${activityDisplayName(activity)}”的必要业务信息已全部确认。`, evidenceNote: `系统记录：我的业务 / ${activityDisplayName(activity)}`,
    createWhenUnsatisfied: true, activityId: activity.id
  });
  for (const activity of snapshot.activities.filter(item => item.pipiaRequired)) rules.push({
    code: `PIPIA-${activity.id}`, title: `完成“${activityDisplayName(activity)}”个人信息保护影响评估`, description: `该业务触发事前影响评估：${activity.pipiaReasons?.join("；") || "存在法定评估情形"}。完成并由负责人确认归档后，才能将相关材料发布为合规有效版本。`,
    category: "影响评估", priority: "high", satisfied: Boolean(activity.pipiaComplete),
    completionBasis: `“${activityDisplayName(activity)}”已有负责人确认归档的个人信息保护影响评估。`, evidenceNote: `系统记录：个人信息保护影响评估 / ${activityDisplayName(activity)}`,
    createWhenUnsatisfied: true, activityId: activity.id
  });
  return rules;
}
