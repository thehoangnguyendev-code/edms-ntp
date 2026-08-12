import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Search, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { cn } from "@/components/ui/utils";
import { useDebounce, useTableDragScroll } from "@/hooks";
import {
  securityApi,
  type AuthorizationShadowMismatch,
} from "@/services/api/security";
import { formatDateTime } from "@/utils/format";

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { label: "All Resource Types", value: "ALL" },
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
  <th
    onClick={() => onSort(column)}
    className="sticky top-0 z-20 cursor-pointer whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 group md:text-xs"
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
  </th>
);

/** Server-driven diagnostic table used to verify hybrid-engine shadow decisions before cutover. */
export const EngineHealthTab: React.FC = () => {
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const [items, setItems] = useState<AuthorizationShadowMismatch[]>([]);
  const [summary, setSummary] = useState<
    { resourceType: string; total: number; mismatches: number }[]
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

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-4 max-w-3xl text-xs text-slate-500 sm:text-sm md:mb-5">
        Compares the new hybrid AuthorizationEngineService against each legacy
        evaluator. A resource type must show zero mismatches before its cutover
        feature flag is enabled.
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
            <div className="mt-1.5">
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
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="h-9 whitespace-nowrap rounded-lg border border-slate-200 px-4 text-sm font-medium transition-all duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear Filters
          </button>
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
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn(
                  "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                )}
                {...dragEvents}
              >
                <table className="w-full min-w-[900px] border-spacing-0 text-left">
                  <thead className="sticky top-0 z-30">
                    <tr>
                      <th className="sticky top-0 z-20 w-14 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        No.
                      </th>
                      <SortHeader
                        label="Resource"
                        column="resource"
                        current={sortConfig.key}
                        direction={sortConfig.direction}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Action"
                        column="action"
                        current={sortConfig.key}
                        direction={sortConfig.direction}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="New Engine"
                        column="policyAllowed"
                        current={sortConfig.key}
                        direction={sortConfig.direction}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Legacy"
                        column="legacyAllowed"
                        current={sortConfig.key}
                        direction={sortConfig.direction}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="When"
                        column="createdAt"
                        current={sortConfig.key}
                        direction={sortConfig.direction}
                        onSort={handleSort}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {!loading && items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          {error ? (
                            <TableEmptyState
                              title="Failed to Load"
                              description={error}
                            />
                          ) : (
                            <TableEmptyState
                              icon={
                                <ShieldCheck className="h-10 w-10 text-slate-300" />
                              }
                              title="No Events"
                              description={
                                mismatchesOnly
                                  ? "No mismatches match this filter — the new engine agrees with the legacy evaluator on every check."
                                  : "No shadow-evaluation events match this filter."
                              }
                            />
                          )}
                        </td>
                      </tr>
                    ) : (
                      items.map((entry, index) => {
                        const isMismatch =
                          entry.policyAllowed !== entry.legacyAllowed;
                        return (
                          <tr
                            key={entry.id}
                            className={cn(
                              "transition-colors hover:bg-slate-50/80",
                              isMismatch && "bg-red-50/40",
                            )}
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-slate-500 sm:text-sm">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs sm:text-sm">
                              <div className="font-medium text-slate-800">
                                {entry.resourceType}
                              </div>
                              <div className="max-w-[160px] truncate font-mono text-2xs text-slate-400">
                                {entry.resourceId}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 sm:text-sm">
                              {entry.actionCode}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                semantic={
                                  entry.policyAllowed ? "success" : "neutral"
                                }
                                size="xs"
                              >
                                {entry.policyAllowed ? "Allow" : "Deny"}
                              </Badge>
                              {entry.policyReasonCode && (
                                <div className="mt-1 text-2xs text-slate-400">
                                  {entry.policyReasonCode}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                semantic={
                                  entry.legacyAllowed ? "success" : "neutral"
                                }
                                size="xs"
                              >
                                {entry.legacyAllowed ? "Allow" : "Deny"}
                              </Badge>
                              {entry.legacyReasonCode && (
                                <div className="mt-1 text-2xs text-slate-400">
                                  {entry.legacyReasonCode}
                                </div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                              {formatDateTime(entry.createdAt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
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
                    onItemsPerPageChange={(limit) => {
                      setItemsPerPage(limit);
                      setCurrentPage(1);
                    }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
