// Audit Trail Types

export type AuditAction =
  | "Create"
  | "Update"
  | "Delete"
  | "Approve"
  | "Reject"
  | "Review"
  | "Publish"
  | "Archive"
  | "Restore"
  | "Login"
  | "Logout"
  | "Export"
  | "Download"
  | "View"
  | "Open"
  | "Preview"
  | "Open Preview"
  | "View Page"
  | "Close Preview"
  | "Upload"
  | "Download Evidence"
  | "Add Working Note"
  | "Delete Working Note"
  | "Assign"
  | "Unassign"
  | "Enable"
  | "Disable";

export type AuditModule =
  | "Document"
  | "Revision"
  | "User"
  | "Role"
  | "CAPA"
  | "Deviation"
  | "Training"
  | "Controlled Copy"
  | "System"
  | "Settings"
  | "Report"
  | "Task"
  | "Notification";

export type AuditSeverity = "Low" | "Medium" | "High" | "Critical";

export interface AuditTrailRecord {
  id: string;
  timestamp: string;
  fullName: string;
  userId: string;
  user?: {
    id: string | null;
    fullName: string | null;
    employeeCode: string | null;
    role: string | null;
    position: string | null;
    department: string | null;
    avatar?: string | null;
  } | null;
  module: AuditModule | string;
  action: AuditAction;
  actionType?: string | null;
  entityId: string;
  entityType?: string | null;
  entityName: string;
  entityLabel?: string;
  objectCode?: string | null;
  description: string;
  changeSummary?: string;
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
  reason?: string;
  ipAddress: string;
  device?: string;
  userAgent?: string | null;
  severity: AuditSeverity;
  signatureId?: string | null;
  electronicSignatureApplied?: boolean;
  metadata?: Record<string, any>;
  progressDurationSeconds?: number | null;
}

export interface AuditTrailDetailRecord extends AuditTrailRecord {
  createdAt?: string | null;
  updatedAt?: string | null;
  username?: string | null;
  actionType?: string | null;
  entityType?: string | null;
  documentNumber?: string | null;
  revisionNumber?: string | null;
  entityStatus?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  userAgent?: string | null;
}

export interface AuditTrailFilters {
  searchQuery: string;
  module: AuditModule | "All";
  action: AuditAction | "All";
  user: string;
  dateFrom: string;
  dateTo: string;
  severity: AuditSeverity | "All";
}
