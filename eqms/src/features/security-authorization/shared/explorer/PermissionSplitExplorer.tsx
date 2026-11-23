import React, { useEffect, useMemo, useState } from "react";
import { Check, LayoutGrid, List, Lock, Search, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { settingsApi } from "@/services/api/settings";
import { mapCatalogGroup } from "../usePermissionCatalog";
import type { Permission, PermissionGroup } from "../../access-profiles/types";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { MENU_MODULE_ORDER, moduleDisplayName, moduleOrderFromMenu, sortModulesLikeMenu } from "@/utils/moduleDisplay";
import { navigationApi } from "@/services/api/navigation";
import { TabNav, type TabItem } from "@/components/ui/tabs";
import { PermissionTableView } from "./PermissionTableView";
import { Reveal } from "./Reveal";
import { tr } from "@/i18n";

/** The choice between the cards and the table is a preference of the person, kept in this browser (nothing depends on it, so a refused storage is ignored). */
const VIEW_STORAGE_KEY = "eqms.permission-explorer.view";
const VIEW_TABS: TabItem[] = [{ id: "cards", label: "Cards", icon: LayoutGrid }, { id: "table", label: "Table", icon: List }];
type ExplorerView = "cards" | "table";
const readView = (): ExplorerView => {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
};

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
  /** Read-only details: list only the permissions that are selected, without tick boxes or the "Selected" panel. */
  selectedOnly?: boolean;
  /**
   * Something shown at the top of the permissions of a module, under the chips (the record-visibility choice of the module). Called with the name of the module
   * the person has open, and only once the profile holds at least one permission of it; the caller returns nothing for a module that has no such choice.
   */
  moduleExtras?: (moduleName: string) => React.ReactNode;
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
  selectedOnly = false,
  moduleExtras,
}) => {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ExplorerView>(readView);
  const chooseView = (next: string) => {
    const value: ExplorerView = next === "table" ? "table" : "cards";
    setView(value);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, value);
    } catch {
      // the choice then lasts only for this page
    }
  };
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [catalogGroups, setCatalogGroups] = useState<PermissionGroup[]>(groups);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setCatalogGroups(groups);
  }, [groups]);

  // The module chips follow the order of the sidebar menu (services/api/navigation.ts); the built-in order is used until the menu answers or if it cannot.
  const [menuOrder, setMenuOrder] = useState<readonly string[]>(MENU_MODULE_ORDER);
  useEffect(() => {
    let cancelled = false;
    navigationApi.getNavigation().then((menu) => {
      const fromMenu = moduleOrderFromMenu(menu);
      if (!cancelled && fromMenu.length > 0) setMenuOrder(fromMenu);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

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

  // Details show only what is granted; the editor shows the whole catalog.
  const shownGroups = useMemo(
    () =>
      selectedOnly
        ? catalogGroups
            .map((group) => ({ ...group, permissions: group.permissions.filter((permission) => selectedCodes.has(permission.id)) }))
            .filter((group) => group.permissions.length > 0)
        : catalogGroups,
    [catalogGroups, selectedOnly, selectedCodes],
  );

  const moduleMap = useMemo(() => {
    const map = new Map<string, PermissionGroup[]>();
    for (const group of shownGroups) {
      // One entry per menu a person knows (the server keeps one key per menu since V836; the display name still merges any older spelling).
      const module = moduleDisplayName(group.permissions[0]?.module);
      map.set(module, [...(map.get(module) ?? []), group]);
    }
    return map;
  }, [shownGroups]);

  const visibleModules = useMemo(
    () =>
      sortModulesLikeMenu(
        [...moduleMap.entries()]
          .map(([module, moduleGroups]) => ({
            module,
            groups: moduleGroups,
          }))
          .filter(({ groups: matchingGroups }) => matchingGroups.length > 0),
        (entry) => entry.module,
        menuOrder,
      ),
    [moduleMap, menuOrder],
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

  // The right-hand panel is intentionally based on the full catalog, not the
  // current module/filter. Administrators must always be able to see what has
  // already been granted and remove a permission without hunting for its module.
  const selectedPermissions = useMemo(() =>
    allPermissions.filter((permission) => selectedCodes.has(permission.id)),
  [allPermissions, selectedCodes]);

  const clearFilters = () => {
    setSearch("");
  };

  const entries = visibleModules.map(({ module, groups: moduleGroups }) => {
    const permissions = [...new Map(moduleGroups.flatMap((group) => group.permissions).map((permission) => [permission.id, permission])).values()];
    return { module, groups: moduleGroups, permissions, selected: permissions.filter((permission) => selectedCodes.has(permission.id)).length };
  });
  const activeEntry = entries.find((entry) => entry.module === activeModule) ?? entries[0];
  const extras = moduleExtras && activeEntry && activeEntry.selected > 0 ? moduleExtras(activeEntry.module) : null;
  const countLabel = (entry: { permissions: Permission[]; selected: number }) =>
    selectedOnly ? `${entry.permissions.length} granted` : `${entry.selected}/${entry.permissions.length}`;
  const isLocked = (code: string) => lockedCodes?.has(code) ?? false;
  const clearEditable = () => selectedPermissions.forEach((permission) => { if (!isLocked(permission.id)) onToggle(permission.id, false); });
  const scrollBox = "max-h-[min(56vh,34rem)] overflow-y-auto";

  // Module pills across the top, permissions as tap-to-select cards, a count bar at the bottom
  const body = (
    <div className="flex flex-col">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 sm:p-4">
        {entries.map((entry) => (
          <button
            key={entry.module}
            type="button"
            onClick={() => setActiveModule(entry.module)}
            className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors", activeEntry?.module === entry.module ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}
          >
            {entry.module}
            <span className={cn("rounded-full px-1.5 text-2xs", entry.selected > 0 && !selectedOnly ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{countLabel(entry)}</span>
          </button>
        ))}
      </div>
      {/* The extras of a module (its record-visibility choice) slide in and out; a module without extras leaves no space at all. */}
      <Reveal show={extras != null}>
        <div className="border-b border-slate-200 p-3 sm:p-4">{extras}</div>
      </Reveal>
      {view === "table" ? (
        <div className={scrollBox}>
          <PermissionTableView
            permissions={activeEntry?.permissions ?? []}
            selectedCodes={selectedCodes}
            onToggle={onToggle}
            disabled={readOnly || selectedOnly}
            showTick={!selectedOnly}
            isLocked={isLocked}
            lockedNotes={lockedNotes}
          />
        </div>
      ) : (
      <div className={cn(scrollBox, "grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-3")}>
        {(activeEntry?.permissions ?? []).map((permission) => {
          const checked = selectedCodes.has(permission.id);
          const locked = isLocked(permission.id);
          return (
            <button
              key={permission.id}
              type="button"
              disabled={readOnly || locked || selectedOnly}
              aria-pressed={checked}
              onClick={() => onToggle(permission.id, !checked)}
              title={locked ? lockedNotes?.get(permission.id) : permission.id}
              className={cn("flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-default", checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300")}
            >
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white")}>
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  <span className="min-w-0 break-words">{permission.label}</span>
                  {locked && <Lock className="h-3 w-3 shrink-0 text-slate-400" />}
                </span>
                <span className="block break-all text-2xs text-slate-500 sm:text-xs">{permission.id}</span>
                {permission.description && <span className="mt-1 line-clamp-2 block text-xs text-slate-600">{permission.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      )}
      {!selectedOnly && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
          <span className="text-sm font-medium text-slate-700">{selectedPermissions.length} {tr("selected")}</span>
          {!readOnly && selectedPermissions.length > 0 && <button type="button" onClick={clearEditable} className="text-xs font-medium text-rose-600 hover:text-rose-700">{tr("Clear editable")}</button>}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-400">
          {tr("Loading permissions…")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3 sm:p-4">
        <div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm capitalize">{tr("Search")}</label>
            <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr("Search permissions by name, code, description…")}
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-8 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={tr("Clear search")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            </div>
            <TabNav tabs={VIEW_TABS} activeTab={view} onChange={chooseView} variant="pill" ariaLabel="How the permissions are shown" className="!w-auto" />
            </div>
          </div>
        </div>
      </div>

      {isCatalogLoading ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-400">
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          {tr("Updating permission results…")}
        </div>
      ) : visibleModules.length === 0 ? (
        <div className="flex-1 py-12 text-center text-slate-400">
          <p className="text-sm">{selectedOnly && !search.trim() ? "No permissions are granted." : "No permissions match the current filters."}</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 text-xs text-emerald-600 hover:underline"
          >
            {tr("Clear filters")}
          </button>
        </div>
      ) : (
        body
      )}
    </div>
  );
};
