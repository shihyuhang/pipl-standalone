export const sensitiveCategoryCodes = [
  "biometric",
  "religious_belief",
  "specific_identity",
  "medical_health",
  "financial_account",
  "location_trajectory",
  "other_sensitive"
] as const;

export type SensitiveCategoryCode = typeof sensitiveCategoryCodes[number];

export interface SensitiveCategoryDefinition {
  code: SensitiveCategoryCode;
  label: string;
  examples: string;
  boundary: string;
}

/**
 * 《个人信息保护法》第二十八条为上位判断规则；分类和边界按 GB/T 45574—2025 第4章及附录A细化。
 * 不满十四周岁未成年人的全部个人信息由独立字段记录，但在规则上始终按敏感个人信息处理。
 */
export const sensitiveCategoryDefinitions: SensitiveCategoryDefinition[] = [
  { code: "biometric", label: "生物识别信息", examples: "基因、人脸特征、声纹、步态、指纹、掌纹、虹膜等", boundary: "普通照片或视频不当然属于生物识别；经技术处理用于识别身份时才属于本类。" },
  { code: "religious_belief", label: "宗教信仰信息", examples: "宗教信仰、宗教组织、宗教活动及特殊宗教习俗等", boundary: "仅记录普通兴趣或一般文化活动，不应直接归入本类。" },
  { code: "specific_identity", label: "特定身份信息", examples: "残障人士身份、不适宜公开的职业身份等", boundary: "普通单位、部门、岗位或职务信息不当然属于特定身份。" },
  { code: "medical_health", label: "医疗健康信息", examples: "病症、病史、体检报告、生育信息、就诊及检验检查记录等", boundary: "与疾病和医疗就诊无关的身高、体重、血型、血压等基本体质信息，不当然属于敏感个人信息。" },
  { code: "financial_account", label: "金融账户信息", examples: "银行、证券、基金、保险、公积金账户，支付账号、鉴别信息及个人收入明细等", boundary: "普通订单或一般交易记录不应仅因涉及金额就自动归入金融账户信息。" },
  { code: "location_trajectory", label: "行踪轨迹或精准定位", examples: "连续精准定位、车辆行驶轨迹、连续活动轨迹，以及终端精准位置权限取得的位置", boundary: "网络地址推算的粗略位置不是精准定位；多次精准定位结合时间可能形成行踪轨迹。" },
  { code: "other_sensitive", label: "其他敏感个人信息", examples: "居民身份证照片、性取向或性生活、征信、犯罪记录、私密部位影像等", boundary: "不能只看名称；其他信息须符合泄露或非法使用后容易侵害人格尊严或危害人身、财产安全的法定标准。" }
];

const legacyAliases: Record<string, SensitiveCategoryCode> = {
  identity_document: "other_sensitive",
  health: "medical_health",
  precise_location: "location_trajectory",
  biometric: "biometric",
  financial_account: "financial_account"
};

export function normalizeSensitiveCategoryCodes(value: unknown): SensitiveCategoryCode[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(sensitiveCategoryCodes);
  return [...new Set(value.map(String).map(code => legacyAliases[code] || code).filter(code => allowed.has(code)))] as SensitiveCategoryCode[];
}

export function sensitiveCategoryLabels(value: unknown): string[] {
  const codes = normalizeSensitiveCategoryCodes(value);
  return codes.map(code => sensitiveCategoryDefinitions.find(item => item.code === code)!.label);
}
