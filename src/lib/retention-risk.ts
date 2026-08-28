export type RetentionRiskLevel = "none" | "needs_basis" | "high";

export type RetentionRiskAssessment = {
  level: RetentionRiskLevel;
  title: string;
  message: string;
  requiresBasis: boolean;
};

const indefinitePattern = /永久|永久性|长期保存|一直保存|无限期|无期限|不删除|永不删除|永久保留/;
const vaguePattern = /根据需要|按需保存|视情况|业务需要|必要时再删除|适当期限|一段时间/;

export function assessRetentionRisk(period: string, basis = ""): RetentionRiskAssessment {
  const normalized = String(period || "").trim();
  const hasBasis = String(basis || "").trim().length > 0;
  if (!normalized) return { level: "none", title: "", message: "", requiresBasis: false };

  if (indefinitePattern.test(normalized)) {
    return {
      level: "high",
      title: "保存期限可能超过必要范围",
      message: "“永久”或“不删除”通常不能仅作为现状直接采用。请说明持续保存对应的具体处理目的；如法律、行政法规要求保存，还应记录适用规定、数据范围和期限，并限制用于其他目的。",
      requiresBasis: !hasBasis
    };
  }

  if (vaguePattern.test(normalized)) {
    return {
      level: "needs_basis",
      title: "保存期限还不够明确",
      message: "当前表述缺少可执行的起算点或删除条件。请结合处理目的写明何时开始计算、保存多久，以及到期如何处理。",
      requiresBasis: !hasBasis
    };
  }

  return { level: "none", title: "", message: "", requiresBasis: false };
}
