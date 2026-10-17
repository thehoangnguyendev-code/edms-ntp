import apiClient from "./client";
import { getBrowserReachableApiBaseUrl } from "./documents";
import type { TrainingActivityStatus } from "./trainingLinks";

/** Training Management: activities, sessions, people and approval steps (SDS-TR-001 section 7). Everything is decided by the server; the screens only show it. */

export type TrainingKind = "INITIAL" | "PERIODIC" | "UNPLANNED" | "RETRAINING" | "EXTERNAL";
export type TrainingApprovalStep = "CONTENT_REVIEW" | "CONTENT_APPROVE" | "ACTIVITY_COMPLETE";

export interface TrainingActivitySummary {
  id: string;
  trainingNumber: string;
  title: string;
  kind: TrainingKind;
  kindReason?: string | null;
  status: TrainingActivityStatus;
  dueDate?: string | null;
  documentNumber?: string | null;
  revisionNumber?: string | null;
  year: number;
  createdAt: string;
  departmentName: string;
  participantCount: number;
  revisionId?: string | null;
  /** What the person may do with the row, worked out by the server (one menu entry each). */
  actions?: { edit: boolean; conduct: boolean; review: boolean; approve: boolean; confirm: boolean; completeTraining: boolean };
}

export interface TrainingTopic { id: string; topicText: string; documentNumber?: string | null; revisionNumber?: string | null }
export interface TrainingSession {
  id: string;
  sessionNo: number;
  method: "SELF_READING" | "CLASSROOM" | "HYBRID" | "PRACTICAL";
  assessmentMethod: "TEST" | "CHECKLIST" | "SELF_READING_CONFIRMATION";
  trainerUserId?: string | null;
  trainerName?: string | null;
  externalTrainerName?: string | null;
  scheduledOn?: string | null;
  heldOn?: string | null;
  venue?: string | null;
  locationType?: "ONSITE" | "ONLINE";
  onlinePlatform?: string | null;
  meetingLink?: string | null;
  status: "PLANNED" | "HELD" | "POSTPONED" | "CANCELLED";
  postponeReason?: string | null;
  topics: TrainingTopic[];
  trainerQualification?: TrainerQualification;
}
export interface TrainerQualification {
  applies: boolean; qualified: boolean; gmpTrained?: boolean; reasons: string[]; canDecide?: boolean;
  exception?: { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string; rejectReason?: string | null } | null;
}
export interface TrainingSuggestedParticipant { personId: string; fullName: string; employeeCode?: string | null; department?: string | null; positionName?: string | null; topicText: string; reason: "MISSING" | "DUE"; lastDone?: string | null }
export interface TrainingParticipant {
  id: string;
  sessionId: string;
  personUserId?: string | null;
  fullName: string;
  employeeCode?: string | null;
  department?: string | null;
  position?: string | null;
  externalOrg?: string | null;
  state: "INVITED" | "ATTENDED" | "ONLINE" | "ABSENT" | "READ_CONFIRMED";
  result: "PENDING" | "PASSED" | "FAILED";
  absenceReason?: string | null;
  plannedAbsence?: string | null;
  attempts?: number | null;
  lastPercent?: number | null;
}
export interface TrainingApproverRow {
  id: string;
  stepCode: TrainingApprovalStep;
  assigneeId: string;
  assigneeName: string;
  status: "PENDING" | "DONE" | "REASSIGNED" | "CANCELLED";
  assignedAt: string;
  completedAt?: string | null;
}
export interface TrainingCapabilities {
  edit: boolean; planSessions: boolean; confirmList: boolean; designateApprovers: boolean; notify: boolean; hold: boolean; recordAttendance: boolean;
  recordAssessment: boolean; submitForConfirmation: boolean; confirmCompletion: boolean; cancel: boolean; addSupplementary: boolean;
  removeParticipants?: boolean;
  /** Codes of what is still missing before the participants can be notified (empty when ready). */
  notifyBlockers?: string[];
}
export interface TrainingActivityDetail extends Omit<TrainingActivitySummary, "participantCount"> {
  version: number;
  departmentName: string;
  organizerDepartmentId: string;
  revisionId?: string | null;
  remarks?: string | null;
  cancelReason?: string | null;
  completedOn?: string | null;
  approvedOn?: string | null;
  listPreparedBy?: string | null;
  documentName?: string | null;
  parentActivityId?: string | null;
  sessions: TrainingSession[];
  participants: TrainingParticipant[];
  confirmations: { id: string; kind: string; confirmedAt: string; confirmedByName: string; remark?: string | null }[];
  approvers: TrainingApproverRow[];
  capabilities: TrainingCapabilities;
}
export interface TrainingPerson { id: string; fullName: string; employeeCode?: string | null; department?: string | null; position?: string | null; email?: string | null; businessUnit?: string | null }
export interface TrainingGroup { name: string; total: number }
export interface TrainingPage<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface TrainingMyApproval { id: string; stepCode: TrainingApprovalStep | "MATRIX_APPROVE"; objectType: string; objectId: string; activityId?: string | null; trainingNumber: string; title: string; status: TrainingActivityStatus; assignedAt: string }

const command = async (path: string, body: unknown) => (await apiClient.post<TrainingActivityDetail>(path, body)).data;

export const trainingActivitiesApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) =>
    (await apiClient.get<TrainingPage<TrainingActivitySummary>>("/training/activities", { params })).data,
  get: async (id: string) => (await apiClient.get<TrainingActivityDetail>(`/training/activities/${id}`)).data,
  create: (body: { departmentId?: string; kind: TrainingKind; kindReason?: string; externalType?: string; title: string; dueDate?: string; remarks?: string }) =>
    command("/training/activities", body),
  update: async (id: string, body: { version: number; title?: string; dueDate?: string | null; remarks?: string | null }) =>
    (await apiClient.put<TrainingActivityDetail>(`/training/activities/${id}`, body)).data,
  addSession: (id: string, body: {
    method: string; assessmentMethod: string; trainerUserId?: string; externalTrainerName?: string; scheduledOn?: string; venue?: string; locationType?: "ONSITE" | "ONLINE"; onlinePlatform?: string; meetingLink?: string; topics: { topicText: string }[];
  }) => command(`/training/activities/${id}/sessions`, body),
  addParticipants: (id: string, body: { sessionId: string; personUserIds?: string[]; externals?: { name: string; org: string }[]; reason: string }) =>
    command(`/training/activities/${id}/participants`, body),
  confirmList: (id: string, signatureToken: string, reason?: string) => command(`/training/activities/${id}/confirm-list`, { signatureToken, reason }),
  eligibleApprovers: async (id: string, step: TrainingApprovalStep, search?: string) =>
    (await apiClient.get<TrainingPage<TrainingPerson>>(`/training/activities/${id}/eligible-approvers`, { params: { step, search, limit: 50 } })).data,
  designate: async (id: string, step: TrainingApprovalStep, assigneeUserId: string) =>
    (await apiClient.put<TrainingActivityDetail>(`/training/activities/${id}/approvers`, { step, assigneeUserId })).data,
  reassign: (id: string, assignmentId: string, assigneeUserId: string, reason: string) =>
    command(`/training/activities/${id}/approvers/${assignmentId}/reassign`, { assigneeUserId, reason }),
  confirmContent: (id: string, step: "CONTENT_REVIEW" | "CONTENT_APPROVE", signatureToken: string) =>
    command(`/training/activities/${id}/confirm-content`, { step, signatureToken }),
  notify: (id: string, version: number) => command(`/training/activities/${id}/notify`, { version }),
  submitForConfirmation: (id: string, version: number) => command(`/training/activities/${id}/submit-for-confirmation`, { version }),
  confirmCompletion: (id: string, version: number, signatureToken: string) => command(`/training/activities/${id}/confirm-completion`, { version, signatureToken }),
  cancel: (id: string, version: number, reason: string) => command(`/training/activities/${id}/cancel`, { version, reason }),
  supplementary: (id: string, participantIds: string[], reason: string) => command(`/training/activities/${id}/supplementary`, { participantIds, reason }),
  removeParticipant: async (participantId: string, reason: string) => (await apiClient.post<TrainingActivityDetail>(`/training/participants/${participantId}/remove`, { reason })).data,
  setPlannedAbsence: async (participantId: string, reason: string) => (await apiClient.post<TrainingActivityDetail>(`/training/participants/${participantId}/planned-absence`, { reason })).data,
  suggestedParticipants: async (activityId: string, sessionId: string) =>
    (await apiClient.get<{ data: TrainingSuggestedParticipant[] }>(`/training/activities/${activityId}/sessions/${sessionId}/suggested-participants`)).data.data,
  trainerExceptionApprovers: async (sessionId: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>(`/training/sessions/${sessionId}/trainer-exception/eligible-approvers`, { params: { search, limit: 50 } })).data,
  requestTrainerException: async (sessionId: string, reason: string, approverUserId: string) => (await apiClient.post(`/training/sessions/${sessionId}/trainer-exception`, { reason, approverUserId })).data,
  approveTrainerException: async (exceptionId: string, signatureToken: string) => (await apiClient.post(`/training/trainer-exceptions/${exceptionId}/approve`, { signatureToken })).data,
  rejectTrainerException: async (exceptionId: string, reason: string) => (await apiClient.post(`/training/trainer-exceptions/${exceptionId}/reject`, { reason })).data,
  holdSession: (sessionId: string, heldOn?: string) => command(`/training/sessions/${sessionId}/hold`, { heldOn }),
  postponeSession: (sessionId: string, newDate: string, reason: string) => command(`/training/sessions/${sessionId}/postpone`, { newDate, reason }),
  attendance: (participantId: string, state: "ATTENDED" | "ONLINE" | "ABSENT", absenceReason?: string) =>
    command(`/training/participants/${participantId}/attendance`, { state, absenceReason }),
  assessment: (participantId: string, scoreObtained: number, scoreMax: number, remarks?: string) =>
    command(`/training/participants/${participantId}/assessments`, { scoreObtained, scoreMax, remarks }),
  verifySelfReading: (id: string, signatureToken: string) => command(`/training/activities/${id}/verify-self-reading`, { signatureToken }),
  confirmRead: async (participantId: string, signatureToken: string) => (await apiClient.post(`/training/me/participations/${participantId}/confirm-read`, { signatureToken })).data,
  people: async (search: string, limit = 20) => (await apiClient.get<{ data: TrainingPerson[] }>("/training/people", { params: { search, limit } })).data.data,
  peopleGroups: async (by: "BUSINESS_UNIT" | "DEPARTMENT") => (await apiClient.get<{ data: TrainingGroup[] }>("/training/people/groups", { params: { by } })).data.data,
  peopleInGroups: async (by: "BUSINESS_UNIT" | "DEPARTMENT", names: string[]) => (await apiClient.get<{ data: TrainingPerson[] }>("/training/people/in-groups", { params: { by, names: names.join(",") } })).data.data,
  myApprovals: async () => (await apiClient.get<{ data: TrainingMyApproval[] }>("/training/me/approvals")).data.data,
};

export interface TrainingRecord {
  id: string; recordNo: number; personUserId: string; fullName: string; employeeCode?: string | null; department?: string | null; position?: string | null;
  trainingNumber: string; topicText: string; documentNumber?: string | null; documentRevision?: string | null; completedOn: string; method: string;
  result: "PASSED" | "READ"; source: string; activityId: string; voidedAt?: string | null; voidReason?: string | null; voidedByName?: string | null;
}
export interface TrainingTask {
  participantId: string; activityId: string; trainingNumber: string; title: string; status: TrainingActivityStatus; dueDate?: string | null; method: string;
  scheduledOn?: string | null; state: string; topics?: string | null;
}
export interface TrainingNumberLogRow {
  trainingNumber: string; createdAt: string; kind: TrainingKind; status: TrainingActivityStatus; title: string; documentNumber?: string | null;
  revisionNumber?: string | null; cancelReason?: string | null; sessions: number; postponements: number;
}
export interface TrainingSettings {
  passPercent: number; documentTrainingDaysDefault: number; resultsDueWorkingDays: number; annualRequirementDueMonth: number; annualRequirementDueDay: number;
  absenceRetrainMonths: number; retentionYearsAfterLeaving: number; integrationEnabled: boolean; version: number; updatedAt?: string;
}

export const trainingRecordsApi = {
  mine: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingRecord>>("/training/me/records", { params })).data,
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingRecord>>("/training/records", { params })).data,
  tasks: async () => (await apiClient.get<{ data: TrainingTask[] }>("/training/me/tasks")).data.data,
  voidRecord: async (id: string, reason: string, signatureToken: string) => (await apiClient.post<TrainingRecord>(`/training/records/${id}/void`, { reason, signatureToken })).data,
  numberLog: async (params: Record<string, string | number | undefined>) =>
    (await apiClient.get<TrainingPage<TrainingNumberLogRow> & { year: number }>("/training/number-log", { params })).data,
};

export const trainingSettingsApi = {
  get: async () => (await apiClient.get<TrainingSettings>("/training/settings")).data,
  update: async (body: Partial<TrainingSettings> & { version: number; reason: string }) => (await apiClient.put<TrainingSettings>("/training/settings", body)).data,
};

export interface TrainingMatrixSummary {
  id: string; code: string; departmentId: string; departmentName: string; effectiveVersionId?: string | null; effectiveVersionNo?: number | null; effectiveAt?: string | null;
  openVersionId?: string | null; openVersionNo?: number | null; openStatus?: string | null;
}
export interface TrainingMatrixVersionRef {
  id: string; versionNo: number; status: "DRAFT" | "PENDING_APPROVAL" | "EFFECTIVE" | "OBSOLETE"; changeReason?: string | null; rejectReason?: string | null;
  effectiveAt?: string | null; approvedAt?: string | null; preparedByName?: string | null; approvedByName?: string | null;
}
export interface TrainingMatrixDetail { id: string; code: string; departmentName: string; versions: TrainingMatrixVersionRef[]; canManage: boolean }
export interface TrainingPosition { id: string; code: string; name: string; departmentId?: string | null; departmentName?: string | null }
export interface TrainingMatrixRow {
  id?: string; rowNo?: number; rowGroup: "FACTORY_GENERAL" | "DEPARTMENT_GENERAL" | "SOP"; topicId?: string | null; documentId?: string | null; annualRequired: boolean; note?: string | null;
  topicCode?: string | null; topicName?: string | null; documentNumber?: string | null; documentName?: string | null; positionIds: string[];
}
export interface TrainingMatrixVersion {
  id: string; matrixId: string; matrixCode: string; departmentId: string; departmentName: string; versionNo: number; status: TrainingMatrixVersionRef["status"];
  changeReason?: string | null; rejectReason?: string | null; version: number; rows: TrainingMatrixRow[]; positions: TrainingPosition[]; approvers: TrainingApproverRow[];
  capabilities: { edit: boolean; submit: boolean; approve: boolean; reject: boolean; upgrade: boolean };
}
export interface TrainingTopic { id: string; code: string; name: string; scope: "FACTORY_GENERAL" | "DEPARTMENT_GENERAL" | "OTHER"; departmentId?: string | null; departmentName?: string | null; active: boolean; version: number }
export interface TrainingPersonPosition { personId: string; fullName: string; employeeCode?: string | null; department?: string | null; positionText?: string | null; positionId?: string | null; positionName?: string | null; suggestedPositionId?: string | null }

export const trainingMatrixApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingMatrixSummary>>("/training/matrices", { params })).data,
  create: async (departmentId: string) => (await apiClient.post<TrainingMatrixVersion>("/training/matrices", { departmentId })).data,
  get: async (id: string) => (await apiClient.get<TrainingMatrixDetail>(`/training/matrices/${id}`)).data,
  upgrade: async (id: string) => (await apiClient.post<TrainingMatrixVersion>(`/training/matrices/${id}/upgrade`)).data,
  version: async (id: string) => (await apiClient.get<TrainingMatrixVersion>(`/training/matrix-versions/${id}`)).data,
  print: async (versionId: string) => (await apiClient.get<Blob>(`/training/matrix-versions/${versionId}/print`, { responseType: "blob" })).data,
  save: async (id: string, body: { version: number; changeReason?: string; rows: { group: string; topicId?: string | null; documentId?: string | null; annualRequired: boolean; note?: string | null; positionIds: string[] }[] }) =>
    (await apiClient.put<TrainingMatrixVersion>(`/training/matrix-versions/${id}`, body)).data,
  eligibleApprovers: async (id: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>(`/training/matrix-versions/${id}/eligible-approvers`, { params: { search, limit: 50 } })).data,
  submit: async (id: string, version: number, signatureToken: string, approverUserId: string) => (await apiClient.post<TrainingMatrixVersion>(`/training/matrix-versions/${id}/submit`, { version, signatureToken, approverUserId })).data,
  approve: async (id: string, version: number, signatureToken: string) => (await apiClient.post<TrainingMatrixVersion>(`/training/matrix-versions/${id}/approve`, { version, signatureToken })).data,
  reject: async (id: string, version: number, reason: string) => (await apiClient.post<TrainingMatrixVersion>(`/training/matrix-versions/${id}/reject`, { version, reason })).data,
  compare: async (a: string, b: string) =>
    (await apiClient.get<{ from: number; to: number; added: TrainingMatrixRow[]; removed: TrainingMatrixRow[]; changed: (TrainingMatrixRow & { previousPositionIds: string[]; previousAnnualRequired: boolean })[] }>(`/training/matrix-versions/${a}/compare/${b}`)).data,
  topics: async (search?: string, activeOnly = false) => (await apiClient.get<{ data: TrainingTopic[] }>("/training/topics", { params: { search, activeOnly } })).data.data,
  saveTopic: async (id: string | null, body: { code?: string; name: string; scope: string; departmentId?: string | null; active?: boolean; version?: number }) =>
    (id ? await apiClient.put<TrainingTopic>(`/training/topics/${id}`, body) : await apiClient.post<TrainingTopic>("/training/topics", body)).data,
  positions: async () => (await apiClient.get<{ data: TrainingPosition[] }>("/training/positions")).data.data,
  personPositions: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingPersonPosition>>("/training/person-positions", { params })).data,
  setPersonPosition: async (personUserId: string, positionId: string) => (await apiClient.put("/training/person-positions", { personUserId, positionId })).data,
};

export interface TrainingComplianceSummary {
  required: number; ok: number; missing: number; due: number; people: number; percentTrained: number | null; hasEffectiveMatrix: boolean;
  peopleWithoutPosition: number; overdueActivities: number; dueSoonActivities: number;
}
export interface TrainingGap { pid: string; fullName: string; employeeCode?: string | null; positionName?: string | null; title: string; code?: string | null; annualRequired: boolean; lastDone?: string | null; status: "MISSING" | "DUE" | "OK" }
export const trainingComplianceApi = {
  summary: async (departmentId?: string) => (await apiClient.get<TrainingComplianceSummary>("/training/compliance/summary", { params: { departmentId } })).data,
  coverage: async (params: Record<string, string | number | undefined>) => (await apiClient.get<TrainingPage<TrainingGap>>("/training/compliance/coverage", { params })).data,
};

export interface TrainingJobSummary { id: string; issueNo: number; caseType: "INITIAL" | "CHANGE"; status: "DRAFT" | "PENDING_RECEIVER" | "EFFECTIVE" | "SUPERSEDED" | "CANCELLED"; createdAt: string; effectiveAt?: string | null; fullName: string; employeeCode?: string | null; positionName: string; departmentName: string }
export interface TrainingJobDuty { sortOrder?: number; responsibility: string; description?: string | null }
export interface TrainingEligibilityItem { title: string; code?: string | null; annualRequired: boolean; lastDone?: string | null }
export interface TrainingEligibility { matrixMissing: boolean; matrixVersionId?: string | null; items: TrainingEligibilityItem[]; complete: boolean; missingCount?: number }
export interface TrainingJobDetail extends Omit<TrainingJobSummary, "fullName" | "employeeCode" | "positionName"> {
  personUserId: string; personName: string; positionId: string; positionName: string; previousPositionName?: string | null; directSuperiorTitle?: string | null; subordinateTitles?: string | null;
  substituteTitle?: string | null; changeReason?: string | null; jurisdiction?: string | null; exceptionReason?: string | null; exceptionApprovedBy?: string | null; assignorTitle?: string | null; cancelReason?: string | null;
  version: number; duties: TrainingJobDuty[]; approvers: TrainingApproverRow[]; eligibility?: TrainingEligibility;
  capabilities: { edit: boolean; requestException: boolean; approveException: boolean; submit: boolean; accept: boolean; cancel: boolean };
}
export interface TrainingJobSave { personUserId?: string; positionId?: string; directSuperiorTitle?: string; subordinateTitles?: string; substituteTitle?: string; changeReason?: string; jurisdiction?: string; duties: TrainingJobDuty[]; version?: number }
export const trainingJobsApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingJobSummary>>("/training/job-assignments", { params })).data,
  get: async (id: string) => (await apiClient.get<TrainingJobDetail>(`/training/job-assignments/${id}`)).data,
  eligibility: async (person: string, position: string) => (await apiClient.get<TrainingEligibility>("/training/job-assignments/eligibility", { params: { person, position } })).data,
  create: async (body: TrainingJobSave) => (await apiClient.post<TrainingJobDetail>("/training/job-assignments", body)).data,
  update: async (id: string, body: TrainingJobSave) => (await apiClient.put<TrainingJobDetail>(`/training/job-assignments/${id}`, body)).data,
  requestException: async (id: string, reason: string, approverUserId: string) => (await apiClient.post<TrainingJobDetail>(`/training/job-assignments/${id}/exception`, { reason, approverUserId })).data,
  eligibleApprovers: async (id: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>(`/training/job-assignments/${id}/exception/eligible-approvers`, { params: { search, limit: 50 } })).data,
  approveException: async (id: string, signatureToken: string) => (await apiClient.post<TrainingJobDetail>(`/training/job-assignments/${id}/exception/approve`, { signatureToken })).data,
  submit: async (id: string, version: number, signatureToken: string, assignorTitle?: string) => (await apiClient.post<TrainingJobDetail>(`/training/job-assignments/${id}/submit`, { version, signatureToken, assignorTitle })).data,
  accept: async (id: string, version: number, signatureToken: string) => (await apiClient.post<TrainingJobDetail>(`/training/job-assignments/${id}/accept`, { version, signatureToken })).data,
  cancel: async (id: string, version: number, reason: string) => (await apiClient.post<TrainingJobDetail>(`/training/job-assignments/${id}/cancel`, { version, reason })).data,
};

export interface TrainingSpecimen {
  id: string; personUserId: string; fullName: string; employeeCode?: string | null; department?: string | null; versionNo: number; status: "PENDING" | "APPROVED" | "SUPERSEDED" | "REJECTED";
  effectiveDate?: string | null; contentType: string; sizeBytes: number; changeReason?: string | null; rejectReason?: string | null; createdAt: string; uploadedByName: string; confirmedByName?: string | null;
  capabilities: { viewImage: boolean; confirm: boolean; reject: boolean };
}
export const trainingSpecimenApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingSpecimen>>("/training/specimen-signatures", { params })).data,
  eligibleConfirmers: async (personId?: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>("/training/specimen-signatures/eligible-confirmers", { params: { personId, search, limit: 50 } })).data,
  upload: async (file: File, confirmerId: string, personId?: string, reason?: string) => {
    const form = new FormData();
    form.append("file", file);
    const params: Record<string, string> = { confirmerId };
    if (personId) params.personId = personId;
    if (reason) params.reason = reason;
    return (await apiClient.post<TrainingSpecimen>("/training/specimen-signatures", form, { params, headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  image: async (id: string) => (await apiClient.get<Blob>(`/training/specimen-signatures/${id}/image`, { responseType: "blob" })).data,
  confirm: async (id: string, signatureToken: string) => (await apiClient.post<TrainingSpecimen>(`/training/specimen-signatures/${id}/confirm`, { signatureToken })).data,
  reject: async (id: string, reason: string) => (await apiClient.post<TrainingSpecimen>(`/training/specimen-signatures/${id}/reject`, { reason })).data,
};

export interface TrainingRecordExport {
  id: string; personUserId: string; fullName: string; employeeCode?: string | null; status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED"; reason: string; rejectReason?: string | null;
  recordCount?: number | null; generatedAt?: string | null; sha256?: string | null; createdAt: string; preparedByName: string; approvedByName?: string | null; canApprove?: boolean; canDownload?: boolean;
}
export const trainingExportsApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingRecordExport>>("/training/record-exports", { params })).data,
  eligibleApprovers: async (personId: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>("/training/record-exports/eligible-approvers", { params: { personId, search, limit: 50 } })).data,
  create: async (body: { personUserId: string; reason: string; approverUserId: string; signatureToken: string }) => (await apiClient.post<TrainingRecordExport>("/training/record-exports", body)).data,
  approve: async (id: string, signatureToken: string) => (await apiClient.post<TrainingRecordExport>(`/training/record-exports/${id}/approve`, { signatureToken })).data,
  reject: async (id: string, reason: string) => (await apiClient.post<TrainingRecordExport>(`/training/record-exports/${id}/reject`, { reason })).data,
  download: async (id: string) => (await apiClient.get<Blob>(`/training/record-exports/${id}/download`, { responseType: "blob" })).data,
};

export interface TrainingRequirementSummary { id: string; requestNo: string; year: number; kind: "ANNUAL" | "SOP_PERIODIC"; status: "DRAFT" | "PENDING_REVIEW" | "PENDING_APPROVAL" | "APPROVED"; dueBy: string; departmentName: string; lineCount: number; createdAt: string }
export interface TrainingRequirementLine {
  id: string; lineNo: number; plannedMonth: string; topicId?: string | null; documentId?: string | null; activityId?: string | null; postponedFrom?: string | null; postponeReason?: string | null;
  qaComment?: string | null; qaSignedAt?: string | null; qaSignedByName?: string | null; title: string; code?: string | null; trainingNumber?: string | null; activityStatus?: string | null;
  lineStatus: "PLANNED" | "POSTPONED" | "IN_PROGRESS" | "DONE" | "OVERDUE";
}
export interface TrainingRequirementDetail extends Omit<TrainingRequirementSummary, "lineCount"> {
  departmentId: string; version: number; rejectReason?: string | null; preparedByName?: string | null; reviewedByName?: string | null; approvedByName?: string | null; approvedAt?: string | null;
  lines: TrainingRequirementLine[]; approvers: TrainingApproverRow[];
  capabilities: { edit: boolean; submit: boolean; review: boolean; approve: boolean; reject: boolean; postpone: boolean; openActivity: boolean; qaSign: boolean };
}
export interface TrainingSuggestion { topicId?: string | null; documentId?: string | null; title: string; code?: string | null }
export const trainingRequirementsApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingRequirementSummary>>("/training/requirements", { params })).data,
  get: async (id: string) => (await apiClient.get<TrainingRequirementDetail>(`/training/requirements/${id}`)).data,
  print: async (id: string) => (await apiClient.get<Blob>(`/training/requirements/${id}/print`, { responseType: "blob" })).data,
  create: async (body: { year: number; kind: string; departmentId?: string; dueBy?: string }) => (await apiClient.post<TrainingRequirementDetail>("/training/requirements", body)).data,
  suggestions: async (year: number, departmentId?: string) => (await apiClient.get<{ data: TrainingSuggestion[] }>("/training/requirements/suggestions", { params: { year, departmentId } })).data.data,
  save: async (id: string, body: { version: number; dueBy?: string; lines: { plannedMonth: string; topicId?: string | null; documentId?: string | null }[] }) => (await apiClient.put<TrainingRequirementDetail>(`/training/requirements/${id}`, body)).data,
  eligibleApprovers: async (id: string, step: "REQUIREMENT_REVIEW" | "REQUIREMENT_APPROVE", search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>(`/training/requirements/${id}/eligible-approvers`, { params: { step, search, limit: 50 } })).data,
  submit: async (id: string, version: number, signatureToken: string, nextApproverUserId: string) => (await apiClient.post<TrainingRequirementDetail>(`/training/requirements/${id}/submit`, { version, signatureToken, nextApproverUserId })).data,
  review: async (id: string, version: number, signatureToken: string, nextApproverUserId: string) => (await apiClient.post<TrainingRequirementDetail>(`/training/requirements/${id}/review`, { version, signatureToken, nextApproverUserId })).data,
  approve: async (id: string, version: number, signatureToken: string) => (await apiClient.post<TrainingRequirementDetail>(`/training/requirements/${id}/approve`, { version, signatureToken })).data,
  reject: async (id: string, version: number, reason: string) => (await apiClient.post<TrainingRequirementDetail>(`/training/requirements/${id}/reject`, { version, reason })).data,
  postpone: async (lineId: string, reason: string) => (await apiClient.post<TrainingRequirementDetail>(`/training/requirements/lines/${lineId}/postpone`, { reason })).data,
  openActivity: async (lineId: string) => (await apiClient.post<TrainingRequirementDetail>(`/training/requirements/lines/${lineId}/open-activity`)).data,
  qaSign: async (lineId: string, signatureToken: string, comment?: string) => (await apiClient.post<TrainingRequirementDetail>(`/training/requirements/lines/${lineId}/qa-sign`, { signatureToken, comment })).data,
};

export interface TrainingMaterial { id: string; title: string; linkUrl?: string | null; purpose: "CONTENT" | "EXAM" | "ANSWER_KEY"; originalName?: string | null; contentType?: string | null; sizeBytes?: number | null; sha256?: string | null; createdAt: string; removedAt?: string | null; removeReason?: string | null; uploadedByName: string }
export interface TrainingPaperEvidence {
  id: string; kind: "ATTENDANCE_SHEET" | "ASSESSMENT" | "OTHER"; originalName: string; sizeBytes: number; sha256: string; remark?: string | null; uploadedAt: string; receivedAt?: string | null;
  participantId?: string | null; participantName?: string | null; uploadedByName: string; receivedByName?: string | null;
}
export interface TrainingActivityFiles { materials: TrainingMaterial[]; evidence: TrainingPaperEvidence[]; canUploadMaterial: boolean; canSeeAnswerKey: boolean; canUploadEvidence: boolean; canReceive: boolean }
export const trainingFilesApi = {
  list: async (activityId: string) => (await apiClient.get<TrainingActivityFiles>(`/training/activities/${activityId}/files`)).data,
  uploadMaterial: async (activityId: string, file: File, title?: string, purpose: "CONTENT" | "EXAM" | "ANSWER_KEY" = "CONTENT", onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return (await apiClient.post<TrainingActivityFiles>(`/training/activities/${activityId}/materials`, form, { params: { title, purpose }, headers: { "Content-Type": "multipart/form-data" }, onUploadProgress: (e) => { if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100)); } })).data;
  },
  addLink: async (activityId: string, title: string, url: string) => (await apiClient.post<TrainingActivityFiles>(`/training/activities/${activityId}/material-links`, { title, url })).data,
  removeMaterial: async (id: string, reason: string) => (await apiClient.post<TrainingActivityFiles>(`/training/materials/${id}/remove`, { reason })).data,
  viewConfig: async (id: string) => (await apiClient.get<Record<string, unknown>>(`/training/materials/${id}/view-config`, { params: { logoUrl: `${getBrowserReachableApiBaseUrl()}/branding/logo` } })).data,
  previewMaterial: async (id: string) => (await apiClient.get<Blob>(`/training/materials/${id}/preview`, { responseType: "blob" })).data,
  downloadMaterial: async (id: string) => (await apiClient.get<Blob>(`/training/materials/${id}/download`, { responseType: "blob" })).data,
  uploadEvidence: async (activityId: string, file: File, kind: string, participantId?: string, remark?: string, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return (await apiClient.post<TrainingActivityFiles>(`/training/activities/${activityId}/paper-evidence`, form, { params: { kind, participantId, remark }, headers: { "Content-Type": "multipart/form-data" }, onUploadProgress: (e) => { if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100)); } })).data;
  },
  receiveEvidence: async (id: string) => (await apiClient.post<TrainingActivityFiles>(`/training/paper-evidence/${id}/receive`)).data,
  downloadEvidence: async (id: string) => (await apiClient.get<Blob>(`/training/paper-evidence/${id}/download`, { responseType: "blob" })).data,
};

export interface TrainingLegacyRow {
  revisionId: string; documentNumber: string; documentName: string; revisionNumber: string; completionDate?: string | null; paperTrainingNumber?: string | null;
  evidenceId?: string | null; evidenceStatus?: "SUBMITTED" | "VERIFIED" | null; notEvidenced?: boolean | null; notEvidencedReason?: string | null; originalName?: string | null;
  submittedAt?: string | null; verifiedAt?: string | null; submittedByName?: string | null; verifiedByName?: string | null; pendingForMe: boolean;
}
export const trainingLegacyApi = {
  queue: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingLegacyRow> & { canSubmit: boolean }>("/training/legacy-evidence", { params })).data,
  eligibleVerifiers: async (revisionId: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>(`/training/legacy-evidence/revisions/${revisionId}/eligible-verifiers`, { params: { search, limit: 50 } })).data,
  submit: async (revisionId: string, verifierId: string, file: File | null, notEvidenced: boolean, reason?: string) => {
    const form = new FormData();
    if (file) form.append("file", file);
    return (await apiClient.post<TrainingLegacyRow>(`/training/legacy-evidence/revisions/${revisionId}`, form, { params: { verifierId, notEvidenced, reason }, headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  verify: async (id: string, signatureToken: string) => (await apiClient.post<TrainingLegacyRow>(`/training/legacy-evidence/${id}/verify`, { signatureToken })).data,
  reject: async (id: string, reason: string) => (await apiClient.post<TrainingLegacyRow>(`/training/legacy-evidence/${id}/reject`, { reason })).data,
  download: async (id: string) => (await apiClient.get<Blob>(`/training/legacy-evidence/${id}/download`, { responseType: "blob" })).data,
};

/** The stable code the server answered with, mapped to a sentence. The screen never shows the raw code or any internal detail. */
const ERROR_TEXT: Record<string, string> = {
  TRAINING_SCOPE_DENIED: "Your permissions or department do not allow this action.",
  TRAINING_ACTIVITY_VERSION_CHANGED: "Someone else changed this training activity. Reload it and try again.",
  TRAINING_ACTIVITY_INVALID_TRANSITION: "This action is not available in the current status of the activity.",
  TRAINING_APPROVER_NOT_ELIGIBLE: "This person is not eligible for the step (permission, department or separation of duties).",
  TRAINING_APPROVER_ALREADY_DESIGNATED: "A person is already designated for this step. Use Reassign to change the person.",
  TRAINING_SEGREGATION_OF_DUTIES: "The same person cannot do both steps of this process.",
  TRAINING_SIGNATURE_REQUIRED: "An electronic signature is required.",
  TRAINING_REASON_REQUIRED: "A reason is required.",
  TRAINING_LIST_NOT_CONFIRMED: "Confirm the attendee list first.",
  TRAINING_CONTENT_NOT_REVIEWED: "The content must be reviewed first.",
  TRAINING_CONTENT_NOT_APPROVED: "The content and the test must be reviewed and approved first.",
  TRAINING_SESSION_REQUIRED: "Add at least one session.",
  TRAINING_TRAINER_REQUIRED: "Every session needs a trainer.",
  TRAINING_PARTICIPANT_REQUIRED: "Add at least one participant.",
  TRAINING_PARTICIPANT_NOT_ELIGIBLE: "This person cannot be added or cannot be chosen for this step.",
  TRAINING_PARTICIPANT_NOT_FINAL: "Every participant must be marked as attended or absent.",
  TRAINING_RESULT_PENDING: "Every participant who attended needs a result.",
  TRAINING_SESSION_NOT_HELD: "Hold every session first.",
  TRAINING_DATE_IN_FUTURE: "The date cannot be in the future.",
  TRAINING_ASSESSMENT_SELF: "You cannot record the result of your own assessment.",
  TRAINING_SCORE_INVALID: "Enter a score between 0 and the maximum score.",
  TRAINING_ACTIVITY_HAS_RESULTS: "An activity with people who passed cannot be cancelled.",
  TRAINING_TITLE_REQUIRED: "A title is required.",
  TRAINING_RECORD_ALREADY_VOIDED: "This record is already voided.",
  TRAINING_SETTINGS_VERSION_CHANGED: "Someone else changed the settings. Reload and try again.",
  TRAINING_SETTINGS_UNCHANGED: "Nothing was changed.",
  TRAINING_SETTINGS_INVALID: "A value is outside the allowed range.",
  TRAINING_RETENTION_TOO_SHORT: "Training records must be kept at least 10 years after the employee leaves.",
  TRAINING_DEPARTMENT_REQUIRED: "Choose a department.",
  TRAINING_MATRIX_EXISTS: "This department already has a matrix.",
  TRAINING_MATRIX_VERSION_CHANGED: "Someone else changed this version. Reload it and try again.",
  TRAINING_MATRIX_INVALID_TRANSITION: "This action is not available in the current status of the version.",
  TRAINING_MATRIX_EMPTY: "Add at least one row before sending the matrix for approval.",
  TRAINING_MATRIX_ROW_WITHOUT_POSITION: "Every row needs at least one position.",
  TRAINING_MATRIX_ROW_INVALID: "A row needs a topic or a document, and a valid group.",
  TRAINING_MATRIX_ROW_DUPLICATE: "A topic or document appears twice.",
  TRAINING_MATRIX_POSITION_INVALID: "A position does not belong to this department.",
  TRAINING_MATRIX_OPEN_VERSION: "A version is already being prepared or approved.",
  TRAINING_MATRIX_NOT_EFFECTIVE: "There is no effective version to start from.",
  TRAINING_TOPIC_CODE_USED: "This topic code is already used.",
  TRAINING_TOPIC_INVALID: "Check the topic code (letters, digits, . _ -) and scope.",
  TRAINING_TOPIC_VERSION_CHANGED: "Someone else changed this topic. Reload and try again.",
  TRAINING_POSITION_INVALID: "This position is not valid.",
  TRAINING_MATRIX_INCOMPLETE: "The training the matrix requires for this position is not complete. Ask for an exception, or finish the training first.",
  TRAINING_JOB_OPEN_EXISTS: "This person already has a job assignment being prepared.",
  TRAINING_JOB_SAME_POSITION: "The person already holds this position.",
  TRAINING_JOB_INVALID_TRANSITION: "This action is not available in the current status of the assignment.",
  TRAINING_JOB_VERSION_CHANGED: "Someone else changed this assignment. Reload it and try again.",
  TRAINING_JOB_DUTIES_REQUIRED: "Add at least one duty.",
  TRAINING_JOB_DUTY_INVALID: "Every duty needs a responsibility (up to 500 characters).",
  TRAINING_JOB_NO_EXCEPTION: "No exception was requested for this assignment.",
  TRAINING_JOB_INVALID: "Choose a person and a position.",
  TRAINING_FILE_REJECTED: "The image was refused. Use a PNG or JPEG of up to 512 KB, between 40x20 and 2000x1000 pixels, with no virus.",
  TRAINING_FILE_UNAVAILABLE: "The image is not available right now.",
  TRAINING_SPECIMEN_PENDING_EXISTS: "A specimen signature of this person is already waiting for confirmation.",
  TRAINING_SPECIMEN_INVALID_TRANSITION: "This action is not available in the current status.",
  TRAINING_MATERIAL_PURPOSE_EXISTS: "This file is already on record. Remove it first, with a reason, to add another.",
  TRAINING_PREVIEW_UNAVAILABLE: "This file cannot be previewed now. Download it instead.",
  TRAINING_ASSESSMENT_NOT_ALLOWED: "This way of assessment does not go with the training method (SOP.0003 5.1.2).",
  TRAINING_PARTICIPANT_LOCKED: "This person can no longer be changed: the attendee list is confirmed, or attendance was recorded. Mark the person absent instead.",
  TRAINING_LOCATION_INVALID: "Enter the physical location, or the platform and an https meeting link.",
  TRAINING_LINK_INVALID: "Enter a full https:// address.",
  TRAINING_PRINT_NOT_APPROVED: "Only an approved version can be printed.",
  TRAINING_EXPORT_INVALID_TRANSITION: "This action is not available in the current status of the export.",
  TRAINING_EXPORT_FAILED: "The PDF could not be generated.",
  TRAINING_EXPORT_INTEGRITY_FAILED: "The stored file does not match its fingerprint. Contact QA.",
  TRAINING_REQUIREMENT_VERSION_CHANGED: "Someone else changed this requirement. Reload it and try again.",
  TRAINING_REQUIREMENT_INVALID_TRANSITION: "This action is not available in the current status of the requirement.",
  TRAINING_REQUIREMENT_EMPTY: "Add at least one line before sending the requirement.",
  TRAINING_REQUIREMENT_LINE_INVALID: "A line needs a month of the year and a topic or a document.",
  TRAINING_REQUIREMENT_LINE_DUPLICATE: "The same topic or document appears twice in the same month.",
  TRAINING_REQUIREMENT_LINE_HAS_ACTIVITY: "This line already has an activity that is not cancelled.",
  TRAINING_REQUIREMENT_LINE_ALREADY_SIGNED: "This line was already signed by QA.",
  TRAINING_ACTIVITY_NOT_COMPLETED: "The training of this line is not completed yet.",
  TRAINING_YEAR_INVALID: "Enter a year between 2000 and 2100.",
  TRAINING_CONTENT_ALREADY_REVIEWED: "The content was already reviewed, so files can no longer be added or removed.",
  TRAINING_EVIDENCE_ALREADY_RECEIVED: "This scan was already received.",
  TRAINING_FILE_INTEGRITY_FAILED: "The stored file does not match its fingerprint. Contact QA.",
  TRAINING_TRAINER_NOT_QUALIFIED: "A trainer is not qualified for a session. Ask for an exception, or choose another trainer.",
  TRAINING_TRAINER_ALREADY_QUALIFIED: "This trainer is qualified; no exception is needed.",
  TRAINING_TRAINER_EXCEPTION_EXISTS: "An exception is already waiting or approved for this session.",
  TRAINING_TRAINER_EXCEPTION_DECIDED: "This exception was already decided.",
  TRAINING_LEGACY_EVIDENCE_EXISTS: "Evidence was already submitted or verified for this revision.",
  TRAINING_LEGACY_INVALID_TRANSITION: "This action is not available in the current status of the evidence.",
  TRAINING_LEGACY_NOT_APPLICABLE: "This revision was not imported from paper or does not require training.",
  TRAINING_LEGACY_NO_FILE: "This evidence is a declaration without a file.",
  TRAINING_TOPIC_REQUIRED: "Enter at least one topic.",
};

export function trainingError(error: unknown): string {
  const response = (error as { response?: { data?: { error?: { message?: string } } } })?.response;
  const message = response?.data?.error?.message ?? "";
  const code = Object.keys(ERROR_TEXT).find((key) => message.includes(key));
  if (code) return ERROR_TEXT[code];
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 403) return ERROR_TEXT.TRAINING_SCOPE_DENIED;
  return "The action could not be completed. Check the data and try again.";
}

/** The sentence of a stable server code (for the list of what is still missing). */
export const trainingCodeText = (code: string) => ERROR_TEXT[code] ?? code;
