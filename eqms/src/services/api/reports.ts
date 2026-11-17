import apiClient from "./client";

export type ReportFormat = "PDF" | "XLSX" | "CSV";
export interface ReportField {
  code: string;
  name: string;
  type: string;
  allowed: boolean;
  defaultSelected: boolean;
  required: boolean;
  order: number;
  /** The group of the field in its Report Type, and whether it describes a person (REPORT-FIELD-CATALOG-2026-11-15). */
  group?: string;
  sensitive?: boolean;
}
export interface ReportDefinition {
  code: string;
  displayName: string;
  description: string;
  category: string;
  classification: string;
  active: boolean;
  definitionVersion: number;
  allowedFormats: ReportFormat[];
  limits: Record<string, number>;
  fields: ReportField[];
  retentionPolicyId?: string | null;
  retentionPolicyName?: string | null;
  retentionDays?: number | null;
}
export interface ReportRunRequest {
  definitionCode: string;
  format: ReportFormat;
  parameters?: Record<string, unknown>;
  fields?: string[];
  sort?: Array<{ field: string; direction: "asc" | "desc" }>;
  /** The choice to run without a filter (written to the Audit Trail). */
  full?: boolean;
  /** A run of the Audit Trail report is signed: the reason and the e-signature token (REPORT-RUN-SIGNATURE-2026-11-12). */
  reason?: string;
  signatureToken?: string;
}
export interface ReportRunSummary {
  id: string;
  reportTitle?: string;
  definitionCode: string;
  definitionVersion: number;
  /** The revision of the template this run was made from (REPORT-TEMPLATE-REVISION-2026-10-14); null for runs made before revisions. */
  revision?: number | null;
  /** True when the run was made with the Full choice (no filter). */
  fullRun?: boolean;
  status: string;
  progress: number;
  reasonCode?: string;
  errorMessage?: string;
  queuedAt: string;
  completedAt?: string;
  requestedFormat?: string;
  artifactId?: string;
  /** The file of the run: its format (PDF, CSV or XLSX), name and size in bytes. */
  artifactFormat?: ReportFormat;
  artifactFilename?: string;
  artifactSize?: number;
}
export interface ReportRunPage {
  data: ReportRunSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
export interface ReportArtifactSummary {
  id: string;
  format: ReportFormat;
  generatedFilename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  expiresAt?: string | null;
  legalHold: boolean;
  purgedAt?: string | null;
  createdAt: string;
}
export interface ReportRunDetail extends ReportRunSummary {
  /** The number a person quotes for the run (RUN-000123) and its filters in words; the identifier of the run is never shown. */
  runLabel?: string;
  filterSummary?: string;
  requesterName?: string | null;
  scheduleId?: string | null;
  scheduleName?: string | null;
  asOfAt?: string | null;
  /** The template as it was when this run was made (approval facts only; role scopes are not shown). */
  templateAtRun?: {
    displayName: string | null;
    gmpUse: boolean;
    approvalStatus: string | null;
    approvedVersion: number | null;
    approvedAt: string | null;
    nameFormatId: string | null;
  };
  /** The electronic signature of a run of a type that is signed (the Audit Trail report); null for any other run. */
  signature?: { signedBy: string; signedAt: string; reason?: string | null } | null;
  /** Notices sent about this run. Null when the viewer may not see who was notified. */
  deliveries?: Array<{
    channel: "IN_APP" | "EMAIL";
    eventCode: string;
    status: string;
    reasonCode?: string | null;
    createdAt: string;
    recipientName?: string | null;
  }> | null;
  requesterUserId: string;
  requestType: "ON_DEMAND" | "SCHEDULED";
  requestedFormat: ReportFormat;
  parameters: Record<string, unknown>;
  selectedFields: string[];
  sortSpec: Array<{ field: string; direction: "asc" | "desc" }>;
  authorizationSnapshot: Record<string, unknown>;
  attemptCount: number;
  startedAt?: string;
  artifacts: ReportArtifactSummary[];
  events: Array<{
    eventType: string;
    reasonCode?: string;
    detail: Record<string, unknown>;
    createdAt: string;
  }>;
}
export interface ReportSchedule {
  id: string;
  /** The Scheduled Report Number (Object Numbering). */
  scheduleNumber?: string | null;
  name: string;
  definitionCode: string;
  cronExpression: string;
  format: ReportFormat;
  status: string;
  active: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  creatorUserId: string;
  /** REPORT-SCHEDULE-OWNER-2026-10-14: the named owner, who is told when the schedule stops. */
  ownerUserId?: string;
  ownerName?: string | null;
  /** The names of the recipients, in order, for the list (the people themselves are in the detail of the schedule). */
  recipientNames?: string[];
}
export interface ReportSchedulePage {
  data: ReportSchedule[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
export interface ReportScheduleDetail extends CreateReportScheduleRequest {
  id: string;
  scheduleNumber?: string | null;
  version: number;
  recipients?: ReportRecipientPerson[];
  /** The template of the schedule and the formats it allows, also when the template is not one that the person may run now. */
  definitionName?: string;
  allowedFormats?: ReportFormat[];
}
/** A person who is, or may be, a recipient of a scheduled report: what is needed to recognise the person, as in the list of the people of a Training. */
export interface ReportRecipientPerson {
  id: string;
  fullName: string;
  username?: string | null;
  email?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  position?: string | null;
  businessUnit?: string | null;
  avatar?: string | null;
}
export interface CreateReportScheduleRequest {
  name: string;
  definitionCode: string;
  cronExpression: string;
  format: ReportFormat;
  parameters?: Record<string, unknown>;
  fields?: string[];
  recipientUserIds?: string[];
}
export interface ReportDeliveryRow {
  id: string;
  createdAt: string;
  channel: "IN_APP" | "EMAIL";
  eventCode: string;
  status: "SENT" | "FAILED" | "SKIPPED_NOT_AUTHORIZED";
  reasonCode?: string | null;
  runId?: string | null;
  scheduleName?: string | null;
  recipientName?: string | null;
}
export interface ReportDeliveryPage {
  data: ReportDeliveryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface ReportRecipientCandidate {
  id: string;
  fullName: string;
  employeeCode?: string;
  email: string;
  department?: string;
  businessUnit?: string;
}

/** API boundary for server-owned catalog, validation and asynchronous report runs. */
/** When the application last copied the summary of the backup and restore runs (REPORT-BACKUP-RUNS-2026-11-15). */
export interface BackupCopyStatus {
  enabled: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastRows: number | null;
  lastError: string | null;
  stale: boolean;
  staleAfterMinutes: number;
}

/** The answer of the check of a file against the stored report file (REPORT-FILE-VERIFY-2026-11-16). */
export interface ReportFileVerification {
  match: boolean;
  storedSha256: string;
  uploadedSha256: string;
  storedSize: number;
  uploadedSize: number;
  storedFilename: string;
  uploadedFilename: string;
}

export const reportsApi = {
  backupCopyStatus: async () => (await apiClient.get<BackupCopyStatus>("/reports/backup-copy-status")).data,
  catalog: async () =>
    (await apiClient.get<ReportDefinition[]>("/reports/catalog")).data,
  createRun: async (request: ReportRunRequest, idempotencyKey: string) =>
    (
      await apiClient.post<{ id: string; status: string }>(
        "/reports/runs",
        request,
        { headers: { "Idempotency-Key": idempotencyKey } },
      )
    ).data,
  retryRun: async (runId: string) =>
    apiClient.post(`/reports/runs/${runId}/retry`),
  /** Places or releases a legal hold on one report file. A release needs the e-signature token (REPORT-LEGAL-HOLD-2026-10-14). */
  setLegalHold: async (
    runId: string,
    artifactId: string,
    legalHold: boolean,
    reason: string,
    signatureToken?: string,
  ) =>
    apiClient.post(`/reports/runs/${runId}/artifacts/${artifactId}/legal-hold`, {
      legalHold,
      reason,
      signatureToken,
    }),
  /** Search, filters, sort and paging are all applied by the server (REPORT-LIST-STANDARD-2026-10-14). */
  listRuns: async (params: {
    search?: string;
    status?: string;
    definitionCode?: string;
    queuedFrom?: string;
    queuedTo?: string;
    format?: string;
    completedFrom?: string;
    completedTo?: string;
    page?: number;
    limit?: number;
    sortBy?: "queuedAt" | "completedAt" | "definitionCode" | "status";
    sortDirection?: "asc" | "desc";
  }) => (await apiClient.get<ReportRunPage>("/reports/runs", { params })).data,
  getRun: async (runId: string) =>
    (await apiClient.get<ReportRunDetail>(`/reports/runs/${runId}`)).data,
  previewDefinition: async (code: string, fields?: string[]) =>
    (
      await apiClient.get<{
        definitionCode: string;
        asOfAt: string;
        rows: string[][];
        truncated: boolean;
      }>(`/reports/definitions/${code}/preview`, {
        params: fields?.length ? { fields } : undefined,
      })
    ).data,
  downloadArtifact: async (runId: string, artifactId: string) =>
    (
      await apiClient.post(
        `/reports/runs/${runId}/artifacts/${artifactId}/download`,
        undefined,
        { responseType: "blob" },
      )
    ).data as Blob,
  /** A report file to look at (a PDF, in the EmbedPDF viewer): the same permission and checksum check as a download, recorded as a preview. */
  previewArtifact: async (runId: string, artifactId: string) =>
    (await apiClient.post(`/reports/runs/${runId}/artifacts/${artifactId}/preview`, undefined, { responseType: "blob" })).data as Blob,
  /** The read-only OnlyOffice view of a CSV or XLSX report file. */
  artifactViewConfig: async (runId: string, artifactId: string) =>
    (await apiClient.get<Record<string, unknown>>(`/reports/runs/${runId}/artifacts/${artifactId}/view-config`)).data,
  /** Compares a file the person holds with the file EQMS stored; the upload is read for its SHA-256 and is not kept. */
  verifyArtifactFile: async (runId: string, artifactId: string, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return (
      await apiClient.post<ReportFileVerification>(`/reports/runs/${runId}/artifacts/${artifactId}/verify`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
        },
      })
    ).data;
  },
  listSchedules: async () =>
    (await apiClient.get<ReportSchedule[]>("/reports/schedules")).data,
  searchSchedules: async (params: {
    search: string;
    status: string;
    page: number;
    sortBy: string;
    direction: string;
  }) =>
    (
      await apiClient.get<ReportSchedulePage>("/reports/schedules/search", {
        params,
      })
    ).data,
  scheduleDetail: async (id: string) =>
    (await apiClient.get<ReportScheduleDetail>(`/reports/schedules/${id}`))
      .data,
  updateSchedule: async (
    id: string,
    version: number,
    value: CreateReportScheduleRequest,
    reason: string,
  ) => apiClient.put(`/reports/schedules/${id}`, { version, value, reason }),
  /** Delivery log of scheduled-report notices, newest first (REPORT-NOTIFICATION-CHANNEL-2026-10-14). */
  /** Legal holds in force; search, sort and paging on the server. */
  listLegalHolds: async (params: { search?: string; sortBy?: string; sortDirection?: "asc" | "desc"; page?: number; limit?: number }) =>
    (await apiClient.get<{ data: ReportLegalHoldRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>("/reports/legal-holds", { params })).data,
  listDeliveries: async (params: {
    search?: string;
    channel?: string;
    status?: string;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    page?: number;
    limit?: number;
  }) => (await apiClient.get<ReportDeliveryPage>("/reports/deliveries", { params })).data,
  /** The people who may be chosen as recipients, found, narrowed and paged by the server. */
  recipientPeople: async (params: { search?: string; businessUnit?: string; department?: string; page: number; limit: number }) =>
    (await apiClient.get<{ data: ReportRecipientPerson[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>("/reports/schedules/recipient-people", { params })).data,
  recipientGroups: async (by: "BUSINESS_UNIT" | "DEPARTMENT") =>
    (await apiClient.get<{ data: Array<{ name: string; total: number }> }>("/reports/schedules/recipient-groups", { params: { by } })).data.data,
  listScheduleRecipients: async (search?: string) =>
    (
      await apiClient.get<ReportRecipientCandidate[]>(
        "/reports/schedules/recipients",
        { params: { search } },
      )
    ).data,
  createSchedule: async (request: CreateReportScheduleRequest) =>
    (await apiClient.post<{ id: string }>("/reports/schedules", request)).data,
  /** Hands a schedule to a named owner. The reason is required and audited (REPORT-SCHEDULE-OWNER-2026-10-14). */
  changeScheduleOwner: async (id: string, ownerUserId: string, reason: string) =>
    apiClient.put(`/reports/schedules/${id}/owner`, { ownerUserId, reason }),
  pauseSchedule: async (id: string) =>
    apiClient.post(`/reports/schedules/${id}/pause`),
  resumeSchedule: async (id: string) =>
    apiClient.post(`/reports/schedules/${id}/resume`),
  deleteSchedule: async (id: string) =>
    apiClient.delete(`/reports/schedules/${id}`),
  listDefinitions: async () =>
    (
      await apiClient.get<ReportDefinition[]>(
        "/settings/report-configuration/definitions",
      )
    ).data,
  getDefinition: async (code: string) =>
    (
      await apiClient.get<ReportDefinition>(
        `/settings/report-configuration/definitions/${code}`,
      )
    ).data,
  updateDefinition: async (code: string, payload: Record<string, unknown>) =>
    apiClient.patch(
      `/settings/report-configuration/definitions/${code}`,
      payload,
    ),
  updateDefinitionFields: async (
    code: string,
    payload: { reason: string; fields: ReportField[] },
  ) =>
    apiClient.patch(
      `/settings/report-configuration/definitions/${code}/fields`,
      payload,
    ),
  definitionHistory: async (code: string) =>
    (
      await apiClient.get<
        Array<{
          version: number;
          reason: string;
          changedByUserId: string;
          createdAt: string;
        }>
      >(`/settings/report-configuration/definitions/${code}/history`)
    ).data,
};

export interface ReportLegalHoldRow {
  artifactId: string;
  runId: string;
  report: string;
  fileName: string;
  format: ReportFormat;
  requester?: string | null;
  heldAt?: string | null;
  heldBy?: string | null;
  reason?: string | null;
}

