import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from '@/components/ui/filter/ConfiguredDesktopFilters';
import React, { useCallback, useEffect, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
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
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr } from "@/i18n";

// Display only: the codes stay what the server sends.
const humanize = (code: string) =>
  code.toLowerCase().split("_").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

const ConfigChips: React.FC<{ config: Record<string, unknown> | null }> = ({ config }) => {
  const entries = config ? Object.entries(config) : [];
  return entries.length > 0 ? (
    <div className="flex w-full flex-wrap items-center gap-1">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-600 break-all">
          {key}={String(value)}
        </span>
      ))}
    </div>
  ) : (
    <span className="text-2xs text-slate-300">—</span>
  );
};

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { label: "All", value: "ALL" },
  { label: "Document", value: "DOCUMENT" },
  { label: "Revision", value: "REVISION" },
  { label: tr("Controlled Copy"), value: "CONTROLLED_COPY" },
  { label: tr("Controlled Copy Batch"), value: "CONTROLLED_COPY_BATCH" },
  { label: tr("Report Template (review)"), value: "REPORT_TEMPLATE" },
  { label: tr("Training Requirement"), value: "TRAINING_REQUIREMENT" },
  { label: tr("Training Matrix Version"), value: "TRAINING_MATRIX_VERSION" },
  { label: tr("Training Activity"), value: "TRAINING_ACTIVITY" },
  { label: tr("Training Participant"), value: "TRAINING_PARTICIPANT" },
  { label: tr("Training Assessment"), value: "TRAINING_ASSESSMENT" },
  { label: tr("Training Job Assignment"), value: "TRAINING_JOB_ASSIGNMENT" },
  { label: tr("Training Personnel Review"), value: "TRAINING_PERSONNEL_REVIEW" },
  { label: tr("Training Record Export"), value: "TRAINING_RECORD_EXPORT" },
  { label: tr("Training Record Export Batch"), value: "TRAINING_RECORD_EXPORT_BATCH" },
  { label: tr("Training Trainer Exception"), value: "TRAINING_TRAINER_EXCEPTION" },
  { label: tr("Training Suspension"), value: "TRAINING_SUSPENSION" },
  { label: tr("Training Vendor"), value: "TRAINING_VENDOR" },
  { label: tr("Training Record"), value: "TRAINING_RECORD" },
  { label: tr("Report Schedule"), value: "REPORT_SCHEDULE" },
  { label: tr("Report Run"), value: "REPORT_RUN" },
  { label: tr("Report File (legal hold)"), value: "REPORT_ARTIFACT" },
  { label: tr("Access Review Campaign"), value: "ACCESS_REVIEW_CAMPAIGN" },
  { label: tr("Audit Trail Review Campaign"), value: "AUDIT_REVIEW_CAMPAIGN" },
  { label: tr("Uncontrolled Copy"), value: "UNCONTROLLED_COPY" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

type SortKey = "resourceType" | "code" | "resolverCode" | "active" | "updatedAt";

const TABLE_COLS: { id: SortKey | "no" | "resolverConfig"; label: string; sortable: boolean }[] = [
  { id: "no", label: "No.", sortable: false },
  { id: "code", label: "Code", sortable: true },
  { id: "resourceType", label: tr("Resource Type"), sortable: true },
  { id: "resolverCode", label: "Resolver", sortable: true },
  { id: "resolverConfig", label: tr("Resolver Config"), sortable: false },
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
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
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
  const sortOf = (key: SortKey) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });
  const relationColumns: DataTableColumn<RelationRow>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: "text-center",
      cellClassName: "text-center text-slate-500",
      cell: (_d, idx) => (currentPage - 1) * itemsPerPage + idx + 1,
    },
    {
      id: "relation",
      header: "Relation",
      label: "Relation",
      cell: (d) => <div className="max-w-[240px] whitespace-normal break-words text-sm font-medium text-slate-900">{d.displayName}</div>,
    },
    {
      id: "code",
      header: "Code",
      label: "Code",
      sort: sortOf("code"),
      cell: (d) => <div className="max-w-[220px] whitespace-normal break-all font-mono text-2xs text-slate-600">{d.code}</div>,
    },
    {
      id: "appliesTo",
      header: tr("Applies to"),
      label: tr("Applies to"),
      sort: sortOf("resourceType"),
      cell: (d) => <Badge color="purple" size="xs">{humanize(d.resourceType)}</Badge>,
    },
    {
      id: "resolver",
      header: "Resolver",
      label: "Resolver",
      sort: sortOf("resolverCode"),
      cellClassName: "text-sm text-slate-700",
      cell: (d) => humanize(d.resolverCode),
    },
    {
      id: "resolverConfig",
      header: tr("Resolver Config"),
      label: tr("Resolver Config"),
      cell: (d) => (
        <div className="max-w-[240px] whitespace-normal">
          <ConfigChips config={d.resolverConfig} />
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      label: "Status",
      sort: sortOf("active"),
      cell: (d) => <Badge color={flagColor(d.active)} size="sm">{d.active ? "Active" : "Inactive"}</Badge>,
    },
    {
      id: "updated",
      header: "Updated",
      label: "Updated",
      sort: sortOf("updatedAt"),
      cellClassName: "text-xs sm:text-sm text-slate-600",
      cell: (d) => formatDateTime(d.updatedAt),
    },
  ];
  const { layout: relationLayout, control: relationControl } = useCustomColumnLayout("lifecycle.relation-definitions.v3", relationColumns);

  return (
    <div className="flex flex-col flex-1">
      <p className="w-full text-xs sm:text-sm text-slate-500 mb-4 md:mb-5">
        {tr("Server-owned resolvers resolved with the configuration below. Relation codes are migration-managed — this view is read-only.")}
      </p>

      {/* Matches the common User Management filter layout: compact drawer on mobile,
          labelled three-column grid on desktop. */}
      <div className="compact-filter-section md:pb-5 flex flex-col">
        <div>
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block capitalize">{tr("Search")}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr("Search code, display name, resolver...")}
                  className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                />
                {search && (
                  <button
                    type="button"
                    aria-label={tr("Clear search")}
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
                {tr("Filters")}
              </Button>
            </div>
          </div>

<ConfiguredDesktopFilters
  trailing={<div className="hidden md:block">{relationControl}</div>}
  search={
    <input
      aria-label={tr("Search")}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder={tr("Search code, display name, resolver...")}
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
    />
  }
  filters={[
    {
      id: "resourceTypeFilter",
      label: tr("Resource Type"),
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
      label: tr("Updated Date Range"),
      from: updatedFrom,
      to: updatedTo,
      onFromChange: setUpdatedFrom,
      onToChange: setUpdatedTo,
    },
  ]}
>
<div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="w-full">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors capitalize">{tr("Search")}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                  <Search className="h-4 w-4 text-slate-400 transition-colors" />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr("Search code, display name, resolver...")}
                  className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                />
                {search && (
                  <button
                    type="button"
                    aria-label={tr("Clear search")}
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <Select
              label={tr("Resource Type")}
              value={resourceTypeFilter}
              onChange={setResourceTypeFilter}
              options={RESOURCE_TYPE_OPTIONS}
            />

            <Select
              label={tr("Status")}
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />

            <DateRangePicker
              label={tr("Updated Date Range")}
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={setUpdatedFrom}
              onEndDateChange={setUpdatedTo}
              placeholder={tr("Select updated date range")}
              autoApply
            />

            <div className="filter-actions flex items-end gap-2">
              <ClearFiltersButton onClearSearch={() => setSearch("")} onClear={clearFilters} disabled={!hasFilters} />
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
                    <TableEmptyState title={tr("Failed to Load")} description={error} />
                  ) : (
                    <TableEmptyState
                      title={tr("No Relation Definitions")}
                      description={hasFilters ? tr("Try adjusting your search or filters.") : "No relation definitions match this filter."}
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
          label={tr("Resource Type")}
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
          label={tr("Status")}
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
          label={tr("Updated Date Range")}
          isExpanded={expandedFilterSections.has("updatedDate")}
          onToggle={() => toggleFilterSection("updatedDate")}
        >
          <div className="pb-4 pt-1">
            <DateRangePicker
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={setUpdatedFrom}
              onEndDateChange={setUpdatedTo}
              placeholder={tr("Select updated date range")}
              autoApply
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
