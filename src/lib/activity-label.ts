import type { ProcessingActivity } from "./types.ts";

export function activityDisplayName(activity: Pick<ProcessingActivity, "name" | "remark">): string {
  const remark = String(activity.remark || "").trim();
  return remark ? `${activity.name} · ${remark}` : activity.name;
}
