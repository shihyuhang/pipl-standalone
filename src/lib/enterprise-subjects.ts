export const enterpriseSubjectOptions = [
  ["employee", "在职员工"],
  ["candidate", "招聘候选人"],
  ["customer_contact", "客户企业联系人"],
  ["supplier_contact", "供应商联系人"],
  ["consumer", "消费者或会员"],
  ["visitor", "访客"]
] as const;

const customPrefix = "other:";
const standardValues = new Set<string>(enterpriseSubjectOptions.map(([value]) => value));

export function getCustomSubjectDescription(categories: string[]): string {
  return categories
    .filter(value => !standardValues.has(value) && value !== "other")
    .map(value => value.startsWith(customPrefix) ? value.slice(customPrefix.length) : value)
    .filter(Boolean)
    .join("；");
}

export function mergeEnterpriseSubjectCategories(categories: string[], customDescription: string): string[] {
  const standard = categories.filter(value => standardValues.has(value));
  const custom = customDescription.trim().replace(/\s+/g, " ");
  return custom ? [...standard, `${customPrefix}${custom}`] : standard;
}

export function hasCompleteCustomSubjectSelection(categories: string[], customSelected: boolean): boolean {
  return !customSelected || categories.some(value => value.startsWith(customPrefix) && value.slice(customPrefix.length).trim().length >= 2);
}

export function enterpriseSubjectLabel(value: string): string {
  const standard = enterpriseSubjectOptions.find(([code]) => code === value)?.[1];
  if (standard) return standard;
  if (value === "other") return "其他自然人（未说明）";
  return value.startsWith(customPrefix) ? value.slice(customPrefix.length) : value;
}
