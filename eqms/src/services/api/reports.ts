import apiClient from "./client";

export type ReportFormat = "PDF" | "XLSX" | "CSV";
export interface ReportField { code: string; name: string; type: string; allowed: boolean; defaultSelected: boolean; required: boolean; order: number; }
export interface ReportDefinition { code: string; displayName: string; description: string; category: string; classification: string; active: boolean; definitionVersion: number; allowedFormats: ReportFormat[]; limits: Record<string, number>; fields: ReportField[]; retentionPolicyId?: string | null; retentionPolicyName?: string | null; retentionDays?: number | null; }
export interface ReportRunRequest { definitionCode: string; format: ReportFormat; parameters?: Record<string, unknown>; fields?: string[]; sort?: Array<{ field: string; direction: "asc" | "desc" }>; }
export interface ReportRunSummary { id: string; definitionCode: string; definitionVersion: number; status: string; progress: number; reasonCode?: string; errorMessage?: string; queuedAt: string; completedAt?: string; artifactId?: string; }
export interface ReportRunPage { data: ReportRunSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }
export interface ReportArtifactSummary { id: string; format: ReportFormat; generatedFilename: string; mimeType: string; byteSize: number; sha256: string; expiresAt?: string | null; legalHold: boolean; purgedAt?: string | null; createdAt: string; }
export interface ReportRunDetail extends ReportRunSummary { requesterUserId: string; requestType: "ON_DEMAND" | "SCHEDULED"; requestedFormat: ReportFormat; parameters: Record<string, unknown>; selectedFields: string[]; sortSpec: Array<{ field: string; direction: "asc" | "desc" }>; authorizationSnapshot: Record<string, unknown>; attemptCount: number; startedAt?: string; artifacts: ReportArtifactSummary[]; events: Array<{ eventType: string; reasonCode?: string; detail: Record<string, unknown>; createdAt: string }>; }
export interface ReportSchedule { id: string; name: string; definitionCode: string; cronExpression: string; format: ReportFormat; status: string; active: boolean; nextRunAt?: string; lastRunAt?: string; creatorUserId: string; }
export interface CreateReportScheduleRequest { name: string; definitionCode: string; cronExpression: string; format: ReportFormat; parameters?: Record<string, unknown>; fields?: string[]; recipientUserIds?: string[]; }
export interface ReportRecipientCandidate { id: string; fullName: string; employeeCode?: string; email: string; department?: string; businessUnit?: string; }

/** API boundary for server-owned catalog, validation and asynchronous report runs. */
export const reportsApi = {
  catalog: async () => (await apiClient.get<ReportDefinition[]>("/reports/catalog")).data,
  createRun: async (request: ReportRunRequest, idempotencyKey: string) =>
    (await apiClient.post<{ id: string; status: string }>("/reports/runs", request, { headers: { "Idempotency-Key": idempotencyKey } })).data,
  retryRun: async (runId: string) => apiClient.post(`/reports/runs/${runId}/retry`),
  listRuns: async (params: { search?: string; page?: number; limit?: number; sortBy?: "queuedAt" | "completedAt" | "definitionCode" | "status"; sortDirection?: "asc" | "desc" }) =>
    (await apiClient.get<ReportRunPage>("/reports/runs", { params })).data,
  getRun: async (runId: string) => (await apiClient.get<ReportRunDetail>(`/reports/runs/${runId}`)).data,
  previewDefinition: async (code: string, fields?: string[]) => (await apiClient.get<{ definitionCode: string; asOfAt: string; rows: string[][]; truncated: boolean }>(`/reports/definitions/${code}/preview`, { params: fields?.length ? { fields } : undefined })).data,
  downloadArtifact: async (runId: string, artifactId: string) =>
    (await apiClient.post(`/reports/runs/${runId}/artifacts/${artifactId}/download`, undefined, { responseType: "blob" })).data as Blob,
  listSchedules: async () => (await apiClient.get<ReportSchedule[]>("/reports/schedules")).data,
  listScheduleRecipients: async (search?: string) => (await apiClient.get<ReportRecipientCandidate[]>("/reports/schedules/recipients", { params: { search } })).data,
  createSchedule: async (request: CreateReportScheduleRequest) => (await apiClient.post<{ id: string }>("/reports/schedules", request)).data,
  pauseSchedule: async (id: string) => apiClient.post(`/reports/schedules/${id}/pause`),
  resumeSchedule: async (id: string) => apiClient.post(`/reports/schedules/${id}/resume`),
  deleteSchedule: async (id: string) => apiClient.delete(`/reports/schedules/${id}`),
  listDefinitions: async () => (await apiClient.get<ReportDefinition[]>("/settings/report-configuration/definitions")).data,
  getDefinition: async (code: string) => (await apiClient.get<ReportDefinition>(`/settings/report-configuration/definitions/${code}`)).data,
  updateDefinition: async (code: string, payload: Record<string, unknown>) => apiClient.patch(`/settings/report-configuration/definitions/${code}`, payload),
  updateDefinitionFields: async (code: string, payload: { reason: string; fields: ReportField[] }) => apiClient.patch(`/settings/report-configuration/definitions/${code}/fields`, payload),
  definitionHistory: async (code: string) => (await apiClient.get<Array<{ version: number; reason: string; changedByUserId: string; createdAt: string }>>(`/settings/report-configuration/definitions/${code}/history`)).data,
};
