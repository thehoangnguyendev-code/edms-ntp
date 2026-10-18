import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../shared/TrainingFields";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { SignatureFields, type SignatureRecord } from "@/features/documents/shared/components/SignatureFields";
import { TrainingPreparationBlock } from "./components/TrainingPreparationBlock";
import { TrainingRollCallBlock } from "./components/TrainingRollCallBlock";
import { TrainingTranscriptionBlock } from "./components/TrainingTranscriptionBlock";
import { TrainingPaperBlock, DELIVERY_LABEL } from "./components/TrainingPaperBlock";
import { TrainingActivityFilesTab } from "./components/TrainingActivityFilesTab";
import { TrainingDateField } from "../shared/TrainingDateField";
import { ParticipantsPanel, SessionPanel } from "./components/TrainingActivityPlanning";
import { ReadonlyField, ReadonlyGrid, TabBlock, TrainingDetailLayout } from "../shared/TrainingDetailLayout";
import {
  trainingActivitiesApi,
  trainingCodeText,
  trainingError,
  type TrainingActivityDetail,
  type TrainingApprovalStep,
  type TrainingCapabilities,
  type TrainingParticipant,
  type TrainingPerson,
  type TrainingSession,
} from "@/services/api/trainingActivities";
import {
  ASSESSMENT_LABEL, EXTERNAL_TYPE_LABEL, KIND_LABEL, KIND_REASON_LABEL, METHOD_LABEL, PARTICIPANT_STATE_LABEL, STEP_LABEL,
  day, trainingBreadcrumbs, when,
} from "../shared/trainingLabels";

const ACTIVITY_STEPS = [
  { status: "RESERVED", label: "Waiting for approval" },
  { status: "PLANNED", label: "Planned" },
  { status: "NOTIFIED", label: "Notified" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "PENDING_QA_CONFIRMATION", label: "Waiting for QA confirmation" },
  { status: "COMPLETED", label: "Completed" },
];

/** One screen for each thing a person does with an activity; the Details screen only looks (like Document Details and the Review, Approval and Training screens of a revision). */
export type ActivityMode = "view" | "edit" | "conduct" | "review" | "approve" | "confirm" | "participate";
const MODE_TITLE: Record<ActivityMode, string> = {
  view: "Training Activity Details",
  edit: "Edit Training Activity",
  conduct: "Conduct Training",
  review: "Review Training Content",
  approve: "Approve Training Content",
  confirm: "Confirm Training Completion",
  participate: "Training Participation",
};
const MODE_TAB: Record<ActivityMode, string> = { view: "overview", edit: "overview", conduct: "participants", review: "materials", approve: "materials", confirm: "overview", participate: "participants" };
const MODE_CAPS: Record<ActivityMode, string[]> = {
  view: [],
  edit: ["edit", "planSessions", "removeParticipants", "confirmList", "designateApprovers", "notify", "cancel"],
  conduct: ["planSessions", "printPaper", "rollCall", "transcribe", "verifyTranscription", "hold", "recordAttendance", "recordAssessment", "submitForConfirmation", "addSupplementary", "cancel"],
  review: [],
  approve: [],
  confirm: ["confirmCompletion"],
  participate: [],
};
const limitCaps = (raw: TrainingCapabilities, mode: ActivityMode): TrainingCapabilities => {
  const allowed = new Set(MODE_CAPS[mode]);
  const out: Record<string, unknown> = { ...raw };
  for (const key of Object.keys(out)) if (key !== "notifyBlockers" && !allowed.has(key)) out[key] = false;
  return out as unknown as TrainingCapabilities;
};

type Dialog =
  | { type: "cancel" }
  | { type: "postpone"; session: TrainingSession }
  | { type: "attendance"; participant: TrainingParticipant }
  | { type: "assessment"; participant: TrainingParticipant }
  | { type: "designate"; step: TrainingApprovalStep }
  | { type: "supplementary" }
  | { type: "removeParticipant"; participant: TrainingParticipant }
  | { type: "plannedAbsence"; participant: TrainingParticipant }
  | { type: "trainerException"; session: TrainingSession }
  | { type: "rejectException"; exceptionId: string }
  | undefined;

interface SignRequest {
  title: string;
  meaningCode: string;
  meaningName: string;
  run: (signatureToken: string) => Promise<TrainingActivityDetail>;
}

/** One training activity: its facts, sessions, people, approval steps and Audit Trail. The server decides what is allowed; the buttons follow `capabilities`. */
export function TrainingActivityDetailPage({ mode = "view" }: { mode?: ActivityMode }) {
  const { activityId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth() as { user?: { id?: string } };
  const { hasPermission } = usePermissions();
  const [activity, setActivity] = useState<TrainingActivityDetail>();
  const [error, setError] = useState("");
  const location = useLocation();
  const [tab, setTab] = useState<string>((location.state as { tab?: string } | null)?.tab ?? MODE_TAB[mode]);
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);
  const [pSession, setPSession] = useState("");
  const [draft, setDraft] = useState<{ trainingTitle: string; dueDate: string; remarks: string; trainingUnitName: string; vendorRef: string }>();

  const load = useCallback(() => {
    setError("");
    trainingActivitiesApi.get(activityId).then(setActivity).catch((e) => setError(trainingError(e)));
  }, [activityId]);
  useEffect(load, [load]);

  /** Runs a command; the answer is the new state of the activity. */
  const run = async (action: () => Promise<TrainingActivityDetail>, done: string) => {
    setBusy(true);
    try {
      setActivity(await action());
      showToast({ type: "success", title: done, message: activity?.trainingNumber ?? "" });
      setDialog(undefined);
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const caps = activity ? limitCaps(activity.capabilities, mode) : undefined;
  const title = MODE_TITLE[mode];
  const tabs: TabItem[] = useMemo(
    () => [
      { id: "overview", label: "General Information" },
      { id: "sessions", label: "Sessions", count: activity?.sessions.length },
      { id: "participants", label: "Participants", count: activity?.participants.length },
      { id: "materials", label: "Training Materials" },
      { id: "assessment", label: "Assessment" },
      { id: "approvals", label: "Approvers" },
      { id: "audit", label: "Audit Trail" },
    ],
    [activity?.sessions.length, activity?.participants.length],
  );

  if (!activity) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={trainingBreadcrumbs(navigate, "activities", title)} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading training activity…" />}
      </div>
    );
  }

  const stepAssignment = (step: TrainingApprovalStep) => activity.approvers.find((a) => a.stepCode === step && a.status === "PENDING");
  const stepDone = (kind: string) => activity.confirmations.some((c) => c.kind === kind);
  const iAmAssigned = (step: TrainingApprovalStep) => stepAssignment(step)?.assigneeId === user?.id;
  const canClose = hasPermission("training.activity.close");
  const hasSelfReading = activity.sessions.some((s) => s.method === "SELF_READING");

  const sessionColumns: DataTableColumn<TrainingSession>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "no", header: "Session", cell: (s) => s.sessionNo },
    { id: "topics", header: "Topics", cell: (s) => <div className="max-w-80 whitespace-normal">{s.topics.map((t) => t.topicText).join("; ")}</div> },
    { id: "method", header: "Method", cell: (s) => (s.method ? METHOD_LABEL[s.method] ?? s.method : "—") },
    { id: "delivery", header: "Delivery", cell: (s) => DELIVERY_LABEL[s.deliveryMode ?? "ELECTRONIC"] },
    { id: "assessment", header: "Assessment", cell: (s) => (s.assessmentMethod ? ASSESSMENT_LABEL[s.assessmentMethod] ?? s.assessmentMethod : "—") },
    { id: "trainer", header: "Trainer", cell: (s) => s.trainerName ?? s.externalTrainerName ?? "—" },
    {
      id: "check",
      header: "Trainer check",
      cell: (s) => {
        const q = s.trainerQualification;
        if (!q || !q.applies) return "—";
        if (q.qualified) return <Badge color="emerald">Qualified</Badge>;
        const ex = q.exception;
        return (
          <div className="max-w-64 space-y-1 whitespace-normal">
            {ex?.status === "APPROVED" ? <Badge color="amber">Exception approved</Badge> : ex?.status === "PENDING" ? <Badge color="amber">Exception waiting</Badge> : <Badge color="red">Not qualified</Badge>}
            {ex?.status !== "APPROVED" && <ul className="list-disc pl-4 text-xs text-slate-600">{q.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            {ex?.status === "REJECTED" && <div className="text-xs text-red-700">Last exception rejected: {ex.rejectReason}</div>}
            <div className="flex flex-wrap gap-2">
              {(!ex || ex.status === "REJECTED") && s.status === "PLANNED" && caps?.planSessions && <Button size="sm" variant="outline" onClick={() => setDialog({ type: "trainerException", session: s })}>Request exception</Button>}
              {(mode === "approve" || mode === "edit") && ex?.status === "PENDING" && q.canDecide && (
                <>
                  <Button size="sm" variant="outline-emerald" onClick={() => signAction("Approve trainer exception", "TRAINING_TRAINER_EXCEPTION_APPROVED", "Trainer Exception Approved", async (t) => { await trainingActivitiesApi.approveTrainerException(ex.id, t); return trainingActivitiesApi.get(activity.id); })}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDialog({ type: "rejectException", exceptionId: ex.id })}>Reject</Button>
                </>
              )}
            </div>
          </div>
        );
      },
    },
    { id: "location", header: "Location", cell: (s) => (s.locationType === "ONLINE" ? <div className="max-w-60 whitespace-normal">{s.onlinePlatform}: <a href={s.meetingLink ?? "#"} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-600 hover:underline">{s.meetingLink}</a></div> : s.venue ?? "—") },
    { id: "scheduled", header: "Scheduled", cell: (s) => day(s.scheduledOn) },
    { id: "held", header: "Held", cell: (s) => day(s.heldOn) },
    { id: "status", header: "Status", cell: (s) => <Badge color={s.status === "HELD" ? "emerald" : "slate"}>{s.status.toLowerCase()}</Badge> },
    {
      id: "actions",
      header: "",
      cell: (s) =>
        s.status === "PLANNED" && (caps?.hold || caps?.planSessions) ? (
          <div className="flex flex-wrap gap-2">
            {caps?.hold && <Button size="sm" variant="outline-emerald" onClick={() => void run(() => trainingActivitiesApi.holdSession(s.id), "Session held")}>Mark as held</Button>}
            {caps?.planSessions && <Button size="sm" variant="outline" onClick={() => setDialog({ type: "postpone", session: s })}>Postpone</Button>}
          </div>
        ) : null,
    },
  ];

  const sessionOf = (id: string) => activity.sessions.find((s) => s.id === id);
  const labelOfState = (p: TrainingParticipant) => (p.plannedAbsence && p.state === "INVITED" ? `Absent (planned): ${p.plannedAbsence}` : p.state === "ABSENT" && p.absenceReason ? `Absent: ${p.absenceReason}` : PARTICIPANT_STATE_LABEL[p.state] ?? p.state);
  // The columns of the attendee list APD.0117: No., ID, name, department, session, attendance, result. The actions follow the screen.
  const participantColumns: DataTableColumn<TrainingParticipant>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "code", header: "Employee ID", cell: (p) => p.employeeCode ?? "—" },
    { id: "name", header: "Name", cell: (p) => <div><span className="font-medium text-slate-900">{p.fullName}</span>{!p.personUserId && p.externalOrg ? <div className="text-xs text-slate-500">{p.externalOrg}</div> : null}</div> },
    { id: "department", header: "Department", cell: (p) => p.department ?? "—" },
    { id: "session", header: "Session", cell: (p) => sessionOf(p.sessionId)?.sessionNo ?? "—" },
    { id: "state", header: "Attendance", cell: (p) => <div className="max-w-64 whitespace-normal">{labelOfState(p)}</div> },
    {
      id: "result",
      header: "Result",
      cell: (p) => (
        <Badge color={p.result === "PASSED" ? "emerald" : p.result === "FAILED" ? "red" : "slate"}>
          {p.result.toLowerCase()}
          {p.lastPercent != null ? ` (${p.lastPercent}%)` : ""}
        </Badge>
      ),
    },
    { id: "attempts", header: "Re-training", cell: (p) => (p.attempts && p.attempts > 1 ? `${p.attempts - 1} time(s)` : "—") },
    {
      id: "actions",
      header: "",
      cell: (p) => (
        <div className="flex flex-wrap gap-2">
          {mode === "edit" && p.state === "INVITED" && ["PLANNED", "NOTIFIED"].includes(activity.status) && p.personUserId && (
            p.plannedAbsence
              ? <Button size="sm" variant="outline" onClick={() => void run(() => trainingActivitiesApi.setPlannedAbsence(p.id, ""), "Absence cleared")}>Clear absence</Button>
              : <Button size="sm" variant="outline" onClick={() => setDialog({ type: "plannedAbsence", participant: p })}>Mark absent</Button>
          )}
          {caps?.removeParticipants && p.state === "INVITED" && <Button size="sm" variant="outline" onClick={() => setDialog({ type: "removeParticipant", participant: p })}>Remove</Button>}
          {caps?.recordAttendance && p.state === "INVITED" && sessionOf(p.sessionId)?.status === "HELD" && (
            <Button size="sm" variant="outline" onClick={() => setDialog({ type: "attendance", participant: p })}>Attendance</Button>
          )}
          {caps?.recordAssessment && (p.state === "ATTENDED" || p.state === "ONLINE") && !!sessionOf(p.sessionId)?.assessmentMethod && sessionOf(p.sessionId)?.assessmentMethod !== "SELF_READING_CONFIRMATION" && (
            <Button size="sm" variant="outline-emerald" onClick={() => setDialog({ type: "assessment", participant: p })}>Record result</Button>
          )}
          {mode === "participate" && p.personUserId === user?.id && p.state === "INVITED" && sessionOf(p.sessionId)?.method === "SELF_READING" && ["NOTIFIED", "IN_PROGRESS"].includes(activity.status) && (
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                setSign({
                  title: "Confirm self-reading",
                  meaningCode: "TRAINING_READ_CONFIRMED",
                  meaningName: "Self-reading Confirmed",
                  run: async (token) => {
                    await trainingActivitiesApi.confirmRead(p.id, token);
                    return trainingActivitiesApi.get(activity.id);
                  },
                })
              }
            >
              I have read and understood
            </Button>
          )}
        </div>
      ),
    },
  ];
  const inSession = (p: TrainingParticipant) => !pSession || p.sessionId === pSession;
  // SOP.0003 5.3.4: the list of a self-reading training is the form APD.0108 (training number, reading day, signature).
  const shownSessions = activity.sessions.filter((x) => !pSession || x.id === pSession);
  const selfReading = shownSessions.length > 0 && shownSessions.every((x) => x.method === "SELF_READING");
  const columnsShown: DataTableColumn<TrainingParticipant>[] = selfReading
    ? [
        ...participantColumns.filter((c) => ["rowNo", "code", "name"].includes(c.id)),
        { id: "trn", header: "Training number", cell: () => activity.trainingNumber },
        { id: "read", header: "Reading day", cell: (p) => (p.readConfirmedAt ? day(p.readConfirmedAt) : "—") },
        { id: "sign", header: "Signature", cell: (p) => (p.state === "READ_CONFIRMED" ? (p.signMode === "ESIGN" ? "E-signature" : "Signed on paper") : labelOfState(p)) },
        ...participantColumns.filter((c) => c.id === "actions"),
      ]
    : participantColumns;
  const isAway = (p: TrainingParticipant) => !!p.personUserId && (p.state === "ABSENT" || (p.state === "INVITED" && !!p.plannedAbsence));
  const groups = [
    { id: "employees", title: "Employees", rows: activity.participants.filter((p) => inSession(p) && p.personUserId && !isAway(p)) },
    { id: "absent", title: "Absent (stay on the list)", rows: activity.participants.filter((p) => inSession(p) && isAway(p)) },
    { id: "outside", title: "Outside persons", rows: activity.participants.filter((p) => inSession(p) && !p.personUserId) },
  ];
  const targetSession = activity.sessions.find((x) => x.id === pSession) ?? activity.sessions[0];

  const signAction = (title: string, meaningCode: string, meaningName: string, runWith: (token: string) => Promise<TrainingActivityDetail>) =>
    setSign({ title, meaningCode, meaningName, run: runWith });

  const external = activity.kind === "EXTERNAL";
  const open = !["COMPLETED", "CANCELLED"].includes(activity.status);
  const qa = activity.qaList;
  // Two notices that guide the manual part of the procedure: the day the list goes to QA (SOP.0003 5.3.6) and the approved vendor list for an outside trainer (SOP.0025).
  const notices = open ? (
    <div className="mb-4 space-y-2">
      {qa && ["DUE", "DUE_TODAY", "OVERDUE", "WAITING"].includes(qa.state) && (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${qa.state === "OVERDUE" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {qa.state === "WAITING" && "This training is on a new or revised document. On the day it is held, send the attendance list to QA (SOP.0003 5.3.6)."}
          {qa.state === "DUE" && `Send the attendance list to QA on ${day(qa.dueOn)}, the day of the training (SOP.0003 5.3.6).`}
          {qa.state === "DUE_TODAY" && "Today is the day of the training: send the attendance list to QA today (SOP.0003 5.3.6)."}
          {qa.state === "OVERDUE" && `The attendance list was due to QA on ${day(qa.dueOn)} and has not been sent. Send it now; the delay is recorded.`}
        </p>
      )}
      {external && !activity.vendorRef?.trim() && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Check that the training unit is on the approved vendor list (SOP.0025) and enter its reference in "Vendor reference". The system does not hold the vendor list.
        </p>
      )}
    </div>
  ) : null;
  const form = draft ?? { trainingTitle: activity.trainingTitle, dueDate: activity.dueDate?.slice(0, 10) ?? "", remarks: activity.remarks ?? "", trainingUnitName: activity.trainingUnitName ?? "", vendorRef: activity.vendorRef ?? "" };
  const formDirty = !!draft && (draft.trainingTitle !== activity.trainingTitle || draft.dueDate !== (activity.dueDate?.slice(0, 10) ?? "") || draft.remarks !== (activity.remarks ?? "") || draft.trainingUnitName !== (activity.trainingUnitName ?? "") || draft.vendorRef !== (activity.vendorRef ?? ""));
  const blockers = caps?.notifyBlockers ?? [];
  const stepsToDo = [
    { done: activity.sessions.length > 0, text: external ? "Add the session: topic, date and place (tab Sessions)" : "Add the session: topic, method, trainer and date (tab Sessions)", tab: "sessions" },
    { done: activity.participants.length > 0, text: "Add the participants of each session (tab Participants)", tab: "participants" },
    { done: stepDone("ATTENDEE_LIST_PREPARED"), text: "Confirm the attendee list (button below)", tab: "participants" },
    ...(external ? [] : [{ done: stepDone("CONTENT_REVIEWED") && stepDone("CONTENT_APPROVED"), text: "Designate who reviews and approves the content (tab Approvers); add the materials and the exam (tabs Training Materials and Assessment)", tab: "approvals" }]),
    { done: activity.status !== "PLANNED", text: "Notify the participants (button below)", tab: "overview" },
  ];
  const nextSteps = ["PLANNED", "NOTIFIED"].includes(activity.status) && caps?.planSessions ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:p-5">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">To prepare this training</h3>
      <ol className="space-y-1.5 text-sm">
        {stepsToDo.map((x, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${x.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{x.done ? "✓" : i + 1}</span>
            <button type="button" className={`text-left ${x.done ? "text-slate-500 line-through" : "text-slate-800 hover:text-emerald-700 hover:underline"}`} onClick={() => setTab(x.tab)}>{x.text}</button>
          </li>
        ))}
      </ol>
      {activity.listPreparedBy && blockers.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Participants cannot be notified yet:
          <ul className="mt-1 list-disc pl-4">{blockers.map((b) => <li key={b}>{trainingCodeText(b)}</li>)}</ul>
        </div>
      )}
    </div>
  ) : null;

  const confirmation = (label: string, kind: string): SignatureRecord => {
    const c = activity.confirmations.find((x) => x.kind === kind);
    return { actionBy: `${label} By`, actionByName: c?.confirmedByName ?? "-", actionOn: `${label} On (Date - Time)`, actionOnValue: c?.confirmedAt ?? "-" };
  };
  const signatureRecords: SignatureRecord[] = [
    confirmation("Attendee List Confirmed", "ATTENDEE_LIST_PREPARED"),
    confirmation("Content Reviewed", "CONTENT_REVIEWED"),
    confirmation("Content Approved", "CONTENT_APPROVED"),
    ...(activity.confirmations.some((c) => c.kind === "HEAD_SELF_READING") ? [confirmation("Self-reading Verified", "HEAD_SELF_READING")] : []),
    confirmation("Completion Confirmed", "QA_COMPLETION"),
  ];

  const footer = (
    <>
      {caps?.edit && formDirty && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} disabled={!form.trainingTitle.trim() || (external && !form.trainingUnitName.trim())} onClick={() => void run(() => trainingActivitiesApi.update(activity.id, { version: activity.version, trainingTitle: form.trainingTitle.trim(), dueDate: form.dueDate || null, remarks: form.remarks.trim() || null, trainingUnitName: external ? form.trainingUnitName.trim() : undefined, vendorRef: external ? form.vendorRef.trim() : undefined }), "Changes saved").then((ok) => { if (ok) setDraft(undefined); })}>Save changes</Button>}
      {caps?.confirmList && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => signAction("Confirm attendee list", "TRAINING_LIST_VERIFIED", "Attendance List Verified", (t) => trainingActivitiesApi.confirmList(activity.id, t))}>Confirm attendee list</Button>}
      {caps?.notify && activity.listPreparedBy && <Button size="sm" variant="default" className="whitespace-nowrap" loading={busy} disabled={blockers.length > 0} title={blockers.map(trainingCodeText).join(" ")} onClick={() => void run(() => trainingActivitiesApi.notify(activity.id, activity.version), "Participants notified")}>Notify participants</Button>}
      {hasSelfReading && caps?.hold && activity.participants.some((p) => p.state === "READ_CONFIRMED" && p.result === "PENDING") && (
        <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => signAction("Verify self-reading", "TRAINING_READ_VERIFIED", "Self-reading Verified", (t) => trainingActivitiesApi.verifySelfReading(activity.id, t))}>Verify self-reading</Button>
      )}
      {caps?.submitForConfirmation && <Button size="sm" variant="default" className="whitespace-nowrap" loading={busy} onClick={() => void run(() => trainingActivitiesApi.submitForConfirmation(activity.id, activity.version), "Sent to QA")}>Send to QA</Button>}
      {caps?.confirmCompletion && (
        <Button size="sm" variant="default" className="whitespace-nowrap" onClick={() => signAction("Confirm completion", "TRAINING_COMPLETED", "Training Completed", (t) => trainingActivitiesApi.confirmCompletion(activity.id, activity.version, t))}>Confirm completion</Button>
      )}
      {caps?.addSupplementary && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "supplementary" })}>Make-up / retraining</Button>}
      {caps?.cancel && <Button size="sm" variant="destructive" className="whitespace-nowrap" onClick={() => setDialog({ type: "cancel" })}>Cancel activity</Button>}
    </>
  );
  const cancelled = activity.status === "CANCELLED";
  const steps = cancelled ? [...ACTIVITY_STEPS.map((x) => x.label), "Cancelled"] : ACTIVITY_STEPS.map((x) => x.label);
  const stepIndex = cancelled ? steps.length - 1 : Math.max(0, ACTIVITY_STEPS.findIndex((x) => x.status === activity.status));

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "activities", title)}
        onBack={() => navigate("/training-management/activities")}
        steps={steps}
        currentStepIndex={stepIndex}
        terminalProgressStep={ACTIVITY_STEPS[0].label}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-activity-detail-tab"
        footer={footer}
      >
        {notices}
        {tab === "overview" && (
          <div className="space-y-6">
            {mode === "edit" && nextSteps}
            <ReadonlyGrid>
              <ReadonlyField label="Training Number" value={activity.trainingNumber} />
              <ReadonlyField label="Type" value={KIND_LABEL[activity.kind] ?? activity.kind} />
              <ReadonlyField label="Reason" value={activity.kindReason ? KIND_REASON_LABEL[activity.kindReason] ?? activity.kindReason : ""} />
              {external && <ReadonlyField label="External training" value={activity.externalType ? EXTERNAL_TYPE_LABEL[activity.externalType] : ""} />}
              {external && (caps?.edit ? (
                <>
                  <FormField label="Training unit / individual" required><Input value={form.trainingUnitName} maxLength={255} onChange={(e) => setDraft({ ...form, trainingUnitName: e.target.value })} /></FormField>
                  <FormField label="Vendor reference (SOP.0025)"><Input value={form.vendorRef} maxLength={120} onChange={(e) => setDraft({ ...form, vendorRef: e.target.value })} /></FormField>
                </>
              ) : (
                <>
                  <ReadonlyField label="Training unit / individual" value={activity.trainingUnitName} />
                  <ReadonlyField label="Vendor reference (SOP.0025)" value={activity.vendorRef} />
                </>
              ))}
              {caps?.edit ? (
                <div className="md:col-span-2"><FormField label="Training Title" required><Input value={form.trainingTitle} maxLength={255} onChange={(e) => setDraft({ ...form, trainingTitle: e.target.value })} /></FormField></div>
              ) : <ReadonlyField label="Training Title" value={activity.trainingTitle} wide />}
              <ReadonlyField label="Department" value={activity.departmentName} />
              <ReadonlyField label="Document" value={activity.documentNumber ? `${activity.documentNumber}${activity.revisionNumber ? ` Rev ${activity.revisionNumber}` : ""}` : ""} />
              <ReadonlyField label="Approved on" value={day(activity.approvedOn)} />
              {caps?.edit ? <TrainingDateField label="Due" value={form.dueDate} onChange={(v) => setDraft({ ...form, dueDate: v })} /> : <ReadonlyField label="Due" value={day(activity.dueDate)} />}
              <ReadonlyField label="Completed on" value={day(activity.completedOn)} />
              {caps?.edit ? (
                <div className="md:col-span-2"><FormField label="Remarks"><Textarea rows={2} value={form.remarks} onChange={(e) => setDraft({ ...form, remarks: e.target.value })} /></FormField></div>
              ) : <ReadonlyField label="Remarks" value={activity.remarks} wide />}
              {activity.cancelReason && <ReadonlyField label="Reason for cancelling" value={activity.cancelReason} wide />}
            </ReadonlyGrid>
          </div>
        )}

        {tab === "sessions" && (
          <div className="space-y-4">
            {caps?.planSessions && <SessionPanel external={external} busy={busy} onSave={(body) => void run(() => trainingActivitiesApi.addSession(activity.id, body), "Session added")} />}
            <TrainingPaperBlock activity={activity} canPrint={Boolean(caps?.printPaper)} canMode={Boolean(caps?.planSessions)} onChanged={() => void run(() => trainingActivitiesApi.get(activity.id), "Updated")} />
            <TrainingPreparationBlock activityId={activity.id} canManage={Boolean(caps?.planSessions)} userId={user?.id} />
            <TabBlock title="Sessions">
              <DataTable rows={activity.sessions} getRowKey={(s) => s.id} columns={sessionColumns} emptyState={<p className="p-4 text-sm text-slate-500">No session yet. Fill in the form above to add the first one.</p>} />
            </TabBlock>
          </div>
        )}

        {tab === "participants" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-700 sm:text-sm">Session</span>
              {[{ id: "", label: `All (${activity.participants.length})` }, ...activity.sessions.map((x) => ({ id: x.id, label: `S${x.sessionNo} ${x.topics[0]?.topicText ?? ""}`.trim() + ` (${activity.participants.filter((p) => p.sessionId === x.id).length})` }))].map((chip) => (
                <button key={chip.id || "all"} type="button" onClick={() => setPSession(chip.id)}
                  className={`max-w-xs truncate rounded-full border px-3 py-1 text-xs font-medium transition-colors ${pSession === chip.id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}>
                  {chip.label}
                </button>
              ))}
            </div>
            {caps?.planSessions && (targetSession
              ? <ParticipantsPanel key={targetSession.id} activityId={activity.id} session={targetSession} busy={busy} onSave={(body) => void run(() => trainingActivitiesApi.addParticipants(activity.id, body), "Participants added")} />
              : <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-sm text-slate-600">Add a session first (tab Sessions): the people are added to a session.</p>)}
            {mode === "conduct" && caps?.rollCall && <TrainingRollCallBlock activity={activity} onChanged={setActivity} />}
            {["conduct", "view"].includes(mode) && <TrainingTranscriptionBlock activity={activity} userId={user?.id} canEnter={Boolean(caps?.transcribe)} canVerify={Boolean(caps?.verifyTranscription)} onChanged={() => void run(() => trainingActivitiesApi.get(activity.id), "Updated")} />}
            {groups.filter((g) => g.rows.length > 0 || g.id === "employees").map((g) => (
              <TabBlock key={g.id} title={`${g.title} (${g.rows.length})`}>
                <DataTable rows={g.rows} getRowKey={(p) => p.id} columns={columnsShown} emptyState={<p className="p-4 text-sm text-slate-500">No participant yet.</p>} />
              </TabBlock>
            ))}
          </div>
        )}

        {tab === "approvals" && !["edit", "review", "approve"].includes(mode) && <SignatureFields records={signatureRecords} />}

        {tab === "approvals" && ["edit", "review", "approve"].includes(mode) && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              The person who prepares the training chooses who reviews and approves the content. Only a person who holds the permission for the step, in the right
              department, and who is not the person who prepared it, can be chosen. The person chosen signs with an electronic signature.
            </p>
            {external && <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-sm text-slate-600">An external training has no content or test of its own, so there is no review or approval of content. QA confirms the completion.</p>}
            {(external ? [] : ["CONTENT_REVIEW", "CONTENT_APPROVE"] as TrainingApprovalStep[]).map((step) => {
              const assigned = stepAssignment(step);
              const done = stepDone(step === "CONTENT_REVIEW" ? "CONTENT_REVIEWED" : "CONTENT_APPROVED");
              const rows = activity.approvers.filter((a) => a.stepCode === step);
              return (
                <TabBlock
                  key={step}
                  title={STEP_LABEL[step]}
                  action={
                    <div className="flex flex-wrap gap-2">
                      {!done && !assigned && caps?.designateApprovers && ["PLANNED", "NOTIFIED"].includes(activity.status) && (
                        <Button size="sm" variant="outline-emerald" onClick={() => setDialog({ type: "designate", step })}>Designate</Button>
                      )}
                      {!done && assigned && iAmAssigned(step) && mode === (step === "CONTENT_REVIEW" ? "review" : "approve") && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            signAction(
                              step === "CONTENT_REVIEW" ? "Confirm review" : "Confirm approval",
                              step === "CONTENT_REVIEW" ? "TRAINING_CONTENT_REVIEWED" : "TRAINING_CONTENT_APPROVED",
                              step === "CONTENT_REVIEW" ? "Training Content Reviewed" : "Training Content Approved",
                              (t) => trainingActivitiesApi.confirmContent(activity.id, step as "CONTENT_REVIEW" | "CONTENT_APPROVE", t),
                            )
                          }
                        >
                          {step === "CONTENT_REVIEW" ? "Sign review" : "Sign approval"}
                        </Button>
                      )}
                    </div>
                  }
                >
                  <DataTable
                    rows={rows}
                    getRowKey={(r) => r.id}
                    columns={[
                      { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
                      { id: "who", header: "Person", cell: (r) => r.assigneeName },
                      { id: "status", header: "Status", cell: (r) => r.status.toLowerCase() },
                      { id: "at", header: "Date", cell: (r) => when(r.completedAt ?? r.assignedAt) },
                    ] as DataTableColumn<(typeof rows)[number]>[]}
                    emptyState={<p className="p-4 text-sm text-slate-500">{done ? "Done" : "No one designated yet."}</p>}
                  />
                </TabBlock>
              );
            })}
            <TabBlock title={STEP_LABEL.ACTIVITY_COMPLETE}>
              <p className="p-4 text-sm text-slate-600">
                {activity.status === "COMPLETED"
                  ? "Done"
                  : canClose
                    ? "Any person who holds the QA permission can confirm, except the person who confirmed the attendee list."
                    : "Waiting for QA."}
              </p>
            </TabBlock>
          </div>
        )}

        {(tab === "materials" || tab === "assessment") && <TrainingActivityFilesTab key={tab} part={tab} mode={mode} external={external} activityId={activity.id} participants={activity.participants} />}

        {tab === "audit" && <AuditTrailTab entityId={activity.id} entityType="TRAINING_ACTIVITY" />}
      </TrainingDetailLayout>

      {dialog?.type === "cancel" && (
        <ReasonDialog title="Cancel training activity" help="The Training Number is never used again. The reason stays in the record." confirmText="Cancel activity" destructive busy={busy}
          onClose={() => setDialog(undefined)} onSave={(reason) => run(() => trainingActivitiesApi.cancel(activity.id, activity.version, reason), "Activity cancelled")} />
      )}
      {dialog?.type === "postpone" && (
        <PostponeDialog busy={busy} onClose={() => setDialog(undefined)} onSave={(date, reason) => run(() => trainingActivitiesApi.postponeSession(dialog.session.id, date, reason), "Session postponed")} />
      )}
      {dialog?.type === "attendance" && (
        <AttendanceDialog participant={dialog.participant} busy={busy} onClose={() => setDialog(undefined)} onSave={(state, reason) => run(() => trainingActivitiesApi.attendance(dialog.participant.id, state, reason), "Attendance recorded")} />
      )}
      {dialog?.type === "assessment" && (
        <AssessmentDialog participant={dialog.participant} busy={busy} onClose={() => setDialog(undefined)} onSave={(got, max, remarks) => run(() => trainingActivitiesApi.assessment(dialog.participant.id, got, max, remarks), "Result recorded")} />
      )}
      {dialog?.type === "designate" && (
        <DesignateDialog activityId={activity.id} step={dialog.step} busy={busy} onClose={() => setDialog(undefined)} onSave={(personId) => run(() => trainingActivitiesApi.designate(activity.id, dialog.step, personId), "Person designated")} />
      )}
      {dialog?.type === "trainerException" && (
        <TrainerExceptionDialog sessionId={dialog.session.id} busy={busy} onClose={() => setDialog(undefined)}
          onSave={(reason, approver) => run(async () => { await trainingActivitiesApi.requestTrainerException(dialog.session.id, reason, approver); return trainingActivitiesApi.get(activity.id); }, "Exception requested")} />
      )}
      {dialog?.type === "rejectException" && (
        <ReasonDialog title="Reject trainer exception" help="The session cannot go ahead with this trainer unless another exception is approved." confirmText="Reject" destructive busy={busy} onClose={() => setDialog(undefined)}
          onSave={(reason) => run(async () => { await trainingActivitiesApi.rejectTrainerException(dialog.exceptionId, reason); return trainingActivitiesApi.get(activity.id); }, "Exception rejected")} />
      )}
      {dialog?.type === "removeParticipant" && (
        <ReasonDialog title={`Remove ${dialog.participant.fullName}`} help="Only before the attendee list is confirmed. The name and the reason stay in the Audit Trail. After that, mark the person absent instead." confirmText="Remove" destructive busy={busy}
          onClose={() => setDialog(undefined)} onSave={(reason) => run(() => trainingActivitiesApi.removeParticipant(dialog.participant.id, reason), "Person removed")} />
      )}
      {dialog?.type === "plannedAbsence" && (
        <ReasonDialog title={`Mark ${dialog.participant.fullName} absent`} help="The person stays on the attendee list, as SOP.0003 5.3.4 requires. The reason is written on the row." confirmText="Mark absent" busy={busy}
          onClose={() => setDialog(undefined)} onSave={(reason) => run(() => trainingActivitiesApi.setPlannedAbsence(dialog.participant.id, reason), "Marked absent")} />
      )}
      {dialog?.type === "supplementary" && (
        <SupplementaryDialog participants={activity.participants.filter((p) => p.state === "ABSENT" || p.result === "FAILED")} busy={busy} onClose={() => setDialog(undefined)}
          onSave={(ids, reason) => run(async () => {
            const created = await trainingActivitiesApi.supplementary(activity.id, ids, reason);
            navigate(`/training-management/activities/${created.id}`);
            return created;
          }, "Make-up activity created")} />
      )}
      <ESignatureModal
        isOpen={!!sign}
        onClose={() => setSign(undefined)}
        onConfirm={async (data: { signatureToken: string }) => {
          if (!sign) return;
          const ok = await run(() => sign.run(data.signatureToken), sign.title);
          if (ok) setSign(undefined);
        }}
        actionTitle={sign?.title}
        meaningDisplayName={sign?.meaningName}
        meaningCode={sign?.meaningCode}
        targetDetails={{ code: activity.trainingNumber, title: activity.trainingTitle, revision: "" }}
      />
    </>
  );
}

// ------------------------------------------------------------------------------------------------------------------------------ dialogs

function ReasonDialog({ title, help, confirmText, destructive, busy, onClose, onSave }: {
  title: string; help?: string; confirmText: string; destructive?: boolean; busy: boolean; onClose: () => void; onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave(reason.trim())} title={title} description={help} confirmText={confirmText} confirmVariant={destructive ? "destructive" : "default"} isLoading={busy} confirmDisabled={!reason.trim()} size="md">
      <FormField label="Reason" required>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
    </FormModal>
  );
}

function PostponeDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (date: string, reason: string) => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave(date, reason.trim())} title="Postpone session" description="The Training Number stays. The old date, the new date and the reason are recorded." confirmText="Postpone" isLoading={busy} confirmDisabled={!date || !reason.trim()} size="md">
      <div className="grid gap-4">
        <TrainingDateField label="New date" value={date} onChange={setDate} />
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </div>
    </FormModal>
  );
}

function AttendanceDialog({ participant, busy, onClose, onSave }: { participant: TrainingParticipant; busy: boolean; onClose: () => void; onSave: (state: "ATTENDED" | "ONLINE" | "ABSENT", reason?: string) => void }) {
  const [state, setState] = useState<"ATTENDED" | "ONLINE" | "ABSENT">("ATTENDED");
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen onClose={onClose} title={`Attendance: ${participant.fullName}`} confirmText="Save" isLoading={busy} confirmDisabled={state === "ABSENT" && !reason.trim()} size="md" onConfirm={() => onSave(state, reason.trim() || undefined)}>
      <div className="grid gap-4">
        <FormField label="Attendance" required>
          <Select value={state} enableSearch={false} onChange={(v) => setState(v)} options={[{ label: "Attended", value: "ATTENDED" }, { label: "Attended online", value: "ONLINE" }, { label: "Absent", value: "ABSENT" }]} />
        </FormField>
        {state === "ABSENT" && <FormField label="Reason for absence" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>}
      </div>
    </FormModal>
  );
}

function AssessmentDialog({ participant, busy, onClose, onSave }: { participant: TrainingParticipant; busy: boolean; onClose: () => void; onSave: (got: number, max: number, remarks?: string) => void }) {
  const [got, setGot] = useState("");
  const [max, setMax] = useState("100");
  const [remarks, setRemarks] = useState("");
  const valid = got !== "" && Number(max) > 0 && Number(got) >= 0 && Number(got) <= Number(max);
  return (
    <FormModal isOpen onClose={onClose} title={`Result: ${participant.fullName}`} description="Enter the score. The system works out the percentage and the result from the pass mark in force." confirmText="Save" isLoading={busy} confirmDisabled={!valid} size="md"
      onConfirm={() => onSave(Number(got), Number(max), remarks.trim() || undefined)}>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Score obtained" required><Input type="number" min={0} value={got} onChange={(e) => setGot(e.target.value)} /></FormField>
        <FormField label="Maximum score" required><Input type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} /></FormField>
        <div className="col-span-2"><FormField label="Remarks"><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></FormField></div>
      </div>
    </FormModal>
  );
}

function DesignateDialog({ activityId, step, busy, onClose, onSave }: { activityId: string; step: TrainingApprovalStep; busy: boolean; onClose: () => void; onSave: (personId: string) => void }) {
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [personId, setPersonId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const search = useCallback(
    async (query: string) => {
      const page = await trainingActivitiesApi.eligibleApprovers(activityId, step, query);
      setPeople(page.data);
      setLoaded(true);
      return page.data.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }));
    },
    [activityId, step],
  );
  useEffect(() => {
    void search("");
  }, [search]);
  return (
    <FormModal isOpen onClose={onClose} title={`Designate: ${STEP_LABEL[step]}`} description="Only people the system found eligible for this step are listed." confirmText="Designate" isLoading={busy} confirmDisabled={!personId} size="md" onConfirm={() => onSave(personId)}>
      {loaded && people.length === 0 ? (
        <p className="text-sm text-amber-700">No eligible person was found. A person needs the permission of the step in this department and cannot be the person who prepared the activity.</p>
      ) : (
        <Select label="Person" value={personId} onChange={setPersonId} options={people.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} onSearch={search} placeholder="Search by name" />
      )}
    </FormModal>
  );
}

function SupplementaryDialog({ participants, busy, onClose, onSave }: { participants: TrainingParticipant[]; busy: boolean; onClose: () => void; onSave: (ids: string[], reason: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen onClose={onClose} title="Make-up or retraining" description="A new activity is created under the same number with the next letter. People who were absent or failed are listed." confirmText="Create" isLoading={busy} confirmDisabled={selected.length === 0 || !reason.trim()} size="md" onConfirm={() => onSave(selected, reason.trim())}>
      {participants.length === 0 ? (
        <p className="text-sm text-slate-600">No one was absent or failed.</p>
      ) : (
        <div className="grid gap-3">
          {participants.map((p) => (
            <Checkbox key={p.id} checked={selected.includes(p.id)} onChange={(c) => setSelected(c ? [...selected, p.id] : selected.filter((id) => id !== p.id))} label={`${p.fullName} — ${p.state === "ABSENT" ? "absent" : "failed"}`} />
          ))}
          <FormField label="Reason" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
        </div>
      )}
    </FormModal>
  );
}

function TrainerExceptionDialog({ sessionId, busy, onClose, onSave }: { sessionId: string; busy: boolean; onClose: () => void; onSave: (reason: string, approver: string) => void }) {
  const [reason, setReason] = useState("");
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState("");
  const search = useCallback(async (query: string) => {
    const page = await trainingActivitiesApi.trainerExceptionApprovers(sessionId, query);
    setPeople(page.data);
    setLoaded(true);
    return page.data.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }));
  }, [sessionId]);
  useEffect(() => { void search(""); }, [search]);
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave(reason.trim(), id)} title="Request an exception for the trainer" description="The session goes ahead with this trainer only if the person you choose approves, with a signature." confirmText="Request" isLoading={busy} confirmDisabled={!reason.trim() || !id} size="md">
      <div className="grid gap-4">
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
        {loaded && people.length === 0 ? <p className="text-sm text-amber-700">No eligible approver was found.</p> : <Select label="Approver" value={id} onChange={setId} options={people.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} onSearch={search} placeholder="Search by name" />}
      </div>
    </FormModal>
  );
}
