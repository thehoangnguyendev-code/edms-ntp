import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { resolvePermissionAliasCodes } from '@/features/settings/permissionCatalog';

export function usePermissions() {
  const { user } = useAuth();
  // Display metadata only. Authorization decisions in this hook are exclusively
  // permission-based; never branch on this value.
  const role = user?.role ?? '';

  const permissions = useMemo(
    () => (user?.permissions ?? []).filter((value): value is string => Boolean(value)),
    [user?.permissions]
  );

  const normalized = useMemo(
    () => new Set(permissions.map((value) => value.trim().toUpperCase())),
    [permissions]
  );

  const hasWildcardPermission = normalized.has('*');
  const isSuperAdmin = hasWildcardPermission || normalized.has('SYSTEM_SUPER_ADMIN');

  // GMP Segregation of Duties: SuperAdmin is not an implicit permission grant here — it only
  // has whatever permission codes the backend actually resolved for it (see
  // V243__seed_system_super_admin_permission_set.sql). `isSuperAdmin` is kept as a UI-only flag
  // (badges, admin diagnostics), not a bypass for these checks.
  const hasPermission = (permissionCode: string) => {
    if (!permissionCode) return false;
    return normalized.has(permissionCode.trim().toUpperCase());
  };

  const hasPermissionAlias = (permissionCode: string) => {
    if (!permissionCode) return false;
    return resolvePermissionAliasCodes(permissionCode).some((code) => normalized.has(code.trim().toUpperCase()));
  };

  const hasAnyPermission = (permissionCodes: string[]) => {
    return permissionCodes.some((permissionCode) => hasPermissionAlias(permissionCode));
  };

  const hasAllPermissions = (permissionCodes: string[]) => {
    return permissionCodes.every((permissionCode) => hasPermissionAlias(permissionCode));
  };

  const isAdministrator = hasAnyPermission([
    'settings.user.view',
    'settings.user.edit',
    'settings.configuration.edit',
    'security.access_profiles.view',
    'security.access_profiles.update',
    'security.permission_sets.view',
    'security.permission_sets.update',
    'security.workflow_authorization.view',
    'security.workflow_authorization.manage',
  ]);

  return {
    user,
    role,
    permissions,
    hasPermission,
    hasPermissionAlias,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    isAdministrator,
  };
}
