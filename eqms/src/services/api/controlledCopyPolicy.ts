import { api } from './client';

/**
 * A row in the unified Expiry Duration Policy. Every Controlled Copy always has an expiry —
 * resolved from the most specific active row matching its document type/department, falling back
 * to the mandatory "Global Default" row (documentTypeId = departmentId = null, isSystem = true,
 * always present, cannot be deleted, scope cannot be changed).
 */
export interface ControlledCopyExpiryLimit {
  id: string;
  documentTypeId?: string | null;
  documentTypeName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  maxDurationDays: number;
  active: boolean;
  isSystem: boolean;
  description?: string | null;
}

export interface ControlledCopyExpiryLimitInput {
  documentTypeId?: string | null;
  departmentId?: string | null;
  maxDurationDays: number;
  active?: boolean;
  description?: string | null;
  signatureToken?: string;
  reason?: string;
}

export interface ControlledCopyPolicyDistributionSecurity {
  allowEmailDistribution: boolean;
  allowPortalView: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
  downloadOnce: boolean;
  printOnce: boolean;
  watermarkEnabled: boolean;
  watermarkCopyNumber: boolean;
  watermarkRecipient: boolean;
  watermarkDistributedDate: boolean;
  watermarkExpiryDate: boolean;
}

export interface ControlledCopyPolicyRecall {
  allowManualRecall: boolean;
  allowReportLost: boolean;
  allowReportDamaged: boolean;
  allowReplacementForLostDamaged: boolean;
}

export interface ControlledCopyPolicy {
  distributionSecurity: ControlledCopyPolicyDistributionSecurity;
  recallLostDamaged: ControlledCopyPolicyRecall;
}

export const controlledCopyPolicyApi = {
  getPolicy: async (): Promise<ControlledCopyPolicy> => {
    const response = await api.get<ControlledCopyPolicy>('/settings/controlled-copy-policy');
    return response.data;
  },

  savePolicy: async (payload: ControlledCopyPolicy, sig?: { signatureToken: string; reason?: string }): Promise<ControlledCopyPolicy> => {
    const response = await api.put<ControlledCopyPolicy>('/settings/controlled-copy-policy', { ...payload, ...sig });
    return response.data;
  },

  listExpiryLimits: async (): Promise<ControlledCopyExpiryLimit[]> => {
    const response = await api.get<ControlledCopyExpiryLimit[]>('/settings/controlled-copy-expiry-limits');
    return response.data;
  },

  createExpiryLimit: async (payload: ControlledCopyExpiryLimitInput): Promise<ControlledCopyExpiryLimit> => {
    const response = await api.post<ControlledCopyExpiryLimit>('/settings/controlled-copy-expiry-limits', payload);
    return response.data;
  },

  updateExpiryLimit: async (id: string, payload: ControlledCopyExpiryLimitInput): Promise<ControlledCopyExpiryLimit> => {
    const response = await api.put<ControlledCopyExpiryLimit>(`/settings/controlled-copy-expiry-limits/${id}`, payload);
    return response.data;
  },

  deleteExpiryLimit: async (id: string, sig: { signatureToken: string; reason?: string }): Promise<void> => {
    await api.delete(`/settings/controlled-copy-expiry-limits/${id}`, { data: sig });
  },
};
