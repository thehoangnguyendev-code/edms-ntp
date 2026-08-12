import type { BreadcrumbItem } from "../Breadcrumb";
import { dashboard } from "./shared";
import { ROUTES } from "@/app/routes.constants";

type NavigateFn = (path: string) => void;

// --- Helpers ---

/** Base breadcrumb path for Training Management module */
const trainingBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Training Management" },
];

const trainingComplianceBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  { label: "Compliance Tracking" },
];

const trainingRecordsBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  { label: "Records & Archive" },
];

const trainingMaterialsLabel = { label: "Training Materials" };
const courseInventoryLabel = { label: "Course Inventory" };

const MATERIAL_PARENT_MAP = [
  { key: "tab=pending-review", label: "Pending Review", suffix: "?tab=pending-review" },
  { key: "tab=pending-approval", label: "Pending Approval", suffix: "?tab=pending-approval" },
  { key: "tab=my-materials", label: "My Materials", suffix: "?tab=my-materials" },
];

const getTrainingMaterialParent = (from?: string, navigate?: NavigateFn): BreadcrumbItem => {
  const match = MATERIAL_PARENT_MAP.find(p => from?.includes(p.key));
  if (match) {
    return { label: match.label, onClick: () => navigate?.(`${ROUTES.TRAINING.MATERIALS}${match.suffix}`) };
  }
  return { label: "All Materials", onClick: () => navigate?.(ROUTES.TRAINING.MATERIALS) };
};

const COURSE_PARENT_MAP = [
  { key: "pending-review", label: "Pending Review", route: ROUTES.TRAINING.PENDING_REVIEW },
  { key: ROUTES.TRAINING.PENDING_REVIEW, label: "Pending Review", route: ROUTES.TRAINING.PENDING_REVIEW },
  { key: "pending-approval", label: "Pending Approval", route: ROUTES.TRAINING.PENDING_APPROVAL },
  { key: ROUTES.TRAINING.PENDING_APPROVAL, label: "Pending Approval", route: ROUTES.TRAINING.PENDING_APPROVAL },
];

const getCourseInventoryParent = (from?: string, navigate?: NavigateFn): BreadcrumbItem => {
  const match = COURSE_PARENT_MAP.find(p => from?.includes(p.key) || from === p.key);
  if (match) {
    return { label: match.label, onClick: () => navigate?.(match.route) };
  }
  return { label: "Courses List", onClick: () => navigate?.(ROUTES.TRAINING.COURSES_LIST) };
};

// --- Exported Breadcrumb Builders ---

export const trainingMaterials = (
  navigate?: NavigateFn,
  activeTabLabel?: string
): BreadcrumbItem[] => {
  const isRoot = !activeTabLabel || activeTabLabel === "Overview";
  const displayLabel = isRoot ? "All Materials" : activeTabLabel;
  return [
    ...trainingBase(navigate),
    trainingMaterialsLabel,
    { label: displayLabel, isActive: true },
  ];
};

export const uploadMaterial = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  trainingMaterialsLabel,
  getTrainingMaterialParent(from, navigate),
  { label: "Create Training Material", isActive: true },
];

export const materialDetail = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  trainingMaterialsLabel,
  getTrainingMaterialParent(from, navigate),
  { label: "Material Detail", isActive: true },
];

export const materialEdit = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  trainingMaterialsLabel,
  getTrainingMaterialParent(from, navigate),
  { label: "Edit Training Material", isActive: true },
];

export const materialNewRevision = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  trainingMaterialsLabel,
  getTrainingMaterialParent(from, navigate),
  { label: "Upgrade Material Revision", isActive: true },
];

export const materialUsageReport = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  trainingMaterialsLabel,
  getTrainingMaterialParent(from, navigate),
  { label: "Usage Report", isActive: true },
];

export const materialReview = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  trainingMaterialsLabel,
  getTrainingMaterialParent(from || `${ROUTES.TRAINING.MATERIALS}?tab=pending-review`, navigate),
  { label: "Review Material", isActive: true },
];

export const materialApproval = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  trainingMaterialsLabel,
  getTrainingMaterialParent(from || `${ROUTES.TRAINING.MATERIALS}?tab=pending-approval`, navigate),
  { label: "Approve Material", isActive: true },
];

export const coursesList = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  { label: "Courses List", isActive: true },
];

export const courseDetail = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  getCourseInventoryParent(from, navigate),
  { label: "Course Detail", isActive: true },
];

export const courseDetailFromAssignment = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingComplianceBase(navigate),
  { label: "Training Matrix", onClick: () => navigate?.(ROUTES.TRAINING.TRAINING_MATRIX) },
  { label: "New Training Assignment", onClick: () => navigate?.(ROUTES.TRAINING.ASSIGNMENT_NEW) },
  { label: "Course Detail", isActive: true },
];

export const courseEdit = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  getCourseInventoryParent(from, navigate),
  { label: "Edit Course", isActive: true },
];

export const courseObsoleteImpactAssessment = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  getCourseInventoryParent(from, navigate),
  { label: "Impact Analysis", isActive: true },
];

export const courseCreate = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  getCourseInventoryParent(from, navigate),
  { label: "Create New Course", isActive: true },
];

export const courseProgress = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingComplianceBase(navigate),
  { label: "Course Status", onClick: () => navigate?.(ROUTES.TRAINING.COURSE_STATUS) },
  { label: "Training Progress", isActive: true },
];

export const courseResultEntry = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  { label: "Course Status", onClick: () => navigate?.(ROUTES.TRAINING.COURSE_STATUS) },
  { label: "Result Entry", isActive: true },
];

export const coursePendingApproval = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  { label: "Pending Approval", isActive: true },
];

export const courseApproval = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  getCourseInventoryParent(from || ROUTES.TRAINING.PENDING_APPROVAL, navigate),
  { label: "Approve Course", isActive: true },
];

export const coursePendingReview = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  { label: "Pending Review", isActive: true },
];

export const courseReview = (
  navigate?: NavigateFn,
  from?: string
): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  courseInventoryLabel,
  getCourseInventoryParent(from || ROUTES.TRAINING.PENDING_REVIEW, navigate),
  { label: "Review Course", isActive: true },
];

export const trainingMatrix = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingComplianceBase(navigate),
  { label: "Training Matrix", isActive: true },
];

export const courseStatus = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingComplianceBase(navigate),
  { label: "Course Status", isActive: true },
];

export const employeeTrainingFiles = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingRecordsBase(navigate),
  { label: "Employee Training Files", isActive: true },
];

export const exportRecords = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingRecordsBase(navigate),
  { label: "Export Records", isActive: true },
];

export const employeeDossier = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingRecordsBase(navigate),
  { label: "Employee Training Files", onClick: () => navigate?.(ROUTES.TRAINING.EMPLOYEE_TRAINING_FILES) },
  { label: "Employee Dossier", isActive: true },
];

export const assignTraining = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingComplianceBase(navigate),
  { label: "Training Matrix", onClick: () => navigate?.(ROUTES.TRAINING.TRAINING_MATRIX) },
  { label: "New Training Assignment", isActive: true },
];

export const assignmentRules = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingComplianceBase(navigate),
  { label: "Auto-Assignment Rules", isActive: true },
];

export const myTraining = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...trainingBase(navigate),
  { label: "My Training", isActive: true },
];
