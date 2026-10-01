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
}

export interface ExecutedRecordListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  captureMethod?: string;
  formDocumentId?: string;
  filledFrom?: string;
  filledTo?: string;
  sortBy?: 'created' | 'number' | 'status' | 'method' | 'filled';
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

export interface ExecutedRecordActionInput {
  comment?: string;
  reason?: string;
  signatureToken: string;
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

  /** POST /forms/:formDocumentId/executed-records/record-physical-copy (multipart, e-signature required) */
  recordPhysicalCopy: async (formDocumentId: string, input: RecordExecutionInput): Promise<ExecutedRecord> => {
    const { file, ...request } = input;
    const formData = new FormData();
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    formData.append('file', file);
    const response = await api.post<ExecutedRecord>(
      `/forms/${formDocumentId}/executed-records/record-physical-copy`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
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

  /** POST /forms/:formDocumentId/executed-records/submit-eform (multipart, e-signature required) */
  submitEform: async (formDocumentId: string, input: RecordExecutionInput): Promise<ExecutedRecord> => {
    const { file, ...request } = input;
    const formData = new FormData();
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    formData.append('file', file);
    const response = await api.post<ExecutedRecord>(
      `/forms/${formDocumentId}/executed-records/submit-eform`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  /** POST /executed-records/:id/approve (e-signature required) */
  approveExecutedRecord: async (id: string, payload: ExecutedRecordActionInput): Promise<ExecutedRecord> => {
    const response = await api.post<ExecutedRecord>(`${EXECUTED_RECORDS_ENDPOINT}/${id}/approve`, payload);
    return response.data;
  },

  /** POST /executed-records/:id/reject (e-signature + reason required) */
  rejectExecutedRecord: async (id: string, payload: ExecutedRecordActionInput): Promise<ExecutedRecord> => {
    const response = await api.post<ExecutedRecord>(`${EXECUTED_RECORDS_ENDPOINT}/${id}/reject`, payload);
    return response.data;
  },

  /** GET /executed-records/:id/download */
  downloadExecutedRecord: async (id: string): Promise<{ blob: Blob; fileName: string }> => {
    const response = await api.get<Blob>(`${EXECUTED_RECORDS_ENDPOINT}/${id}/download`, { responseType: 'blob' });
    const disposition = response.headers?.['content-disposition'] as string | undefined;
    return { blob: response.data, fileName: fileNameFrom(disposition, `ExecutedRecord_${id}.pdf`) };
  },
};
