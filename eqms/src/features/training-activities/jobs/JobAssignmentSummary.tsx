import { AlertTriangle, CheckCircle2, CircleAlert, ClipboardCheck, ListChecks, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import type { TrainingEligibility, TrainingPerson } from "@/services/api/trainingActivities";
import { tr, trFormat } from "@/i18n";

export type CheckState = "idle" | "loading" | "error" | "ready";

export interface Chip { id: string; label: string }

/** The chosen things of a job assignment, each one removable. */
export function Chips({ items, empty, onRemove }: { items: Chip[]; empty: string; onRemove?: (id: string) => void }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-emerald-700">
          <span className="truncate" title={item.label}>{item.label}</span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(item.id)} aria-label={trFormat("Remove {name}", { name: item.label })} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-emerald-100">
              <X className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const SOURCE_LABEL: Record<string, string> = { CHOSEN: "Chosen", FACTORY: "All employees", ALL_EMPLOYEES: "All employees", MATRIX: "Matrix" };

/** What the person still misses for what is chosen, as the server checked it. */
export function TrainingCheck({ state, check, onRetry }: { state: CheckState; check?: TrainingEligibility; onRetry: () => void }) {
  if (state === "loading")
    return (
      <div className="space-y-2" role="status" aria-label={tr("Loading...")}>
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
      </div>
    );
  if (state === "error")
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <CircleAlert className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">{tr("The training check could not be made.")}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>{tr("Try again")}</Button>
      </div>
    );
  if (state === "idle" || !check)
    return <p className="text-sm text-slate-500">{tr("Choose an employee and a Work Position to see the training check.")}</p>;

  const open = check.items.filter((i) => !i.lastDone);
  const missing = check.matrixMissing || (check.missingCount ?? 0) > 0;
  return (
    <div role="status" className="space-y-2">
      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${missing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        {missing ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          {check.matrixMissing ? (
            tr("The department has no effective matrix: an exception is needed to go ahead.")
          ) : (check.missingCount ?? 0) === 0 ? (
            trFormat("Training check: complete ({count} required).", { count: check.items.length })
          ) : (
            <>
              <p className="font-medium">{trFormat("Not trained yet ({missing} of {total}).", { missing: check.missingCount ?? 0, total: check.items.length })}</p>
              <p className="text-xs">{tr("The assignment cannot be signed until they are done, or an exception is approved:")}</p>
            </>
          )}
        </div>
      </div>
      {!check.matrixMissing && open.length > 0 && (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
          {open.map((i) => (
            <li key={`${i.code}|${i.title}`} className="py-2 text-sm">
              <div className="font-medium text-slate-800">{i.title}</div>
              <div className="text-xs text-slate-500">{[i.code, i.source ? tr(SOURCE_LABEL[i.source] ?? i.source) : ""].filter(Boolean).join(" · ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The side card of steps 1 and 2: who, what is held, what is chosen, and what is still missing. */
export function JobAssignmentSummary({ person, held, positions, trainings, onRemovePosition, onRemoveTraining, checkState, check, onRetry }: {
  person?: TrainingPerson;
  held: string[];
  positions: Chip[];
  trainings: Chip[];
  onRemovePosition?: (id: string) => void;
  onRemoveTraining?: (id: string) => void;
  checkState: CheckState;
  check?: TrainingEligibility;
  onRetry: () => void;
}) {
  return (
    <>
      <FormSection title={tr("Summary")} icon={<ListChecks className="h-4 w-4" />}>
        <div className="space-y-4">
          {person ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={person.fullName} src={person.avatar} tone="brand" className="h-9 w-9 text-xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{person.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{[person.employeeCode, person.department].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">{tr("Holds now")}</p>
                {held.length ? <div className="flex flex-wrap gap-2">{held.map((name) => <Badge key={name} color="slate">{name}</Badge>)}</div> : <p className="text-sm text-slate-500">{tr("None yet")}</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">{tr("No employee chosen")}</p>
          )}
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs text-slate-500">{tr("Work Positions")}</p>
            <Chips items={positions} empty={tr("No Work Position selected")} onRemove={onRemovePosition} />
          </div>
          {trainings.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs text-slate-500">{tr("Other Trainings")}</p>
              <Chips items={trainings} empty="" onRemove={onRemoveTraining} />
            </div>
          )}
        </div>
      </FormSection>
      <FormSection title={tr("Training check")} icon={<ClipboardCheck className="h-4 w-4" />}>
        <TrainingCheck state={checkState} check={check} onRetry={onRetry} />
      </FormSection>
    </>
  );
}
