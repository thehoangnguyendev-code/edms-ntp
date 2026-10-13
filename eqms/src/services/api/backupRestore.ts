import { api } from "./client";
import type { BackupRecord, BackupType } from "@/features/backup-restore/types";

/** Machine values only (status, type, verification). Labels are made on screen and never sent back. */
export interface BackupListParams {
  search?: string;
  status?: string;
  type?: string;
  verification?: string;
  /** ISO instants; the range is inclusive. */
  startedFrom?: string;
  startedTo?: string;
  /** When the latest integrity check ran; a backup never checked is left out of a range. */
  checkedFrom?: string;
  checkedTo?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface BackupPage {
  data: BackupRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface BackupVerificationCheck {
  code: string;
  ok: boolean;
  detail: string;
}

export interface BackupDetail extends BackupRecord {
  locations: { target: string; path: string; ok: boolean }[];
  verifications: { tier: string; result: string; verified_at: string; verified_by: string; detail: string }[];
  errorCode?: string | null;
  changeControlRef?: string | null;
}

export interface BackupOverview {
  environment: string;
  completed: number;
  failed: number;
  running: number;
  notVerified: number;
  lastCompleted: { backupId: string; finishedAt: string; sizeBytes: number } | null;
  openAlerts: { id: string; at: string; severity: string; code: string; detail: string | null; ref: string | null }[];
  ledger: { ok: boolean; checked: number; reason: string | null; fileCopyCompared: boolean };
}

export interface BackupJob {
  id: string;
  job_type: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  result_json: string | null;
}

export interface BackupSchedulePolicy {
  version: number;
  status: string;
  /** JSON texts exactly as stored with the policy; read them with `JSON.parse`. */
  scope: string;
  schedule: string;
  retention: string;
  targets: string;
  /** When the next scheduled backup is due, and the time zone the schedule is read in. */
  nextDue: string | null;
  zone: string;
  lastScheduledRun: { backupId: string; status: string; startedAt: string } | null;
}

export interface ScheduleRowRecord {
  component: string;
  type: string;
  frequency: string;
  time: string;
  status: "ACTIVE" | "NOT_SCHEDULED";
}

export interface ScheduleRowParams {
  search?: string;
  status?: string;
  type?: string;
  frequency?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateBackupPayload {
  reason: string;
  type: Extract<BackupType, "FULL"> | "PRE_CHANGE";
  changeControlRef?: string;
}

const BASE = "/backup-restore";


/** Backup policy versions (Backup & Restore Administration > Backup Policy). Bodies are JSON text exactly as the agent stores them. */
export type PolicyStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED" | "DISCARDED";
export type PolicyMedium = "SERVER_FOLDER" | "NETWORK_SHARE" | "OBJECT_STORAGE" | "REMOVABLE_MEDIA";

export interface PolicyTarget {
  code: string;
  medium: PolicyMedium;
  role?: "PRIMARY" | "COPY";
  offsite: boolean;
  immutable: boolean;
}

export interface PolicyVersion {
  id: string;
  version: number;
  status: PolicyStatus;
  scope: string;
  schedule: string;
  retention: string;
  targets: string;
  proposedBy: string | null;
  approvedBy: string | null;
  reason: string | null;
  signatureRef: string | null;
  createdAt: string | null;
  activatedAt: string | null;
  sha256: string | null;
  gate: string | null;
  discardedBy: string | null;
  discardReason: string | null;
}

export interface PolicyListParams {
  search?: string;
  status?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PolicyGateCondition {
  code: string;
  ok: boolean;
  /** Not enforced in this environment (DEV only), shown but not blocking. */
  relaxed: boolean;
  /** Decided later, when the policy is activated. */
  pending: boolean;
  detail: string;
}

export interface PolicyGate {
  passed: boolean;
  enforced: boolean;
  conditions: PolicyGateCondition[];
}

export interface BackupTargetInfo {
  code: string;
  kind: "FOLDER" | "S3";
  immutable: boolean;
  location: string;
}

export interface ProposePolicyPayload {
  scope: { components: string[] };
  schedule: { database: { enabled: boolean; frequency: "DAILY"; time: string; type: "FULL" } };
  retention: { mode: "PERMANENT" };
  targets: { targets: PolicyTarget[] };
  reason: string;
}

export interface PolicyBody {
  components: string[];
  time: string;
  enabled: boolean;
  targets: PolicyTarget[];
}

/** Reads the JSON text of a version into what the screens show. Anything unreadable becomes empty rather than breaking the screen. */
export const readPolicyBody = (policy: Pick<PolicyVersion, "scope" | "schedule" | "targets">): PolicyBody => {
  const parse = (text: string): any => {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  };
  const scope = parse(policy.scope);
  const schedule = parse(policy.schedule);
  const targets = parse(policy.targets);
  return {
    components: Array.isArray(scope.components) ? scope.components : [],
    time: schedule?.database?.time ?? "",
    enabled: schedule?.database?.enabled ?? false,
    targets: Array.isArray(targets.targets) ? targets.targets.map((t: any) => ({ offsite: false, immutable: false, ...t })) : [],
  };
};

export const readPolicyGate = (policy: Pick<PolicyVersion, "gate">): PolicyGate | null => {
  if (!policy.gate) return null;
  try {
    const gate = JSON.parse(policy.gate);
    return { passed: !!gate.passed, enforced: !!gate.enforced, conditions: Array.isArray(gate.conditions) ? gate.conditions : [] };
  } catch {
    return null;
  }
};


/** Offline media and export packages (Backup & Restore Administration > Backup Storage & Encryption). Machine values only. */
export type MediaStatus = "AVAILABLE" | "IN_TRANSIT" | "STORED_OFFSITE" | "IN_READ_TEST" | "QUARANTINED" | "RETIRED";
export type MediaKind = "HDD" | "SSD" | "USB" | "TAPE";
export type ExportStatus = "REQUESTED" | "APPROVED" | "RUNNING" | "COMPLETED" | "INVALID" | "REJECTED";

export interface OfflineMedium {
  id: string;
  label: string;
  serialNumber: string;
  kind: MediaKind;
  capacityBytes: number;
  exportDir: string;
  status: MediaStatus;
  holder: string | null;
  storageLocation: string | null;
  handedOverAt: string | null;
  lastReadTestAt: string | null;
  lastReadTestResult: "PASSED" | "FAILED" | null;
  expiresOn: string | null;
  destructionRecord: string | null;
  holdsLegalHold: boolean;
  registeredBy: string;
  createdAt: string | null;
  packageCount: number;
}

export interface MediaEvent {
  event: string;
  by: string;
  at: string;
  detail: string | null;
}

export interface MediaPackage {
  exportId: string;
  backupId: string;
  finishedAt: string;
  sizeBytes: number;
  receiptSha256: string | null;
}

export interface BackupExport {
  id: string;
  exportId: string;
  backupId: string;
  mediaId: string;
  mediaLabel: string;
  status: ExportStatus;
  requestedBy: string;
  reason: string;
  requestedAt: string | null;
  approvedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  estimatedBytes: number | null;
  sizeBytes: number | null;
  fileCount: number | null;
  receiptSha256: string | null;
  packagePath: string | null;
  errorCode: string | null;
  errorDetail: string | null;
}

export interface MediaListParams {
  search?: string;
  status?: string;
  kind?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ExportListParams {
  search?: string;
  status?: string;
  backupId?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface RegisterMediumPayload {
  label: string;
  serialNumber: string;
  kind: MediaKind;
  capacityBytes: number;
  exportDir: string;
  expiresOn?: string;
}

export interface TargetTestResult {
  target: string;
  ok: boolean;
  steps: { name: string; ok: boolean; detail: string }[];
}

export interface EncryptionFacts {
  scheme: string;
  cipher: string;
  signingAlgorithm: string;
  signingKeyId: string;
  available: boolean;
  recipientKeyId?: string;
  fingerprint?: string;
  encryptionKeyIds?: string[];
  problem?: string;
  agentCanDecrypt: boolean;
}

type Paged<T> = { data: T[]; pagination: BackupPage["pagination"] };


/** A test restore of a backup into a scratch database (SDS 14.1). Machine values only. */
export interface RestoreRehearsal {
  id: string;
  rehearsalId: string;
  backupId: string;
  status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED";
  requestedBy: string;
  reason: string;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  restoreSeconds: number | null;
  errorCode: string | null;
  errorDetail: string | null;
  checkCount: number;
  failedCount: number;
  /** Only in the single-rehearsal read; the list carries the counts. */
  checks?: { code: string; title: string; required: boolean; ok: boolean; detail: string | null; checkedAt: string }[];
}

export interface RehearsalListParams {
  search?: string;
  status?: string;
  backupId?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}


/** A restore request (SDS 11.3, steps R0-R3). Execution (R4-R12) is not built: an approved request is a record, not a running restore. */
export type RestoreRequestType = "R-FULL" | "R-DB" | "R-OBJ" | "R-ONE";
export type RestoreRequestTarget = "VALIDATION" | "PRODUCTION";
export type RestoreRequestStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface RestoreImpact {
  backupId: string;
  measuredAt: string;
  measuredBy: string;
  dbSnapshotAt: string | null;
  schemaVersion: string | null;
  components: { key: string; sizeBytes: number; objectCount: number | null; rows?: number }[];
  rowsInBackup: number;
  targets: { target: string; ok: boolean }[];
  liveRowsAfterBackup: { measured: boolean; auditRows?: number; reason?: string; note?: string };
}

export interface RestoreRequestRecord {
  id: string;
  requestId: string;
  backupId: string;
  type: RestoreRequestType;
  target: RestoreRequestTarget;
  status: RestoreRequestStatus;
  reason: string;
  changeControlRef: string | null;
  requestedBy: string;
  requestedAt: string | null;
  impactSha256: string | null;
  impact: RestoreImpact | null;
  rehearsalId: string | null;
  approvedBy: string | null;
  approvalSignatureRef: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  events?: { event: string; by: string; at: string }[];
}

export interface RestoreRequestListParams {
  search?: string;
  status?: string;
  target?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** The test restore queued in the window, with the outcome of its rehearsal and the checks it ran. */
export interface RestoreTestRestore {
  rehearsalId: string;
  status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED";
  requestedBy: string;
  errorCode: string | null;
  errorDetail: string | null;
  checks: { code: string; title: string; required: boolean; ok: boolean; detail: string; checkedAt?: string }[];
}

/** The checks before a restore runs, and its schedule if one exists (SDS 11.3, R4). Read on the server. */
export interface RestoreExecutionChecks {
  requestId: string;
  status: RestoreRequestStatus;
  checks: { code: string; ok: boolean; detail: string }[];
  readyToSchedule: boolean;
  schedule: { id: string; status: string; windowStart: string; scheduledBy: string; scheduledAt: string } | null;
  /** The state of the whole system, and the request that holds it when it is locked for a restore. */
  systemState: string;
  systemRequestId: string | null;
  testRestore: RestoreTestRestore | null;
  notCheckedYet: string[];
}

/** Decided on the server: the passed test restore of a backup that is recent enough for a production request, or null. */
export interface RestoreReadiness {
  backupId: string;
  maxAgeDays: number;
  testRestore: { rehearsalId: string; finishedAt: string } | null;
}

export interface CreateRestoreRequestPayload {
  type: RestoreRequestType;
  target: RestoreRequestTarget;
  reason: string;
  changeControlRef?: string;
}

/** The signed evidence pack of one restore request (SDS 16): the canonical text, its SHA-256, the signature and the key id. */
export interface RestoreEvidencePack {
  pack: string;
  sha256: string;
  signature: string;
  keyId: string;
}

/** Backup Inspection (SDS 7.2): a read-only copy of one verified backup, open for five minutes. */
export type InspectionStatus = "PENDING_APPROVAL" | "REJECTED" | "APPROVED" | "OPENING" | "OPEN" | "CLOSED" | "FAILED";

export interface InspectionRecord {
  id: string;
  inspectionId: string;
  backupId: string;
  status: InspectionStatus;
  reason: string;
  requestedBy: string;
  requestedAt: string | null;
  approvedBy: string | null;
  approvalSignatureRef: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  scratchDb: string | null;
  openedAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closeReason: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  events?: { event: string; by: string; at: string }[];
  checks?: { code: string; title: string; required: boolean; ok: boolean; detail: string | null }[];
}

export interface InspectionListParams {
  search?: string;
  status?: InspectionStatus;
  page?: number;
  limit?: number;
}

export const backupRestoreApi = {
  overview: async (): Promise<BackupOverview> => (await api.get<BackupOverview>(`${BASE}/overview`)).data,

  list: async (params?: BackupListParams): Promise<BackupPage> => (await api.get<BackupPage>(`${BASE}/backups`, { params })).data,

  get: async (backupId: string): Promise<BackupDetail> => (await api.get<BackupDetail>(`${BASE}/backups/${encodeURIComponent(backupId)}`)).data,

  create: async (payload: CreateBackupPayload): Promise<{ jobId: string }> => (await api.post<{ jobId: string }>(`${BASE}/backups`, payload)).data,

  verify: async (backupId: string): Promise<{ jobId: string }> =>
    (await api.post<{ jobId: string }>(`${BASE}/backups/${encodeURIComponent(backupId)}/verify`)).data,

  job: async (jobId: string): Promise<BackupJob> => (await api.get<BackupJob>(`${BASE}/jobs/${encodeURIComponent(jobId)}`)).data,

  scheduleRows: async (params?: ScheduleRowParams): Promise<{ data: ScheduleRowRecord[]; pagination: BackupPage["pagination"] }> =>
    (await api.get<{ data: ScheduleRowRecord[]; pagination: BackupPage["pagination"] }>(`${BASE}/schedules/rows`, { params })).data,

  schedules: async (): Promise<BackupSchedulePolicy> => (await api.get<BackupSchedulePolicy>(`${BASE}/schedules`)).data,

  targets: async (): Promise<BackupTargetInfo[]> => (await api.get<BackupTargetInfo[]>(`${BASE}/targets`)).data,

  policies: async (params?: PolicyListParams): Promise<{ data: PolicyVersion[]; pagination: BackupPage["pagination"] }> =>
    (await api.get<{ data: PolicyVersion[]; pagination: BackupPage["pagination"] }>(`${BASE}/policies`, { params })).data,

  policy: async (version: number): Promise<PolicyVersion> => (await api.get<PolicyVersion>(`${BASE}/policies/${version}`)).data,

  policyGate: async (version: number): Promise<PolicyGate> => (await api.get<PolicyGate>(`${BASE}/policies/${version}/gate`)).data,

  proposePolicy: async (payload: ProposePolicyPayload): Promise<PolicyVersion> => (await api.post<PolicyVersion>(`${BASE}/policies`, payload)).data,

  activatePolicy: async (version: number, signatureToken: string): Promise<PolicyVersion> =>
    (await api.post<PolicyVersion>(`${BASE}/policies/${version}/activate`, { signatureToken })).data,

  discardPolicy: async (version: number, reason: string): Promise<PolicyVersion> =>
    (await api.post<PolicyVersion>(`${BASE}/policies/${version}/discard`, { reason })).data,

  rehearsals: async (params?: RehearsalListParams): Promise<Paged<RestoreRehearsal>> => (await api.get<Paged<RestoreRehearsal>>(`${BASE}/rehearsals`, { params })).data,

  rehearsal: async (rehearsalId: string): Promise<RestoreRehearsal> => (await api.get<RestoreRehearsal>(`${BASE}/rehearsals/${encodeURIComponent(rehearsalId)}`)).data,

  requestRehearsal: async (backupId: string, reason: string): Promise<RestoreRehearsal> =>
    (await api.post<RestoreRehearsal>(`${BASE}/backups/${encodeURIComponent(backupId)}/rehearsals`, { reason })).data,

  restoreRequests: async (params?: RestoreRequestListParams): Promise<Paged<RestoreRequestRecord>> =>
    (await api.get<Paged<RestoreRequestRecord>>(`${BASE}/restores`, { params })).data,

  restoreRequest: async (requestId: string): Promise<RestoreRequestRecord> =>
    (await api.get<RestoreRequestRecord>(`${BASE}/restores/${encodeURIComponent(requestId)}`)).data,

  restoreEvidence: async (requestId: string): Promise<RestoreEvidencePack> =>
    (await api.get<RestoreEvidencePack>(`${BASE}/restores/${encodeURIComponent(requestId)}/evidence`)).data,

  restoreReadiness: async (backupId: string): Promise<RestoreReadiness> =>
    (await api.get<RestoreReadiness>(`${BASE}/backups/${encodeURIComponent(backupId)}/restore-readiness`)).data,

  restoreExecution: async (requestId: string): Promise<RestoreExecutionChecks> =>
    (await api.get<RestoreExecutionChecks>(`${BASE}/restores/${encodeURIComponent(requestId)}/execution`)).data,

  scheduleRestore: async (requestId: string, windowStart: string): Promise<RestoreExecutionChecks> =>
    (await api.post<RestoreExecutionChecks>(`${BASE}/restores/${encodeURIComponent(requestId)}/schedule`, { windowStart })).data,

  startTestRestore: async (requestId: string): Promise<{ requestId: string; rehearsalId: string; status: string }> =>
    (await api.post<{ requestId: string; rehearsalId: string; status: string }>(`${BASE}/restores/${encodeURIComponent(requestId)}/test-restore`, {})).data,

  enterRestoreWindow: async (requestId: string, noUserConfirmed: boolean): Promise<{ requestId: string; systemState: string }> =>
    (await api.post<{ requestId: string; systemState: string }>(`${BASE}/restores/${encodeURIComponent(requestId)}/enter-window`, { noUserConfirmed })).data,

  createRestoreRequest: async (backupId: string, payload: CreateRestoreRequestPayload): Promise<RestoreRequestRecord> =>
    (await api.post<RestoreRequestRecord>(`${BASE}/backups/${encodeURIComponent(backupId)}/restores`, payload)).data,

  approveRestoreRequest: async (requestId: string, signatureToken: string): Promise<RestoreRequestRecord> =>
    (await api.post<RestoreRequestRecord>(`${BASE}/restores/${encodeURIComponent(requestId)}/approve`, { signatureToken })).data,

  rejectRestoreRequest: async (requestId: string, reason: string, signatureToken: string): Promise<RestoreRequestRecord> =>
    (await api.post<RestoreRequestRecord>(`${BASE}/restores/${encodeURIComponent(requestId)}/reject`, { reason, signatureToken })).data,

  inspections: async (params?: InspectionListParams): Promise<Paged<InspectionRecord>> =>
    (await api.get<Paged<InspectionRecord>>(`${BASE}/inspections`, { params })).data,

  inspection: async (inspectionId: string): Promise<InspectionRecord> =>
    (await api.get<InspectionRecord>(`${BASE}/inspections/${encodeURIComponent(inspectionId)}`)).data,

  askInspection: async (backupId: string, reason: string): Promise<InspectionRecord> =>
    (await api.post<InspectionRecord>(`${BASE}/backups/${encodeURIComponent(backupId)}/inspections`, { reason })).data,

  approveInspection: async (inspectionId: string, signatureToken: string): Promise<InspectionRecord> =>
    (await api.post<InspectionRecord>(`${BASE}/inspections/${encodeURIComponent(inspectionId)}/approve`, { signatureToken })).data,

  rejectInspection: async (inspectionId: string, reason: string, signatureToken: string): Promise<InspectionRecord> =>
    (await api.post<InspectionRecord>(`${BASE}/inspections/${encodeURIComponent(inspectionId)}/reject`, { reason, signatureToken })).data,

  closeInspection: async (inspectionId: string, reason: string): Promise<InspectionRecord> =>
    (await api.post<InspectionRecord>(`${BASE}/inspections/${encodeURIComponent(inspectionId)}/close`, { reason })).data,

  encryption: async (): Promise<EncryptionFacts> => (await api.get<EncryptionFacts>(`${BASE}/encryption`)).data,

  testTarget: async (code: string): Promise<TargetTestResult> => (await api.post<TargetTestResult>(`${BASE}/targets/${encodeURIComponent(code)}/test`)).data,

  media: async (params?: MediaListParams): Promise<Paged<OfflineMedium>> => (await api.get<Paged<OfflineMedium>>(`${BASE}/media`, { params })).data,
  medium: async (id: string): Promise<OfflineMedium> => (await api.get<OfflineMedium>(`${BASE}/media/${encodeURIComponent(id)}`)).data,
  mediumEvents: async (id: string): Promise<MediaEvent[]> => (await api.get<MediaEvent[]>(`${BASE}/media/${encodeURIComponent(id)}/events`)).data,
  mediumPackages: async (id: string): Promise<MediaPackage[]> => (await api.get<MediaPackage[]>(`${BASE}/media/${encodeURIComponent(id)}/packages`)).data,
  registerMedium: async (payload: RegisterMediumPayload): Promise<OfflineMedium> => (await api.post<OfflineMedium>(`${BASE}/media`, payload)).data,
  handoverMedium: async (id: string, holder: string, location: string): Promise<OfflineMedium> =>
    (await api.post<OfflineMedium>(`${BASE}/media/${encodeURIComponent(id)}/handover`, { holder, location })).data,
  receiveMedium: async (id: string): Promise<OfflineMedium> => (await api.post<OfflineMedium>(`${BASE}/media/${encodeURIComponent(id)}/receive`)).data,
  readTestMedium: async (id: string, result: "PASSED" | "FAILED", detail: string): Promise<OfflineMedium> =>
    (await api.post<OfflineMedium>(`${BASE}/media/${encodeURIComponent(id)}/read-test`, { result, detail })).data,
  recycleMedium: async (id: string, wipeConfirmed: boolean, reason: string): Promise<OfflineMedium> =>
    (await api.post<OfflineMedium>(`${BASE}/media/${encodeURIComponent(id)}/recycle`, { wipeConfirmed, reason })).data,
  retireMedium: async (id: string, destructionRecord: string): Promise<OfflineMedium> =>
    (await api.post<OfflineMedium>(`${BASE}/media/${encodeURIComponent(id)}/retire`, { destructionRecord })).data,

  exports: async (params?: ExportListParams): Promise<Paged<BackupExport>> => (await api.get<Paged<BackupExport>>(`${BASE}/exports`, { params })).data,
  exportEstimate: async (backupId: string): Promise<{ backupId: string; estimatedBytes: number; fileCount: number }> =>
    (await api.get<{ backupId: string; estimatedBytes: number; fileCount: number }>(`${BASE}/backups/${encodeURIComponent(backupId)}/export-estimate`)).data,
  requestExport: async (backupId: string, mediaId: string, reason: string): Promise<BackupExport> =>
    (await api.post<BackupExport>(`${BASE}/backups/${encodeURIComponent(backupId)}/exports`, { mediaId, reason })).data,
  approveExport: async (exportId: string): Promise<BackupExport> => (await api.post<BackupExport>(`${BASE}/exports/${encodeURIComponent(exportId)}/approve`)).data,
  rejectExport: async (exportId: string, reason: string): Promise<BackupExport> =>
    (await api.post<BackupExport>(`${BASE}/exports/${encodeURIComponent(exportId)}/reject`, { reason })).data,
};

/**
 * Waits for the agent to finish a queued job. A backup can take minutes, so this polls gently and gives up with the last
 * known state instead of hanging: the backup itself carries on and shows up in the list.
 */
export const waitForBackupJob = async (jobId: string, intervalMs = 2500, maxMs = 10 * 60 * 1000): Promise<BackupJob> => {
  const started = Date.now();
  for (;;) {
    const job = await backupRestoreApi.job(jobId);
    if (job.status === "DONE" || job.status === "FAILED") return job;
    if (Date.now() - started > maxMs) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};
