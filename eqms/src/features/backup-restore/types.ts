import { statusColors } from "@/components/ui/badge/statusColors";
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

/** One colour per part of a backup, so Database and Files are told apart at a glance wherever they are listed. */
export const CONTENT_COLOR: Record<string, "blue" | "emerald" | "amber"> = { DATABASE: "blue", OBJECT_STORE: "emerald", FILE_STORAGE: "emerald", CONFIGURATION: "amber" };

export const COMPONENT_LABEL: Record<BackupComponentKey, string> = {
  DATABASE: "Database (PostgreSQL)",
  OBJECT_STORE: "Document files (object storage)",
  FILE_STORAGE: "Application file storage",
  CONFIGURATION: "System settings",
};

export const BACKUP_STATUS_COLOR = statusColors("RUNNING", "COMPLETED", "FAILED", "EXPIRED");

export const VERIFICATION_COLOR = statusColors("VERIFIED", "NOT_VERIFIED", "FAILED");

export const statusLabel = (code: string) =>
  code
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

