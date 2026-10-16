import React, { Suspense, lazy } from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../routes.constants';
import { LoadingFallback } from './LoadingFallback';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const TrainingActivityListView = lazy(() => import('@/features/training-activities/TrainingActivityListView').then(m => ({ default: m.TrainingActivityListView })));
const TrainingActivityDetailPage = lazy(() => import('@/features/training-activities/TrainingActivityDetailPage').then(m => ({ default: m.TrainingActivityDetailPage })));
const TrainingMatrixListView = lazy(() => import('@/features/training-activities/TrainingMatrixListView').then(m => ({ default: m.TrainingMatrixListView })));
const TrainingMatrixVersionPage = lazy(() => import('@/features/training-activities/TrainingMatrixVersionPage').then(m => ({ default: m.TrainingMatrixVersionPage })));
const TrainingMatrixHistoryView = lazy(() => import('@/features/training-activities/TrainingMatrixHistoryView').then(m => ({ default: m.TrainingMatrixHistoryView })));
const TrainingRecordsView = lazy(() => import('@/features/training-activities/TrainingRecordsView').then(m => ({ default: m.TrainingRecordsView })));
const TrainingNumberLogView = lazy(() => import('@/features/training-activities/TrainingNumberLogView').then(m => ({ default: m.TrainingNumberLogView })));
const TrainingComplianceView = lazy(() => import('@/features/training-activities/TrainingComplianceView').then(m => ({ default: m.TrainingComplianceView })));
const TrainingJobListView = lazy(() => import('@/features/training-activities/TrainingJobListView').then(m => ({ default: m.TrainingJobListView })));
const TrainingJobDetailPage = lazy(() => import('@/features/training-activities/TrainingJobDetailPage').then(m => ({ default: m.TrainingJobDetailPage })));
const TrainingSpecimenView = lazy(() => import('@/features/training-activities/TrainingSpecimenView').then(m => ({ default: m.TrainingSpecimenView })));
const TrainingRecordExportsView = lazy(() => import('@/features/training-activities/TrainingRecordExportsView').then(m => ({ default: m.TrainingRecordExportsView })));
const TrainingRequirementListView = lazy(() => import('@/features/training-activities/TrainingRequirementListView').then(m => ({ default: m.TrainingRequirementListView })));
const TrainingRequirementDetailPage = lazy(() => import('@/features/training-activities/TrainingRequirementDetailPage').then(m => ({ default: m.TrainingRequirementDetailPage })));
const TrainingLegacyEvidenceView = lazy(() => import('@/features/training-activities/TrainingLegacyEvidenceView').then(m => ({ default: m.TrainingLegacyEvidenceView })));
const MyTrainingView = lazy(() => import('@/features/training-activities/TrainingMyTrainingView').then(m => ({ default: m.TrainingMyTrainingView })));

const guardedTrainingElement = (permission: string, element: React.ReactNode) => (
  <ProtectedRoute requiredPermissions={[permission]}>
    <Suspense fallback={<LoadingFallback />}>{element}</Suspense>
  </ProtectedRoute>
);

// ==================== TRAINING ROUTES ====================
export function trainingRoutes() {
  return (
    <Route
      path="training-management"
      element={
        <ProtectedRoute requiredPermissions={["training.module.view"]}>
          <Outlet />
        </ProtectedRoute>
      }
    >
      <Route path="activities" element={guardedTrainingElement("training.activity.view", <TrainingActivityListView />)} />
      <Route path="activities/:activityId" element={guardedTrainingElement("training.activity.view", <TrainingActivityDetailPage />)} />
      <Route path="matrices" element={guardedTrainingElement("training.matrix.view", <TrainingMatrixListView />)} />
      <Route path="matrices/:matrixId" element={guardedTrainingElement("training.matrix.view", <TrainingMatrixHistoryView />)} />
      <Route path="matrix-versions/:versionId" element={guardedTrainingElement("training.matrix.view", <TrainingMatrixVersionPage />)} />
      <Route path="records" element={guardedTrainingElement("training.record.view", <TrainingRecordsView />)} />
      <Route path="job-assignments" element={guardedTrainingElement("training.job_assignment.view", <TrainingJobListView />)} />
      <Route path="job-assignments/:jobId" element={<Suspense fallback={<LoadingFallback />}><TrainingJobDetailPage /></Suspense>} />
      <Route path="specimen-signatures" element={<Suspense fallback={<LoadingFallback />}><TrainingSpecimenView /></Suspense>} />
      <Route path="record-exports" element={guardedTrainingElement("training.record.export", <TrainingRecordExportsView />)} />
      <Route path="requirements" element={guardedTrainingElement("training.requirement.view", <TrainingRequirementListView />)} />
      <Route path="requirements/:requirementId" element={<Suspense fallback={<LoadingFallback />}><TrainingRequirementDetailPage /></Suspense>} />
      <Route path="legacy-evidence" element={guardedTrainingElement("training.activity.view", <TrainingLegacyEvidenceView />)} />
      <Route path="compliance" element={guardedTrainingElement("training.compliance.view", <TrainingComplianceView />)} />
      <Route path="number-log" element={guardedTrainingElement("training.compliance.view", <TrainingNumberLogView />)} />
      <Route path="my-training" element={guardedTrainingElement("training.self.view", <MyTrainingView />)} />

      {/* Default redirect */}
      <Route index element={<Navigate to={ROUTES.TRAINING.ACTIVITIES} replace />} />
    </Route>
  );
}
