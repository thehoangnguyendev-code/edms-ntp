import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
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
import { TrainingActivityFilesTab } from "./TrainingActivityFilesTab";
import { ReadonlyField, ReadonlyGrid, TabBlock, TrainingDetailLayout } from "./TrainingDetailLayout";
import {
  trainingActivitiesApi,
  trainingError,
  type TrainingActivityDetail,
  type TrainingApprovalStep,
  type TrainingParticipant,
  type TrainingPerson,
  type TrainingSession,
  type TrainingSuggestedParticipant,
} from "@/services/api/trainingActivities";
import {
  ASSESSMENT_LABEL, CONFIRMATION_LABEL, KIND_LABEL, KIND_REASON_LABEL, METHOD_LABEL, PARTICIPANT_STATE_LABEL, STATUS_LABEL, STEP_LABEL,
  day, trainingBreadcrumbs, when,
} from "./trainingLabels";

const ACTIVITY_STEPS = [
  { status: "RESERVED", label: "Waiting for approval" },
  { status: "PLANNED", label: "Planned" },
  { status: "NOTIFIED", label: "Notified" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "PENDING_QA_CONFIRMATION", label: "Waiting for QA confirmation" },
  { status: "COMPLETED", label: "Completed" },
];

type Dialog =
  | { type: "session" }
  | { type: "participants" }
  | { type: "cancel" }
  | { type: "postpone"; session: TrainingSession }
  | { type: "attendance"; participant: TrainingParticipant }
  | { type: "assessment"; participant: TrainingParticipant }
  | { type: "designate"; step: TrainingApprovalStep }
  | { type: "supplementary" }
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
export function TrainingActivityDetailPage() {
  const { activityId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth() as { user?: { id?: string } };
  const { hasPermission } = usePermissions();
  const [activity, setActivity] = useState<TrainingActivityDetail>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);

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

  const caps = activity?.capabilities;
  const title = "Training Activity Details";
  const tabs: TabItem[] = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "sessions", label: "Sessions", count: activity?.sessions.length },
      { id: "participants", label: "Participants", count: activity?.participants.length },
      { id: "approvals", label: "Approvals" },
      { id: "files", label: "Files" },
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
    { id: "method", header: "Method", cell: (s) => METHOD_LABEL[s.method] ?? s.method },
    { id: "assessment", header: "Assessment", cell: (s) => ASSESSMENT_LABEL[s.assessmentMethod] ?? s.assessmentMethod },
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
              {ex?.status === "PENDING" && q.canDecide && (
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
  const participantColumns: DataTableColumn<TrainingParticipant>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "name", header: "Name", cell: (p) => <span className="font-medium">{p.fullName}</span> },
    { id: "code", header: "Employee code", cell: (p) => p.employeeCode ?? p.externalOrg ?? "—" },
    { id: "department", header: "Department", cell: (p) => p.department ?? "—" },
    { id: "session", header: "Session", cell: (p) => sessionOf(p.sessionId)?.sessionNo ?? "—" },
    { id: "state", header: "Attendance", cell: (p) => PARTICIPANT_STATE_LABEL[p.state] ?? p.state },
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
    {
      id: "actions",
      header: "",
      cell: (p) => (
        <div className="flex flex-wrap gap-2">
          {caps?.recordAttendance && p.state === "INVITED" && sessionOf(p.sessionId)?.status === "HELD" && (
            <Button size="sm" variant="outline" onClick={() => setDialog({ type: "attendance", participant: p })}>Attendance</Button>
          )}
          {caps?.recordAssessment && (p.state === "ATTENDED" || p.state === "ONLINE") && sessionOf(p.sessionId)?.assessmentMethod !== "SELF_READING_CONFIRMATION" && (
            <Button size="sm" variant="outline-emerald" onClick={() => setDialog({ type: "assessment", participant: p })}>Record result</Button>
          )}
          {p.personUserId === user?.id && p.state === "INVITED" && sessionOf(p.sessionId)?.method === "SELF_READING" && ["NOTIFIED", "IN_PROGRESS"].includes(activity.status) && (
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

  const signAction = (title: string, meaningCode: string, meaningName: string, runWith: (token: string) => Promise<TrainingActivityDetail>) =>
    setSign({ title, meaningCode, meaningName, run: runWith });

  const footer = (
    <>
      {caps?.confirmList && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => signAction("Confirm attendee list", "TRAINING_LIST_VERIFIED", "Attendance List Verified", (t) => trainingActivitiesApi.confirmList(activity.id, t))}>Confirm attendee list</Button>}
      {caps?.notify && <Button size="sm" variant="default" className="whitespace-nowrap" loading={busy} onClick={() => void run(() => trainingActivitiesApi.notify(activity.id, activity.version), "Participants notified")}>Notify participants</Button>}
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
        {tab === "overview" && (
          <div className="space-y-6">
            <ReadonlyGrid>
              <ReadonlyField label="Training Number" value={activity.trainingNumber} />
              <ReadonlyField label="Status" value={STATUS_LABEL[activity.status] ?? activity.status} />
              <ReadonlyField label="Type" value={KIND_LABEL[activity.kind] ?? activity.kind} />
              <ReadonlyField label="Reason" value={activity.kindReason ? KIND_REASON_LABEL[activity.kindReason] ?? activity.kindReason : ""} />
              <ReadonlyField label="Title" value={activity.title} wide />
              <ReadonlyField label="Department" value={activity.departmentName} />
              <ReadonlyField label="Document" value={activity.documentNumber ? `${activity.documentNumber}${activity.revisionNumber ? ` Rev ${activity.revisionNumber}` : ""}` : ""} />
              <ReadonlyField label="Approved on" value={day(activity.approvedOn)} />
              <ReadonlyField label="Due" value={day(activity.dueDate)} />
              <ReadonlyField label="Completed on" value={day(activity.completedOn)} />
              <ReadonlyField label="Remarks" value={activity.remarks} wide />
              {activity.cancelReason && <ReadonlyField label="Reason for cancelling" value={activity.cancelReason} wide />}
            </ReadonlyGrid>
            <TabBlock title="Confirmations">
              <DataTable
                rows={activity.confirmations}
                getRowKey={(c) => c.id}
                columns={[
                  { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
                  { id: "kind", header: "Confirmation", cell: (c) => CONFIRMATION_LABEL[c.kind] ?? c.kind },
                  { id: "by", header: "Confirmed by", cell: (c) => c.confirmedByName },
                  { id: "at", header: "Date", cell: (c) => when(c.confirmedAt) },
                  { id: "remark", header: "Remark", cell: (c) => c.remark || "—" },
                ] as DataTableColumn<(typeof activity.confirmations)[number]>[]}
                emptyState={<p className="p-4 text-sm text-slate-500">None yet.</p>}
              />
            </TabBlock>
          </div>
        )}

        {tab === "sessions" && (
          <TabBlock title="Sessions" action={caps?.planSessions ? <Button size="sm" variant="outline-emerald" onClick={() => setDialog({ type: "session" })}>Add session</Button> : undefined}>
            <DataTable rows={activity.sessions} getRowKey={(s) => s.id} columns={sessionColumns} emptyState={<p className="p-4 text-sm text-slate-500">No session yet.</p>} />
          </TabBlock>
        )}

        {tab === "participants" && (
          <TabBlock title="Participants" action={caps?.planSessions && activity.sessions.length > 0 ? <Button size="sm" variant="outline-emerald" onClick={() => setDialog({ type: "participants" })}>Add participants</Button> : undefined}>
            <DataTable rows={activity.participants} getRowKey={(p) => p.id} columns={participantColumns} emptyState={<p className="p-4 text-sm text-slate-500">No participant yet.</p>} />
          </TabBlock>
        )}

        {tab === "approvals" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              The person who prepares the training chooses who reviews and approves the content. Only a person who holds the permission for the step, in the right
              department, and who is not the person who prepared it, can be chosen. The person chosen signs with an electronic signature.
            </p>
            {(["CONTENT_REVIEW", "CONTENT_APPROVE"] as TrainingApprovalStep[]).map((step) => {
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
                      {!done && assigned && iAmAssigned(step) && (
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

        {tab === "files" && <TrainingActivityFilesTab activityId={activity.id} participants={activity.participants} />}

        {tab === "audit" && <AuditTrailTab entityId={activity.id} entityType="TRAINING_ACTIVITY" />}
      </TrainingDetailLayout>

      {dialog?.type === "session" && <SessionDialog onClose={() => setDialog(undefined)} busy={busy} onSave={(body) => run(() => trainingActivitiesApi.addSession(activity.id, body), "Session added")} />}
      {dialog?.type === "participants" && (
        <ParticipantsDialog activityId={activity.id} sessions={activity.sessions} busy={busy} onClose={() => setDialog(undefined)} onSave={(body) => run(() => trainingActivitiesApi.addParticipants(activity.id, body), "Participants added")} />
      )}
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
        targetDetails={{ code: activity.trainingNumber, title: activity.title, revision: "" }}
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
        <FormField label="New date" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </div>
    </FormModal>
  );
}

/** Looks up people on the server as the person types (the department is applied by the server). */
function PersonPicker({ value, onChange, label }: { value: string; onChange: (id: string, person?: TrainingPerson) => void; label: string }) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const search = useCallback(async (query: string) => {
    const people = await trainingActivitiesApi.people(query);
    const mapped = people.map((p) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id }));
    setOptions(mapped);
    return mapped;
  }, []);
  useEffect(() => {
    void search("");
  }, [search]);
  return <Select label={label} value={value} onChange={(v) => onChange(v)} options={options} onSearch={search} placeholder="Search by name" />;
}

function SessionDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (body: Parameters<typeof trainingActivitiesApi.addSession>[1]) => void }) {
  const [form, setForm] = useState({ method: "CLASSROOM", assessmentMethod: "TEST", trainerUserId: "", externalTrainerName: "", scheduledOn: "", venue: "", topic: "" });
  return (
    <FormModal isOpen onClose={onClose} title="Add session" confirmText="Add" isLoading={busy} confirmDisabled={!form.topic.trim() || (!form.trainerUserId && !form.externalTrainerName.trim())} size="lg"
      onConfirm={() => onSave({ method: form.method, assessmentMethod: form.assessmentMethod, trainerUserId: form.trainerUserId || undefined, externalTrainerName: form.externalTrainerName.trim() || undefined, scheduledOn: form.scheduledOn || undefined, venue: form.venue.trim() || undefined, topics: [{ topicText: form.topic.trim() }] })}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><FormField label="Topic" required><Input value={form.topic} maxLength={500} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></FormField></div>
        <FormField label="Method" required>
          <Select value={form.method} enableSearch={false} onChange={(v) => setForm({ ...form, method: v })} options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ label, value }))} />
        </FormField>
        <FormField label="Assessment" required>
          <Select value={form.assessmentMethod} enableSearch={false} onChange={(v) => setForm({ ...form, assessmentMethod: v })} options={Object.entries(ASSESSMENT_LABEL).map(([value, label]) => ({ label, value }))} />
        </FormField>
        <FormField label="Trainer"><PersonPicker label="" value={form.trainerUserId} onChange={(id) => setForm({ ...form, trainerUserId: id })} /></FormField>
        <FormField label="Or an outside trainer"><Input value={form.externalTrainerName} onChange={(e) => setForm({ ...form, externalTrainerName: e.target.value })} /></FormField>
        <FormField label="Scheduled date"><Input type="date" value={form.scheduledOn} onChange={(e) => setForm({ ...form, scheduledOn: e.target.value })} /></FormField>
        <FormField label="Venue"><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></FormField>
      </div>
    </FormModal>
  );
}

function ParticipantsDialog({ activityId, sessions, busy, onClose, onSave }: {
  activityId: string; sessions: TrainingSession[]; busy: boolean; onClose: () => void; onSave: (body: { sessionId: string; personUserIds?: string[]; externalName?: string; externalOrg?: string; reason: string }) => void;
}) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [personId, setPersonId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [externalOrg, setExternalOrg] = useState("");
  const [reason, setReason] = useState("");
  const [suggested, setSuggested] = useState<TrainingSuggestedParticipant[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (!sessionId) { setSuggested([]); return; }
    trainingActivitiesApi.suggestedParticipants(activityId, sessionId).then((list) => { setSuggested(list); setPicked([]); }).catch(() => setSuggested([]));
  }, [activityId, sessionId]);
  const people = Array.from(new Map(suggested.map((p) => [p.personId, p])).values());
  return (
    <FormModal isOpen onClose={onClose} title="Add participant" description="A person added by hand needs a reason; it stays in the record." confirmText="Add" isLoading={busy}
      confirmDisabled={!sessionId || !reason.trim() || (!personId && !externalName.trim() && picked.length === 0)} size="lg"
      onConfirm={() => onSave({ sessionId, personUserIds: [...(personId ? [personId] : []), ...picked].length ? [...(personId ? [personId] : []), ...picked] : undefined, externalName: externalName.trim() || undefined, externalOrg: externalOrg.trim() || undefined, reason: reason.trim() })}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField label="Session" required>
            <Select value={sessionId} enableSearch={false} onChange={setSessionId} options={sessions.map((s) => ({ label: `Session ${s.sessionNo}: ${s.topics.map((t) => t.topicText).join("; ")}`, value: s.id }))} />
          </FormField>
        </div>
        {people.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>Required by the training matrix ({people.length})</span>
              <button type="button" className="text-xs text-emerald-700 underline" onClick={() => { setPicked(people.map((p) => p.personId)); if (!reason.trim()) setReason("Required by the training matrix"); }}>Select all</button>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {people.map((p) => (
                <li key={p.personId}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={picked.includes(p.personId)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.personId] : picked.filter((x) => x !== p.personId))} />
                    {p.fullName}{p.employeeCode ? ` (${p.employeeCode})` : ""} — {p.positionName}, {p.reason === "DUE" ? "annual training due" : "not trained"}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="md:col-span-2"><FormField label="Employee"><PersonPicker label="" value={personId} onChange={(id) => setPersonId(id)} /></FormField></div>
        <FormField label="Or a person from outside"><Input value={externalName} onChange={(e) => setExternalName(e.target.value)} /></FormField>
        <FormField label="Organisation"><Input value={externalOrg} onChange={(e) => setExternalOrg(e.target.value)} /></FormField>
        <div className="md:col-span-2"><FormField label="Reason" required><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField></div>
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
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))} />
              {p.fullName} — {p.state === "ABSENT" ? "absent" : "failed"}
            </label>
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
