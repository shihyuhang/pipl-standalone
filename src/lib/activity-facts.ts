import type { ActivityFacts } from "./types";
import { normalizeSensitiveCategoryCodes } from "./sensitive-info.ts";
import { assessRetentionRisk } from "./retention-risk.ts";
import { activityOptionGroups } from "./scenario-guidance.ts";
import { hasExternalRecipient, hasMeaningfulExternalRecipientDetails, normalizedExternalProcessingRelationships } from "./external-processing.ts";

export function hasRequiredInformationTypeDetail(facts: Pick<ActivityFacts, "informationTypes">): boolean {
  if (!facts.informationTypes.includes("其他信息")) return facts.informationTypes.length > 0;
  return facts.informationTypes.some(value => !(activityOptionGroups.informationTypes as readonly string[]).includes(value));
}

export const emptyActivityFacts = (): ActivityFacts => ({
  dataSubjects: [],
  informationTypes: [],
  informationDetails: "",
  purposes: [],
  collectionChannels: [],
  systems: [],
  recipients: [],
  externalProcessingRelationships: [],
  externalRecipientDetails: "",
  approximatePersonCount: null,
  accessRoles: [],
  systemOperators: [],
  retentionPeriod: "",
  retentionBasis: "",
  deletionMethod: "",
  rightsChannel: "",
  automatedDecision: "",
  sensitiveInformation: "",
  sensitiveCategories: [],
  sensitiveNecessity: "",
  sensitiveRightsImpact: "",
  sensitiveProtectionMeasures: "",
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
  const sensitiveCategories = normalizeSensitiveCategoryCodes(source.sensitiveCategories);
  const minorsInvolved = answer(source.minorsInvolved);
  const sensitiveInformation = sensitiveCategories.length > 0 || minorsInvolved === "yes" ? "yes" : answer(source.sensitiveInformation);
  return {
    dataSubjects: array(source.dataSubjects),
    informationTypes: array(source.informationTypes),
    informationDetails: String(source.informationDetails || "").slice(0, 1500),
    purposes: array(source.purposes),
    collectionChannels: array(source.collectionChannels),
    systems: array(source.systems),
    recipients: array(source.recipients),
    externalProcessingRelationships: array(source.externalProcessingRelationships).filter(item => ["entrusted_processing", "independent_provision", "joint_processing", "statutory_disclosure", "unknown"].includes(item)) as ActivityFacts["externalProcessingRelationships"],
    externalRecipientDetails: String(source.externalRecipientDetails || "").slice(0, 1500),
    approximatePersonCount: hasPersonCount && Number.isFinite(Number(rawPersonCount)) && Number(rawPersonCount) >= 0
      ? Number(rawPersonCount) : null,
    accessRoles: array(source.accessRoles),
    systemOperators: array(source.systemOperators),
    retentionPeriod: String(source.retentionPeriod || "").slice(0, 500),
    retentionBasis: String(source.retentionBasis || "").slice(0, 1000),
    deletionMethod: String(source.deletionMethod || "").slice(0, 1000),
    rightsChannel: String(source.rightsChannel || "").slice(0, 500),
    automatedDecision: answer(source.automatedDecision),
    sensitiveInformation,
    sensitiveCategories,
    sensitiveNecessity: String(source.sensitiveNecessity || "").slice(0, 1500),
    sensitiveRightsImpact: String(source.sensitiveRightsImpact || "").slice(0, 1500),
    sensitiveProtectionMeasures: String(source.sensitiveProtectionMeasures || "").slice(0, 1500),
    minorsInvolved,
    crossBorderAccess: answer(source.crossBorderAccess),
    notes: String(source.notes || "").slice(0, 2000),
    confirmedAt: source.confirmedAt ? String(source.confirmedAt) : null
  };
}

export function activityFactsCompleteness(facts: ActivityFacts): number {
  const externalRelationships = normalizedExternalProcessingRelationships(facts);
  const externalRecipientReady = !hasExternalRecipient(facts) || (externalRelationships.length > 0
    && (externalRelationships.includes("unknown") || hasMeaningfulExternalRecipientDetails(facts.externalRecipientDetails)));
  const checks = [
    facts.dataSubjects.length > 0,
    hasRequiredInformationTypeDetail(facts),
    facts.purposes.length > 0,
    facts.collectionChannels.length > 0,
    facts.systems.length > 0,
    facts.recipients.length > 0 && externalRecipientReady,
    facts.approximatePersonCount !== null,
    facts.accessRoles.length > 0,
    facts.systemOperators.length > 0,
    facts.retentionPeriod.trim().length > 0 && String(facts.retentionBasis || "").trim().length >= 4
      && !assessRetentionRisk(facts.retentionPeriod, facts.retentionBasis).requiresBasis,
    facts.deletionMethod.trim().length > 0,
    facts.rightsChannel.trim().length > 0,
    facts.automatedDecision !== "",
    facts.sensitiveInformation !== "" && (facts.sensitiveInformation !== "yes" || (
      ((facts.sensitiveCategories?.length || 0) > 0 || facts.minorsInvolved === "yes")
      && String(facts.sensitiveNecessity || "").trim().length >= 8
      && String(facts.sensitiveRightsImpact || "").trim().length >= 8
      && String(facts.sensitiveProtectionMeasures || "").trim().length >= 8
    )),
    facts.minorsInvolved !== "",
    facts.crossBorderAccess !== ""
  ];
  const answered = checks.filter(Boolean).length;
  return Number((0.15 + 0.85 * answered / checks.length).toFixed(2));
}

export const isActivityReadyForTriage = (facts: ActivityFacts) => activityFactsCompleteness(facts) === 1;
