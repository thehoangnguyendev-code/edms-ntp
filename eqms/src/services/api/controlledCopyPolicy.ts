import { api } from './client';

/**
 * A row in the unified Expiry Duration Policy. Every Controlled Copy always has an expiry —
 * resolved from the most specific active row matching its document type/department, falling back
 * to the mandatory "Global Default" row (documentTypeId = departmentId = null, isSystem = true,
 * always present, cannot be deleted, scope cannot be changed).
 */
export type ControlledCopyExpiryDurationUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';

export interface ControlledCopyExpiryLimit {
  id: string;
  documentTypeId?: string | null;
  documentTypeName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  durationValue: number;
  durationUnit: ControlledCopyExpiryDurationUnit;
  active: boolean;
  isSystem: boolean;
}

export interface ControlledCopyExpiryLimitInput {
  documentTypeId?: string | null;
  departmentId?: string | null;
  durationValue: number;
  durationUnit: ControlledCopyExpiryDurationUnit;
  active?: boolean;
  signatureToken?: string;
  reason?: string;
}

/**
 * Admin-defined placeholder field (e.g. "Recipient Department") that DCO fills in free-text when
 * distributing a Controlled Copy — merged into the {{fieldKey}} placeholder in the cover/header/
 * footer at Distribute time, alongside the built-in {{copyNo}}/{{distributionList}}.
 */
export interface ControlledCopyPlaceholderField {
  id: string;
  fieldKey: string;
  label: string;
  description?: string | null;
  active: boolean;
}

export interface ControlledCopyPlaceholderFieldInput {
  fieldKey?: string;
  label: string;
  description?: string | null;
  active?: boolean;
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
  allowReportLostDamaged: boolean;
  allowReplacementForLostDamaged: boolean;
}

/**
 * When redirectDeliveryToDco is on, the designated DCO (dcoRecipientUserId) receives the
 * printable link (single distribute) or a ZIP of all copies (batch distribute) instead of the
 * original requester(s) — for recipients without a computer/phone to view the copy themselves.
 * Requesters instead get a "your copy was distributed" notification email with no link/attachment.
 */
export interface ControlledCopyPolicyDelivery {
  redirectDeliveryToDco: boolean;
  dcoRecipientUserId?: string | null;
  dcoRecipientName?: string | null;
  dcoRecipientEmail?: string | null;
  /** False when redirectDeliveryToDco is on but the assigned user no longer holds the required permission. */
  dcoRecipientEligible?: boolean;
}

/** A user eligible to be selected as the DCO delivery recipient — holds the dedicated
 * "Receive Controlled Copies as DCO" permission (no hardcoded role/access-profile name). */
export interface ControlledCopyDcoEligibleUser {
  id: string;
  fullName: string;
  email?: string | null;
}

export interface ControlledCopyPolicy {
  distributionSecurity: ControlledCopyPolicyDistributionSecurity;
  recallLostDamaged: ControlledCopyPolicyRecall;
  delivery: ControlledCopyPolicyDelivery;
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

  getDcoEligibleUsers: async (): Promise<ControlledCopyDcoEligibleUser[]> => {
    const response = await api.get<ControlledCopyDcoEligibleUser[]>('/settings/controlled-copy-policy/dco-eligible-users');
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

  listPlaceholderFields: async (): Promise<ControlledCopyPlaceholderField[]> => {
    const response = await api.get<ControlledCopyPlaceholderField[]>('/settings/controlled-copy-placeholder-fields');
    return response.data;
  },

  createPlaceholderField: async (payload: ControlledCopyPlaceholderFieldInput): Promise<ControlledCopyPlaceholderField> => {
    const response = await api.post<ControlledCopyPlaceholderField>('/settings/controlled-copy-placeholder-fields', payload);
    return response.data;
  },

  deletePlaceholderField: async (id: string): Promise<void> => {
    await api.delete(`/settings/controlled-copy-placeholder-fields/${id}`);
  },
};
