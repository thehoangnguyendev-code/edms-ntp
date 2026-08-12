// Course Inventory
export {
  CourseListView,
  CreateCourseView,
  PendingReviewView,
  PendingApprovalView,
  ReviewCourseView,
  ApproveCourseView,
  CourseDetailView,
  EditCourseView,
  ObsoleteImpactAssessmentView,
} from './course-inventory';

// Materials
export {
  MaterialsView,
  MaterialDetailView,
  MaterialReviewView,
  MaterialApprovalView,
  UploadMaterialView,
  EditMaterialView,
  NewRevisionView,
  UsageReportView,
  MarkObsoleteModal,
} from './materials';

// Compliance Tracking
export {
  CourseStatusView,
  TrainingMatrixView,
  ResultEntryView,
  CourseProgressView,
  AssignTrainingView,
  AssignmentRulesView,
} from './compliance-tracking';

// My Training
export { MyTrainingView } from './my-training';

// Records & Archive
export {
  EmployeeTrainingFilesView,
  ExportTrainingRecordsView,
  EmployeeDossierView,
} from './records-archive';

// Types
export * from './types';
