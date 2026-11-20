import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Eye, Search, X } from "lucide-react";
import { IconFilter2, IconReportSearch } from "@tabler/icons-react";
import { openPermissionHoldersReport } from "./openPermissionHoldersReport";
import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { accessExplorer } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useDebounce, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { settingsApi } from "@/services/api";
import type { AccessExplorerPermissionRow } from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { moduleLabel } from "./accessExplorerLabels";
import { moduleSelectOptions } from "@/utils/moduleDisplay";

type SortKey = "name" | "code" | "module" | "permissionSetCount" | "accessProfileCount" | "holderCount";
const SORT_KEYS: SortKey[] = ["name", "code", "module", "permissionSetCount", "accessProfileCount", "holderCount"];
const HELD_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Held by someone", value: "held" },
  { label: "Held by nobody", value: "none" },
];

/**
 * Access Explorer: the list of every permission and how widely it is held (permission sets, access profiles, people). Open one to see who holds it and through what. It reads the
 * chain the system itself uses to decide, so the answer is what is enforced. Read only; search, filter, sort and paging are done by the server.
 */
export const AccessExplorerView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const [rows, setRows] = useState<AccessExplorerPermissionRow[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1));
  const [itemsPerPage, setItemsPerPage] = useState(() => Math.max(1, Number(searchParams.get("limit")) || 10));
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("search") ?? "");
  const [moduleFilter, setModuleFilter] = useState(() => searchParams.get("module") ?? "ALL");
  const [heldFilter, setHeldFilter] = useState(() => searchParams.get("held") ?? "all");
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["module", "held"]));
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>(() => {
    const sortKey = searchParams.get("sortBy");
    return { key: SORT_KEYS.includes(sortKey as SortKey) ? (sortKey as SortKey) : "name", direction: searchParams.get("sortDir") === "desc" ? "desc" : "asc" };
  });

  React.useLayoutEffect(() => {
    setSearchQuery(searchParams.get("search") ?? "");
    setModuleFilter(searchParams.get("module") ?? "ALL");
    setHeldFilter(searchParams.get("held") ?? "all");
    setCurrentPage(Math.max(1, Number(searchParams.get("page")) || 1));
    setItemsPerPage(Math.max(1, Number(searchParams.get("limit")) || 10));
    const sortKey = searchParams.get("sortBy");
    setSortConfig({ key: SORT_KEYS.includes(sortKey as SortKey) ? (sortKey as SortKey) : "name", direction: searchParams.get("sortDir") === "desc" ? "desc" : "asc" });
  }, [searchParams]);

  useEffect(() => {
    if (searchQuery !== debouncedSearch) return;
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (moduleFilter !== "ALL") params.set("module", moduleFilter);
    if (heldFilter !== "all") params.set("held", heldFilter);
    if (sortConfig.key !== "name") params.set("sortBy", sortConfig.key);
    if (sortConfig.direction !== "asc") params.set("sortDir", sortConfig.direction);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (itemsPerPage !== 10) params.set("limit", String(itemsPerPage));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [searchQuery, debouncedSearch, moduleFilter, heldFilter, sortConfig, currentPage, itemsPerPage, searchParams, setSearchParams]);

  useEffect(() => {
    settingsApi.getAccessExplorerModules().then(setModules).catch(() => setModules([]));
  }, []);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await settingsApi.listAccessExplorerPermissions({
        page: currentPage - 1,
        size: itemsPerPage,
        search: debouncedSearch || undefined,
        module: moduleFilter !== "ALL" ? moduleFilter : undefined,
        held: heldFilter !== "all" ? heldFilter : undefined,
        sortBy: sortConfig.key,
        sortDir: sortConfig.direction,
      });
      setRows(res.content ?? []);
      setTotalItems(res.totalElements ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: "Failed to load permissions" });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, moduleFilter, heldFilter, sortConfig, showToast]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const hasFilters = !!searchQuery || moduleFilter !== "ALL" || heldFilter !== "all";
  const clearFilters = () => { setSearchQuery(""); setModuleFilter("ALL"); setHeldFilter("all"); setCurrentPage(1); };
  const toggleSection = (id: string) => setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const handleSort = (key: SortKey) => {
    setCurrentPage(1);
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };
  const sortOf = (key: SortKey) => ({ direction: sortConfig.key === key ? sortConfig.direction : undefined, onSort: () => handleSort(key) });
  const open = (row: AccessExplorerPermissionRow) => navigateTo(ROUTES.SECURITY.ACCESS_EXPLORER_DETAIL(row.code));

  const moduleOptions = [{ label: "All", value: "ALL" }, ...moduleSelectOptions(modules)];

  const columns: DataTableColumn<AccessExplorerPermissionRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: "w-14 text-center", cellClassName: "text-center", cell: (_row, idx) => (currentPage - 1) * itemsPerPage + idx + 1 },
    {
      id: "name",
      header: "Permission",
      label: "Permission",
      sort: sortOf("name"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{row.name}</p>
          <p className="font-mono text-2xs text-slate-500">{row.code}</p>
        </div>
      ),
    },
    { id: "module", header: "Module", label: "Module", sort: sortOf("module"), cell: (row) => moduleLabel(row.moduleKey) },
    { id: "permissionSetCount", header: "Sets", label: "Permission Sets", sort: sortOf("permissionSetCount"), cell: (row) => row.permissionSetCount },
    { id: "accessProfileCount", header: "Profiles", label: "Access Profiles", sort: sortOf("accessProfileCount"), cell: (row) => row.accessProfileCount },
    {
      id: "holderCount",
      header: "People",
      label: "People",
      sort: sortOf("holderCount"),
      cell: (row) => (row.holderCount === 0
        ? <Badge color="amber" size="sm" pill>Nobody</Badge>
        : (
          <div>
            <span className="text-sm font-medium text-slate-800">{row.holderCount}</span>
            <span className="block text-2xs text-slate-500">{row.activeHolderCount} with an Active account</span>
          </div>
        )),
    },
  ];
  const action: DataTableAction<AccessExplorerPermissionRow> = {
    header: "Action",
    cell: (row) => (
      <button type="button" onClick={(e) => { e.stopPropagation(); open(row); }} className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 sm:h-8 sm:w-8" aria-label={`View details of ${row.name}`}>
        <Eye className="h-3.5 w-3.5 text-slate-600 sm:h-4 sm:w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout("access-explorer.list", columns, action);

  const isInitialLoading = isLoading && rows.length === 0;
  const isTableLoading = isLoading && rows.length > 0;

  const optionButtons = (options: { label: string; value: string }[], value: string, onPick: (v: string) => void) => (
    <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => { onPick(opt.value); setCurrentPage(1); }}
          className={cn("flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all", value === opt.value ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50" : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300")}
        >
          <span className="text-xs">{opt.label}</span>
          {value === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {(isNavigating || isInitialLoading) && <FullPageLoading text="Loading…" />}

      <PageHeader
        title="Access Explorer"
        breadcrumbItems={accessExplorer(navigate)}
        actions={
          <Button
            variant="default"
            size="sm"
            className="whitespace-nowrap gap-2"
            onClick={() => void openPermissionHoldersReport(navigate, showToast)}
            title="Create a report of the type Permission Holders: the run is authorized, audited and kept like every other report"
          >
            <IconReportSearch className="h-4 w-4" />
            Permission Holders Report
          </Button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {/* Filters — mobile: search + drawer button */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search permissions…"
                className="w-full pl-9 pr-8 h-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Filters — desktop */}
          <ConfiguredDesktopFilters
            trailing={<div className="hidden md:block">{control}</div>}
            search={
              <input
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search permissions…"
                className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
              />
            }
            filters={[
              { id: "moduleFilter", label: "Module", value: moduleFilter, options: moduleOptions, onChange: (v) => { setModuleFilter(String(v)); setCurrentPage(1); } },
              { id: "heldFilter", label: "Held By", value: heldFilter, options: HELD_OPTIONS, onChange: (v) => { setHeldFilter(String(v)); setCurrentPage(1); } },
            ]}
          >
            <div className="hidden md:grid md:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Search permissions…"
                    className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="w-full">
                <Select label="Module" value={moduleFilter} onChange={(v) => { setModuleFilter(String(v)); setCurrentPage(1); }} options={moduleOptions} />
              </div>
              <div className="w-full">
                <Select label="Held By" value={heldFilter} onChange={(v) => { setHeldFilter(String(v)); setCurrentPage(1); }} options={HELD_OPTIONS} />
              </div>
              <div className="filter-actions flex items-end gap-2">
                <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} />
                {control}
              </div>
            </div>
          </ConfiguredDesktopFilters>

          {/* Mobile FilterDrawer */}
          <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
            <FilterAccordionItem label="Module" isExpanded={expandedSections.has("module")} onToggle={() => toggleSection("module")}>
              {optionButtons(moduleOptions, moduleFilter, setModuleFilter)}
            </FilterAccordionItem>
            <FilterAccordionItem label="Held By" isExpanded={expandedSections.has("held")} onToggle={() => toggleSection("held")}>
              {optionButtons(HELD_OPTIONS, heldFilter, setHeldFilter)}
            </FilterAccordionItem>
          </FilterDrawer>

          {/* Table area */}
          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}
            <DataTable
              rows={rows}
              getRowKey={(row) => row.code}
              columns={layout.columns}
              columnLayout={layout}
              action={action}
              scrollerRef={scrollerRef as React.RefObject<HTMLDivElement>}
              scrollProps={dragEvents}
              isDragging={isDragging}
              onRowClick={open}
              emptyState={<TableEmptyState title="No permissions found" description={hasFilters ? "Try adjusting your search or filters." : "There are no permissions to show."} />}
              pagination={
                totalItems > 0 ? (
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
                ) : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
