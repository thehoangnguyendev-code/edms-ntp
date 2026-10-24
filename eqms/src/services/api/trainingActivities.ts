import apiClient from "./client";
import { getBrowserReachableApiBaseUrl } from "./documents";
import type { TrainingActivityStatus } from "./trainingLinks";

/** Training Management: activities, sessions, people and approval steps (SDS-TR-001 section 7). Everything is decided by the server; the screens only show it. */

export type TrainingKind = "INITIAL" | "PERIODIC" | "UNPLANNED" | "RETRAINING" | "EXTERNAL";
export type TrainingApprovalStep = "CONTENT_REVIEW" | "CONTENT_APPROVE" | "ACTIVITY_COMPLETE";

export interface TrainingActivitySummary {
  id: string;
  trainingNumber: string;
  trainingTitle: string;
  kind: TrainingKind;
  kindReason?: string | null;
  externalType?: "ACTIVE" | "PASSIVE" | null;
  trainingUnitName?: string | null;
  vendorRef?: string | null;
  status: TrainingActivityStatus;
  dueDate?: string | null;
  documentNumber?: string | null;
  revisionNumber?: string | null;
  year: number;
  createdAt: string;
  departmentName: string;
  participantCount: number;
  attendedCount?: number;
  passedCount?: number;
  topics?: string | null;
  trainers?: string | null;
  methods?: string | null;
  scheduledFrom?: string | null;
  scheduledTo?: string | null;
  onPaper?: boolean | null;
  createdByName?: string | null;
  revisionId?: string | null;
  /** What the person may do with the row, worked out by the server (one menu entry each). */
  actions?: { edit: boolean; conduct: boolean; review: boolean; approve: boolean; confirm: boolean; completeTraining: boolean };
}

/** A session has no "held" state: it has started when it has the day it was conducted (its first action in the workspace). */
export const sessionStarted = (s: { status: string; heldOn?: string | null }) => s.status === "PLANNED" && !!s.heldOn;
/** Planned and nothing was done in it yet: it can still be changed, postponed or given a trainer exception. */
export const sessionNotStarted = (s: { status: string; heldOn?: string | null }) => s.status === "PLANNED" && !s.heldOn;
export interface TrainingTopic { id: string; topicText: string; documentNumber?: string | null; revisionNumber?: string | null }
export interface TrainingSession {
  id: string;
  sessionNo: number;
  deliveryMode?: "ELECTRONIC" | "PAPER" | "MIXED";
  method?: "SELF_READING" | "CLASSROOM" | "HYBRID" | "PRACTICAL" | null;
  assessmentMethod?: "TEST" | "CHECKLIST" | "OBSERVATION" | "SELF_READING_CONFIRMATION" | null;
  trainerUserId?: string | null;
  trainerName?: string | null;
  externalTrainerName?: string | null;
  scheduledOn?: string | null;
  heldOn?: string | null;
  venue?: string | null;
  locationType?: "ONSITE" | "ONLINE";
  onlinePlatform?: string | null;
  meetingLink?: string | null;
  status: "PLANNED" | "POSTPONED" | "CANCELLED";
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
  avatar?: string | null;
  /** Why the person was added by hand after the list was made (the list normally comes from the matrix). */
  addedReason?: string | null;
  /** null: no test is written; READY, OPEN (started), USED (the one try is spent, the trainer may release another), DONE (submitted). */
  examState?: "READY" | "OPEN" | "USED" | "DONE" | null;
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
  readConfirmedAt?: string | null;
  signMode?: "ESIGN" | "PAPER_SCAN" | "ONLINE" | "NONE" | "TRAINER_ATTESTED" | "SELF";
  attempts?: number | null;
  lastPercent?: number | null;
  lastScore?: number | null;
  lastMax?: number | null;
}
export interface TrainingApproverRow {
  id: string;
  stepCode: TrainingApprovalStep;
  assigneeId: string;
  assigneeName: string;
  avatar?: string | null;
  status: "PENDING" | "DONE" | "REASSIGNED" | "CANCELLED";
  assignedAt: string;
  completedAt?: string | null;
}
export interface TrainingCapabilities {
  edit: boolean; planSessions: boolean; adjustPlan: boolean; addParticipants: boolean; confirmList: boolean; designateApprovers: boolean; notify: boolean; hold: boolean; recordAttendance: boolean;
  recordAssessment: boolean; submitForConfirmation: boolean; confirmCompletion: boolean; cancel: boolean; addSupplementary: boolean;
  /** Remarks stay open until the activity is completed; the session can be changed, content reopened and results returned only at the stages the server allows. */
  editRemarks?: boolean;
  editSession?: boolean;
  reopenContent?: boolean;
  setContentExemptions?: boolean;
  completeTraining?: boolean;
  /** The attendance list can be sent to QA: everyone is recorded and it was not sent yet. */
  sendAttendanceList?: boolean;
  /** Every result is in and the training is not finished: the trainer finishes it with a signature (the results go into the list APD.0117). */
  finishTraining?: boolean;
  returnForCorrection?: boolean;
  removeParticipants?: boolean;
  printPaper?: boolean;
  rollCall?: boolean;
  transcribe?: boolean;
  verifyTranscription?: boolean;
  /** Codes of what is still missing before the participants can be notified (empty when ready). */
  notifyBlockers?: string[];
}
export interface TrainingActivityDetail extends Omit<TrainingActivitySummary, "participantCount"> {
  version: number;
  /** People proposed when the document was prepared that are not yet on a list; they go on the list of the first session. */
  proposedParticipantCount?: number;
  /** For a cancelled activity: the status it was cancelled from (null for an old one). */
  cancelledFromStatus?: string | null;
  /** SOP.0003 5.3.6: where a new or revised document training stands against "the list goes to QA on the day of the training". Null when the rule does not apply. */
  resultsToQa?: { state: "WAITING" | "DUE" | "DUE_TODAY" | "OVERDUE" | "SENT" | "SENT_LATE"; days: number; dueOn?: string | null; sentOn?: string | null } | null;
  contentRules?: { materialsRequired: boolean; materialsSatisfied: boolean; materialsSource: "DOCUMENT" | "FILES" | "NONE"; testRequired: boolean; checklistRequired: boolean; assessmentFormSatisfied: boolean; onlineTest: boolean; inherited: boolean; missing: string[] } | null;
  materialsExempt?: boolean; materialsExemptReason?: string | null; assessmentExempt?: boolean; assessmentExemptReason?: string | null;
  qaList?: { state: "WAITING" | "DUE" | "DUE_TODAY" | "OVERDUE" | "SENT" | "SENT_LATE"; dueOn?: string | null; sentOn?: string | null } | null;
  departmentName: string;
  organizerDepartmentId: string;
  revisionId?: string | null;
  remarks?: string | null;
  cancelReason?: string | null;
  completedOn?: string | null;
  approvedOn?: string | null;
  /** When and by whom the attendance list was sent to QA (the revision can then be completed in Document Control). */
  attendanceSentAt?: string | null;
  attendanceSentByName?: string | null;
  resultsFinishedAt?: string | null;
  resultsFinishedByName?: string | null;
  /** The pass mark in force (percent): the result of a score is worked out by the server with it. */
  passPercent?: number;
  /** The revisions that go with the Training Number: the document of the activity first, then the documents it lists as related. */
  groupRevisions?: { revisionId: string; documentId: string; documentNumber: string; revisionNumber?: string | null; revisionName?: string | null; revisionStatus: string; isMain: boolean }[];
  listPreparedBy?: string | null;
  documentName?: string | null;
  parentActivityId?: string | null;
  sessions: TrainingSession[];
  participants: TrainingParticipant[];
  confirmations: { id: string; kind: string; confirmedAt: string; confirmedByName: string; remark?: string | null }[];
  approvers: TrainingApproverRow[];
  capabilities: TrainingCapabilities;
}
export interface TrainingPerson { id: string; avatar?: string | null; username?: string | null; fullName: string; employeeCode?: string | null; department?: string | null; position?: string | null; email?: string | null; businessUnit?: string | null }
export interface TrainingGroup { name: string; total: number }
export interface TrainingPage<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface TrainingMyApproval { id: string; stepCode: TrainingApprovalStep | "MATRIX_APPROVE" | "REQUIREMENT_REVIEW" | "REQUIREMENT_APPROVE"; objectType: string; objectId: string; activityId?: string | null; trainingNumber: string; trainingTitle: string; status: TrainingActivityStatus; assignedAt: string }

const command = async (path: string, body: unknown) => (await apiClient.post<TrainingActivityDetail>(path, body)).data;

export const trainingActivitiesApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) =>
    (await apiClient.get<TrainingPage<TrainingActivitySummary>>("/training/activities", { params })).data,
  get: async (id: string) => (await apiClient.get<TrainingActivityDetail>(`/training/activities/${id}`)).data,
  create: (body: { departmentId?: string; kind: TrainingKind; kindReason?: string; externalType?: string; trainingTitle: string; dueDate?: string; remarks?: string; trainingUnitName?: string; vendorRef?: string }) =>
    command("/training/activities", body),
  update: async (id: string, body: { version: number; trainingTitle?: string; dueDate?: string | null; remarks?: string | null; trainingUnitName?: string | null; vendorRef?: string | null }) =>
    (await apiClient.put<TrainingActivityDetail>(`/training/activities/${id}`, body)).data,
  addSession: (id: string, body: {
    method?: string; assessmentMethod?: string; trainerUserId?: string; externalTrainerName?: string; scheduledOn?: string; venue?: string; locationType?: "ONSITE" | "ONLINE"; onlinePlatform?: string; meetingLink?: string; topics: { topicText: string }[];
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
  notify: (id: string, version: number, signatureToken: string) => command(`/training/activities/${id}/notify`, { version, signatureToken }),
  finishTraining: (id: string, version: number, signatureToken: string) => command(`/training/activities/${id}/finish-training`, { version, signatureToken }),
  sendAttendanceList: (id: string, version: number, signatureToken: string) => command(`/training/activities/${id}/send-attendance-list`, { version, signatureToken }),
  submitForConfirmation: (id: string, version: number, signatureToken: string) => command(`/training/activities/${id}/submit-for-confirmation`, { version, signatureToken }),
  confirmCompletion: (id: string, version: number, signatureToken: string) => command(`/training/activities/${id}/confirm-completion`, { version, signatureToken }),
  cancel: (id: string, version: number, reason: string, signatureToken?: string) => command(`/training/activities/${id}/cancel`, { version, reason, signatureToken }),
  updateSession: async (sessionId: string, body: { trainerUserId?: string; externalTrainerName?: string; scheduledOn?: string; locationType: "ONSITE" | "ONLINE"; venue?: string; onlinePlatform?: string; meetingLink?: string; reason: string }) =>
    (await apiClient.put<TrainingActivityDetail>(`/training/sessions/${sessionId}`, body)).data,
  setContentExemptions: (id: string, body: { materialsExempt?: boolean; assessmentExempt?: boolean; reason?: string }) => command(`/training/activities/${id}/content-exemptions`, body),
  reopenContent: (id: string, version: number, reason: string, signatureToken: string) => command(`/training/activities/${id}/reopen-content`, { version, reason, signatureToken }),
  returnForCorrection: (id: string, version: number, reason: string, signatureToken: string) => command(`/training/activities/${id}/return-for-correction`, { version, reason, signatureToken }),
  supplementary: (id: string, participantIds: string[], reason: string) => command(`/training/activities/${id}/supplementary`, { participantIds, reason }),
  removeParticipant: async (participantId: string, reason: string) => (await apiClient.post<TrainingActivityDetail>(`/training/participants/${participantId}/remove`, { reason })).data,
  setPlannedAbsence: async (participantId: string, reason: string) => (await apiClient.post<TrainingActivityDetail>(`/training/participants/${participantId}/planned-absence`, { reason })).data,
  suggestedParticipants: async (activityId: string, sessionId: string) =>
    (await apiClient.get<{ data: TrainingSuggestedParticipant[] }>(`/training/activities/${activityId}/sessions/${sessionId}/suggested-participants`)).data.data,
  trainerExceptionApprovers: async (sessionId: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>(`/training/sessions/${sessionId}/trainer-exception/eligible-approvers`, { params: { search, limit: 50 } })).data,
  requestTrainerException: async (sessionId: string, reason: string, approverUserId: string) => (await apiClient.post(`/training/sessions/${sessionId}/trainer-exception`, { reason, approverUserId })).data,
  approveTrainerException: async (exceptionId: string, signatureToken: string) => (await apiClient.post(`/training/trainer-exceptions/${exceptionId}/approve`, { signatureToken })).data,
  rejectTrainerException: async (exceptionId: string, reason: string) => (await apiClient.post(`/training/trainer-exceptions/${exceptionId}/reject`, { reason })).data,
  holdSession: (sessionId: string, signatureToken?: string, heldOn?: string) => command(`/training/sessions/${sessionId}/hold`, { heldOn, signatureToken }),
  postponeSession: (sessionId: string, newDate: string, reason: string) => command(`/training/sessions/${sessionId}/postpone`, { newDate, reason }),
  attendance: (participantId: string, state: "ATTENDED" | "ONLINE" | "ABSENT", absenceReason?: string) =>
    command(`/training/participants/${participantId}/attendance`, { state, absenceReason }),
  correctAttendance: (participantId: string, state: "ATTENDED" | "ONLINE" | "ABSENT", reason: string) =>
    command(`/training/participants/${participantId}/attendance/correct`, { state, reason }),
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
  id: string; recordNo: number; personUserId: string; fullName: string; avatar?: string | null; employeeCode?: string | null; department?: string | null; position?: string | null;
  trainingNumber: string; topicText: string; documentNumber?: string | null; documentRevision?: string | null; completedOn: string; recordedAt?: string | null; method: string;
  result: "PASSED" | "READ" | "ATTENDED"; source: string; activityId: string; voidedAt?: string | null; voidReason?: string | null; voidedByName?: string | null;
}
export interface TrainingTask {
  participantId: string; activityId: string; trainingNumber: string; trainingTitle: string; status: TrainingActivityStatus; dueDate?: string | null; method: string;
  scheduledOn?: string | null; state: string; topics?: string | null; examReady?: boolean;
}
export interface TrainingNumberLogRow {
  trainingNumber: string; createdAt: string; kind: TrainingKind; status: TrainingActivityStatus; trainingTitle: string; documentNumber?: string | null;
  revisionNumber?: string | null; cancelReason?: string | null; sessions: number; postponements: number;
}
export interface TrainingSettings {
  passPercent: number; documentTrainingDaysDefault: number; annualRequirementDueMonth: number; annualRequirementDueDay: number;
  absenceRetrainMonths: number; retentionYearsAfterLeaving: number; reviewReadyReminderDays: number; reviewOpenReminderDays: number; resultsDueDays: number; integrationEnabled: boolean; version: number; updatedAt?: string;
}

export const trainingRecordsApi = {
  mine: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingRecord>>("/training/me/records", { params })).data,
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingRecord>>("/training/records", { params })).data,
  tasks: async () => (await apiClient.get<{ data: TrainingTask[] }>("/training/me/tasks")).data.data,
  voidRecord: async (id: string, reason: string, signatureToken: string) => (await apiClient.post<TrainingRecord>(`/training/records/${id}/void`, { reason, signatureToken })).data,
  numberLog: async (params: Record<string, string | number | undefined>) =>
    (await apiClient.get<TrainingPage<TrainingNumberLogRow> & { year: number }>("/training/number-log", { params })).data,
};

/** One notice in the log: sent, skipped (and why) or failed. The event is a machine code; the screen writes its own readable name. */
export interface TrainingNotificationLogRow {
  id: string; eventCode: string; channel: "IN_APP" | "EMAIL"; status: "SENT" | "FAILED" | "SKIPPED"; reasonCode?: string | null;
  objectType?: string | null; objectId?: string | null; title?: string | null; createdAt: string; recipientName: string;
}
export interface TrainingNotificationLogPage {
  data: TrainingNotificationLogRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  /** Totals by outcome within the other filters, whatever the status filter says. */
  summary: { SENT: number; FAILED: number; SKIPPED: number };
}
export interface TrainingReminderRun { candidates: number; sent: number; skipped: number; failed: number }
export const trainingNotificationsApi = {
  log: async (params: { search?: string; status?: string; channel?: string; from?: string; to?: string; sortBy?: string; sortDirection?: "asc" | "desc"; page?: number; limit?: number }) =>
    (await apiClient.get<TrainingNotificationLogPage>("/training/notifications/log", { params })).data,
  runReminders: async () => (await apiClient.post<TrainingReminderRun>("/training/notifications/run-reminders")).data,
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
  effectiveAt?: string | null; approvedAt?: string | null; preparedByName?: string | null; approvedByName?: string | null; previousId?: string | null;
}
export interface TrainingMatrixDetail { id: string; code: string; departmentName: string; versionCount: number; effective?: { id: string; versionNo: number; effectiveAt?: string | null } | null; canManage: boolean }
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
export interface TrainingPersonPosition { personId: string; fullName: string; avatar?: string | null; employeeCode?: string | null; department?: string | null; positionText?: string | null; positionId?: string | null; positionName?: string | null; suggestedPositionId?: string | null }

/** The people the author of a document proposes for its training while the document is prepared (they go on the list of the first session). */
export interface TrainingProposal {
  available: boolean; editable: boolean; activityId?: string; trainingNumber?: string;
  people: { personId: string; fullName: string; username?: string | null; email?: string | null; employeeCode?: string | null; department?: string | null; position?: string | null; avatar?: string | null }[];
}
export const trainingProposalApi = {
  get: async (documentId: string) => (await apiClient.get<TrainingProposal>(`/training/documents/${documentId}/proposed-participants`)).data,
  replace: async (documentId: string, personUserIds: string[]) => (await apiClient.put<TrainingProposal>(`/training/documents/${documentId}/proposed-participants`, { personUserIds })).data,
  people: async (search: string, limit = 20) => (await apiClient.get<{ data: TrainingPerson[] }>("/training/proposal-people", { params: { search, limit } })).data.data,
  peopleGroups: async (by: "BUSINESS_UNIT" | "DEPARTMENT") => (await apiClient.get<{ data: TrainingGroup[] }>("/training/proposal-people/groups", { params: { by } })).data.data,
  peopleInGroups: async (by: "BUSINESS_UNIT" | "DEPARTMENT", names: string[]) => (await apiClient.get<{ data: TrainingPerson[] }>("/training/proposal-people/in-groups", { params: { by, names: names.join(",") } })).data.data,
};

export const trainingMatrixApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingMatrixSummary>>("/training/matrices", { params })).data,
  create: async (departmentId: string) => (await apiClient.post<TrainingMatrixVersion>("/training/matrices", { departmentId })).data,
  get: async (id: string) => (await apiClient.get<TrainingMatrixDetail>(`/training/matrices/${id}`)).data,
  versions: (id: string) => async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingMatrixVersionRef>>(`/training/matrices/${id}/versions`, { params })).data,
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
    (await apiClient.get<{ from: number; to: number; added: TrainingMatrixRow[]; removed: TrainingMatrixRow[]; changed: (TrainingMatrixRow & { previousPositionIds: string[]; previousAnnualRequired: boolean })[]; positions: { id: string; name: string }[] }>(`/training/matrix-versions/${a}/compare/${b}`)).data,
  /** Paged, searchable, sortable topics for the Training Topics administration screen (same shape as the other paged lists). */
  topicsPage: async (params: { search?: string; scope?: string; status?: string; sortBy?: string; sortDirection?: "asc" | "desc"; page?: number; limit?: number }) =>
    (await apiClient.get<{ data: TrainingTopic[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>("/training/topics/page", { params })).data,
  topics: async (search?: string, activeOnly = false) => (await apiClient.get<{ data: TrainingTopic[] }>("/training/topics", { params: { search, activeOnly } })).data.data,
  saveTopic: async (id: string | null, body: { code?: string; name: string; scope: string; departmentId?: string | null; active?: boolean; version?: number }) =>
    (id ? await apiClient.put<TrainingTopic>(`/training/topics/${id}`, body) : await apiClient.post<TrainingTopic>("/training/topics", body)).data,
  positions: async () => (await apiClient.get<{ data: TrainingPosition[] }>("/training/positions")).data.data,
  personPositions: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingPersonPosition>>("/training/person-positions", { params })).data,
  setPersonPosition: async (personUserId: string, positionId: string) => (await apiClient.put("/training/person-positions", { personUserId, positionId })).data,
};

export interface TrainingComplianceSummary {
  required: number; ok: number; missing: number; due: number; people: number; percentTrained: number | null; hasEffectiveMatrix: boolean;
  peopleWithoutPosition: number; overdueActivities: number; dueSoonActivities: number; openReviews?: number;
}
export interface TrainingGap { pid: string; fullName: string; avatar?: string | null; employeeCode?: string | null; positionName?: string | null; title: string; code?: string | null; annualRequired: boolean; lastDone?: string | null; status: "MISSING" | "DUE" | "OK" }
export interface TrainingPaperPack { id: string; sessionId: string; sessionNo: number; packKind: "ATTENDANCE" | "EXAM"; packCode: string; copyNo: number; pageCount: number; peopleCount: number; sha256: string; reason?: string | null; printedAt: string; printedByName: string }
export interface TrainingCheckInStatus { open: boolean; code?: string; secondsLeft?: number; invited: number; checkedIn: number }
export const trainingCheckInApi = {
  status: async (sessionId: string) => (await apiClient.get<TrainingCheckInStatus>(`/training/sessions/${sessionId}/check-in`)).data,
  open: async (sessionId: string) => (await apiClient.post<TrainingCheckInStatus>(`/training/sessions/${sessionId}/check-in/open`)).data,
  close: async (sessionId: string) => (await apiClient.post<TrainingCheckInStatus>(`/training/sessions/${sessionId}/check-in/close`)).data,
  checkIn: async (body: { code: string; signatureToken: string }) => (await apiClient.post<{ activityId: string; trainingNumber: string; sessionNo: number }>("/training/me/check-in", body)).data,
};

export const trainingPaperApi = {
  /** The attendance list of the activity in the form APD.0117, as Word or PDF. */
  attendanceList: async (activityId: string, format: "docx" | "pdf") => {
    try {
      return (await apiClient.get<Blob>(`/training/activities/${activityId}/attendance-list`, { params: { format }, responseType: "blob" })).data;
    } catch (e) {
      const response = (e as { response?: { data?: unknown } }).response;
      if (response?.data instanceof Blob) {
        try { response.data = JSON.parse(await response.data.text()); } catch { /* keep the original error */ }
      }
      throw e;
    }
  },
  packs: async (activityId: string) => (await apiClient.get<TrainingPaperPack[]>(`/training/activities/${activityId}/paper-packs`)).data,
  printExam: async (sessionId: string, reason?: string) => {
    try {
      return (await apiClient.post<Blob>(`/training/sessions/${sessionId}/exam-pack`, { reason }, { responseType: "blob" })).data;
    } catch (e) {
      const response = (e as { response?: { data?: unknown } }).response;
      if (response?.data instanceof Blob) {
        try { response.data = JSON.parse(await response.data.text()); } catch { /* keep the original error */ }
      }
      throw e;
    }
  },
  rollCall: async (sessionId: string, body: { present: string[]; absent: { participantId: string; reason: string }[]; signatureToken: string }) => (await apiClient.post<TrainingActivityDetail>(`/training/sessions/${sessionId}/roll-call`, body)).data,
  setMode: async (sessionId: string, mode: string, reason?: string) => (await apiClient.post(`/training/sessions/${sessionId}/delivery-mode`, { mode, reason })).data,
  print: async (sessionId: string, reason?: string) => {
    try {
      return (await apiClient.post<Blob>(`/training/sessions/${sessionId}/paper-pack`, { reason }, { responseType: "blob" })).data;
    } catch (e) {
      // With a blob response the error body is a blob too; read it so that the stable code reaches trainingError.
      const response = (e as { response?: { data?: unknown } }).response;
      if (response?.data instanceof Blob) {
        try { response.data = JSON.parse(await response.data.text()); } catch { /* keep the original error */ }
      }
      throw e;
    }
  },
};

export interface TrainingTranscriptionLine { participantId: string; fullName: string; state: "ATTENDED" | "ABSENT"; absenceReason?: string | null; scoreObtained?: number | null; scoreMax?: number | null; remarks?: string | null }
export interface TrainingTranscription {
  id: string; sessionId: string; sessionNo: number; status: "ENTERED" | "VERIFIED" | "REJECTED"; lateReason?: string | null; rejectReason?: string | null; enteredAt: string; verifiedAt?: string | null;
  evidenceId: string; evidenceName: string; enteredBy: string; enteredByName: string; verifiedByName?: string | null; lines: TrainingTranscriptionLine[];
}
export interface TrainingTranscriptionBody { evidenceId: string; idempotencyKey: string; lateReason?: string; lines: { participantId: string; state: string; absenceReason?: string; scoreObtained?: number; scoreMax?: number; remarks?: string }[] }
export const trainingTranscriptionApi = {
  list: async (activityId: string) => (await apiClient.get<TrainingTranscription[]>(`/training/activities/${activityId}/transcriptions`)).data,
  enter: async (sessionId: string, body: TrainingTranscriptionBody) => (await apiClient.post<TrainingTranscription>(`/training/sessions/${sessionId}/transcriptions`, body)).data,
  verify: async (id: string, signatureToken: string) => (await apiClient.post<TrainingTranscription>(`/training/transcriptions/${id}/verify`, { signatureToken })).data,
  reject: async (id: string, reason: string) => (await apiClient.post<TrainingTranscription>(`/training/transcriptions/${id}/reject`, { reason })).data,
};

export interface TrainingExportBatch {
  id: string; departmentId: string; departmentName: string; year: number; status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED"; reason: string; rejectReason?: string | null; personCount: number;
  generatedAt?: string | null; sha256?: string | null; sizeBytes?: number | null; createdAt: string; preparedByName: string; approvedByName?: string | null; canApprove: boolean; canDownload: boolean;
}
export const trainingBatchExportsApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingExportBatch>>("/training/record-exports/batches", { params })).data,
  preview: async (departmentId: string, year: number) => (await apiClient.get<{ people: number; tooMany: boolean; limit: number }>("/training/record-exports/batches/preview", { params: { departmentId, year } })).data,
  eligibleApprovers: async (departmentId: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>("/training/record-exports/batches/eligible-approvers", { params: { departmentId, search, limit: 50 } })).data,
  create: async (body: { departmentId: string; year: number; reason: string; approverUserId: string; signatureToken: string }) => (await apiClient.post<TrainingExportBatch>("/training/record-exports/batches", body)).data,
  approve: async (id: string, signatureToken: string) => (await apiClient.post<TrainingExportBatch>(`/training/record-exports/batches/${id}/approve`, { signatureToken })).data,
  reject: async (id: string, reason: string) => (await apiClient.post<TrainingExportBatch>(`/training/record-exports/batches/${id}/reject`, { reason })).data,
  download: async (id: string) => (await apiClient.get<Blob>(`/training/record-exports/batches/${id}/download`, { responseType: "blob" })).data,
};

export interface TrainingPersonnelReviewSummary {
  id: string; reviewNo: number; personUserId: string; fullName: string; avatar?: string | null; employeeCode?: string | null; department?: string | null; kind: "NEW_HIRE" | "ABSENCE_RETURN" | "DEPT_TRANSFER" | "LOCATION_TRANSFER";
  status: "OPEN" | "CLOSED" | "CANCELLED"; eventDate: string; createdAt: string; createdByName: string; openItems: number; closerName?: string | null;
}
export interface TrainingReviewItem {
  itemCode: string; label: string; hint: string; canLink: boolean; status: "PENDING" | "DONE" | "NOT_NEEDED"; activityId?: string | null; trainingNumber?: string | null; trainingTitle?: string | null;
  note?: string | null; doneAt?: string | null; doneByName?: string | null;
  /** What the system already holds for the item (a specimen signature, a job assignment, an export of the record); it never marks the item done. */
  systemCheck?: { found: boolean; text: string } | null;
}
export interface TrainingPersonMatrixGaps { positionName?: string | null; required: number; missing: number; due: number; done: number; gaps: TrainingGap[] }
export interface TrainingPersonnelReview extends TrainingPersonnelReviewSummary {
  absenceFrom?: string | null; absenceTo?: string | null; absenceOverSixMonths?: boolean; departmentFrom?: string | null; departmentTo?: string | null; note?: string | null; closedAt?: string | null; closedByName?: string | null;
  cancelReason?: string | null; items: TrainingReviewItem[]; closerUserId?: string | null; closerName?: string | null; readyToClose?: boolean;
  capabilities: { editItems: boolean; close: boolean; changeCloser?: boolean; cancel: boolean };
}
export interface TrainingReviewPlan { departmentFrom?: string | null; departmentTo?: string | null; closerUserId?: string | null; closerName?: string | null; absenceRetrainMonths: number; problem?: string | null }
export const trainingReviewsApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingPersonnelReviewSummary>>("/training/personnel-reviews", { params })).data,
  get: async (id: string) => (await apiClient.get<TrainingPersonnelReview>(`/training/personnel-reviews/${id}`)).data,
  matrixGaps: async (id: string) => (await apiClient.get<TrainingPersonMatrixGaps>(`/training/personnel-reviews/${id}/matrix-gaps`)).data,
  create: async (body: { personUserId: string; kind: string; eventDate: string; absenceFrom?: string; absenceTo?: string; departmentTo?: string; note?: string }) =>
    (await apiClient.post<TrainingPersonnelReview>("/training/personnel-reviews", body)).data,
  /** What the dialog that opens a review reads from the records: the department of the employee, the head who closes, the months of absence the SOP asks for, and what blocks the review. */
  plan: async (params: { personId: string; kind?: string; departmentTo?: string }) => (await apiClient.get<TrainingReviewPlan>("/training/personnel-reviews/plan", { params })).data,
  eligibleClosers: async (personId: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>("/training/personnel-reviews/eligible-closers", { params: { personId, search, limit: 50 } })).data,
  changeCloser: async (id: string, closerUserId: string, reason: string) => (await apiClient.put<TrainingPersonnelReview>(`/training/personnel-reviews/${id}/closer`, { closerUserId, reason })).data,
  item: async (id: string, itemCode: string, body: { status: string; activityId?: string | null; note?: string | null }) => (await apiClient.put<TrainingPersonnelReview>(`/training/personnel-reviews/${id}/items/${itemCode}`, body)).data,
  close: async (id: string, signatureToken: string) => (await apiClient.post<TrainingPersonnelReview>(`/training/personnel-reviews/${id}/close`, { signatureToken })).data,
  cancel: async (id: string, reason: string) => (await apiClient.post<TrainingPersonnelReview>(`/training/personnel-reviews/${id}/cancel`, { reason })).data,
  createTraining: async (id: string, itemCode: string) => (await apiClient.post<TrainingPersonnelReview & { createdActivityId: string }>(`/training/personnel-reviews/${id}/items/${itemCode}/training`)).data,
  suggestions: async () => (await apiClient.get<TrainingReviewSuggestion[]>("/training/personnel-reviews/suggestions")).data,
};
export interface TrainingReviewSuggestion { id: string; fullName: string; employeeCode?: string | null; department?: string | null; startDate: string }

export interface ExamOption { id: string; text: string }
export interface ExamQuestion { id: string; qNo: number; kind: "SINGLE" | "MULTI" | "TRUE_FALSE"; prompt: string; options: ExamOption[]; points: number; correct?: string[] }
export interface TrainingExamDefinition { minutes?: number | null; questions: ExamQuestion[]; canSeeKey: boolean; canEdit: boolean }
export interface TrainingExamAttemptView { attemptId: string; attemptNo: number; status: "IN_PROGRESS"; startedAt?: string | null; dueAt?: string | null; questions: ExamQuestion[] }
export interface TrainingExamSummary { attemptId: string; attemptNo: number; status: "SUBMITTED" | "EXPIRED"; scoreObtained?: number | null; scoreMax?: number | null; percent?: number | null; submittedAt?: string | null }
export interface TrainingExamMine { result: "PENDING" | "PASSED" | "FAILED"; attempt: TrainingExamAttemptView | TrainingExamSummary | null; canStart: boolean }
export const trainingExamApi = {
  get: async (activityId: string) => (await apiClient.get<TrainingExamDefinition>(`/training/activities/${activityId}/exam`)).data,
  save: async (activityId: string, body: { minutes: number | null; questions: { kind: string; prompt: string; options: { id: string; text: string }[]; correct: string[]; points: number }[] }) =>
    (await apiClient.put<TrainingExamDefinition>(`/training/activities/${activityId}/exam`, body)).data,
  mine: async (participantId: string) => (await apiClient.get<TrainingExamMine>(`/training/me/participations/${participantId}/exam`)).data,
  start: async (participantId: string) => (await apiClient.post<TrainingExamAttemptView>(`/training/me/participations/${participantId}/exam/start`)).data,
  submit: async (attemptId: string, body: { answers: Record<string, string[]>; signatureToken: string }) => (await apiClient.post<TrainingExamMine>(`/training/exam-attempts/${attemptId}/submit`, body)).data,
  release: async (participantId: string, reason: string) => (await apiClient.post(`/training/participants/${participantId}/exam/release`, { reason })).data,
};

export type TrainingPrepItem = "VENUE" | "EQUIPMENT" | "MATERIALS" | "NOTICE";
export interface TrainingPreparationRow { itemCode: TrainingPrepItem; status: "PENDING" | "DONE" | "NOT_NEEDED"; assignedTo?: string | null; assignedToName?: string | null; note?: string | null; updatedAt?: string | null; updatedByName?: string | null }
export interface TrainingPreparationSession { sessionId: string; sessionNo: number; sessionStatus: string; open: number; items: TrainingPreparationRow[] }
export const trainingPreparationApi = {
  get: async (activityId: string) => (await apiClient.get<TrainingPreparationSession[]>(`/training/activities/${activityId}/preparation`)).data,
  update: async (sessionId: string, item: TrainingPrepItem, body: { status: string; assignedTo?: string | null; note?: string | null }) =>
    (await apiClient.put<TrainingPreparationSession[]>(`/training/sessions/${sessionId}/preparation/${item}`, body)).data,
};

export type TrainingCopyType = "requirement" | "job-assignment";
export interface TrainingCopyRow { id: string; departmentId: string; departmentName: string; sentAt: string; sentByName: string; note?: string | null; receivedAt?: string | null; receivedByName?: string | null; canReceive: boolean }
export interface TrainingCopyLog { rows: TrainingCopyRow[]; canSend: boolean }
export interface TrainingMyCopy { id: string; objectType: "TRAINING_REQUIREMENT" | "TRAINING_JOB_ASSIGNMENT"; objectId: string; objectName: string; fromDepartment?: string | null; sentAt: string; sentByName: string; note?: string | null; receivedAt?: string | null; receivedByName?: string | null; canReceive: boolean }
export const trainingCopyApi = {
  list: async (type: TrainingCopyType, id: string) => (await apiClient.get<TrainingCopyLog>(`/training/copies/${type}/${id}`)).data,
  send: async (type: TrainingCopyType, id: string, departmentIds: string[], note?: string) => (await apiClient.post<TrainingCopyLog>(`/training/copies/${type}/${id}`, { departmentIds, note })).data,
  receive: async (copyId: string) => (await apiClient.post(`/training/copy-distributions/${copyId}/receive`)).data,
  mine: async (sortBy?: string, sortDirection?: "asc" | "desc") => (await apiClient.get<TrainingMyCopy[]>("/training/copy-distributions/mine", { params: { sortBy, sortDirection } })).data,
};

/** Work suspended after a failed assessment (D-12). */
export interface TrainingSuspension {
  id: string; personUserId: string; fullName: string; employeeCode?: string | null; avatar?: string | null; position?: string | null; activityId: string; trainingNumber: string;
  topicText?: string | null; percent?: number | null; status: "OPEN" | "CLEARED"; raisedAt: string; clearedAt?: string | null; clearBasis?: "RETRAINED_PASSED" | "RESUMED_BY_HEAD" | null;
  clearReason?: string | null; clearedByName?: string | null; clearTrainingNumber?: string | null; canResume: boolean;
}
/** How long the records of a person who has left are kept (SOP.0003 5.3.10). */
export interface TrainingRetentionRow {
  id: string; fullName: string; employeeCode?: string | null; avatar?: string | null; position?: string | null; terminationDate: string; retainedUntil: string; records: number; ended: boolean;
}
export interface TrainingImpactRow {
  id: string; trainingNumber: string; trainingTitle: string; activityStatus: TrainingActivityStatus; documentId: string; documentNumber?: string | null; documentName?: string | null; revisionNumber?: string | null;
  departmentName: string; createdAt: string; outcome?: "MATRIX_UPDATE_NEEDED" | "MATRIX_ALREADY_COVERS" | "NO_TRAINING_IMPACT" | null; assessedAt?: string | null; assessedByName?: string | null;
  assessmentReason?: string | null; impactStatus: "PENDING" | "MATRIX_UPDATE_PENDING" | "DONE"; canAssess: boolean;
}
export interface TrainingImpactContext {
  activityId: string; trainingNumber: string; documentNumber?: string | null; documentName?: string | null; revisionNumber?: string | null;
  effectiveMatrix?: { id: string; versionNo: number } | null; inEffectiveMatrix: boolean; positionsInMatrix: string[]; positions: { id: string; name: string }[];
  latest: { outcome: string; reason: string; positions: { id: string; name: string }[] | string; assessedAt: string; assessedByName: string }[];
}
export const trainingFollowUpApi = {
  suspensions: async (params: Record<string, string | number | undefined>) => (await apiClient.get<TrainingPage<TrainingSuspension>>("/training/compliance/suspensions", { params })).data,
  resume: async (id: string, reason: string, signatureToken: string) => (await apiClient.post(`/training/compliance/suspensions/${id}/resume`, { reason, signatureToken })).data,
  retention: async (params: Record<string, string | number | undefined>) => (await apiClient.get<TrainingPage<TrainingRetentionRow> & { retentionYears: number }>("/training/compliance/retention", { params })).data,
  documentTrainings: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingImpactRow>>("/training/document-trainings", { params })).data,
  documentTrainingsSummary: async (departmentId?: string) => (await apiClient.get<{ pending: number; matrixUpdatePending: number }>("/training/document-trainings/summary", { params: { departmentId } })).data,
  impactContext: async (activityId: string) => (await apiClient.get<TrainingImpactContext>(`/training/activities/${activityId}/impact-assessment`)).data,
  assess: async (activityId: string, body: { outcome: string; reason: string; positionIds: string[]; signatureToken: string }) =>
    (await apiClient.post<TrainingImpactContext>(`/training/activities/${activityId}/impact-assessment`, body)).data,
};

export const trainingComplianceApi = {
  summary: async (departmentId?: string) => (await apiClient.get<TrainingComplianceSummary>("/training/compliance/summary", { params: { departmentId } })).data,
  coverage: async (params: Record<string, string | number | undefined>) => (await apiClient.get<TrainingPage<TrainingGap>>("/training/compliance/coverage", { params })).data,
  positions: async (departmentId?: string) => (await apiClient.get<CompletionPosition[]>("/training/compliance/positions", { params: { departmentId } })).data,
  cellDetail: async (params: { departmentId?: string; personId: string; rowId: string }) => (await apiClient.get<CompletionCellDetail>("/training/compliance/matrix-completion/cell", { params })).data,
  printCompletion: async (params: Record<string, string | number | boolean | undefined>) => {
    try {
      return (await apiClient.get<Blob>("/training/compliance/matrix-completion/print", { params, responseType: "blob" })).data;
    } catch (e) {
      const response = (e as { response?: { data?: unknown } }).response;
      if (response?.data instanceof Blob) {
        try { response.data = JSON.parse(await response.data.text()); } catch { /* keep the original error */ }
      }
      throw e;
    }
  },
  matrixCompletion: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<MatrixCompletion>("/training/compliance/matrix-completion", { params })).data,
};

export type CompletionState = "NOT_REQUIRED" | "IN_PROGRESS" | "QUALIFIED" | "UPDATE_NEEDED" | "DUE" | "REQUIRED";
export interface CompletionPosition { id: string; code: string; name: string; rowCount: number; peopleCount: number }
export interface CompletionColumn { rowId: string; group: "FACTORY_GENERAL" | "DEPARTMENT_GENERAL" | "SOP"; code?: string | null; title: string; annual: boolean; currentRevision?: string | null }
export interface CompletionCellDetail {
  person: { id: string; fullName: string; employeeCode?: string | null; department?: string | null; positions?: string | null };
  requirement: { code?: string | null; title: string; group: "FACTORY_GENERAL" | "DEPARTMENT_GENERAL" | "SOP"; annual: boolean; sop: boolean; currentRevision?: string | null };
  state: CompletionState; reason: string; lastDoneOn?: string | null; lastRevision?: string | null; lastTrainingNumber?: string | null; lastActivityId?: string | null; nextDueOn?: string | null;
  records: { id: string; recordNo: number; trainingNumber: string; activityId?: string | null; completedOn: string; documentRevision?: string | null; method: string; result: string; voided: boolean; voidReason?: string | null }[];
  openTrainings: { id: string; trainingNumber: string; trainingTitle: string; status: string; dueDate?: string | null; scheduledOn?: string | null }[];
}
export interface CompletionCell { status: CompletionState; lastDoneOn?: string | null; lastRevision?: string | null; activityId?: string | null }
export interface CompletionPerson { openReviews?: string[]; personId: string; fullName: string; employeeCode?: string | null; done: number; required: number; eligibleForAssignment: boolean; cells: Record<string, CompletionCell> }
interface PageInfo { page: number; limit: number; total: number; totalPages: number }
/** Totals of the position over everyone who matches the search, before the state filter and the paging; "open" names those still to be trained on a row. */
export interface CompletionSummary {
  people: number; ready: number; withGap: number;
  rows: Record<string, { counts: Partial<Record<CompletionState, number>>; open: { personId: string; fullName: string; employeeCode?: string | null; status: CompletionState }[]; moreOpen: number }>;
}
export interface MatrixCompletion { summary?: CompletionSummary; hasEffectiveMatrix: boolean; matrixVersionNo?: number; data: CompletionPerson[]; columns: CompletionColumn[]; pagination: PageInfo; columnPagination: PageInfo }

export interface TrainingJobSummary { id: string; issueNo: number; caseType: "INITIAL" | "CHANGE"; status: "DRAFT" | "PENDING_RECEIVER" | "EFFECTIVE" | "SUPERSEDED" | "CANCELLED"; createdAt: string; effectiveAt?: string | null; fullName: string; avatar?: string | null; employeeCode?: string | null; positionName: string; departmentName: string }
export interface TrainingJobDuty { sortOrder?: number; responsibility: string; description?: string | null }
export interface TrainingEligibilityItem { title: string; code?: string | null; annualRequired: boolean; lastDone?: string | null }
export interface TrainingEligibility { openSuspensions?: number; matrixMissing: boolean; matrixVersionId?: string | null; items: TrainingEligibilityItem[]; complete: boolean; missingCount?: number }
export interface TrainingJobDetail extends Omit<TrainingJobSummary, "fullName" | "employeeCode" | "positionName"> {
  personUserId: string; personName: string; positionId: string; positionName: string; previousPositionName?: string | null; directSuperiorTitle?: string | null; subordinateTitles?: string | null;
  substituteTitle?: string | null; changeReason?: string | null; jurisdiction?: string | null; exceptionReason?: string | null; exceptionApprovedBy?: string | null; assignorTitle?: string | null; cancelReason?: string | null;
  version: number; duties: TrainingJobDuty[]; approvers: TrainingApproverRow[]; signatures?: { meaning: string; fullName: string; signedAt: string }[]; eligibility?: TrainingEligibility;
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
  hasSecond?: boolean;
  id: string; personUserId: string; fullName: string; avatar?: string | null; employeeCode?: string | null; department?: string | null; versionNo: number; status: "PENDING" | "APPROVED" | "SUPERSEDED" | "REJECTED";
  effectiveDate?: string | null; contentType: string; sizeBytes: number; changeReason?: string | null; rejectReason?: string | null; createdAt: string; uploadedByName: string; confirmedByName?: string | null;
  capabilities: { viewImage: boolean; confirm: boolean; reject: boolean };
}
export const trainingSpecimenApi = {
  list: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingSpecimen>>("/training/specimen-signatures", { params })).data,
  eligibleConfirmers: async (personId?: string, search?: string) => (await apiClient.get<TrainingPage<TrainingPerson>>("/training/specimen-signatures/eligible-confirmers", { params: { personId, search, limit: 50 } })).data,
  upload: async (file: File, file2: File, confirmerId: string, personId?: string, reason?: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("file2", file2);
    const params: Record<string, string> = { confirmerId };
    if (personId) params.personId = personId;
    if (reason) params.reason = reason;
    return (await apiClient.post<TrainingSpecimen>("/training/specimen-signatures", form, { params, headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  image: async (id: string, which = 1) => (await apiClient.get<Blob>(`/training/specimen-signatures/${id}/image`, { params: { which }, responseType: "blob" })).data,
  confirm: async (id: string, signatureToken: string) => (await apiClient.post<TrainingSpecimen>(`/training/specimen-signatures/${id}/confirm`, { signatureToken })).data,
  reject: async (id: string, reason: string) => (await apiClient.post<TrainingSpecimen>(`/training/specimen-signatures/${id}/reject`, { reason })).data,
};

export interface TrainingRecordExport {
  id: string; personUserId: string; fullName: string; avatar?: string | null; employeeCode?: string | null; status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED"; reason: string; rejectReason?: string | null;
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

export interface TrainingRequirementSummary { id: string; requestNo: string; year: number; kind: "ANNUAL" | "SOP_PERIODIC"; status: "DRAFT" | "PENDING_REVIEW" | "PENDING_APPROVAL" | "APPROVED"; dueBy: string; departmentName: string; lineCount: number; createdAt: string; createdByName?: string | null; actions?: { edit: boolean; review: boolean; approve: boolean; track: boolean; print: boolean } }
export interface TrainingRequirementLine {
  id: string; lineNo: number; plannedMonth: string; topicId?: string | null; documentId?: string | null; activityId?: string | null; postponedFrom?: string | null; postponeReason?: string | null;
  qaComment?: string | null; qaSignedAt?: string | null; qaSignedByName?: string | null; title: string; code?: string | null; trainingNumber?: string | null; activityStatus?: string | null;
  lineStatus: "PLANNED" | "POSTPONED" | "IN_PROGRESS" | "DONE" | "OVERDUE";
}
export interface TrainingRequirementDetail extends Omit<TrainingRequirementSummary, "lineCount"> {
  departmentId: string; version: number; rejectReason?: string | null; createdByName?: string | null; preparedByName?: string | null; reviewedByName?: string | null; approvedByName?: string | null; approvedAt?: string | null;
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
export interface AssessmentEditOpen { purpose: "EXAM" | "ANSWER_KEY"; source: "TEMPLATE" | "EXISTING" | "EXAM_COPY"; templateId?: string }
export interface AssessmentEditOpened { config: Record<string, unknown>; fileName: string; purpose: string }

export interface TrainingFormTemplate {
  /** `code` is the Document Number, `title` the Document Name and `versionLabel` the Revision Number of the form. */
  id: string; code: string; title: string; versionLabel: string; originalName: string; sizeBytes: number; sha256: string; remark?: string | null; status: "ENABLED" | "DISABLED";
  uploadedAt: string; uploadedByName: string; enabledAt?: string | null; enabledByName?: string | null; disabledAt?: string | null; disabledByName?: string | null; disableReason?: string | null;
}
export interface TrainingFormTemplateRef { id: string; code: string; title: string; versionLabel: string; originalName: string; sha256: string; enabledAt?: string | null }
export const trainingFormTemplatesApi = {
  page: async (params: Record<string, string | number | boolean | undefined>) => (await apiClient.get<TrainingPage<TrainingFormTemplate>>("/training/form-templates", { params })).data,
  current: async () => (await apiClient.get<{ data: TrainingFormTemplateRef[] }>("/training/form-templates/current")).data.data,
  upload: async (file: File, body: { code: string; title: string; versionLabel: string; remark?: string }) => {
    const form = new FormData();
    form.append("file", file);
    return (await apiClient.post<TrainingFormTemplate>("/training/form-templates", form, { params: body, headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  enable: async (id: string, signatureToken: string, reason: string) => (await apiClient.post<TrainingFormTemplate>(`/training/form-templates/${id}/enable`, { signatureToken, reason })).data,
  disable: async (id: string, reason: string) => (await apiClient.post<TrainingFormTemplate>(`/training/form-templates/${id}/disable`, { reason })).data,
  viewConfig: async (id: string) => (await apiClient.get<Record<string, unknown>>(`/training/form-templates/${id}/view-config`, { params: { logoUrl: `${getBrowserReachableApiBaseUrl()}/branding/logo` } })).data,
  download: async (id: string) => (await apiClient.get<Blob>(`/training/form-templates/${id}/download`, { responseType: "blob" })).data,
};

export interface TrainingPaperEvidence {
  id: string; kind: "ATTENDANCE_SHEET" | "ASSESSMENT" | "OTHER"; originalName: string; sizeBytes: number; sha256: string; remark?: string | null; formUsed?: string | null; uploadedAt: string; receivedAt?: string | null;
  participantId?: string | null; participantName?: string | null; uploadedByName: string; receivedByName?: string | null; contentType?: string; wholeSession?: boolean;
}
export interface TrainingPersonEvidence extends TrainingPage<TrainingPaperEvidence> { trainingNumber: string; trainingTitle: string }
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
  uploadEvidence: async (activityId: string, file: File, kind: string, participantId?: string, remark?: string, onProgress?: (percent: number) => void, formUsed?: string) => {
    const form = new FormData();
    form.append("file", file);
    return (await apiClient.post<TrainingActivityFiles>(`/training/activities/${activityId}/paper-evidence`, form, { params: { kind, participantId, remark, formUsed }, headers: { "Content-Type": "multipart/form-data" }, onUploadProgress: (e) => { if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100)); } })).data;
  },
  openEditor: async (activityId: string, body: AssessmentEditOpen) => (await apiClient.post<AssessmentEditOpened>(`/training/activities/${activityId}/assessment-editor`, body)).data,
  receiveEvidence: async (id: string) => (await apiClient.post<TrainingActivityFiles>(`/training/paper-evidence/${id}/receive`)).data,
  downloadEvidence: async (id: string) => (await apiClient.get<Blob>(`/training/paper-evidence/${id}/download`, { responseType: "blob" })).data,
  /** The scans of one person in one activity, for the records, the reviews and My Training. */
  personEvidence: async (personId: string, activityId: string, params: Record<string, string | number | boolean | undefined> = {}) =>
    (await apiClient.get<TrainingPersonEvidence>(`/training/people/${personId}/activities/${activityId}/evidence`, { params })).data,
  personEvidenceViewConfig: async (personId: string, activityId: string, evidenceId: string) =>
    (await apiClient.get<Record<string, unknown>>(`/training/people/${personId}/activities/${activityId}/evidence/${evidenceId}/view-config`, { params: { logoUrl: `${getBrowserReachableApiBaseUrl()}/branding/logo` } })).data,
  personEvidenceFile: async (personId: string, activityId: string, evidenceId: string, inline: boolean) =>
    (await apiClient.get<Blob>(`/training/people/${personId}/activities/${activityId}/evidence/${evidenceId}/file`, { params: { inline }, responseType: "blob" })).data,
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
  TRAINING_PAPER_STATUS: "A paper pack can be printed after the participants are notified and until the training is submitted for confirmation.",
  TRAINING_PAPER_SESSION_STATUS: "A paper pack can be printed only for a session that is planned or held.",
  TRAINING_PAPER_NOT_PAPER: "Set the session to Paper or Mixed first.",
  TRAINING_PAPER_TOO_LARGE: "A paper pack holds at most 500 trainees. Split the session.",
  TRAINING_DELIVERY_MODE_INVALID: "Choose Electronic, Paper or Mixed.",
  TRAINING_TRANSCRIPTION_STATUS: "Results can be typed from paper only while the training is in progress.",
  TRAINING_TRANSCRIPTION_OPEN: "A transcription of this session is already waiting to be checked.",
  TRAINING_TRANSCRIPTION_DECIDED: "This transcription has already been decided.",
  TRAINING_TRANSCRIPTION_LINES_INVALID: "Check the lines: each person once, and only people of this session.",
  TRAINING_TRANSCRIPTION_ALREADY_RECORDED: "Someone in the list already has attendance recorded. Leave that person out.",
  TRAINING_SCAN_REQUIRED: "Attach the scan of the paper first (Training Materials, paper evidence) and choose it.",
  TRAINING_LATE_REASON_REQUIRED: "More than one day has passed since the session. Say why the results are typed late.",
  TRAINING_IDEMPOTENCY_REQUIRED: "The request is incomplete. Close the form and open it again.",
  TRAINING_CHECKIN_CODE_INVALID: "The code is not right or has changed. Ask the trainer for the code on the screen now.",
  TRAINING_CHECKIN_STATUS: "The check-in is not open for this training.",
  TRAINING_CHECKIN_NOT_TODAY: "You can check in only on the day of the session.",
  TRAINING_CHECKIN_ALREADY: "Your attendance is already recorded.",
  TRAINING_ATTENDANCE_ALREADY: "The attendance of this person is already recorded and is not overwritten.",
  TRAINING_RESULT_ALREADY_PASSED: "This person has already passed; the result is not recorded again.",
  TRAINING_ATTENDANCE_NOT_RECORDED: "There is no attendance to correct yet.",
  TRAINING_ATTENDANCE_UNCHANGED: "Choose a different attendance from the one recorded.",
  TRAINING_ATTENDANCE_HAS_RESULT: "This person already has a score, a test or a transcribed result, so the attendance cannot be corrected.",
  TRAINING_LIST_LOCKED: "The attendee list is confirmed and is not changed. Train a person who is not on it in a supplementary training or in a new unplanned training.",
  TRAINING_TEMPLATE_INVALID: "Check the form code, the title and the version.",
  TRAINING_TEMPLATE_VERSION_EXISTS: "This version of the form is already uploaded.",
  TRAINING_TEMPLATE_ALREADY_ENABLED: "This template is already enabled.",
  TRAINING_TEMPLATE_NOT_ENABLED: "This template is not enabled.",
  TRAINING_EDITOR_UNAVAILABLE: "The online editor is not available now. Upload the file from your computer instead.",

  TRAINING_EDIT_SOURCE_MISSING: "There is no Word file to start from. Add the exam template first.",
  TRAINING_EXAM_CONVERT_FAILED: "The Word exam could not be turned into a PDF now. Try again, or upload the exam as a PDF.",
  TRAINING_ROLL_CALL_STATUS: "A roll-call can be made only while the training is in progress.",
  TRAINING_ROLL_CALL_LINES_INVALID: "Mark each person once.",
  TRAINING_ROLL_CALL_ALREADY_RECORDED: "Someone in the list already has attendance recorded. Close the form and open it again.",
  TRAINING_DAY_ALREADY_OFF: "That day is already a day off (Saturday, Sunday or already in the list).",
  TRAINING_DAY_NOT_FOUND: "That day is not in the list.",
  TRAINING_NAME_REQUIRED: "Give the day a short name.",
  TRAINING_PREPARATION_ITEM_INVALID: "Unknown preparation item.",
  TRAINING_PREPARATION_STATUS_INVALID: "Choose Pending, Done or Not needed.",
  TRAINING_PREPARATION_ASSIGNEE_INVALID: "Choose an active person.",
  TRAINING_PREPARATION_SESSION_CLOSED: "The preparation of a session that was postponed or cancelled is not kept.",
  TRAINING_COPY_NOT_APPROVED: "Only an approved requirement or a job assignment in force can be sent.",
  TRAINING_COPY_DEPARTMENTS_INVALID: "Choose at least one department.",
  TRAINING_COPY_ALREADY_RECEIVED: "This copy was already received.",
  TRAINING_NOTE_TOO_LONG: "The note is too long (500 characters).",
  TRAINING_EXPORT_BATCH_EMPTY: "Nobody in this department has records up to that year.",
  TRAINING_EXPORT_BATCH_TOO_LARGE: "A batch holds at most 150 people. Narrow the year.",
  TRAINING_EXPORT_BATCH_CHANGED: "The people of the batch changed since it was prepared. Reject it and prepare it again.",
  TRAINING_SPECIMEN_SECOND_REQUIRED: "The 2nd specimen signature is required (FRM.0007 asks for two).",
  TRAINING_EXAM_MISSING: "Upload the exam first (Training Materials, purpose Exam).",
  TRAINING_EXAM_NOT_PDF: "The exam file must be a PDF or a Word file.",
  TRAINING_EXAM_NOT_A_TEST: "This session is not assessed by a test, so there is no exam to print.",
  TRAINING_REVIEW_ALREADY_OPEN: "An open review of this kind already exists for this person.",
  TRAINING_REVIEW_CLOSED: "This review is closed and cannot be changed.",
  TRAINING_REVIEW_ITEMS_PENDING: "Every item must be done or marked not needed before the review is closed.",
  TRAINING_REVIEW_INVALID: "Check the employee, the event and the date.",
  TRAINING_REVIEW_ABSENCE_INVALID: "Enter the period of absence, from a date up to a later date.",
  TRAINING_REVIEW_DATE_FUTURE: "The date cannot be later than today: the event has already happened.",
  TRAINING_REVIEW_RETURN_BEFORE_ABSENCE_END: "The return date cannot be before the last day of the absence.",
  TRAINING_REVIEW_ABSENCE_TOO_SHORT: "SOP.0003 asks for a review only when the absence lasts longer than the months set in Training Properties.",
  TRAINING_REVIEW_DEPARTMENT_REQUIRED: "Choose the new department.",
  TRAINING_REVIEW_SAME_DEPARTMENT: "The new department is the department the employee already works in.",
  TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING: "The department has no head. Set the Department Head in Settings, Dictionaries, Departments.",
  TRAINING_REVIEW_HEAD_IS_EMPLOYEE: "The head of the department is the employee: the review needs a person other than the employee to close it.",
  TRAINING_REVIEW_HEAD_NOT_ALLOWED: "The head of the department has no right to close training reviews.",
  TRAINING_REVIEW_ACTIVITY_INVALID: "The employee is not on the list of that training.",
  TRAINING_REVIEW_KIND_INVALID: "Unknown event.",
  TRAINING_REVIEW_ITEM_LINKED: "A training is already linked to this item.",
  TRAINING_REVIEW_ITEM_INVALID: "Unknown checklist item.",
  TRAINING_EXAM_LOCKED: "The test is part of the approved content and cannot be changed now.",
  TRAINING_EXAM_INVALID: "Check the test: each question needs its text, at least two answers for a choice question, and the right answer marked.",
  TRAINING_EXAM_NOT_AVAILABLE: "The test is not open for you now.",
  TRAINING_EXAM_ATTEMPT_USED: "You have already taken the test. Ask your trainer to release it for another try.",
  TRAINING_EXAM_EXPIRED: "The time for this attempt ran out.",
  TRAINING_EXAM_ANSWER_INVALID: "An answer does not match the question.",
  TRAINING_MATRIX_TOO_LARGE: "This matrix or position is too large to show at once. Narrow it with the search.",
  TRAINING_LIST_NOT_CONFIRMED: "Confirm the attendee list first.",
  TRAINING_CONTENT_NOT_REVIEWED: "The content must be reviewed first.",
  TRAINING_CONTENT_NOT_APPROVED: "The content and the test must be reviewed and approved first.",
  TRAINING_MATERIALS_REQUIRED: "Add the Training Materials first: a file or a link (a training on a document uses the document). If none is needed, say so with a reason in the Training Materials tab.",
  TRAINING_TEST_REQUIRED: "Add the test (APD.0009) in the Assessment tab first: a session is assessed by a test. If none is needed, say so with a reason.",
  TRAINING_CHECKLIST_REQUIRED: "Add the checklist form (APD.0009) in the Assessment tab first: a session is assessed by a checklist. If none is needed, say so with a reason.",
  TRAINING_SUSPENSION_NOT_OPEN: "This suspension is already cleared.",
  TRAINING_IMPACT_OUTCOME_INVALID: "Choose the outcome of the assessment.",
  TRAINING_IMPACT_POSITION_REQUIRED: "Choose the positions that must be trained on the document.",
  TRAINING_IMPACT_POSITION_INVALID: "A position does not belong to the department.",
  TRAINING_IMPACT_NOT_IN_MATRIX: "No effective matrix of the department contains this document yet.",
  TRAINING_IMPACT_NOT_APPLICABLE: "This training activity is not for a new or revised document.",
  TRAINING_ACTIVITY_FIELD_LOCKED: "The title, the due date and the training unit cannot be changed once the activity is notified. Only the remarks can.",
  TRAINING_SESSION_STARTED: "This session has already been held. Its trainer, date and place can no longer be changed.",
  TRAINING_SESSION_UNCHANGED: "Nothing was changed.",
  TRAINING_TRAINER_EXCEPTION_OPEN: "A trainer exception was asked for this session. Deal with it before changing the trainer.",
  TRAINING_SESSION_REQUIRED: "Add at least one session.",
  TRAINING_TRAINER_REQUIRED: "Every session needs a trainer.",
  TRAINING_PARTICIPANT_REQUIRED: "Add at least one participant.",
  TRAINING_PARTICIPANT_NOT_ELIGIBLE: "This person cannot be added or cannot be chosen for this step.",
  TRAINING_PARTICIPANT_NOT_FINAL: "Every participant must be marked as attended or absent.",
  TRAINING_RESULT_PENDING: "Every participant who attended needs a result.",
  TRAINING_SESSION_NOT_HELD: "Start the training first: in the workspace, Prepare, Next (with your signature).",
  TRAINING_PREPARATION_PENDING: "Tick every line of the Preparation checklist first.",
  TRAINING_ATTENDANCE_ALREADY_SENT: "The attendance list was already sent to QA.",
  TRAINING_ATTENDANCE_NOT_SENT: "Send the attendance list to QA first.",
  TRAINING_NOT_FINISHED: "Finish the training first: the trainer signs once every result is in.",
  TRAINING_ALREADY_FINISHED: "The training was already finished.",
  TRAINING_ACTIVITY_CLOSED: "The training activity is closed: it cannot be changed.",
  TRAINING_ASSESSMENT_METHOD_INVALID: "This session has no assessment that takes a score.",
  TRAINING_ASSIGNMENT_NOT_FOUND: "The job assignment was not found.",
  TRAINING_ATTENDANCE_INVALID: "Choose attended, online or absent.",
  TRAINING_COMPARE_SAME_MATRIX: "Choose two different versions to compare.",
  TRAINING_COPY_TYPE_INVALID: "This kind of record cannot be sent as a copy.",
  TRAINING_DATE_INVALID: "The date is not valid. Use dd/MM/yyyy.",
  TRAINING_DATE_RANGE_INVALID: "The first date must not be after the second date.",
  TRAINING_DATE_REQUIRED: "Choose a date.",
  TRAINING_DEPARTMENT_CODE_INVALID: "The department code is not valid.",
  TRAINING_DEPARTMENT_NOT_FOUND: "The department was not found.",
  TRAINING_EXTERNAL_TYPE_REQUIRED: "Choose the type of the external training.",
  TRAINING_FILTER_INVALID: "The filter is not valid.",
  TRAINING_GROUP_INVALID: "The group is not valid.",
  TRAINING_KIND_INVALID: "Choose the type of the training.",
  TRAINING_MATRIX_ROWS_REQUIRED: "Add at least one row to the training matrix.",
  TRAINING_POSITION_REQUIRED: "Choose a position.",
  TRAINING_PROPOSAL_INVALID: "The proposed people are not valid.",
  TRAINING_PROPOSAL_NO_ACTIVITY: "The proposal belongs to no training activity.",
  TRAINING_REASON_TOO_LONG: "The reason is too long (500 characters at most).",
  TRAINING_REQUIREMENT_LINES_REQUIRED: "Add at least one line to the training requirement.",
  TRAINING_SESSION_INVALID: "The session is not complete: check the method, the assessment, the place and the trainer.",
  TRAINING_SORT_NOT_ALLOWED: "This column cannot be sorted.",
  TRAINING_STATUS_INVALID: "The status is not valid.",
  TRAINING_STEP_UNKNOWN: "The step is not known.",
  TRAINING_SUPPLEMENTARY_OF_ROOT_ONLY: "A make-up training can be made only for the original training, not for another make-up.",
  TRAINING_TABLE_NOT_ALLOWED: "This table cannot be exported.",
  TRAINING_TRAINER_NOT_FOUND: "The trainer was not found or is not active.",
  TRAINING_DATE_IN_FUTURE: "The date cannot be in the future.",
  TRAINING_ASSESSMENT_SELF: "You cannot record the result of your own assessment.",
  TRAINING_SCORE_INVALID: "Enter a score between 0 and the maximum score.",
  TRAINING_ACTIVITY_HAS_RESULTS: "An activity with people who passed cannot be cancelled.",
  TRAINING_TITLE_REQUIRED: "A Training Title is required.",
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
  TRAINING_FILE_REJECTED: "The image was refused. Use a PNG, JPEG, WebP or BMP picture (not a GIF) of up to 5 MB, between 40x20 and 5000x5000 pixels, with no virus.",
  TRAINING_FILE_UNAVAILABLE: "The image is not available right now.",
  TRAINING_SPECIMEN_PENDING_EXISTS: "A specimen signature of this person is already waiting for confirmation.",
  TRAINING_SPECIMEN_INVALID_TRANSITION: "This action is not available in the current status.",
  TRAINING_MATERIAL_PURPOSE_EXISTS: "This file is already on record. Remove it first, with a reason, to add another.",
  TRAINING_PREVIEW_UNAVAILABLE: "This file cannot be previewed now. Download it instead.",
  TRAINING_FORM_TEMPLATE_MISSING: "The template APD.0117 is not enabled. Upload it and enable it in Training Properties (form templates).",
  TRAINING_FORM_TEMPLATE_STRUCTURE: "The enabled template APD.0117 does not have the parts of the form (header, general information, topics, list, confirmations). Upload the right file.",
  TRAINING_FORMAT_INVALID: "Choose Word or PDF.",
  TRAINING_ASSESSMENT_NOT_ALLOWED: "This way of assessment does not go with the training method (SOP.0003 5.1.2).",
  TRAINING_PARTICIPANT_LOCKED: "This person can no longer be changed: the attendee list is confirmed, or attendance was recorded. Mark the person absent instead.",
  TRAINING_UNIT_REQUIRED: "Enter the training unit or the person who trains (up to 255 characters).",
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
