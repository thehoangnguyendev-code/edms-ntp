import { api } from './client';
import type { PaginatedResponse } from '@/types';

/** One share a Department Head made in the Knowledge Base (a rule owned by a Department). */
export interface KnowledgeShareRow {
  ruleId: string;
  departmentId: string;
  departmentName: string;
  /** DEPARTMENT, DOCUMENT_TYPE or DOCUMENT. */
  scopeKind: string;
  scopeLabel: string;
  effect: 'ALLOW' | 'DENY';
  grantees: string[];
  createdBy: string | null;
  createdAt: string | null;
  active: boolean;
}

export interface KnowledgeShareListParams {
  page: number;
  limit: number;
  search?: string;
  departmentId?: string;
  effect?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface KnowledgeShareUser {
  id: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
}

export interface KnowledgeShareDocument {
  id: string;
  documentNumber: string | null;
  documentName: string | null;
  department: string | null;
}

export interface KnowledgeAccessLayer {
  layerCode: string;
  passed: boolean;
  reasonCode: string | null;
  message: string;
}

/** Why a user can or cannot see a document in the Knowledge Base, layer by layer. */
export interface KnowledgeAccessExplanation {
  userId: string;
  userName: string;
  documentId: string;
  documentLabel: string;
  canSee: boolean;
  summary: string;
  layers: KnowledgeAccessLayer[];
  decidingShare: KnowledgeShareRow | null;
}

/** One link, for the administrator. */
export interface KnowledgeLinkAdminRow {
  id: string;
  /** The Department, or the Business Unit, that owns the link. */
  ownerName: string;
  scopeKind: string;
  scopeLabel: string;
  label: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdBy: string | null;
  createdByLevel: string;
  createdAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  /** How many people opened it. */
  opens: number;
}

export interface KnowledgeLinkListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

const BASE = '/security/knowledge-shares';

export const knowledgeSharesApi = {
  list: async (params: KnowledgeShareListParams) => (await api.get<PaginatedResponse<KnowledgeShareRow>>(BASE, { params })).data,
  /** Takes a share away on behalf of the Department Head; the Audit Trail says it was an administrator. */
  revoke: async (ruleId: string) => { await api.delete(`${BASE}/${ruleId}`); },
  listLinks: async (params: KnowledgeLinkListParams) => (await api.get<PaginatedResponse<KnowledgeLinkAdminRow>>(`${BASE}/links`, { params })).data,
  /** Revokes a link on behalf of whoever made it: it stops opening anything at once. */
  revokeLink: async (linkId: string) => { await api.delete(`${BASE}/links/${linkId}`); },
  searchUsers: async (search: string) => (await api.get<KnowledgeShareUser[]>(`${BASE}/users`, { params: { search, limit: 20 } })).data,
  searchDocuments: async (search: string) => (await api.get<KnowledgeShareDocument[]>(`${BASE}/documents`, { params: { search, limit: 20 } })).data,
  explain: async (userId: string, documentId: string) => (await api.get<KnowledgeAccessExplanation>(`${BASE}/explain`, { params: { userId, documentId } })).data,
};
