/**
 * Training Management API Service
 * EU-GMP Chapter 2 (Personnel) compliant training and competency management
 *
 * Endpoint base: /api/training
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * === COURSE INVENTORY =========================================================
 * GET    /training/courses                 - Danh sách khóa học (filter + phân trang)
 *        Params: page, limit, search, status, category, departmentRequired
 * GET    /training/courses/:id             - Chi tiết khóa học
 * POST   /training/courses                 - Tạo khóa học mới
 *        Body: { courseCode, title, description, category, duration,
 *                durationUnit: 'Hours'|'Days', validityPeriodMonths?,
 *                departmentRequired, instructorId?, passingScore? }
 * PUT    /training/courses/:id             - Cập nhật khóa học
 * DELETE /training/courses/:id             - Xóa khóa học
 * POST   /training/courses/:id/publish     - Phát hành khóa học
 * POST   /training/courses/:id/archive     - Lưu trữ khóa học
 *
 * === METADATA & FILTERS =======================================================
 * GET    /training/filters                 - Lấy dữ liệu cho các dropdown bộ lọc
 *        Returns: {
 *          courseTypes: [{label, value}],
 *          statuses: [{label, value}],
 *          departments: [{label, value}]
 *        }
 *
 * === TRAINING MATERIALS =======================================================
 * GET    /training/materials               - Danh sách tài liệu đào tạo
 *        Params: courseId, page, limit
 * POST   /training/materials/upload        - Upload tài liệu đào tạo
 *        Body: FormData { file, courseId, title, materialType: 'Slide'|'Video'|'Document'|'Quiz' }
 * DELETE /training/materials/:id           - Xóa tài liệu đào tạo
 * GET    /training/materials/:id/download  - Tải tài liệu về
 *
 * === ASSIGNMENTS (GÁN KHÓA HỌC) ==============================================
 * GET    /training/assignments             - Danh sách assignments (filter + phân trang)
 *        Params: page, limit, userId, courseId, status: 'Assigned'|'InProgress'|'Completed'|'Overdue',
 *                dateFrom, dateTo, department
 * GET    /training/assignments/:id         - Chi tiết 1 assignment
 * POST   /training/assignments             - Gán khóa học cho người dùng
 *        Body: { courseId, userIds: string[], dueDate, assignedBy, note? }
 * POST   /training/assignments/bulk        - Gán khóa học theo phòng ban / vai trò
 *        Body: { courseId, department?, role?, dueDate }
 * DELETE /training/assignments/:id         - Hủy assignment
 * PATCH  /training/assignments/:id/complete - Đánh dấu hoàn thành
 *        Body: { completionDate, score?, examinationMethod?, notes? }
 * PATCH  /training/assignments/:id/extend-due - Gia hạn deadline
 *        Body: { newDueDate, reason }
 *
 * === TRAINING RECORDS ARCHIVE =================================================
 * GET    /training/records                 - Hồ sơ đào tạo đã hoàn thành
 *        Params: page, limit, userId, courseId, dateFrom, dateTo, department
 * GET    /training/records/:id             - Chi tiết hồ sơ
 * GET    /training/records/:id/certificate - Tải chứng chỉ hoàn thành (PDF blob)
 * POST   /training/records                 - Ghi nhận thủ công (cho training offline)
 *        Body: { userId, courseId, completionDate, score?, trainingMethod, conductedBy }
 *
 * === COMPLIANCE TRACKING ======================================================
 * GET    /training/compliance              - Báo cáo tuân thủ đào tạo
 *        Params: department, role, dateFrom, dateTo
 *        Returns: [{ userId, name, department, required, completed, overdue, complianceRate }]
 * GET    /training/compliance/overdue      - Danh sách người dùng quá hạn
 *        Params: department
 * GET    /training/compliance/expiring     - Assignments sắp hết hạn hiệu lực (cần re-train)
 *        Params: daysAhead (default: 30)
 *
 * === EXPORT ===================================================================
 * GET    /training/export/records          - Export hồ sơ đào tạo (XLSX blob)
 *        Params: department, dateFrom, dateTo
 * GET    /training/export/compliance       - Export báo cáo tuân thủ (XLSX blob)
 *        Params: department, dateFrom, dateTo
 *
 * === STATS ====================================================================
 * GET    /training/stats                   - Thống kê tổng quan
 *        Returns: { totalCourses, activeCourses, totalAssignments,
 *                   completed, overdue, complianceRate, upcomingDue }
 */

import { api } from './client';
import type { PaginatedResponse } from '@/types';

const ENDPOINT = '/training';

export const trainingApi = {
  // ─── Courses ──────────────────────────────────────────────────────────────────

  /** GET /training/courses */
  getCourses: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    departmentRequired?: string;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<any>>(`${ENDPOINT}/courses?${query}`);
    return response.data;
  },

  /** GET /training/courses/:id */
  getCourseById: async (id: string) => {
    const response = await api.get<any>(`${ENDPOINT}/courses/${id}`);
    return response.data;
  },

  /** POST /training/courses */
  createCourse: async (data: Record<string, any>) => {
    const response = await api.post<any>(`${ENDPOINT}/courses`, data);
    return response.data;
  },

  /** PUT /training/courses/:id */
  updateCourse: async (id: string, data: Record<string, any>) => {
    const response = await api.put<any>(`${ENDPOINT}/courses/${id}`, data);
    return response.data;
  },

  /** DELETE /training/courses/:id */
  deleteCourse: async (id: string) => {
    const response = await api.delete(`${ENDPOINT}/courses/${id}`);
    return response.data;
  },

  // ─── Materials ────────────────────────────────────────────────────────────────

  /** POST /training/materials/upload */
  uploadMaterial: async (
    courseId: string,
    file: File,
    meta: { title: string; materialType: 'Slide' | 'Video' | 'Document' | 'Quiz' }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', courseId);
    Object.entries(meta).forEach(([k, v]) => formData.append(k, v));
    const response = await api.post<any>(`${ENDPOINT}/materials/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** GET /training/materials/:id/download */
  downloadMaterial: async (id: string) => {
    const response = await api.get<Blob>(`${ENDPOINT}/materials/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // ─── Assignments ──────────────────────────────────────────────────────────────

  /** GET /training/assignments */
  getAssignments: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    courseId?: string;
    status?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<any>>(`${ENDPOINT}/assignments?${query}`);
    return response.data;
  },

  /** POST /training/assignments — gán khóa học cho người dùng */
  assignCourse: async (data: {
    courseId: string;
    userIds: string[];
    dueDate: string;
    assignedBy?: string;
    note?: string;
  }) => {
    const response = await api.post<any>(`${ENDPOINT}/assignments`, data);
    return response.data;
  },

  /** PATCH /training/assignments/:id/complete */
  completeAssignment: async (
    id: string,
    data: { completionDate: string; score?: number; notes?: string }
  ) => {
    const response = await api.patch<any>(`${ENDPOINT}/assignments/${id}/complete`, data);
    return response.data;
  },

  /** PATCH /training/assignments/:id/extend-due */
  extendDueDate: async (id: string, data: { newDueDate: string; reason: string }) => {
    const response = await api.patch<any>(`${ENDPOINT}/assignments/${id}/extend-due`, data);
    return response.data;
  },

  // ─── Records ──────────────────────────────────────────────────────────────────

  /** GET /training/records */
  getRecords: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    courseId?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<PaginatedResponse<any>>(`${ENDPOINT}/records?${query}`);
    return response.data;
  },

  /** GET /training/records/:id/certificate */
  downloadCertificate: async (id: string) => {
    const response = await api.get<Blob>(`${ENDPOINT}/records/${id}/certificate`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // ─── Compliance ───────────────────────────────────────────────────────────────

  /** GET /training/compliance */
  getComplianceTracking: async (params?: {
    department?: string;
    role?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<any[]>(`${ENDPOINT}/compliance?${query}`);
    return response.data;
  },

  /** GET /training/compliance/overdue */
  getOverdueTrainings: async (params?: { department?: string }) => {
    const query = new URLSearchParams();
    if (params?.department) query.set('department', params.department);
    const response = await api.get<any[]>(`${ENDPOINT}/compliance/overdue?${query}`);
    return response.data;
  },

  /** GET /training/compliance/expiring */
  getExpiringTrainings: async (daysAhead = 30) => {
    const response = await api.get<any[]>(
      `${ENDPOINT}/compliance/expiring?daysAhead=${daysAhead}`
    );
    return response.data;
  },

  // ─── Export ───────────────────────────────────────────────────────────────────

  /** GET /training/export/records — XLSX blob */
  exportTrainingRecords: async (params?: {
    department?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<Blob>(`${ENDPOINT}/export/records?${query}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /** GET /training/export/compliance — XLSX blob */
  exportComplianceReport: async (params?: { department?: string; dateFrom?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<Blob>(`${ENDPOINT}/export/compliance?${query}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // ─── Stats ────────────────────────────────────────────────────────────────────

  /** GET /training/stats */
  getStats: async () => {
    const response = await api.get<{
      totalCourses: number;
      activeCourses: number;
      totalAssignments: number;
      completed: number;
      overdue: number;
      complianceRate: number;
      upcomingDue: number;
    }>(`${ENDPOINT}/stats`);
    return response.data;
  },
};
