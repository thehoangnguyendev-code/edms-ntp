import { useCallback, useEffect, useRef, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { CompletionHeatmap, CompletionKey } from "../components/CompletionHeatmap";
import { CompletionByRow } from "../components/CompletionByRow";
import { Progress } from "@/components/ui/progress/Progress";
import { Select } from "@/components/ui/select/Select";
import { usePrintAction, type RegisterPrint } from "../usePrintAction";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingComplianceApi, trainingError, type CompletionCell, type CompletionColumn, type CompletionPerson, type CompletionPosition, type CompletionState, type MatrixCompletion } from "@/services/api/trainingActivities";
import { saveBlob } from "../../shared/trainingLabels";
import { CompletionCellDrawer } from "../components/CompletionCellDrawer";
import { tr, trFormat } from "@/i18n";

/** Names of the six cell states. The server decides the state; these are only the labels (PLAN-TR-001 17.11, D-58 — QA may rename them). */
const STATE_LABEL: Record<CompletionState, string> = {
  NOT_REQUIRED: "Not required", REQUIRED: "Required", IN_PROGRESS: "In Progress", QUALIFIED: "Qualified", UPDATE_NEEDED: "Update needed", DUE: "Annual training due",
};
const STATE_COLOR: Record<CompletionState, "slate" | "red" | "blue" | "emerald" | "amber" | "orange"> = {
  NOT_REQUIRED: "slate", REQUIRED: "red", IN_PROGRESS: "blue", QUALIFIED: "emerald", UPDATE_NEEDED: "amber", DUE: "orange",
};
const STATES = Object.keys(STATE_LABEL) as CompletionState[];
/** The small square of one cell on the phone card: the same six states as the grid, without the words. */
const DOT: Record<CompletionState, string> = { NOT_REQUIRED: "bg-slate-100", REQUIRED: "bg-red-400", IN_PROGRESS: "bg-sky-400", QUALIFIED: "bg-emerald-500", UPDATE_NEEDED: "bg-amber-400", DUE: "bg-orange-400" };

const VIEWS: TabItem[] = [{ id: "rows", label: tr("By matrix row") }, { id: "people", label: "By person" }];

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
export function ComplianceCompletionTab({ departmentId, departmentFilter, registerPrint }: { departmentId: string; departmentFilter: ReportSelectFilter; registerPrint?: RegisterPrint }) {
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
    trainingComplianceApi.positions(departmentId || undefined).then((l) => { setPositions(l); const first = l.find((x) => x.peopleCount > 0 && x.rowCount > 0) ?? l.find((x) => x.peopleCount > 0) ?? l[0]; if (first) setPositionId(first.id); }).catch((e) => { setPositions([]); setError(trainingError(e)); });
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

  const choosePosition = (id: string) => { setPositionId(id); setPage(1); setColumnPage(1); };
  // done / required of each row over everyone of the position, from the totals the server counted (not only the people loaded)
  const totals = Object.fromEntries(Object.entries(result?.summary?.rows ?? {}).map(([rowId, r]) => {
    const c = r.counts;
    return [rowId, { done: c.QUALIFIED ?? 0, required: (c.QUALIFIED ?? 0) + (c.IN_PROGRESS ?? 0) + (c.UPDATE_NEEDED ?? 0) + (c.DUE ?? 0) + (c.REQUIRED ?? 0) }];
  }));
  const viewSwitch = <TabNav tabs={VIEWS} activeTab={view} onChange={(id) => { setView(id as "rows" | "people"); setPage(1); }} variant="pill" layoutId="completion-view" ariaLabel="Matrix completion view" tabIdPrefix="completion-view-tab" panelIdPrefix="completion-view-panel" />;
  const filters: ReportSelectFilter[] = view === "rows" ? [] : [
    { id: "state", label: "State", value: status, options: [{ label: "All", value: "" }, ...STATES.map((s) => ({ label: STATE_LABEL[s], value: s }))], onChange: (v) => { setStatus(v); setPage(1); } },
    { id: "gaps", label: tr("Gap analysis"), value: gapsOnly ? "1" : "", options: [{ label: "Everyone", value: "" }, { label: tr("Only people with a gap"), value: "1" }], onChange: (v) => { setGapsOnly(v === "1"); setPage(1); } },
  ];
  const cp = result?.columnPagination;
  const print = async () => {
    try {
      saveBlob(await trainingComplianceApi.printCompletion({ departmentId: departmentId || undefined, positionId, search: search || undefined, status: status || undefined, gapsOnly }), "training-matrix-completion.pdf");
    } catch (e) {
      setError(trainingError(e));
    }
  };

  usePrintAction(registerPrint, Boolean(positionId), print);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {result && !result.hasEffectiveMatrix ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{tr("This department has no effective training matrix, so there is nothing to measure yet.")}</p>
      ) : positions.length === 0 && !error ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{tr("The effective matrix has no Work Position yet.")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="w-full sm:w-64"><Select label={departmentFilter.label} value={departmentFilter.value} options={departmentFilter.options} onChange={(v) => departmentFilter.onChange(String(v))} /></div>
            <div className="w-full sm:w-72"><Select label={tr("Work Position")} value={positionId} options={positions.map((p) => ({ label: `${p.name} (${p.peopleCount})`, value: p.id }))} onChange={(v) => choosePosition(String(v))} enableSearch /></div>
          </div>
          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
            {view === "people" ? <CompletionKey /> : <span />}
            <div className="w-full md:w-auto md:min-w-72">{viewSwitch}</div>
          </div>
          <ReportListToolbar
            searchPlaceholder={tr("Search employee…")}
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
                <span>{trFormat("Matrix rows {from}–{to} of {total}", { from: (cp.page - 1) * cp.limit + 1, to: Math.min(cp.page * cp.limit, cp.total), total: cp.total })}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={cp.page <= 1} onClick={() => setColumnPage(cp.page - 1)}>{tr("Previous rows")}</Button>
                  <Button size="sm" variant="outline" disabled={cp.page >= cp.totalPages} onClick={() => setColumnPage(cp.page + 1)}>{tr("Next rows")}</Button>
                </span>
              </div>
            )}
            <div className="space-y-2 md:hidden">
              {people.map((p) => (
                <div key={p.personId} className="rounded-xl border border-slate-200 bg-white p-3" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 150px" }}>
                  <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-medium text-slate-900">{p.fullName}</div><div className="text-xs text-slate-500">{p.employeeCode ?? ""}</div>{(p.openReviews?.length ?? 0) > 0 && <div className="mt-1"><Badge color="amber">{tr("Review open")}</Badge></div>}</div><span className="text-xs text-slate-600">{p.done} / {p.required}</span></div>
                  <div className="mt-2"><Progress value={p.required ? Math.round((p.done / p.required) * 100) : 0} /></div>
                  <div className="mt-2 flex gap-0.5" aria-hidden="true">
                    {columnsInView.map((c) => <span key={c.rowId} className={`h-2.5 max-w-6 flex-1 rounded-sm ${DOT[p.cells[c.rowId]?.status ?? "NOT_REQUIRED"]}`} />)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {columnsInView.filter((c) => !["QUALIFIED", "NOT_REQUIRED"].includes(p.cells[c.rowId]?.status ?? "QUALIFIED")).map((c) => (
                      <button key={c.rowId} type="button" onClick={() => setPicked({ person: p, column: c, cell: p.cells[c.rowId] })} className="max-w-full rounded focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <Badge color={STATE_COLOR[p.cells[c.rowId].status]}><span className="block max-w-56 truncate">{c.code ?? c.title}: {STATE_LABEL[p.cells[c.rowId].status]}</span></Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {result && people.length === 0 && !loading && <p className="p-3 text-sm text-slate-500">{tr("No person holds this Work Position, or nobody matches the filters.")}</p>}
              <LoadMoreSentinel onVisible={loadMore} active={Boolean(result && page < result.pagination.totalPages)} />
              {loadingMore && <p className="py-2 text-center text-xs text-slate-500">{tr("Loading more people…")}</p>}
            </div>
            <div className="hidden space-y-3 md:block">
              {result && people.length === 0 && !loading ? (
                <TableEmptyState title={tr("Nothing to show")} description={tr("No person holds this Work Position, or nobody matches the filters.")} />
              ) : (
                <CompletionHeatmap people={people} columns={columnsInView} firstNo={1} loading={loading} loadingMore={loadingMore} onNearEnd={loadMore} totals={totals} onPick={(person, column, cell) => setPicked({ person, column, cell })} />
              )}
              {result && result.pagination.total > 0 && <p className="px-1 text-xs text-slate-500">{result.summary ? `${trFormat("{count} people", { count: result.summary.people })} · ${trFormat("{ready} ready", { ready: result.summary.ready })} · ${trFormat("{count} with a gap", { count: result.summary.withGap })} · ` : ""}{trFormat("{loaded} of {total} people loaded", { loaded: people.length, total: result.pagination.total })}{people.length < result.pagination.total ? tr("; more load as you scroll") : ""}</p>}
            </div>
            </div>)}
          </ReportListToolbar>
        </>
      )}
      {picked && <CompletionCellDrawer departmentId={departmentId} personId={picked.person.personId} rowId={picked.column.rowId} onClose={() => setPicked(undefined)} />}
    </div>
  );
}
