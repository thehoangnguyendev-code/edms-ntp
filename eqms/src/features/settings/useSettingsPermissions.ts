import { useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";

export const SETTINGS_PERMISSION_CODES = {
  viewUsers: "settings.user.view",
  createUsers: "settings.user.create",
  editUsers: "settings.user.edit",
  deleteUsers: "settings.user.delete",
  resetPasswords: "settings.user.reset_password",
  forceLogoutUsers: "settings.user.force_logout",
  manageRoles: "security.access_profiles.update",
  assignRolePermissions: "security.access_profiles.assign",
  viewConfiguration: "settings.configuration.view",
  editConfiguration: "settings.configuration.edit",
  viewDocumentAdministration: "documents.admin.view",
  manageDocumentWorkflowRoles: "documents.admin.manage_workflow_roles",
  manageDocumentSodConstraints: "security.sod.manage",
} as const;

export function useSettingsPermissions() {
  const {
    user,
    role,
    hasPermission,
    hasPermissionAlias,
    hasAnyPermission,
    hasAllPermissions,
    isAdministrator,
    isSuperAdmin,
  } = usePermissions();

  return useMemo(() => ({
    user,
    role,
    isAdministrator,
    isSuperAdmin,
    hasPermission,
    hasPermissionAlias,
    hasAnyPermission,
    hasAllPermissions,
    canViewUsers: hasPermissionAlias(SETTINGS_PERMISSION_CODES.viewUsers),
    canCreateUsers: hasPermissionAlias(SETTINGS_PERMISSION_CODES.createUsers),
    canEditUsers: hasPermissionAlias(SETTINGS_PERMISSION_CODES.editUsers),
    canDeleteUsers: hasPermissionAlias(SETTINGS_PERMISSION_CODES.deleteUsers),
    canResetPasswords: hasPermissionAlias(SETTINGS_PERMISSION_CODES.resetPasswords),
    canForceLogoutUsers: hasPermissionAlias(SETTINGS_PERMISSION_CODES.forceLogoutUsers),
    canManageRoles: hasPermissionAlias(SETTINGS_PERMISSION_CODES.manageRoles),
    canAssignRolePermissions: hasPermissionAlias(SETTINGS_PERMISSION_CODES.assignRolePermissions),
    canViewConfiguration: hasPermissionAlias(SETTINGS_PERMISSION_CODES.viewConfiguration),
    canEditConfiguration: hasPermissionAlias(SETTINGS_PERMISSION_CODES.editConfiguration),
    canViewDocumentAdministration: hasPermissionAlias(SETTINGS_PERMISSION_CODES.viewDocumentAdministration),
    canManageDocumentWorkflowRoles: hasPermissionAlias(SETTINGS_PERMISSION_CODES.manageDocumentWorkflowRoles),
    canManageDocumentSodConstraints: hasPermissionAlias(SETTINGS_PERMISSION_CODES.manageDocumentSodConstraints),
  }), [
    user,
    role,
    isAdministrator,
    isSuperAdmin,
    hasPermission,
    hasPermissionAlias,
    hasAnyPermission,
    hasAllPermissions,
  ]);
}
