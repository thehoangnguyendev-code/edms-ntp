import { TrainingPersonName } from "../../shared/TrainingPersonName";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingActivitiesApi, trainingComplianceApi, trainingError, type TrainingGap, type TrainingPlannedSession } from "@/services/api/trainingActivities";
import { day } from "@/features/training-activities/shared/trainingLabels";

const STATUS_LABEL: Record<string, string> = { MISSING: "Not trained", DUE: "Annual training due", OK: "Trained" };
const STATUS_COLOR: Record<string, "red" | "amber" | "emerald"> = { MISSING: "red", DUE: "amber", OK: "emerald" };
const trainingKey = (g: TrainingGap) => `${g.code ?? ""}|${g.title}`;
const rowKey = (g: TrainingGap) => `${g.pid}|${trainingKey(g)}`;

/**
 * Every requirement of the effective matrix for every employee of the department, one line each, with what is missing or due. The rows for all employees (the factory-wide ones that Quality
 * Assurance requires, and the department-wide ones the head of department ticked) apply to every employee, with or without a Work Position; the others to the holders of the Work Position. A new
 * employee has a blue mark, a person without a Work Position an amber one. People who miss the same training can be chosen and added to a planned training activity, or a new one is started for them.
 */
export function ComplianceGapsTab({ departmentId, departmentFilter }: { departmentId: string; departmentFilter: ReportSelectFilter }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canOrganize = hasPermission("training.activity.organize");
  const [status, setStatus] = usePersistedState("training.compliance.gaps.status", "");
  const [fresh, setFresh] = usePersistedState("training.compliance.gaps.new", "");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Record<string, TrainingGap>>({});
  const [adding, setAdding] = useState(false);
  const [planned, setPlanned] = useState<TrainingPlannedSession[]>();
  const [busy, setBusy] = useState("");

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      trainingComplianceApi.coverage(params as Record<string, string | number | undefined>).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [],
  );
  const extra = useMemo(() => ({ departmentId: departmentId || undefined, status: status || undefined, newOnly: fresh === "yes" ? true : undefined }), [departmentId, status, fresh]);
  const table = useServerTable<TrainingGap>({ persistKey: "training.compliance.gaps", liveTypes: ["TRAINING"], fetcher, defaultSortBy: "status", extraParams: extra, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  // what is chosen: lines that miss the same training (a person is added to a session of one training)
  const chosen = Object.values(picked);
  const sameTraining = chosen.length > 0 && chosen.every((g) => trainingKey(g) === trainingKey(chosen[0]));
  const shown = table.items.filter((g) => g.status !== "OK");
  const allShown = shown.length > 0 && shown.every((g) => picked[rowKey(g)]);
  const toggle = (g: TrainingGap) => setPicked((old) => { const next = { ...old }; if (next[rowKey(g)]) delete next[rowKey(g)]; else next[rowKey(g)] = g; return next; });
  const toggleAll = () => setPicked((old) => { const next = { ...old }; if (allShown) shown.forEach((g) => delete next[rowKey(g)]); else shown.forEach((g) => { next[rowKey(g)] = g; }); return next; });

  useEffect(() => {
    setPlanned(undefined);
    if (!adding || chosen.length === 0) return;
    trainingComplianceApi.plannedTrainings({ topicName: chosen[0].tname ?? undefined, documentNumber: chosen[0].dnum ?? undefined }).then(setPlanned).catch((e) => { setError(trainingError(e)); setPlanned([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding]);
  const allNew = chosen.length > 0 && chosen.every((g) => g.isNew);
  const addTo = async (session: TrainingPlannedSession) => {
    setBusy(session.sessionId);
    try {
      await trainingActivitiesApi.addParticipants(session.activityId, { sessionId: session.sessionId, personUserIds: [...new Set(chosen.map((g) => g.pid))], reason: allNew ? "Initial training of new employees" : "Training required by the matrix" });
      showToast({ type: "success", title: "Added to the training", message: `${new Set(chosen.map((g) => g.pid)).size} people, ${session.trainingNumber}` });
      setPicked({});
      setAdding(false);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The people were not added", message: trainingError(e) });
    } finally {
      setBusy("");
    }
  };
  const create = () => {
    const first = chosen[0];
    const people = [...new Map(chosen.map((g) => [g.pid, g])).values()];
    const query = new URLSearchParams();
    if (allNew) query.set("kind", "INITIAL");
    query.set("topic", first.tname ?? first.title);
    for (const p of people) { query.append("person", p.pid); query.append("personName", p.fullName); query.append("personCode", p.employeeCode ?? ""); }
    query.set("reason", allNew ? "Initial training of new employees" : "Training required by the matrix");
    navigate(`/training-management/activities/new?${query.toString()}`);
  };

  const columns: DataTableColumn<TrainingGap>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (g) => g.employeeCode ?? "—" },
    {
      id: "name", header: "Full Name", sort: sorted("fullName"),
      cell: (g) => (
        <div className="flex flex-wrap items-center gap-2">
          <TrainingPersonName fullName={g.fullName} avatar={g.avatar} />
          {g.isNew && <Badge color="blue">New employee</Badge>}
          {g.noRole && <Badge color="amber">No Work Position</Badge>}
        </div>
      ),
    },
    { id: "position", header: "Work Position", sort: sorted("positionName"), cell: (g) => g.positionName ?? "—" },
    { id: "topic", header: "Required training", sort: sorted("title"), cell: (g) => <div className="max-w-80 whitespace-normal">{g.code ? `${g.code} — ` : ""}{g.title}{g.allEmployees && <Badge color="slate" size="sm">All employees</Badge>}</div> },
    { id: "annual", header: "Annual", sort: sorted("annualRequired"), cell: (g) => (g.annualRequired ? "Yes" : "No") },
    { id: "last", header: "Last trained", sort: sorted("lastDone"), cell: (g) => day(g.lastDone) },
    { id: "status", header: "Status", sort: sorted("status"), cell: (g) => <Badge color={STATUS_COLOR[g.status]}>{STATUS_LABEL[g.status]}</Badge> },
  ];
  const { layout, control } = useCustomColumnLayout("training.compliance.coverage", columns);
  const filters: ReportSelectFilter[] = [
    departmentFilter,
    { id: "status", label: "Status", value: status, options: [{ label: "All", value: "" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ label, value }))], onChange: (v) => { setStatus(v); table.setCurrentPage(1); } },
    { id: "new", label: "Employees", value: fresh, options: [{ label: "All", value: "" }, { label: "New employees only", value: "yes" }], onChange: (v) => { setFresh(v); table.setCurrentPage(1); } },
  ];
  const selection = canOrganize ? {
    visible: true,
    header: <Checkbox checked={allShown} onChange={toggleAll} aria-label="Select the lines shown that are not done" />,
    cell: (g: TrainingGap) => (g.status === "OK" ? null : <Checkbox checked={Boolean(picked[rowKey(g)])} onChange={() => toggle(g)} aria-label={`Select ${g.fullName}: ${g.title}`} />),
  } : undefined;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        <Badge color="blue">New employee</Badge> started in the last days that Training Properties allows. <Badge color="amber">No Work Position</Badge> has no Work Position yet: only the trainings for all employees apply until a job assignment gives one.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {canOrganize && chosen.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>{chosen.length} line{chosen.length === 1 ? "" : "s"} chosen{sameTraining ? "" : ". Choose people who miss the same training to add them to a training."}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline-emerald" onClick={() => setPicked({})}>Clear</Button>
            <Button size="sm" disabled={!sameTraining} onClick={() => setAdding(true)}>Add to a Training</Button>
          </span>
        </div>
      )}
      <ReportListToolbar
        searchPlaceholder="Search employee or training…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(status || fresh || table.searchQuery)}
        onClear={() => { setStatus(""); setFresh(""); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
        framed={false}
        flush
      >
        <DataTable
          rows={table.items}
          getRowKey={(g) => rowKey(g)}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          selection={selection}
          emptyState={<TableEmptyState title="Nothing to show" description="The department needs an effective matrix; the rows for all employees apply to everyone, the others to the holders of a Work Position." />}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </ReportListToolbar>

      <FormModal isOpen={adding} onClose={() => setAdding(false)} onConfirm={() => setAdding(false)} confirmText="Close" size="xl" title={chosen[0] ? `Add to a training: ${chosen[0].title}` : "Add to a training"}
        description={`${new Set(chosen.map((g) => g.pid)).size} people miss this training. Add them to a planned training (the list is not confirmed yet), or start a new training for them. Quality Assurance gives the training number of the initial and periodic training.`}>
        {!planned ? <SectionLoading text="Loading…" /> : (
          <div className="space-y-3">
            {planned.length === 0 && <p className="text-sm text-slate-500">No planned training covers it yet.</p>}
            {planned.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {planned.map((a) => (
                  <li key={a.sessionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                    <div className="min-w-0">
                      <button type="button" className="font-medium text-emerald-700 hover:underline" onClick={() => navigate(`/training-management/activities/${a.activityId}`)}>{a.trainingNumber}</button>
                      <span className="ml-2 text-slate-800">{a.trainingTopics}</span>
                      <span className="ml-2 text-xs text-slate-500">Session {a.sessionNo}{a.scheduledOn ? `, ${day(a.scheduledOn)}` : ""}, {a.participants} people</span>
                    </div>
                    {a.canAdd ? <Button size="sm" loading={busy === a.sessionId} onClick={() => void addTo(a)}>Add to This Training</Button> : <Badge color="slate">The list is confirmed</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <div><Button size="sm" variant="outline-emerald" onClick={create}>Create a Training for Them</Button></div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
