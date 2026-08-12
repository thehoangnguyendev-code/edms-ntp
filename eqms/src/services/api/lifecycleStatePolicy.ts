import { api } from './client';

export interface LifecycleStatePolicy {
  id: string;
  moduleKey: string;
  objectType: string;
  capabilityCode: string;
  statusCode: string | null;
  statusLabel: string | null;
  documentTypeId: string | null;
  documentTypeName: string | null;
  actorScope: string;
  requiredPermissionCode: string | null;
  priority: number;
  active: boolean;
  system: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleStatePolicyRequest {
  capabilityCode: string;
  statusCode?: string | null;
  documentTypeId?: string | null;
  actorScope: string;
  requiredPermissionCode?: string | null;
  priority?: number;
  active?: boolean;
  description?: string | null;
  reason?: string;
  signatureToken?: string;
}

export interface LifecycleStatePolicyOptions {
  capabilities: string[];
  actorScopes: string[];
  statuses: { value: string; label: string }[];
  permissions: { value: string; label: string }[];
  documentTypes: { value: string; label: string }[];
}

export interface LifecycleStatePolicyPage {
  data: LifecycleStatePolicy[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const BASE = '/security/state-policies';

export const lifecycleStatePolicyApi = {
  list: async (): Promise<LifecycleStatePolicy[]> => {
    const r = await api.get<LifecycleStatePolicy[]>(BASE);
    return r.data;
  },

  listPaged: async (params: {
    page?: number; limit?: number; search?: string; capability?: string; statusCode?: string;
    actorScope?: string; type?: string; active?: string;
    createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
    sortBy?: string; sortDir?: string;
  }): Promise<LifecycleStatePolicyPage> => {
    const r = await api.get<LifecycleStatePolicyPage>(`${BASE}/paged`, { params });
    return r.data;
  },

  getOptions: async (): Promise<LifecycleStatePolicyOptions> => {
    const r = await api.get<LifecycleStatePolicyOptions>(`${BASE}/options`);
    return r.data;
  },

  get: async (id: string): Promise<LifecycleStatePolicy> => {
    const r = await api.get<LifecycleStatePolicy>(`${BASE}/${id}`);
    return r.data;
  },

  create: async (payload: LifecycleStatePolicyRequest): Promise<LifecycleStatePolicy> => {
    const r = await api.post<LifecycleStatePolicy>(BASE, payload);
    return r.data;
  },

  update: async (id: string, payload: LifecycleStatePolicyRequest): Promise<LifecycleStatePolicy> => {
    const r = await api.put<LifecycleStatePolicy>(`${BASE}/${id}`, payload);
    return r.data;
  },

  remove: async (id: string, sig?: { signatureToken?: string; reason?: string }): Promise<void> => {
    await api.delete(`${BASE}/${id}`, { data: sig ?? {} });
  },
};
