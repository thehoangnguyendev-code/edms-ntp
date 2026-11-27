import { useEffect, useState, type ReactNode } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { trainingComplianceApi, trainingError, type TrainingComplianceSummary, type TrainingComplianceSummaryPosition } from "@/services/api/trainingActivities";
import { saveBlob } from "../../shared/trainingLabels";
import { usePrintAction, type RegisterPrint } from "../usePrintAction";
import { tr, trFormat } from "@/i18n";

const percent = (value: number | null | undefined) => (value == null ? "—" : `${Math.round(value)}%`);
const BAR = { ok: "bg-emerald-500", due: "bg-amber-500", updateNeeded: "bg-amber-300", missing: "bg-red-500" };

/** One number of the department with its colour bar on the left; the number is big because the page is read for it. */
function Stat({ value, label, tone }: { value: ReactNode; label: string; tone: "green" | "red" | "amber" | "slate" }) {
  const bar = { green: "border-emerald-600", red: "border-red-600", amber: "border-amber-500", slate: "border-slate-300" }[tone];
  return (
    <div className={`border-l-[3px] pl-3 ${bar}`}>
      <div className="text-3xl font-semibold leading-none tabular-nums text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
      {label} <b className={`tabular-nums ${value > 0 ? "text-slate-900" : "text-slate-400"}`}>{value}</b>
    </li>
  );
}

/** Trained, annual training due and not trained as shares of the requirement lines of one position, drawn from the numbers the server counted. */
function CoverageBar({ position }: { position: TrainingComplianceSummaryPosition }) {
  const total = position.ok + position.due + (position.updateNeeded ?? 0) + position.missing;
  const label = `${tr("Trained")}: ${position.ok}, ${tr("Annual training due")}: ${position.due}, ${tr("New revision not trained")}: ${position.updateNeeded ?? 0}, ${tr("Not trained")}: ${position.missing}`;
  return (
    <div role="img" aria-label={label} title={label} className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-slate-100">
      {total > 0 && ([["ok", position.ok], ["due", position.due], ["updateNeeded", position.updateNeeded ?? 0], ["missing", position.missing]] as const).filter(([, n]) => n > 0).map(([key, n]) => (
        <span key={key} className={BAR[key]} style={{ width: `${(n / total) * 100}%` }} />
      ))}
    </div>
  );
}

/** The numbers of one department at a glance, then every Work Position side by side, the lowest first. Everything is computed by the server from the effective matrix, the positions and the records. */
export function ComplianceSummaryTab({ departmentId, departments, onDepartment, registerPrint }: {
  departmentId: string;
  departments: { label: string; value: string }[];
  onDepartment: (id: string) => void;
  registerPrint?: RegisterPrint;
}) {
  const [summary, setSummary] = useState<TrainingComplianceSummary>();
  const [error, setError] = useState("");

  useEffect(() => {
    setSummary(undefined);
    setError("");
    trainingComplianceApi.summary(departmentId || undefined).then(setSummary).catch((e) => setError(trainingError(e)));
  }, [departmentId]);
  // A change made by anyone refreshes the figures in place.
  useEntityChanged(["TRAINING"], () => { trainingComplianceApi.summary(departmentId || undefined).then(setSummary).catch(() => undefined); });

  const print = async () => {
    try {
      saveBlob(await trainingComplianceApi.printSummary({ departmentId: departmentId || undefined }), "training-compliance-summary.pdf");
    } catch (e) {
      setError(trainingError(e));
    }
  };
  usePrintAction(registerPrint, Boolean(summary?.hasEffectiveMatrix), print);
  const positions = summary?.positions ?? [];

  const columns: DataTableColumn<TrainingComplianceSummaryPosition>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, cell: (_p, i) => i + 1 },
    { id: "name", header: tr("Work Position"), label: tr("Work Position"), cellClassName: "min-w-56 whitespace-normal font-medium text-slate-900", cell: (p) => p.name },
    { id: "people", header: "People", label: "People", headerClassName: "text-right", cellClassName: "text-right tabular-nums", cell: (p) => p.people },
    { id: "coverage", header: "Coverage", label: "Coverage", cellClassName: "min-w-48", cell: (p) => <CoverageBar position={p} /> },
    { id: "missing", header: tr("Not trained"), label: tr("Not trained"), headerClassName: "text-right", cellClassName: (p) => `text-right tabular-nums ${p.missing > 0 ? "text-red-700" : ""}`, cell: (p) => p.missing },
    { id: "updateNeeded", header: tr("New revision"), label: tr("New revision"), headerClassName: "text-right", cellClassName: "text-right tabular-nums", cell: (p) => p.updateNeeded ?? 0 },
    { id: "due", header: "Due", label: "Due", headerClassName: "text-right", cellClassName: "text-right tabular-nums", cell: (p) => p.due },
    { id: "met", header: "Met", label: "Met", headerClassName: "text-right", cellClassName: (p) => `text-right font-semibold tabular-nums ${(p.percentTrained ?? 100) < 60 ? "text-red-700" : "text-slate-900"}`, cell: (p) => percent(p.percentTrained) },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="w-full lg:w-72"><Select label={tr("Department")} value={departmentId} options={departments} onChange={onDepartment} /></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!summary ? (
        !error && <SectionLoading text="Loading…" />
      ) : !summary.hasEffectiveMatrix ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{tr("This department has no effective training matrix, so there is nothing to measure yet.")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-5">
            <Stat value={percent(summary.percentTrained)} label={trFormat("requirements met · {ok} / {required}", { ok: summary.ok, required: summary.required })} tone="green" />
            <Stat value={summary.missing} label={tr("not trained")} tone={summary.missing > 0 ? "red" : "slate"} />
            <Stat value={summary.updateNeeded ?? 0} label={tr("new revision not trained")} tone={(summary.updateNeeded ?? 0) > 0 ? "amber" : "slate"} />
            <Stat value={summary.due} label={tr("annual training due")} tone={summary.due > 0 ? "amber" : "slate"} />
            <Stat value={summary.overdueActivities} label={tr("overdue trainings")} tone={summary.overdueActivities > 0 ? "red" : "slate"} />
          </div>
          <ul className="flex flex-wrap gap-2" aria-label={tr("Also needs attention")}>
            <Chip label={tr("Without a Work Position")} value={summary.peopleWithoutPosition} />
            <Chip label={tr("Department not in the dictionary")} value={summary.peopleWithoutDepartment ?? 0} />
            <Chip label={tr("Open reviews")} value={summary.openReviews ?? 0} />
            <Chip label={tr("Beyond SOP window")} value={summary.linesBeyondSopWindow ?? 0} />
            <Chip label={tr("Due in 14 days")} value={summary.dueSoonActivities} />
            <Chip label={tr("New employees")} value={summary.newEmployees ?? 0} />
          </ul>
          <section className="space-y-2">
            <h3 className="text-2xs font-semibold uppercase tracking-wide text-slate-600 md:text-xs">{tr("Work positions · lowest first")}</h3>
            <div className="hidden md:block">
              <DataTable rows={positions} columns={columns} getRowKey={(p) => p.id} emptyState={<TableEmptyState title={tr("Nothing to show")} description={tr("The effective matrix has no Work Position yet.")} />} />
            </div>
            <ul className="space-y-2 md:hidden">
              {positions.map((p) => (
                <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium text-slate-900">{p.name}</span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${(p.percentTrained ?? 100) < 60 ? "text-red-700" : "text-slate-900"}`}>{percent(p.percentTrained)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{trFormat("{count} people", { count: p.people })} · {p.missing} {tr("not trained")} · {p.updateNeeded ?? 0} {tr("new revision not trained")} · {p.due} {tr("Due").toLowerCase()}</p>
                  <div className="mt-2"><CoverageBar position={p} /></div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
