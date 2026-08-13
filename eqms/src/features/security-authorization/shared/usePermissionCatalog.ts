import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { settingsApi, type PermissionCatalogGroup as PermissionCatalogGroupResponse } from "@/services/api/settings";
import { normalizePermissionDescriptor } from "@/features/settings/permissionDisplay";
import type { PermissionAction, PermissionGroup, PermissionRiskLevel } from "./permission-types";

const normalizeAction = (action?: string): PermissionAction => {
  if (!action || !action.trim()) return "access";
  return action.trim().toLowerCase();
};

const normalizeRiskLevel = (riskLevel?: string): PermissionRiskLevel => {
  const normalized = riskLevel?.trim().toUpperCase();
  if (normalized === "CRITICAL" || normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
    return normalized;
  }
  return "LOW";
};

export const mapCatalogGroup = (group: PermissionCatalogGroupResponse): PermissionGroup => ({
  id: group.id,
  name: group.name,
  description: group.description,
  order: group.permissions[0]?.order ?? 0,
  permissions: group.permissions.map((permission) => {
    const normalized = normalizePermissionDescriptor(permission.code, permission.name, permission.description);
    return {
      id: permission.code,
      module: permission.module,
      resource: permission.resource || permission.group || permission.module,
      action: normalizeAction(permission.action),
      label: normalized.label,
      description: normalized.description,
      riskLevel: normalizeRiskLevel(permission.riskLevel),
      requiresAudit: permission.requiresAudit,
      requiresESign: Boolean(permission.requiresESign),
      systemDefined: permission.systemDefined !== false,
      active: permission.active !== false,
    };
  }),
});

export const usePermissionCatalog = (module?: string, search?: string) => {
  const { showToast } = useToast();
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPermissionCatalog = async () => {
      setIsLoading(true);
      try {
        const catalog = await settingsApi.getPermissionCatalog(module, search);
        if (cancelled) return;
        setPermissionGroups(catalog.map(mapCatalogGroup));
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to load permission catalog", error);
        }
        if (!cancelled) {
          setPermissionGroups([]);
          showToast({
            type: "error",
            title: "Unable to load permissions",
            message: "Failed to load access profile permissions from server.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPermissionCatalog();
    return () => {
      cancelled = true;
    };
  }, [module, search, showToast]);

  const totalPermissions = useMemo(
    () => permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0),
    [permissionGroups]
  );

  return {
    permissionGroups,
    totalPermissions,
    isLoading,
  };
};
