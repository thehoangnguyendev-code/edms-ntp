import { api, uploadFile } from './client';
import { authTokenStore } from '@/services/authTokenStore';
import type { Document, DocumentFilters, PaginatedResponse } from '@/types';
import type {
  DocumentFiltersLookup,
  DocumentDraftCreateRequest,
  DocumentDetailResponse,
  DocumentListItem,
  DocumentListQuery,
  KnowledgeBaseResponse,
  KnowledgeBaseDepartmentItem,
  KnowledgeBaseFolderItem,
} from '@/features/documents/document-list/types';
import type { AuditTrailRecord } from '@/features/audit-trail/types';
import { normalizeAuditTrailRecord } from './auditTrail';
import type { ControlledCopyDistributionBatch } from '@/features/documents/controlled-copies/types';
import type {
  RevisionDetailResponse,
  RevisionReviewCommentItem,
  RevisionReviewCommentAttachmentItem,
  RevisionReviewCommentListResponse,
  RevisionSnapshotHistoryItem,
} from '@/features/documents/document-revisions/detail-revision/types';
import type {
  PublishingTemplateResponse,
  PublishingTemplateVersionResponse,
  PublishingWorkspaceRequest,
  PublishingWorkspaceResponse,
} from '@/features/documents/publishing/types';
import type {
  RevisionActionCapabilitiesResponse,
} from '@/features/documents/document-revisions/shared/revisionActionCapabilities';
import type {
  ControlledCopyActionCapabilities,
} from '@/features/documents/controlled-copies/controlledCopyCapabilities';
import { formatDocumentTypeLookupLabel } from '@/features/documents/shared/documentTypeDisplay';

const DOCUMENTS_ENDPOINT = '/documents';
const REVISIONS_ENDPOINT = '/revisions';
const CONTROLLED_COPIES_ENDPOINT = '/controlled-copies';
export type ControlledCopyDistributionJobStatus = {
  batchId: string;
  processed: number;
  total: number;
  failed: number;
  status: "in_progress" | "completed" | "completed_with_errors";
};
// List/detail views can poll the same batch at the same time. Share the in-flight
// request and briefly cache the result so a tab switch does not create duplicate calls.
const controlledCopyJobStatusRequestCache = new Map<string, Promise<ControlledCopyDistributionJobStatus>>();
const controlledCopyJobStatusResolvedCache = new Map<string, { data: ControlledCopyDistributionJobStatus; expiresAt: number }>();
const CONTROLLED_COPY_JOB_STATUS_CACHE_TTL_MS = 500;
const documentDetailRequestCache = new Map<string, Promise<DocumentDetailResponse>>();
const documentDetailResolvedCache = new Map<string, { data: DocumentDetailResponse; expiresAt: number }>();
const documentDetailSnapshotRequestCache = new Map<string, Promise<DocumentDetailResponse>>();
const documentDetailSnapshotResolvedCache = new Map<string, { data: DocumentDetailResponse; expiresAt: number }>();
const documentListRequestCache = new Map<string, Promise<PaginatedResponse<DocumentListItem>>>();
const documentFiltersRequestCache = new Map<string, Promise<DocumentFiltersLookup>>();
const controlledCopyFiltersRequestCache = new Map<string, Promise<{ statuses: DocumentFiltersLookup["statuses"] }>>();
const controlledCopyByIdRequestCache = new Map<string, Promise<any>>();
const controlledCopyByIdResolvedCache = new Map<string, { data: any; expiresAt: number }>();
const controlledCopyResolvedDetailRequestCache = new Map<string, Promise<any>>();
const controlledCopyResolvedDetailCache = new Map<string, { data: any; expiresAt: number }>();
const controlledCopyResolvedDetailSnapshotRequestCache = new Map<string, Promise<any>>();
const controlledCopyResolvedDetailSnapshotCache = new Map<string, { data: any; expiresAt: number }>();
const controlledCopyBatchRequestCache = new Map<string, Promise<any>>();
const controlledCopyBatchResolvedCache = new Map<string, { data: any; expiresAt: number }>();
const controlledCopyActionCapabilitiesRequestCache = new Map<string, Promise<ControlledCopyActionCapabilities>>();
const controlledCopyActionCapabilitiesResolvedCache = new Map<string, { data: ControlledCopyActionCapabilities; expiresAt: number }>();
const controlledCopyBatchActionCapabilitiesRequestCache = new Map<string, Promise<ControlledCopyActionCapabilities>>();
const controlledCopyBatchActionCapabilitiesResolvedCache = new Map<string, { data: ControlledCopyActionCapabilities; expiresAt: number }>();
const documentVersionsRequestCache = new Map<string, Promise<any>>();
const documentVersionsResolvedCache = new Map<string, { data: any; expiresAt: number }>();
const revisionListRequestCache = new Map<string, Promise<PaginatedResponse<any>>>();
const revisionListResolvedCache = new Map<string, { data: PaginatedResponse<any>; expiresAt: number }>();
const revisionByIdRequestCache = new Map<string, Promise<RevisionDetailResponse>>();
const revisionByIdSnapshotRequestCache = new Map<string, Promise<RevisionDetailResponse>>();
const revisionByIdSnapshotResolvedCache = new Map<string, { data: RevisionDetailResponse; expiresAt: number }>();
const revisionActionCapabilitiesRequestCache = new Map<string, Promise<RevisionActionCapabilitiesResponse>>();
const revisionActionCapabilitiesResolvedCache = new Map<string, { data: RevisionActionCapabilitiesResponse; expiresAt: number }>();

export interface TemplateLineageResponse {
  sourceDocumentId: string;
  sourceDocumentNumber: string;
  sourceDocumentName: string;
  sourceRevisionId: string;
  sourceRevisionNumber: string;
  sourceFileChecksum: string;
  targetFileChecksum: string;
  selectedBy: string | null;
  selectedAt: string | null;
  placeholderSnapshot: Record<string, unknown>;
}
const pendingCountsRequestCache = new Map<string, Promise<{ pendingReview: number; pendingApproval: number }>>();
const pendingCountsResolvedCache = new Map<string, { data: { pendingReview: number; pendingApproval: number }; expiresAt: number }>();
const DOCUMENT_DETAIL_CACHE_TTL_MS = 5000;
const REVISION_LIST_CACHE_TTL_MS = 5000;
const SIMPLE_DETAIL_CACHE_TTL_MS = 5000;
const LONG_RUNNING_REQUEST_TIMEOUT_MS = 600000;

const clearDocumentDetailCaches = (documentId?: string | null) => {
  if (!documentId) {
    return;
  }
  documentDetailRequestCache.delete(documentId);
  documentDetailResolvedCache.delete(documentId);
  documentDetailSnapshotRequestCache.delete(documentId);
  documentDetailSnapshotResolvedCache.delete(documentId);
  documentVersionsRequestCache.delete(documentId);
  documentVersionsResolvedCache.delete(documentId);
};

const clearRevisionDetailCaches = (revisionId?: string | null) => {
  if (!revisionId) {
    return;
  }
  revisionByIdRequestCache.delete(revisionId);
  revisionByIdSnapshotRequestCache.delete(revisionId);
  revisionByIdSnapshotResolvedCache.delete(revisionId);
  const capabilityKeySuffix = `::${revisionId}`;
  for (const key of revisionActionCapabilitiesRequestCache.keys()) {
    if (key.endsWith(capabilityKeySuffix)) {
      revisionActionCapabilitiesRequestCache.delete(key);
    }
  }
  for (const key of revisionActionCapabilitiesResolvedCache.keys()) {
    if (key.endsWith(capabilityKeySuffix)) {
      revisionActionCapabilitiesResolvedCache.delete(key);
    }
  }
};

const revisionCapabilityCacheKey = (revisionId: string) =>
  `${authTokenStore.get() ?? "anonymous"}::${revisionId}`;

const controlledCopyCapabilityCacheKey = (id: string) =>
  `${authTokenStore.get() ?? "anonymous"}::${id}`;

const addCacheBuster = (
  params: Record<string, string | number | boolean | undefined> | undefined,
  cacheBuster?: string | number,
) => {
  if (cacheBuster === undefined || cacheBuster === null || cacheBuster === "") {
    return params;
  }
  return {
    ...(params || {}),
    cacheBuster,
  };
};

export interface RevisionWorkspaceBatchItemResponse {
  workspaceItemId?: string | null;
  itemOrder?: number | null;
  documentId?: string | null;
  parentDocumentId?: string | null;
  sourceDocumentId?: string | null;
  sourceRevisionId?: string | null;
  targetRevisionId?: string | null;
  decision?: string | null;
  documentNumber?: string | null;
  documentName?: string | null;
  revisionNumber?: string | null;
  nextRevisionNumber?: string | null;
  itemStatus?: string | null;
  revisionStatus?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  previewFilePath?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface RevisionWorkspaceBatchResponse {
  workspaceId?: string | null;
  workspaceKey?: string | null;
  parentDocumentId?: string | null;
  workspaceMode?: "multi" | "standalone" | string | null;
  workspaceState?: string | null;
  status?: string | null;
  items?: RevisionWorkspaceBatchItemResponse[];
}

export interface RevisionWorkspaceSnapshotResponse {
  workspaceId?: string | null;
  workspaceKey?: string | null;
  sourceRevisionId?: string | null;
  parentDocumentId?: string | null;
  sourceDocumentId?: string | null;
  workspaceMode?: "multi" | "standalone" | string | null;
  workspaceState?: string | null;
  status?: string | null;
  payloadJson?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RevisionUpgradeImpactItemResponse {
  id?: string | null;
  documentNumber?: string | null;
  documentName?: string | null;
  displayLabel?: string | null;
  version?: string | null;
  status?: string | null;
  statusInfo?: { id?: string | null; name?: string | null; code?: string | null; label?: string | null } | null;
  type?: string | null;
  businessUnit?: string | null;
  department?: string | null;
  author?: string | null;
  openedBy?: string | null;
  created?: string | null;
  effectiveDate?: string | null;
  validUntil?: string | null;
  relationType?: string | null;
  hasRelatedDocuments?: boolean;
  hasCorrelatedDocuments?: boolean;
  isTemplate?: boolean;
  currentEffectiveRevisionId?: string | null;
  currentEffectiveRevisionNumber?: string | null;
  newDraftRevisionNumber?: string | null;
  action?: string | null;
  eligible?: boolean;
  disabledReason?: string | null;
}

export interface RevisionUpgradeSessionResponse {
  sessionId?: string | null;
  sourceDocumentId?: string | null;
  sourceRevisionId?: string | null;
  workspaceMode?: string | null;
  status?: string | null;
  reasonForChange?: string | null;
  sourceDocumentNumber?: string | null;
  sourceDocumentName?: string | null;
  currentEffectiveRevisionNumber?: string | null;
  newDraftRevisionNumber?: string | null;
  sourceDocument?: DocumentDetailResponse | null;
  currentEffectiveRevision?: RevisionDetailResponse | null;
  relatedDocuments?: RevisionUpgradeImpactItemResponse[];
  correlatedDocuments?: RevisionUpgradeImpactItemResponse[];
  createdRevisions?: RevisionDetailResponse[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RevisionUpgradeContinueRequest {
  reasonForChange?: string;
  relatedDocumentIds?: string[];
}

export interface DocumentActiveWorkflowConfigurationRequest {
  reviewerUserIds?: string[];
  approverUserIds?: string[];
  relatedDocumentIds?: string[];
  correlatedDocumentIds?: string[];
  reviewDate?: string | null;
  requiresTraining?: boolean;
  trainingPeriodDays?: number | null;
  reasonForSkippingTraining?: string | null;
  authorUserId?: string;
  coAuthorUserIds?: string[];
  periodicReviewCycle?: number | null;
  periodicReviewNotification?: number | null;
  description?: string | null;
}

export interface ControlledCopyBatchStatusDiscrepancy {
  id: string;
  batchId: string;
  batchNumber: string;
  documentNumber: string | null;
  documentTitle: string | null;
  expectedStatusCode: string;
  actualStatusCode: string;
  detectedAt: string;
  lastCheckedAt: string;
}

export interface ControlledCopyRequestContextResponse {
  documentId?: string | null;
  documentNumber?: string | null;
  documentName?: string | null;
  documentType?: string | null;
  businessUnit?: string | null;
  documentStatus?: string | null;
  currentEffectiveRevisionId?: string | null;
  revisionNumber?: string | null;
  revisionName?: string | null;
  revisionStatus?: string | null;
  effectiveDate?: string | null;
  validUntil?: string | null;
  canRequest?: boolean;
  /** True only for users with the server-granted workspace-management permission — may request a batch for other recipients or
   * external distribution. False for a self-service viewer (single internal
   * copy for themselves only). Computed server-side; do not re-derive from permission lists. */
  canRequestForOthers?: boolean;
  message?: string | null;
  expiryDurationDays?: number | null;
}

const appendQueryParams = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
};

const buildDocumentListQueryParams = (params?: DocumentListQuery, includePagination = true) =>
  appendQueryParams({
    scope: params?.scope,
    search: params?.search,
    ids: params?.ids,
    status: params?.status,
    documentType: params?.documentType,
    businessUnit: params?.businessUnit,
    department: params?.department,
    authorId: params?.authorId,
    author: params?.author,
    relatedDocument: params?.relatedDocument,
    correlatedDocument: params?.correlatedDocument,
    isTemplate: params?.isTemplate,
    createdFrom: params?.createdFrom,
    createdTo: params?.createdTo,
    effectiveFrom: params?.effectiveFrom,
    effectiveTo: params?.effectiveTo,
    validFrom: params?.validFrom,
    validTo: params?.validTo,
    sortBy: params?.sortBy,
    sortDirection: params?.sortDirection,
    ...(includePagination
      ? {
          page: params?.page ?? 1,
          limit: params?.limit ?? 10,
        }
      : {}),
  });

export const documentApi = {
  // â”””€ Document List â””””””””””””””””””””””””””””””””””””””””””””””””””””””””””€

  /** GET /documents  paginated list with filters */
  getDocuments: async (filters?: DocumentFilters, page = 1, limit = 10) => {
    const query = appendQueryParams({
      page,
      limit,
      status: filters?.status,
      search: filters?.search,
      owner: filters?.owner,
    });
    const cacheKey = `legacy:${query}`;
    const cachedRequest = documentListRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest as unknown as Promise<PaginatedResponse<Document>>;
    }

    const request = api.get<PaginatedResponse<Document>>(
      `${DOCUMENTS_ENDPOINT}?${query}`
    )
      .then((response) => response.data)
      .finally(() => {
        documentListRequestCache.delete(cacheKey);
      });

    documentListRequestCache.set(cacheKey, request as unknown as Promise<PaginatedResponse<DocumentListItem>>);
    return request;
  },

  /** GET /documents  server-side paginated list with filters */
  getDocumentsPage: async (params?: DocumentListQuery) => {
    const query = buildDocumentListQueryParams(params);
    const cachedRequest = documentListRequestCache.get(query);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<PaginatedResponse<DocumentListItem>>(
      `${DOCUMENTS_ENDPOINT}?${query}`
    )
      .then((response) => response.data)
      .finally(() => {
        documentListRequestCache.delete(query);
      });

    documentListRequestCache.set(query, request);
    return request;
  },

  /** GET /documents/export  download CSV blob */
  exportDocumentsPage: async (params?: DocumentListQuery) => {
    const response = await api.get(`${DOCUMENTS_ENDPOINT}/export?${buildDocumentListQueryParams(params, false)}`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  /** GET /documents/filters */
  getDocumentFilters: async (authorSearch?: string) => {
    const cacheKey = authorSearch ? `default:${authorSearch}` : "default";
    const cachedRequest = documentFiltersRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<DocumentFiltersLookup>(`${DOCUMENTS_ENDPOINT}/filters`, {
      params: authorSearch ? { authorSearch } : undefined,
    })
      .then((response) => {
        const data = response.data;
        return {
          ...data,
          documentTypes: (data.documentTypes || []).map((item) => ({
            ...item,
            label: formatDocumentTypeLookupLabel(item.code, item.name),
          })),
        };
      })
      .finally(() => {
        documentFiltersRequestCache.delete(cacheKey);
      });

    documentFiltersRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /documents/templates */
  getSelectableTemplates: async (params?: {
    search?: string;
    documentType?: string;
    subType?: string;
    sortBy?: string;
    sortDirection?: string;
    limit?: number;
  }) => {
    const query = appendQueryParams({
      search: params?.search,
      documentType: params?.documentType,
      subType: params?.subType,
      sortBy: params?.sortBy,
      sortDirection: params?.sortDirection,
      limit: params?.limit ?? 50,
    });
    const response = await api.get<DocumentListItem[]>(
      `${DOCUMENTS_ENDPOINT}/templates?${query}`
    );
    return response.data ?? [];
  },

  /** GET /revisions/filters */
  getRevisionFilters: async (authorSearch?: string) => {
    const cacheKey = authorSearch ? `revision:${authorSearch}` : "revision";
    const cachedRequest = documentFiltersRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<DocumentFiltersLookup>("/revisions/filters", {
      params: authorSearch ? { authorSearch } : undefined,
    })
      .then((response) => {
        const data = response.data;
        return {
          ...data,
          documentTypes: (data.documentTypes || []).map((item) => ({
            ...item,
            label: formatDocumentTypeLookupLabel(item.code, item.name),
          })),
        };
      })
      .finally(() => {
        documentFiltersRequestCache.delete(cacheKey);
      });

    documentFiltersRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /documents/:id */
  getDocumentById: async (id: string) => {
    return documentApi.getDocumentDetail(id);
  },

  /** GET /documents/:id/detail */
  getDocumentDetail: async (id: string) => {
    const resolvedCache = documentDetailResolvedCache.get(id);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = documentDetailRequestCache.get(id);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<DocumentDetailResponse>(`${DOCUMENTS_ENDPOINT}/${id}`)
      .then((response) => {
        const data = response.data;
        documentDetailResolvedCache.set(id, {
          data,
          expiresAt: Date.now() + Math.max(DOCUMENT_DETAIL_CACHE_TTL_MS, SIMPLE_DETAIL_CACHE_TTL_MS),
        });
        return data;
      })
      .finally(() => {
        documentDetailRequestCache.delete(id);
      });

    documentDetailRequestCache.set(id, request);
    return request;
  },

  /** GET /documents/:id/snapshot */
  getDocumentDetailSnapshot: async (id: string) => {
    const resolvedCache = documentDetailSnapshotResolvedCache.get(id);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = documentDetailSnapshotRequestCache.get(id);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<DocumentDetailResponse>(`${DOCUMENTS_ENDPOINT}/${id}/snapshot`)
      .then((response) => {
        const data = response.data;
        documentDetailSnapshotResolvedCache.set(id, {
          data,
          expiresAt: Date.now() + Math.max(DOCUMENT_DETAIL_CACHE_TTL_MS, SIMPLE_DETAIL_CACHE_TTL_MS),
        });
        return data;
      })
      .finally(() => {
        documentDetailSnapshotRequestCache.delete(id);
      });

    documentDetailSnapshotRequestCache.set(id, request);
    return request;
  },

  /** GET /documents/knowledge-base */
  getKnowledgeBase: async () => {
    const response = await api.get<KnowledgeBaseResponse>(`${DOCUMENTS_ENDPOINT}/knowledge-base`);
    return response.data;
  },

  /** GET /documents/knowledge-base/departments */
  getKnowledgeBaseDepartments: async (params?: { search?: string; sortDirection?: "asc" | "desc" }) => {
      const response = await api.get<KnowledgeBaseDepartmentItem[]>(
        `${DOCUMENTS_ENDPOINT}/knowledge-base/departments`,
        { params }
      );
      return response.data;
    },

    /** GET /documents/knowledge-base/departments/{departmentId} */
    getKnowledgeBaseDepartment: async (departmentId: string, params?: { search?: string; sortField?: string; sortOrder?: "asc" | "desc" }) => {
      const response = await api.get<KnowledgeBaseFolderItem>(
        `${DOCUMENTS_ENDPOINT}/knowledge-base/departments/${departmentId}`,
        { params }
      );
      return response.data;
    },

    /** POST /documents/knowledge-base/:id/preview-opened */
    logKnowledgeBasePreviewOpened: async (documentId: string) => {
      await api.post(`${DOCUMENTS_ENDPOINT}/knowledge-base/${documentId}/preview-opened`);
    },

  /** POST /documents */
  createDocument: async (data: DocumentDraftCreateRequest) => {
    const response = await api.post<DocumentListItem>(DOCUMENTS_ENDPOINT, data);
    return response.data;
  },

  /** PUT /documents/:id */
  updateDocument: async (id: string, data: DocumentDraftCreateRequest) => {
    const response = await api.put<DocumentListItem>(`${DOCUMENTS_ENDPOINT}/${id}`, data);
    return response.data;
  },

  /** POST /documents/:id/upgrade-revision */
  upgradeDocumentRevision: async (documentId: string) => {
    const response = await api.post<RevisionDetailResponse>(
      `${DOCUMENTS_ENDPOINT}/${documentId}/upgrade-revision`,
    );
    clearDocumentDetailCaches(documentId);
    return response.data;
  },

  updateActiveWorkflowConfiguration: async (
    documentId: string,
    data: DocumentActiveWorkflowConfigurationRequest,
  ) => {
    const response = await api.put<DocumentDetailResponse>(
      `${DOCUMENTS_ENDPOINT}/${documentId}/active-workflow-configuration`,
      data,
    );
    clearDocumentDetailCaches(documentId);
    return response.data;
  },

  /** POST /documents/:id/cancel */
  cancelDocument: async (id: string, activitySummary: string) => {
    const response = await api.post<DocumentDetailResponse>(`${DOCUMENTS_ENDPOINT}/${id}/cancel`, {
      activitySummary,
    });
    return response.data;
  },

  /** POST /documents/cancel/:id - compatibility endpoint for older clients/routes */
  cancelDocumentCompat: async (id: string, activitySummary: string) => {
    const response = await api.post<DocumentDetailResponse>(`${DOCUMENTS_ENDPOINT}/cancel/${id}`, {
      activitySummary,
    });
    return response.data;
  },

  reopenDocument: async (id: string, activitySummary: string) => {
    const response = await api.post<DocumentDetailResponse>(`${DOCUMENTS_ENDPOINT}/${id}/reopen`, { activitySummary });
    return response.data;
  },

  /** DELETE /documents/:id */
  deleteDocument: async (id: string) => {
    const response = await api.delete(`${DOCUMENTS_ENDPOINT}/${id}`);
    return response.data;
  },

  /** GET /documents/export  download XLSX blob */
  exportDocuments: async (filters?: DocumentFilters) => {
    const params = new URLSearchParams({
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && { search: filters.search }),
    });
    const response = await api.get(`${DOCUMENTS_ENDPOINT}/export?${params}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /** GET /documents/stats */
  getStats: async () => {
    const response = await api.get<{
      total: number;
      draft: number;
      pendingReview: number;
      pendingApproval: number;
      effective: number;
      obsolete: number;
    }>(`${DOCUMENTS_ENDPOINT}/stats`);
    return response.data;
  },

  // â”””€ Document Workflow â””””””””””””””””””””””””””””””””””””””””””””””””””””””€

  /** POST /documents/:id/submit  Draft â†’ Pending Review */
  submitForReview: async (
    id: string,
    data?: { comment?: string; reason?: string; signatureToken?: string }
  ) => {
    const response = await api.post<Document>(`${DOCUMENTS_ENDPOINT}/${id}/submit`, data ?? {});
    return response.data;
  },

  /** POST /documents/:id/review  Pending Review â†’ Pending Approval */
  review: async (id: string, data: { result: 'Approved' | 'RequestChanges'; comment?: string }) => {
    const response = await api.post<Document>(`${DOCUMENTS_ENDPOINT}/${id}/review`, data);
    return response.data;
  },

  /** POST /documents/:id/approve  PhÃª duyá»‡t vá»›i e-signature */
  approveDocument: async (
    id: string,
    signature: { username: string; password: string; comment?: string }
  ) => {
    const response = await api.post<Document>(`${DOCUMENTS_ENDPOINT}/${id}/approve`, signature);
    return response.data;
  },

  /** POST /documents/:id/reject */
  rejectDocument: async (id: string, reason: string) => {
    const response = await api.post<Document>(`${DOCUMENTS_ENDPOINT}/${id}/reject`, { reason });
    return response.data;
  },

  /** POST /documents/:id/publish  Approved â†’ Effective */
  publishDocument: async (id: string, data: { effectiveDate: string }) => {
    const response = await api.post<Document>(`${DOCUMENTS_ENDPOINT}/${id}/publish`, data);
    return response.data;
  },

  /** POST /documents/:id/obsolete  Effective â†’ Obsolete */
  obsoleteDocument: async (id: string, data: { reason: string; obsoleteDate: string; signatureToken?: string }) => {
    const response = await api.post<DocumentDetailResponse>(`${DOCUMENTS_ENDPOINT}/${id}/obsolete`, data);
    return response.data;
  },

  // â”””€ Document Revisions â”””””””””””””””””””””””””””””””””””””””””””””””””””””€

  /** GET /documents/:id/revisions  version history */
  getDocumentVersions: async (id: string) => {
    const resolvedCache = documentVersionsResolvedCache.get(id);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = documentVersionsRequestCache.get(id);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get(`${DOCUMENTS_ENDPOINT}/${id}/revisions`)
      .then((response) => {
        const data = response.data;
        documentVersionsResolvedCache.set(id, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        documentVersionsRequestCache.delete(id);
      });

    documentVersionsRequestCache.set(id, request);
    return request;
  },

  /** POST /documents/:id/revisions  táº¡o revision má»›i */
  createRevision: async (
    id: string,
    data: { changeDescription?: string; revisionType: 'Major' | 'Minor'; templateRevisionId?: string }
  ) => {
    const response = await api.post<RevisionDetailResponse>(`${DOCUMENTS_ENDPOINT}/${id}/revisions`, data);
    return response.data;
  },

  /** POST /documents/:id/revisions/upload  create first revision and upload file */
  createRevisionWithUpload: async (
    id: string,
    file: File | null,
    data?: { changeDescription?: string; revisionType?: 'Major' | 'Minor'; templateRevisionId?: string }
  ) => {
    const response = await uploadFile(
      `${DOCUMENTS_ENDPOINT}/${id}/revisions/upload`,
      file,
      undefined,
      {
        changeDescription: data?.changeDescription,
        revisionType: data?.revisionType,
        templateRevisionId: data?.templateRevisionId,
      }
    );
    clearDocumentDetailCaches(id);
    return response.data;
  },

  /** GET /revisions  danh sÃ¡ch táº¥t cáº£ revisions */
  getRevisions: async (params?: {
    page?: number;
    limit?: number;
    ids?: string;
    search?: string;
    status?: string;
    documentType?: string;
    businessUnit?: string;
    department?: string;
    authorId?: string;
    author?: string;
    relatedDocument?: string;
    correlatedDocument?: string;
    isTemplate?: string;
    createdFrom?: string;
    createdTo?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    validFrom?: string;
    validTo?: string;
    expiryFrom?: string;
    expiryTo?: string;
    recallFrom?: string;
    recallTo?: string;
    ownedByMe?: boolean;
    pending?: boolean;
    sortBy?: string;
    sortDirection?: string;
    cacheBuster?: string | number;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (k === "cacheBuster") return;
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const cacheKey = `${query.toString()}::${params?.cacheBuster ?? ""}`;
    const resolvedCache = revisionListResolvedCache.get(cacheKey);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }
    const cachedRequest = revisionListRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<PaginatedResponse<any>>(`${REVISIONS_ENDPOINT}?${query}`)
      .then((response) => {
        const data = response.data;
        revisionListResolvedCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + REVISION_LIST_CACHE_TTL_MS,
        });
        return data;
      })
      .finally(() => {
        revisionListRequestCache.delete(cacheKey);
      });

    revisionListRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /revisions/pending-counts */
  getPendingCounts: async () => {
    const cacheKey = "default";
    const resolvedCache = pendingCountsResolvedCache.get(cacheKey);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = pendingCountsRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<{ pendingReview: number; pendingApproval: number }>(
      `${REVISIONS_ENDPOINT}/pending-counts`
    )
      .then((response) => {
        const data = response.data;
        pendingCountsResolvedCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS,
        });
        return data;
      })
      .finally(() => {
        pendingCountsRequestCache.delete(cacheKey);
      });

    pendingCountsRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /revisions/export  export revisions as CSV */
  exportRevisions: async (params?: {
    search?: string;
    ids?: string;
    status?: string;
    documentType?: string;
    businessUnit?: string;
    department?: string;
    authorId?: string;
    author?: string;
    relatedDocument?: string;
    correlatedDocument?: string;
    isTemplate?: string;
    createdFrom?: string;
    createdTo?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    validFrom?: string;
    validTo?: string;
    expiryFrom?: string;
    expiryTo?: string;
    recallFrom?: string;
    recallTo?: string;
    ownedByMe?: boolean;
    pending?: boolean;
    sortBy?: string;
    sortDirection?: string;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const response = await api.get(`${REVISIONS_ENDPOINT}/export?${query}`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  /** GET /revisions/:revisionId */
  getRevisionById: async (revisionId: string) => {
    const cachedRequest = revisionByIdRequestCache.get(revisionId);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}`)
      .then((response) => response.data)
      .finally(() => {
        revisionByIdRequestCache.delete(revisionId);
      });

    revisionByIdRequestCache.set(revisionId, request);
    return request;
  },

  /** GET /revisions/:revisionId/template-lineage — provenance only; source file remains protected. */
  getRevisionTemplateLineage: async (revisionId: string) => {
    const response = await api.get<TemplateLineageResponse | null>(
      `${REVISIONS_ENDPOINT}/${revisionId}/template-lineage`,
      { validateStatus: (status) => status === 200 || status === 204 },
    );
    return response.status === 204 ? null : response.data;
  },

  /** GET /revisions/:revisionId/snapshot */
  getRevisionByIdSnapshot: async (
    revisionId: string,
    options?: { force?: boolean; signal?: AbortSignal },
  ) => {
    const force = options?.force === true;
    const signal = options?.signal;
    const resolvedCache = revisionByIdSnapshotResolvedCache.get(revisionId);
    if (!force && resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    // A caller-owned AbortSignal must never cancel another component's shared
    // request. Snapshot refreshes with a signal therefore bypass in-flight
    // request sharing, while the normal detail path keeps its short cache.
    const cachedRequest = signal ? undefined : revisionByIdSnapshotRequestCache.get(revisionId);
    if (!force && cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/snapshot`, { signal })
      .then((response) => {
        const data = response.data;
        revisionByIdSnapshotResolvedCache.set(revisionId, {
          data,
          expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS,
        });
        return data;
      })
      .finally(() => {
        if (!signal) {
          revisionByIdSnapshotRequestCache.delete(revisionId);
        }
      });

    if (!signal) {
      revisionByIdSnapshotRequestCache.set(revisionId, request);
    }
    return request;
  },

  getRevisionSignatures: async (revisionId: string) => {
    const response = await api.get(`${REVISIONS_ENDPOINT}/${revisionId}/signatures`);
    return response.data;
  },

  /** GET /revisions/:revisionId/action-capabilities */
  getRevisionActionCapabilities: async (revisionId: string) => {
    const cacheKey = revisionCapabilityCacheKey(revisionId);
    const resolvedCache = revisionActionCapabilitiesResolvedCache.get(cacheKey);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = revisionActionCapabilitiesRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<RevisionActionCapabilitiesResponse>(
      `${REVISIONS_ENDPOINT}/${revisionId}/action-capabilities`,
    )
      .then((response) => {
        const data = response.data;
        revisionActionCapabilitiesResolvedCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS,
        });
        return data;
      })
      .finally(() => {
        revisionActionCapabilitiesRequestCache.delete(cacheKey);
      });

    revisionActionCapabilitiesRequestCache.set(cacheKey, request);
    return request;
  },

  /** PUT /revisions/:revisionId */
  updateRevision: async (revisionId: string, data: Record<string, any>) => {
    const response = await api.put<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}`, data);
    // Metadata updates can change the source/snapshot selected by the Document tab.
    // Never leave a previously resolved revision detail in the short-lived client cache.
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data?.documentId);
    return response.data;
  },

  /** POST /revisions/:revisionId/complete-editing */
  completeRevisionEditing: async (
    revisionId: string,
    data?: { comment?: string; reason?: string; signatureToken?: string }
  ) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/complete-editing`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  /** POST /revisions/:revisionId/submit */
  submitRevisionForReview: async (
    revisionId: string,
    data?: { comment?: string; reason?: string; signatureToken?: string }
  ) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/submit-review`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  submitRevision: async (revisionId: string) => {
    return documentApi.submitRevisionForReview(revisionId);
  },

  /** POST /revisions/:revisionId/regenerate-snapshot */
  regenerateRevisionSnapshot: async (revisionId: string) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/regenerate-snapshot`);
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  /** POST /revisions/:revisionId/review */
  completeRevisionReview: async (revisionId: string, data?: { comment?: string; reason?: string; signatureToken?: string }) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/review/complete`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  rejectRevisionReview: async (revisionId: string, data?: { comment?: string; reason?: string; signatureToken?: string }) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/review/reject`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  reviewRevision: async (
    revisionId: string,
    data: { result: 'Approved' | 'RequestChanges'; comment?: string }
  ) => {
    if (data.result === 'Approved') {
      return documentApi.completeRevisionReview(revisionId, { comment: data.comment });
    }
    return documentApi.rejectRevisionReview(revisionId, { comment: data.comment });
  },

  /** POST /revisions/:revisionId/approve  e-signature */
  completeRevisionApproval: async (revisionId: string, data?: { comment?: string; reason?: string; signatureToken?: string }) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/approve/complete`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  rejectRevisionApproval: async (revisionId: string, data?: { comment?: string; reason?: string; signatureToken?: string }) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/approve/reject`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  approveRevision: async (
    revisionId: string,
    signature: { username: string; password: string; comment?: string }
  ) => {
    return documentApi.completeRevisionApproval(revisionId, { comment: signature.comment });
  },

  /** POST /revisions/:revisionId/reject */
  rejectRevision: async (revisionId: string, reason: string) => {
    return documentApi.rejectRevisionReview(revisionId, { reason });
  },

  completeRevisionTraining: async (revisionId: string, data?: { comment?: string; reason?: string; signatureToken?: string; trainingPlannedDate?: string; trainingPeriodEndDate?: string; trainingCompletionDate?: string }) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/training/complete`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  /** POST /revisions/:revisionId/publish  Effective */
  publishRevision: async (revisionId: string, data?: { comment?: string; reason?: string; signatureToken?: string; forcePublish?: boolean }) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/publish`, data ?? {}, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS,
    });
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.documentId);
    return response.data;
  },

  getPublishingWorkspace: async (revisionId: string) => {
    const response = await api.get<PublishingWorkspaceResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/publishing-workspace`);
    return response.data;
  },

  openPublishingWorkspace: async (revisionId: string, data?: PublishingWorkspaceRequest) => {
    const response = await api.post<PublishingWorkspaceResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/publishing-workspace/open`, data ?? {});
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.revisionId);
    return response.data;
  },

  generatePublishingPreview: async (revisionId: string, data?: PublishingWorkspaceRequest) => {
    const response = await api.post<PublishingWorkspaceResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/publishing-workspace/generate-preview`, data ?? {}, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS,
    });
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.revisionId);
    return response.data;
  },

  publishFromPublishingWorkspace: async (revisionId: string, data?: PublishingWorkspaceRequest) => {
    const response = await api.post<PublishingWorkspaceResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/publishing-workspace/publish`, data ?? {}, {
      timeout: LONG_RUNNING_REQUEST_TIMEOUT_MS,
    });
    clearRevisionDetailCaches(revisionId);
    clearDocumentDetailCaches(response.data.revisionId);
    return response.data;
  },

  getPublishingWorkspacePreview: async (revisionId: string, cacheBuster: string | number = Date.now()) => {
    const response = await api.get<Blob>(`${REVISIONS_ENDPOINT}/${revisionId}/publishing-workspace/preview`, {
      responseType: 'blob',
      params: addCacheBuster({}, cacheBuster),
    });
    return response.data;
  },

  getPublishingWorkspaceComponentPreview: async (
    revisionId: string,
    templateId: string,
    componentType: "cover" | "header" | "footer",
    layout?: "portrait" | "landscape",
  ) => {
    const response = await api.get<Blob>(
      `${REVISIONS_ENDPOINT}/${revisionId}/publishing-workspace/component-preview/${templateId}/${componentType}`,
      {
        responseType: "blob",
        params: {
          cacheBuster: Date.now(),
          ...(layout ? { layout } : {}),
        },
      },
    );
    return response.data;
  },

  /** POST /revisions/:revisionId/upgrade  nÃ¢ng lÃªn document chÃ­nh thá»©c */
  createRevisionUpgradeSession: async (documentId: string) => {
    const response = await api.post<RevisionUpgradeSessionResponse>(`${DOCUMENTS_ENDPOINT}/${documentId}/upgrade-sessions`);
    return response.data;
  },

  getRevisionUpgradeSession: async (documentId: string, sessionId: string) => {
    const response = await api.get<RevisionUpgradeSessionResponse>(`${DOCUMENTS_ENDPOINT}/${documentId}/upgrade-sessions/${sessionId}`);
    return response.data;
  },

  continueRevisionUpgradeSession: async (documentId: string, sessionId: string, data?: RevisionUpgradeContinueRequest) => {
    const response = await api.post<RevisionUpgradeSessionResponse>(
      `${DOCUMENTS_ENDPOINT}/${documentId}/upgrade-sessions/${sessionId}/continue`,
      data ?? {},
    );
    return response.data;
  },

  getRevisionWorkspaceSnapshot: async (params: { sourceRevisionId: string; workspaceMode: "multi" | "standalone" }) => {
    const response = await api.get<RevisionWorkspaceSnapshotResponse>(`${REVISIONS_ENDPOINT}/workspaces`, { params });
    return response.data;
  },

  saveRevisionWorkspaceSnapshot: async (data: {
    workspaceId?: string;
    sourceRevisionId: string;
    parentDocumentId?: string;
    sourceDocumentId?: string;
    workspaceMode: "multi" | "standalone";
    workspaceState?: string;
    payloadJson: string;
    status?: string;
  }) => {
    const response = await api.post(`${REVISIONS_ENDPOINT}/workspaces`, data);
    return response.data;
  },

  saveRevisionWorkspaceBatch: async (data: {
    workspaceId?: string;
    sourceRevisionId: string;
    parentDocumentId?: string;
    sourceDocumentId?: string;
    workspaceMode: "multi" | "standalone";
    workspaceState?: string;
    status?: string;
    payloadJson?: string;
    reasonForChange?: string;
    currentDocIndex?: number;
    activeTab?: string;
    reviewFlowType?: string;
    items: Array<{
      documentId?: string;
      parentDocumentId?: string;
      sourceDocumentId?: string;
      sourceRevisionId?: string;
      targetRevisionId?: string;
      decision?: string;
      itemOrder?: number;
      draft?: any;
    }>;
    files?: Array<File | null>;
  }) => {
    const formData = new FormData();
    formData.append(
      "request",
      new Blob([JSON.stringify({
        workspaceId: data.workspaceId,
        sourceRevisionId: data.sourceRevisionId,
        parentDocumentId: data.parentDocumentId,
        sourceDocumentId: data.sourceDocumentId,
        workspaceMode: data.workspaceMode,
        workspaceState: data.workspaceState,
        status: data.status ?? "SAVED",
        payloadJson: data.payloadJson ?? "",
        reasonForChange: data.reasonForChange,
        currentDocIndex: data.currentDocIndex,
        activeTab: data.activeTab,
        reviewFlowType: data.reviewFlowType,
        items: data.items,
      })], { type: "application/json" }),
      "request.json",
    );
    (data.files || []).forEach((file) => {
      if (file) {
        formData.append("files", file);
      }
    });
    const response = await api.post<RevisionWorkspaceBatchResponse>(`${REVISIONS_ENDPOINT}/workspaces/batch-save`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
    return response.data;
  },

  submitRevisionWorkspaceBatch: async (data: {
    workspaceId?: string;
    sourceRevisionId: string;
    parentDocumentId?: string;
    sourceDocumentId?: string;
    workspaceMode: "multi" | "standalone";
    workspaceState?: string;
    status?: string;
    payloadJson?: string;
    reasonForChange?: string;
    currentDocIndex?: number;
    activeTab?: string;
    reviewFlowType?: string;
    items: Array<{
      documentId?: string;
      parentDocumentId?: string;
      sourceDocumentId?: string;
      sourceRevisionId?: string;
      targetRevisionId?: string;
      decision?: string;
      itemOrder?: number;
      draft?: any;
    }>;
    files?: Array<File | null>;
  }) => {
    const formData = new FormData();
    formData.append(
      "request",
      new Blob([JSON.stringify({
        workspaceId: data.workspaceId,
        sourceRevisionId: data.sourceRevisionId,
        parentDocumentId: data.parentDocumentId,
        sourceDocumentId: data.sourceDocumentId,
        workspaceMode: data.workspaceMode,
        workspaceState: data.workspaceState,
        status: data.status ?? "SUBMITTED",
        payloadJson: data.payloadJson ?? "",
        reasonForChange: data.reasonForChange,
        currentDocIndex: data.currentDocIndex,
        activeTab: data.activeTab,
        reviewFlowType: data.reviewFlowType,
        items: data.items,
      })], { type: "application/json" }),
      "request.json",
    );
    (data.files || []).forEach((file) => {
      if (file) {
        formData.append("files", file);
      }
    });
    const response = await api.post<RevisionWorkspaceBatchResponse>(`${REVISIONS_ENDPOINT}/workspaces/batch-submit`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
    return response.data;
  },

  /** POST /revisions/:revisionId/cancel  há»§y bá» revision nhÃ¡p */
  cancelRevision: async (revisionId: string, data: { comment?: string; reason?: string; signatureToken?: string }) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/cancel`, data);
    return response.data;
  },

  /** POST /revisions/:revisionId/upload  upload file Ä‘Ã­nh kÃ¨m */
  uploadRevisionFile: async (revisionId: string, file: File) => {
    return uploadFile(`${REVISIONS_ENDPOINT}/${revisionId}/upload`, file);
  },

  uploadRevisionToOfficeOnline: async (revisionId: string) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/office-online/sync`);
    return response.data;
  },

  /** @deprecated Use uploadRevisionToOfficeOnline. */
  syncRevisionToOfficeOnline: async (revisionId: string) => documentApi.uploadRevisionToOfficeOnline(revisionId),

  syncEditedRevisionFromOfficeOnline: async (revisionId: string) => {
    const response = await api.post<RevisionDetailResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/office-online/sync-back`);
    return response.data;
  },

  getRevisionOfficeOnlineEditLink: async (revisionId: string) => {
    const response = await api.get<{ url: string; configuredScope?: string | null; effectiveScope?: string | null; fetchedAt?: string | null }>(`${REVISIONS_ENDPOINT}/${revisionId}/office-online/edit-link`);
    return response.data;
  },

  getRevisionOfficeOnlineReviewLink: async (revisionId: string) => {
    const response = await api.get<{ url: string; configuredScope?: string | null; effectiveScope?: string | null; fetchedAt?: string | null }>(`${REVISIONS_ENDPOINT}/${revisionId}/office-online/review-link`);
    return response.data;
  },

  listRevisionWorkingNotes: async (revisionId: string) => {
    const response = await api.get<RevisionDetailResponse["workingNotes"]>(`${REVISIONS_ENDPOINT}/${revisionId}/working-notes`);
    return response.data ?? [];
  },

  addRevisionWorkingNote: async (revisionId: string, content: string) => {
    const response = await api.post<NonNullable<RevisionDetailResponse["workingNotes"]>[number]>(`${REVISIONS_ENDPOINT}/${revisionId}/working-notes`, {
      content,
    });
    return response.data;
  },

  deleteRevisionWorkingNote: async (revisionId: string, noteId: string) => {
    await api.delete(`${REVISIONS_ENDPOINT}/${revisionId}/working-notes/${noteId}`);
  },

  getRevisionReviewComments: async (revisionId: string) => {
    const response = await api.get<RevisionReviewCommentListResponse>(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments`);
    return response.data;
  },

  addRevisionReviewComment: async (revisionId: string, payload: { pageNumber: number; positionX: number; positionY: number; width: number; height: number; content: string }) => {
    const response = await api.post<RevisionReviewCommentItem>(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments`, payload);
    return response.data;
  },

  replyToRevisionReviewComment: async (revisionId: string, commentId: string, content: string) => {
    const response = await api.post<RevisionReviewCommentItem>(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}/replies`, { content });
    return response.data;
  },

  resolveRevisionReviewComment: async (revisionId: string, commentId: string, resolutionNote?: string) => {
    const response = await api.patch<RevisionReviewCommentItem>(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}/resolve`, {
      resolutionNote: resolutionNote || undefined,
    });
    return response.data;
  },

  updateRevisionReviewComment: async (revisionId: string, commentId: string, content: string) => {
    const response = await api.patch<RevisionReviewCommentItem>(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}`, { content });
    return response.data;
  },
  deleteRevisionReviewComment: async (revisionId: string, commentId: string, reason: string) => {
    await api.delete(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}`, { data: { reason } });
  },
  updateRevisionReviewCommentReply: async (revisionId: string, commentId: string, replyId: string, content: string) => {
    const response = await api.patch<RevisionReviewCommentItem>(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}/replies/${replyId}`, { content });
    return response.data;
  },
  deleteRevisionReviewCommentReply: async (revisionId: string, commentId: string, replyId: string, reason: string) => {
    await api.delete(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}/replies/${replyId}`, { data: { reason } });
  },

  uploadRevisionReviewCommentAttachment: async (revisionId: string, commentId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<RevisionReviewCommentAttachmentItem>(
      `${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}/attachments`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  uploadRevisionReviewCommentReplyAttachment: async (revisionId: string, commentId: string, replyId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<RevisionReviewCommentAttachmentItem>(
      `${REVISIONS_ENDPOINT}/${revisionId}/review-comments/${commentId}/replies/${replyId}/attachments`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  previewRevisionReviewCommentAttachment: async (revisionId: string, attachmentId: string) => {
    const response = await api.get<Blob>(`${REVISIONS_ENDPOINT}/${revisionId}/review-comments/attachments/${attachmentId}`, {
      responseType: "blob",
    });
    return response.data;
  },


  getRevisionSnapshotHistory: async (revisionId: string) => {
    const response = await api.get<RevisionSnapshotHistoryItem[]>(`${REVISIONS_ENDPOINT}/${revisionId}/snapshot-history`);
    return response.data;
  },

  previewRevisionSnapshotHistory: async (revisionId: string, historyId: string) => {
    const response = await api.get<Blob>(`${REVISIONS_ENDPOINT}/${revisionId}/snapshot-history/${historyId}/preview`, {
      responseType: "blob",
    });
    return response.data;
  },

  previewRevisionReviewRoundSnapshot: async (revisionId: string, reviewRound: number) => {
    const response = await api.get<Blob>(`${REVISIONS_ENDPOINT}/${revisionId}/review-snapshots/${reviewRound}/preview`, {
      responseType: "blob",
    });
    return response.data;
  },

  previewRevisionFile: async (revisionId: string, cacheBuster: string | number = Date.now()) => {
    const response = await api.get<Blob>(`${REVISIONS_ENDPOINT}/${revisionId}/preview`, {
      responseType: "blob",
      params: addCacheBuster({}, cacheBuster),
    });
    return response.data;
  },

  previewRevisionSourceFile: async (revisionId: string, cacheBuster: string | number = Date.now()) => {
    const response = await api.get<Blob>(`${REVISIONS_ENDPOINT}/${revisionId}/preview`, {
      responseType: "blob",
      params: addCacheBuster({}, cacheBuster),
    });
    return response.data;
  },

  // â”””€ Controlled Copies â””””””””””””””””””””””””””””””””””””””””””””””””””””””€

  /** GET /controlled-copies  paginated list */
  getControlledCopies: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    department?: string;
    documentId?: string;
    createdFrom?: string;
    createdTo?: string;
    validFrom?: string;
    validTo?: string;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<any>>(
      `${CONTROLLED_COPIES_ENDPOINT}?${query}`
    );
    return response.data;
  },

  /** GET /controlled-copies/batches paginated batch list */
  getControlledCopyDistributionBatches: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    documentId?: string;
    createdFrom?: string;
    createdTo?: string;
    validFrom?: string;
    validTo?: string;
    expiryFrom?: string;
    expiryTo?: string;
    recallFrom?: string;
    recallTo?: string;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<ControlledCopyDistributionBatch>>(
      `${CONTROLLED_COPIES_ENDPOINT}/batches?${query}`
    );
    return response.data;
  },

  /** GET /controlled-copies/batches/:id */
  getControlledCopyDistributionBatchById: async (id: string) => {
    const resolvedCache = controlledCopyBatchResolvedCache.get(id);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = controlledCopyBatchRequestCache.get(id);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<ControlledCopyDistributionBatch>(`${CONTROLLED_COPIES_ENDPOINT}/batches/${id}`)
      .then((response) => {
        const data = response.data;
        controlledCopyBatchResolvedCache.set(id, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        controlledCopyBatchRequestCache.delete(id);
      });

    controlledCopyBatchRequestCache.set(id, request);
    return request;
  },

  /** GET /controlled-copies/batches/:id/detail */
  getControlledCopyDistributionBatchDetailById: async (id: string) => {
    const resolvedCache = controlledCopyBatchResolvedCache.get(`detail:${id}`);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = controlledCopyBatchRequestCache.get(`detail:${id}`);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<ControlledCopyDistributionBatch>(`${CONTROLLED_COPIES_ENDPOINT}/batches/${id}/detail`)
      .then((response) => {
        const data = response.data;
        controlledCopyBatchResolvedCache.set(`detail:${id}`, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        controlledCopyBatchRequestCache.delete(`detail:${id}`);
      });

    controlledCopyBatchRequestCache.set(`detail:${id}`, request);
    return request;
  },

  /** GET /controlled-copies/batches/:id/copies - paged child register. */
  getControlledCopyDistributionBatchCopies: async (id: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const suffix = query.size > 0 ? `?${query}` : "";
    const response = await api.get<PaginatedResponse<any>>(`${CONTROLLED_COPIES_ENDPOINT}/batches/${id}/copies${suffix}`);
    return response.data;
  },

  /** GET /controlled-copies/:id/action-capabilities */
  getControlledCopyActionCapabilities: async (copyId: string) => {
    const cacheKey = controlledCopyCapabilityCacheKey(copyId);
    const resolvedCache = controlledCopyActionCapabilitiesResolvedCache.get(cacheKey);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = controlledCopyActionCapabilitiesRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<ControlledCopyActionCapabilities>(`${CONTROLLED_COPIES_ENDPOINT}/${copyId}/action-capabilities`)
      .then((response) => {
        const data = response.data;
        controlledCopyActionCapabilitiesResolvedCache.set(cacheKey, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        controlledCopyActionCapabilitiesRequestCache.delete(cacheKey);
      });

    controlledCopyActionCapabilitiesRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /controlled-copies/batches/:batchId/action-capabilities */
  getControlledCopyBatchActionCapabilities: async (batchId: string) => {
    const cacheKey = controlledCopyCapabilityCacheKey(batchId);
    const resolvedCache = controlledCopyBatchActionCapabilitiesResolvedCache.get(cacheKey);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = controlledCopyBatchActionCapabilitiesRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<ControlledCopyActionCapabilities>(`${CONTROLLED_COPIES_ENDPOINT}/batches/${batchId}/action-capabilities`)
      .then((response) => {
        const data = response.data;
        controlledCopyBatchActionCapabilitiesResolvedCache.set(cacheKey, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        controlledCopyBatchActionCapabilitiesRequestCache.delete(cacheKey);
      });

    controlledCopyBatchActionCapabilitiesRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /controlled-copies/filters */
  getControlledCopyFilters: async () => {
    const cacheKey = "controlled-copy";
    const cachedRequest = controlledCopyFiltersRequestCache.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<{ statuses: DocumentFiltersLookup["statuses"] }>(`${CONTROLLED_COPIES_ENDPOINT}/filters`)
      .then((response) => response.data)
      .finally(() => {
        controlledCopyFiltersRequestCache.delete(cacheKey);
      });

    controlledCopyFiltersRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /controlled-copies/batch-status-discrepancies  paginated list of batches whose stored
   *  status disagrees with the status derived from their member copies (item 6 review screen) */
  getControlledCopyBatchStatusDiscrepancies: async (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<ControlledCopyBatchStatusDiscrepancy>>(
      `${CONTROLLED_COPIES_ENDPOINT}/batch-status-discrepancies?${query}`
    );
    return response.data;
  },

  exportControlledCopies: async (params?: {
    search?: string;
    status?: string;
    department?: string;
    documentId?: string;
    createdFrom?: string;
    createdTo?: string;
    validFrom?: string;
    validTo?: string;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") query.set(k, String(v));
      });
    }
    const response = await api.get(`${CONTROLLED_COPIES_ENDPOINT}/export?${query}`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  /** GET /controlled-copies/:id */
  getControlledCopyById: async (id: string) => {
    const resolvedCache = controlledCopyByIdResolvedCache.get(id);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = controlledCopyByIdRequestCache.get(id);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get(`${CONTROLLED_COPIES_ENDPOINT}/${id}`)
      .then((response) => {
        const data = response.data;
        controlledCopyByIdResolvedCache.set(id, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        controlledCopyByIdRequestCache.delete(id);
      });

    controlledCopyByIdRequestCache.set(id, request);
    return request;
  },

  /** GET /controlled-copies/:id/detail */
  getControlledCopyDetailById: async (id: string) => {
    const resolvedCache = controlledCopyResolvedDetailCache.get(id);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = controlledCopyResolvedDetailRequestCache.get(id);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get(`${CONTROLLED_COPIES_ENDPOINT}/${id}/resolved-detail`)
      .then((response) => {
        const data = response.data;
        controlledCopyResolvedDetailCache.set(id, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        controlledCopyResolvedDetailRequestCache.delete(id);
      });

    controlledCopyResolvedDetailRequestCache.set(id, request);
    return request;
  },

  /** GET /controlled-copies/:id/resolved-detail/snapshot */
  getControlledCopyDetailSnapshotById: async (id: string) => {
    const resolvedCache = controlledCopyResolvedDetailSnapshotCache.get(id);
    if (resolvedCache && resolvedCache.expiresAt > Date.now()) {
      return resolvedCache.data;
    }

    const cachedRequest = controlledCopyResolvedDetailSnapshotRequestCache.get(id);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get(`${CONTROLLED_COPIES_ENDPOINT}/${id}/resolved-detail/snapshot`)
      .then((response) => {
        const data = response.data;
        controlledCopyResolvedDetailSnapshotCache.set(id, { data, expiresAt: Date.now() + SIMPLE_DETAIL_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        controlledCopyResolvedDetailSnapshotRequestCache.delete(id);
      });

    controlledCopyResolvedDetailSnapshotRequestCache.set(id, request);
    return request;
  },

  /** POST /controlled-copies  yÃªu cáº§u phÃ¡t hÃ nh */
  /** GET /controlled-copies/:id/signatures */
  getControlledCopySignatures: async (id: string) => {
    const response = await api.get(`${CONTROLLED_COPIES_ENDPOINT}/${id}/signatures`);
    return response.data;
  },

  getControlledCopyRequestContext: async (params: { documentId?: string; revisionId?: string }) => {
    const response = await api.get<ControlledCopyRequestContextResponse>(
      `${CONTROLLED_COPIES_ENDPOINT}/request-context`,
      { params }
    );
    return response.data;
  },

  openControlledCopyPreview: async (id: string, token: string, password?: string) => {
    const response = await api.get(`${CONTROLLED_COPIES_ENDPOINT}/${id}/preview`, {
      params: { token, ...(password ? { password } : {}) },
    });
    return response.data;
  },

  closeControlledCopyPreview: async (id: string, token: string, timeSpentMs?: number) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/preview/close`, { token, timeSpentMs });
    return response.data;
  },

  consumeControlledCopyPreviewPrint: async (id: string, token: string) => {
    await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/preview/print`, { token });
  },

  controlledCopyPreviewPageUrl: (id: string, page: number, token: string) =>
    `${CONTROLLED_COPIES_ENDPOINT}/${id}/preview/pages/${page}?token=${encodeURIComponent(token)}`,

  /** GET /controlled-copies/:id/preview/file — full PDF for the embedded viewer */
  getControlledCopyPreviewFile: async (id: string, token: string) => {
    const response = await api.get<Blob>(`${CONTROLLED_COPIES_ENDPOINT}/${id}/preview/file`, {
      params: { token },
      responseType: "blob",
    });
    return response.data;
  },

  downloadControlledCopy: async (id: string, token: string, password?: string) => {
    const response = await api.get<Blob>(`${CONTROLLED_COPIES_ENDPOINT}/${id}/download`, {
      params: { token, ...(password ? { password } : {}) },
      responseType: "blob",
    });
    return response.data;
  },

  requestControlledCopy: async (data: {
    documentId: string;
    documentNumber?: string;
    sourceRevisionId?: string;
    requestedBy: string;
    department: string;
    location: string;
    purpose: string;
    copies: number;
    quantity?: number;
    distributionMode?: "internal" | "external";
    distributionScope?: "business-unit" | "department" | "individual";
    hasExpiryDate?: boolean;
    expiryDate?: string | null;
    recipientIds?: string[];
    recipientLabels?: string[];
    externalRecipients?: string[];
    recipients?: Array<{
      recipientType: "USER" | "EMAIL";
      recipientUserId?: string;
      recipientEmail?: string;
      department?: string;
      location?: string;
      quantity: number;
    }>;
  }) => {
    const response = await api.post(CONTROLLED_COPIES_ENDPOINT, data);
    return response.data;
  },

  /** POST /controlled-copies/:id/distribute */
  distribute: async (
    id: string,
    data: { distributedTo: string; distributedAt: string; location: string; comment: string; signatureToken: string }
  ) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/distribute`, data);
    return response.data;
  },

  /** POST /controlled-copies/batches/:batchId/distribute */
  distributeControlledCopyBatch: async (
    batchId: string,
    data: { distributedTo: string; distributedAt: string; location: string; comment: string; signatureToken: string }
  ) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/batches/${batchId}/distribute`, data);
    return response.data as ControlledCopyDistributionBatch;
  },

  /**
   * GET /controlled-copies/distribution-batches/:batchId/job-status
   * Polling fallback for the SSE-only "controlled-copy-batch-progress" push — SSE delivery is
   * fire-and-forget with no replay, so if the client misses the event (dropped/reconnecting
   * connection), this lets the UI recover the true final state instead of hanging forever.
   */
  getControlledCopyDistributionJobStatus: async (batchId: string, action: "DISTRIBUTE" | "RECALL" | "CANCEL" = "DISTRIBUTE", signal?: AbortSignal) => {
    const cacheKey = `${action}:${batchId}`;
    const cached = controlledCopyJobStatusResolvedCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    if (cached) controlledCopyJobStatusResolvedCache.delete(cacheKey);

    const inFlight = controlledCopyJobStatusRequestCache.get(cacheKey);
    if (inFlight) return inFlight;

    const request = api
      .get<ControlledCopyDistributionJobStatus>(
        `${CONTROLLED_COPIES_ENDPOINT}/distribution-batches/${batchId}/job-status`,
        { params: { action }, signal },
      )
      .then((response) => {
        controlledCopyJobStatusResolvedCache.set(cacheKey, {
          data: response.data,
          expiresAt: Date.now() + CONTROLLED_COPY_JOB_STATUS_CACHE_TTL_MS,
        });
        return response.data;
      })
      .finally(() => controlledCopyJobStatusRequestCache.delete(cacheKey));

    controlledCopyJobStatusRequestCache.set(cacheKey, request);
    return request;
  },

  /** GET /controlled-copies/distribution-batches/:batchId/failed-items */
  getControlledCopyDistributionFailedItems: async (batchId: string, action: "DISTRIBUTE" | "RECALL" | "CANCEL" = "DISTRIBUTE") => {
    const response = await api.get<Array<{
      controlledCopyId: string;
      controlledCopyNumber: string;
      recipientName: string;
      lastErrorMessage: string;
    }>>(`${CONTROLLED_COPIES_ENDPOINT}/distribution-batches/${batchId}/failed-items`, { params: { action } });
    return response.data;
  },

  /** POST /controlled-copies/distribution-batches/:batchId/retry-failed — fire-and-forget; progress reported over the same job-status/SSE channel. */
  retryFailedControlledCopyDistribution: async (batchId: string, action: "DISTRIBUTE" | "RECALL" | "CANCEL" = "DISTRIBUTE") => {
    await api.post(`${CONTROLLED_COPIES_ENDPOINT}/distribution-batches/${batchId}/retry-failed`, null, { params: { action } });
  },

  /** POST /controlled-copies/:id/report-lost-damaged */
  reportLostDamagedControlledCopy: async (
    id: string,
    data: { destroyedBy?: string; destroyedByUserId?: string; destroyReason: string; witnessedBy?: string; witnessedByUserId?: string; destroyedAt?: string; destructionMethod?: string; destructionType?: string; signatureToken: string }
  ) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/destroy`, data);
    return response.data;
  },

  reportLostDamagedControlledCopyWithEvidence: async (
    id: string,
    data: { destroyedBy?: string; destroyedByUserId?: string; destroyReason: string; witnessedBy?: string; witnessedByUserId?: string; destroyedAt?: string; destructionMethod?: string; destructionType?: string; signatureToken: string },
    evidenceFiles: File[],
    onUploadProgress?: (progressEvent: any) => void,
  ) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, String(value));
      }
    });
    evidenceFiles.forEach((file) => formData.append("evidenceFiles", file));
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/destroy`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
      timeout: 120000,
    });
    return response.data;
  },

  listControlledCopyEvidence: async (id: string) => {
    const response = await api.get(`${CONTROLLED_COPIES_ENDPOINT}/${id}/evidence`);
    return response.data;
  },

  downloadControlledCopyEvidence: async (id: string, evidenceId: string) => {
    const response = await api.get<Blob>(`${CONTROLLED_COPIES_ENDPOINT}/${id}/evidence/${evidenceId}/download`, {
      responseType: "blob",
    });
    return response.data;
  },

  /** POST /controlled-copies/:id/replace — reissue a new copy to the same recipient */
  replaceControlledCopy: async (id: string, data: { reason: string; signatureToken: string }) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/replace`, data);
    return response.data;
  },

  /** POST /controlled-copies/:id/recall */
  recallControlledCopy: async (id: string, data: { recalledBy: string; recallReason: string; recallDate?: string; comment?: string; signatureToken: string }) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/recall`, data);
    return response.data;
  },

  /** POST /controlled-copies/batches/:batchId/recall */
  recallControlledCopyBatch: async (batchId: string, data: { recalledBy: string; recallReason: string; recallDate?: string; comment?: string; signatureToken: string }) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/batches/${batchId}/recall`, data);
    return response.data as ControlledCopyDistributionBatch;
  },

  cancelControlledCopy: async (id: string, data: { reason: string; signatureToken: string }) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/${id}/cancel`, data);
    return response.data;
  },

  cancelControlledCopyBatch: async (batchId: string, data: { reason: string; signatureToken: string }) => {
    const response = await api.post(`${CONTROLLED_COPIES_ENDPOINT}/batches/${batchId}/cancel`, data);
    return response.data as ControlledCopyDistributionBatch;
  },


  // â”””€ File & Attachment â””””””””””””””””””””””””””””””””””””””””””””””””””””””€

  /** POST /documents/:id/upload */
  uploadDocumentFile: async (id: string, file: File) => {
    return uploadFile(`${DOCUMENTS_ENDPOINT}/${id}/upload`, file);
  },

  /** GET /documents/:id/download  táº£i file vá» (blob) */
  downloadDocument: async (id: string) => {
    const response = await api.get<Blob>(`${DOCUMENTS_ENDPOINT}/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /** GET /documents/:id/preview  preview file tÃ i liá»‡u (blob) */
  previewDocument: async (id: string, cacheBuster: string | number = Date.now()) => {
    const response = await api.get<Blob>(`${DOCUMENTS_ENDPOINT}/${id}/preview`, {
      responseType: 'blob',
      params: addCacheBuster({}, cacheBuster),
    });
    return response.data;
  },

  // Audit & Signatures

  /** GET /documents/:id/audit-trail */
  getDocumentAuditTrail: async (id: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const response = await api.get<AuditTrailRecord[]>(
      `${DOCUMENTS_ENDPOINT}/${id}/audit-trail?${query}`
    );
    return response.data.map((record) => normalizeAuditTrailRecord(record));
  },

  /** GET /documents/:id/signatures */
  getDocumentSignatures: async (id: string) => {
    const response = await api.get(`${DOCUMENTS_ENDPOINT}/${id}/signatures`);
    return response.data;
  },
};
