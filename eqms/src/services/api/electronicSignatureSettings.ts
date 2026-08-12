import api from './client';

export interface ElectronicSignatureMeaning {
  id?: string;
  code: string;
  displayName: string;
  description?: string;
  requiresReason: boolean;
  requiresComment: boolean;
  active: boolean;
  commentRule: 'HIDDEN' | 'OPTIONAL' | 'REQUIRED';
  allowedReasons: string[];
}

export interface ElectronicSignatureSettings {
  requirePasswordBeforeSigning: boolean;
  requireReason: boolean;
  commentRule: 'OPTIONAL' | 'REQUIRED' | 'HIDDEN';
  allowedAuthMethod: 'PASSWORD';
  showAuditTrailSummary: boolean;
  signatureTimestampFormat: 'dd-MMM-uuuu HH:mm:ss' | 'dd/MM/uuuu HH:mm:ss' | 'uuuu-MM-dd HH:mm:ss' | 'MM/dd/uuuu hh:mm:ss a' | 'dd-MMM-uuuu HH:mm' | 'dd/MM/uuuu HH:mm' | 'uuuu-MM-dd HH:mm' | 'MM/dd/uuuu hh:mm a';
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

export interface ElectronicSignatureTimestampPreview {
  previewBlock: string;
}

export const electronicSignatureSettingsApi = {
  getSettings: async () => {
    const response = await api.get<ElectronicSignatureSettings>('/settings/electronic-signature');
    return response.data;
  },
  getMeaningPolicy: async (code: string) => {
    const response = await api.get<ElectronicSignatureMeaning>(`/electronic-signature/meanings/${encodeURIComponent(code)}`);
    return response.data;
  },
  saveSettings: async (payload: ElectronicSignatureSettings, sig?: { signatureToken: string; reason?: string }) => {
    const response = await api.put<ElectronicSignatureSettings>('/settings/electronic-signature', { ...payload, ...sig });
    return response.data;
  },
  previewTimestamp: async (payload: Pick<ElectronicSignatureSettings, 'signatureTimestampFormat' | 'signatureTimezone'>) => {
    const response = await api.post<ElectronicSignatureTimestampPreview>('/settings/electronic-signature/timestamp-preview', payload);
    return response.data;
  },
  generatePdfPreview: async () => {
    const response = await api.get<Blob>('/settings/electronic-signature/pdf-preview', { responseType: 'blob' });
    return response.data;
  },
  getRevisionSignatures: async (revisionId: string) => {
    const response = await api.get<ElectronicSignatureRecord[]>(`/revisions/${revisionId}/electronic-signatures`);
    return response.data;
  },
};
