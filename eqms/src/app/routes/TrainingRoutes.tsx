import React, { Suspense, lazy } from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../routes.constants';
import { LoadingFallback } from './LoadingFallback';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const TrainingActivityListView = lazy(() => import('@/features/training-activities/activities/TrainingActivityListView').then(m => ({ default: m.TrainingActivityListView })));
const TrainingSessionWorkspacePage = lazy(() => import('@/features/training-activities/activities/TrainingSessionWorkspacePage').then(m => ({ default: m.TrainingSessionWorkspacePage })));
const TrainingMaterialPreviewPage = lazy(() => import('@/features/training-activities/activities/TrainingMaterialPreviewPage').then(m => ({ default: m.TrainingMaterialPreviewPage })));
const TrainingActivityCreatePage = lazy(() => import('@/features/training-activities/activities/TrainingActivityCreatePage').then(m => ({ default: m.TrainingActivityCreatePage })));
const TrainingActivityDetailPage = lazy(() => import('@/features/training-activities/activities/TrainingActivityDetailPage').then(m => ({ default: m.TrainingActivityDetailPage })));
const TrainingMatrixLandingPage = lazy(() => import('@/features/training-activities/matrices/TrainingMatrixLandingPage').then(m => ({ default: m.TrainingMatrixLandingPage })));
const TrainingMatrixVersionPage = lazy(() => import('@/features/training-activities/matrices/TrainingMatrixVersionPage').then(m => ({ default: m.TrainingMatrixVersionPage })));
const DocumentTrainingsView = lazy(() => import('@/features/training-activities/matrices/DocumentTrainingsView').then(m => ({ default: m.DocumentTrainingsView })));
const TrainingRecordsView = lazy(() => import('@/features/training-activities/records/TrainingRecordsView').then(m => ({ default: m.TrainingRecordsView })));
const TrainingNumberLogView = lazy(() => import('@/features/training-activities/records/TrainingNumberLogView').then(m => ({ default: m.TrainingNumberLogView })));
const TrainingComplianceView = lazy(() => import('@/features/training-activities/compliance/ComplianceView').then(m => ({ default: m.TrainingComplianceView })));
const TrainingJobListView = lazy(() => import('@/features/training-activities/jobs/TrainingJobListView').then(m => ({ default: m.TrainingJobListView })));
const TrainingJobDetailPage = lazy(() => import('@/features/training-activities/jobs/TrainingJobDetailPage').then(m => ({ default: m.TrainingJobDetailPage })));
const PersonnelReviewListView = lazy(() => import('@/features/training-activities/personnel-reviews/PersonnelReviewListView').then(m => ({ default: m.PersonnelReviewListView })));
const PersonnelReviewDetailPage = lazy(() => import('@/features/training-activities/personnel-reviews/PersonnelReviewDetailPage').then(m => ({ default: m.PersonnelReviewDetailPage })));
const TrainingExamPage = lazy(() => import('@/features/training-activities/activities/TrainingExamPage').then(m => ({ default: m.TrainingExamPage })));
const TrainingSpecimenView = lazy(() => import('@/features/training-activities/specimens/TrainingSpecimenView').then(m => ({ default: m.TrainingSpecimenView })));
const TrainingRecordExportsView = lazy(() => import('@/features/training-activities/records/TrainingRecordExportsView').then(m => ({ default: m.TrainingRecordExportsView })));
const TrainingRequirementListView = lazy(() => import('@/features/training-activities/requirements/TrainingRequirementListView').then(m => ({ default: m.TrainingRequirementListView })));
const TrainingRequirementDetailPage = lazy(() => import('@/features/training-activities/requirements/TrainingRequirementDetailPage').then(m => ({ default: m.TrainingRequirementDetailPage })));
const TrainingLegacyEvidenceView = lazy(() => import('@/features/training-activities/records/TrainingLegacyEvidenceView').then(m => ({ default: m.TrainingLegacyEvidenceView })));
const MyTrainingView = lazy(() => import('@/features/training-activities/my-training/MyTrainingView').then(m => ({ default: m.MyTrainingView })));

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
      <Route path="materials/:materialId/preview" element={guardedTrainingElement("training.module.view", <TrainingMaterialPreviewPage />)} />
      <Route path="activities/new" element={guardedTrainingElement("training.activity.organize", <TrainingActivityCreatePage />)} />
      <Route path="activities/:activityId" element={guardedTrainingElement("training.activity.view", <TrainingActivityDetailPage />)} />
      <Route path="activities/:activityId/edit" element={guardedTrainingElement("training.activity.organize", <TrainingActivityDetailPage mode="edit" />)} />
      <Route path="activities/:activityId/sessions/:sessionId/workspace" element={guardedTrainingElement("training.module.view", <TrainingSessionWorkspacePage />)} />
      <Route path="activities/:activityId/conduct" element={guardedTrainingElement("training.module.view", <TrainingActivityDetailPage mode="conduct" />)} />
      <Route path="activities/:activityId/review" element={guardedTrainingElement("training.module.view", <TrainingActivityDetailPage mode="review" />)} />
      <Route path="activities/:activityId/approve" element={guardedTrainingElement("training.module.view", <TrainingActivityDetailPage mode="approve" />)} />
      <Route path="activities/:activityId/confirm" element={guardedTrainingElement("training.activity.close", <TrainingActivityDetailPage mode="confirm" />)} />
      <Route path="activities/:activityId/participate" element={guardedTrainingElement("training.module.view", <TrainingActivityDetailPage mode="participate" />)} />
      <Route path="participations/:participantId/test" element={guardedTrainingElement("training.self.view", <TrainingExamPage />)} />
      <Route path="check-in" element={guardedTrainingElement("training.self.view", <MyTrainingView openCheckIn />)} />
      <Route path="matrix" element={guardedTrainingElement("training.matrix.view", <TrainingMatrixLandingPage />)} />
      <Route path="matrix/:versionId" element={guardedTrainingElement("training.matrix.view", <TrainingMatrixVersionPage />)} />
      <Route path="document-trainings" element={guardedTrainingElement("training.matrix.view", <DocumentTrainingsView />)} />
      <Route path="records" element={guardedTrainingElement("training.record.view", <TrainingRecordsView />)} />
      <Route path="job-assignments" element={guardedTrainingElement("training.job_assignment.view", <TrainingJobListView />)} />
      <Route path="job-assignments/:jobId" element={<Suspense fallback={<LoadingFallback />}><TrainingJobDetailPage /></Suspense>} />
      <Route path="personnel-reviews" element={guardedTrainingElement("training.job_assignment.view", <PersonnelReviewListView />)} />
      <Route path="personnel-reviews/:reviewId" element={<Suspense fallback={<LoadingFallback />}><PersonnelReviewDetailPage /></Suspense>} />
      <Route path="specimen-signatures" element={<Suspense fallback={<LoadingFallback />}><TrainingSpecimenView /></Suspense>} />
      <Route path="record-exports" element={guardedTrainingElement("training.record.export", <TrainingRecordExportsView />)} />
      <Route path="requirements" element={guardedTrainingElement("training.requirement.view", <TrainingRequirementListView />)} />
      <Route path="requirements/:requirementId" element={<Suspense fallback={<LoadingFallback />}><TrainingRequirementDetailPage /></Suspense>} />
      <Route path="requirements/:requirementId/edit" element={<Suspense fallback={<LoadingFallback />}><TrainingRequirementDetailPage mode="edit" /></Suspense>} />
      <Route path="requirements/:requirementId/review" element={<Suspense fallback={<LoadingFallback />}><TrainingRequirementDetailPage mode="review" /></Suspense>} />
      <Route path="requirements/:requirementId/approve" element={<Suspense fallback={<LoadingFallback />}><TrainingRequirementDetailPage mode="approve" /></Suspense>} />
      <Route path="requirements/:requirementId/track" element={<Suspense fallback={<LoadingFallback />}><TrainingRequirementDetailPage mode="track" /></Suspense>} />
      <Route path="legacy-evidence" element={guardedTrainingElement("training.activity.view", <TrainingLegacyEvidenceView />)} />
      <Route path="compliance" element={guardedTrainingElement("training.compliance.view", <TrainingComplianceView />)} />
      <Route path="number-log" element={guardedTrainingElement("training.compliance.view", <TrainingNumberLogView />)} />
      <Route path="my-training" element={guardedTrainingElement("training.self.view", <MyTrainingView />)} />

      {/* Default redirect */}
      <Route index element={<Navigate to={ROUTES.TRAINING.ACTIVITIES} replace />} />
    </Route>
  );
}
