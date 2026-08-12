/**
 * Reports & Analytics API Service
 * Cross-module reporting and KPI analytics for EQMS
 *
 * Endpoint base: /api/reports
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * === OVERVIEW / SUMMARY REPORTS ===============================================
 * GET    /reports/summary                  - Tổng hợp KPIs toàn hệ thống
 *        Params: dateFrom, dateTo
 *        Returns: { deviations, capa, complaints, changeControl, equipment,
 *                   supplier, training, risk, regulatory, quality }
 *
 * === MODULE-SPECIFIC REPORTS ==================================================
 * GET    /reports/deviations               - Báo cáo deviations theo giai đoạn
 *        Params: dateFrom, dateTo, department, category, severity
 *        Returns: { byStatus, byCategory, bySeverity, byMonth, trend }
 *
 * GET    /reports/capa                     - Báo cáo CAPA
 *        Params: dateFrom, dateTo, department, type, source
 *        Returns: { byStatus, byType, bySource, effectiveness, overdue }
 *
 * GET    /reports/complaints               - Báo cáo complaints
 *        Params: dateFrom, dateTo, type, priority, source
 *        Returns: { byStatus, byType, byPriority, bySource, responseTime }
 *
 * GET    /reports/change-control           - Báo cáo change control
 *        Params: dateFrom, dateTo, department, type, impact
 *        Returns: { byStatus, byType, byImpact, implementationTime }
 *
 * GET    /reports/equipment                - Báo cáo thiết bị & calibration
 *        Params: dateFrom, dateTo, type, department
 *        Returns: { byStatus, calibrationCompliance, maintenanceCompliance,
 *                   qualificationStatus, upcomingDue }
 *
 * GET    /reports/supplier                 - Báo cáo nhà cung cấp
 *        Params: dateFrom, dateTo, category
 *        Returns: { byStatus, byRisk, auditCompliance, certificationStatus }
 *
 * GET    /reports/training                 - Báo cáo đào tạo & tuân thủ
 *        Params: dateFrom, dateTo, department, role
 *        Returns: { complianceRate, byDepartment, courseCompletion,
 *                   overdue, upcomingExpiry }
 *
 * GET    /reports/risk                     - Báo cáo rủi ro
 *        Params: dateFrom, dateTo, category, assessmentMethod
 *        Returns: { byLevel, byCategory, mitigationEffectiveness, riskMatrix }
 *
 * GET    /reports/regulatory               - Báo cáo nộp hồ sơ regulatory
 *        Params: dateFrom, dateTo, authority, type
 *        Returns: { byStatus, byAuthority, approvalRate, avgReviewTime }
 *
 * GET    /reports/documents                - Báo cáo quản lý tài liệu
 *        Params: dateFrom, dateTo, type, status
 *        Returns: { byStatus, byType, revisionsThisPeriod, controlledCopies }
 *
 * === TREND ANALYSIS ===========================================================
 * GET    /reports/trends                   - Xu hướng theo tháng / quý / năm
 *        Params: modules: string[] (comma-separated), period: 'monthly'|'quarterly'|'yearly',
 *                dateFrom, dateTo
 *        Returns: { [module]: { period, count, trend }[] }
 *
 * GET    /reports/kpi-dashboard            - KPI tổng quan toàn hệ thống
 *        Returns: { qualityIndex, capa_closure_rate, training_compliance,
 *                   calibration_compliance, supplier_qualification_rate }
 *
 * === EXPORT ===================================================================
 * GET    /reports/:reportType/export       - Export bất kỳ report nào (XLSX blob)
 *        Params: dateFrom, dateTo + module-specific params
 * GET    /reports/:reportType/export/pdf   - Export bất kỳ report nào (PDF blob)
 *
 * === CUSTOM REPORTS ===========================================================
 * POST   /reports/custom                   - Tạo báo cáo tùy chỉnh
 *        Body: { modules: string[], fields: string[], filters, dateFrom, dateTo }
 *        Returns: StreamResponse (XLSX blob)
 */

import { api } from './client';

const ENDPOINT = '/reports';

export const reportApi = {
  // ─── Summary ──────────────────────────────────────────────────────────────────

  /** GET /reports/summary */
  getSummary: async (params?: { dateFrom?: string; dateTo?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) query.set(k, v);
      });
    }
    const response = await api.get<any>(`${ENDPOINT}/summary?${query}`);
    return response.data;
  },

  /** GET /reports/kpi-dashboard */
  getKPIDashboard: async () => {
    const response = await api.get<{
      qualityIndex: number;
      capaClosureRate: number;
      trainingCompliance: number;
      calibrationCompliance: number;
      supplierQualificationRate: number;
    }>(`${ENDPOINT}/kpi-dashboard`);
    return response.data;
  },

  // ─── Module Reports ───────────────────────────────────────────────────────────

  /** GET /reports/:module — báo cáo theo module */
  getModuleReport: async (
    module:
      | 'deviations'
      | 'capa'
      | 'complaints'
      | 'change-control'
      | 'equipment'
      | 'supplier'
      | 'training'
      | 'risk'
      | 'regulatory'
      | 'documents',
    params?: {
      dateFrom?: string;
      dateTo?: string;
      department?: string;
      [key: string]: string | undefined;
    }
  ) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, v);
      });
    }
    const response = await api.get<any>(`${ENDPOINT}/${module}?${query}`);
    return response.data;
  },

  // ─── Trends ───────────────────────────────────────────────────────────────────

  /** GET /reports/trends */
  getTrends: async (params: {
    modules: string[];
    period: 'monthly' | 'quarterly' | 'yearly';
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = new URLSearchParams({
      modules: params.modules.join(','),
      period: params.period,
      ...(params.dateFrom && { dateFrom: params.dateFrom }),
      ...(params.dateTo && { dateTo: params.dateTo }),
    });
    const response = await api.get<any>(`${ENDPOINT}/trends?${query}`);
    return response.data;
  },

  // ─── Export ───────────────────────────────────────────────────────────────────

  /** GET /reports/:reportType/export — XLSX blob */
  exportReport: async (
    reportType: string,
    format: 'xlsx' | 'pdf',
    params?: Record<string, string>
  ) => {
    const query = new URLSearchParams(params);
    const endpoint = format === 'pdf'
      ? `${ENDPOINT}/${reportType}/export/pdf`
      : `${ENDPOINT}/${reportType}/export`;
    const response = await api.get<Blob>(`${endpoint}?${query}`, { responseType: 'blob' });
    return response.data;
  },

  // ─── Custom Reports ───────────────────────────────────────────────────────────

  /** POST /reports/custom */
  generateCustomReport: async (data: {
    modules: string[];
    fields: string[];
    filters?: Record<string, any>;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const response = await api.post<Blob>(`${ENDPOINT}/custom`, data, {
      responseType: 'blob',
    });
    return response.data;
  },
};
