/**
 * Shared API Services — Cross-Module Utilities
 * ─────────────────────────────────────────────────────────────────────────────
 * Các endpoint này được dùng chung bởi NHIỀU module khác nhau trong EQMS.
 * Thay vì lặp lại code trong từng module, dùng sharedApi với `module` và `entityId`.
 *
 * CÁC MODULE SỬ DỤNG:
 *   comments     → deviations, capa, complaints, change-control, risk, tasks
 *   attachments  → deviations, capa, complaints, change-control, risk, training, equipment
 *   e-signature  → documents, deviations, capa, change-control, products, controlled-copies
 *   audit-trail  → tất cả modules (per-entity view)
 *   mentions     → comments trong mọi module
 *   watchers     → người theo dõi 1 record bất kỳ
 *   links        → liên kết cross-module (deviation ↔ capa ↔ complaint ↔ risk)
 *
 * Endpoint base: /api/shared
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * === COMMENTS (DÙNG CHUNG) ====================================================
 * GET    /shared/:module/:entityId/comments          - Danh sách comment của 1 record
 *        Params: page (default:1), limit (default:20), sortBy: 'asc'|'desc'
 *        Module values: 'deviations'|'capa'|'complaints'|'change-control'|
 *                       'risks'|'tasks'|'equipment'|'supplier'|'regulatory'
 *
 * POST   /shared/:module/:entityId/comments          - Thêm comment mới
 *        Body: { comment: string, mentions?: string[] (userIds), isInternal?: boolean }
 *        Note: mentions sẽ tự động sinh notification cho người được @mention
 *
 * PUT    /shared/:module/:entityId/comments/:commentId  - Sửa comment (chỉ owner, trong 15 phút)
 *        Body: { comment: string }
 *
 * DELETE /shared/:module/:entityId/comments/:commentId  - Xóa comment (chỉ owner hoặc Admin)
 *
 * POST   /shared/:module/:entityId/comments/:commentId/react  - React comment (like, resolve)
 *        Body: { reaction: 'like'|'resolve' }
 *
 * === ATTACHMENTS (DÙNG CHUNG) =================================================
 * GET    /shared/:module/:entityId/attachments        - Danh sách file đính kèm
 *        Returns: [{ id, filename, fileType, fileSize, uploadedBy, uploadedAt, url }]
 *
 * POST   /shared/:module/:entityId/attachments        - Upload file đính kèm
 *        Body: FormData { file, description?, documentType? }
 *        Constraints: Max 50MB per file, các định dạng cho phép: PDF, DOCX, XLSX, PNG, JPG
 *        Returns: { id, filename, url, fileSize, uploadedAt }
 *
 * GET    /shared/:module/:entityId/attachments/:fileId          - Metadata của 1 file
 * GET    /shared/:module/:entityId/attachments/:fileId/download - Tải file về (blob)
 * DELETE /shared/:module/:entityId/attachments/:fileId          - Xóa file đính kèm
 *        Note: Chỉ người upload hoặc Admin mới xóa được
 *
 * POST   /shared/:module/:entityId/attachments/bulk-upload      - Upload nhiều file cùng lúc
 *        Body: FormData { files: File[] }
 *
 * === E-SIGNATURE — CHỨNG THỰC ĐIỆN TỬ (21 CFR Part 11) =======================
 * POST   /shared/:module/:entityId/sign               - Ký điện tử lên 1 record cụ thể
 *        Body: { username, password, action: 'Approve'|'Reject'|'Review'|'Witness',
 *                comment?, meaning: string }
 *        Returns: { signatureId, signedAt, signedBy, token, hash }
 *        Note: - signatureToken hết hạn sau 5 phút, chỉ dùng 1 lần
 *              - Server ghi hash SHA-256 của (userId + action + timestamp + entityId)
 *              - Không thể xóa hay sửa signature sau khi tạo (immutable)
 *
 * GET    /shared/:module/:entityId/signatures          - Danh sách e-signatures của record
 *        Returns: [{ id, signedBy, action, meaning, signedAt, ipAddress, hash }]
 *
 * POST   /shared/verify-signature                      - Xác minh tính hợp lệ của signature
 *        Body: { signatureId, hash }
 *        Returns: { valid: boolean, tampered: boolean }
 *
 * === AUDIT TRAIL PER ENTITY ===================================================
 * GET    /shared/:module/:entityId/history             - Toàn bộ lịch sử thay đổi của 1 record
 *        Params: page, limit
 *        Returns: [{ action, changedBy, changedAt, changes: [{ field, from, to }],
 *                    ipAddress, description }]
 *        Note: Khác với auditTrailApi.getByEntity() — endpoint này được tối ưu
 *              hơn cho việc hiển thị trong detail view của từng record,
 *              trong khi auditTrailApi phục vụ cho trang Audit Trail toàn hệ thống.
 *
 * === WATCHERS (THEO DÕI) ======================================================
 * GET    /shared/:module/:entityId/watchers            - Danh sách người đang theo dõi record
 * POST   /shared/:module/:entityId/watch               - Theo dõi record (user hiện tại)
 * DELETE /shared/:module/:entityId/unwatch             - Hủy theo dõi
 *
 * === CROSS-MODULE LINKS ========================================================
 * GET    /shared/:module/:entityId/links               - Danh sách liên kết đến records khác
 *        Returns: [{ module, entityId, entityTitle, entityUrl, linkType, linkedAt }]
 *
 * POST   /shared/:module/:entityId/links               - Tạo liên kết cross-module
 *        Body: { targetModule, targetEntityId, linkType?: string, note? }
 *        Ví dụ: Deviation → CAPA, CAPA → Complaint, Risk → CAPA
 *
 * DELETE /shared/:module/:entityId/links/:linkId        - Gỡ liên kết
 *
 * === STATUS HISTORY ===========================================================
 * GET    /shared/:module/:entityId/status-history       - Lịch sử thay đổi trạng thái
 *        Returns: [{ from, to, changedBy, changedAt, reason?, duration }]
 *        Note: Khác với history — chỉ tập trung vào status changes và khoảng thời gian ở mỗi status
 *
 * === TAGS & LABELS ============================================================
 * POST   /shared/:module/:entityId/tags                - Thêm tags
 *        Body: { tags: string[] }
 * DELETE /shared/:module/:entityId/tags                - Xóa tags
 *        Body: { tags: string[] }
 *
 * === MENTIONS / @ ============================================================
 * GET    /shared/mentionable-users                     - Danh sách users có thể @mention
 *        Params: search, module?  (lọc theo module nếu muốn)
 *        Returns: [{ userId, fullName, avatar, department }]
 */

import { api } from './client';
import type { PaginatedResponse } from '@/types';

/**
 * Các modules hỗ trợ shared APIs.
 * Dùng làm type-safe cho tham số `module` trong sharedApi.
 */
export type SharedModule =
  | 'documents'
  | 'revisions'
  | 'training';

export interface Comment {
  id: string;
  comment: string;
  isInternal: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  editedAt?: string;
  mentions?: string[];
  reactions?: { type: 'like' | 'resolve'; count: number; reacted: boolean }[];
}

export interface Attachment {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number; // bytes
  description?: string;
  documentType?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  url: string;
}

export interface ESignature {
  id: string;
  entityType?: string;
  entityId?: string;
  signedBy: string;
  signedByName: string;
  fullName?: string;
  username?: string;
  position?: string;
  email?: string;
  department?: string;
  action: 'Approve' | 'Reject' | 'Review' | 'Witness';
  meaning: string;
  displayMeaning?: string;
  comment?: string;
  signedAt: string;
  timezone?: string;
  authenticationMethod?: string;
  signatureId?: string;
  verificationId?: string;
  status?: string;
  ipAddress?: string;
  userAgent?: string;
  hash?: string;
}

export interface EntitySignatureRecord {
  id: string;
  entityType?: string;
  entityId?: string;
  documentId?: string;
  revisionId?: string;
  workflowStepId?: string;
  userId?: string;
  username?: string;
  fullName?: string;
  position?: string;
  email?: string;
  department?: string;
  meaning?: string;
  displayMeaning?: string;
  reason?: string;
  comment?: string;
  signedAt?: string;
  timezone?: string;
  authenticationMethod?: string;
  signatureId?: string;
  verificationId?: string;
  status?: string;
  ipAddress?: string;
  userAgent?: string;
  documentChecksumBeforeSign?: string;
  documentChecksumAfterSign?: string;
  sourceFileVersionId?: string;
  reviewPdfVersionId?: string;
  publishedPdfVersionId?: string;
  createdAt?: string;
}

export interface HistoryEntry {
  id: string;
  action: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  description: string;
  changes?: { field: string; from: string | null; to: string | null }[];
  ipAddress?: string;
}

// ─── sharedApi ────────────────────────────────────────────────────────────────

export const sharedApi = {
  // ---------- COMMENTS --------------------------------------------------------

  /**
   * Lấy danh sách comment của 1 record.
   * @example sharedApi.getComments('deviations', 'DEV-001')
   * @example sharedApi.getComments('capa', 'CAPA-002', { limit: 50 })
   */
  getComments: async (
    module: SharedModule,
    entityId: string,
    params?: { page?: number; limit?: number; sortBy?: 'asc' | 'desc' }
  ) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<Comment>>(
      `/shared/${module}/${entityId}/comments?${query}`
    );
    return response.data;
  },

  /**
   * Thêm comment mới vào 1 record.
   * @example sharedApi.addComment('deviations', 'DEV-001', { comment: 'Đã điều tra...' })
   * @example sharedApi.addComment('capa', 'CAPA-002', { comment: '@userId xem giúp' , mentions: ['userId'] })
   */
  addComment: async (
    module: SharedModule,
    entityId: string,
    data: { comment: string; mentions?: string[]; isInternal?: boolean }
  ) => {
    const response = await api.post<Comment>(
      `/shared/${module}/${entityId}/comments`,
      data
    );
    return response.data;
  },

  /**
   * Sửa comment (chỉ được sửa trong vòng 15 phút và chỉ owner).
   */
  updateComment: async (
    module: SharedModule,
    entityId: string,
    commentId: string,
    data: { comment: string }
  ) => {
    const response = await api.put<Comment>(
      `/shared/${module}/${entityId}/comments/${commentId}`,
      data
    );
    return response.data;
  },

  /**
   * Xóa comment.
   */
  deleteComment: async (module: SharedModule, entityId: string, commentId: string) => {
    const response = await api.delete(`/shared/${module}/${entityId}/comments/${commentId}`);
    return response.data;
  },

  // ---------- ATTACHMENTS -------------------------------------------------------

  /**
   * Lấy danh sách file đính kèm của 1 record.
   * @example sharedApi.getAttachments('deviations', 'DEV-001')
   */
  getAttachments: async (module: SharedModule, entityId: string) => {
    const response = await api.get<Attachment[]>(
      `/shared/${module}/${entityId}/attachments`
    );
    return response.data;
  },

  /**
   * Upload file đính kèm vào 1 record.
   * @example sharedApi.uploadAttachment('capa', 'CAPA-001', file, { documentType: 'Report' })
   */
  uploadAttachment: async (
    module: SharedModule,
    entityId: string,
    file: File,
    meta?: { description?: string; documentType?: string }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.description) formData.append('description', meta.description);
    if (meta?.documentType) formData.append('documentType', meta.documentType);
    const response = await api.post<Attachment>(
      `/shared/${module}/${entityId}/attachments`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  /**
   * Tải file về (trả về blob).
   * @example const blob = await sharedApi.downloadAttachment('deviations', 'DEV-001', 'file-uuid')
   */
  downloadAttachment: async (module: SharedModule, entityId: string, fileId: string) => {
    const response = await api.get<Blob>(
      `/shared/${module}/${entityId}/attachments/${fileId}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Xóa file đính kèm.
   */
  deleteAttachment: async (module: SharedModule, entityId: string, fileId: string) => {
    const response = await api.delete(
      `/shared/${module}/${entityId}/attachments/${fileId}`
    );
    return response.data;
  },

  // ---------- E-SIGNATURE (21 CFR Part 11) ----------------------------------------

  /**
   * Thực hiện ký điện tử lên 1 record (approve/reject/review/witness).
   * @example sharedApi.sign('documents', 'DOC-001', { username, password, action: 'Approve', meaning: 'I approve this document' })
   * @example sharedApi.sign('capa', 'CAPA-001', { username, password, action: 'Review', meaning: 'I have reviewed the CAPA plan' })
   */
  sign: async (
    module: SharedModule,
    entityId: string,
    data: {
      username: string;
      password: string;
      action: 'Approve' | 'Reject' | 'Review' | 'Witness';
      meaning: string;
      comment?: string;
    }
  ) => {
    const response = await api.post<{ signatureId: string; signedAt: string; hash: string }>(
      `/shared/${module}/${entityId}/sign`,
      data
    );
    return response.data;
  },

  /**
   * Lấy danh sách tất cả e-signatures của 1 record.
   * @example sharedApi.getSignatures('documents', 'DOC-001')
   */
  getSignatures: async (module: SharedModule, entityId: string) => {
    return sharedApi.getEntitySignatures(module, entityId);
  },

  /**
   * Lấy danh sách chữ ký điện tử của một entity bất kỳ.
   * @example sharedApi.getEntitySignatures('training', 'COURSE-001')
   * @example sharedApi.getEntitySignatures('deviations', 'DEV-001')
   */
  getEntitySignatures: async (module: SharedModule, entityId: string) => {
    const response = await api.get<EntitySignatureRecord[]>(
      `/shared/${module}/${entityId}/signatures`
    );
    return response.data;
  },

  /**
   * Xác minh tính hợp lệ của 1 signature (kiểm tra hash, phát hiện tamper).
   */
  verifySignature: async (data: { signatureId: string; hash: string }) => {
    const response = await api.post<{ valid: boolean; tampered: boolean }>(
      `/shared/verify-signature`,
      data
    );
    return response.data;
  },

  // ---------- HISTORY (Audit per entity) -----------------------------------------

  /**
   * Lịch sử thay đổi chi tiết của 1 record — dùng trong Detail View.
   * Khác với auditTrailApi (dùng cho trang Audit Trail toàn hệ thống).
   *
   * @example sharedApi.getHistory('deviations', 'DEV-001')
   * @example sharedApi.getHistory('capa', 'CAPA-005', { page: 2 })
   */
  getHistory: async (
    module: SharedModule,
    entityId: string,
    params?: { page?: number; limit?: number }
  ) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<HistoryEntry>>(
      `/shared/${module}/${entityId}/history?${query}`
    );
    return response.data;
  },

  /**
   * Lịch sử thay đổi trạng thái (chỉ status changes và thời gian ở mỗi status).
   * Hữu ích để vẽ timeline / status progression.
   */
  getStatusHistory: async (module: SharedModule, entityId: string) => {
    const response = await api.get<
      { from: string; to: string; changedBy: string; changedAt: string; reason?: string; durationDays?: number }[]
    >(`/shared/${module}/${entityId}/status-history`);
    return response.data;
  },

  // ---------- WATCHERS -----------------------------------------------------------

  /**
   * Theo dõi 1 record (user hiện tại sẽ nhận notification khi có thay đổi).
   */
  watch: async (module: SharedModule, entityId: string) => {
    const response = await api.post(`/shared/${module}/${entityId}/watch`);
    return response.data;
  },

  /**
   * Hủy theo dõi 1 record.
   */
  unwatch: async (module: SharedModule, entityId: string) => {
    const response = await api.delete(`/shared/${module}/${entityId}/unwatch`);
    return response.data;
  },

  // ---------- CROSS-MODULE LINKS ------------------------------------------------

  /**
   * Lấy danh sách liên kết cross-module của 1 record.
   * @example sharedApi.getLinks('deviations', 'DEV-001')
   * // Returns: linked CAPAs, Complaints, Risks related to this deviation
   */
  getLinks: async (module: SharedModule, entityId: string) => {
    const response = await api.get<
      { module: string; entityId: string; entityTitle: string; linkType?: string; linkedAt: string }[]
    >(`/shared/${module}/${entityId}/links`);
    return response.data;
  },

  /**
   * Tạo liên kết cross-module giữa 2 records.
   * @example sharedApi.createLink('deviations', 'DEV-001', { targetModule: 'capa', targetEntityId: 'CAPA-001' })
   */
  createLink: async (
    module: SharedModule,
    entityId: string,
    data: { targetModule: SharedModule; targetEntityId: string; linkType?: string; note?: string }
  ) => {
    const response = await api.post(`/shared/${module}/${entityId}/links`, data);
    return response.data;
  },

  /**
   * Gỡ 1 liên kết cross-module.
   */
  deleteLink: async (module: SharedModule, entityId: string, linkId: string) => {
    const response = await api.delete(`/shared/${module}/${entityId}/links/${linkId}`);
    return response.data;
  },

  // ---------- MENTIONABLE USERS --------------------------------------------------

  /**
   * Danh sách users có thể @mention trong comment.
   * @example sharedApi.getMentionableUsers({ search: 'nguyen' })
   */
  getMentionableUsers: async (params?: { search?: string; module?: SharedModule }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<
      { userId: string; fullName: string; avatar?: string; department?: string }[]
    >(`/shared/mentionable-users?${query}`);
    return response.data;
  },
};
