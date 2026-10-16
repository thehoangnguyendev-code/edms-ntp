import React, { Suspense, lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { LoadingFallback } from './LoadingFallback';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const ReportTemplatesView = lazy(() => import('@/features/report').then(m => ({ default: m.ReportTemplatesView })));
const ReportOverviewView = lazy(() => import('@/features/report-analytics').then(m => ({ default: m.ReportOverviewView })));
const ReportRunDetailView = lazy(() => import('@/features/report-analytics').then(m => ({ default: m.ReportRunDetailView })));
const ReportAnalyticsView = lazy(() => import('@/features/report-analytics').then(m => ({ default: m.ReportAnalyticsView })));
const ReportHistoryView = lazy(() => import('@/features/report').then(m => ({ default: m.ReportHistoryView })));
const ReportTemplateRevisionPage = lazy(() => import('@/features/report/templates/ReportTemplateRevisionPage').then(m => ({ default: m.ReportTemplateRevisionPage })));
const ReportTemplateDetailPage = lazy(() => import('@/features/report/templates/ReportTemplateDetailPage').then(m => ({ default: m.ReportTemplateDetailPage })));
const ReportTemplateRunPage = lazy(() => import('@/features/report/templates/ReportTemplateRunPage').then(m => ({ default: m.ReportTemplateRunPage })));
const ScheduleEditorPage = lazy(() => import('@/features/report/scheduled/ScheduleEditorPage').then(m => ({ default: m.ScheduleEditorPage })));
const ReportRunDetailPage = lazy(() => import('@/features/report/history/ReportRunDetailPage').then(m => ({ default: m.ReportRunDetailPage })));
const ScheduledReportsView = lazy(() => import('@/features/report').then(m => ({ default: m.ScheduledReportsView })));
const BackupOverviewView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupOverviewView })));
const BackupsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupsView })));
const RestoreRequestsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.RestoreRequestsView })));
const DrDrillsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.DrDrillsView })));
const BackupSchedulesView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupSchedulesView })));
const BackupExportsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupExportsView })));
const BackupVerificationResultsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupVerificationResultsView })));
const RestoreVerificationReportsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.RestoreVerificationReportsView })));
const RestoreHistoryView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.RestoreHistoryView })));
const InspectionsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.InspectionsView })));
const BackupAlertsView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupAlertsView })));
const RestoreRulesView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.RestoreRulesView })));
const BackupDetailView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupDetailView })));
const RestoreRequestView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.RestoreRequestView })));
const RestoreRequestDetailView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.RestoreRequestDetailView })));
const RestoreExecutionView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.RestoreExecutionView })));
const AuditTrailView = lazy(() => import('@/features/audit-trail').then(m => ({ default: m.AuditTrailView })));
const AuditTrailDetailView = lazy(() => import('@/features/audit-trail').then(m => ({ default: m.AuditTrailDetailView })));
const AuditTrailReviewView = lazy(() => import('@/features/audit-trail').then(m => ({ default: m.AuditTrailReviewView })));
const AuditTrailReviewCampaignDetailView = lazy(() => import('@/features/audit-trail').then(m => ({ default: m.AuditTrailReviewCampaignDetailView })));

const protectedElement = (permission: string, element: React.ReactNode) => (
  <ProtectedRoute requiredPermissions={[permission]}>
    <Suspense fallback={<LoadingFallback />}>{element}</Suspense>
  </ProtectedRoute>
);

// ==================== REPORTING & AUDIT ROUTES ====================
export function qualityRoutes() {
  return (
    <>
      <Route path="report" element={<Navigate to="/report/overview" replace />} />
      <Route path="report/overview" element={protectedElement("report.module.view", <ReportOverviewView />)} />
      <Route path="report/runs/preview" element={protectedElement("report.module.view", <ReportRunDetailView />)} />
      <Route path="report/analytics" element={protectedElement("report.module.view", <ReportAnalyticsView />)} />
      <Route path="report/templates" element={protectedElement("report.module.view", <ReportTemplatesView />)} />
      <Route path="report/templates/:code/revisions/:revision" element={protectedElement("report.module.view", <ReportTemplateRevisionPage />)} />
      <Route path="report/templates/:code" element={protectedElement("report.module.view", <ReportTemplateDetailPage />)} />
      <Route path="report/templates/:code/run" element={protectedElement("report.module.view", <ReportTemplateRunPage />)} />
      <Route path="report/history" element={protectedElement("report.module.view", <ReportHistoryView />)} />
      <Route path="report/runs/:runId" element={protectedElement("report.module.view", <ReportRunDetailPage />)} />
      <Route path="report/scheduled" element={protectedElement("report.module.view", <ScheduledReportsView />)} />
      <Route path="report/scheduled/new" element={protectedElement("report.module.view", <ScheduleEditorPage />)} />
      <Route path="report/scheduled/:id" element={protectedElement("report.module.view", <ScheduleEditorPage />)} />
      <Route path="report/*" element={<Navigate to="/report/templates" replace />} />
      <Route path="backup-restore" element={<Navigate to="/backup-restore/overview" replace />} />
      <Route path="backup-restore/overview" element={protectedElement("backup.module.view", <BackupOverviewView />)} />
      <Route path="backup-restore/backups" element={protectedElement("backup.module.view", <BackupsView />)} />
      <Route path="backup-restore/restores" element={protectedElement("backup.module.view", <RestoreRequestsView />)} />
      <Route path="backup-restore/restores/new" element={protectedElement("backup.module.view", <RestoreRequestView />)} />
      <Route path="backup-restore/backups/schedules" element={protectedElement("backup.module.view", <BackupSchedulesView />)} />
      <Route path="backup-restore/backups/exports" element={protectedElement("backup.module.view", <BackupExportsView />)} />
      <Route path="backup-restore/backups/verifications" element={protectedElement("backup.module.view", <BackupVerificationResultsView />)} />
      <Route path="backup-restore/restores/:requestId" element={protectedElement("backup.module.view", <RestoreRequestDetailView />)} />
      <Route path="backup-restore/restores/:requestId/execution" element={protectedElement("backup.module.view", <RestoreExecutionView />)} />
      <Route path="backup-restore/restores/verification-reports" element={protectedElement("backup.module.view", <RestoreVerificationReportsView />)} />
      <Route path="backup-restore/restores/history" element={protectedElement("backup.module.view", <RestoreHistoryView />)} />
      <Route path="backup-restore/restores/inspections" element={protectedElement("backup.module.view", <InspectionsView />)} />
      <Route path="backup-restore/alerts" element={protectedElement("backup.admin.alerts.view", <BackupAlertsView />)} />
      <Route path="backup-restore/restore-rules" element={protectedElement("backup.admin.restore_controls.view", <RestoreRulesView />)} />
      <Route path="backup-restore/backups/:backupId" element={protectedElement("backup.module.view", <BackupDetailView />)} />
      <Route path="backup-restore/dr-drills" element={protectedElement("backup.admin.disaster_recovery.view", <DrDrillsView />)} />
      <Route path="backup-restore/*" element={<Navigate to="/backup-restore/overview" replace />} />
      <Route path="audit-trail" element={protectedElement("audittrail.module.view", <AuditTrailView />)} />
      <Route path="audit-trail/:recordId" element={protectedElement("audittrail.module.view", <AuditTrailDetailView />)} />
      <Route path="audit-trail/reviews" element={protectedElement("audit.review.view", <AuditTrailReviewView />)} />
      <Route path="audit-trail/reviews/:id" element={protectedElement("audit.review.view", <AuditTrailReviewCampaignDetailView />)} />
    </>
  );
}
