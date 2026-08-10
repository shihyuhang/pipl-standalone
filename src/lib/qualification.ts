import type { QualificationInput, QualificationResult } from "./types";

export function assessQualification(input: QualificationInput): QualificationResult {
  const reasons: string[] = [];
  const tasks: QualificationResult["tasks"] = [];

  if (input.personCount !== null && input.personCount >= 100_000) {
    return {
      status: "out_of_scope",
      summary: "当前人数已达到小型处理者路径之外，建议转专业人员评估。",
      reasons: ["当前仍保存或使用的个人信息涉及人数达到或超过 10 万人。"],
      tasks: [{
        code: "QUALIFICATION-OUT-OF-SCOPE",
        title: "转入一般个人信息处理者评估",
        description: "保存现有档案，并由专业人员确认后续适用要求。",
        priority: "high"
      }]
    };
  }

  if (input.personCount === null || !input.countVerified) {
    reasons.push("人数口径尚未完整确认。");
    tasks.push({
      code: "VERIFY-PERSON-COUNT",
      title: "确认个人信息涉及人数",
      description: "汇总当前仍保存或使用的员工、候选人、业务联系人和消费者等自然人，去除重复人员，并排除已经删除的数据。",
      priority: "high"
    });
  }

  const highRisk = input.sensitiveCategories.length > 0 || input.minorsPossible !== "no" || input.crossBorder !== "no";
  if (input.sensitiveCategories.length > 0) reasons.push("涉及较敏感的信息，需要进一步确认必要性和保护措施。");
  if (input.minorsPossible !== "no") reasons.push("未成年人情况仍需确认或专项复核。");
  if (input.crossBorder !== "no") reasons.push("境外存储、传输或远程访问情况仍需确认或专项复核。");
  if (input.processingRole === "unknown" || !input.processingRole) {
    reasons.push("贵单位在处理活动中的角色尚未确认。");
    tasks.push({
      code: "VERIFY-PROCESSING-ROLE",
      title: "确认贵单位怎样决定信息用途",
      description: "确认是自主决定使用方式，还是主要按照客户指示处理。",
      priority: "normal"
    });
  }

  if (highRisk) {
    tasks.push({
      code: "HIGH-RISK-REVIEW",
      title: "完成高风险事项复核",
      description: "系统只提供辅助判断，敏感信息、未成年人或境外访问事项需人工确认。",
      priority: "high"
    });
    return {
      status: "needs_review",
      summary: "基础条件符合小型处理者范围，但存在需要专项确认的事项。",
      reasons,
      tasks
    };
  }

  if (input.personCount === null || !input.countVerified || input.processingRole === "unknown" || !input.processingRole) {
    return {
      status: "conditional",
      summary: "目前可继续建立合规档案，完成待确认事项后再形成正式判断。",
      reasons,
      tasks
    };
  }

  return {
    status: "eligible",
    summary: "根据已确认情况，目前适合使用小型个人信息处理者工作路径。",
    reasons: ["当前人数低于 10 万人，且未发现需要立即转出的高风险事项。"],
    tasks
  };
}
