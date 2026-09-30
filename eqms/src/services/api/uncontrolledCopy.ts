import { api } from './client';
import type { PaginatedResponse } from '@/types';
import type { UncontrolledCopyPolicyMarking } from './uncontrolledCopyPolicy';

const UNCONTROLLED_COPIES_ENDPOINT = '/uncontrolled-copies';

/** Machine status codes returned by the server -- never compare against the translated/display label. */
export type UncontrolledCopyStatusCode =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'GENERATED'
  | 'DISTRIBUTED'
  | 'CANCELLED'
  | 'EXPIRED';

/** What the current user may do on a record right now -- evaluated by the server, only mirrored by the UI. */
export interface UncontrolledCopyCapabilities {
  canApprove: boolean;
  canReject: boolean;
  canGenerate: boolean;
  canDistribute: boolean;
  canCancel: boolean;
  canPreview: boolean;
  canDownload: boolean;
}

export interface UncontrolledCopy {
  id: string;
  uncontrolledCopyNumber: string;
  documentId?: string | null;
  documentNumber: string;
  documentTitle?: string | null;
  revisionId?: string | null;
  revisionNumber?: string | null;
  reason?: string | null;
  status: string;
  statusCode: UncontrolledCopyStatusCode;
  requestedById?: string | null;
  requestedByName?: string | null;
  requestedAt?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  generatedByName?: string | null;
  generatedAt?: string | null;
  distributedByName?: string | null;
  distributedAt?: string | null;
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  /** EXTERNAL = legacy free-text e-mail recipient (no longer created; grants no recipient access). */
  recipientType?: 'SELF' | 'INTERNAL' | 'EXTERNAL_HANDOVER' | 'EXTERNAL' | null;
  /** The system user holding the copy. */
  recipientName?: string | null;
  recipientEmail?: string | null;
  /** Display/audit label of the outside party the holder hands the copy to; grants no access. */
  externalRecipient?: string | null;
  markingApplied: boolean;
  fileAvailable: boolean;
  validUntil?: string | null;
  expired: boolean;
  downloadCount: number;
  lastDownloadedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  capabilities: UncontrolledCopyCapabilities;
}

export interface UncontrolledCopyFilters {
  statuses: { id: string; name: string; code: string; label: string; value: string }[];
}

export interface UncontrolledCopyRequestContext {
  documentId?: string | null;
  documentNumber?: string | null;
  documentTitle?: string | null;
  documentTypeName?: string | null;
  documentStatus?: string | null;
  revisionId?: string | null;
  revisionNumber?: string | null;
  revisionStatus?: string | null;
  documentTypeEligible: boolean;
  canRequest: boolean;
  canRequestForOthers: boolean;
  message?: string | null;
  approvalRequired: boolean;
  validityHours: number;
  allowRedownload: boolean;
  marking: UncontrolledCopyPolicyMarking;
  mandatoryWatermarkText: string;
}

export interface UncontrolledCopyListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  documentId?: string;
  createdFrom?: string;
  createdTo?: string;
  validFrom?: string;
  validTo?: string;
  approvedFrom?: string;
  approvedTo?: string;
  distributedFrom?: string;
  distributedTo?: string;
  sortBy?: 'created' | 'number' | 'document' | 'status' | 'validUntil' | 'requested' | 'approved' | 'distributed';
  sortDirection?: 'asc' | 'desc';
}

export interface UncontrolledCopyCreateInput {
  documentId: string;
  revisionId?: string;
  reason: string;
  /** A real system user (blank = the requester). Only this user's login opens the download link. */
  recipientUserId?: string;
  /** Optional display/audit label for an outside party; the holder above hands the copy over. */
  externalRecipientLabel?: string;
  signatureToken: string;
}

export interface UncontrolledCopyActionInput {
  reason?: string;
  signatureToken?: string;
}

export interface UncontrolledCopyDistributionJobStatus {
  uncontrolledCopyId: string;
  jobId: string;
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  status: 'in_progress' | 'completed' | 'completed_with_errors';
  lastError?: string | null;
}

export interface UncontrolledCopyFile {
  blob: Blob;
  fileName: string;
}

const fileNameFrom = (disposition: string | undefined, fallback: string) =>
  disposition?.match(/filename="([^"]+)"/)?.[1] || fallback;

export const uncontrolledCopyApi = {
  /** GET /uncontrolled-copies/filters */
  getUncontrolledCopyFilters: async (): Promise<UncontrolledCopyFilters> => {
    const response = await api.get<UncontrolledCopyFilters>(`${UNCONTROLLED_COPIES_ENDPOINT}/filters`);
    return response.data;
  },

  /** GET /uncontrolled-copies */
  getUncontrolledCopies: async (params: UncontrolledCopyListParams = {}): Promise<PaginatedResponse<UncontrolledCopy>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const suffix = query.size > 0 ? `?${query}` : '';
    const response = await api.get<PaginatedResponse<UncontrolledCopy>>(`${UNCONTROLLED_COPIES_ENDPOINT}${suffix}`);
    return response.data;
  },

  /** GET /uncontrolled-copies/:id/detail */
  getUncontrolledCopyDetail: async (id: string): Promise<UncontrolledCopy> => {
    const response = await api.get<UncontrolledCopy>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/detail`);
    return response.data;
  },

  /** GET /uncontrolled-copies/request-context */
  getUncontrolledCopyRequestContext: async (params: { documentId?: string; revisionId?: string }): Promise<UncontrolledCopyRequestContext> => {
    const query = new URLSearchParams();
    if (params.documentId) query.set('documentId', params.documentId);
    if (params.revisionId) query.set('revisionId', params.revisionId);
    const response = await api.get<UncontrolledCopyRequestContext>(`${UNCONTROLLED_COPIES_ENDPOINT}/request-context?${query}`);
    return response.data;
  },

  /** POST /uncontrolled-copies (e-signature required) */
  requestUncontrolledCopy: async (payload: UncontrolledCopyCreateInput): Promise<UncontrolledCopy> => {
    const response = await api.post<UncontrolledCopy>(UNCONTROLLED_COPIES_ENDPOINT, payload);
    return response.data;
  },

  /** POST /uncontrolled-copies/:id/approve (e-signature required) */
  approveUncontrolledCopyRequest: async (id: string, payload: UncontrolledCopyActionInput): Promise<UncontrolledCopy> => {
    const response = await api.post<UncontrolledCopy>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/approve`, payload);
    return response.data;
  },

  /** POST /uncontrolled-copies/:id/reject (e-signature + reason required) */
  rejectUncontrolledCopyRequest: async (id: string, payload: UncontrolledCopyActionInput): Promise<UncontrolledCopy> => {
    const response = await api.post<UncontrolledCopy>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/reject`, payload);
    return response.data;
  },

  /** POST /uncontrolled-copies/:id/generate - renders + stores the watermarked PDF. */
  generateUncontrolledCopy: async (id: string, payload: UncontrolledCopyActionInput = {}): Promise<UncontrolledCopy> => {
    const response = await api.post<UncontrolledCopy>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/generate`, payload);
    return response.data;
  },

  /** POST /uncontrolled-copies/:id/distribute (e-signature required); the e-mail is sent asynchronously. */
  distributeUncontrolledCopy: async (id: string, payload: UncontrolledCopyActionInput): Promise<UncontrolledCopy> => {
    const response = await api.post<UncontrolledCopy>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/distribute`, payload);
    return response.data;
  },

  /** POST /uncontrolled-copies/distribute-batch - one e-signature for every selected Generated copy. */
  distributeUncontrolledCopyBatch: async (ids: string[], payload: UncontrolledCopyActionInput): Promise<UncontrolledCopy[]> => {
    const response = await api.post<UncontrolledCopy[]>(`${UNCONTROLLED_COPIES_ENDPOINT}/distribute-batch`, { ids, ...payload });
    return response.data;
  },

  /** POST /uncontrolled-copies/:id/cancel (e-signature + reason required) */
  cancelUncontrolledCopy: async (id: string, payload: UncontrolledCopyActionInput): Promise<UncontrolledCopy> => {
    const response = await api.post<UncontrolledCopy>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/cancel`, payload);
    return response.data;
  },

  /** GET /uncontrolled-copies/:id/preview - inline PDF; does not consume the download allowance. */
  previewUncontrolledCopy: async (id: string): Promise<UncontrolledCopyFile> => {
    const response = await api.get<Blob>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/preview`, { responseType: 'blob' });
    const disposition = response.headers?.['content-disposition'] as string | undefined;
    return { blob: response.data, fileName: fileNameFrom(disposition, `UncontrolledCopy_${id}.pdf`) };
  },

  /** GET /uncontrolled-copies/:id/download - login-required attachment (the e-mail link lands on a route that calls this). */
  downloadUncontrolledCopy: async (id: string): Promise<UncontrolledCopyFile> => {
    const response = await api.get<Blob>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/download`, { responseType: 'blob' });
    const disposition = response.headers?.['content-disposition'] as string | undefined;
    return { blob: response.data, fileName: fileNameFrom(disposition, `UncontrolledCopy_${id}.pdf`) };
  },

  /** GET /uncontrolled-copies/:id/distribution-job-status */
  getUncontrolledCopyDistributionJobStatus: async (id: string): Promise<UncontrolledCopyDistributionJobStatus> => {
    const response = await api.get<UncontrolledCopyDistributionJobStatus>(`${UNCONTROLLED_COPIES_ENDPOINT}/${id}/distribution-job-status`);
    return response.data;
  },
};
