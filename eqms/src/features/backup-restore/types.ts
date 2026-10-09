/**
 * Backup & Restore UI contract (preview).
 *
 * Machine values (status, type, scope, target) are stable codes; the labels below are display-only and must never be
 * sent to or read from the API. The backend does not exist yet, so these shapes are the proposal the API should meet.
 */

export type BackupComponentKey = "DATABASE" | "OBJECT_STORE" | "FILE_STORAGE" | "CONFIGURATION";
export type BackupType = "FULL" | "INCREMENTAL";
export type BackupTrigger = "SCHEDULED" | "MANUAL" | "PRE_CHANGE";
export type BackupStatus = "RUNNING" | "COMPLETED" | "FAILED" | "EXPIRED";
export type BackupVerification = "VERIFIED" | "NOT_VERIFIED" | "FAILED";

export interface BackupComponentResult {
  key: BackupComponentKey;
  status: "COMPLETED" | "FAILED" | "SKIPPED";
  sizeBytes: number;
  sha256?: string;
}

export interface BackupRecord {
  id: string;
  type: BackupType;
  trigger: BackupTrigger;
  status: BackupStatus;
  startedAt: string;
  /** Null while the backup is still running. */
  durationSec: number | null;
  sizeBytes: number | null;
  components: BackupComponentResult[];
  verification: BackupVerification;
  verifiedAt?: string;
  schemaVersion: string;
  /** Sample data only; real backups are kept for ever (decision BR-2) and carry `retention: "PERMANENT"`. */
  retentionUntil?: string;
  retention?: "PERMANENT";
  legalHold: boolean;
  createdBy: string;
  reason?: string | null;
  errorMessage?: string | null;
}

export type RestoreTarget = "VALIDATION_ENV" | "PRODUCTION" | "REBUILT_ENVIRONMENT";
export type RestoreKind = "RESTORE" | "DISASTER_RECOVERY";
export type RestoreStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "RUNNING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "CANCELLED";

export interface RestoreEvent {
  at: string;
  actor: string;
  action: string;
  note?: string;
}

export interface RestoreVerificationCheck {
  label: string;
  result: "PASS" | "FAIL" | "WARNING";
  detail: string;
}

export interface RestoreRequest {
  id: string;
  kind: RestoreKind;
  backupId: string;
  components: BackupComponentKey[];
  target: RestoreTarget;
  status: RestoreStatus;
  reason: string;
  changeControlRef?: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  completedAt?: string;
  events: RestoreEvent[];
  verification?: RestoreVerificationCheck[];
}

export const COMPONENT_LABEL: Record<BackupComponentKey, string> = {
  DATABASE: "Database (PostgreSQL)",
  OBJECT_STORE: "Document files (object storage)",
  FILE_STORAGE: "Application file storage",
  CONFIGURATION: "System configuration",
};

export const COMPONENT_HINT: Record<BackupComponentKey, string> = {
  DATABASE: "Records, workflow, audit trail, e-signatures, users and permissions.",
  OBJECT_STORE: "Revision source files, published PDFs, report artifacts and evidence uploads.",
  FILE_STORAGE: "Files kept on the application volume.",
  CONFIGURATION: "Non-secret settings and policies. Secrets are never included.",
};

export const BACKUP_STATUS_COLOR = {
  RUNNING: "blue",
  COMPLETED: "emerald",
  FAILED: "red",
  EXPIRED: "slate",
} as const;

export const RESTORE_STATUS_COLOR = {
  PENDING_APPROVAL: "amber",
  APPROVED: "blue",
  RUNNING: "blue",
  VERIFYING: "purple",
  COMPLETED: "emerald",
  FAILED: "red",
  REJECTED: "red",
  CANCELLED: "slate",
} as const;

export const VERIFICATION_COLOR = {
  VERIFIED: "emerald",
  NOT_VERIFIED: "amber",
  FAILED: "red",
} as const;

export const statusLabel = (code: string) =>
  code
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export interface AlertRule {
  event: string;
  label: string;
  hint: string;
  email: boolean;
  inApp: boolean;
  threshold?: { unit: string; value: number };
}

export interface VerificationCheckRule {
  code: string;
  label: string;
  hint: string;
  required: boolean;
}

export interface DrScenario {
  code: string;
  label: string;
  description: string;
  rpoHours: number;
  rtoHours: number;
}

export type DrDrillResult = "PASSED" | "PASSED_WITH_FINDINGS" | "FAILED";
export interface DrDrill {
  id: string;
  scenario: string;
  performedAt: string;
  lead: string;
  targetRtoHours: number;
  achievedRtoHours: number;
  result: DrDrillResult;
  findings: string;
}

export interface RebuildKitItem {
  code: string;
  label: string;
  detail: string;
  state: "CURRENT" | "STALE" | "MISSING";
  lastVerifiedAt?: string;
}
