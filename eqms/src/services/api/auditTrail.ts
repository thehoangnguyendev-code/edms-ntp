import { api } from './client';
import type { AuditTrailDetailRecord, AuditTrailRecord, AuditTrailFilters } from '@/features/audit-trail/types';
import type { PaginatedResponse } from '@/types';

const ENDPOINT = '/audit-trail';
const pendingAuditTrailRequests = new Map<string, Promise<PaginatedResponse<AuditTrailRecord>>>();

type AuditTrailUserDto = {
  id: string | null;
  fullName: string | null;
  employeeCode: string | null;
  role: string | null;
  position: string | null;
  department: string | null;
};

type AuditTrailRecordDto = Omit<AuditTrailRecord, 'fullName' | 'userId'> & {
  user?: AuditTrailUserDto | null;
  fullName?: string | null;
  userId?: string | null;
};

type AuditTrailDetailRecordDto = Omit<AuditTrailDetailRecord, 'fullName' | 'userId'> & {
  user?: AuditTrailUserDto | null;
  fullName?: string | null;
  userId?: string | null;
};

type AuditTrailUserOptionDto = {
  label: string;
  value: string;
};

export const normalizeAuditTrailRecord = (record: AuditTrailRecordDto): AuditTrailRecord => ({
  ...record,
  user: record.user || null,
  fullName: record.user?.fullName || record.fullName || '',
  userId: record.user?.employeeCode || record.user?.id || record.userId || '',
  entityLabel: record.entityLabel || record.entityName || (record.metadata as any)?.entityLabel || '',
  objectCode: record.objectCode || (record.metadata as any)?.objectCode || null,
  changeSummary: record.changeSummary || (record.metadata as any)?.changeSummary || record.description || '',
  reason: record.reason || (record.metadata as any)?.reason || (record.metadata as any)?.comment || record.description || '',
  ipAddress: record.ipAddress || '',
  device: record.device || '',
  userAgent: record.userAgent || (record.metadata as any)?.userAgent || null,
  signatureId: record.signatureId || (record.metadata as any)?.signatureId || (record.metadata as any)?.signature_id || null,
  electronicSignatureApplied:
    record.electronicSignatureApplied === true ||
    (record.metadata as any)?.electronicSignatureApplied === true ||
    Boolean(record.signatureId || (record.metadata as any)?.signatureId || (record.metadata as any)?.signature_id),
});

const normalizeAuditTrailDetailRecord = (record: AuditTrailDetailRecordDto): AuditTrailDetailRecord => ({
  ...normalizeAuditTrailRecord(record),
  createdAt: record.createdAt || null,
  updatedAt: record.updatedAt || null,
  username: record.username || (record.metadata as any)?.username || null,
  actionType: record.actionType || (record.metadata as any)?.actionType || null,
  entityType: record.entityType || (record.metadata as any)?.entityType || null,
  documentNumber: record.documentNumber || (record.metadata as any)?.documentNumber || null,
  revisionNumber: record.revisionNumber || (record.metadata as any)?.revisionNumber || null,
  entityStatus: record.entityStatus || (record.metadata as any)?.entityStatus || null,
  fromStatus: record.fromStatus || (record.metadata as any)?.fromStatus || null,
  toStatus: record.toStatus || (record.metadata as any)?.toStatus || null,
  oldValue: record.oldValue || (record.metadata as any)?.oldValue || null,
  newValue: record.newValue || (record.metadata as any)?.newValue || null,
  reason: record.reason || (record.metadata as any)?.reason || (record.metadata as any)?.comment || record.description || null,
  userAgent: record.userAgent || (record.metadata as any)?.userAgent || null,
});

export type GetAuditTrailParams = Omit<Partial<AuditTrailFilters>, 'module'> & {
  page?: number;
  limit?: number;
  userId?: string;
  entityId?: string;
  documentNumber?: string;
  status?: string;
  ipAddress?: string;
  eSignatureOnly?: boolean;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  module?: string;
  reason?: string;
  signatureToken?: string;
};

export const auditTrailApi = {
  /** GET /audit-trail — paginated, filterable list (read-only) */
  getAuditTrail: async (params?: GetAuditTrailParams) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'All') {
          const key = k === 'searchQuery' ? 'search' : k;
          query.set(key, String(v));
        }
      });
    }
    const cacheKey = query.toString();
    const pending = pendingAuditTrailRequests.get(cacheKey);
    if (pending) {
      return pending;
    }
    const request = api.get<PaginatedResponse<AuditTrailRecordDto>>(`${ENDPOINT}?${query}`)
      .then((response) => ({
        ...response.data,
        data: (response.data.data || []).map(normalizeAuditTrailRecord),
      }))
      .finally(() => {
        pendingAuditTrailRequests.delete(cacheKey);
      });
    pendingAuditTrailRequests.set(cacheKey, request);
    return request;
  },

  /** GET /audit-trail/:id — chi tiết record bao gồm changes[] và metadata */
  getAuditRecordById: async (id: string) => {
    const response = await api.get<AuditTrailDetailRecordDto>(`${ENDPOINT}/${id}`);
    return normalizeAuditTrailDetailRecord(response.data);
  },

  getAuditTrailUsers: async (params?: {
    module?: string;
    documentNumber?: string;
    entityId?: string;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'All') {
          query.set(k, String(v));
        }
      });
    }
    const response = await api.get<AuditTrailUserOptionDto[]>(`${ENDPOINT}/users?${query}`);
    return response.data || [];
  },

  /** GET /audit-trail/entity/:module/:entityId — toàn bộ lịch sử của 1 entity */
  getByEntity: async (
    module: string,
    entityId: string,
    params?: { page?: number; limit?: number }
  ) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const response = await api.get<AuditTrailRecordDto[] | PaginatedResponse<AuditTrailRecordDto>>(
      `${ENDPOINT}/entity/${module}/${entityId}?${query}`
    );
    if (Array.isArray(response.data)) {
      return response.data.map(normalizeAuditTrailRecord);
    }
    return {
      ...response.data,
      data: (response.data.data || []).map(normalizeAuditTrailRecord),
    };
  },

  /** GET /audit-trail/user/:userId */
  getByUser: async (
    userId: string,
    params?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string; module?: string }
  ) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<AuditTrailRecordDto>>(
      `${ENDPOINT}/user/${userId}?${query}`
    );
    return {
      ...response.data,
      data: (response.data.data || []).map(normalizeAuditTrailRecord),
    };
  },

  // ─── Export ───────────────────────────────────────────────────────────────────

  /** GET /audit-trail/export — XLSX blob */
  exportAuditTrail: async (params?: GetAuditTrailParams) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'All') {
          const key = k === 'searchQuery' ? 'search' : k;
          query.set(key, String(v));
        }
      });
    }
    const response = await api.get<Blob>(`${ENDPOINT}/export?${query}`, { responseType: 'blob' });
    return response.data;
  },

  /** GET /audit-trail/export/pdf — PDF blob */
  exportAuditTrailPDF: async (params?: GetAuditTrailParams) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'All') {
          const key = k === 'searchQuery' ? 'search' : k;
          query.set(key, String(v));
        }
      });
    }
    const response = await api.get<Blob>(`${ENDPOINT}/export/pdf?${query}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /** GET /audit-trail/:id/export/:format — export 1 record (json | pdf | txt) */
  exportSingleRecord: async (id: string, format: 'json' | 'pdf' | 'txt') => {
    const response = await api.get<Blob>(`${ENDPOINT}/${id}/export/${format}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // ─── Review campaigns (periodic QA review, EU-GMP Annex 11 §9) ────────────────

  listReviewCampaigns: async (): Promise<AuditTrailReviewCampaignSummary[]> => {
    const r = await api.get<AuditTrailReviewCampaignSummary[]>(`${ENDPOINT}/reviews`);
    return r.data;
  },

  listReviewCampaignsPaged: async (params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): Promise<AuditTrailPageResponse<AuditTrailReviewCampaignSummary>> => {
    const r = await api.get<AuditTrailPageResponse<AuditTrailReviewCampaignSummary>>(`${ENDPOINT}/reviews/paged`, { params });
    return r.data;
  },

  getReviewCampaignSummary: async (id: string): Promise<AuditTrailReviewCampaignSummary> => {
    const r = await api.get<AuditTrailReviewCampaignSummary>(`${ENDPOINT}/reviews/${id}/summary`);
    return r.data;
  },

  listReviewCampaignItemsPaged: async (campaignId: string, params: {
    page: number;
    limit: number;
    search?: string;
    decision?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): Promise<AuditTrailPageResponse<AuditTrailReviewItem>> => {
    const r = await api.get<AuditTrailPageResponse<AuditTrailReviewItem>>(`${ENDPOINT}/reviews/${campaignId}/items/paged`, { params });
    return r.data;
  },

  getReviewCampaign: async (id: string): Promise<AuditTrailReviewCampaignDetail> => {
    const r = await api.get<AuditTrailReviewCampaignDetail>(`${ENDPOINT}/reviews/${id}`);
    return r.data;
  },

  createReviewCampaign: async (payload: {
    name: string;
    description?: string;
    reviewPeriodStart: string;
    reviewPeriodEnd: string;
  }): Promise<AuditTrailReviewCampaignDetail> => {
    const r = await api.post<AuditTrailReviewCampaignDetail>(`${ENDPOINT}/reviews`, payload);
    return r.data;
  },

  decideReviewItem: async (
    campaignId: string,
    itemId: string,
    payload: { decision: string; note?: string },
  ): Promise<AuditTrailReviewItem> => {
    const r = await api.put<AuditTrailReviewItem>(`${ENDPOINT}/reviews/${campaignId}/items/${itemId}`, payload);
    return r.data;
  },

  completeReviewCampaign: async (
    id: string,
    payload: { signatureToken: string; reason?: string },
  ): Promise<AuditTrailReviewCampaignDetail> => {
    const r = await api.post<AuditTrailReviewCampaignDetail>(`${ENDPOINT}/reviews/${id}/complete`, payload);
    return r.data;
  },

  cancelReviewCampaign: async (id: string): Promise<AuditTrailReviewCampaignDetail> => {
    const r = await api.post<AuditTrailReviewCampaignDetail>(`${ENDPOINT}/reviews/${id}/cancel`);
    return r.data;
  },

  // ─── Stats ────────────────────────────────────────────────────────────────────

  /** GET /audit-trail/stats */
  getStats: async () => {
    const response = await api.get<{
      totalRecords: number;
      today: number;
      thisWeek: number;
      thisMonth: number;
      criticalCount: number;
      highCount: number;
    }>(`${ENDPOINT}/stats`);
    return response.data;
  },

  /** GET /audit-trail/integrity-check */
  checkIntegrity: async () => {
    const response = await api.get<{
      status: 'OK' | 'TAMPERED';
      checkedRecords: number;
      failedRecords: number;
    }>(`${ENDPOINT}/integrity-check`);
    return response.data;
  },
};

export interface AuditTrailReviewCampaignSummary {
  id: string;
  name: string;
  description?: string | null;
  reviewPeriodStart?: string | null;
  reviewPeriodEnd?: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  statusLabel: string;
  reviewerName?: string | null;
  signedAt?: string | null;
  signatureId?: string | null;
  totalItems: number;
  pendingItems: number;
  createdAt: string;
}

export interface AuditTrailPageResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditTrailReviewItem {
  id: string;
  auditLogId: string;
  timestamp?: string | null;
  userFullName?: string | null;
  employeeCode?: string | null;
  module?: string | null;
  action?: string | null;
  entityLabel?: string | null;
  electronicSignatureApplied: boolean;
  decision: 'PENDING' | 'CONFIRMED' | 'FLAGGED';
  decisionLabel: string;
  decisionNote?: string | null;
  decidedAt?: string | null;
}

export interface AuditTrailReviewCampaignDetail {
  campaign: AuditTrailReviewCampaignSummary;
  items: AuditTrailReviewItem[];
}
