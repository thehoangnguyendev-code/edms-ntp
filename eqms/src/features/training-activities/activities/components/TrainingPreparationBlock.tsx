import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { RadioGroup } from "@/components/ui/radio";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingPreparationApi, type TrainingActivityDetail, type TrainingPreparationSession, type TrainingPrepItem } from "@/services/api/trainingActivities";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { DELIVERY_LABEL, useTrainingPaper } from "./TrainingPaperBlock";
import { tr } from "@/i18n";

const ITEM_LABEL: Record<TrainingPrepItem, { label: string; hint: string }> = {
  VENUE: { label: tr("Training room"), hint: tr("The room or place is booked and ready for the session.") },
  EQUIPMENT: { label: tr("Equipment for practice"), hint: tr("The machines, tools and instruments of a practical session, if any.") },
  MATERIALS: { label: tr("Training Materials"), hint: tr("The documents, slides and forms are ready to teach with.") },
  NOTICE: { label: tr("Notice to trainees and trainer"), hint: tr("They know the date, the time, the place and the content.") },
};
const DELIVERY_OPTIONS = Object.entries(DELIVERY_LABEL).map(([value, label]) => ({ value, label }));
const NO_ACTIVITY = { id: "", sessions: [] } as unknown as TrainingActivityDetail;

/** One line of the checklist: an item of the server, or a paper print of the session (ticked by the print itself). */
type Row = { key: string; label: string; hint: string; ready: boolean; notNeeded?: boolean; optional?: boolean; onTick?: (ready: boolean) => void; extra?: ReactNode };

/**
 * What has to be ready before a session (SOP.0003 5.3.6): a checklist the organizer ticks. It warns; it never blocks a session. With `paper`, the delivery of the session and
 * its paper prints (attendance pack, exam copies) belong to the same checklist: a print ticks its own line.
 */
export function TrainingPreparationBlock({ activityId, sessionId, canManage, paper, onPending }: {
  activityId: string;
  sessionId?: string;
  canManage: boolean;
  paper?: { activity: TrainingActivityDetail; canPrint: boolean; onChanged: () => void };
  /** How many lines still wait for the person who can tick them (0 when nothing holds the next step). */
  onPending?: (pending: number) => void;
}) {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<TrainingPreparationSession[]>([]);
  const [busy, setBusy] = useState(false);
  const printing = useTrainingPaper(paper?.activity ?? NO_ACTIVITY, paper?.onChanged ?? (() => undefined));

  const load = useCallback(() => { trainingPreparationApi.get(activityId).then(setSessions).catch(() => setSessions([])); }, [activityId]);
  useEffect(load, [load]);
  useEntityChanged(["TRAINING"], load);

  const tick = async (sid: string, itemCode: TrainingPrepItem, ready: boolean) => {
    setBusy(true);
    try {
      setSessions(await trainingPreparationApi.update(sid, itemCode, { status: ready ? "DONE" : "PENDING" }));
    } catch (e) {
      showToast({ type: "error", title: tr("The change was not saved"), message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  const shown = sessionId ? sessions.filter((s) => s.sessionId === sessionId) : sessions;
  const multi = !sessionId && shown.length > 1;
  const rows: Row[] = shown.flatMap((s) => s.items.map((item) => ({
    key: `${s.sessionId}|${item.itemCode}`,
    label: `${multi ? `S${s.sessionNo}: ` : ""}${ITEM_LABEL[item.itemCode].label}`,
    hint: ITEM_LABEL[item.itemCode].hint,
    ready: item.status !== "PENDING",
    notNeeded: item.status === "NOT_NEEDED",
    onTick: canManage ? (ready: boolean) => void tick(s.sessionId, item.itemCode, ready) : undefined,
  })));

  const session = paper?.activity.sessions.find((s) => s.id === sessionId);
  const mode = session?.deliveryMode ?? "ELECTRONIC";
  if (paper && session) {
    const rules = paper.activity.contentRules;
    if (rules && (rules.testRequired || rules.checklistRequired)) {
      rows.push({
        key: "assessment-form",
        label: rules.testRequired ? "Assessment test" : "Assessment checklist",
        hint: rules.testRequired ? "The test of the session is uploaded as a file or written in the system (tab Assessment)." : "The checklist form of the session is uploaded (tab Assessment).",
        ready: (!rules.testRequired || rules.assessmentFormSatisfied || rules.onlineTest) && (!rules.checklistRequired || rules.assessmentFormSatisfied),
      });
    }
  }
  if (paper && session && mode !== "ELECTRONIC" && session.status === "PLANNED") {
    rows.push({
      key: "paper-pack",
      label: tr("Attendance sheet (paper)"),
      hint: tr("Only if the session is held on paper: printed for the trainees to sign, with the Training Number on every page. The attendance can also be recorded in the system."),
      optional: true,
      ready: printing.printed(session.id) > 0,
      extra: paper.canPrint
        ? <Button size="sm" className="mt-2" disabled={printing.busy} onClick={() => (printing.printed(session.id) > 0 ? printing.ask({ kind: "print", session }) : void printing.print(session))}>{printing.printed(session.id) > 0 ? "Reprint attendance sheet" : "Print attendance sheet"}</Button>
        : undefined,
    });
    if ((session.assessmentMethod === "TEST" || session.assessmentMethod === "CHECKLIST") && paper.activity.contentRules?.assessmentFormSatisfied !== false) {
      rows.push({
        key: "exam-copies",
        label: tr("Test copies for trainees"),
        hint: tr("Only if the test is taken on paper: one file for each trainee (in a ZIP), the form APD.0009 with the topic, the Training Number, the trainee\'s name, ID code and department and the date already written. Download and print it before the training starts, and hand it out."),
        optional: true,
        ready: printing.printedExam(session.id) > 0,
        extra: paper.canPrint
          ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={printing.busy} onClick={() => (printing.printedExam(session.id) > 0 ? printing.ask({ kind: "exam", session, format: "pdf" }) : void printing.printExam(session))}>{printing.printedExam(session.id) > 0 ? "Reprint test copies" : "Download test copies"}</Button>
              <Button size="sm" variant="outline-emerald" disabled={printing.busy} onClick={() => (printing.printedExam(session.id) > 0 ? printing.ask({ kind: "exam", session, format: "docx" }) : void printing.printExam(session, undefined, "docx"))}>{tr("Download as Word")}</Button>
            </div>
          )
          : undefined,
      });
    }
  }

  // The server accepts a tick while the activity is open and the session is planned or held; only then can a line hold the next step.
  const open = !!session && session.status === "PLANNED" && !["COMPLETED", "CANCELLED", "RESERVED"].includes(paper?.activity.status ?? "");
  const required = rows.filter((r) => !r.optional && !r.notNeeded);
  const pending = canManage && open ? required.filter((r) => !r.ready).length : 0;
  useEffect(() => { onPending?.(pending); }, [pending, onPending]);
  const deliveryEditable = canManage && !!paper && !["COMPLETED", "CANCELLED"].includes(paper.activity.status);
  if (rows.length === 0 && !(paper && session)) return null;
  const readyCount = required.filter((r) => r.ready).length;
  return (
    <>
      <TabBlock title={tr("Checklist")} action={<Badge color={required.length > 0 && readyCount === required.length ? "emerald" : "amber"}>{`${readyCount} of ${required.length} ready`}</Badge>}>
        {paper && session && (
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div>
              <div className="text-sm font-medium text-slate-900">{tr("Delivery of the session")}</div>
              <div className="text-xs text-slate-500">{tr("Electronic, on paper, or both.")}</div>
            </div>
            <div role="radiogroup" aria-label={`Delivery of session ${session.sessionNo}`}>
              <RadioGroup
                name={`delivery-${session.id}`}
                layout="horizontal"
                value={mode}
                disabled={!deliveryEditable}
                options={DELIVERY_OPTIONS}
                onChange={(v) => {
                  const next = String(v);
                  if (next === mode) return;
                  if (printing.hasPrint(session.id)) printing.ask({ kind: "mode", session, mode: next });
                  else void printing.changeMode(session, next);
                }}
              />
            </div>
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const id = `prep-${r.key}`;
            return (
              <li key={r.key} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 md:px-5">
                <Checkbox id={id} aria-label={r.label} checked={r.ready} disabled={busy || !r.onTick} onChange={(checked) => r.onTick?.(checked)} className="min-h-0 pt-0.5" />
                <div className="min-w-0 flex-1">
                  <label htmlFor={id} className={`block text-sm font-medium ${r.ready ? "text-slate-500" : "text-slate-900"} ${r.onTick ? "cursor-pointer" : ""}`}>{r.label}</label>
                  <div className="text-xs text-slate-500">{r.hint}</div>
                  {r.extra}
                </div>
                {r.notNeeded ? <Badge color="slate">{tr("Not needed")}</Badge> : r.optional ? <Badge color="slate">{tr("Optional")}</Badge> : null}
              </li>
            );
          })}
        </ul>
      </TabBlock>
      {printing.dialog}
    </>
  );
}
