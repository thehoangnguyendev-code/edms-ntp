import React, { Suspense, lazy } from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../routes.constants';
import { LoadingFallback } from './LoadingFallback';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const CourseListView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.CourseListView })));
const MaterialsView = lazy(() => import('@/features/training').then(m => ({ default: m.MaterialsView })));
const MaterialDetailView = lazy(() => import('@/features/training/materials/views/MaterialDetailView').then(m => ({ default: m.MaterialDetailView })));
const MaterialReviewView = lazy(() => import('@/features/training/materials/views/MaterialReviewView').then(m => ({ default: m.MaterialReviewView })));
const MaterialApprovalView = lazy(() => import('@/features/training/materials/views/MaterialApprovalView').then(m => ({ default: m.MaterialApprovalView })));
const UploadMaterialView = lazy(() => import('@/features/training/materials/views/MaterialEditorView').then(m => ({ default: m.UploadMaterialView })));
const EditMaterialView = lazy(() => import('@/features/training/materials/views/MaterialEditorView').then(m => ({ default: m.EditMaterialView })));
const MaterialNewRevisionView = lazy(() => import('@/features/training/materials/views/MaterialRevisionView').then(m => ({ default: m.NewRevisionView })));
const UsageReportView = lazy(() => import('@/features/training/materials/views/UsageReportView').then(m => ({ default: m.UsageReportView })));
const TrainingMatrixView = lazy(() => import('@/features/training').then(m => ({ default: m.TrainingMatrixView })));
const CourseStatusView = lazy(() => import('@/features/training').then(m => ({ default: m.CourseStatusView })));
const AssignTrainingView = lazy(() => import('@/features/training').then(m => ({ default: m.AssignTrainingView })));
const AssignmentRulesView = lazy(() => import('@/features/training').then(m => ({ default: m.AssignmentRulesView })));
const EmployeeTrainingFilesView = lazy(() => import('@/features/training').then(m => ({ default: m.EmployeeTrainingFilesView })));
const EmployeeDossierView = lazy(() => import('@/features/training').then(m => ({ default: m.EmployeeDossierView })));
const ExportRecordsView = lazy(() => import('@/features/training').then(m => ({ default: m.ExportTrainingRecordsView })));
const CreateCourseView = lazy(() => import('@/features/training').then(m => ({ default: m.CreateCourseView })));
const PendingReviewView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.PendingReviewView })));
const PendingApprovalView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.PendingApprovalView })));
const ReviewCourseView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.ReviewCourseView })));
const ApproveCourseView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.ApproveCourseView })));
const ResultEntryView = lazy(() => import('@/features/training').then(m => ({ default: m.ResultEntryView })));
const CourseDetailView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.CourseDetailView })));
const EditCourseView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.EditCourseView })));
const ObsoleteImpactAssessmentView = lazy(() => import('@/features/training/course-inventory/courses').then(m => ({ default: m.ObsoleteImpactAssessmentView })));
const CourseProgressView = lazy(() => import('@/features/training').then(m => ({ default: m.CourseProgressView })));
const MyTrainingView = lazy(() => import('@/features/training').then(m => ({ default: m.MyTrainingView })));

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
      {/* My Training */}
      <Route path="my-training" element={<Suspense fallback={<LoadingFallback />}><MyTrainingView /></Suspense>} />

      {/* Materials */}
      <Route path="materials">
        <Route index element={<Suspense fallback={<LoadingFallback />}><MaterialsView /></Suspense>} />
        <Route path="create" element={guardedTrainingElement("training.material.manage", <UploadMaterialView />)} />
        <Route path=":materialId" element={<Suspense fallback={<LoadingFallback />}><MaterialDetailView /></Suspense>} />
        <Route path=":materialId/edit" element={guardedTrainingElement("training.material.manage", <EditMaterialView />)} />
        <Route path="review/:materialId" element={guardedTrainingElement("training.material.manage", <MaterialReviewView />)} />
        <Route path="approval/:materialId" element={guardedTrainingElement("training.material.manage", <MaterialApprovalView />)} />
        <Route path="new-revision/:materialId" element={guardedTrainingElement("training.material.manage", <MaterialNewRevisionView />)} />
        <Route path="usage-report/:materialId" element={guardedTrainingElement("training.material.manage", <UsageReportView />)} />
      </Route>

      {/* Course Inventory */}
      <Route path="courses-list" element={<Suspense fallback={<LoadingFallback />}><CourseListView /></Suspense>} />
      <Route path="courses/create" element={guardedTrainingElement("training.material.manage", <CreateCourseView />)} />
      <Route path="pending-review" element={<Suspense fallback={<LoadingFallback />}><PendingReviewView /></Suspense>} />
      <Route path="pending-review/:courseId" element={guardedTrainingElement("training.material.manage", <ReviewCourseView />)} />
      <Route path="pending-approval" element={<Suspense fallback={<LoadingFallback />}><PendingApprovalView /></Suspense>} />
      <Route path="pending-approval/:courseId" element={guardedTrainingElement("training.material.manage", <ApproveCourseView />)} />
      <Route path="courses/:courseId" element={<Suspense fallback={<LoadingFallback />}><CourseDetailView /></Suspense>} />
      <Route path="courses/:courseId/edit" element={guardedTrainingElement("training.material.manage", <EditCourseView />)} />
      <Route path="courses/:courseId/impact-assessment" element={guardedTrainingElement("training.material.manage", <ObsoleteImpactAssessmentView />)} />
      <Route path="courses/:courseId/progress" element={guardedTrainingElement("training.session.manage", <CourseProgressView />)} />
      <Route path="courses/:courseId/result-entry" element={guardedTrainingElement("training.session.manage", <ResultEntryView />)} />

      {/* Compliance Tracking */}
      <Route path="training-matrix" element={<Suspense fallback={<LoadingFallback />}><TrainingMatrixView /></Suspense>} />
      <Route path="course-status" element={<Suspense fallback={<LoadingFallback />}><CourseStatusView /></Suspense>} />
      <Route path="assignments" element={<Suspense fallback={<LoadingFallback />}><CourseStatusView /></Suspense>} />
      <Route path="assignments/new" element={guardedTrainingElement("training.assignment.manage", <AssignTrainingView />)} />
      <Route path="assignment-rules" element={guardedTrainingElement("training.assignment.manage", <AssignmentRulesView />)} />

      {/* Records & Archive */}
      <Route path="employee-training-files" element={<Suspense fallback={<LoadingFallback />}><EmployeeTrainingFilesView /></Suspense>} />
      <Route path="employee-training-files/:id" element={<Suspense fallback={<LoadingFallback />}><EmployeeDossierView /></Suspense>} />
      <Route path="export-records" element={guardedTrainingElement("training.session.manage", <ExportRecordsView />)} />

      {/* Default redirect */}
      <Route index element={<Navigate to={ROUTES.TRAINING.COURSES_LIST} replace />} />
    </Route>
  );
}
