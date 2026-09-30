import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useTableDragScroll, useDebounce, usePortalDropdown } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { settingsApi, type PermissionCatalogFlatItem, type PermissionLifecycleUsage } from "@/services/api/settings";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

type SortKey = "code" | "name" | "module" | "groupName";

const TABLE_COLS: { id: SortKey | "no" | "audit" | "lifecycle" | "description"; label: string; sortable: boolean }[] = [
  { id: "no", label: "No.", sortable: false },
  { id: "code", label: "Code", sortable: true },
  { id: "name", label: "Name", sortable: true },
  { id: "module", label: "Module", sortable: true },
  { id: "groupName", label: "Group", sortable: true },
  { id: "audit", label: "Audit", sortable: false },
  { id: "lifecycle", label: "Lifecycle", sortable: false },
  { id: "description", label: "Description", sortable: false },
];

const formatLifecycleState = (u: PermissionLifecycleUsage) =>
  `${u.objectTypeLabel} · ${u.fromStatusLabel ?? u.fromStatus ?? "Any state"}`;
// Includes the action -- two entries can share the same object type + status (e.g. distributing a
// single Controlled Copy vs. a Controlled Copy Batch both apply "Ready for Distribution"), so the
// action is what tells them apart and must be visible wherever more than one entry is listed together.
const formatLifecycleUsage = (u: PermissionLifecycleUsage) =>
  `${formatLifecycleState(u)} (${u.actionLabel})`;

const thBase =
  "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group";

/**
 * Server-driven browse of the seeded permission catalog: search/module filter/sort/pagination
 * all resolved by the backend (GET /security/permissions/catalog/paged), matching the pattern
 * used by the other list screens in this feature (PermissionSetsView, ObjectAccessRulesView).
 * No permission creation here -- new permissions require a migration + code review.
 */
export const PermissionCatalogTab: React.FC = () => {
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId: openLifecycleId, position: lifecyclePosition, getRef: getLifecycleRef, toggle: toggleLifecycle, close: closeLifecycle } = usePortalDropdown();

  const [items, setItems] = useState<PermissionCatalogFlatItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [moduleOptions, setModuleOptions] = useState<SelectOption[]>([{ label: "All Modules", value: "ALL" }]);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "code", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Module filter options come from the full (unfiltered) catalog once -- cheap, one-time lookup,
  // independent of the paginated table data below.
  useEffect(() => {
    settingsApi.getPermissionCatalog().then((groups) => {
      const modules = new Set<string>();
      groups.forEach((g) => g.permissions.forEach((p) => p.module && modules.add(p.module)));
      setModuleOptions([{ label: "All Modules", value: "ALL" }, ...Array.from(modules).sort().map((m) => ({ label: m, value: m }))]);
    }).catch(() => setModuleOptions([{ label: "All Modules", value: "ALL" }]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await settingsApi.getPermissionCatalogPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        module: moduleFilter !== "ALL" ? moduleFilter : undefined,
        sortBy: sortConfig.key,
        sortDir: sortConfig.direction,
      });
      setItems(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages || 1);
    } catch {
      setError("Failed to load permission catalog.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, moduleFilter, sortConfig]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, moduleFilter]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
    setCurrentPage(1);
  };

  const hasFilters = !!search || moduleFilter !== "ALL";
  const clearFilters = () => { setSearch(""); setModuleFilter("ALL"); setCurrentPage(1); };

  const isInitialLoading = loading && items.length === 0;
  const isTableLoading = loading && items.length > 0;

  return (
    <div className="flex flex-col flex-1">
      <p className="text-xs sm:text-sm text-slate-500 max-w-3xl mb-4 md:mb-5">
        Seed-managed catalog — every permission grants exactly one action type. New permissions
        require a migration and code review; there is no "create permission" action here.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pb-4 md:pb-5">
        <div className="w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
              <Search className="h-4 w-4 text-slate-400 transition-colors" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, description..."
              className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <Select label="Module" value={moduleFilter} onChange={setModuleFilter} options={moduleOptions} />
        <div className="flex items-end">
          <button
            onClick={clearFilters}
            disabled={!hasFilters}
            className="h-9 px-4 gap-2 font-medium border border-slate-200 rounded-lg text-sm transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        {isInitialLoading ? (
          <div className="py-12"><SectionLoading minHeight="150px" /></div>
        ) : (
          <>
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                {...dragEvents}
              >
                <TableMarkup.Root className="w-full min-w-[1000px]">
                  <TableMarkup.Head className="sticky top-0 z-30">
                    <TableMarkup.Row>
                      {TABLE_COLS.map((col) => {
                        const isSorted = col.sortable && sortConfig.key === col.id;
                        return (
                          <TableMarkup.HeaderCell
                            key={col.id}
                            onClick={col.sortable ? () => handleSort(col.id as SortKey) : undefined}
                            className={cn(thBase, col.sortable && "cursor-pointer hover:bg-slate-100 hover:text-slate-700", col.id === "no" && "w-14 text-center")}
                          >
                            <div className="flex items-center gap-2">
                              <span>{col.label}</span>
                              {col.sortable && (
                                <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                                  <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600" : "")} />
                                  <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600" : "")} />
                                </div>
                              )}
                            </div>
                          </TableMarkup.HeaderCell>
                        );
                      })}
                    </TableMarkup.Row>
                  </TableMarkup.Head>
                  <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                    {!loading && items.length === 0 ? (
                      <TableMarkup.Row>
                        <TableMarkup.Cell colSpan={TABLE_COLS.length} className="p-0">
                          {error ? (
                            <TableEmptyState title="Failed to Load" description={error} />
                          ) : (
                            <TableEmptyState
                             
                              title="No Permissions Found"
                              description={hasFilters ? "Try adjusting your search or filters." : "No permissions match this filter."}
                            />
                          )}
                        </TableMarkup.Cell>
                      </TableMarkup.Row>
                    ) : (
                      items.map((p, idx) => (
                        <TableMarkup.Row key={p.code} className="hover:bg-slate-50/80 transition-colors">
                          <TableMarkup.Cell className="py-3 px-4 align-middle text-center text-xs text-slate-500 whitespace-nowrap">{(currentPage - 1) * itemsPerPage + idx + 1}</TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 align-middle whitespace-nowrap">
                            <span className="text-xs sm:text-sm font-medium text-slate-800">{p.code}</span>
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 align-middle text-xs sm:text-sm text-slate-700 whitespace-nowrap">{p.name}</TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 align-middle whitespace-nowrap">
                            <Badge semantic="info" size="sm">{p.module}</Badge>
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className={TABLE_STYLES.cell23}>{p.groupName}</TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 align-middle whitespace-nowrap">
                            {p.requiresAudit ? (
                              <Badge semantic="warning" size="sm">Audited</Badge>
                            ) : (
                              <span className="text-sm text-slate-300">—</span>
                            )}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 align-middle whitespace-nowrap">
                            {p.lifecycleUsages && p.lifecycleUsages.length > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <Badge semantic="info" size="sm" title={formatLifecycleUsage(p.lifecycleUsages[0])}>
                                  {formatLifecycleState(p.lifecycleUsages[0])}
                                </Badge>
                                {p.lifecycleUsages.length > 1 && (
                                  <button
                                    ref={getLifecycleRef(p.code)}
                                    type="button"
                                    onClick={(e) => toggleLifecycle(p.code, e, { menuHeight: Math.min(40 + p.lifecycleUsages!.length * 24, 280), menuWidth: 260 })}
                                    className="text-2xs text-slate-400 hover:text-emerald-600 hover:underline transition-colors"
                                  >
                                    +{p.lifecycleUsages.length - 1} more
                                  </button>
                                )}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-300">—</span>
                            )}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className={TABLE_STYLES.cell23}>
                            {p.description || "—"}
                          </TableMarkup.Cell>
                        </TableMarkup.Row>
                      ))
                    )}
                  </TableMarkup.Body>
                </TableMarkup.Root>
              </div>
              {totalItems > 0 && (
                <div className="border-t border-slate-200">
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    isLoading={isTableLoading}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {openLifecycleId && (() => {
        const activeItem = items.find((p) => p.code === openLifecycleId);
        const usages: PermissionLifecycleUsage[] = activeItem?.lifecycleUsages ?? [];
        return createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={closeLifecycle} />
            <div
              className="fixed z-50 w-[260px] max-h-[280px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1.5"
              style={lifecyclePosition.style}
            >
              {usages.map((u, i) => (
                <div key={i} className="px-3 py-1.5 text-xs text-slate-600">
                  {formatLifecycleUsage(u)}
                </div>
              ))}
            </div>
          </>,
          document.body
        );
      })()}
    </div>
  );
};
