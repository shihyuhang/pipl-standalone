import { sensitiveCategoryLabels } from "./sensitive-info.ts";
import type { BusinessDocument, EnterpriseProfile, MaterialAudienceGroup, ProcessingActivity } from "./types.ts";

function normalizedIds(ids: string[]) {
  return [...new Set(ids)].sort().join("|");
}

export function findSensitiveCategoryGaps(
  enterprise: Pick<EnterpriseProfile, "sensitiveCategories">,
  activities: Array<Pick<ProcessingActivity, "facts">>
): { codes: string[]; labels: string[] } {
  const assigned = new Set(activities.flatMap(activity => activity.facts.sensitiveCategories || []));
  const codes = [...new Set(enterprise.sensitiveCategories)].filter(code => !assigned.has(code));
  return { codes, labels: sensitiveCategoryLabels(codes) };
}

export function findPotentialDuplicateDocuments(
  documents: BusinessDocument[],
  input: { type: string; audienceGroup: MaterialAudienceGroup; activityIds: string[] }
): BusinessDocument[] {
  const activityKey = normalizedIds(input.activityIds);
  return documents.filter(document =>
    document.type === input.type
    && document.audienceGroup === input.audienceGroup
    && normalizedIds(document.activityIds) === activityKey
    && Boolean(document.versions?.some(version => ["draft", "under_review", "approved"].includes(version.status)))
  );
}

export function duplicateDocumentKey(document: Pick<BusinessDocument, "type" | "audienceGroup" | "activityIds">) {
  return `${document.type}::${document.audienceGroup}::${normalizedIds(document.activityIds)}`;
}
