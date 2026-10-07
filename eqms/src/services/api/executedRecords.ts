import { api } from './client';
import type { PaginatedResponse } from '@/types';

const EXECUTED_RECORDS_ENDPOINT = '/executed-records';

/** Machine status codes -- never compare against a translated/display label. */
export type ExecutedRecordStatus = 'SUBMITTED' | 'PENDING_APPROVAL' | 'EXECUTED' | 'REJECTED';
export type CaptureMethod = 'EFORM' | 'PAPER_SCAN';

export interface ExecutedRecord {
  id: string;
  recordNumber: string;
  formDocumentId?: string | null;
  formDocumentNumber?: string | null;
  formDocumentTitle?: string | null;
  formRevisionId?: string | null;
  formRevisionNumber?: string | null;
  captureMethod: CaptureMethod;
  status: ExecutedRecordStatus;
  filledByUserId?: string | null;
  filledByName?: string | null;
  filledAt?: string | null;
  sourceControlledCopyId?: string | null;
  sourceControlledCopyNumber?: string | null;
  fileAvailable: boolean;
  approvedByUserId?: string | null;
  approvedByName?: string | null;
  rejectedByUserId?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  createdAt?: string | null;
  /** The scan's original file name, and what the browser can render (application/pdf, image/png, image/jpeg). */
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  /** The recall-by-scan batch that produced the record; absent for older records. */
  recallBatchId?: string | null;
}

export interface ExecutedRecordListParams {
  page?: number;
  limit?: number;
  search?: string;
  formDocumentId?: string;
  controlledCopyId?: string;
  filledFrom?: string;
  filledTo?: string;
  sortBy?: 'created' | 'number' | 'document' | 'copy' | 'recipient' | 'filled' | 'scan';
  sortDirection?: 'asc' | 'desc';
}

export interface RecordExecutionInput {
  sourceControlledCopyId?: string;
  filledByUserId?: string;
  filledAt?: string;
  reason: string;
  signatureToken: string;
  file: File;
}

const fileNameFrom = (disposition: string | undefined, fallback: string) =>
  disposition?.match(/filename="([^"]+)"/)?.[1] || fallback;

export const executedRecordApi = {
  /** GET /executed-records */
  getExecutedRecords: async (params: ExecutedRecordListParams = {}): Promise<PaginatedResponse<ExecutedRecord>> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const suffix = query.size > 0 ? `?${query}` : '';
    const response = await api.get<PaginatedResponse<ExecutedRecord>>(`${EXECUTED_RECORDS_ENDPOINT}${suffix}`);
    return response.data;
  },

  /** GET /executed-records/:id */
  getExecutedRecordDetail: async (id: string): Promise<ExecutedRecord> => {
    const response = await api.get<ExecutedRecord>(`${EXECUTED_RECORDS_ENDPOINT}/${id}`);
    return response.data;
  },

  /** POST /controlled-copies/:controlledCopyId/recall-with-executed-record (multipart, e-signature
   *  required) -- launched from the Controlled Copy's own Recall action: "this copy came back
   *  filled in" and "this copy is now closed" as one operator action, one signature. */
  recordPhysicalCopyAndClose: async (controlledCopyId: string, input: RecordExecutionInput): Promise<ExecutedRecord> => {
    const { file, ...request } = input;
    const formData = new FormData();
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    formData.append('file', file);
    const response = await api.post<ExecutedRecord>(
      `/controlled-copies/${controlledCopyId}/recall-with-executed-record`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  /** GET /executed-records/:id/preview -- the scan, inline, for the preview modal (view permission only). */
  fetchExecutedRecordPreview: async (id: string): Promise<Blob> => {
    const response = await api.get<Blob>(`${EXECUTED_RECORDS_ENDPOINT}/${id}/preview`, { responseType: 'blob' });
    return response.data;
  },

  /** GET /executed-records/:id/download */
  downloadExecutedRecord: async (id: string): Promise<{ blob: Blob; fileName: string }> => {
    const response = await api.get<Blob>(`${EXECUTED_RECORDS_ENDPOINT}/${id}/download`, { responseType: 'blob' });
    const disposition = response.headers?.['content-disposition'] as string | undefined;
    return { blob: response.data, fileName: fileNameFrom(disposition, `ExecutedRecord_${id}.pdf`) };
  },
};
