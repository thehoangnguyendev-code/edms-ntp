import apiClient from "./client";

/**
 * What Document Control shows about the training of a document or revision: the Training Number and the state of the activity, read from Training
 * Management (SDS-TR-001 section 6). The number is issued by the server when the document is saved; the screen never makes one up.
 */
export interface TrainingLink {
  /** INTEGRATED (completed through Training Management), MANUAL (dates typed in Document Control) or null (no training). */
  mode: "INTEGRATED" | "MANUAL" | null;
  origin: "NATIVE" | "LEGACY_IMPORT";
  /** True when the person may open Training Management. */
  canOpen: boolean;
  activityId?: string;
  trainingNumber: string | null;
  status?: TrainingActivityStatus;
  /** The text of the status, as the server gives it. */
  statusLabel?: string | null;
  kind?: string;
  trainingPeriodDays?: number | null;
  approvedOn?: string | null;
  dueDate?: string | null;
  completedOn?: string | null;
  /** The day the attendance list was sent to QA. */
  attendanceSentOn?: string | null;
  /** The day the trainer finished the training (Finish Training): from then on the revision can be completed. */
  finishedOn?: string | null;
}

export type TrainingActivityStatus = "RESERVED" | "PLANNED" | "NOTIFIED" | "IN_PROGRESS" | "PENDING_QA_CONFIRMATION" | "COMPLETED" | "CANCELLED";

export const trainingLinksApi = {
  forDocument: async (documentId: string) => (await apiClient.get<TrainingLink>(`/training/links/documents/${documentId}`)).data,
  forRevision: async (revisionId: string) => (await apiClient.get<TrainingLink>(`/training/links/revisions/${revisionId}`)).data,
};
