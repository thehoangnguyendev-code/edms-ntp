import { api } from './client';
import type { ControlledCopyMarkingPreview, ControlledCopyStatusMarking } from './controlledCopyPolicy';
import type { PageResponse } from './notificationPolicy';

/**
 * Single-row Uncontrolled Copies Policy (mirrors controlledCopyPolicy.ts, simplified): approval step toggle,
 * validity window, re-download toggle, watermark/stamp styling and staged eligibility-rule changes.
 * The watermark itself is mandatory; its text and styling remain configurable.
 */
export type UncontrolledCopyPolicyMarking = ControlledCopyStatusMarking;

export interface UncontrolledCopyPolicy {
  approvalRequired: boolean;
  validityHours: number;
  allowRedownload: boolean;
  marking: UncontrolledCopyPolicyMarking;
}

/** Draft marking drawn by the server on a Publishing Template page (nothing is saved). Response shape = Controlled Copy's. */
export interface UncontrolledCopyMarkingPreviewRequest {
  templateId?: string;
  layout: 'portrait' | 'landscape';
  pageKind: 'COVER' | 'BODY';
  marking: UncontrolledCopyPolicyMarking;
}

export type UncontrolledCopyPolicyInput = Partial<Omit<UncontrolledCopyPolicy, 'marking'>> & {
  marking?: Partial<UncontrolledCopyPolicyMarking>;
  eligibilityRuleChanges?: Array<{
    id: string | null;
    expectedUpdatedAt: string | null;
    delete: boolean;
    documentTypeId: string | null;
    allowed: boolean;
    active: boolean;
  }>;
};

/** One row of the Uncontrolled Copy eligibility matrix (V503, simplified to Document Type only by
 *  V507). A null documentTypeId means "Any" -- render documentTypeName as "Any" when null. */
export interface UncontrolledCopyEligibilityRule {
  id: string;
  documentTypeId: string | null;
  documentTypeName: string | null;
  allowed: boolean;
  active: boolean;
  /** Seeded default marker only; does not lock any action. */
  system: boolean;
  updatedAt: string;
}

/** documentTypeId null = "Any". All rows are editable by policy managers. */
export interface UncontrolledCopyEligibilityRuleInput {
  documentTypeId?: string | null;
  allowed: boolean;
  active: boolean;
  reason?: string;
}

export const uncontrolledCopyPolicyApi = {
  getPolicy: async (): Promise<UncontrolledCopyPolicy> => {
    const response = await api.get<UncontrolledCopyPolicy>('/documents/administration/uncontrolled-copies-policy');
    return response.data;
  },

  /** One save = one e-signature = one consolidated Audit Trail entry on the server. */
  savePolicy: async (
    payload: UncontrolledCopyPolicyInput,
    sig?: { signatureToken: string; reason?: string },
  ): Promise<UncontrolledCopyPolicy> => {
    const response = await api.put<UncontrolledCopyPolicy>('/documents/administration/uncontrolled-copies-policy', { ...payload, ...sig });
    return response.data;
  },

  /** Server-rendered preview with the same engine and lines as real generation; policy administrators only. */
  previewMarking: async (payload: UncontrolledCopyMarkingPreviewRequest): Promise<ControlledCopyMarkingPreview> => {
    const response = await api.post<ControlledCopyMarkingPreview>('/documents/administration/uncontrolled-copies-policy/marking-preview', payload);
    return response.data;
  },

  /** GET .../eligibility-rules (unpaged -- used only for the small "N active rules" style summaries) */
  listEligibilityRules: async (): Promise<UncontrolledCopyEligibilityRule[]> => {
    const response = await api.get<UncontrolledCopyEligibilityRule[]>('/documents/administration/uncontrolled-copies-policy/eligibility-rules');
    return response.data;
  },

  /** GET .../eligibility-rules/page -- server-side search/status-filter/pagination, mirrors the SoD screen. */
  listEligibilityRulesPaged: async (params: {
    page: number;
    limit: number;
    search?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
    sortBy?: 'documentTypeName' | 'allowed' | 'active' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  }): Promise<PageResponse<UncontrolledCopyEligibilityRule>> => {
    const response = await api.get<PageResponse<UncontrolledCopyEligibilityRule>>(
      '/documents/administration/uncontrolled-copies-policy/eligibility-rules/page',
      { params: { ...params, status: params.status === 'ALL' ? undefined : params.status } },
    );
    return response.data;
  },

  /** POST .../eligibility-rules */
  createEligibilityRule: async (payload: UncontrolledCopyEligibilityRuleInput): Promise<UncontrolledCopyEligibilityRule> => {
    const response = await api.post<UncontrolledCopyEligibilityRule>('/documents/administration/uncontrolled-copies-policy/eligibility-rules', payload);
    return response.data;
  },

  /** PUT .../eligibility-rules/:id */
  updateEligibilityRule: async (id: string, payload: UncontrolledCopyEligibilityRuleInput): Promise<UncontrolledCopyEligibilityRule> => {
    const response = await api.put<UncontrolledCopyEligibilityRule>(`/documents/administration/uncontrolled-copies-policy/eligibility-rules/${id}`, payload);
    return response.data;
  },

  /** DELETE .../eligibility-rules/:id */
  deleteEligibilityRule: async (id: string, reason?: string): Promise<void> => {
    await api.delete(`/documents/administration/uncontrolled-copies-policy/eligibility-rules/${id}`, { params: reason ? { reason } : undefined });
  },
};
