import { api } from "./client";
import type { BackupRecord, BackupType } from "@/features/backup-restore/types";

/** Machine values only (status, type, verification). Labels are made on screen and never sent back. */
export interface BackupListParams {
  search?: string;
  status?: string;
  type?: string;
  verification?: string;
  /** How the backup was started (SCHEDULED, MANUAL, PRE_CHANGE) and a part it contains (CONFIGURATION, DATABASE, OBJECT_STORE). */
  trigger?: string;
  component?: string;
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

export interface BackupDetail extends BackupRecord {
  /** The stages of the backup, worked out on the server from its status and verification; the screen only draws them. */
  workflow?: import("@/types/document").WorkflowProgress;
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
  lastCompleted: { backupNumber: string; finishedAt: string; sizeBytes: number } | null;
  openAlerts: { id: string; at: string; severity: string; code: string; detail: string | null; ref: string | null }[];
  ledger: { ok: boolean; checked: number; reason: string | null; fileCopyCompared: boolean };
}

/** One day of the overview chart. `completed` includes `notVerified`; `failed` is separate. */
export interface BackupDailyPoint {
  date: string;
  completed: number;
  failed: number;
  notVerified: number;
}

export interface BackupJob {
  id: string;
  job_type: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  /** How far the agent has got, 0-100. The agent reports it as it works; it is never estimated on the screen. */
  progress?: number;
  /** The checks of a verification finished so far (a JSON list of IntegrityCheckResult), filled in while the job runs. */
  steps_json?: string | null;
  result_json: string | null;
}

/** One check of an integrity check, as the agent recorded it. */
export interface IntegrityCheckResult {
  code: string;
  ok: boolean;
  detail: string;
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
  lastScheduledRun: { backupNumber: string; status: string; startedAt: string } | null;
}

export interface ScheduleRowRecord {
  component: string;
  type: string;
  frequency: string;
  time: string;
  status: "ACTIVE" | "NOT_SCHEDULED";
  /** Why the row is as it is (for example that the files follow the database schedule). */
  note?: string;
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

/** The parts a backup can hold: the settings, the whole database, the stored files. A backup holds one or more of them. */
/** The parts a backup can be made of and restored in. Backups made before 2026-11-11 may also hold a separate settings part; it is shown but not offered. */
export type BackupPart = "DATABASE" | "OBJECT_STORE";

export interface CreateBackupPayload {
  reason: string;
  type: Extract<BackupType, "FULL"> | "PRE_CHANGE";
  changeControlRef?: string;
  /** At least one. Left out, the backup holds what the active policy covers. */
  components?: BackupPart[];
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
  /** DATABASE or OBJECT_STORE: versions that back it up. */
  component?: string;
  /** A target code such as T1: versions that copy to it. */
  target?: string;
  /** OWN: files have their own time. WITH_DATABASE: files go with the database. */
  filesSchedule?: string;
  /** APPROVED or NOT_APPROVED. */
  approval?: string;
  proposedFrom?: string;
  proposedTo?: string;
  activatedFrom?: string;
  activatedTo?: string;
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

/** The copy a person makes by hand and keeps off the server (the third place). The Backup Agent cannot reach it, so it is declared, not tested. */
export interface ManualCopy {
  declared: boolean;
  description: string;
  everyDays: number;
}

export interface ProposePolicyPayload {
  scope: { components: string[] };
  schedule: {
    database: { enabled: boolean; frequency: "DAILY"; time: string; type: "FULL" };
    /** Present when the files have a time of their own; without it they are backed up in the database run. */
    files?: { enabled: boolean; frequency: "DAILY"; time: string; type: "FULL" };
  };
  retention: { mode: "PERMANENT" };
  targets: { targets: PolicyTarget[]; manualCopy?: ManualCopy };
  reason: string;
}

export interface PolicyBody {
  components: string[];
  time: string;
  enabled: boolean;
  /** The time of day of the files backup when it has its own schedule, otherwise null (the files follow the database). */
  filesTime: string | null;
  targets: PolicyTarget[];
  manualCopy: ManualCopy | null;
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
    filesTime: schedule?.files?.enabled ? String(schedule.files.time ?? "") : null,
    targets: Array.isArray(targets.targets) ? targets.targets.map((t: any) => ({ offsite: false, immutable: false, ...t })) : [],
    manualCopy: targets?.manualCopy?.declared ? { declared: true, description: String(targets.manualCopy.description ?? ""), everyDays: Number(targets.manualCopy.everyDays ?? 0) } : null,
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
  backupNumber: string;
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
  backupNumber?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}


/** A backup alert (SDS 15.1) and whether someone has acknowledged it. */
export interface BackupAlertRecord {
  id: string;
  /** The Backup Alert Number (Object Numbering), given the first time the application sees the alert. */
  alertNumber?: string | null;
  at: string;
  severity: "INFO" | "WARNING" | "HIGH" | "CRITICAL";
  /** The words of the severity and of the code, made by the server. */
  severityLabel?: string;
  codeLabel?: string;
  code: string;
  detail: string | null;
  ref: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export interface BackupAlertRecipient {
  username: string;
  addedBy: string;
  addedAt: string;
}

export interface BackupAlertListParams {
  state?: "OPEN" | "ACKNOWLEDGED" | "ALL";
  severity?: string;
  search?: string;
  /** ISO instants for when the alert was raised; the range is inclusive. */
  from?: string;
  to?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** A disaster recovery scenario and its proposed targets (SDS 15.2). Targets are proposals until the plan is approved. */
export interface DrScenarioRecord {
  code: string;
  label: string;
  description: string;
  rpoHours: number;
  rtoHours: number;
  status: "PROPOSED" | "APPROVED";
  approvedBy: string | null;
  approvedAt: string | null;
}

/** A rebuild-kit item and the last time a person verified it; null when no one has verified it yet. */
export interface DrKitItemRecord {
  code: string;
  label: string;
  detail: string;
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  note: string | null;
  state: "NOT_VERIFIED" | "VERIFIED" | "OVERDUE";
  /** Days after which a check is called overdue (the limit of the alert rule). */
  reviewDays?: number;
}

/** One alert rule: who is told about an alert of this kind, and the limit at which it is raised when it has one. The names come from the server. */
export interface AlertRuleRecord {
  code: string;
  label: string;
  hint: string;
  inApp: boolean;
  email: boolean;
  thresholdValue: number | null;
  thresholdUnit: string | null;
  thresholdMin: number | null;
  thresholdMax: number | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** A scenario's target next to what the records show now. Hours are read from the records, never promised. */
export interface DrReadinessRecord {
  scenario: string;
  dataSource: "NEWEST_VERIFIED_BACKUP" | "NEWEST_VERIFIED_COPY_ON_T2";
  dataAgeHours: number | null;
  rpoHours: number;
  rpoState: "WITHIN" | "EXCEEDED" | "NO_DATA";
  testedRestoreHours: number | null;
  /** How long the newest passed test restore took, in seconds. */
  testedRestoreSeconds?: number | null;
  rtoHours: number;
  rtoState: "WITHIN" | "EXCEEDED" | "NOT_TESTED";
}

export interface DrDeclarationParams {
  search?: string;
  status?: string;
  scenario?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface DrDeclarationRecord {
  code: string;
  scenario: string;
  scenarioLabel: string;
  status: "OPEN" | "CLOSED";
  declaredBy: string;
  declaredAt: string;
  reason: string;
  rpoTargetHours: number;
  rtoTargetHours: number;
  closedBy: string | null;
  closedAt: string | null;
  summary: string | null;
  hoursTaken: number | null;
}

/** The copy a person makes by hand: what the policy asks for and what has been recorded. */
export interface ManualCopyStatus {
  declared: boolean;
  description: string | null;
  everyDays: number | null;
  lastCopiedOn: string | null;
  lastBackupNumber?: string | null;
  lastPlace?: string | null;
  lastMadeBy?: string | null;
  nextDueOn: string | null;
  state: "NOT_DECLARED" | "NEVER_RECORDED" | "ON_TIME" | "OVERDUE";
}

export interface ManualCopyRecord {
  id: string;
  copiedOn: string;
  backupNumber: string | null;
  place: string;
  madeBy: string;
  note: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface ManualCopyInput {
  copiedOn: string;
  backupNumber?: string;
  place: string;
  madeBy: string;
  note?: string;
}

/** One run of the periodic check of the live file store. */
export interface StoreScrubRecord {
  id: string;
  trigger: "SCHEDULED" | "MANUAL";
  requestedBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  backupNumber: string | null;
  checkedFiles: number;
  checkedBytes: number;
  differentFiles: number;
  missingFiles: number;
  referenceDifferences: number;
  errorCode: string | null;
}

export const backupRestoreApi = {
  overview: async (): Promise<BackupOverview> => (await api.get<BackupOverview>(`${BASE}/overview`)).data,
  overviewDaily: async (days = 30): Promise<BackupDailyPoint[]> =>
    (await api.get<BackupDailyPoint[]>(`${BASE}/overview/daily`, { params: { days } })).data,

  list: async (params?: BackupListParams): Promise<BackupPage> => (await api.get<BackupPage>(`${BASE}/backups`, { params })).data,

  get: async (backupNumber: string): Promise<BackupDetail> => (await api.get<BackupDetail>(`${BASE}/backups/${encodeURIComponent(backupNumber)}`)).data,

  create: async (payload: CreateBackupPayload): Promise<{ jobId: string }> => (await api.post<{ jobId: string }>(`${BASE}/backups`, payload)).data,

  verify: async (backupNumber: string): Promise<{ jobId: string }> =>
    (await api.post<{ jobId: string }>(`${BASE}/backups/${encodeURIComponent(backupNumber)}/verify`)).data,

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

  requestRehearsal: async (backupNumber: string, reason: string): Promise<RestoreRehearsal> =>
    (await api.post<RestoreRehearsal>(`${BASE}/backups/${encodeURIComponent(backupNumber)}/rehearsals`, { reason })).data,

  alerts: async (params?: BackupAlertListParams): Promise<Paged<BackupAlertRecord>> =>
    (await api.get<Paged<BackupAlertRecord>>(`${BASE}/alerts`, { params })).data,

  acknowledgeAlert: async (alertId: string, comment: string): Promise<{ id: string; acknowledgedBy: string }> =>
    (await api.post<{ id: string; acknowledgedBy: string }>(`${BASE}/alerts/${encodeURIComponent(alertId)}/acknowledge`, { comment })).data,

  alertRecipients: async (): Promise<BackupAlertRecipient[]> => (await api.get<BackupAlertRecipient[]>(`${BASE}/alert-recipients`)).data,

  addAlertRecipient: async (username: string): Promise<BackupAlertRecipient> =>
    (await api.post<BackupAlertRecipient>(`${BASE}/alert-recipients`, { username })).data,

  removeAlertRecipient: async (username: string): Promise<void> => {
    await api.post(`${BASE}/alert-recipients/${encodeURIComponent(username)}/remove`);
  },

  alertRules: async (): Promise<AlertRuleRecord[]> => (await api.get<AlertRuleRecord[]>(`${BASE}/alert-rules`)).data,

  changeAlertRule: async (code: string, change: { inApp: boolean; email: boolean; threshold: number | null; reason: string }): Promise<AlertRuleRecord> =>
    (await api.post<AlertRuleRecord>(`${BASE}/alert-rules/${encodeURIComponent(code)}`, change)).data,

  drReadiness: async (): Promise<DrReadinessRecord[]> => (await api.get<DrReadinessRecord[]>(`${BASE}/dr/readiness`)).data,

  drDeclarations: async (params?: DrDeclarationParams): Promise<Paged<DrDeclarationRecord>> =>
    (await api.get<Paged<DrDeclarationRecord>>(`${BASE}/dr/declarations`, { params })).data,

  declareDisaster: async (scenario: string, reason: string, signatureToken: string): Promise<{ code: string }> =>
    (await api.post<{ code: string }>(`${BASE}/dr/declarations`, { scenario, reason, signatureToken })).data,

  closeDeclaration: async (code: string, summary: string, signatureToken: string): Promise<{ code: string }> =>
    (await api.post<{ code: string }>(`${BASE}/dr/declarations/${encodeURIComponent(code)}/close`, { summary, signatureToken })).data,

  manualCopyStatus: async (): Promise<ManualCopyStatus> => (await api.get<ManualCopyStatus>(`${BASE}/manual-copies/status`)).data,

  manualCopies: async (params?: { page?: number; limit?: number }): Promise<Paged<ManualCopyRecord>> =>
    (await api.get<Paged<ManualCopyRecord>>(`${BASE}/manual-copies`, { params })).data,

  recordManualCopy: async (input: ManualCopyInput): Promise<{ id: string }> => (await api.post<{ id: string }>(`${BASE}/manual-copies`, input)).data,

  storeScrubs: async (params?: { page?: number; limit?: number }): Promise<Paged<StoreScrubRecord>> =>
    (await api.get<Paged<StoreScrubRecord>>(`${BASE}/store-scrubs`, { params })).data,

  startStoreScrub: async (): Promise<{ jobId: string }> => (await api.post<{ jobId: string }>(`${BASE}/store-scrubs`)).data,

  drScenarios: async (): Promise<DrScenarioRecord[]> => (await api.get<DrScenarioRecord[]>(`${BASE}/dr/scenarios`)).data,

  changeDrTargets: async (code: string, rpoHours: number, rtoHours: number, reason: string, signatureToken: string): Promise<DrScenarioRecord> =>
    (await api.post<DrScenarioRecord>(`${BASE}/dr/scenarios/${encodeURIComponent(code)}/targets`, { rpoHours, rtoHours, reason, signatureToken })).data,

  drKit: async (): Promise<DrKitItemRecord[]> => (await api.get<DrKitItemRecord[]>(`${BASE}/dr/kit`)).data,

  verifyDrKitItem: async (code: string, verifiedAt: string, note: string): Promise<void> => {
    await api.post(`${BASE}/dr/kit/${encodeURIComponent(code)}/verify`, { verifiedAt, note });
  },

  drAuthority: async (): Promise<{ key: string; value: string }> => (await api.get<{ key: string; value: string }>(`${BASE}/dr/authority`)).data,

  changeDrAuthority: async (username: string, reason: string, signatureToken: string): Promise<{ key: string; value: string }> =>
    (await api.post<{ key: string; value: string }>(`${BASE}/dr/authority`, { value: username, reason, signatureToken })).data,

  encryption: async (): Promise<EncryptionFacts> => (await api.get<EncryptionFacts>(`${BASE}/encryption`)).data,

  testTarget: async (code: string): Promise<TargetTestResult> => (await api.post<TargetTestResult>(`${BASE}/targets/${encodeURIComponent(code)}/test`)).data,

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

/** Restore into production (SDS-BR-003). Every action is signed; the agent's worker does the work and the job is followed to its end. */
export type ProductionRestoreStatus = "PENDING_FINALIZATION" | "FINALIZED" | "ROLLED_BACK";

export interface ProductionRestoreRecord {
  run_code: string;
  backup_number: string;
  status: ProductionRestoreStatus;
  restored_by: string;
  restore_signature: string;
  /** What the restore covered, for example "DATABASE,OBJECT_STORE". */
  components: string | null;
  restored_at: string;
  closed_by: string | null;
  close_signature: string | null;
  closed_at: string | null;
  kept_old_db: string;
  post_db: string | null;
}

export interface ProductionRestoreListParams {
  search?: string;
  status?: ProductionRestoreStatus;
  /** DATABASE or OBJECT_STORE: a restore that included this part. */
  part?: string;
  restoredFrom?: string;
  restoredTo?: string;
  closedFrom?: string;
  closedTo?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** What the signed-in person may do; the screen shows only these actions. */
export interface ProductionRestoreCapabilities {
  view: boolean;
  restore: boolean;
  rollback: boolean;
  finalize: boolean;
}

export const productionRestoreApi = {
  list: async (params?: ProductionRestoreListParams): Promise<Paged<ProductionRestoreRecord>> =>
    (await api.get<Paged<ProductionRestoreRecord>>(`${BASE}/production-restores`, { params })).data,

  capabilities: async (): Promise<ProductionRestoreCapabilities> =>
    (await api.get<ProductionRestoreCapabilities>(`${BASE}/production-restores/capabilities`)).data,

  job: async (jobId: string): Promise<BackupJob> =>
    (await api.get<BackupJob>(`${BASE}/production-restores/jobs/${encodeURIComponent(jobId)}`)).data,

  restore: async (backupNumber: string, signatureToken: string, components?: BackupPart[]): Promise<{ jobId: string }> =>
    (await api.post<{ jobId: string }>(`${BASE}/backups/${encodeURIComponent(backupNumber)}/production-restore`, { signatureToken, components })).data,

  finalize: async (runCode: string, signatureToken: string): Promise<{ jobId: string }> =>
    (await api.post<{ jobId: string }>(`${BASE}/production-restores/${encodeURIComponent(runCode)}/finalize`, { signatureToken })).data,

  rollback: async (runCode: string, signatureToken: string): Promise<{ jobId: string }> =>
    (await api.post<{ jobId: string }>(`${BASE}/production-restores/${encodeURIComponent(runCode)}/rollback`, { signatureToken })).data,
};

/** A restore can take a long time (the database is restored and checked first); the wait ends with a known state, not a hang. */
export const waitForProductionJob = async (jobId: string, intervalMs = 3000, maxMs = 3 * 60 * 60 * 1000): Promise<BackupJob> => {
  const started = Date.now();
  for (;;) {
    const job = await productionRestoreApi.job(jobId);
    if (job.status === "DONE" || job.status === "FAILED") return job;
    if (Date.now() - started > maxMs) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};
