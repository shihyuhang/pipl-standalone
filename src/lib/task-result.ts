const vagueTaskResults = /^(?:已?(?:处理|办理|完成|确认|解决)|处理完毕|没有|暂无|无|同意|好的|可以)[。！!，,]*$/;

export function isMeaningfulTaskResult(value: string) {
  const normalized = value.trim().replace(/\s+/g, "");
  return [...normalized].length >= 2 && !vagueTaskResults.test(normalized);
}
