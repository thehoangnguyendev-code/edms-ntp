import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { settingsApi } from "@/services/api/settings";
import { mapCatalogGroup } from "../usePermissionCatalog";
import { PermissionResourceGroup } from "./PermissionResourceGroup";
import type { Permission, PermissionGroup } from "../../access-profiles/types";

interface PermissionSplitExplorerProps {
  groups: PermissionGroup[];
  selectedCodes: Set<string>;
  onToggle: (code: string, checked: boolean) => void;
  readOnly?: boolean;
  isLoading?: boolean;
  /** Codes shown checked but not togglable here (granted via an attached shared set). */
  lockedCodes?: Set<string>;
  /** Per-code tooltip explaining the lock, e.g. "Granted by set X". */
  lockedNotes?: Map<string, string>;
  /** Retained for callers; selecting one permission is managed by the parent form. */
  selectionMode?: "single" | "multiple";
}

/**
 * Shared permission picker for Access Profiles, Permission Sets and workflow policies.
 * Modules are the navigation. Selecting a module shows only its permissions, with no
 * repeated resource headers or selected-permission panel competing for screen space.
 */
export const PermissionSplitExplorer: React.FC<
  PermissionSplitExplorerProps
> = ({
  groups,
  selectedCodes,
  onToggle,
  readOnly = false,
  isLoading = false,
  lockedCodes,
  lockedNotes,
}) => {
  const [search, setSearch] = useState("");
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [catalogGroups, setCatalogGroups] = useState<PermissionGroup[]>(groups);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setCatalogGroups(groups);
  }, [groups]);

  useEffect(() => {
    let cancelled = false;
    const loadFilteredCatalog = async () => {
      setIsCatalogLoading(true);
      try {
        const catalog = await settingsApi.getPermissionCatalog(
          undefined,
          debouncedSearch.trim() || undefined,
        );
        if (!cancelled) setCatalogGroups(catalog.map(mapCatalogGroup));
      } catch (error) {
        if (import.meta.env.DEV) console.error("Failed to filter permission catalog", error);
      } finally {
        if (!cancelled) setIsCatalogLoading(false);
      }
    };
    void loadFilteredCatalog();
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const allPermissions = useMemo(() => {
    const seen = new Map<string, Permission>();
    for (const group of groups) {
      for (const permission of group.permissions) {
        if (!seen.has(permission.id)) seen.set(permission.id, permission);
      }
    }
    return [...seen.values()];
  }, [groups]);

  const moduleMap = useMemo(() => {
    const map = new Map<string, PermissionGroup[]>();
    for (const group of catalogGroups) {
      const module = group.permissions[0]?.module ?? "Other";
      map.set(module, [...(map.get(module) ?? []), group]);
    }
    return map;
  }, [catalogGroups]);

  const visibleModules = useMemo(
    () =>
      [...moduleMap.entries()]
        .map(([module, moduleGroups]) => ({
          module,
          groups: moduleGroups,
        }))
        .filter(({ groups: matchingGroups }) => matchingGroups.length > 0),
    [moduleMap],
  );

  useEffect(() => {
    if (visibleModules.length === 0) {
      setActiveModule(null);
    } else if (
      !activeModule ||
      !visibleModules.some(({ module }) => module === activeModule)
    ) {
      setActiveModule(visibleModules[0].module);
    }
  }, [activeModule, visibleModules]);

  const activeModuleGroups = useMemo(
    () =>
      visibleModules.find(({ module }) => module === activeModule)?.groups ??
      [],
    [activeModule, visibleModules],
  );

  // The right-hand panel is intentionally based on the full catalog, not the
  // current module/filter. Administrators must always be able to see what has
  // already been granted and remove a permission without hunting for its module.
  const selectedPermissions = useMemo(() =>
    allPermissions.filter((permission) => selectedCodes.has(permission.id)),
  [allPermissions, selectedCodes]);

  const clearFilters = () => {
    setSearch("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-400">
          Loading permissions…
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3 sm:p-4">
        <div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Search</label>
            <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search permissions by name, code, description…"
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-8 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {isCatalogLoading ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-400">
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          Updating permission results…
        </div>
      ) : visibleModules.length === 0 ? (
        <div className="flex-1 py-12 text-center text-slate-400">
          <p className="text-sm">No permissions match the current filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 text-xs text-emerald-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-col lg:h-[min(56vh,34rem)] lg:flex-row">
          <aside className="border-b border-slate-200 bg-slate-50/60 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="flex gap-1 overflow-x-auto p-2 lg:h-full lg:block lg:space-y-1 lg:overflow-y-auto lg:p-3">
              {visibleModules.map(({ module, groups: moduleGroups }) => {
                const modulePermissions = moduleGroups.flatMap((group) => group.permissions);
                const uniqueModulePermissions = [
                  ...new Map(
                    modulePermissions.map((permission) => [
                      permission.id,
                      permission,
                    ]),
                  ).values(),
                ];
                const selectedCount = uniqueModulePermissions.filter(
                  (permission) => selectedCodes.has(permission.id),
                ).length;
                const isActive = activeModule === module;
                return (
                  <button
                    key={module}
                    type="button"
                    onClick={() => setActiveModule(module)}
                    className={cn(
                      "min-w-fit rounded-lg border px-3 py-2 text-left transition-colors lg:block lg:w-full",
                      isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white",
                    )}
                  >
                    <span className="block truncate text-sm font-semibold">
                      {module}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-xs",
                        isActive ? "text-emerald-600" : "text-slate-400",
                      )}
                    >
                      {selectedCount}/{uniqueModulePermissions.length} selected
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-2 md:p-3">
            {activeModuleGroups.map((group) => (
              <PermissionResourceGroup
                key={group.id}
                group={group}
                selectedCodes={selectedCodes}
                onToggle={onToggle}
                readOnly={readOnly}
                showSelectAll={false}
                hideHeader
                filteredPermissionIds={null}
                lockedCodes={lockedCodes}
                lockedNotes={lockedNotes}
              />
            ))}
          </div>

          <aside className="border-t border-slate-200 bg-slate-50/40 lg:w-72 lg:shrink-0 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
              <span className="text-xs font-semibold text-slate-600">Selected ({selectedPermissions.length})</span>
              {!readOnly && selectedPermissions.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectedPermissions.forEach((permission) => {
                    if (!lockedCodes?.has(permission.id)) onToggle(permission.id, false);
                  })}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Clear editable
                </button>
              )}
            </div>
            <div className="max-h-56 space-y-1.5 overflow-y-auto p-2 lg:h-[calc(100%-42px)] lg:max-h-none">
              {selectedPermissions.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-slate-400">
                  Selected permissions will appear here.
                </p>
              ) : (
                selectedPermissions.map((permission) => {
                  const locked = lockedCodes?.has(permission.id) ?? false;
                  return (
                    <div key={permission.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-emerald-800">{permission.label}</p>
                          <p className="mt-0.5 break-all font-mono text-[10px] leading-tight text-emerald-600">{permission.id}</p>
                          <p className="mt-1 truncate text-[10px] text-slate-500">{permission.module}</p>
                        </div>
                        {!readOnly && !locked && (
                          <button
                            type="button"
                            onClick={() => onToggle(permission.id, false)}
                            className="rounded p-0.5 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800"
                            aria-label={`Remove ${permission.label}`}
                            title="Remove permission"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
