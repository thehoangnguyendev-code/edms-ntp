import api from './client';

export interface ElectronicSignatureMeaning {
  id?: string;
  code: string;
  displayName: string;
}

/** One row of the table of meanings: the meaning, its module (the first word of the code) and when it was last updated. */
export interface ElectronicSignatureMeaningRow { id: string; code: string; displayName: string; module: string; updatedAt?: string | null }
export interface ElectronicSignatureMeaningPage { data: ElectronicSignatureMeaningRow[]; pagination: { page: number; limit: number; total: number; totalPages: number }; modules: string[] }

export interface ElectronicSignatureSettings {
  signatureTimestampFormat: 'dd/MM/uuuu HH:mm';
  signatureTimezone: string;
  timestampFormatEffectiveFrom?: string;
  meanings: ElectronicSignatureMeaning[];
  previewBlock?: string;
}

export interface ElectronicSignatureRecord {
  id: string;
  entityType?: string;
  entityId?: string;
  documentId?: string;
  revisionId?: string;
  workflowStepId?: string;
  userId: string;
  username: string;
  fullName: string;
  position?: string;
  email?: string;
  department?: string;
  meaning: string;
  displayMeaning: string;
  reason?: string;
  comment?: string;
  signedAt: string;
  timezone: string;
  authenticationMethod: string;
  signatureId: string;
  verificationId: string;
  status: string;
  ipAddress?: string;
  userAgent?: string;
  documentChecksumBeforeSign?: string;
  documentChecksumAfterSign?: string;
  sourceFileVersionId?: string;
  reviewPdfVersionId?: string;
  publishedPdfVersionId?: string;
  createdAt?: string;
}

export interface ElectronicSignatureDisplayStyle { style: 'COMPACT' | 'STANDARD' | 'DETAILED'; label: string; frame: string; text: string }

export const electronicSignatureSettingsApi = {
  getSettings: async () => {
    const response = await api.get<ElectronicSignatureSettings>('/settings/electronic-signature');
    return response.data;
  },
  getMeaningPolicy: async (code: string) => {
    const response = await api.get<ElectronicSignatureMeaning>(`/electronic-signature/meanings/${encodeURIComponent(code)}`);
    return response.data;
  },
  /** The meanings as a table, searched, filtered, sorted and paged by the server. */
  meaningsPage: async (params: Record<string, string | number | boolean | undefined>) => (await api.get<ElectronicSignatureMeaningPage>('/settings/electronic-signature/meanings/page', { params })).data,
  saveSettings: async (payload: ElectronicSignatureSettings, sig?: { signatureToken: string; reason?: string }) => {
    const response = await api.put<ElectronicSignatureSettings>('/settings/electronic-signature', { ...payload, ...sig });
    return response.data;
  },
  /** The three display styles of a signed signature, drawn by the server from one sample record. */
  getDisplayStyles: async () => (await api.get<ElectronicSignatureDisplayStyle[]>('/settings/electronic-signature/display-styles')).data,
  generatePdfPreview: async () => {
    const response = await api.get<Blob>('/settings/electronic-signature/pdf-preview', { responseType: 'blob' });
    return response.data;
  },
  getRevisionSignatures: async (revisionId: string) => {
    const response = await api.get<ElectronicSignatureRecord[]>(`/revisions/${revisionId}/electronic-signatures`);
    return response.data;
  },
};
