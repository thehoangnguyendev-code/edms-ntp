// Email Templates Constants

import { TableColumn, EmailVariable, EmailTemplateType } from "./types";

// Routes
export const EMAIL_TEMPLATES_ROUTES = {
  LIST: "/settings/email-templates",
  CREATE: "/settings/email-templates/create",
  EDIT: (id: string) => `/settings/email-templates/edit/${id}`,
  PREVIEW: (id: string) => `/settings/email-templates/preview/${id}`,
} as const;

// Email Template Types Configuration
export const EMAIL_TEMPLATE_TYPES: Record<EmailTemplateType, { label: string; description: string }> = {
  "password-reset": {
    label: "Password Reset",
    description: "Email sent when users request password reset"
  },
  "user-welcome": {
    label: "User Welcome",
    description: "Welcome email sent to new users"
  },
  "account-activation": {
    label: "Account Activation",
    description: "Email sent to activate new user accounts"
  },
  "document-review": {
    label: "Document Review",
    description: "Notification for document review requests"
  },
  "document-approval": {
    label: "Document Approval",
    description: "Notification for document approval requests"
  },
  "document-publish": {
    label: "Document Publish",
    description: "Notification when a document revision is published"
  },
  "training-notification": {
    label: "Training Notification",
    description: "Notifications related to training assignments"
  },
  "audit-notification": {
    label: "Audit Notification",
    description: "Notifications for audit activities"
  },
  "controlled-copy-notification": {
    label: "Controlled Copy Notification",
    description: "Notifications for controlled copy requests and actions"
  },
  "controlled-copy-distribution-notification": {
    label: "Controlled Copy Distribution Notification",
    description: "Notifications for controlled copy distribution events"
  },
  "controlled-copy-cancellation-notification": {
    label: "Controlled Copy Cancellation Notification",
    description: "Notifications for controlled copy cancellation events"
  },
  "controlled-copy-recall-notification": {
    label: "Controlled Copy Recall Notification",
    description: "Notifications for controlled copy recall events"
  },
  "preference-notification": {
    label: "Preference Notification",
    description: "Notifications when security or preference settings are updated"
  },
  "report-generation": {
    label: "Report Generation",
    description: "Notifications when reports are generated"
  },
  "system-maintenance": {
    label: "System Maintenance",
    description: "System maintenance notifications"
  },
  "custom": {
    label: "Custom Template",
    description: "Custom email template for specific needs"
  }
};

export const getEmailTemplateTypeConfig = (type?: string | null) => {
  const normalizedType = (type || "").trim() as EmailTemplateType;
  return EMAIL_TEMPLATE_TYPES[normalizedType] ?? {
    label: normalizedType ? normalizedType.replace(/-/g, " ") : "Unknown Template",
    description: "Template type",
  };
};

// Available Variables for Email Templates
export const EMAIL_VARIABLES: EmailVariable[] = [
  // User Variables
  { key: "userName", label: "User Name", description: "Full name of the recipient", example: "John Doe", category: "user" },
  { key: "userEmail", label: "User Email", description: "Email address of the recipient", example: "john.doe@company.com", category: "user" },
  { key: "userRole", label: "User Role", description: "Role of the recipient user", example: "QA Manager", category: "user" },
  { key: "userDepartment", label: "User Department", description: "Department of the recipient", example: "Quality Assurance", category: "user" },
  { key: "userPosition", label: "User Position", description: "Position of the recipient", example: "Document Controller", category: "user" },
  { key: "businessUnit", label: "Business Unit", description: "Business unit of the recipient", example: "Manufacturing", category: "user" },
  { key: "employeeCode", label: "Employee ID", description: "Employee ID of the recipient", example: "EMP001", category: "user" },
  { key: "actorName", label: "Actor Name", description: "Name of the user who performed the action", example: "Jane Doe", category: "user" },
  { key: "actorEmail", label: "Actor Email", description: "Email address of the user who performed the action", example: "jane.doe@company.com", category: "user" },
  { key: "actorRole", label: "Actor Role", description: "Role of the user who performed the action", example: "DCO", category: "user" },
  { key: "recipientName", label: "Recipient Name", description: "Display name of the email recipient", example: "John Doe", category: "user" },
  { key: "recipientEmail", label: "Recipient Email", description: "Email address of the email recipient", example: "john.doe@company.com", category: "user" },

  // System Variables
  { key: "systemName", label: "System Name", description: "Name of the EQMS system", example: "Zenith Quality EQMS", category: "system" },
  { key: "companyName", label: "Company Name", description: "Company name", example: "Zenith Quality Solutions", category: "system" },
  { key: "currentDate", label: "Current Date", description: "Current date in readable format", example: "January 15, 2024", category: "date" },
  { key: "currentTime", label: "Current Time", description: "Current time", example: "14:30:00", category: "date" },

  // URL Variables
  { key: "loginUrl", label: "Login URL", description: "URL to login page", example: "https://eqms.company.com/login", category: "url" },
  { key: "resetPasswordUrl", label: "Reset Password URL", description: "URL for password reset", example: "https://eqms.company.com/reset-password?token=abc123", category: "url" },
  { key: "dashboardUrl", label: "Dashboard URL", description: "URL to user dashboard", example: "https://eqms.company.com/dashboard", category: "url" },
  { key: "profileUrl", label: "Profile URL", description: "URL to user profile", example: "https://eqms.company.com/profile", category: "url" },

  // Document Variables
  { key: "documentTitle", label: "Document Title", description: "Title of the document", example: "SOP-001: Quality Management", category: "document" },
  { key: "documentNumber", label: "Document Number", description: "Document number/code", example: "DOC-2024-001", category: "document" },
  { key: "documentVersion", label: "Document Version", description: "Current version of document", example: "1.2", category: "document" },
  { key: "documentUrl", label: "Document URL", description: "URL to view the document", example: "https://eqms.company.com/documents/view/123", category: "document" },
  { key: "documentId", label: "Document ID", description: "Unique identifier of the document", example: "4b7d6d7a-1234-5678-9abc-def012345678", category: "document" },
  { key: "documentStatus", label: "Document Status", description: "Current status of the document", example: "Active", category: "workflow" },
  { key: "documentEffectiveDate", label: "Document Effective Date", description: "Effective date of the document", example: "March 01, 2026", category: "date" },
  { key: "documentValidUntil", label: "Document Valid Until", description: "Document validity end date", example: "March 01, 2027", category: "date" },
  { key: "documentReviewDate", label: "Document Review Date", description: "Scheduled document review date", example: "February 28, 2027", category: "date" },
  { key: "documentAuthorName", label: "Document Author Name", description: "Author of the document", example: "John Doe", category: "user" },
  { key: "documentAuthorEmail", label: "Document Author Email", description: "Email of the document author", example: "john.doe@company.com", category: "user" },
  { key: "documentDepartment", label: "Document Department", description: "Department owning the document", example: "Quality Assurance", category: "document" },
  { key: "documentBusinessUnit", label: "Document Business Unit", description: "Business unit owning the document", example: "Manufacturing", category: "document" },
  { key: "reviewDueDate", label: "Review Due Date", description: "Due date for document review", example: "February 28, 2024", category: "date" },
  { key: "approvalDueDate", label: "Approval Due Date", description: "Due date for document approval", example: "March 15, 2024", category: "date" },
  { key: "revisionNumber", label: "Revision Number", description: "Current revision number", example: "2.0", category: "document" },
  { key: "revisionStatus", label: "Revision Status", description: "Current revision workflow status", example: "Pending Review", category: "workflow" },
  { key: "revisionEffectiveDate", label: "Revision Effective Date", description: "Effective date of the revision", example: "March 01, 2026", category: "date" },
  { key: "revisionValidUntil", label: "Revision Valid Until", description: "Revision validity end date", example: "March 01, 2027", category: "date" },
  { key: "revisionPublishedAt", label: "Revision Published At", description: "When the revision was published", example: "March 01, 2026 14:30", category: "date" },
  { key: "revisionPublishedBy", label: "Revision Published By", description: "Who published the revision", example: "Jane Doe", category: "user" },
  { key: "trainingPlannedDate", label: "Training Planned Date", description: "Planned training date for the revision", example: "March 05, 2026", category: "date" },
  { key: "trainingCompletionDate", label: "Training Completion Date", description: "Actual training completion date", example: "March 06, 2026", category: "date" },
  { key: "trainingDueDate", label: "Training Due Date", description: "Due date for training completion", example: "March 30, 2024", category: "date" },
  { key: "trainingUrl", label: "Training URL", description: "URL to access training", example: "https://eqms.company.com/training/456", category: "url" },

  // Training Variables
  { key: "trainingTitle", label: "Training Title", description: "Title of the training", example: "GMP Training Module 1", category: "document" },
  { key: "workflowAction", label: "Workflow Action", description: "Name of the workflow action performed", example: "Submit for Review", category: "workflow" },
  { key: "workflowComment", label: "Workflow Comment", description: "Comment attached to the workflow action", example: "Reviewed and approved", category: "workflow" },
  { key: "workflowStage", label: "Workflow Stage", description: "Current workflow stage", example: "Pending Approval", category: "workflow" },
  { key: "preferenceSection", label: "Preference Section", description: "Preference section updated", example: "Security Settings", category: "preference" },
  { key: "preferenceName", label: "Preference Name", description: "Specific preference name", example: "Session Timeout", category: "preference" },
  { key: "changeSummary", label: "Change Summary", description: "Summary of preference changes", example: "Session Timeout=30 minutes", category: "preference" },
  { key: "updatedAt", label: "Updated At", description: "Time when the preference was updated", example: "12/06/2026 14:30:00", category: "date" },

  // Audit Variables
  { key: "auditTitle", label: "Audit Title", description: "Title of the audit", example: "Annual Quality Audit 2024", category: "document" },
  { key: "auditDate", label: "Audit Date", description: "Date of the audit", example: "April 10, 2024", category: "date" },
  { key: "auditUrl", label: "Audit URL", description: "URL to audit details", example: "https://eqms.company.com/audits/view/789", category: "url" },

  // Controlled Copy Variables
  { key: "controlledCopyNumber", label: "Controlled Copy Number", description: "Unique controlled copy number", example: "CC-2026-001", category: "document" },
  { key: "copyNumber", label: "Copy Number", description: "Copy sequence number", example: "1", category: "document" },
  { key: "totalCopies", label: "Total Copies", description: "Total number of controlled copies", example: "5", category: "document" },
  { key: "controlledCopyStatus", label: "Controlled Copy Status", description: "Current status of the controlled copy", example: "Distributed", category: "workflow" },
  { key: "controlledCopyUrl", label: "Controlled Copy URL", description: "URL to view the controlled copy", example: "https://eqms.company.com/controlled-copies/123", category: "url" },
  { key: "distributionList", label: "Distribution List", description: "Distribution list for the controlled copy", example: "QM, QA, Production", category: "workflow" },
  { key: "distributionScope", label: "Distribution Scope", description: "Distribution scope of the controlled copy", example: "Internal", category: "workflow" },
  { key: "distributionLocation", label: "Distribution Location", description: "Distribution location of the controlled copy", example: "Warehouse A", category: "workflow" },
  { key: "recipientSignature", label: "Recipient Signature", description: "Recipient signature for controlled copy", example: "John Doe", category: "user" },
  { key: "recipientDate", label: "Recipient Date", description: "Date recipient acknowledged the copy", example: "March 06, 2026", category: "date" },
  { key: "destroyReason", label: "Destroy Reason", description: "Reason for destroying the controlled copy", example: "Damaged copy", category: "workflow" },
  { key: "destructionType", label: "Destruction Type", description: "Type of destruction applied", example: "Damaged", category: "workflow" },
  { key: "destructionMethod", label: "Destruction Method", description: "Method used to destroy the copy", example: "Shredded", category: "workflow" },
  { key: "destroyedAt", label: "Destroyed At", description: "When the controlled copy was destroyed", example: "March 06, 2026 14:30", category: "date" },
  { key: "destroyedBy", label: "Destroyed By", description: "Who destroyed the controlled copy", example: "Jane Doe", category: "user" },
  { key: "witnessName", label: "Witness Name", description: "Witness for destruction", example: "John Doe", category: "user" },
  { key: "recallReason", label: "Recall Reason", description: "Reason for recalling the controlled copy", example: "Superseded", category: "workflow" },

  // Custom Variables (can be extended)
  { key: "customField1", label: "Custom Field 1", description: "Custom variable for specific needs", example: "Custom Value", category: "custom" },
  { key: "customField2", label: "Custom Field 2", description: "Custom variable for specific needs", example: "Custom Value", category: "custom" },
];

// Default table columns configuration
export const DEFAULT_COLUMNS: TableColumn[] = [
  { id: "no", label: "No.", visible: true, order: 0, locked: true },
  { id: "name", label: "Template Name", visible: true, order: 1, locked: true },
  { id: "type", label: "Type", visible: true, order: 2 },
  { id: "subject", label: "Subject", visible: true, order: 3 },
  { id: "status", label: "Status", visible: true, order: 4, locked: true },
  { id: "usageCount", label: "Usage Count", visible: true, order: 5 },
  { id: "lastUsed", label: "Last Used", visible: true, order: 6 },
  { id: "updatedDate", label: "Updated Date", visible: true, order: 7 },
  { id: "createdBy", label: "Created By", visible: true, order: 8 },
];



// File upload configuration for logos
export const LOGO_UPLOAD_CONFIG = {
  maxSize: 2 * 1024 * 1024, // 2MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'],
  maxWidth: 800,
  maxHeight: 600
};
