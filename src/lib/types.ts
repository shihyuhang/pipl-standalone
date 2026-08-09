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
  counts: { activities: number; openTasks: number; documents: number; completedTasks: number };
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
  retentionPeriod: string;
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
  currentVersionId: string | null;
  currentVersion?: DocumentVersion | null;
  versions?: DocumentVersion[];
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
