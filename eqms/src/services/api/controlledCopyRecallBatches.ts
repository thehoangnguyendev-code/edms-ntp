import { api } from './client';

const ENDPOINT = '/controlled-copies/recall-batches';

/** Machine values -- the screen translates them for display; never compare against a label. */
export type RecallBatchStatus = 'DRAFT' | 'COMMITTED' | 'DISCARDED';
export type RecallMatchStatus = 'READY' | 'UNMATCHED' | 'BLOCKED';
export type RecallQrStatus = 'DECODED' | 'NOT_FOUND' | 'FOREIGN' | 'MULTIPLE' | 'UNREADABLE_FILE' | 'NOT_ATTEMPTED';
export type RecallVirusStatus = 'CLEAN' | 'INFECTED' | 'NOT_SCANNED';
export type RecallOutcome = 'PENDING' | 'RECALLED' | 'SKIPPED';

/** The server's per-batch upload limit. */
export const MAX_RECALL_SCANS = 50;
/** The server's size limit for one scan (25 MB); checked here too so a big file is not uploaded just to be refused. */
export const MAX_RECALL_FILE_BYTES = 25 * 1024 * 1024;
/** Accepted scan type: PDF only (the company scanner produces PDF). The server decides from the file's own bytes; this guides the picker and the drop zone. */
export const RECALL_SCAN_ACCEPT = '.pdf,application/pdf';

/** The groups of scans the badges of a draft count: will be recalled, needs a match or is blocked, copy for reading only, left out. */
export type RecallItemGroup = 'READY' | 'ATTENTION' | 'READ_ONLY' | 'EXCLUDED';

/** Search, group and sort of a batch's scans, applied by the server. */
export interface RecallItemQuery {
  search?: string;
  status?: RecallItemGroup;
  sortBy?: 'itemNo' | 'file' | 'size' | 'code' | 'copy' | 'document' | 'recipient' | 'result';
  sortDirection?: 'asc' | 'desc';
}

export interface RecallItemCopy {
  id: string;
  number?: string | null;
  documentNumber?: string | null;
  documentTitle?: string | null;
  revisionNumber?: string | null;
  recipientName?: string | null;
  status?: string | null;
  distributedAt?: string | null;
  recalledAt?: string | null;
}

export interface RecallItem {
  id: string;
  itemNo: number;
  fileName: string;
  contentType?: string | null;
  fileSize: number;
  sha256: string;
  virusStatus: RecallVirusStatus;
  virusSignature?: string | null;
  qrStatus: RecallQrStatus;
  qrValue?: string | null;
  matchSource?: 'QR' | 'MANUAL' | null;
  matchStatus: RecallMatchStatus;
  matchMessage?: string | null;
  excluded: boolean;
  outcome: RecallOutcome;
  outcomeMessage?: string | null;
  executedRecordId?: string | null;
  /** The number of the record the scan was filed as, once the batch is signed. */
  executedRecordNumber?: string | null;
  previewAvailable: boolean;
  copy?: RecallItemCopy | null;
  /** The scan this item was cut from, when one upload held pages of several copies. */
  sourceFileName?: string | null;
  /** Which pages of that scan went into this item (for people to read). */
  sourcePages?: string | null;
  /** Page numbers of the copy this item holds, comma separated, in file order. */
  pageNumbers?: string | null;
  expectedPages?: number | null;
  /** A single page nobody has placed in a copy yet: needs a controlled copy number and a page number. */
  loosePage: boolean;
  /** The scan is of a copy issued for reading only: never recalled by scan; the DCO removes it from the batch. */
  readAndComply: boolean;
}

/** What a typed controlled copy number matches, and why it cannot be recalled by scan (null when it can). */
export interface RecallCopyLookup {
  copy: RecallItemCopy | null;
  problem: string | null;
}

export interface RecallBatch {
  id: string;
  batchNumber: string;
  status: RecallBatchStatus;
  createdByName?: string | null;
  createdAt?: string | null;
  committedByName?: string | null;
  committedAt?: string | null;
  receivedAt?: string | null;
  recallReason?: string | null;
  totalItems: number;
  readyItems: number;
  blockedItems: number;
  unmatchedItems: number;
  excludedItems: number;
  /** At least one scan will be recalled and every scan that is not excluded is ready. */
  readyToCommit: boolean;
  items: RecallItem[];
}

export interface RecallBatchSummary {
  id: string;
  batchNumber: string;
  status: RecallBatchStatus;
  createdAt?: string | null;
  totalItems: number;
}

export interface RecallItemPatch {
  excluded?: boolean;
  copyNumber?: string;
  /** Which page of that copy a loose page is (required for a loose page). */
  pageNumber?: number;
  clearMatch?: boolean;
}

export interface RecallCommitInput {
  reason: string;
  /** ISO instant or yyyy-MM-dd: when the paper was physically received. Defaults to now on the server. */
  receivedAt?: string;
  signatureToken: string;
}

const multipart = (files: File[]) => {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return form;
};

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/** Bytes sent so far for the current request (the request body is a little larger than the file itself). */
export type UploadProgressHandler = (loadedBytes: number) => void;

/** Where the server is in processing an upload (virus scan, storing, reading the code, matching): what the progress bar follows after the bytes are sent. */
export interface RecallUploadStep {
  stage: string;
  message: string;
  /** 0-100 of the server's work on this upload. */
  percent: number;
}

/** The browser names each upload with a random id (X-Upload-Id) so it can ask the server where that upload is. */
const withProgress = (onProgress?: UploadProgressHandler, uploadId?: string) => ({
  headers: { ...MULTIPART.headers, ...(uploadId ? { 'X-Upload-Id': uploadId } : {}) },
  ...(onProgress ? { onUploadProgress: (event: { loaded: number }) => onProgress(event.loaded) } : {}),
});

export const controlledCopyRecallApi = {
  /** GET /controlled-copies/recall-batches -- the current user's open drafts. */
  listMyDrafts: async (): Promise<RecallBatchSummary[]> => {
    const response = await api.get<RecallBatchSummary[]>(ENDPOINT);
    return response.data;
  },

  /** POST /controlled-copies/recall-batches -- starts a draft from up to 50 scans. Nothing about any copy changes yet. */
  createDraft: async (files: File[], onProgress?: UploadProgressHandler, uploadId?: string): Promise<RecallBatch> => {
    const response = await api.post<RecallBatch>(ENDPOINT, multipart(files), withProgress(onProgress, uploadId));
    return response.data;
  },

  /** POST /controlled-copies/recall-batches/:id/files */
  addFiles: async (batchId: string, files: File[], onProgress?: UploadProgressHandler, uploadId?: string): Promise<RecallBatch> => {
    const response = await api.post<RecallBatch>(`${ENDPOINT}/${batchId}/files`, multipart(files), withProgress(onProgress, uploadId));
    return response.data;
  },

  /** GET /controlled-copies/recall-batches/upload-progress/:uploadId -- the step the server is on for an upload; null when it knows nothing yet. */
  getUploadProgress: async (uploadId: string): Promise<RecallUploadStep | null> => {
    const response = await api.get<RecallUploadStep | ''>(`${ENDPOINT}/upload-progress/${uploadId}`);
    return response.status === 204 || !response.data ? null : response.data;
  },

  /** GET /controlled-copies/recall-batches/:id/items -- the scans searched and sorted by the server. */
  listItems: async (batchId: string, query: RecallItemQuery = {}): Promise<RecallItem[]> => {
    const response = await api.get<RecallItem[]>(`${ENDPOINT}/${batchId}/items`, { params: query });
    return response.data;
  },

  /** GET /controlled-copies/recall-batches/:id/copy-lookup -- the copy a number would match, before anything is matched. */
  lookupCopy: async (batchId: string, number: string): Promise<RecallCopyLookup> => {
    const response = await api.get<RecallCopyLookup>(`${ENDPOINT}/${batchId}/copy-lookup`, { params: { number } });
    return response.data;
  },

  /** GET /controlled-copies/recall-batches/:id */
  getBatch: async (batchId: string): Promise<RecallBatch> => {
    const response = await api.get<RecallBatch>(`${ENDPOINT}/${batchId}`);
    return response.data;
  },

  /** PATCH /controlled-copies/recall-batches/:id/items/:itemId -- exclude a scan, or identify its copy by number. */
  updateItem: async (batchId: string, itemId: string, patch: RecallItemPatch): Promise<RecallBatch> => {
    const response = await api.patch<RecallBatch>(`${ENDPOINT}/${batchId}/items/${itemId}`, patch);
    return response.data;
  },

  /** GET /controlled-copies/recall-batches/:id/items/:itemId/file -- the uploaded scan, for preview. */
  fetchItemFile: async (batchId: string, itemId: string): Promise<Blob> => {
    const response = await api.get<Blob>(`${ENDPOINT}/${batchId}/items/${itemId}/file`, { responseType: 'blob' });
    return response.data;
  },

  /** POST /controlled-copies/recall-batches/:id/commit (one e-signature for the whole reviewed list) */
  commit: async (batchId: string, input: RecallCommitInput): Promise<RecallBatch> => {
    const response = await api.post<RecallBatch>(`${ENDPOINT}/${batchId}/commit`, input);
    return response.data;
  },

  /** POST /controlled-copies/recall-batches/:id/discard */
  discard: async (batchId: string): Promise<RecallBatch> => {
    const response = await api.post<RecallBatch>(`${ENDPOINT}/${batchId}/discard`);
    return response.data;
  },
};
