import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { cn } from "@/components/ui/utils";
import { useServerPagedList, type ServerPage } from "@/features/documents/shared/useServerPagedList";
import { SortableTh, nextSort, type SortDirection } from "@/features/documents/document-detail/tabs/subtabs/components/SortableTh";

/** One column of the revisions table. `sortKey` is the key the server sorts by; `hideOnPhone` hides the column below the md breakpoint. */
export interface RevisionColumn<T> {
  header: string;
  sortKey: string;
  hideOnPhone?: boolean;
  cell: (row: T) => ReactNode;
  /** The cell that opens the revision: nowrap and emerald as the revision number of a document. */
  link?: boolean;
}

interface RevisionsCardProps<T extends { id: string; current: boolean }> {
  /** The name of the sub-tab, for example "Assessment Revision". */
  tabLabel: string;
  searchPlaceholder: string;
  /** What the first column sorts by when the card opens; newest first. */
  defaultSortKey: string;
  columns: RevisionColumn<T>[];
  fetchPage: (params: { search?: string; sortBy: string; sortDirection: SortDirection; page: number; limit: number }) => Promise<ServerPage<T>>;
  /** Changes whenever the object does (an approval, a new draft), so the list refreshes with it. */
  signature: string;
  /** Re-run the request for another object. */
  objectId: string;
}

/**
 * The revisions of an object of the training module under the footer buttons of its details, laid out and worked as the Revisions sub-tab of Document Details: newest first, searched,
 * sorted and paged by the server. The revision that is open is marked, and every other one opens through its first column.
 */
export function RevisionsCard<T extends { id: string; current: boolean }>({ tabLabel, searchPlaceholder, defaultSortKey, columns, fetchPage, signature, objectId }: RevisionsCardProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: defaultSortKey, direction: "desc" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { items, total, totalPages, loading, error, hasLoadedOnce } = useServerPagedList<T>(
    () => fetchPage({ search: debouncedSearch || undefined, sortBy: sort.key, sortDirection: sort.direction, page: currentPage, limit: itemsPerPage }),
    [objectId, debouncedSearch, sort.key, sort.direction, currentPage, itemsPerPage, signature],
    Boolean(objectId),
  );

  useEffect(() => {
    if (!loading && currentPage > totalPages) setCurrentPage(totalPages);
  }, [loading, currentPage, totalPages]);

  const handleSort = (key: string) => {
    setSort((previous) => nextSort(previous, key));
    setCurrentPage(1);
  };
  const span = columns.length + 1;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <TabNav tabs={[{ id: "revisions", label: tabLabel }]} activeTab="revisions" onChange={() => undefined} variant="simple-underline" />
      <div className="space-y-4 p-4 md:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            aria-label="Search the revisions"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="h-9 w-full rounded-lg border border-slate-200 pl-10 pr-10 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className={cn("overflow-hidden rounded-xl border bg-white shadow-sm transition-opacity", loading && hasLoadedOnce && "opacity-60")}>
          <div className="overflow-x-auto">
            <TableMarkup.Root className="w-full">
              <TableMarkup.Head className="border-b border-slate-200 bg-slate-50">
                <TableMarkup.Row>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell10}>No.</TableMarkup.HeaderCell>
                  {columns.map((c) => (
                    <SortableTh key={c.sortKey} label={c.header} sortKey={c.sortKey} activeKey={sort.key} direction={sort.direction} onSort={handleSort} className={c.hideOnPhone ? "hidden md:table-cell" : undefined} />
                  ))}
                </TableMarkup.Row>
              </TableMarkup.Head>
              <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                {loading && !hasLoadedOnce ? (
                  <TableMarkup.Row><TableMarkup.Cell colSpan={span} className="py-12 text-center text-sm text-slate-500">Loading...</TableMarkup.Cell></TableMarkup.Row>
                ) : error ? (
                  <TableMarkup.Row><TableMarkup.Cell colSpan={span} className="py-12 text-center text-sm font-medium text-slate-500">{error}</TableMarkup.Cell></TableMarkup.Row>
                ) : items.length > 0 ? (
                  items.map((row, index) => (
                    <TableMarkup.Row key={row.id} className={cn("transition-colors hover:bg-slate-50/80", row.current && "bg-emerald-50/40")}>
                      <TableMarkup.Cell className={TABLE_STYLES.cell4}>{(currentPage - 1) * itemsPerPage + index + 1}</TableMarkup.Cell>
                      {columns.map((c) => (
                        <TableMarkup.Cell key={c.sortKey} className={cn(c.link ? "whitespace-nowrap px-2 py-2 text-xs sm:px-4 sm:py-3.5 sm:text-sm" : TABLE_STYLES.cell8, c.hideOnPhone && "hidden md:table-cell")}>
                          {c.cell(row)}
                        </TableMarkup.Cell>
                      ))}
                    </TableMarkup.Row>
                  ))
                ) : (
                  <TableMarkup.Row>
                    <TableMarkup.Cell colSpan={span} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50"><Search className="h-5 w-5 text-slate-300" /></div>
                        <p className="text-sm font-medium text-slate-500">{debouncedSearch ? "No records matching your search" : "No records to display"}</p>
                      </div>
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                )}
              </TableMarkup.Body>
            </TableMarkup.Root>
          </div>
          {total > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }}
              showPageNumbers={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** The first column of a revisions table: the number as a link that opens the revision, or a marked label for the one that is open. */
export function RevisionLink({ label, current, onOpen }: { label: string; current: boolean; onOpen: () => void }) {
  return (
    <>
      <button
        type="button"
        aria-current={current ? "true" : undefined}
        onClick={() => !current && onOpen()}
        className={cn("font-medium text-emerald-600 underline-offset-2", current ? "cursor-default" : "cursor-pointer transition-colors hover:text-emerald-700 hover:underline")}
      >
        {label}
      </button>
      {current && <span className="ml-2 text-2xs font-medium uppercase tracking-wide text-slate-400">Viewing</span>}
    </>
  );
}
