import { useEffect, useState } from "react";
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
  useEffect(() => { setPage(1); }, [sessionId, group, query]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    trainingActivitiesApi.participantPage(activityId, { sessionId, group, search: query || undefined, page, limit, sortBy: sort.key, sortDirection: sort.key ? sort.direction : undefined })
      .then((result) => {
        if (!active) return;
        setRows(result.data); setTotal(result.pagination.total); setPages(Math.max(1, result.pagination.totalPages));
        if (page > Math.max(1, result.pagination.totalPages)) setPage(Math.max(1, result.pagination.totalPages));
      })
      .catch((e) => { if (active) { setRows([]); setError(trainingError(e)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activityId, sessionId, group, query, page, limit, sort, refreshToken]);
  if (!loading && !error && total === 0 && !search && group !== "EMPLOYEES") return null;
  return <section>
    <h3 className="mb-3 text-sm font-semibold text-slate-800">{title} ({total})</h3>
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
