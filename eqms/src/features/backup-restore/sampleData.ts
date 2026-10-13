import type {
  AlertRule,
  BackupComponentKey,
  DrDrill,
  DrScenario,
  RebuildKitItem,
  VerificationCheckRule,
  BackupRecord,
  RestoreRequest,
} from "./types";

/**
 * SAMPLE DATA for the UI preview only. Nothing here is read from the server; replace with the Backup & Restore API
 * once it exists. Every screen that shows it carries the "Preview" banner.
 */

const GB = 1024 ** 3;

const components = (db: number, objects: number, files: number, config: number, failed?: BackupComponentKey) =>
  [
    { key: "DATABASE", sizeBytes: db },
    { key: "OBJECT_STORE", sizeBytes: objects },
    { key: "FILE_STORAGE", sizeBytes: files },
    { key: "CONFIGURATION", sizeBytes: config },
  ].map((c, index) => ({
    key: c.key as BackupComponentKey,
    status: c.key === failed ? ("FAILED" as const) : ("COMPLETED" as const),
    sizeBytes: c.key === failed ? 0 : c.sizeBytes,
    sha256: c.key === failed ? undefined : `${(index + 3).toString(16).repeat(8)}a91c0e7d54b2f6803d1e9b47c52a68f0e13d7b9a4c5e82f1d60b3a79c48e5d2`.slice(0, 64),
  }));

export const SAMPLE_BACKUPS: BackupRecord[] = [
  {
    id: "BK-20261007-0200",
    type: "FULL",
    trigger: "SCHEDULED",
    status: "COMPLETED",
    startedAt: "2026-10-07T02:00:00",
    durationSec: 1480,
    sizeBytes: Math.round(41.6 * GB),
    components: components(6.2 * GB, 33.9 * GB, 1.4 * GB, 0.0001 * GB),
    verification: "VERIFIED",
    verifiedAt: "2026-10-07T02:31:00",
    schemaVersion: "V542",
    retentionUntil: "2027-01-05",
    legalHold: false,
    createdBy: "System scheduler",
  },
  {
    id: "BK-20261006-0200",
    type: "INCREMENTAL",
    trigger: "SCHEDULED",
    status: "COMPLETED",
    startedAt: "2026-10-06T02:00:00",
    durationSec: 410,
    sizeBytes: Math.round(1.9 * GB),
    components: components(0.7 * GB, 1.2 * GB, 0.02 * GB, 0.0001 * GB),
    verification: "VERIFIED",
    verifiedAt: "2026-10-06T02:12:00",
    schemaVersion: "V542",
    retentionUntil: "2027-01-04",
    legalHold: false,
    createdBy: "System scheduler",
  },
  {
    id: "BK-20261005-1530",
    type: "FULL",
    trigger: "PRE_CHANGE",
    status: "COMPLETED",
    startedAt: "2026-10-05T15:30:00",
    durationSec: 1512,
    sizeBytes: Math.round(41.2 * GB),
    components: components(6.1 * GB, 33.7 * GB, 1.4 * GB, 0.0001 * GB),
    verification: "NOT_VERIFIED",
    schemaVersion: "V541",
    retentionUntil: "2027-04-05",
    legalHold: true,
    createdBy: "Nguyen Van An",
    reason: "Before releasing database migration V542",
  },
  {
    id: "BK-20261004-0200",
    type: "INCREMENTAL",
    trigger: "SCHEDULED",
    status: "FAILED",
    startedAt: "2026-10-04T02:00:00",
    durationSec: 95,
    sizeBytes: Math.round(0.7 * GB),
    components: components(0.7 * GB, 0, 0, 0.0001 * GB, "OBJECT_STORE"),
    verification: "FAILED",
    schemaVersion: "V541",
    retentionUntil: "2027-01-02",
    legalHold: false,
    createdBy: "System scheduler",
    errorMessage: "Object storage was unreachable after 3 attempts (timeout).",
  },
  {
    id: "BK-20260930-1015",
    type: "FULL",
    trigger: "MANUAL",
    status: "COMPLETED",
    startedAt: "2026-09-30T10:15:00",
    durationSec: 1466,
    sizeBytes: Math.round(40.8 * GB),
    components: components(6.0 * GB, 33.4 * GB, 1.4 * GB, 0.0001 * GB),
    verification: "VERIFIED",
    verifiedAt: "2026-09-30T10:48:00",
    schemaVersion: "V541",
    retentionUntil: "2026-12-29",
    legalHold: false,
    createdBy: "Tran Thi Binh",
    reason: "Quarterly archive before periodic review",
  },
  {
    id: "BK-20260701-0200",
    type: "FULL",
    trigger: "SCHEDULED",
    status: "EXPIRED",
    startedAt: "2026-07-01T02:00:00",
    durationSec: 1390,
    sizeBytes: Math.round(37.5 * GB),
    components: components(5.4 * GB, 30.8 * GB, 1.3 * GB, 0.0001 * GB),
    verification: "VERIFIED",
    verifiedAt: "2026-07-01T02:29:00",
    schemaVersion: "V520",
    retentionUntil: "2026-09-29",
    legalHold: false,
    createdBy: "System scheduler",
  },
];

export const SAMPLE_RESTORES: RestoreRequest[] = [
  {
    id: "RS-20261008-001",
    kind: "RESTORE",
    backupNumber: "BK-20261007-0200",
    components: ["DATABASE", "OBJECT_STORE"],
    target: "PRODUCTION",
    status: "PENDING_APPROVAL",
    reason: "Controlled copy register corrupted after a failed bulk update; restore needed to recover.",
    changeControlRef: "CC-2026-0142",
    requestedBy: "Le Van Cuong",
    requestedAt: "2026-10-07T09:20:00",
    events: [
      { at: "2026-10-07T09:20:00", actor: "Le Van Cuong", action: "Restore requested", note: "Change control CC-2026-0142" },
    ],
  },
  {
    id: "RS-20260928-001",
    kind: "RESTORE",
    backupNumber: "BK-20260930-1015",
    components: ["DATABASE", "OBJECT_STORE", "FILE_STORAGE", "CONFIGURATION"],
    target: "VALIDATION_ENV",
    status: "COMPLETED",
    reason: "Quarterly restore drill.",
    requestedBy: "Tran Thi Binh",
    requestedAt: "2026-10-01T08:00:00",
    decidedBy: "Pham Quoc Dung",
    decidedAt: "2026-10-01T08:30:00",
    completedAt: "2026-10-01T10:05:00",
    events: [
      { at: "2026-10-01T08:00:00", actor: "Tran Thi Binh", action: "Restore requested" },
      { at: "2026-10-01T08:30:00", actor: "Pham Quoc Dung", action: "Approved" },
      { at: "2026-10-01T08:40:00", actor: "System", action: "Restore started" },
      { at: "2026-10-01T09:35:00", actor: "System", action: "Restore finished, verification started" },
      { at: "2026-10-01T10:05:00", actor: "System", action: "Verification completed" },
    ],
    verification: [
      { label: "Database schema matches backup", result: "PASS", detail: "Flyway state V541 equals the backup." },
      { label: "Row counts match the backup manifest", result: "PASS", detail: "148 tables compared, 0 differences." },
      { label: "Database records and stored files agree", result: "PASS", detail: "12,408 files checked, 0 missing, 0 checksum mismatches." },
      { label: "Audit trail continuity", result: "PASS", detail: "Audit sequence is continuous up to the backup time." },
      { label: "Documents open and download", result: "WARNING", detail: "1 of 20 sampled files was slow to open (>5 s)." },
    ],
  },
  {
    id: "RS-20260815-001",
    kind: "RESTORE",
    backupNumber: "BK-20260701-0200",
    components: ["DATABASE"],
    target: "PRODUCTION",
    status: "REJECTED",
    reason: "Wanted to revert a policy change.",
    requestedBy: "Le Van Cuong",
    requestedAt: "2026-08-15T14:00:00",
    decidedBy: "Pham Quoc Dung",
    decidedAt: "2026-08-15T15:10:00",
    events: [
      { at: "2026-08-15T14:00:00", actor: "Le Van Cuong", action: "Restore requested" },
      { at: "2026-08-15T15:10:00", actor: "Pham Quoc Dung", action: "Rejected", note: "A policy change is reverted through Save Changes, not a restore." },
    ],
  },
];

/** Static figures for the Overview preview. */
export const SAMPLE_OVERVIEW = {
  nextScheduledAt: "2026-10-08T02:00:00",
  lastDrillAt: "2026-10-01T10:05:00",
  drillIntervalDays: 90,
  repositoryUsedGb: 214,
  repositoryCapacityGb: 500,
  currentSchemaVersion: "V542",
  rpoTargetHours: 24,
  lastOffsiteCopyAt: "2026-10-05T03:10:00",
  lastDrDrillAt: "2026-06-12T14:00:00",
  drDrillIntervalDays: 365,
};



export const SAMPLE_ALERT_RULES: AlertRule[] = [
  { event: "BACKUP_FAILED", label: "A backup fails", hint: "After the configured retries are used up.", email: true, inApp: true },
  { event: "BACKUP_MISSED", label: "A scheduled backup did not start", hint: "The scheduler was down or the job did not run.", email: true, inApp: true },
  { event: "VERIFICATION_FAILED", label: "Integrity verification fails", hint: "A checksum does not match.", email: true, inApp: true },
  { event: "DRILL_OVERDUE", label: "A restore drill is overdue", hint: "Days past the drill interval.", email: true, inApp: true, threshold: { unit: "days late", value: 0 } },
  { event: "CAPACITY_HIGH", label: "Backup storage is nearly full", hint: "Share of capacity used.", email: true, inApp: false, threshold: { unit: "% used", value: 80 } },
  { event: "RESTORE_PENDING", label: "A restore request waits for approval", hint: "Sent to the approvers.", email: true, inApp: true },
];

export const SAMPLE_VERIFICATION_CHECKS: VerificationCheckRule[] = [
  { code: "SCHEMA_MATCH", label: "Database schema matches the backup", hint: "Flyway state equals the backup manifest.", required: true },
  { code: "ROW_COUNTS", label: "Row counts match the backup manifest", hint: "Every table is compared.", required: true },
  { code: "FILE_RECONCILIATION", label: "Database records and stored files agree", hint: "Every record points to a file whose checksum matches.", required: true },
  { code: "AUDIT_CONTINUITY", label: "Audit trail continuity", hint: "No gap in the audit sequence up to the backup time.", required: true },
  { code: "SAMPLE_OPEN", label: "Sampled documents open and download", hint: "A random sample is opened end to end.", required: false },
];

export const SAMPLE_DR_SCENARIOS: DrScenario[] = [
  { code: "DATA_CORRUPTION", label: "Data corruption, server intact", description: "Records damaged or wrongly changed; hardware is fine.", rpoHours: 24, rtoHours: 8 },
  { code: "SERVER_LOSS", label: "Server lost, site intact", description: "Hardware failure; a replacement server is available on site.", rpoHours: 24, rtoHours: 24 },
  { code: "SITE_LOSS", label: "Site lost", description: "Fire, flood or loss of the building; rebuild elsewhere from off-site copies.", rpoHours: 24, rtoHours: 72 },
  { code: "RANSOMWARE", label: "Ransomware or malicious deletion", description: "Servers and nearby backups cannot be trusted; recover from the immutable copy.", rpoHours: 24, rtoHours: 72 },
];

export const SAMPLE_REBUILD_KIT: RebuildKitItem[] = [
  { code: "DEPLOY_FILES", label: "Deployment files and pinned image versions", detail: "Compose files and every container image stored offline, no internet needed.", state: "CURRENT", lastVerifiedAt: "2026-09-30T00:00:00" },
  { code: "RUNBOOK", label: "Step-by-step rebuild procedure", detail: "Version 1.2, printed copy kept off-site.", state: "STALE", lastVerifiedAt: "2025-08-01T00:00:00" },
  { code: "SECRETS", label: "Operational secrets escrow", detail: "Database, storage and signing secrets held by two named people.", state: "CURRENT", lastVerifiedAt: "2026-09-15T00:00:00" },
  { code: "BACKUP_KEY", label: "Backup encryption key custody", detail: "Kept apart from the backups; without it a backup cannot be read.", state: "MISSING" },
];

export const SAMPLE_DR_DRILLS: DrDrill[] = [
  {
    id: "DR-20260612-001",
    scenario: "SERVER_LOSS",
    performedAt: "2026-06-12T14:00:00",
    lead: "Pham Quoc Dung",
    targetRtoHours: 24,
    achievedRtoHours: 19.5,
    result: "PASSED_WITH_FINDINGS",
    findings: "Rebuild procedure had two outdated steps; fixed in the next version.",
  },
  {
    id: "DR-20250911-001",
    scenario: "SITE_LOSS",
    performedAt: "2025-09-11T09:00:00",
    lead: "Le Van Cuong",
    targetRtoHours: 72,
    achievedRtoHours: 81,
    result: "FAILED",
    findings: "Off-site copy was 6 hours older than the RPO and the images had to be downloaded.",
  },
];
