import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { trainingError, trainingPreparationApi, type TrainingActivityDetail, type TrainingPreparationSession, type TrainingPrepItem } from "@/services/api/trainingActivities";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { DELIVERY_LABEL, useTrainingPaper } from "./TrainingPaperBlock";

const ITEM_LABEL: Record<TrainingPrepItem, { label: string; hint: string }> = {
  VENUE: { label: "Training room", hint: "The room or place is booked and ready for the session." },
  EQUIPMENT: { label: "Equipment for practice", hint: "The machines, tools and instruments of a practical session, if any." },
  MATERIALS: { label: "Training Materials", hint: "The documents, slides and forms are ready to teach with." },
  NOTICE: { label: "Notice to trainees and trainer", hint: "They know the date, the time, the place and the content." },
};
const DELIVERY_OPTIONS = Object.entries(DELIVERY_LABEL).map(([value, label]) => ({ value, label }));
const NO_ACTIVITY = { id: "", sessions: [] } as unknown as TrainingActivityDetail;

/** One line of the checklist: an item of the server, or a paper print of the session (ticked by the print itself). */
type Row = { key: string; label: string; hint: string; ready: boolean; notNeeded?: boolean; noStatus?: boolean; optional?: boolean; onTick?: (ready: boolean) => void; extra?: ReactNode };

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
      showToast({ type: "error", title: "The change was not saved", message: trainingError(e) });
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
    rows.push({
      key: "delivery",
      label: "Delivery of the session",
      hint: "Electronic, on paper, or both.",
      ready: false,
      noStatus: true,
      extra: canManage && !["COMPLETED", "CANCELLED"].includes(paper.activity.status)
        ? <div className="mt-2 w-36"><Select value={mode} options={DELIVERY_OPTIONS} aria-label={`Delivery of session ${session.sessionNo}`}
            onChange={(v) => { if (v === mode) return; if (printing.printed(session.id) > 0) printing.ask({ kind: "mode", session, mode: v }); else void printing.changeMode(session, v); }} /></div>
        : <div className="mt-1 text-sm text-slate-700">{DELIVERY_LABEL[mode]}</div>,
    });
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
      label: "Attendance sheet (paper)",
      hint: "Only if the session is held on paper: printed for the trainees to sign, with the Training Number on every page. The attendance can also be recorded in the system.",
      optional: true,
      ready: printing.printed(session.id) > 0,
      extra: paper.canPrint
        ? <Button size="sm" className="mt-2" disabled={printing.busy} onClick={() => (printing.printed(session.id) > 0 ? printing.ask({ kind: "print", session }) : void printing.print(session))}>{printing.printed(session.id) > 0 ? "Reprint attendance sheet" : "Print attendance sheet"}</Button>
        : undefined,
    });
    if ((session.assessmentMethod === "TEST" || (!!paper.activity.assessment && session.assessmentMethod === "CHECKLIST")) && paper.activity.contentRules?.assessmentFormSatisfied !== false) {
      rows.push({
        key: "exam-copies",
        label: "Test copies for trainees",
        hint: paper.activity.assessment
          ? `Only if the test is taken on paper: one numbered copy of "${paper.activity.assessment.title}" (${paper.activity.assessment.code} v${paper.activity.assessment.version}) for each trainee, with the name, the Training Number, the session and the date already written. Print and hand it out; the answer key is for the trainer.`
          : "Only if the test is taken on paper: one numbered copy of the test for each trainee.",
        optional: true,
        ready: printing.printedExam(session.id) > 0,
        extra: paper.canPrint
          ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={printing.busy} onClick={() => (printing.printedExam(session.id) > 0 ? printing.ask({ kind: "exam", session }) : void printing.printExam(session))}>{printing.printedExam(session.id) > 0 ? "Reprint test copies" : "Print test copies"}</Button>
              {paper.activity.assessment && <Button size="sm" variant="outline-emerald" disabled={printing.busy} onClick={() => void printing.printKey(session)}>Print answer key</Button>}
            </div>
          )
          : undefined,
      });
    }
  }

  const columns: DataTableColumn<Row>[] = [
    { id: "ready", header: "Ready", cell: (r) => (r.noStatus ? null : <Checkbox checked={r.ready} disabled={busy || !r.onTick} onChange={(checked) => r.onTick?.(checked)} />) },
    {
      id: "item",
      header: "To prepare",
      cell: (r) => (
        <div className="max-w-96 whitespace-normal">
          <div className="font-medium text-slate-900">{r.label}</div>
          <div className="text-xs text-slate-500">{r.hint}</div>
          {r.extra}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (r.noStatus ? null : r.notNeeded ? <Badge color="slate">Not needed</Badge> : r.ready ? <Badge color="emerald">Done</Badge> : r.optional ? <Badge color="slate">Optional</Badge> : <Badge color="amber">Pending</Badge>),
    },
  ];
  // The server accepts a tick while the activity is open and the session is planned or held; only then can a line hold the next step.
  const open = !!session && session.status === "PLANNED" && !["COMPLETED", "CANCELLED", "RESERVED"].includes(paper?.activity.status ?? "");
  const pending = canManage && open ? rows.filter((r) => !r.noStatus && !r.optional && !r.ready && !r.notNeeded).length : 0;
  useEffect(() => { onPending?.(pending); }, [pending, onPending]);
  if (rows.length === 0) return null;
  return (
    <>
      <TabBlock>
        <DataTable rows={rows} getRowKey={(r) => r.key} columns={columns} />
      </TabBlock>
      {printing.dialog}
    </>
  );
}
