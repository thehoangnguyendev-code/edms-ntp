import apiClient from "./client";

/**
 * Manual numbering (Document Properties > Numbering). The server decides every answer here; the screens only show it. A Document Number follows the
 * Document Type (its code, a dot, the configured number of digits); a Training Number follows TRN/<department code>/YY-NNN.
 */
export interface DocumentNumberCheck {
  valid: boolean;
  code: string;
  message?: string | null;
  number: string;
  expectedFormat: string;
  suggestedNext?: string | null;
  farFromNext: boolean;
  usedBy?: string | null;
}

export interface TrainingNumberCheck {
  valid: boolean;
  code: string;
  message?: string | null;
  number: string;
  expectedFormat: string;
  otherYear: boolean;
  usedBy?: string | null;
}

/** Whether a number already saved may still be changed, and why not. */
export interface NumberChangeState {
  manual: boolean;
  editable: boolean;
  reasonCode?: string | null;
  message?: string | null;
}

export const numberEntryApi = {
  /** How a Training Number is given (Training Properties): AUTO or MANUAL. */
  trainingNumberMode: async () => (await apiClient.get<{ mode: "AUTO" | "MANUAL" }>("/training/numbers/mode")).data.mode,
  checkDocumentNumber: async (params: { documentTypeId?: string; number: string; excludeDocumentId?: string }) =>
    (await apiClient.get<DocumentNumberCheck>("/documents/number/check", { params })).data,
  documentNumberState: async (documentId: string) =>
    (await apiClient.get<NumberChangeState>(`/documents/${documentId}/number-state`)).data,
  changeDocumentNumber: async (documentId: string, body: { documentNumber: string; reason: string }) =>
    (await apiClient.put<{ documentNumber: string }>(`/documents/${documentId}/number`, body)).data,

  checkTrainingNumber: async (params: { departmentId?: string; number: string; excludeActivityId?: string }) =>
    (await apiClient.get<TrainingNumberCheck>("/training/numbers/check", { params })).data,
  trainingNumberState: async (activityId: string) =>
    (await apiClient.get<NumberChangeState>(`/training/numbers/activities/${activityId}/state`)).data,
  changeTrainingNumber: async (activityId: string, body: { number: string; reason: string }) =>
    (await apiClient.put<{ status: string }>(`/training/numbers/activities/${activityId}`, body)).data,
};
