import { useViewState, useViewFilterChange } from "@/hooks/useViewState";
import { tr } from "@/i18n";
import React, { useEffect, useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { useDebounce } from "@/hooks/useDebounce";
import { DataTable, TABLE_STYLES, TableEmptyState, TablePagination, type DataTableColumn } from "@/components/ui/table";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

export interface LocalColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Present: the column can be sorted by this value. */
  sortValue?: (row: T) => string | number;
}

const PAGE_SIZE = 10;

/**
 * A short list that arrived with its page (the checks of one backup, its test restores): a full-width search above it, a No. column,
 * sortable headers and at most 10 rows a page. It is not for lists the server pages; those use ServerListPanel.
 */
export function LocalListTable<T>({
  rows, getRowKey, columns, searchText, searchLabel, searchPlaceholder, emptyTitle, emptyDescription,
}: {
  rows: readonly T[];
  getRowKey: (row: T) => string;
  columns: LocalColumn<T>[];
  /** What the search looks in, for one row. */
  searchText: (row: T) => string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [search, setSearch] = useViewState(`${columns.map((column) => column.id).join(",")}: LocalListTable.search`, "");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useViewState(`${columns.map((column) => column.id).join(",")}: LocalListTable.page`, 1);
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" }>();

  const shown = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const found = needle ? rows.filter((row) => searchText(row).toLowerCase().includes(needle)) : [...rows];
    const column = columns.find((c) => c.id === sort?.id);
    if (column?.sortValue && sort) {
      const value = column.sortValue;
      found.sort((a, b) => {
        const x = value(a);
        const y = value(b);
        const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
        return sort.direction === "asc" ? order : -order;
      });
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, debouncedSearch, sort]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  useViewFilterChange(() => setPage(1), [debouncedSearch, sort]);
  const current = Math.min(page, totalPages);
  const pageRows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const tableColumns: DataTableColumn<T>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (current - 1) * PAGE_SIZE + index + 1 },
    ...columns.map((column) => ({
      id: column.id,
      header: column.header,
      label: column.header,
      cell: (row: T) => column.cell(row),
      sort: column.sortValue
        ? {
            direction: sort?.id === column.id ? sort.direction : undefined,
            onSort: () => setSort((prev) => ({ id: column.id, direction: prev?.id === column.id && prev.direction === "asc" ? "desc" : "asc" })),
          }
        : undefined,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={search} onChange={setSearch} ariaLabel={searchLabel} placeholder={searchPlaceholder} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          rows={pageRows}
          getRowKey={getRowKey}
          columns={tableColumns}
          emptyState={<TableEmptyState title={rows.length === 0 ? emptyTitle : tr("No results")} description={rows.length === 0 ? emptyDescription : tr("Try a different search.")} />}
          pagination={
            shown.length > 0 ? (
              <div className="border-t border-slate-200">
                <TablePagination
                  currentPage={current}
                  totalPages={totalPages}
                  totalItems={shown.length}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setPage}
                  onItemsPerPageChange={() => undefined}
                  itemsPerPageOptions={[PAGE_SIZE]}
                />
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
