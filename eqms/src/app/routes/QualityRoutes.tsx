import React, { Suspense, lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { LoadingFallback } from './LoadingFallback';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const ReportView = lazy(() => import('@/features/report').then(m => ({ default: m.ReportView })));
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
      <Route path="report" element={<Navigate to="/report/templates" replace />} />
      <Route path="report/:tab" element={protectedElement("report.module.view", <ReportView />)} />
      <Route path="audit-trail" element={protectedElement("audittrail.module.view", <AuditTrailView />)} />
      <Route path="audit-trail/:recordId" element={protectedElement("audittrail.module.view", <AuditTrailDetailView />)} />
      <Route path="audit-trail/reviews" element={protectedElement("audit.review.view", <AuditTrailReviewView />)} />
      <Route path="audit-trail/reviews/:id" element={protectedElement("audit.review.view", <AuditTrailReviewCampaignDetailView />)} />
    </>
  );
}
