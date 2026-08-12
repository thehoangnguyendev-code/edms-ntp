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

  getSystemDefaults: async (): Promise<WorkflowActionPolicy[]> => {
    const response = await api.get<WorkflowActionPolicy[]>('/security/workflow-action-policies/defaults/document-revision');
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
};
