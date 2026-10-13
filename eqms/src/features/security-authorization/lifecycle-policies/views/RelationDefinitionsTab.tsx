import { ConfiguredDesktopFilters } from '@/components/ui/filter/ConfiguredDesktopFilters';
import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { useTableDragScroll, useDebounce } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { securityApi, type AuthorizationRelationDefinition } from "@/services/api/security";
import { formatDateTime } from "@/utils/format";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { label: "All Resource Types", value: "ALL" },
  { label: "Document", value: "DOCUMENT" },
  { label: "Revision", value: "REVISION" },
  { label: "Controlled Copy", value: "CONTROLLED_COPY" },
  { label: "Controlled Copy Batch", value: "CONTROLLED_COPY_BATCH" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

type SortKey = "resourceType" | "code" | "resolverCode" | "active" | "updatedAt";

const TABLE_COLS: { id: SortKey | "no" | "resolverConfig"; label: string; sortable: boolean }[] = [
  { id: "no", label: "No.", sortable: false },
  { id: "code", label: "Code", sortable: true },
  { id: "resourceType", label: "Resource Type", sortable: true },
  { id: "resolverCode", label: "Resolver", sortable: true },
  { id: "resolverConfig", label: "Resolver Config", sortable: false },
  { id: "active", label: "Status", sortable: true },
  { id: "updatedAt", label: "Updated", sortable: true },
];

// Columns grow and shrink with the available viewport. The minimum table width only
// preserves readable columns on narrow screens; useTableDragScroll handles the overflow.
const TABLE_COLUMN_WIDTHS = ["4%", "26%", "13%", "15%", "25%", "7%", "10%"];

const thBase =
  "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group";

/**
 * Read-only catalog of server-owned relation resolvers (SELF_RESOLVER, RESOURCE_OWNER,
 * WORKFLOW_PARTICIPANT, CONTROLLED_COPY_RECIPIENT, ORGANIZATION_SCOPE, OBJECT_GRANT,
 * PERMISSION_RESOLVER, ACCESS_PROFILE_RESOLVER). Search/filter/sort/pagination all resolved
 * server-side (GET /authorization/relation-definitions/paged), matching the other list screens
 * in this app. Migration-managed -- no create/edit here.
 */
export const RelationDefinitionsTab: React.FC = () => {
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const [items, setItems] = useState<AuthorizationRelationDefinition[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [resourceTypeFilter, setResourceTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedFilterSections, setExpandedFilterSections] = useState<Set<string>>(
    new Set(["resourceType", "status", "updatedDate"]),
  );

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "resourceType", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await securityApi.getAuthorizationRelationDefinitionsPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        resourceType: resourceTypeFilter !== "ALL" ? resourceTypeFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        sortBy: sortConfig.key,
        sortDir: sortConfig.direction,
      });
      setItems(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages || 1);
    } catch {
      setError("Failed to load relation definitions.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, resourceTypeFilter, statusFilter, updatedFrom, updatedTo, sortConfig]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, resourceTypeFilter, statusFilter, updatedFrom, updatedTo]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
    setCurrentPage(1);
  };

  const hasFilters = !!search || resourceTypeFilter !== "ALL" || statusFilter !== "ALL" || !!updatedFrom || !!updatedTo;
  const clearFilters = () => {
    setSearch(""); setResourceTypeFilter("ALL"); setStatusFilter("ALL");
    setUpdatedFrom(""); setUpdatedTo(""); setCurrentPage(1);
  };

  const toggleFilterSection = (section: string) => {
    setExpandedFilterSections((previous) => {
      const next = new Set(previous);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  // Keep the mobile drawer controls identical to User Management. Native/portal
  // Select menus are unreliable inside a bottom drawer on mobile browsers, while
  // these explicit option rows remain visible and accessible.
  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  const isInitialLoading = loading && items.length === 0;
  const isTableLoading = loading && items.length > 0;

  type RelationRow = (typeof items)[number];
  const relationColumns: DataTableColumn<RelationRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: "w-[4%] text-center", cellClassName: "text-center text-slate-500", cell: (_d, idx) => (currentPage - 1) * itemsPerPage + idx + 1 },
    {
      id: "code",
      header: "Code",
      label: "Code",
      headerClassName: "w-[26%]",
      sort: { direction: sortConfig.key === "code" ? sortConfig.direction : undefined, onSort: () => handleSort("code") },
      cell: (d) => (
        <>
          <div className="break-all text-xs sm:text-sm font-medium text-slate-800">{d.code}</div>
          <div className="break-words text-2xs text-slate-400">{d.displayName}</div>
        </>
      ),
    },
    {
      id: "resourceType",
      header: "Resource Type",
      label: "Resource Type",
      headerClassName: "w-[13%]",
      sort: { direction: sortConfig.key === "resourceType" ? sortConfig.direction : undefined, onSort: () => handleSort("resourceType") },
      cell: (d) => <Badge color="purple" size="xs">{d.resourceType}</Badge>,
    },
    {
      id: "resolverCode",
      header: "Resolver",
      label: "Resolver",
      headerClassName: "w-[15%]",
      sort: { direction: sortConfig.key === "resolverCode" ? sortConfig.direction : undefined, onSort: () => handleSort("resolverCode") },
      cellClassName: "text-xs sm:text-sm text-slate-600 break-all",
      cell: (d) => d.resolverCode,
    },
    {
      id: "resolverConfig",
      header: "Resolver Config",
      label: "Resolver Config",
      headerClassName: "w-[25%]",
      cell: (d) => {
        const configEntries = d.resolverConfig ? Object.entries(d.resolverConfig) : [];
        return configEntries.length > 0 ? (
          <div className="flex w-full flex-wrap items-center gap-1">
            {configEntries.map(([key, value]) => (
              <span key={key} className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-600 break-all">
                {key}={String(value)}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-2xs text-slate-300">—</span>
        );
      },
    },
    {
      id: "active",
      header: "Status",
      label: "Status",
      headerClassName: "w-[7%]",
      sort: { direction: sortConfig.key === "active" ? sortConfig.direction : undefined, onSort: () => handleSort("active") },
      cell: (d) => <Badge color={d.active ? "emerald" : "slate"} size="sm">{d.active ? "Active" : "Inactive"}</Badge>,
    },
    {
      id: "updatedAt",
      header: "Updated",
      label: "Updated",
      headerClassName: "w-[10%]",
      sort: { direction: sortConfig.key === "updatedAt" ? sortConfig.direction : undefined, onSort: () => handleSort("updatedAt") },
      cellClassName: "text-xs sm:text-sm text-slate-600",
      cell: (d) => formatDateTime(d.updatedAt),
    },
  ];
  const { layout: relationLayout, control: relationControl } = useCustomColumnLayout("lifecycle.relation-definitions", relationColumns);

  return (
    <div className="flex flex-col flex-1">
      <p className="w-full text-xs sm:text-sm text-slate-500 mb-4 md:mb-5">
        Server-owned resolvers resolved with the configuration below. Relation codes are
        migration-managed — this view is read-only.
      </p>

      {/* Matches the common User Management filter layout: compact drawer on mobile,
          labelled three-column grid on desktop. */}
      <div className="compact-filter-section md:pb-5 flex flex-col">
        <div>
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, display name, resolver..."
                  className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="whitespace-nowrap gap-2"
              >
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

<ConfiguredDesktopFilters
  trailing={<div className="hidden md:block">{relationControl}</div>}
  search={
    <input
      aria-label="Search"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder={"Search code, display name, resolver..."}
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
    />
  }
  filters={[
    {
      id: "resourceTypeFilter",
      label: "Resource Type",
      value: String(resourceTypeFilter),
      options: RESOURCE_TYPE_OPTIONS,
      onChange: setResourceTypeFilter,
    },
    {
      id: "statusFilter",
      label: "Status",
      value: String(statusFilter),
      options: STATUS_OPTIONS,
      onChange: setStatusFilter,
    },
  ]}
  dates={[
    {
      id: "updatedFrom",
      label: "Updated Date Range",
      from: updatedFrom,
      to: updatedTo,
      onFromChange: setUpdatedFrom,
      onToChange: setUpdatedTo,
    },
  ]}
>
<div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="w-full">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                  <Search className="h-4 w-4 text-slate-400 transition-colors" />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, display name, resolver..."
                  className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <Select
              label="Resource Type"
              value={resourceTypeFilter}
              onChange={setResourceTypeFilter}
              options={RESOURCE_TYPE_OPTIONS}
            />

            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />

            <DateRangePicker
              label="Updated Date Range"
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={setUpdatedFrom}
              onEndDateChange={setUpdatedTo}
              placeholder="Select updated date range"
              autoApply
            />

            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear Filters
              </Button>
              {relationControl}
            </div>
          </div>
</ConfiguredDesktopFilters>
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
            <div className="flex flex-col flex-1">
              <DataTable
                rows={items}
                getRowKey={(d) => d.id}
                columns={relationLayout.columns}
                columnLayout={relationLayout}
                scrollerRef={scrollerRef as React.RefObject<HTMLDivElement>}
                scrollProps={dragEvents}
                isDragging={isDragging}
                emptyState={
                  error ? (
                    <TableEmptyState title="Failed to Load" description={error} />
                  ) : (
                    <TableEmptyState
                      title="No Relation Definitions"
                      description={hasFilters ? "Try adjusting your search or filters." : "No relation definitions match this filter."}
                    />
                  )
                }
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
          </>
        )}
      </div>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Resource Type"
          isExpanded={expandedFilterSections.has("resourceType")}
          onToggle={() => toggleFilterSection("resourceType")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {RESOURCE_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setResourceTypeFilter(String(option.value));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(resourceTypeFilter === String(option.value))}
              >
                <span className="text-xs">{option.label}</span>
                {resourceTypeFilter === String(option.value) && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem
          label="Status"
          isExpanded={expandedFilterSections.has("status")}
          onToggle={() => toggleFilterSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusFilter(String(option.value));
                  setCurrentPage(1);
                }}
                className={getOptionClassName(statusFilter === String(option.value))}
              >
                <span className="text-xs">{option.label}</span>
                {statusFilter === String(option.value) && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem
          label="Updated Date Range"
          isExpanded={expandedFilterSections.has("updatedDate")}
          onToggle={() => toggleFilterSection("updatedDate")}
        >
          <div className="pb-4 pt-1">
            <DateRangePicker
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={setUpdatedFrom}
              onEndDateChange={setUpdatedTo}
              placeholder="Select updated date range"
              autoApply
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
