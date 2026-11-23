import React, { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DataTable, type DataTableColumn, type DataTableSelection } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useToast } from "@/components/ui/toast";
import { useDebounce } from "@/hooks";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr } from "@/i18n";

export type SortDirection = "asc" | "desc";

export interface PickerQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortDir: SortDirection;
}

export interface PickerPage<T> {
  rows: T[];
  total: number;
  totalPages: number;
}

export interface PickerColumnContext {
  /** The sort of a column: its arrow and what a click does (a first click sorts ascending, the next one reverses). */
  sortOf: (key: string) => { direction?: SortDirection; onSort: () => void };
  /** The number before the first row of this page, so that "No." goes on across pages. */
  offset: number;
}

/**
 * A table to pick records from in the Access Profile wizard (permission sets, workflow roles): the shared `DataTable` with the search, the sort and the pages done by the server,
 * a tick column with "select this page", and a count of what is ticked. The wizard owns the selection (it reads it for the review step and the request), so what is ticked
 * stays ticked across pages and searches.
 */
export function WizardPickerTable<T>({
  load,
  getId,
  columns,
  defaultSort,
  selectedIds,
  onToggle,
  onToggleMany,
  onClear,
  searchPlaceholder,
  noun,
  noneSelectedHint,
  requiredHint,
  emptyTitle,
}: {
  load: (query: PickerQuery) => Promise<PickerPage<T>>;
  getId: (row: T) => string;
  columns: (context: PickerColumnContext) => DataTableColumn<T>[];
  defaultSort: { key: string; direction: SortDirection };
  selectedIds: ReadonlySet<string>;
  onToggle: (row: T) => void;
  onToggleMany: (rows: readonly T[], checked: boolean) => void;
  onClear: () => void;
  searchPlaceholder: string;
  /** What a row is, for the labels: "permission set", "workflow role". */
  noun: string;
  /** Said next to the count while nothing is ticked and nothing is required. */
  noneSelectedHint?: string;
  /** Said in red next to the count while nothing is ticked and at least one is required. */
  requiredHint?: string;
  emptyTitle: string;
}) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState(defaultSort);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  // the load function may be a new closure on every render of the wizard; the effect must run for a change of query only
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadRef.current({ page, limit, search: debouncedSearch.trim(), sortBy: sort.key, sortDir: sort.direction })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
        setTotalPages(Math.max(1, result.totalPages));
      })
      .catch(() => { if (active) showToast({ type: "error", message: `Failed to load ${noun}s` }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, limit, debouncedSearch, sort, noun, showToast]);

  const sortOf = (key: string) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((current) => (current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
      setPage(1);
    },
  });

  const pageAllSelected = rows.length > 0 && rows.every((row) => selectedIds.has(getId(row)));
  const pageSomeSelected = !pageAllSelected && rows.some((row) => selectedIds.has(getId(row)));
  const selection: DataTableSelection<T> = {
    visible: true,
    header: <Checkbox aria-label={`Select every ${noun} of this page`} checked={pageAllSelected} indeterminate={pageSomeSelected} onChange={() => onToggleMany(rows, !pageAllSelected)} />,
    cell: (row) => <span onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select ${noun}`} checked={selectedIds.has(getId(row))} onChange={() => onToggle(row)} /></span>,
    cellClassName: "w-10",
  };
  const offset = (page - 1) * limit;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">{tr("Search")}</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-lg border border-slate-200 px-3 pl-9 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder={searchPlaceholder}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge color="emerald" size="sm">{selectedIds.size} {tr("selected")}</Badge>
        {selectedIds.size > 0 && (
          <button type="button" className="rounded text-xs font-medium text-rose-600 transition-colors hover:text-rose-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30" onClick={onClear}>
            {tr("Clear all")}
          </button>
        )}
        {selectedIds.size === 0 && requiredHint && <span className="text-xs text-red-500">{requiredHint}</span>}
        {selectedIds.size === 0 && !requiredHint && noneSelectedHint && <span className="text-xs text-slate-500">{noneSelectedHint}</span>}
      </div>

      <DataTable
        rows={rows}
        columns={columns({ sortOf, offset })}
        getRowKey={getId}
        selection={selection}
        isLoading={loading && rows.length === 0}
        onRowClick={onToggle}
        rowClassName={(row) => (selectedIds.has(getId(row)) ? "bg-emerald-50/60 cursor-pointer" : "cursor-pointer")}
        emptyState={<TableEmptyState title={emptyTitle} description={search.trim() ? "Try adjusting your search." : undefined} />}
        pagination={
          total > 0 ? (
            <div className="border-t border-slate-200">
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={limit}
                isLoading={loading}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }}
                itemsPerPageOptions={[10, 20, 50]}
              />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
