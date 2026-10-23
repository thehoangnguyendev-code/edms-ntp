import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Search, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { cn } from "@/components/ui/utils";
import { useDebounce, useTableDragScroll } from "@/hooks";
import {
  securityApi,
  type AuthorizationShadowMismatch,
} from "@/services/api/security";
import { formatDateTime } from "@/utils/format";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { label: "All", value: "ALL" },
  { label: "Revision", value: "REVISION" },
  { label: "Document", value: "DOCUMENT" },
  { label: "Controlled Copy", value: "CONTROLLED_COPY" },
  { label: "Controlled Copy Batch", value: "CONTROLLED_COPY_BATCH" },
];

type SortKey =
  "resource" | "action" | "policyAllowed" | "legacyAllowed" | "createdAt";

const SortHeader: React.FC<{
  label: string;
  column: SortKey;
  current: SortKey;
  direction: "asc" | "desc";
  onSort: (column: SortKey) => void;
}> = ({ label, column, current, direction, onSort }) => (
  <TableMarkup.HeaderCell
    onClick={() => onSort(column)}
    className={TABLE_STYLES.headerCell39}
  >
    <div className="flex w-full items-center justify-between gap-2">
      <span className="truncate">{label}</span>
      <div className="flex flex-shrink-0 flex-col text-slate-500 transition-colors group-hover:text-slate-700">
        <ChevronUp
          className={cn(
            "-mb-1 h-3 w-3",
            current === column && direction === "asc" && "text-emerald-600",
          )}
        />
        <ChevronDown
          className={cn(
            "h-3 w-3",
            current === column && direction === "desc" && "text-emerald-600",
          )}
        />
      </div>
    </div>
  </TableMarkup.HeaderCell>
);

/** Server-driven diagnostic table used to verify hybrid-engine shadow decisions before cutover. */
export const EngineHealthTab: React.FC = () => {
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const [items, setItems] = useState<AuthorizationShadowMismatch[]>([]);
  const [summary, setSummary] = useState<
    { resourceType: string; total: number; mismatches: number; cutoverComplete: boolean }[]
  >([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [resourceTypeFilter, setResourceTypeFilter] = useState("ALL");
  const [mismatchesOnly, setMismatchesOnly] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    securityApi
      .getAuthorizationShadowMismatchSummary()
      .then(setSummary)
      .catch(() => setSummary([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await securityApi.getAuthorizationShadowMismatchesPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        resourceType:
          resourceTypeFilter === "ALL" ? undefined : resourceTypeFilter,
        mismatchesOnly,
        sortBy: sortConfig.key,
        sortDir: sortConfig.direction,
      });
      setItems(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(result.pagination.totalPages || 1);
    } catch {
      setItems([]);
      setTotalItems(0);
      setTotalPages(1);
      setError("Failed to load shadow-evaluation events.");
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    debouncedSearch,
    itemsPerPage,
    mismatchesOnly,
    resourceTypeFilter,
    sortConfig,
  ]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, resourceTypeFilter, mismatchesOnly]);

  const hasFilters =
    Boolean(search) || resourceTypeFilter !== "ALL" || !mismatchesOnly;
  const clearFilters = () => {
    setSearch("");
    setResourceTypeFilter("ALL");
    setMismatchesOnly(true);
    setSortConfig({ key: "createdAt", direction: "desc" });
    setCurrentPage(1);
  };
  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const isInitialLoading = loading && items.length === 0;
  const isTableLoading = loading && items.length > 0;

  type EngineRow = (typeof items)[number];
  const engineColumns: DataTableColumn<EngineRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: "w-14 text-center", cellClassName: "text-center text-slate-500", cell: (_e, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    {
      id: "resource",
      header: "Resource",
      label: "Resource",
      sort: { direction: sortConfig.key === "resource" ? sortConfig.direction : undefined, onSort: () => handleSort("resource") },
      cell: (entry) => (
        <>
          <div className="font-medium text-slate-800">{entry.resourceType}</div>
          <div className="max-w-[160px] truncate text-2xs text-slate-400">{entry.resourceId}</div>
        </>
      ),
    },
    { id: "action", header: "Action", label: "Action", sort: { direction: sortConfig.key === "action" ? sortConfig.direction : undefined, onSort: () => handleSort("action") }, cellClassName: "text-xs text-slate-700 sm:text-sm", cell: (entry) => entry.actionCode },
    {
      id: "policyAllowed",
      header: "New Engine",
      label: "New Engine",
      sort: { direction: sortConfig.key === "policyAllowed" ? sortConfig.direction : undefined, onSort: () => handleSort("policyAllowed") },
      cell: (entry) => (
        <>
          <Badge semantic={entry.policyAllowed ? "success" : "neutral"} size="xs">{entry.policyAllowed ? "Allow" : "Deny"}</Badge>
          {entry.policyReasonCode && <div className="mt-1 text-2xs text-slate-400">{entry.policyReasonCode}</div>}
        </>
      ),
    },
    {
      id: "legacyAllowed",
      header: "Legacy",
      label: "Legacy",
      sort: { direction: sortConfig.key === "legacyAllowed" ? sortConfig.direction : undefined, onSort: () => handleSort("legacyAllowed") },
      cell: (entry) => (
        <>
          <Badge semantic={entry.legacyAllowed ? "success" : "neutral"} size="xs">{entry.legacyAllowed ? "Allow" : "Deny"}</Badge>
          {entry.legacyReasonCode && <div className="mt-1 text-2xs text-slate-400">{entry.legacyReasonCode}</div>}
        </>
      ),
    },
    { id: "createdAt", header: "When", label: "When", sort: { direction: sortConfig.key === "createdAt" ? sortConfig.direction : undefined, onSort: () => handleSort("createdAt") }, cellClassName: "text-xs text-slate-600 sm:text-sm", cell: (entry) => formatDateTime(entry.createdAt) },
  ];
  const { layout: engineLayout, control: engineControl } = useCustomColumnLayout("lifecycle.engine-health", engineColumns);

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-4 max-w-3xl text-xs text-slate-500 sm:text-sm md:mb-5">
        Compares the new hybrid AuthorizationEngineService against each legacy
        evaluator. A resource type must show zero mismatches before its cutover
        feature flag is enabled — except resource types marked "Cutover complete"
        below, whose legacy evaluator has already been permanently removed from
        the code; their totals are a frozen historical record, not live monitoring.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:mb-5 md:grid-cols-4 md:gap-4">
        {summary.length === 0 && (
          <div className="col-span-full text-xs text-slate-400">
            No shadow-evaluation events recorded yet.
          </div>
        )}
        {summary.map((entry) => (
          <div
            key={entry.resourceType}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 md:text-xs">
              {entry.resourceType}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">
              {entry.total}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge
                semantic={entry.mismatches === 0 ? "success" : "danger"}
                size="xs"
                icon={
                  entry.mismatches === 0 ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : undefined
                }
              >
                {entry.mismatches === 0
                  ? "0 mismatches"
                  : `${entry.mismatches} mismatches`}
              </Badge>
              {entry.cutoverComplete && (
                <Badge semantic="neutral" size="xs" title="Legacy evaluator removed from code — this total is a frozen historical record, not live monitoring.">
                  Cutover complete
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-end gap-4 pb-4 md:grid-cols-2 lg:grid-cols-4 md:pb-5">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, resource ID..."
              className="block h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                aria-label="Clear search"
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
        <div className="flex h-9 items-center">
          <Checkbox
            id="mismatches-only"
            checked={mismatchesOnly}
            onChange={setMismatchesOnly}
            label="Mismatches only"
          />
        </div>
        <div className="flex items-end gap-2">
          <ClearFiltersButton onClearSearch={() => setSearch("")} onClear={clearFilters} disabled={!hasFilters} />
          {engineControl}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col">
        {isInitialLoading ? (
          <div className="py-12">
            <SectionLoading minHeight="150px" />
          </div>
        ) : (
          <>
            {isTableLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-[4px]">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}
            <div className="flex flex-1 flex-col">
              <DataTable
                rows={items}
                getRowKey={(entry) => entry.id}
                columns={engineLayout.columns}
                columnLayout={engineLayout}
                scrollerRef={scrollerRef as React.RefObject<HTMLDivElement>}
                scrollProps={dragEvents}
                isDragging={isDragging}
                rowClassName={(entry) => (entry.policyAllowed !== entry.legacyAllowed ? "bg-red-50/40" : "")}
                emptyState={
                  error ? (
                    <TableEmptyState title="Failed to Load" description={error} />
                  ) : (
                    <TableEmptyState
                      title="No Events"
                      description={
                        mismatchesOnly
                          ? "No mismatches match this filter — the new engine agrees with the legacy evaluator on every check."
                          : "No shadow-evaluation events match this filter."
                      }
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
                        onItemsPerPageChange={(limit) => {
                          setItemsPerPage(limit);
                          setCurrentPage(1);
                        }}
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
    </div>
  );
};
