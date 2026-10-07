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
/** Accepted scan type: PDF only (the company scanner produces PDF). The server decides from the file's own bytes; this guides the picker and the drop zone. */
export const RECALL_SCAN_ACCEPT = '.pdf,application/pdf';

/** Search and sort of a batch's scans, applied by the server. */
export interface RecallItemQuery {
  search?: string;
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

const withProgress = (onProgress?: UploadProgressHandler) => ({
  ...MULTIPART,
  ...(onProgress ? { onUploadProgress: (event: { loaded: number }) => onProgress(event.loaded) } : {}),
});

export const controlledCopyRecallApi = {
  /** GET /controlled-copies/recall-batches -- the current user's open drafts. */
  listMyDrafts: async (): Promise<RecallBatchSummary[]> => {
    const response = await api.get<RecallBatchSummary[]>(ENDPOINT);
    return response.data;
  },

  /** POST /controlled-copies/recall-batches -- starts a draft from up to 50 scans. Nothing about any copy changes yet. */
  createDraft: async (files: File[], onProgress?: UploadProgressHandler): Promise<RecallBatch> => {
    const response = await api.post<RecallBatch>(ENDPOINT, multipart(files), withProgress(onProgress));
    return response.data;
  },

  /** POST /controlled-copies/recall-batches/:id/files */
  addFiles: async (batchId: string, files: File[], onProgress?: UploadProgressHandler): Promise<RecallBatch> => {
    const response = await api.post<RecallBatch>(`${ENDPOINT}/${batchId}/files`, multipart(files), withProgress(onProgress));
    return response.data;
  },

  /** GET /controlled-copies/recall-batches/:id/items -- the scans searched and sorted by the server. */
  listItems: async (batchId: string, query: RecallItemQuery = {}): Promise<RecallItem[]> => {
    const response = await api.get<RecallItem[]>(`${ENDPOINT}/${batchId}/items`, { params: query });
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
