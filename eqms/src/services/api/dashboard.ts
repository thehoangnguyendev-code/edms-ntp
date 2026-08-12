import { api } from "./client";

export interface DashboardSummary {
  totalEffectiveDocuments: number;
  pendingReview: number;
  pendingApproval: number;
  pendingTraining: number;
  myPendingWorkflowActions: number;
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

  getPendingWorkflowActions: () =>
    api.get<DashboardPendingWorkflowAction[]>("/dashboard/my-tasks").then((r) => r.data),

  getRecentActivity: () =>
    api
      .get<DashboardRecentActivity[]>("/dashboard/recent-activity")
      .then((r) => r.data),

  getAdminStats: () =>
    api.get<DashboardAdminStats>("/dashboard/admin-stats").then((r) => r.data),
};
