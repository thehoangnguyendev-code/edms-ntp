import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Progress } from "@/components/ui/progress/Progress";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingComplianceApi, trainingError, type CompletionCell, type CompletionColumn, type CompletionPerson, type CompletionPosition, type CompletionState, type MatrixCompletion } from "@/services/api/trainingActivities";
import { day, saveBlob } from "../../shared/trainingLabels";
import { ReadonlyField, ReadonlyGrid } from "../../shared/TrainingDetailLayout";

/** Names of the six cell states. The server decides the state; these are only the labels (PLAN-TR-001 17.11, D-58 — QA may rename them). */
const STATE_LABEL: Record<CompletionState, string> = {
  NOT_REQUIRED: "Not required", REQUIRED: "Required", IN_PROGRESS: "In progress", QUALIFIED: "Qualified", UPDATE_NEEDED: "Update needed", DUE: "Annual training due",
};
const STATE_COLOR: Record<CompletionState, "slate" | "red" | "blue" | "emerald" | "amber" | "orange"> = {
  NOT_REQUIRED: "slate", REQUIRED: "red", IN_PROGRESS: "blue", QUALIFIED: "emerald", UPDATE_NEEDED: "amber", DUE: "orange",
};
const GROUP_LABEL = { FACTORY_GENERAL: "Whole factory", DEPARTMENT_GENERAL: "Department", SOP: "SOP" } as const;
const STATES = Object.keys(STATE_LABEL) as CompletionState[];

type Pick = { person: CompletionPerson; column: CompletionColumn; cell: CompletionCell };

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Legend">
      {STATES.map((s) => <Badge key={s} color={STATE_COLOR[s]}>{STATE_LABEL[s]}</Badge>)}
    </div>
  );
}

/**
 * Matrix completion of one position (SOP.0003 5.1, 5.3.8): the people who hold the position against the rows of the effective matrix that apply to it.
 * Every cell is calculated on the server from the personal training records, the open activities and the effective revision; nothing here is typed.
 */
export function ComplianceCompletionTab({ departmentId, departmentFilter }: { departmentId: string; departmentFilter: ReportSelectFilter }) {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<CompletionPosition[]>([]);
  const [positionId, setPositionId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [columnPage, setColumnPage] = useState(1);
  const [result, setResult] = useState<MatrixCompletion>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Pick>();

  useEffect(() => {
    setPositionId("");
    setResult(undefined);
    trainingComplianceApi.positions(departmentId || undefined).then((l) => { setPositions(l); const first = l.find((x) => x.peopleCount > 0) ?? l[0]; if (first) setPositionId(first.id); }).catch((e) => { setPositions([]); setError(trainingError(e)); });
  }, [departmentId]);

  const load = useCallback(() => {
    if (!positionId) return;
    setLoading(true);
    setError("");
    trainingComplianceApi
      .matrixCompletion({ departmentId: departmentId || undefined, positionId, search: search || undefined, status: status || undefined, gapsOnly, page, limit, columnPage, columnLimit: 12 })
      .then(setResult)
      .catch((e) => { setResult(undefined); setError(trainingError(e) === "TRAINING_MATRIX_TOO_LARGE" ? "This matrix or position is too large to show at once. Narrow it with the search." : trainingError(e)); })
      .finally(() => setLoading(false));
  }, [departmentId, positionId, search, status, gapsOnly, page, limit, columnPage]);
  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load, search]);

  const columnsInView = result?.columns ?? [];
  const columns: DataTableColumn<CompletionPerson>[] = useMemo(() => [
    { id: "rowNo", header: "No.", locked: true, cell: (_p, i) => (page - 1) * limit + i + 1 },
    { id: "name", header: "Employee", locked: true, cell: (p) => <div><div className="font-medium text-slate-900">{p.fullName}</div><div className="text-xs text-slate-500">{p.employeeCode ?? ""}</div>{(p.openReviews?.length ?? 0) > 0 && <div className="mt-1"><Badge color="amber" title="A training review of this person is still open">Review open</Badge></div>}</div> },
    { id: "progress", header: "Completed", cell: (p) => <div className="w-32"><Progress value={p.required ? Math.round((p.done / p.required) * 100) : 0} /><div className="mt-1 text-xs text-slate-500">{p.done} / {p.required}{p.eligibleForAssignment ? " · ready for work assignment" : ""}</div></div> },
    ...columnsInView.map<DataTableColumn<CompletionPerson>>((c) => ({
      id: `row-${c.rowId}`,
      label: `${c.code ?? ""} ${c.title}`.trim(),
      header: <div className="max-w-40 whitespace-normal text-xs"><div className="text-slate-400">{GROUP_LABEL[c.group]}{c.annual ? " · annual" : ""}</div><div>{c.code ? `${c.code} — ` : ""}{c.title}</div></div>,
      cell: (p) => {
        const cell = p.cells[c.rowId];
        if (!cell) return "—";
        return (
          <button type="button" aria-label={`${STATE_LABEL[cell.status]}: ${p.fullName}, ${c.title}`} onClick={() => setPicked({ person: p, column: c, cell })} className="rounded focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <Badge color={STATE_COLOR[cell.status]}>{STATE_LABEL[cell.status]}</Badge>
          </button>
        );
      },
    })),
  ], [columnsInView, page, limit]);
  const { layout, control } = useCustomColumnLayout("training.compliance.completion", columns);

  const filters: ReportSelectFilter[] = [
    departmentFilter,
    { id: "position", label: "Position", value: positionId, options: positions.map((p) => ({ label: `${p.name} (${p.peopleCount})`, value: p.id })), onChange: (v) => { setPositionId(v); setPage(1); setColumnPage(1); } },
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
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">The effective matrix has no position yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2"><Legend /><Button size="sm" variant="outline" disabled={!positionId} onClick={() => void print()}>Print</Button></div>
          <ReportListToolbar
            searchPlaceholder="Search employee…"
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            filters={filters}
            dates={[]}
            hasActiveFilters={Boolean(search || status || gapsOnly)}
            onClear={() => { setSearch(""); setStatus(""); setGapsOnly(false); setPage(1); }}
            customControl={control}
        framed={false}
        flush
          >
            {cp && cp.totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
                <span>Matrix rows {(cp.page - 1) * cp.limit + 1}–{Math.min(cp.page * cp.limit, cp.total)} of {cp.total}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={cp.page <= 1} onClick={() => setColumnPage(cp.page - 1)}>Previous rows</Button>
                  <Button size="sm" variant="outline" disabled={cp.page >= cp.totalPages} onClick={() => setColumnPage(cp.page + 1)}>Next rows</Button>
                </span>
              </div>
            )}
            <div className="space-y-2 p-3 md:hidden">
              {(result?.data ?? []).map((p) => (
                <div key={p.personId} className="rounded-xl border border-slate-200 bg-white p-3">
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
              {result && result.data.length === 0 && !loading && <p className="p-3 text-sm text-slate-500">No person holds this position, or nobody matches the filters.</p>}
            </div>
            <div className="hidden md:block">
            <DataTable
              rows={result?.data ?? []}
              getRowKey={(p) => p.personId}
              isLoading={loading}
              loadingContent={<SectionLoading text="Loading…" />}
              columns={columns}
              columnLayout={layout}
              emptyState={<TableEmptyState title="Nothing to show" description="No person holds this position, or nobody matches the filters." />}
              pagination={result && result.pagination.total > 0 ? (
                <TablePagination currentPage={result.pagination.page} totalPages={result.pagination.totalPages} totalItems={result.pagination.total} itemsPerPage={result.pagination.limit} onPageChange={setPage} onItemsPerPageChange={(n) => { setLimit(n); setPage(1); }} />
              ) : undefined}
            />
            </div>
          </ReportListToolbar>
        </>
      )}
      {picked && (
        <Drawer
          title={picked.column.title}
          subtitle={picked.person.fullName}
          onClose={() => setPicked(undefined)}
          footer={picked.cell.activityId ? <Button onClick={() => navigate(`/training-management/activities/${picked.cell.activityId}`)}>Open the training</Button> : undefined}
        >
          <ReadonlyGrid>
            <ReadonlyField label="State"><div><Badge color={STATE_COLOR[picked.cell.status]}>{STATE_LABEL[picked.cell.status]}</Badge></div></ReadonlyField>
            <ReadonlyField label="Last trained" value={day(picked.cell.lastDoneOn) || "—"} />
            <ReadonlyField label="Revision trained" value={picked.cell.lastRevision ?? "—"} />
            <ReadonlyField label="Current effective revision" value={picked.column.currentRevision ?? "—"} />
            <ReadonlyField label="Annual training" value={picked.column.annual ? "Required" : "Not required"} />
          </ReadonlyGrid>
        </Drawer>
      )}
    </div>
  );
}
