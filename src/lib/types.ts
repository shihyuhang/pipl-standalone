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
  activityIds: string[];
  metadata: DocumentMetadata;
  currentVersionId: string | null;
  currentVersion?: DocumentVersion | null;
  versions?: DocumentVersion[];
}

export interface DocumentMetadata {
  materialType: string;
  modules: string[];
  generationBasis: string;
  generatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: string;
  status: "draft" | "under_review" | "effective" | "superseded" | "archived";
  content: string;
  changeSummary: string;
  createdAt: string;
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
