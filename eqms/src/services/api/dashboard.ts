import { api } from "./client";

export interface DashboardSummary {
  totalEffectiveDocuments: number;
  pendingReview: number;
  pendingApproval: number;
  pendingTraining: number;
  myPendingTasks: number;
  totalDocuments: number;
}

export interface DashboardActivityPoint {
  label: string;
  value: number;
}

export interface DashboardPendingWorkflowAction {
  revisionId: string;
  documentId: string;
  documentNumber: string;
  documentName: string;
  revisionNumber: string;
  status: string;
  taskType: "REVIEW" | "APPROVAL";
  createdAt: string;
}

export interface DashboardRecentActivity {
  id: string;
  entityType: string;
  entityName: string;
  entityCode: string;
  action: string;
  actionType: string;
  userFullName: string;
  fromStatus: string | null;
  toStatus: string | null;
  eventTime: string;
}

/** Documents of one Document Type in a lifecycle status (see GET /dashboard/effective-documents-by-type). */
export interface DashboardDocumentTypeCount {
  typeId: string;
  shortCode: string;
  name: string;
  documents: number;
}

/** GET /dashboard/system-monitoring: read when requested, administrative dashboard permission only. */
export interface DashboardSystemMonitoring {
  generatedAt: string;
  runtime: {
    applicationVersion: string;
    startedAt: string;
    uptimeMillis: number;
    heapUsedBytes: number;
    heapMaxBytes: number;
    availableProcessors: number;
  };
  database: {
    schemaMigrationVersion: string;
    appliedMigrations: number;
    poolActive: number | null;
    poolIdle: number | null;
    poolMax: number | null;
  };
  security: {
    /** Every user status, including those no user has. */
    usersByStatus: Record<string, number>;
    lockedAccounts: number;
    activeSessions: number;
    failedLogins24h: number;
    electronicSignatures30d: number;
  };
  compliance: {
    openAccessReviews: number;
    openAuditTrailReviews: number;
    openControlledCopyDiscrepancies: number;
  };
}

export interface DashboardAdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalDocuments: number;
  documentsByStatus: Record<string, number>;
  revisionsByStatus: Record<string, number>;
  auditEventsLast30Days: number;
  auditActivityByDay: DashboardActivityPoint[];
}

export const dashboardApi = {
  getSummary: () =>
    api.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),

  getDocumentActivity: (period: "month" | "quarter" | "year" = "month") =>
    api
      .get<DashboardActivityPoint[]>("/dashboard/document-activity", { params: { period } })
      .then((r) => r.data),

  getEffectiveDocumentsByType: () =>
    api
      .get<DashboardDocumentTypeCount[]>("/dashboard/effective-documents-by-type")
      .then((r) => r.data),

  getSystemMonitoring: () =>
    api.get<DashboardSystemMonitoring>("/dashboard/system-monitoring").then((r) => r.data),

  getPendingWorkflowActions: () =>
    api.get<DashboardPendingWorkflowAction[]>("/dashboard/my-tasks").then((r) => r.data),

  getRecentActivity: () =>
    api
      .get<DashboardRecentActivity[]>("/dashboard/recent-activity")
      .then((r) => r.data),

  getAdminStats: () =>
    api.get<DashboardAdminStats>("/dashboard/admin-stats").then((r) => r.data),
};
