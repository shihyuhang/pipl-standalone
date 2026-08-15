import type { ActivityFacts } from "./types";

export const emptyActivityFacts = (): ActivityFacts => ({
  dataSubjects: [],
  informationTypes: [],
  purposes: [],
  collectionChannels: [],
  systems: [],
  recipients: [],
  approximatePersonCount: null,
  accessRoles: [],
  systemOperators: [],
  retentionPeriod: "",
  deletionMethod: "",
  rightsChannel: "",
  automatedDecision: "",
  sensitiveInformation: "",
  minorsInvolved: "",
  crossBorderAccess: "",
  notes: "",
  confirmedAt: null
});

export function normalizeActivityFacts(value: unknown): ActivityFacts {
  const source = value && typeof value === "object" ? value as Partial<ActivityFacts> : {};
  const rawPersonCount = source.approximatePersonCount;
  const hasPersonCount = rawPersonCount !== null && rawPersonCount !== undefined && String(rawPersonCount).trim() !== "";
  const array = (item: unknown) => Array.isArray(item) ? item.map(String).filter(Boolean).slice(0, 30) : [];
  const answer = (item: unknown): ActivityFacts["sensitiveInformation"] =>
    ["yes", "no", "unknown"].includes(String(item)) ? String(item) as "yes" | "no" | "unknown" : "";
  return {
    dataSubjects: array(source.dataSubjects),
    informationTypes: array(source.informationTypes),
    purposes: array(source.purposes),
    collectionChannels: array(source.collectionChannels),
    systems: array(source.systems),
    recipients: array(source.recipients),
    approximatePersonCount: hasPersonCount && Number.isFinite(Number(rawPersonCount)) && Number(rawPersonCount) >= 0
      ? Number(rawPersonCount) : null,
    accessRoles: array(source.accessRoles),
    systemOperators: array(source.systemOperators),
    retentionPeriod: String(source.retentionPeriod || "").slice(0, 500),
    deletionMethod: String(source.deletionMethod || "").slice(0, 1000),
    rightsChannel: String(source.rightsChannel || "").slice(0, 500),
    automatedDecision: answer(source.automatedDecision),
    sensitiveInformation: answer(source.sensitiveInformation),
    minorsInvolved: answer(source.minorsInvolved),
    crossBorderAccess: answer(source.crossBorderAccess),
    notes: String(source.notes || "").slice(0, 2000),
    confirmedAt: source.confirmedAt ? String(source.confirmedAt) : null
  };
}

export function activityFactsCompleteness(facts: ActivityFacts): number {
  const checks = [
    facts.dataSubjects.length > 0,
    facts.informationTypes.length > 0,
    facts.purposes.length > 0,
    facts.collectionChannels.length > 0,
    facts.systems.length > 0,
    facts.recipients.length > 0,
    facts.approximatePersonCount !== null,
    facts.accessRoles.length > 0,
    facts.systemOperators.length > 0,
    facts.retentionPeriod.trim().length > 0,
    facts.deletionMethod.trim().length > 0,
    facts.rightsChannel.trim().length > 0,
    facts.automatedDecision !== "",
    facts.sensitiveInformation !== "",
    facts.minorsInvolved !== "",
    facts.crossBorderAccess !== ""
  ];
  const answered = checks.filter(Boolean).length;
  return Number((0.15 + 0.85 * answered / checks.length).toFixed(2));
}

export const isActivityReadyForTriage = (facts: ActivityFacts) => activityFactsCompleteness(facts) === 1;
