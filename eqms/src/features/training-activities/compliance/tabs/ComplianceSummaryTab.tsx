import { useEffect, useState, type ReactNode } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { IconAlertTriangle, IconCalendarDue, IconClipboardCheck, IconUserOff, IconUsers } from "@tabler/icons-react";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingComplianceApi, trainingError, type TrainingComplianceSummary } from "@/services/api/trainingActivities";

type Tone = "emerald" | "amber" | "red" | "slate";
const TONE: Record<Tone, { dot: string; icon: string; value: string }> = {
  emerald: { dot: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600", value: "text-slate-900" },
  amber: { dot: "bg-amber-500", icon: "bg-amber-50 text-amber-600", value: "text-slate-900" },
  red: { dot: "bg-red-500", icon: "bg-red-50 text-red-600", value: "text-red-700" },
  slate: { dot: "bg-slate-400", icon: "bg-slate-100 text-slate-500", value: "text-slate-900" },
};

function Tile({ icon, label, value, hint, tone = "slate" }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE[tone].icon}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className={`mt-0.5 text-2xl font-semibold leading-tight ${TONE[tone].value}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Trained, due and not trained as shares of every requirement of the department, drawn from the numbers the server counted. */
function CoverageCard({ summary }: { summary: TrainingComplianceSummary }) {
  const parts: { key: string; label: string; value: number; tone: Tone }[] = [
    { key: "ok", label: "Trained", value: summary.ok, tone: "emerald" },
    { key: "due", label: "Annual training due", value: summary.due, tone: "amber" },
    { key: "missing", label: "Not trained", value: summary.missing, tone: "red" },
  ];
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">Requirements met</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-semibold leading-none text-slate-900">{summary.percentTrained == null ? "—" : `${summary.percentTrained}%`}</span>
            <span className="text-sm text-slate-500">{summary.ok} of {summary.required} requirements</span>
          </div>
        </div>
      </div>
      <div
        className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}
      >
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.key} className={`h-full first:rounded-l-full last:rounded-r-full ${TONE[p.tone].dot}`} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE[p.tone].dot}`} />
            <span className="text-sm text-slate-600">{p.label}</span>
            <span className="ml-auto text-sm font-semibold text-slate-900">{p.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The numbers of one department at a glance. Everything is computed by the server from the effective matrix, the positions and the records. */
export function ComplianceSummaryTab({ departmentId, departments, onDepartment }: {
  departmentId: string;
  departments: { label: string; value: string }[];
  onDepartment: (id: string) => void;
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

  return (
    <div className="space-y-6">
      <div className="w-full md:w-80">
        <Select label="Department" value={departmentId} options={[{ label: "My department", value: "" }, ...departments]} onChange={onDepartment} />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!summary ? (
        !error && <SectionLoading text="Loading…" />
      ) : !summary.hasEffectiveMatrix ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This department has no effective training matrix, so there is nothing to measure yet.</p>
      ) : (
        <>
          <CoverageCard summary={summary} />
          <Group title="People">
            <Tile icon={<IconUsers className="h-5 w-5" />} label="People with a position" value={summary.people} hint="Counted against the effective matrix" />
            <Tile icon={<IconClipboardCheck className="h-5 w-5" />} label="Open training reviews" value={summary.openReviews ?? 0} tone={(summary.openReviews ?? 0) > 0 ? "amber" : "slate"} hint="New employees, returns after absence and transfers still being worked through" />
            <Tile
              icon={<IconUserOff className="h-5 w-5" />}
              label="People without a position"
              value={summary.peopleWithoutPosition}
              tone={summary.peopleWithoutPosition > 0 ? "amber" : "slate"}
              hint={summary.peopleWithoutPosition > 0 ? "Set their position so their requirements can be measured" : "Everyone has a position"}
            />
          </Group>
          <Group title="Trainings">
            <Tile
              icon={<IconAlertTriangle className="h-5 w-5" />}
              label="Overdue trainings"
              value={summary.overdueActivities}
              tone={summary.overdueActivities > 0 ? "red" : "slate"}
              hint={summary.overdueActivities > 0 ? "Past their due date and not yet completed" : "None past their due date"}
            />
            <Tile icon={<IconCalendarDue className="h-5 w-5" />} label="Due in 14 days" value={summary.dueSoonActivities} tone={summary.dueSoonActivities > 0 ? "amber" : "slate"} hint="Open trainings coming due" />
          </Group>
        </>
      )}
    </div>
  );
}
