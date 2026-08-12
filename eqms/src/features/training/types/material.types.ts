/**
 * Training Material Types
 *
 * Single source of truth for all Training Material related types.
 * Import from here instead of re-declaring in each view file.
 */

// ─── Status / File Type ───────────────────────────────────────────────────────
export type MaterialStatus =
  | "Draft"
  | "Pending Review"
  | "Pending Approval"
  | "Effective"
  | "Obsoleted"
  | "Closed - Cancelled";

export type MaterialFileType = "Video" | "PDF" | "Image" | "Document";

// ─── Core Entity (used by list view) ─────────────────────────────────────────
export interface TrainingMaterial {
  id: string;
  materialNumber: string;
  title: string;
  description: string;
  type: MaterialFileType;
  version: string;
  department: string;
  businessUnit?: string;
  status: MaterialStatus;
  uploadedAt: string;
  uploadedBy: string;
  fileSize: string;
  fileSizeBytes: number;
  usageCount: number;
  linkedCourses: string[];
  versionHistory?: MaterialVersionEntry[];
  periodicReviewCycle?: number;
  periodicReviewNotification?: number;
  effectiveDate?: string;
  validUntil?: string;
  reviewDate?: string;
}

// ─── Extended Entity (workflow views: Review / Detail / Approval) ─────────────
export interface TrainingMaterialDetail extends TrainingMaterial {
  reviewer: string;
  approver: string;
  reviewedAt?: string;
  approvedAt?: string;
  reviewComment?: string;
  approvalComment?: string;
  externalUrl?: string;
}

/**
 * Workflow-only shape — used by Review / Detail / Approval views.
 * Omits list-only fields (fileSizeBytes, usageCount, linkedCourses).
 * Ready for API mapping: corresponds to a GET /materials/:id response.
 */
export interface TrainingMaterialWorkflow {
  id: string;
  materialNumber: string;
  title: string;
  description: string;
  type: MaterialFileType;
  version: string;
  department: string;
  businessUnit?: string;
  status: MaterialStatus;
  uploadedAt: string;
  uploadedBy: string;
  fileSize: string;
  reviewer: string;
  approver: string;
  reviewedAt?: string;
  approvedAt?: string;
  reviewComment?: string;
  approvalComment?: string;
  externalUrl?: string;
  periodicReviewCycle?: number;
  periodicReviewNotification?: number;
  effectiveDate?: string;
  validUntil?: string;
  reviewDate?: string;
}

// ─── Filter State ─────────────────────────────────────────────────────────────
export interface MaterialFilters {
  searchQuery: string;
  typeFilter: string;
  departmentFilter: string;
  statusFilter: string;
  uploadedByFilter: string;
  dateFrom: string;
  dateTo: string;
}

// ─── Upload / Revision Form Shapes ───────────────────────────────────────────
export type MaterialUploadMode = "file" | "link";

export type MaterialUploadFileStatus = "uploading" | "success" | "error";

export interface MaterialUploadedFile {
  id: string;
  file: File | null;
  name: string;
  size: number;
  progress: number;
  status: MaterialUploadFileStatus;
  type?: string;
}

export interface MaterialWorkflowFormData {
  materialName: string;
  materialNumber: string;
  version: string;
  author: string;
  businessUnit: string;
  department: string;
  reviewer: string;
  approver: string;
  description: string;
  externalUrl: string;
  periodicReviewCycle: number;
  periodicReviewNotification: number;
  effectiveDate: string;
  validUntil: string;
  reviewDate: string;
}

export interface MaterialRevisionFormData extends MaterialWorkflowFormData {
  revisionNotes: string;
}

// ─── Workflow Steps ───────────────────────────────────────────────────────────
export const WORKFLOW_STEPS: MaterialStatus[] = [
  "Draft",
  "Pending Review",
  "Pending Approval",
  "Effective",
  "Obsoleted",
  "Closed - Cancelled",
];

// ─── Version History (Traceability) ───────────────────────────────────────────────────
export interface MaterialVersionEntry {
  version: string;
  status: MaterialStatus;
  // Creation
  uploadedBy: string;
  uploadedAt: string;
  // Review
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  // Approval
  approvedBy?: string;
  approvedAt?: string;
  approvalComment?: string;
  // Content
  revisionNotes?: string;
  fileSize?: string;
  fileUrl?: string;
}
