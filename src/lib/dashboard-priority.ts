import type { TaskItem } from "@/lib/types";

export type DashboardUrgency = "immediate" | "priority" | "routine";

export type DashboardTaskGuidance = {
  urgency: DashboardUrgency;
  label: string;
  reason: string;
  rank: number;
};

type PrioritizableTask = Pick<TaskItem, "code" | "category" | "priority" | "sourceType" | "status" | "createdAt">;

export type DashboardPriorityContext = { activityCount?: number };

export function getDashboardTaskGuidance(task: PrioritizableTask, context: DashboardPriorityContext = {}): DashboardTaskGuidance {
  if (task.code === "QUALIFICATION-OUT-OF-SCOPE") {
    return {
      urgency: "immediate",
      label: "现在先确认",
      reason: "可能已超出小型处理者适用范围；应先确认合规路径，避免按错误规则继续办理。",
      rank: 0
    };
  }

  if (task.code === "HIGH-RISK-REVIEW") {
    return {
      urgency: context.activityCount === 0 ? "priority" : "immediate",
      label: context.activityCount === 0 ? "建业务后复核" : "现在先确认",
      reason: context.activityCount === 0 ? "专项复核需要具体业务事实；请先登记首项业务，系统再按场景引导确认。" : "涉及敏感个人信息、未成年人或境外处理等高风险情况，应先由负责人专项确认。",
      rank: context.activityCount === 0 ? 2 : 1
    };
  }

  if (task.code.startsWith("PIPIA-")) {
    return {
      urgency: "immediate",
      label: "发布前完成",
      reason: "该业务已触发个人信息保护影响评估；完成并归档后，相关材料才能发布为合规有效版本。",
      rank: 1
    };
  }

  if (task.code === "VERIFY-PERSON-COUNT") {
    return {
      urgency: "priority",
      label: "基础先做",
      reason: "人数口径会影响是否适用小型处理者路径，先确认可避免后续返工。",
      rank: 10
    };
  }

  if (task.code === "VERIFY-PROCESSING-ROLE") {
    return {
      urgency: "priority",
      label: "基础先做",
      reason: "处理角色会影响义务分配和材料内容，应在生成或发布材料前确认。",
      rank: 11
    };
  }

  if (task.priority === "high" || task.sourceType === "assessment_finding") {
    return {
      urgency: "immediate",
      label: "优先处理",
      reason: "该事项会影响风险判断或后续合规安排，建议先于一般材料整理完成。",
      rank: 2
    };
  }

  if (task.code === "ADD-FIRST-SCENARIO" || task.code.startsWith("COMPLETE-")) {
    return {
      urgency: task.code === "ADD-FIRST-SCENARIO" && context.activityCount === 0 ? "immediate" : "priority",
      label: task.code === "ADD-FIRST-SCENARIO" && context.activityCount === 0 ? "现在先记录" : "基础先做",
      reason: "后续判断和材料都依赖真实业务情况，先补齐事实才能减少遗漏和误判。",
      rank: task.code === "ADD-FIRST-SCENARIO" && context.activityCount === 0 ? 1 : 12
    };
  }

  if (task.code === "CREATE-FIRST-NOTICE" || task.category === "合规材料") {
    return {
      urgency: "routine",
      label: "随后完善",
      reason: "建议在业务事实和风险事项确认后再完善材料，避免内容与实际情况不一致。",
      rank: 20
    };
  }

  return {
    urgency: "routine",
    label: "随后办理",
    reason: "这是常规完善事项，可在前置风险和基础事实确认后按实际情况办理。",
    rank: 30
  };
}

export function prioritizeDashboardTasks<T extends PrioritizableTask>(tasks: T[], context: DashboardPriorityContext = {}): T[] {
  return tasks
    .map((task, index) => ({ task, index, guidance: getDashboardTaskGuidance(task, context) }))
    .sort((left, right) => {
      if (left.guidance.rank !== right.guidance.rank) return left.guidance.rank - right.guidance.rank;
      if (left.task.status !== right.task.status) return left.task.status === "in_progress" ? -1 : 1;
      const dateDifference = Date.parse(right.task.createdAt) - Date.parse(left.task.createdAt);
      return Number.isNaN(dateDifference) || dateDifference === 0 ? left.index - right.index : dateDifference;
    })
    .map(item => item.task);
}
