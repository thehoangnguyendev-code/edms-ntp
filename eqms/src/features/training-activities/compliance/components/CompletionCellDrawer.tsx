import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingComplianceApi, trainingError, type CompletionCellDetail, type CompletionState } from "@/services/api/trainingActivities";
import { METHOD_LABEL, STATUS_COLOR, STATUS_LABEL, day } from "../../shared/trainingLabels";

const STATE_LABEL: Record<CompletionState, string> = { NOT_REQUIRED: "Not required", REQUIRED: "Required", IN_PROGRESS: "In progress", QUALIFIED: "Qualified", UPDATE_NEEDED: "Update needed", DUE: "Annual training due" };
const STATE_COLOR: Record<CompletionState, "slate" | "red" | "blue" | "emerald" | "amber" | "orange"> = { NOT_REQUIRED: "slate", REQUIRED: "red", IN_PROGRESS: "blue", QUALIFIED: "emerald", UPDATE_NEEDED: "amber", DUE: "orange" };
const GROUP_LABEL = { FACTORY_GENERAL: "General training of the whole factory", DEPARTMENT_GENERAL: "General training of the department", SOP: "SOP of the position" } as const;
const RESULT_LABEL: Record<string, string> = { PASSED: "Passed", READ: "Read and understood", ATTENDED: "Attended" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

/** Everything behind one cell of the matrix completion grid: the requirement, why the cell is in this state, the records of the person for it and the open trainings. */
export function CompletionCellDrawer({ departmentId, personId, rowId, onClose }: { departmentId: string; personId: string; rowId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CompletionCellDetail>();
  const [error, setError] = useState("");

  useEffect(() => {
    setDetail(undefined);
    setError("");
    trainingComplianceApi.cellDetail({ departmentId: departmentId || undefined, personId, rowId }).then(setDetail).catch((e) => setError(trainingError(e)));
  }, [departmentId, personId, rowId]);

  const open = (id?: string | null) => id && navigate(`/training-management/activities/${id}`);
  const focus = detail?.openTrainings[0]?.id ?? detail?.lastActivityId;
  return (
    <Drawer
      title={detail ? `${detail.requirement.code ? `${detail.requirement.code} — ` : ""}${detail.requirement.title}` : "Matrix cell"}
      subtitle={detail?.person.fullName}
      onClose={onClose}
      footer={focus ? <Button size="sm" onClick={() => open(focus)}>{detail?.openTrainings[0] ? "Open the running training" : "Open the last training"}</Button> : undefined}
    >
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!detail && !error && <SectionLoading text="Loading…" />}
      {detail && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2"><Badge color={STATE_COLOR[detail.state]}>{STATE_LABEL[detail.state]}</Badge></div>
            <p className="mt-2 text-sm text-slate-700">{detail.reason}</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Employee</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact label="Name">{detail.person.fullName}{detail.person.employeeCode ? ` (${detail.person.employeeCode})` : ""}</Fact>
              <Fact label="Department">{detail.person.department ?? "—"}</Fact>
              <Fact label="Position">{detail.person.positions ?? "—"}</Fact>
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Requirement</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact label="Kind">{GROUP_LABEL[detail.requirement.group]}</Fact>
              <Fact label={detail.requirement.sop ? "SOP" : "Topic code"}>{detail.requirement.code ?? "—"}</Fact>
              <Fact label="Annual training">{detail.requirement.annual ? "Required every year" : "Not required"}</Fact>
              {detail.requirement.sop && <Fact label="Revision in force">{detail.requirement.currentRevision ?? "—"}</Fact>}
              <Fact label="Last trained">{day(detail.lastDoneOn) || "—"}</Fact>
              <Fact label="Revision trained">{detail.lastRevision ?? "—"}</Fact>
              <Fact label="Training Number of the last training">
                {detail.lastTrainingNumber ? (detail.lastActivityId ? <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => open(detail.lastActivityId)}>{detail.lastTrainingNumber}</button> : detail.lastTrainingNumber) : "—"}
              </Fact>
              {detail.requirement.annual && <Fact label="Next annual training due">{day(detail.nextDueOn) || "—"}</Fact>}
            </dl>
          </section>

          {detail.openTrainings.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Open trainings the employee is on</h3>
              <ul className="space-y-2">
                {detail.openTrainings.map((a) => (
                  <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => open(a.id)}>{a.trainingNumber}</button>
                      <Badge color={STATUS_COLOR[a.status as keyof typeof STATUS_COLOR] ?? "slate"}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
                    </div>
                    <div className="mt-1 text-slate-700">{a.trainingTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">{a.scheduledOn ? `Session on ${day(a.scheduledOn)}` : "No date yet"}{a.dueDate ? ` · due ${day(a.dueDate)}` : ""}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Training records for this requirement ({detail.records.length})</h3>
            {detail.records.length === 0 ? (
              <p className="text-sm text-slate-500">No record yet.</p>
            ) : (
              <ul className="space-y-2">
                {detail.records.map((r) => (
                  <li key={r.id} className={`rounded-lg border p-3 text-sm ${r.voided ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {r.activityId ? <button type="button" className={`font-medium hover:underline ${r.voided ? "text-slate-500 line-through" : "text-emerald-600"}`} onClick={() => open(r.activityId)}>{r.trainingNumber}</button> : <span className="font-medium">{r.trainingNumber}</span>}
                      <span className="text-xs">{r.voided ? <Badge color="red">Voided</Badge> : <Badge color="emerald">{RESULT_LABEL[r.result] ?? r.result}</Badge>}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{day(r.completedOn)} · {METHOD_LABEL[r.method] ?? r.method}{r.documentRevision ? ` · revision ${r.documentRevision}` : ""} · record {r.recordNo}</div>
                    {r.voided && r.voidReason && <div className="mt-1 text-xs">Voided: {r.voidReason}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
