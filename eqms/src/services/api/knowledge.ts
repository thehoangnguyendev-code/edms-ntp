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
  /** Size of the current revision's file, when one is recorded. */
  sizeBytes?: number | null;
  /** When the signed-in user last opened this document from the portal (ISO-8601), or null. */
  myLastOpenedAt?: string | null;
}

/** One line of the search box's drop-down: a document the signed-in user may open in the Knowledge Base. */
export interface DocumentSuggestion {
  id: string;
  documentNumber: string | null;
  documentName: string | null;
  revisionNumber: string | null;
  documentType: string | null;
  department: string | null;
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
  /** One page of the documents in this folder. */
  documents: KnowledgePortalDocument[];
  /** All documents in this folder, across pages. */
  totalDocuments: number;
  page: number;
  limit: number;
}

export interface KnowledgeBrowseOptions {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/** How a Business Unit, Department or Document Type is drawn as a folder: its abbreviation and the colour it was given (null: automatic). `id` is the key the folder carries. */
export interface FolderStyle {
  id: string;
  name: string;
  abbreviation: string | null;
  color: string | null;
}

/** What a Document Type was given for its icon in the explorer (empty: the automatic one). `name` is what a document carries as its type. */
export interface DocumentTypeIcon {
  name: string;
  shortCode: string;
  iconLabel: string | null;
  iconColor: string | null;
}

export type SharingKind = 'BUSINESS_UNIT' | 'DEPARTMENT' | 'DOCUMENT_TYPE' | 'DOCUMENT';
/** What the current user is for the item: ADMIN (the administrator, the person designated as DCO), UNIT_HEAD, DEPARTMENT_HEAD or DELEGATE (a person a Head named). */
export type SharingLevel = 'ADMIN' | 'UNIT_HEAD' | 'DEPARTMENT_HEAD' | 'DELEGATE' | 'NONE';

/** What a folder or a document of the explorer is, as far as sharing goes (the server works it out from the hierarchy). */
export interface SharingNode {
  shareable: boolean;
  /** Why it cannot be shared (when `shareable` is false). */
  reason: string | null;
  kind: SharingKind | null;
  businessUnitId: string | null;
  businessUnitName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  documentTypeId: string | null;
  documentId: string | null;
  label: string | null;
  canManage: boolean;
  level: SharingLevel;
  /** A delegate cannot exclude anybody. */
  canExclude: boolean;
  /** Only a Head (and the administrator) names the people who may share. */
  canManageDelegates: boolean;
}

/** A person or group a share is for; `canShare` marks a user a Head named to share (a delegate). */
export interface SharingChip {
  label: string;
  canShare: boolean;
}

export interface SharingEntry {
  ruleId: string;
  effect: 'ALLOW' | 'DENY';
  scopeKind: string;
  scopeLabel: string;
  /** True when the share is on a wider item (the Unit, the Department, a Document Type) and reaches this one by inheritance. */
  inherited: boolean;
  /** True when the share is on this very item and the current user may remove it. */
  removable: boolean;
  grantees: string[];
  chips: SharingChip[];
  createdBy: string | null;
  createdByLevel: SharingLevel;
  createdAt: string | null;
  createdByMe: boolean;
}

export interface SharingAccess {
  node: SharingNode;
  entries: SharingEntry[];
}

export interface SharingGrantee {
  id: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
}

/** One page of a list that is read as it is scrolled: what was asked for, and how many there are in all. */
export interface SharingPage<T> {
  items: T[];
  total: number;
}

/** What is taken away when a row of "Who has access" is removed: one person, Position or Department, or a whole group of a share. */
export type SharingGranteeType = 'USER' | 'POSITION' | 'DEPARTMENT' | 'WHOLE' | 'EVERYONE';

/** One row of "Who has access": a person, Position, Department or group a share reaches. */
export interface SharingPerson {
  ruleId: string;
  effect: 'ALLOW' | 'DENY';
  granteeType: SharingGranteeType;
  granteeId: string | null;
  label: string;
  /** Employee ID and Department of a person. */
  detail: string | null;
  /** A person a Head named to share. */
  canShare: boolean;
  inherited: boolean;
  removable: boolean;
  scopeLabel: string;
  createdBy: string | null;
  createdByLevel: SharingLevel;
  createdAt: string | null;
  createdByMe: boolean;
}

export interface SharingPageQuery {
  search?: string;
  offset?: number;
  limit?: number;
}

export interface SharingScope {
  scopeKind: 'DEPARTMENT' | 'BUSINESS_UNIT';
  businessUnitId?: string | null;
  departmentId?: string | null;
}

export interface SharingOptions {
  positions: { value: string; label: string }[];
  departments: { value: string; label: string }[];
}

/** The Departments and Business Units the current user may share (empty for most users). */
export interface SharingManaged {
  departmentIds: string[];
  businessUnitIds: string[];
}

export interface SharingNodeRef {
  kind: SharingKind;
  businessUnitId?: string | null;
  departmentId?: string | null;
  documentTypeId?: string | null;
  documentId?: string | null;
}

export interface SharingGrantPayload extends SharingNodeRef {
  /** ALLOW shares the item, DENY excludes the people (an exclusion always wins; Heads only). */
  effect: 'ALLOW' | 'DENY';
  userIds: string[];
  positionIds: string[];
  departmentIds: string[];
  /** Everyone of the Department that owns the item (of the Unit, for the folder of a Unit). */
  wholeDepartment: boolean;
  /** Everyone who may open the Knowledge Base. */
  everyone: boolean;
}

export interface SharingDelegate {
  id: string;
  userId: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  position: string | null;
  scopeKind: 'DEPARTMENT' | 'BUSINESS_UNIT';
  scopeLabel: string;
  grantedBy: string | null;
  grantedAt: string;
}

export interface SharingLink {
  id: string;
  scopeKind: SharingKind;
  scopeLabel: string;
  label: string;
  /** True when the link points to a wider item that reaches this one. */
  inherited: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdBy: string | null;
  createdByLevel: SharingLevel;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  /** How many people opened it. */
  opens: number;
  revocable: boolean;
}

/** A new link: the token is here and nowhere else (only its hash is stored). */
export interface SharingLinkCreated {
  link: SharingLink;
  token: string;
}

/** Where an opened link leads: a document to open, or a folder (when the hierarchy can express it). */
export interface SharingLinkTarget {
  kind: SharingKind;
  label: string;
  documentId: string | null;
  documentNumber: string | null;
  documentName: string | null;
  revisionNumber: string | null;
  department: string | null;
  hierarchyId: string | null;
  knowledgeBaseKey: string | null;
  knowledgeBaseLabel: string | null;
  path: string[];
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
  browse: async (hierarchyId: string | undefined, kb: string, path: string[], options: KnowledgeBrowseOptions = {}) =>
    (await api.get<KnowledgeBrowseResult>(`${PORTAL}/browse`, {
      params: { hierarchyId, kb, path, ...options },
      paramsSerializer: { indexes: null },
    })).data,
  /** Auto-complete: at most 10 documents the user may see in the Knowledge Base, matched on the number or the name (the server decides what is visible). */
  suggest: async (q: string, signal?: AbortSignal) =>
    (await api.get<DocumentSuggestion[]>(`${PORTAL}/suggest`, { params: { q, limit: 8 }, signal })).data,
  queryDocuments: async (options: KnowledgeBrowseOptions & { collection?: string }) =>
    (await api.get<KnowledgeBrowseResult>(`${PORTAL}/documents`, { params: options })).data,
  /** The PDF of the Effective revision, for the Knowledge preview page. */
  previewDocument: async (documentId: string, cacheBuster: string | number = Date.now()) =>
    (await api.get<Blob>(`${PORTAL}/documents/${documentId}/preview`, { responseType: 'blob', params: { _cb: cacheBuster } })).data,
  recordView: async (documentId: string) => { await api.post(`${PORTAL}/documents/${documentId}/view`); },
  giveFeedback: async (documentId: string, helpful: boolean) => { await api.put(`${PORTAL}/documents/${documentId}/feedback`, { helpful }); },
  setFeatured: async (documentId: string, featured: boolean) => {
    if (featured) await api.put(`${PORTAL}/documents/${documentId}/featured`);
    else await api.delete(`${PORTAL}/documents/${documentId}/featured`);
  },
  // ---- sharing (Heads and the people they name, from the explorer) ----
  /** The Departments and Business Units the current user may share (empty for most users). */
  folderStyles: async () => (await api.get<FolderStyle[]>(`${PORTAL}/folder-styles`)).data,
  documentTypeIcons: async () => (await api.get<DocumentTypeIcon[]>(`${PORTAL}/document-type-icons`)).data,
  sharingManaged: async () => (await api.get<SharingManaged>(`${PORTAL}/sharing/managed`)).data,
  sharingFolder: async (hierarchyId: string | undefined, kb: string, path: string[]) =>
    (await api.get<SharingNode>(`${PORTAL}/sharing/folder`, { params: { hierarchyId, kb, path }, paramsSerializer: { indexes: null } })).data,
  sharingAccess: async (ref: SharingNodeRef) => (await api.get<SharingAccess>(`${PORTAL}/sharing/access`, { params: ref })).data,
  sharingOptions: async () => (await api.get<SharingOptions>(`${PORTAL}/sharing/options`)).data,
  sharingUsers: async (search: string, scope?: SharingScope, offset = 0) =>
    (await api.get<SharingGrantee[]>(`${PORTAL}/sharing/users`, { params: { search, limit: 20, offset, ...scope } })).data,
  sharingPeople: async (ref: SharingNodeRef, query: SharingPageQuery & { mine?: boolean }) =>
    (await api.get<SharingPage<SharingPerson>>(`${PORTAL}/sharing/access/people`, { params: { ...ref, ...query } })).data,
  sharingRevokeGrantee: async (ruleId: string, type: SharingGranteeType, id: string | null) => {
    await api.delete(`${PORTAL}/sharing/grants/${ruleId}/grantees`, { params: { type, id: id ?? undefined } });
  },
  sharingGrant: async (payload: SharingGrantPayload) => (await api.post<SharingAccess>(`${PORTAL}/sharing/grants`, payload)).data,
  sharingRevoke: async (ruleId: string) => { await api.delete(`${PORTAL}/sharing/grants/${ruleId}`); },
  sharingDelegates: async (scope: SharingScope, query: SharingPageQuery = {}) =>
    (await api.get<SharingPage<SharingDelegate>>(`${PORTAL}/sharing/delegates`, { params: { ...scope, ...query } })).data,
  sharingAddDelegate: async (payload: { scopeKind: 'DEPARTMENT' | 'BUSINESS_UNIT'; businessUnitId?: string | null; departmentId?: string | null; userId: string }) =>
    (await api.post<SharingDelegate>(`${PORTAL}/sharing/delegates`, payload)).data,
  sharingRemoveDelegate: async (delegateId: string) => { await api.delete(`${PORTAL}/sharing/delegates/${delegateId}`); },
  sharingLinks: async (ref: SharingNodeRef, query: SharingPageQuery = {}) =>
    (await api.get<SharingPage<SharingLink>>(`${PORTAL}/sharing/links`, { params: { ...ref, ...query } })).data,
  sharingCreateLink: async (payload: SharingNodeRef & { expiresInDays: number | null }) =>
    (await api.post<SharingLinkCreated>(`${PORTAL}/sharing/links`, payload)).data,
  sharingRevokeLink: async (linkId: string) => { await api.delete(`${PORTAL}/sharing/links/${linkId}`); },
  /** A signed-in user opens a link and is given what it points to. */
  openLink: async (token: string) => (await api.post<SharingLinkTarget>(`${PORTAL}/sharing/links/open`, { token })).data,
  setSubscribed: async (fieldCode: string, valueKey: string, subscribed: boolean) => {
    if (subscribed) await api.put(`${PORTAL}/subscriptions`, { fieldCode, valueKey });
    else await api.delete(`${PORTAL}/subscriptions`, { params: { fieldCode, valueKey } });
  },
};
