import { api } from './client';
import type {
  WorkflowActionPolicy,
  WorkflowActionPolicyRequest,
  WorkflowActionPolicyCreateRequest,
  WorkflowActionPolicyPreviewResponse,
  WorkflowActionPolicyEffectiveResponse,
  WorkflowActionPolicyOptions,
} from '@/features/security-authorization/lifecycle-policies/types';

export const workflowActionPolicyApi = {
  listPolicies: async (): Promise<WorkflowActionPolicy[]> => {
    const response = await api.get<WorkflowActionPolicy[]>('/security/workflow-action-policies');
    return response.data;
  },

  listPoliciesPaged: async (params: {
    page?: number; limit?: number; search?: string; workflow?: string; action?: string;
    fromStatus?: string; documentType?: string; active?: string; type?: string;
    createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
    sortBy?: string; sortDir?: string;
  }): Promise<{ data: WorkflowActionPolicy[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const response = await api.get<{ data: WorkflowActionPolicy[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/security/workflow-action-policies/paged', { params });
    return response.data;
  },

  getPolicy: async (id: string): Promise<WorkflowActionPolicy> => {
    const response = await api.get<WorkflowActionPolicy>(`/security/workflow-action-policies/${id}`);
    return response.data;
  },

  createPolicy: async (payload: WorkflowActionPolicyCreateRequest): Promise<WorkflowActionPolicy> => {
    const response = await api.post<WorkflowActionPolicy>('/security/workflow-action-policies', payload);
    return response.data;
  },

  updatePolicy: async (id: string, payload: WorkflowActionPolicyRequest): Promise<WorkflowActionPolicy> => {
    const response = await api.put<WorkflowActionPolicy>(`/security/workflow-action-policies/${id}`, payload);
    return response.data;
  },

  createDocumentTypeOverride: async (id: string, payload: WorkflowActionPolicyRequest): Promise<WorkflowActionPolicy> => {
    const response = await api.post<WorkflowActionPolicy>(
      `/security/workflow-action-policies/${id}/create-document-type-override`,
      payload,
    );
    return response.data;
  },

  duplicatePolicy: async (id: string, payload?: { changeReason?: string; signatureToken?: string }): Promise<WorkflowActionPolicy> => {
    const response = await api.post<WorkflowActionPolicy>(
      `/security/workflow-action-policies/${id}/duplicate`,
      payload ?? {},
    );
    return response.data;
  },

  previewUpdate: async (id: string, payload: WorkflowActionPolicyRequest): Promise<WorkflowActionPolicyPreviewResponse> => {
    const response = await api.post<WorkflowActionPolicyPreviewResponse>(
      `/security/workflow-action-policies/${id}/preview-update`,
      payload,
    );
    return response.data;
  },

  activatePolicy: async (id: string, sig: { signatureToken: string; reason?: string }): Promise<WorkflowActionPolicy> => {
    const response = await api.post<WorkflowActionPolicy>(`/security/workflow-action-policies/${id}/activate`, sig);
    return response.data;
  },

  deactivatePolicy: async (id: string, sig: { signatureToken: string; reason?: string }): Promise<WorkflowActionPolicy> => {
    const response = await api.post<WorkflowActionPolicy>(`/security/workflow-action-policies/${id}/deactivate`, sig);
    return response.data;
  },

  resetToDefault: async (id: string, sig?: { signatureToken: string; reason?: string }): Promise<WorkflowActionPolicy> => {
    const response = await api.post<WorkflowActionPolicy>(`/security/workflow-action-policies/${id}/reset-default`, sig ?? {});
    return response.data;
  },

  getEffectivePolicy: async (params: {
    moduleKey: string;
    workflowKey: string;
    objectType: string;
    actionCode: string;
    fromStatus: string;
    documentTypeId?: string | null;
  }): Promise<WorkflowActionPolicyEffectiveResponse> => {
    const response = await api.get<WorkflowActionPolicyEffectiveResponse>(
      '/security/workflow-action-policies/effective',
      { params },
    );
    return response.data;
  },

  getOptions: async (): Promise<WorkflowActionPolicyOptions> => {
    const response = await api.get<WorkflowActionPolicyOptions>('/security/workflow-action-policies/options');
    return response.data;
  },

  /** New hybrid-engine relation model -- see `WorkflowActionPolicy.relations` for details. */
  setPolicyRelations: async (
    id: string,
    payload: { relationDefinitionIds: string[]; relationMatchRule: "ANY" | "ALL" },
    sig?: { signatureToken?: string; reason?: string },
  ): Promise<WorkflowActionPolicy> => {
    const response = await api.put<WorkflowActionPolicy>(`/authorization/workflow-policies/${id}/relations`, { ...payload, ...sig });
    return response.data;
  },

  /** The relations the policy forbids (a different person); the required ones are set by setPolicyRelations. */
  setForbiddenRelations: async (
    id: string,
    payload: { relationDefinitionIds: string[] },
    sig?: { signatureToken?: string; reason?: string },
  ): Promise<WorkflowActionPolicy> => {
    const response = await api.put<WorkflowActionPolicy>(`/authorization/workflow-policies/${id}/forbidden-relations`, { ...payload, ...sig });
    return response.data;
  },
};

/** One "a different person" rule that an administrator can switch on or off (ON while its policy carries an active forbidden relation). */
export interface SeparationRule {
  id: string;
  moduleKey: string;
  moduleLabel: string;
  workflowKey: string;
  workflowLabel: string;
  objectType: string;
  actionCode: string;
  actionLabel: string;
  fromStatus: string;
  fromStatusLabel: string | null;
  relationCode: string;
  relationLabel: string;
  description: string | null;
  enabled: boolean;
  policyId: string;
  policyActive: boolean;
}

export const separationRulesApi = {
  /** Filtered on the server: free text, one module, ON or OFF. */
  list: async (params: { search?: string; moduleKey?: string; state?: "ON" | "OFF" } = {}): Promise<SeparationRule[]> => {
    const response = await api.get<SeparationRule[]>('/authorization/separation-rules', { params });
    return response.data;
  },

  /** Saves the ticks of a screen under ONE signature (a signature can be used only once); signed and audited by the server. */
  setMany: async (changes: { id: string; enabled: boolean }[], sig: { reason: string; signatureToken: string }): Promise<SeparationRule[]> => {
    const response = await api.put<SeparationRule[]>('/authorization/separation-rules', { changes, ...sig });
    return response.data;
  },
};
