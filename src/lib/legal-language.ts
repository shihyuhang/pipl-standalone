const forbiddenChinaUiTerms = /processingRole|independent_processor|entrusted_processor|\bdata\s+controller\b|\bcontroller\b|\bdata\s+processor\b|\bprocessor\b|\bdata\s+subjects?\b|数据控制者|控制者|独立处理者|受托处理者|数据主体/i;

export function normalizeChinaLegalText(input: unknown): string {
  let text = String(input || "");

  text = text
    .replace(/企业画像中\s*processingRole\s*(?:为|=|：|:)?\s*independent_processor/gi, "企业档案记录为“主要由本单位自行决定”")
    .replace(/企业画像中\s*processingRole\s*(?:为|=|：|:)?\s*entrusted_processor/gi, "企业档案记录为“主要按照客户或其他单位的要求代为处理”")
    .replace(/processingRole\s*(?:为|=|：|:)?\s*independent_processor/gi, "企业档案记录为“主要由本单位自行决定”")
    .replace(/processingRole\s*(?:为|=|：|:)?\s*entrusted_processor/gi, "企业档案记录为“主要按照客户或其他单位的要求代为处理”")
    .replace(/\bprocessingRole\b/gi, "企业档案中的处理方式")
    .replace(/\bindependent_processor\b/gi, "主要由本单位自行决定")
    .replace(/\bentrusted_processor\b/gi, "主要按照客户或其他单位的要求代为处理")
    .replace(/控制者\s*[\/／]\s*处理者/g, "个人信息处理者／受托人")
    .replace(/\bdata\s+controller\b/gi, "个人信息处理者")
    .replace(/\bcontroller\b/gi, "个人信息处理者")
    .replace(/\bdata\s+processor\b/gi, "受托人")
    .replace(/\bprocessor\b/gi, "受托人")
    .replace(/\bdata\s+subjects?\b/gi, "相关个人")
    .replace(/数据控制者/g, "个人信息处理者")
    .replace(/独立处理者/g, "个人信息处理者")
    .replace(/受托处理者/g, "受托人")
    .replace(/数据主体/g, "相关个人")
    .replace(/控制者/g, "个人信息处理者")
    .replace(/企业画像中企业档案记录为/g, "企业档案记录为");

  return text;
}

export function normalizeTriageFinding(title: unknown, description: unknown): { title: string; description: string } {
  const rawTitle = String(title || "待确认事项");
  const rawDescription = String(description || "");
  const combined = `${rawTitle} ${rawDescription}`;
  const hasRoleLeak = forbiddenChinaUiTerms.test(combined);
  const describesConflict = /(冲突|不一致|法律角色|应作为|角色标识)/.test(combined);

  if (hasRoleLeak && describesConflict) {
    return {
      title: "确认本项业务由谁决定信息用途",
      description: "企业档案与本项业务的填写情况还不能相互印证。请确认贵单位是自行决定收集目的、信息范围、使用方式和保存期限，还是主要按照客户或其他单位的要求代为处理。"
    };
  }

  return {
    title: normalizeChinaLegalText(rawTitle),
    description: normalizeChinaLegalText(rawDescription)
  };
}
