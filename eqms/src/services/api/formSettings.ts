import { api } from './client';

export interface FormSettings {
  documentId: string | null;
  allowEform: boolean;
  allowPaper: boolean;
  requireApproval: boolean;
  approverUserId?: string | null;
  approverName?: string | null;
  /** Server-evaluated: does the current user hold the matching permission AND is that method enabled. */
  canFillEform: boolean;
  canRecordPaper: boolean;
  hasFillableTemplate: boolean;
}

export interface FormSettingsInput {
  allowEform: boolean;
  allowPaper: boolean;
  requireApproval: boolean;
  approverUserId?: string | null;
  reason: string;
  signatureToken: string;
}

export const formSettingsApi = {
  /** GET /documents/:documentId/form-settings */
  getFormSettings: async (documentId: string): Promise<FormSettings> => {
    const response = await api.get<FormSettings>(`/documents/${documentId}/form-settings`);
    return response.data;
  },

  /** PUT /documents/:documentId/form-settings (e-signature required) */
  updateFormSettings: async (documentId: string, payload: FormSettingsInput): Promise<FormSettings> => {
    const response = await api.put<FormSettings>(`/documents/${documentId}/form-settings`, payload);
    return response.data;
  },
};
