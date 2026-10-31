import { useEffect, useRef, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useDebounce } from "@/hooks";
import { trainingActivitiesApi, trainingError, type TrainingParticipant } from "@/services/api/trainingActivities";

/** The columns the person can sort by; the server turns the key into its own ORDER BY. */
const SORTABLE = new Set(["code", "name", "department", "state", "result", "read", "sign", "participation"]);

/** Only one authorized group/session page is held in the browser; commands still use the original row IDs. */
export function TrainingParticipantTable({ activityId, sessionId, group, title, columns, refreshToken }: {
  activityId: string; sessionId?: string; group: string; title: string;
  columns: DataTableColumn<TrainingParticipant>[]; refreshToken: unknown;
}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key?: string; direction: "asc" | "desc" }>({ direction: "asc" });
  const query = useDebounce(search, 300);
  const [rows, setRows] = useState<TrainingParticipant[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The first answer of the server for the current session, group, search, page, size and sort. Until it arrives nothing is drawn for a group that may turn out empty, and a refresh that only
  // follows a change of the activity (refreshToken) keeps the rows on the screen instead of showing the loading state again.
  const [loaded, setLoaded] = useState(false);
  const shownFor = useRef("");
  useEffect(() => { setPage(1); }, [sessionId, group, query]);
  useEffect(() => {
    let active = true;
    const key = JSON.stringify([activityId, sessionId, group, query, page, limit, sort]);
    const sameQuery = shownFor.current === key;
    if (!sameQuery) { setLoaded(false); setLoading(true); }
    setError("");
    trainingActivitiesApi.participantPage(activityId, { sessionId, group, search: query || undefined, page, limit, sortBy: sort.key, sortDirection: sort.key ? sort.direction : undefined })
      .then((result) => {
        if (!active) return;
        shownFor.current = key;
        setRows(result.data); setTotal(result.pagination.total); setPages(Math.max(1, result.pagination.totalPages));
        if (page > Math.max(1, result.pagination.totalPages)) setPage(Math.max(1, result.pagination.totalPages));
      })
      .catch((e) => { if (active) { setRows([]); setError(trainingError(e)); } })
      .finally(() => { if (active) { setLoading(false); setLoaded(true); } });
    return () => { active = false; };
  }, [activityId, sessionId, group, query, page, limit, sort, refreshToken]);
  // A group other than the employees is drawn only when it has people (or a search is on): while the first answer is on its way it is not drawn at all, so an empty group never flashes.
  if (group !== "EMPLOYEES" && !search && (!loaded || (!loading && !error && total === 0))) return null;
  return <section>
    <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}{loaded ? ` (${total})` : ""}</h3>
    <div className="mb-4"><FilterSearchInput aria-label={`Search ${title}`} value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search name or employee ID…" /></div>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    <DataTable rows={rows} getRowKey={(p) => p.id} isLoading={loading} loadingContent={<SectionLoading text="Loading participants…" />}
      columns={columns.map((column) => column.id === "rowNo" ? { ...column, cell: (_p: TrainingParticipant, i: number) => (page - 1) * limit + i + 1 }
        : SORTABLE.has(column.id) ? { ...column, sort: { direction: sort.key === column.id ? sort.direction : undefined, onSort: () => { setSort((s) => ({ key: column.id, direction: s.key === column.id && s.direction === "asc" ? "desc" : "asc" })); setPage(1); } } }
        : column)}
      emptyState={<TableEmptyState title="No Participants" description="No participant matches this session and search." />}
      pagination={total > 0 ? <TablePagination currentPage={page} totalPages={pages} totalItems={total} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(value) => { setLimit(value); setPage(1); }} /> : undefined} />
  </section>;
}
