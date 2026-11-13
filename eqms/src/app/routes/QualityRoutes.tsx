import React, { Suspense, lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { LoadingFallback } from './LoadingFallback';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const ReportTemplatesView = lazy(() => import('@/features/report').then(m => ({ default: m.ReportTemplatesView })));
const ReportOverviewView = lazy(() => import('@/features/report-analytics').then(m => ({ default: m.ReportOverviewView })));
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
const BackupSchedulesView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupSchedulesView })));
const ProductionRestoresView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.ProductionRestoresView })));
const BackupDetailView = lazy(() => import('@/features/backup-restore').then(m => ({ default: m.BackupDetailView })));
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
      {/* The approval flow was removed (SDS-BR-003): every old address leads to the one Restore screen. */}
      <Route path="backup-restore/restores" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/restores/new" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/restores/history" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/restores/verification-reports" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/restores/inspections" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/dr-drills" element={<Navigate to="/backup-restore/overview" replace />} />
      <Route path="backup-restore/backups/exports" element={<Navigate to="/backup-restore/backups" replace />} />
      <Route path="backup-restore/backups/verifications" element={<Navigate to="/backup-restore/backups" replace />} />
      <Route path="backup-restore/restores/:requestId" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/restores/:requestId/execution" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/restore-rules" element={<Navigate to="/backup-restore/production-restores" replace />} />
      <Route path="backup-restore/production-restores" element={protectedElement("backup.module.view", <ProductionRestoresView />)} />
      <Route path="backup-restore/backups/schedules" element={protectedElement("backup.module.view", <BackupSchedulesView />)} />
      <Route path="backup-restore/alerts" element={<Navigate to="/settings/administration/backup/alerts" replace />} />
      <Route path="backup-restore/backups/:backupId" element={protectedElement("backup.module.view", <BackupDetailView />)} />
      <Route path="backup-restore/*" element={<Navigate to="/backup-restore/overview" replace />} />
      <Route path="audit-trail" element={protectedElement("audittrail.module.view", <AuditTrailView />)} />
      <Route path="audit-trail/:recordId" element={protectedElement("audittrail.module.view", <AuditTrailDetailView />)} />
      <Route path="audit-trail/reviews" element={protectedElement("audit.review.view", <AuditTrailReviewView />)} />
      <Route path="audit-trail/reviews/:id" element={protectedElement("audit.review.view", <AuditTrailReviewCampaignDetailView />)} />
    </>
  );
}
