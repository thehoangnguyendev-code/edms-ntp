import { api } from './client';
import type { PaginatedResponse } from '@/types';

export interface KnowledgeLevel {
  id: string;
  fieldCode: string;
  fieldLabel: string;
  displayOrder: number;
}

export interface KnowledgeHierarchy {
  id: string;
  name: string;
  description?: string | null;
  determinatorField: string;
  determinatorLabel: string;
  active: boolean;
  isDefault: boolean;
  levels: KnowledgeLevel[];
  createdAt?: string;
  updatedAt?: string;
  updatedByName?: string | null;
}

export interface KnowledgeFieldOption {
  value: string;
  label: string;
  /** True when the field may be used as a Knowledge Base determinator (one low-cardinality value per document). */
  determinatorEligible: boolean;
}

export interface KnowledgeComponent {
  id: string;
  name: string;
  sourceField: string;
  sourceLabel: string;
  description?: string | null;
  active: boolean;
  systemDefined: boolean;
  determinatorEligible: boolean;
  usedByHierarchies: number;
  createdAt?: string;
  updatedAt?: string;
  updatedByName?: string | null;
}

export interface KnowledgeSourceOption {
  value: string;
  label: string;
  determinatorEligible: boolean;
}

export interface KnowledgePortalDocumentInfo {
  id: string;
  documentNumber: string;
  documentName: string;
  revisionNumber?: string | null;
  documentType?: string | null;
  businessUnit?: string | null;
  department?: string | null;
  effectiveDate?: string | null;
  validUntil?: string | null;
  created?: string | null;
}

export interface KnowledgePortalDocument {
  document: KnowledgePortalDocumentInfo;
  views: number;
  helpfulVotes: number;
  featured: boolean;
  myFeedback?: boolean | null;
}

export interface KnowledgeBaseCard {
  key: string;
  label: string;
  documentCount: number;
  subscribed: boolean;
}

export interface KnowledgePortalOverview {
  hierarchies: { id: string; name: string; isDefault: boolean }[];
  selectedHierarchyId?: string | null;
  selectedHierarchyName?: string | null;
  determinatorField?: string | null;
  determinatorLabel?: string | null;
  levelLabels: string[];
  totalDocuments: number;
  totalKnowledgeBases: number;
  knowledgeBases: KnowledgeBaseCard[];
  featured: KnowledgePortalDocument[];
  mostViewed: KnowledgePortalDocument[];
  mostUseful: KnowledgePortalDocument[];
}

export interface KnowledgeBrowseResult {
  path: { fieldLabel: string; key: string; label: string }[];
  nextFieldLabel?: string | null;
  folders: { key: string; label: string; documentCount: number }[];
  documents: KnowledgePortalDocument[];
}

const ADMIN = '/settings/knowledge-hierarchies';
const COMPONENTS = '/settings/knowledge-components';
const PORTAL = '/documents/knowledge-portal';

export const knowledgeApi = {
  // ---- administration ----
  listHierarchies: async (params: { page: number; limit: number; search?: string; status?: string; updatedFrom?: string; updatedTo?: string; sortBy?: string; sortDir?: string }) =>
    (await api.get<PaginatedResponse<KnowledgeHierarchy>>(ADMIN, { params })).data,
  getHierarchy: async (id: string) => (await api.get<KnowledgeHierarchy>(`${ADMIN}/${id}`)).data,
  listFields: async () => (await api.get<KnowledgeFieldOption[]>(`${ADMIN}/fields`)).data,
  createHierarchy: async (payload: { name: string; description?: string; determinatorField: string; active: boolean }) =>
    (await api.post<KnowledgeHierarchy>(ADMIN, payload)).data,
  updateHierarchy: async (id: string, payload: { name: string; description?: string; determinatorField: string; active: boolean; levels?: { id?: string; fieldCode: string }[] }) =>
    (await api.put<KnowledgeHierarchy>(`${ADMIN}/${id}`, payload)).data,
  setDefault: async (id: string) => (await api.post<KnowledgeHierarchy>(`${ADMIN}/${id}/default`)).data,
  deleteHierarchy: async (id: string) => { await api.delete(`${ADMIN}/${id}`); },
  addLevel: async (id: string, payload: { fieldCode: string; displayOrder: number }) =>
    (await api.post<KnowledgeHierarchy>(`${ADMIN}/${id}/levels`, payload)).data,
  updateLevel: async (id: string, levelId: string, payload: { fieldCode: string; displayOrder: number }) =>
    (await api.put<KnowledgeHierarchy>(`${ADMIN}/${id}/levels/${levelId}`, payload)).data,
  reorderLevels: async (id: string, levelIds: string[]) =>
    (await api.put<KnowledgeHierarchy>(`${ADMIN}/${id}/levels/order`, { levelIds })).data,
  removeLevel: async (id: string, levelId: string) => (await api.delete<KnowledgeHierarchy>(`${ADMIN}/${id}/levels/${levelId}`)).data,

  // ---- components ----
  listComponents: async (params: { page: number; limit: number; search?: string; status?: string; updatedFrom?: string; updatedTo?: string; sortBy?: string; sortDir?: string }) =>
    (await api.get<PaginatedResponse<KnowledgeComponent>>(COMPONENTS, { params })).data,
  getComponent: async (id: string) => (await api.get<KnowledgeComponent>(`${COMPONENTS}/${id}`)).data,
  listComponentSources: async () => (await api.get<KnowledgeSourceOption[]>(`${COMPONENTS}/sources`)).data,
  createComponent: async (payload: { name: string; sourceField: string; description?: string; active: boolean }) =>
    (await api.post<KnowledgeComponent>(COMPONENTS, payload)).data,
  updateComponent: async (id: string, payload: { name: string; description?: string; active: boolean }) =>
    (await api.put<KnowledgeComponent>(`${COMPONENTS}/${id}`, payload)).data,
  deleteComponent: async (id: string) => { await api.delete(`${COMPONENTS}/${id}`); },

  // ---- portal ----
  getDefaultDeterminator: async () =>
    (await api.get<{ field?: string | null; label?: string | null }>(`${PORTAL}/default-determinator`)).data,
  overview: async (hierarchyId?: string) =>
    (await api.get<KnowledgePortalOverview>(PORTAL, { params: { hierarchyId } })).data,
  browse: async (hierarchyId: string | undefined, kb: string, path: string[]) =>
    (await api.get<KnowledgeBrowseResult>(`${PORTAL}/browse`, {
      params: { hierarchyId, kb, path },
      paramsSerializer: { indexes: null },
    })).data,
  search: async (q: string) => (await api.get<KnowledgePortalDocument[]>(`${PORTAL}/search`, { params: { q } })).data,
  recordView: async (documentId: string) => { await api.post(`${PORTAL}/documents/${documentId}/view`); },
  giveFeedback: async (documentId: string, helpful: boolean) => { await api.put(`${PORTAL}/documents/${documentId}/feedback`, { helpful }); },
  setFeatured: async (documentId: string, featured: boolean) => {
    if (featured) await api.put(`${PORTAL}/documents/${documentId}/featured`);
    else await api.delete(`${PORTAL}/documents/${documentId}/featured`);
  },
  setSubscribed: async (fieldCode: string, valueKey: string, subscribed: boolean) => {
    if (subscribed) await api.put(`${PORTAL}/subscriptions`, { fieldCode, valueKey });
    else await api.delete(`${PORTAL}/subscriptions`, { params: { fieldCode, valueKey } });
  },
};
