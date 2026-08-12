// Role & Permission Type Definitions

export type PermissionAction = 
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "archive"
  | "export"
  | "assign"
  | "close"
  | "review"
  | "publish"
  | "upload"
  | "download"
  | "print"
  | "recall"
  | "access"
  | string;

export type PermissionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PermissionCatalogPermission {
  code: string;
  name: string;
  description: string;
  module: string;
  group: string;
  resource?: string;
  action?: PermissionAction;
  riskLevel?: PermissionRiskLevel;
  order: number;
  requiresAudit: boolean;
  requiresESign?: boolean;
  systemDefined?: boolean;
  active?: boolean;
}

export interface PermissionCatalogGroup {
  id: string;
  name: string;
  description: string;
  permissions: PermissionCatalogPermission[];
}

export interface Permission {
  id: string;
  module: string;
  resource: string;
  action: PermissionAction;
  label: string;
  description: string;
  riskLevel: PermissionRiskLevel;
  requiresAudit: boolean; // ALCOA+ compliance - track critical actions
  requiresESign: boolean;
  systemDefined: boolean;
  active: boolean;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  order: number;
}

export interface Role {
  id: string;
  code?: string;
  name: string;
  description: string;
  type: "system" | "custom";
  isActive: boolean;
  userCount: number;
  criticalPermissionCount: number;
  systemProtected: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  deactivationReason?: string | null;
  permissions: string[]; // Permission IDs
  createdDate: string;
  modifiedDate: string;
  color: string; // Badge color
}

export interface AuditLog {
  id: string;
  roleId: string;
  roleName: string;
  action: "created" | "modified" | "deleted" | "permissions_changed";
  changedBy: string;
  changedDate: string;
  changes: {
    field: string;
    oldValue: string | string[];
    newValue: string | string[];
  }[];
  reason: string;
}
