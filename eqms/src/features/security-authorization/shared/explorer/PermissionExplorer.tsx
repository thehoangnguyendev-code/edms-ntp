import React, { useMemo, useState } from "react";
import { PermissionToolbar, DEFAULT_FILTERS, type PermissionToolbarFilters } from "./PermissionToolbar";
import { PermissionModuleAccordion } from "./PermissionModuleAccordion";
import type { Permission, PermissionGroup } from "../../access-profiles/types";

interface PermissionExplorerProps {
  groups: PermissionGroup[];
  selectedCodes: Set<string>;
  onToggle: (code: string, checked: boolean) => void;
  readOnly?: boolean;
  isLoading?: boolean;
}

export const PermissionExplorer: React.FC<PermissionExplorerProps> = ({
  groups,
  selectedCodes,
  onToggle,
  readOnly = false,
  isLoading = false,
}) => {
  const [filters, setFilters] = useState<PermissionToolbarFilters>(DEFAULT_FILTERS);

  const allPermissions = useMemo(() => groups.flatMap((g) => g.permissions), [groups]);

  // Unique modules in stable order
  const modules = useMemo(
    () => [...new Set(allPermissions.map((p) => p.module).filter(Boolean))],
    [allPermissions]
  );

  // Resources: filtered by active module if set
  const resources = useMemo(() => {
    const source = filters.module
      ? allPermissions.filter((p) => p.module === filters.module)
      : allPermissions;
    return [...new Set(source.map((p) => p.resource).filter(Boolean))];
  }, [allPermissions, filters.module]);

  // Compute which permission IDs pass the filters (null = no filter active)
  const filteredPermissionIds = useMemo((): Set<string> | null => {
    const active =
      filters.search !== "" ||
      filters.module !== "" ||
      filters.resource !== "" ||
      filters.risk !== "ALL" ||
      filters.audit !== "ALL" ||
      filters.esign !== "ALL" ||
      filters.assigned !== "ALL";

    if (!active) return null;

    const q = filters.search.toLowerCase();
    const ids = new Set<string>();

    for (const p of allPermissions) {
      if (filters.module && p.module !== filters.module) continue;
      if (filters.resource && p.resource !== filters.resource) continue;
      if (filters.risk !== "ALL" && p.riskLevel !== filters.risk) continue;
      if (filters.audit === "AUDIT" && !p.requiresAudit) continue;
      if (filters.audit === "NO_AUDIT" && p.requiresAudit) continue;
      if (filters.esign === "ESIGN" && !p.requiresESign) continue;
      if (filters.esign === "NO_ESIGN" && p.requiresESign) continue;
      if (filters.assigned === "ASSIGNED" && !selectedCodes.has(p.id)) continue;
      if (filters.assigned === "UNASSIGNED" && selectedCodes.has(p.id)) continue;
      if (
        q !== "" &&
        !p.label.toLowerCase().includes(q) &&
        !(p.description ?? "").toLowerCase().includes(q) &&
        !p.id.toLowerCase().includes(q) &&
        !p.resource.toLowerCase().includes(q) &&
        !p.action.toLowerCase().includes(q)
      ) continue;

      ids.add(p.id);
    }
    return ids;
  }, [filters, allPermissions, selectedCodes]);

  const filteredCount = filteredPermissionIds ? filteredPermissionIds.size : allPermissions.length;
  const hasActiveFilter = filteredPermissionIds !== null;

  // Group by module
  const moduleMap = useMemo(() => {
    const map = new Map<string, PermissionGroup[]>();
    for (const group of groups) {
      const mod = group.permissions[0]?.module ?? "Other";
      const arr = map.get(mod) ?? [];
      arr.push(group);
      map.set(mod, arr);
    }
    return map;
  }, [groups]);

  const visibleModules = useMemo(() => {
    if (!filteredPermissionIds) return [...moduleMap.keys()];
    return [...moduleMap.keys()].filter((mod) =>
      (moduleMap.get(mod) ?? []).some((g) =>
        g.permissions.some((p) => filteredPermissionIds.has(p.id))
      )
    );
  }, [moduleMap, filteredPermissionIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-400">Loading permissions…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PermissionToolbar
        filters={filters}
        onChange={setFilters}
        modules={modules}
        resources={resources}
        totalCount={allPermissions.length}
        filteredCount={filteredCount}
      />

      {visibleModules.length === 0 ? (
        <div className="rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <p className="text-sm">No permissions match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          {visibleModules.map((mod) => (
            <PermissionModuleAccordion
              key={mod}
              moduleName={mod}
              groups={moduleMap.get(mod) ?? []}
              selectedCodes={selectedCodes}
              onToggle={onToggle}
              readOnly={readOnly}
              defaultOpen={hasActiveFilter}
              filteredPermissionIds={filteredPermissionIds}
            />
          ))}
        </div>
      )}
    </div>
  );
};
