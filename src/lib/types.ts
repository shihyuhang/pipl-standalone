export type QualificationStatus =
  | "not_assessed"
  | "eligible"
  | "conditional"
  | "out_of_scope"
  | "needs_review";

export interface EnterpriseProfile {
  id: string;
  legalName: string;
  orgType: string;
  industry: string;
  businessModel: "B2B" | "B2C" | "both" | "internal_only" | "";
  ownership: string;
  processingRole: string;
  personCount: number | null;
  countVerified: boolean;
  subjectCategories: string[];
  sensitiveCategories: string[];
  minorsPossible: "yes" | "no" | "unknown";
  crossBorder: "yes" | "no" | "unknown";
  privacyContactName: string;
  privacyContactRole: string;
  privacyContactChannel: string;
  qualificationStatus: QualificationStatus;
  qualificationSummary: string;
  onboardingCompleted: boolean;
  updatedAt: string;
}

export interface QualificationInput {
  personCount: number | null;
  countVerified: boolean;
  sensitiveCategories: string[];
  minorsPossible: "yes" | "no" | "unknown";
  crossBorder: "yes" | "no" | "unknown";
  processingRole: string;
}

export interface QualificationResult {
  status: QualificationStatus;
  summary: string;
  reasons: string[];
  tasks: Array<{ code: string; title: string; description: string; priority: "normal" | "high" }>;
}

export interface DashboardData {
  enterprise: EnterpriseProfile;
  counts: { activities: number; openTasks: number; documents: number; completedTasks: number; audits: number; signedAudits: number; impactAssessments: number };
  tasks: TaskItem[];
  activities: ProcessingActivity[];
  documents: BusinessDocument[];
  recentEvents: AuditEvent[];
}

export interface TaskItem {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  priority: "normal" | "high";
  status: "open" | "in_progress" | "completed";
  createdAt: string;
  completedAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  activityId: string | null;
  handlingNote: string;
  evidenceNote: string;
  responsibleName: string;
  startedAt: string | null;
  completionMode: "manual" | "automatic";
  completionBasis: string;
}

export interface ProcessingActivity {
  id: string;
  scenarioCode: string;
  name: string;
  description: string;
  status: "draft" | "active" | "needs_review";
  completeness: number;
  facts: ActivityFacts;
  createdAt: string;
}

export type FactAnswer = "yes" | "no" | "unknown" | "";

export interface ActivityFacts {
  dataSubjects: string[];
  informationTypes: string[];
  purposes: string[];
  collectionChannels: string[];
  systems: string[];
  recipients: string[];
  approximatePersonCount: number | null;
  accessRoles: string[];
  systemOperators: string[];
  retentionPeriod: string;
  deletionMethod: string;
  rightsChannel: string;
  automatedDecision: FactAnswer;
  sensitiveInformation: FactAnswer;
  minorsInvolved: FactAnswer;
  crossBorderAccess: FactAnswer;
  notes: string;
  confirmedAt: string | null;
}

export interface BusinessDocument {
  id: string;
  name: string;
  type: string;
  scope: string;
  description: string;
  audience: string;
  audienceGroup: MaterialAudienceGroup;
  activityIds: string[];
  metadata: DocumentMetadata;
  healthStatus: DocumentHealthStatus;
  reviewReason: string;
  reviewDueAt: string | null;
  updatedAt: string;
  pendingImpacts?: DocumentChangeImpact[];
  currentVersionId: string | null;
  currentVersion?: DocumentVersion | null;
  versions?: DocumentVersion[];
}

export type MaterialAudienceGroup = "consumer" | "business_contact" | "employee" | "candidate" | "visitor" | "internal";

export type DocumentHealthStatus = "unpublished" | "current" | "needs_review" | "updating" | "pending_approval" | "overdue" | "archived";

export interface DocumentChangeImpact {
  id: string;
  documentId: string;
  sourceType: "activity_change" | "enterprise_change" | "manual";
  sourceId: string | null;
  changedFields: string[];
  reason: string;
  affectedSections: string[];
  status: "open" | "draft_created" | "no_change" | "deferred" | "resolved";
  resolutionNote: string;
  dueAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DocumentMetadata {
  materialType: string;
  modules: string[];
  generationBasis: string;
  generatedAt: string;
  requirementLevel?: "basic" | "conditional" | "evidence";
  trigger?: string;
  legalBasis?: string;
  generationMethod?: "ai" | "template";
  aiProvider?: string;
  aiModel?: string;
  aiPromptVersion?: string;
  aiRemoteRunId?: string | null;
  aiFallbackReason?: string;
  pendingFacts?: string[];
  aiRedactionCount?: number;
  aiExcludedFields?: string[];
  aiPreviewConfirmedAt?: string;
}

export type MaterialAiProvider = "auto" | "deepseek" | "qwen" | "kimi" | "custom" | "disabled";

export interface MaterialAiConfiguration {
  provider: MaterialAiProvider;
  apiBaseUrl: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string | null;
}

export interface MaterialAiRuntimeConfiguration {
  provider: Exclude<MaterialAiProvider, "auto" | "disabled">;
  apiBaseUrl: string;
  model: string;
  apiKey: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: string;
  status: "draft" | "under_review" | "approved" | "effective" | "superseded" | "archived";
  content: string;
  changeSummary: string;
  sourceVersionId: string | null;
  contentHash: string;
  factsSnapshot: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  approvedBy: string;
  approverRole: string;
  approvedAt: string | null;
  publishedBy: string;
  publishChannel: string;
  publicationEvidence: string;
  publishedAt: string | null;
}

export interface AuditEvent {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
}

export type AssessmentResultStatus = "draft_ready" | "needs_review" | "needs_input";
export type AssessmentValidity = "current" | "outdated";

export interface AssessmentFinding {
  id: string;
  assessmentId: string;
  title: string;
  description: string;
  riskLevel: "L0" | "L1" | "L2" | "L3";
  status: "open" | "task_created" | "resolved";
  taskId: string | null;
  createdAt: string;
}

export interface AssessmentRun {
  id: string;
  activityId: string;
  activityName: string;
  sequence: number;
  source: "deepseek" | "qwen" | "kimi" | "dify" | "local_rules";
  status: AssessmentResultStatus;
  summary: string;
  reviewRequired: boolean;
  warnings: string[];
  factsSnapshot: ActivityFacts;
  enterpriseSnapshot: Record<string, unknown>;
  workflowCode: string;
  workflowVersion: string;
  remoteRunId: string | null;
  validity: AssessmentValidity;
  invalidatedAt: string | null;
  createdAt: string;
  findings: AssessmentFinding[];
}

export type AuditConclusion = "unanswered" | "compliant" | "non_compliant" | "not_applicable";
export type FormStatus = "draft" | "collecting" | "remediation" | "ready_to_sign" | "signed" | "archived";

export interface AuditItemDefinition {
  code: string;
  number: number;
  groupCode: string;
  title: string;
  question: string;
  help: string;
  evidenceExamples: string[];
  /** 官方自查表该事项的引导语原文（附件1）。 */
  officialIntro?: string;
  /** 官方审查子项原文，顺序与官方（一）（二）（三）一致。 */
  officialSubItems?: string[];
}

export interface AuditSignal {
  tone: "positive" | "warning" | "neutral";
  text: string;
}

export interface AuditResponse {
  id: string;
  instanceId: string;
  itemCode: string;
  conclusion: AuditConclusion;
  explanation: string;
  evidenceNote: string;
  taskId: string | null;
  updatedAt: string;
  definition: AuditItemDefinition;
  signals: AuditSignal[];
}

export interface AuditInstance {
  id: string;
  title: string;
  status: FormStatus;
  templateVersion: string;
  progress: number;
  answeredCount: number;
  nonCompliantCount: number;
  responsibleName: string;
  responsibleRole: string;
  startedAt: string;
  updatedAt: string;
  signedAt: string | null;
  signedContentHash: string | null;
  contextSnapshot?: Record<string, unknown>;
  responses?: AuditResponse[];
  validationErrors?: string[];
}

export type PipiaCategoryCode = "P01" | "P02" | "P03" | "P04" | "P05";
export type YesNoNA = "unanswered" | "yes" | "no" | "not_applicable";
export type ImpactAnswer = "unanswered" | "has_impact" | "no_impact" | "not_applicable";

export interface PipiaResponse {
  id: string;
  instanceId: string;
  categoryCode: PipiaCategoryCode;
  categoryName: string;
  legality: YesNoNA;
  impact: ImpactAnswer;
  measureAdequacy: YesNoNA;
  notes: string;
  evidenceNote: string;
  taskId: string | null;
  updatedAt: string;
}

export interface PipiaInstance {
  id: string;
  activityId: string;
  activityName: string;
  status: FormStatus;
  categoryCodes: PipiaCategoryCode[];
  progress: number;
  responsibleName: string;
  responsibleRole: string;
  createdAt: string;
  updatedAt: string;
  signedAt: string | null;
  signedContentHash: string | null;
  contextSnapshot?: { enterprise: EnterpriseProfile; activity: ProcessingActivity } | null;
  responses?: PipiaResponse[];
  validationErrors?: string[];
}
