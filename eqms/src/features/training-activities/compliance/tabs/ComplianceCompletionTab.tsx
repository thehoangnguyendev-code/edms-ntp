import { useCallback, useEffect, useRef, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { CompletionHeatmap, CompletionKey } from "../components/CompletionHeatmap";
import { CompletionByRow, CompletionSummaryStrip } from "../components/CompletionByRow";
import { Progress } from "@/components/ui/progress/Progress";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingComplianceApi, trainingError, type CompletionCell, type CompletionColumn, type CompletionPerson, type CompletionPosition, type CompletionState, type MatrixCompletion } from "@/services/api/trainingActivities";
import { saveBlob } from "../../shared/trainingLabels";
import { CompletionCellDrawer } from "../components/CompletionCellDrawer";

/** Names of the six cell states. The server decides the state; these are only the labels (PLAN-TR-001 17.11, D-58 — QA may rename them). */
const STATE_LABEL: Record<CompletionState, string> = {
  NOT_REQUIRED: "Not required", REQUIRED: "Required", IN_PROGRESS: "In Progress", QUALIFIED: "Qualified", UPDATE_NEEDED: "Update needed", DUE: "Annual training due",
};
const STATE_COLOR: Record<CompletionState, "slate" | "red" | "blue" | "emerald" | "amber" | "orange"> = {
  NOT_REQUIRED: "slate", REQUIRED: "red", IN_PROGRESS: "blue", QUALIFIED: "emerald", UPDATE_NEEDED: "amber", DUE: "orange",
};
const STATES = Object.keys(STATE_LABEL) as CompletionState[];

const VIEWS: TabItem[] = [{ id: "rows", label: "By matrix row" }, { id: "people", label: "By person" }];

/** People are loaded this many at a time as the list is scrolled. */
const PEOPLE_PAGE = 15;

/** Asks for more when it scrolls into view (the phone list, which has no scroll box of its own). */
function LoadMoreSentinel({ onVisible, active }: { onVisible: () => void; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) onVisible(); }, { rootMargin: "320px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [onVisible, active]);
  return <div ref={ref} className="h-1" aria-hidden="true" />;
}

type Pick = { person: CompletionPerson; column: CompletionColumn; cell: CompletionCell };

/**
 * Matrix completion of one position (SOP.0003 5.1, 5.3.8): the people who hold the position against the rows of the effective matrix that apply to it.
 * Every cell is calculated on the server from the personal training records, the open activities and the effective revision; nothing here is typed.
 */
export function ComplianceCompletionTab({ departmentId, departmentFilter }: { departmentId: string; departmentFilter: ReportSelectFilter }) {
  const [positions, setPositions] = useState<CompletionPosition[]>([]);
  const [positionId, setPositionId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState<CompletionPerson[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);
  const [columnPage, setColumnPage] = useState(1);
  const [result, setResult] = useState<MatrixCompletion>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Pick>();
  const [view, setView] = useState<"rows" | "people">("rows");

  useEffect(() => {
    setPositionId("");
    setResult(undefined);
    trainingComplianceApi.positions(departmentId || undefined).then((l) => { setPositions(l); const first = l.find((x) => x.peopleCount > 0) ?? l[0]; if (first) setPositionId(first.id); }).catch((e) => { setPositions([]); setError(trainingError(e)); });
  }, [departmentId]);

  const load = useCallback((target: number) => {
    if (!positionId) return;
    const token = ++request.current;
    if (target === 1) setLoading(true); else setLoadingMore(true);
    setError("");
    trainingComplianceApi
      .matrixCompletion({ departmentId: departmentId || undefined, positionId, search: search || undefined, status: status || undefined, gapsOnly, page: target, limit: PEOPLE_PAGE, columnPage: view === "rows" ? 1 : columnPage, columnLimit: view === "rows" ? 200 : 12 })
      .then((res) => {
        if (token !== request.current) return;
        setResult(res);
        setPage(target);
        setPeople((old) => {
          if (target === 1) return res.data;
          const have = new Set(old.map((p) => p.personId));
          return [...old, ...res.data.filter((p) => !have.has(p.personId))];
        });
      })
      .catch((e) => { if (token !== request.current) return; if (target === 1) { setResult(undefined); setPeople([]); } setError(trainingError(e) === "TRAINING_MATRIX_TOO_LARGE" ? "This matrix or Work Position is too large to show at once. Narrow it with the search." : trainingError(e)); })
      .finally(() => { if (token === request.current) { setLoading(false); setLoadingMore(false); } });
  }, [departmentId, positionId, search, status, gapsOnly, columnPage, view]);
  // Any change of what is asked for starts again from the first page.
  useEffect(() => { const t = setTimeout(() => load(1), search ? 300 : 0); return () => clearTimeout(t); }, [load, search]);
  // A change made by anyone refreshes the first page of the grid; a grid that was scrolled for more people is left as it is.
  useEntityChanged(["TRAINING"], () => { if (page === 1) load(1); }, { enabled: Boolean(positionId) });
  const loadMore = useCallback(() => {
    if (loading || loadingMore || !result || page >= result.pagination.totalPages) return;
    load(page + 1);
  }, [loading, loadingMore, result, page, load]);

  const columnsInView = result?.columns ?? [];

  const positionFilter: ReportSelectFilter = { id: "position", label: "Work Position", value: positionId, options: positions.map((p) => ({ label: `${p.name} (${p.peopleCount})`, value: p.id })), onChange: (v) => { setPositionId(v); setPage(1); setColumnPage(1); } };
  const filters: ReportSelectFilter[] = view === "rows" ? [departmentFilter, positionFilter] : [
    departmentFilter,
    positionFilter,
    { id: "state", label: "State", value: status, options: [{ label: "All", value: "" }, ...STATES.map((s) => ({ label: STATE_LABEL[s], value: s }))], onChange: (v) => { setStatus(v); setPage(1); } },
    { id: "gaps", label: "Gap analysis", value: gapsOnly ? "1" : "", options: [{ label: "Everyone", value: "" }, { label: "Only people with a gap", value: "1" }], onChange: (v) => { setGapsOnly(v === "1"); setPage(1); } },
  ];
  const cp = result?.columnPagination;
  const print = async () => {
    try {
      saveBlob(await trainingComplianceApi.printCompletion({ departmentId: departmentId || undefined, positionId, search: search || undefined, status: status || undefined, gapsOnly }), "training-matrix-completion.pdf");
    } catch (e) {
      setError(trainingError(e));
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {result && !result.hasEffectiveMatrix ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This department has no effective training matrix, so there is nothing to measure yet.</p>
      ) : positions.length === 0 && !error ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">The effective matrix has no Work Position yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabNav tabs={VIEWS} activeTab={view} onChange={(id) => { setView(id as "rows" | "people"); setPage(1); }} variant="pill" layoutId="completion-view" ariaLabel="Matrix completion view" tabIdPrefix="completion-view-tab" panelIdPrefix="completion-view-panel" />
            <Button size="sm" variant="outline" disabled={!positionId} onClick={() => void print()}>Print</Button>
          </div>
          <CompletionSummaryStrip summary={result?.summary} columns={columnsInView} />
          {view === "people" && <CompletionKey />}
          <ReportListToolbar
            searchPlaceholder="Search employee…"
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            filters={filters}
            dates={[]}
            hasActiveFilters={Boolean(search || (view === "people" && (status || gapsOnly)))}
            onClear={() => { setSearch(""); setStatus(""); setGapsOnly(false); setPage(1); }}
            framed={false}
            flush
            bare
          >
            {view === "rows" ? (
              <CompletionByRow columns={columnsInView} summary={result?.summary} />
            ) : (<div className="space-y-3">
            {cp && cp.totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
                <span>Matrix rows {(cp.page - 1) * cp.limit + 1}–{Math.min(cp.page * cp.limit, cp.total)} of {cp.total}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={cp.page <= 1} onClick={() => setColumnPage(cp.page - 1)}>Previous rows</Button>
                  <Button size="sm" variant="outline" disabled={cp.page >= cp.totalPages} onClick={() => setColumnPage(cp.page + 1)}>Next rows</Button>
                </span>
              </div>
            )}
            <div className="space-y-2 md:hidden">
              {people.map((p) => (
                <div key={p.personId} className="rounded-xl border border-slate-200 bg-white p-3" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 150px" }}>
                  <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-medium text-slate-900">{p.fullName}</div><div className="text-xs text-slate-500">{p.employeeCode ?? ""}</div>{(p.openReviews?.length ?? 0) > 0 && <div className="mt-1"><Badge color="amber">Review open</Badge></div>}</div><span className="text-xs text-slate-600">{p.done} / {p.required}</span></div>
                  <div className="mt-2"><Progress value={p.required ? Math.round((p.done / p.required) * 100) : 0} /></div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {columnsInView.filter((c) => !["QUALIFIED", "NOT_REQUIRED"].includes(p.cells[c.rowId]?.status ?? "QUALIFIED")).map((c) => (
                      <button key={c.rowId} type="button" onClick={() => setPicked({ person: p, column: c, cell: p.cells[c.rowId] })} className="max-w-full rounded focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <Badge color={STATE_COLOR[p.cells[c.rowId].status]}><span className="block max-w-56 truncate">{c.code ?? c.title}: {STATE_LABEL[p.cells[c.rowId].status]}</span></Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {result && people.length === 0 && !loading && <p className="p-3 text-sm text-slate-500">No person holds this Work Position, or nobody matches the filters.</p>}
              <LoadMoreSentinel onVisible={loadMore} active={Boolean(result && page < result.pagination.totalPages)} />
              {loadingMore && <p className="py-2 text-center text-xs text-slate-500">Loading more people…</p>}
            </div>
            <div className="hidden space-y-3 md:block">
              {result && people.length === 0 && !loading ? (
                <TableEmptyState title="Nothing to show" description="No person holds this Work Position, or nobody matches the filters." />
              ) : (
                <CompletionHeatmap people={people} columns={columnsInView} firstNo={1} loading={loading} loadingMore={loadingMore} onNearEnd={loadMore} onPick={(person, column, cell) => setPicked({ person, column, cell })} />
              )}
              {result && result.pagination.total > 0 && <p className="px-1 text-xs text-slate-500">{people.length} of {result.pagination.total} people loaded{people.length < result.pagination.total ? "; more load as you scroll" : ""}</p>}
            </div>
            </div>)}
          </ReportListToolbar>
        </>
      )}
      {picked && <CompletionCellDrawer departmentId={departmentId} personId={picked.person.personId} rowId={picked.column.rowId} onClose={() => setPicked(undefined)} />}
    </div>
  );
}
