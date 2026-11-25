import { sessionStarted, sessionNotStarted } from "@/services/api/trainingActivities";
import { SessionEditDialog } from "./components/SessionEditDialog";
import { LegacyPeopleTab } from "./components/LegacyPeopleTab";
import type { SessionCardData } from "./components/SessionCards";
import { sessionFormFrom, type CopySource } from "./components/SessionFormModal";
import { SessionsSection } from "./components/SessionsSection";
import { SessionPills, type SessionPill } from "./components/SessionPills";
import { TrainingParticipantTable } from "./components/TrainingParticipantTable";
import { TrainingAttendanceRow } from "./components/TrainingAttendanceRow";
import { ContentRulesPanel, assessmentFormKind, contentRuleNote } from "./components/ContentRulesPanel";
import { Avatar } from "@/components/ui/avatar";
import { RadioGroup } from "@/components/ui/radio";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Children, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Check } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../shared/TrainingFields";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import {
  IconBook2,
  IconCalendar,
  IconChecklist,
  IconClipboardCheck,
  IconMapPin,
  IconPresentation,
  IconTrophy,
  IconUser,
  IconUserCheck,
  IconUserX,
  IconUsers,
} from "@tabler/icons-react";
import {
  TrainingSessionWorkspaceShell,
  type WorkspaceRate,
  type WorkspaceStat,
  type WorkspaceStep,
} from "./components/TrainingSessionWorkspaceShell";
import { WorkspacePrepareStep } from "./components/workspace/WorkspacePrepareStep";
import { WorkspaceAttendanceStep } from "./components/workspace/WorkspaceAttendanceStep";
import { WorkspaceTrainingStep } from "./components/workspace/WorkspaceTrainingStep";
import { WorkspaceAssessmentStep } from "./components/workspace/WorkspaceAssessmentStep";
import { WorkspaceResultsStep } from "./components/workspace/WorkspaceResultsStep";
import { WorkspaceReadingResultsStep } from "./components/workspace/WorkspaceReadingResultsStep";
import { WorkspaceResultsTable } from "./components/workspace/WorkspaceResultsTable";
import { TrainingActivityResultsCard } from "./components/TrainingActivityResultsCard";
import { TrainingApproverSelectModal } from "./components/TrainingApproverSelectModal";
import { TrainingExamBlock } from "./components/TrainingExamBlock";
import { SessionAssessmentList, TrainingAssessmentChoiceBlock } from "./components/TrainingAssessmentChoiceBlock";
import { FormDownloadButtons } from "../shared/FormDownloadButtons";
import { AttendanceListExport } from "./components/AttendanceListExport";
import { TrainingPreparationBlock } from "./components/TrainingPreparationBlock";
import { TrainingTranscriptionBlock } from "./components/TrainingTranscriptionBlock";
import {
  TrainingPrintedPacks,
  DELIVERY_LABEL,
} from "./components/TrainingPaperBlock";
import { TrainingActivityFilesTab } from "./components/TrainingActivityFilesTab";
import { TrainingDateField, DATE_HINT } from "../shared/TrainingDateField";
import {
  ParticipantsPanel,
  SessionPanel,
} from "./components/TrainingActivityPlanning";
import {
  ReadonlyField,
  ReadonlyGrid,
  TrainingDetailLayout,
} from "../shared/TrainingDetailLayout";
import {
  trainingActivitiesApi,
  trainingPreparationApi,
  trainingDocumentSourcesApi,
  type TrainingSessionDefaults,
  trainingExamApi,
  trainingCodeText,
  trainingError,
  trainingFormsApi,
  type TrainingActivityDetail,
  type TrainingApprovalStep,
  type TrainingCapabilities,
  type ParticipationRole,
  type TrainingParticipant,
  type TrainingPerson,
  type TrainingSession,
} from "@/services/api/trainingActivities";
import {
  ASSESSMENT_LABEL,
  EXTERNAL_TYPE_LABEL,
  KIND_LABEL,
  KIND_REASON_LABEL,
  METHOD_LABEL,
  PARTICIPANT_STATE_LABEL,
  PARTICIPATION_ROLE_HELP,
  PARTICIPATION_ROLE_LABEL,
  STATUS_LABEL,
  day,
  trainingBreadcrumbs,
  fileSafe, when, statusChange } from "../shared/trainingLabels";
import { useTrainingBack } from "../shared/useTrainingBack";
import { tr, trFormat } from "@/i18n";

const EMPTY_PARTICIPANT_STATS = { total: 0, pending: 0, attendancePending: 0, eligible: 0, unscored: 0, present: 0, absent: 0, actualAbsent: 0, passed: 0, failed: 0, readPending: 0 };

/** One screen for each thing a person does with an activity; the Details screen only looks (like Document Details and the Review, Approval and Training screens of a revision). */
export type ActivityMode =
  | "view"
  | "edit"
  | "prepare"
  | "conduct"
  | "approve"
  | "confirm"
  | "participate";
const MODE_TITLE: Record<ActivityMode, string> = {
  view: "Training Activity Details",
  edit: "Edit Training Activity",
  prepare: "Prepare Training",
  conduct: "Conduct Training",
  approve: "Approve Training Content",
  confirm: "Confirm Training Completion",
  participate: "Training Participation",
};
const MODE_TAB: Record<ActivityMode, string> = {
  view: "overview",
  edit: "overview",
  prepare: "overview",
  conduct: "overview",
  approve: "materials",
  confirm: "overview",
  participate: "participants",
};
// A person who fails (or is absent) does not stop the activity from being completed; the retraining is a new activity under the same number with the next letter (SOP.0003 5.1.4, 5.3.7), arranged
// from the Completed activity (the server allows it only then, and shows the capability only then), which is read in the details: so the button is allowed there and in no other mode.
const MODE_CAPS: Record<ActivityMode, string[]> = {
  view: ["addSupplementary"],
  edit: [
    "edit",
    "editRemarks",
    "editSession",
    "reopenContent",
    "planSessions",
    "adjustPlan",
    "addParticipants",
    "removeParticipants",
    "confirmList",
    "designateApprovers",
    "submitForApproval",
    "setContentExemptions",
    "chooseAssessment",
    "notify",
    "cancel",
  ],
  prepare: ["adjustPlan", "printPaper", "startTraining", "resendNotifications", "cancel"],
  conduct: [
    "resendNotifications",
    "adjustPlan",
    "remindToRead",
    "excuseReader",
    "printPaper",
    "rollCall",
    "transcribe",
    "verifyTranscription",
    "hold",
    "recordAttendance",
    "recordAssessment",
    "finishTraining",
    "sendAttendanceList",
    "cancel",
  ],
  approve: [],
  confirm: ["confirmCompletion", "returnForCorrection"],
  participate: [],
};
const limitCaps = (
  raw: TrainingCapabilities,
  mode: ActivityMode,
): TrainingCapabilities => {
  const allowed = new Set(MODE_CAPS[mode]);
  const out: Record<string, unknown> = { ...raw };
  for (const key of Object.keys(out))
    if (key !== "notifyBlockers" && key !== "submitBlockers" && key !== "startBlockers" && key !== "completeTraining" && !allowed.has(key)) out[key] = false;
  return out as unknown as TrainingCapabilities;
};

type Dialog =
  | { type: "cancel" }
  | { type: "editSession"; session: TrainingSession }
  | { type: "cancelSession"; session: TrainingSession }
  | { type: "reopenContent" }
  | { type: "returnForCorrection" }
  | { type: "releaseExam"; participant: TrainingParticipant }
  | { type: "postpone"; session: TrainingSession }
  | { type: "attendance"; participant: TrainingParticipant }
  | { type: "correctAttendance"; participant: TrainingParticipant }
  | { type: "participation"; participant: TrainingParticipant }
  | { type: "assessment"; participant: TrainingParticipant }
  | { type: "approver" }
  | { type: "rejectContent" }
  | { type: "supplementary" }
  | { type: "removeParticipant"; participant: TrainingParticipant }
  | { type: "plannedAbsence"; participant: TrainingParticipant }
  | { type: "trainerException"; session: TrainingSession }
  | { type: "rejectException"; exceptionId: string }
  | undefined;

/** What the toast says once a signed action is done (the title of the signing window says what is about to be done). */
const SIGNED_DONE: Record<string, string> = {
  TRAINING_LIST_VERIFIED: "Attendee list confirmed",
  TRAINING_READER_EXCUSED: "Recorded as unable to read. Offer a supplementary training from the activity.",
  TRAINING_CONTENT_APPROVED: "Training content approved",
  TRAINING_TRAINER_EXCEPTION_APPROVED: "Trainer exception approved",
  TRAINING_ACTIVITY_NOTIFIED: "Participants notified",
  TRAINING_ATTENDANCE_SENT: "Attendance list sent to QA",
  TRAINING_RESULTS_FINISHED: "Training finished",
  TRAINING_SESSION_STARTED: "Training started",
  TRAINING_READ_CONFIRMED: "Self-reading confirmed",
  TRAINING_READ_VERIFIED: "Self-reading verified",
  TRAINING_SUBMITTED_FOR_CONFIRMATION: "Results sent to QA",
  TRAINING_COMPLETED: "Training completed",
  TRAINING_CONTENT_REOPENED: "Training content reopened",
  TRAINING_RETURNED_FOR_CORRECTION: "Results returned for correction",
  TRAINING_ACTIVITY_CANCELLED: "Training activity cancelled",
  TRAINING_SESSION_CANCELLED: "Training session cancelled",
};

interface SignRequest {
  title: string;
  meaningCode: string;
  meaningName: string;
  changes?: ReturnType<typeof statusChange>;
  /** The reason is what the signer typed in the electronic signature window; only the actions that write it on a form use it. */
  run: (signatureToken: string, reason?: string) => Promise<TrainingActivityDetail>;
}

/** One training activity: its facts, sessions, people, approval steps and Audit Trail. The server decides what is allowed; the buttons follow `capabilities`. */
const WORKSPACE_STEPS = [
  "ws-prepare",
  "ws-attendance",
  "ws-training",
  "ws-assessment",
  "ws-results",
];
const stepKey = (sessionId: string) =>
  `eqms.training.workspace.step.${sessionId}`;

/**
 * One training activity. With `workspaceSessionId` it is the workspace of ONE session of the activity: the steps of the day (prepare, attendance, training, assessment, results) in order.
 * The steps only guide: nothing is blocked by the order, and the server keeps the hard rules. What the person did is on the server, so closing the tab and coming back finds the same
 * state; the last step viewed is remembered in the address and in this browser.
 */
export function TrainingActivityDetailPage({
  mode = "view",
  workspaceSessionId,
}: {
  mode?: ActivityMode;
  workspaceSessionId?: string;
}) {
  const { activityId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = useTrainingBack("/training-management/activities");
  const { showToast } = useToast();
  const { user } = useAuth() as { user?: { id?: string } };
  const [activity, setActivity] = useState<TrainingActivityDetail>();
  const [error, setError] = useState("");
  const location = useLocation();
  const workspace = Boolean(workspaceSessionId);
  const [tab, setTab] = useState<string>(() => {
    if (workspaceSessionId) {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(stepKey(workspaceSessionId));
      } catch {
        /* the step is only a convenience */
      }
      const wanted = new URLSearchParams(location.search).get("step") ?? stored;
      return wanted && WORKSPACE_STEPS.includes(wanted) ? wanted : "ws-prepare";
    }
    return (location.state as { tab?: string } | null)?.tab ?? MODE_TAB[mode];
  });
  // A workspace opened without a remembered step (another browser, another day) opens at the first step that is not done, whatever was remembered here.
  const [stepSettled, setStepSettled] = useState(() => {
    if (!workspaceSessionId) return true;
    try {
      return !!(new URLSearchParams(location.search).get("step") ?? window.localStorage.getItem(stepKey(workspaceSessionId)));
    } catch {
      return !!new URLSearchParams(location.search).get("step");
    }
  });
  const [dialog, setDialog] = useState<Dialog>();
  // The session the tabs Training Materials and Assessment look at ("" is all of them).
  const [contentSession, setContentSession] = useState("");
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);
  const [pSession, setPSession] = useState(workspaceSessionId ?? "");
  // Lines of the Prepare step still to be ticked; the steps after it wait for them while the session is not held.
  const [prepPending, setPrepPending] = useState(0);
  const [draft, setDraft] = useState<{
    dueDate: string;
    remarks: string;
    trainingUnitName: string;
    vendorRef: string;
  }>();

  const loadGeneration = useRef(0);
  // Whether the overview carries the people. It is a value, not the tab: moving between the tabs that do not need the people (General Information, Participants, Signatures, Audit Trail) asks the
  // server for exactly the same thing, so it must not load again (a second load made the participant tables load twice and flicker).
  const participantContext = !["overview", "participants", "audit", "signatures", "ws-prepare"].includes(tab) || dialog?.type === "supplementary";
  const overviewQuery = useRef({ activityId, sessionId: workspaceSessionId || pSession || undefined, participantContext: false });
  overviewQuery.current = { activityId, sessionId: workspaceSessionId || pSession || undefined, participantContext };
  const load = useCallback(() => {
    const generation = ++loadGeneration.current;
    setError("");
    const { activityId: currentId, ...params } = overviewQuery.current;
    return trainingActivitiesApi.overview(currentId, params)
      .then((result) => { if (generation === loadGeneration.current) setActivity(result); })
      .catch((e) => { if (generation === loadGeneration.current) setError(trainingError(e)); });
  }, [activityId, workspaceSessionId, pSession, participantContext]);
  useEffect(() => { void load(); return () => { loadGeneration.current++; }; }, [load]);
  useEntityChanged(["TRAINING"], load);
  // The invitations go out in the background: while some are still waiting the progress is read again every few seconds.
  const invitationsWaiting = activity?.invitations?.waiting ?? 0;
  useEffect(() => {
    if (invitationsWaiting <= 0) return;
    const timer = setTimeout(() => void load(), 3000);
    return () => clearTimeout(timer);
  }, [invitationsWaiting, activity?.invitations?.sent, activity?.invitations?.failed, load]);

  /** Runs a command; the answer is the new state of the activity. */
  const run = async (
    action: () => Promise<TrainingActivityDetail>,
    done: string,
  ) => {
    setBusy(true);
    try {
      await action();
      await load();
      showToast({
        type: "success",
        title: done,
        message: activity?.trainingNumber ?? "",
      });
      setDialog(undefined);
      return true;
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The action was not done"),
        message: trainingError(e),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const caps = activity ? limitCaps(activity.capabilities, mode) : undefined;
  // What the first session starts with when the training comes from a document (SOP.0003 5.1.2 and 5.3.6); the person organizing changes any of it.
  const [sessionDefaults, setSessionDefaults] = useState<TrainingSessionDefaults | null>(null);
  useEffect(() => {
    if (!activity?.documentNumber || !caps?.planSessions) { setSessionDefaults(null); return; }
    let live = true;
    trainingDocumentSourcesApi.get(activity.id).then((r) => { if (live) setSessionDefaults(r.sessionDefaults); }).catch(() => { if (live) setSessionDefaults(null); });
    return () => { live = false; };
  }, [activity?.id, activity?.documentNumber, caps?.planSessions]);
  // The list menu entry "Supplementary Training" lands here with the dialog already open, once.
  const openedSupplementary = useRef(false);
  const wantsSupplementary = Boolean((location.state as { openSupplementary?: boolean } | null)?.openSupplementary);
  useEffect(() => {
    if (!wantsSupplementary || openedSupplementary.current || !caps) return;
    openedSupplementary.current = true;
    if (caps.addSupplementary && (activity?.supplementaryPending ?? 0) > 0) setDialog({ type: "supplementary" });
  }, [wantsSupplementary, caps, activity?.supplementaryPending]);
  const title = workspace ? tr("Session Workspace") : MODE_TITLE[mode];
  // A person who takes part (mode participate) sees their own part only; the results of everyone, with the scan of each test, are shown under the command buttons where the activity is read, conducted or confirmed.
  const showResults = Boolean(activity) && mode !== "participate" && activity?.kind !== "LEGACY" && ["IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED"].includes(activity?.status ?? "")
    // a self-reading has no scores and no scanned tests (the reading and the head's confirmation are on the Participants tab): the table of results is for the other methods
    && !(activity?.sessions ?? []).filter((x) => x.status !== "CANCELLED").every((x) => x.method === "SELF_READING");
  const tabs: TabItem[] = useMemo(
    () =>
      [
        { id: "overview", label: tr("General Information") },
        {
          id: "participants",
          // A historical activity (Legacy Import) has no participants of sessions: the tab shows the persons who were trained on paper.
          label: activity?.kind === "LEGACY" ? tr("Persons Trained") : tr("Participants"),
          // The total comes from the summary, which the server always sends; the list itself is empty on the tabs that do not need the people, which made this number jump between 0 and the real one.
          count: activity?.kind === "LEGACY" ? undefined : (activity?.participantSummary?.all?.total ?? activity?.participants.length),
        },
        { id: "materials", label: tr("Training Materials") },
        { id: "assessment", label: "Assessment" },
        { id: "signatures", label: tr("Signatures") },
        { id: "audit", label: tr("Audit Trail") },
      ],
    [activity?.kind, activity?.participantSummary?.all?.total, activity?.participants.length],
  );
  // The step is kept in the address and in this browser: a closed tab opens again on the step it was left on.
  useEffect(() => {
    if (!workspaceSessionId || !WORKSPACE_STEPS.includes(tab)) return;
    try {
      window.localStorage.setItem(stepKey(workspaceSessionId), tab);
    } catch {
      /* the step is only a convenience */
    }
    navigate({ search: `?step=${tab}` }, { replace: true });
  }, [tab, workspaceSessionId, navigate]);

  // The steps after Prepare open once the training of the session has started (Prepare, Next: signed when it is the first session of the activity).
  const notStartedHere = workspace && activity && tab !== "ws-prepare" && activity.sessions.some((x) => x.id === workspaceSessionId && sessionNotStarted(x));
  useEffect(() => {
    if (notStartedHere) setTab("ws-prepare");
  }, [notStartedHere]);

  if (!activity) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title={title}
          breadcrumbItems={trainingBreadcrumbs(navigate, "activities", title)}
        />
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : (
          <SectionLoading text="Loading training activity…" />
        )}
      </div>
    );
  }

  const stepAssignment = (step: TrainingApprovalStep) =>
    activity.approvers.find(
      (a) => a.stepCode === step && a.status === "PENDING",
    );
  const stepDone = (kind: string) =>
    activity.confirmations.some((c) => c.kind === kind);
  const iAmAssigned = (step: TrainingApprovalStep) =>
    stepAssignment(step)?.assigneeId === user?.id;
  const allParticipantStats = activity.participantSummary?.all ?? EMPTY_PARTICIPANT_STATS;
  const hasSelfReading = activity.sessions.some(
    (s) => s.method === "SELF_READING",
  );

  /**
   * While the training is in progress, the work of a session (attendance, results, the paper pack, the preparation, the test, the scans) is done in the Session Workspace of that
   * session. Conduct Training then follows the training: where each session stands, who attended, the results and the evidence, read only.
   */
  const monitoring = mode === "conduct" && !workspace && activity.status === "IN_PROGRESS";
  /** With one session the Session column and the choice of a session say nothing: they are left out. */
  const singleSession = activity.sessions.length <= 1;

  /** The workspace of one session opens in a new tab, so the person can keep the activity open beside it. */
  const openWorkspace = (sessionId: string) =>
    window.open(
      `/training-management/activities/${activity.id}/sessions/${sessionId}/workspace`,
      "_blank",
      "noopener",
    );
  /** The real name of the trainer; an external training with no trainer named shows the unit or the person who trains. */
  const trainerOf = (s: TrainingSession) =>
    s.trainerName?.trim() ||
    s.externalTrainerName?.trim() ||
    (activity.kind === "EXTERNAL" ? activity.trainingUnitName?.trim() || "—" : "—");
  /** What the check of the trainer of a session says (SOP.0003 5.3.4) and what the person may do about it; null when it does not apply. */
  const renderTrainerCheck = (s: TrainingSession): ReactNode => {
        const q = s.trainerQualification;
        if (!q || !q.applies) return null;
        if (q.qualified) return <Badge color="emerald">{tr("Qualified")}</Badge>;
        const ex = q.exception;
        return (
          <div className="max-w-64 space-y-1 whitespace-normal">
            {ex?.status === "APPROVED" ? (
              <Badge color="amber">{tr("Exception approved")}</Badge>
            ) : ex?.status === "PENDING" ? (
              <Badge color="amber">{tr("Exception waiting")}</Badge>
            ) : (
              <Badge color="red">{tr("Not qualified")}</Badge>
            )}
            {ex?.status !== "APPROVED" && (
              <ul className="list-disc pl-4 text-xs text-slate-600">
                {q.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {ex?.status === "REJECTED" && (
              <div className="text-xs text-red-700">
                {trFormat("Last exception rejected: {reason}", { reason: ex.rejectReason ?? "" })}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(!ex || ex.status === "REJECTED") &&
                sessionNotStarted(s) &&
                caps?.adjustPlan && (
                  <Button
                    size="sm"
                    variant="outline-emerald"
                    onClick={() =>
                      setDialog({ type: "trainerException", session: s })
                    }
                  >
                    {tr("Request Exception")}
                  </Button>
                )}
              {(mode === "approve" || mode === "edit") &&
                ex?.status === "PENDING" &&
                q.canDecide && (
                  <>
                    <Button
                      size="sm"
                      variant="outline-emerald"
                      onClick={() =>
                        signAction(
                          "Complete approval of the trainer exception",
                          "TRAINING_TRAINER_EXCEPTION_APPROVED",
                          "Trainer Exception Approved",
                          async (t) => {
                            await trainingActivitiesApi.approveTrainerException(
                              ex.id,
                              t,
                            );
                            return trainingActivitiesApi.get(activity.id);
                          },
                          statusChange("Pending Approval", "Approved", "Trainer exception"),
                        )
                      }
                    >
                      {tr("Complete Approval")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-emerald"
                      onClick={() =>
                        setDialog({
                          type: "rejectException",
                          exceptionId: ex.id,
                        })
                      }
                    >
                      {tr("Reject")}
                    </Button>
                  </>
                )}
            </div>
          </div>
        );
  };

  /** The buttons that apply to a session that has not started: change it, postpone it. */
  const renderSessionActions = (s: TrainingSession): ReactNode =>
        sessionNotStarted(s) && (caps?.adjustPlan || caps?.editSession) ? (
          <div className="flex flex-wrap gap-2">
            {caps?.editSession && (
              <Button size="sm" variant="outline-emerald" onClick={() => setDialog({ type: "editSession", session: s })}>
                {tr("Change")}
              </Button>
            )}
            {sessionNotStarted(s) && caps?.adjustPlan && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => setDialog({ type: "postpone", session: s })}
              >
                {tr("Postpone")}
              </Button>
            )}
            {caps?.editSession && activity.status === "PLANNED" && activity.sessions.filter((x) => x.status !== "CANCELLED").length > 1 && (
              <Button size="sm" variant="outline-emerald" onClick={() => setDialog({ type: "cancelSession", session: s })}>
                {tr("Cancel session")}
              </Button>
            )}
          </div>
        ) : null;

  const sessionOf = (id: string) => activity.sessions.find((s) => s.id === id);
  // a person whose account is not Active (left the company, suspended) cannot sign: the note is a second line so that the column keeps its width
  const accountNote = (p: TrainingParticipant) =>
    p.state === "INVITED" && p.accountStatus && p.accountStatus !== "Active" ? (
      <div className="text-xs text-red-600">{`Account ${p.accountStatus.toLowerCase()}: cannot sign`}</div>
    ) : null;
  const labelOfState = (p: TrainingParticipant) =>
    p.plannedAbsence && p.state === "INVITED"
      ? `Absent (planned): ${p.plannedAbsence}`
      : p.state === "ABSENT" && p.absenceReason
        ? `Absent: ${p.absenceReason}`
        : (PARTICIPANT_STATE_LABEL[p.state] ?? p.state) +
          (p.state === "ATTENDED" && p.signMode === "SELF"
            ? " (checked in by self)"
            : p.state === "ATTENDED" && p.signMode === "TRAINER_ATTESTED"
              ? " (marked by trainer)"
              : "");
  /** Whether the trainer can mark this person present or absent now (held session, not a self-reading, still invited). */
  const canMarkAttendance = (p: TrainingParticipant) =>
    Boolean(caps?.recordAttendance) &&
    p.state === "INVITED" &&
    sessionOf(p.sessionId)?.method !== "SELF_READING" &&
    sessionStarted(sessionOf(p.sessionId) ?? { status: "" });
  const renderActions = (
    p: TrainingParticipant,
    scope: "all" | "attendance" | "results",
    opts?: { skipMark?: boolean },
  ) => (
    <div className="flex max-w-[11rem] flex-wrap gap-2">
      {scope !== "results" &&
        mode === "edit" &&
        p.state === "INVITED" &&
        ["PLANNED", "NOTIFIED"].includes(activity.status) &&
        p.personUserId &&
        (p.plannedAbsence ? (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() =>
              void run(
                () => trainingActivitiesApi.setPlannedAbsence(p.id, ""),
                "Absence cleared",
              )
            }
          >
            {tr("Clear Absence")}
          </Button>
        ) : (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() =>
              setDialog({ type: "plannedAbsence", participant: p })
            }
          >
            {tr("Mark Absent")}
          </Button>
        ))}
      {scope !== "results" &&
        caps?.removeParticipants &&
        p.state === "INVITED" && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() =>
              setDialog({ type: "removeParticipant", participant: p })
            }
          >
            {tr("Remove")}
          </Button>
        )}
      {scope === "attendance" &&
        caps?.recordAttendance &&
        sessionOf(p.sessionId)?.method !== "SELF_READING" &&
        ["ATTENDED", "ONLINE", "ABSENT"].includes(p.state) &&
        p.result === "PENDING" &&
        !p.lastPercent &&
        !p.examState?.match(/OPEN|USED|DONE/) && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() =>
              setDialog({ type: "correctAttendance", participant: p })
            }
          >
            {tr("Correct Attendance")}
          </Button>
        )}
      {scope !== "results" &&
        mode === "edit" &&
        caps?.setParticipation &&
        sessionOf(p.sessionId)?.method !== "SELF_READING" &&
        p.state !== "READ_CONFIRMED" &&
        p.personUserId !== user?.id &&
        p.result !== "FAILED" &&
        !p.attempts &&
        !p.examState?.match(/OPEN|USED|DONE/) && (
          <Button
            size="sm"
            variant="outline-emerald"
            onClick={() => setDialog({ type: "participation", participant: p })}
          >
            {tr("Set Participation")}
          </Button>
        )}
      {scope !== "results" &&
        !opts?.skipMark &&
        canMarkAttendance(p) && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() => setDialog({ type: "attendance", participant: p })}
          >
            {tr("Mark Attendance")}
          </Button>
        )}
      {scope !== "results" &&
        caps?.remindToRead &&
        p.state === "INVITED" &&
        !!p.personUserId &&
        (p.accountStatus ?? "Active") === "Active" &&
        sessionOf(p.sessionId)?.method === "SELF_READING" && (
          <Button
            size="sm"
            variant="outline-emerald"
            disabled={busy}
            title={p.lastReadReminderAt ? `Last reminded ${when(p.lastReadReminderAt)}` : tr("Send an e-mail and a notice asking this person to read and sign")}
            onClick={() => run(() => trainingActivitiesApi.remindRead(p.id), `Reminder sent to ${p.fullName}`)}
          >
            {tr("Send Reminder")}
          </Button>
        )}
      {scope !== "results" &&
        caps?.excuseReader &&
        p.state === "INVITED" &&
        !!p.personUserId &&
        sessionOf(p.sessionId)?.method === "SELF_READING" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            title={tr("This person cannot read within this training (left, long leave, illness): they stay on the list as absent and are trained later in a supplementary training")}
            onClick={() =>
              signAction(
                `Record ${p.fullName} as unable to read`,
                "TRAINING_READER_EXCUSED",
                "Reader Excused from Self-reading",
                (t, reason) => trainingActivitiesApi.excuseReader(p.id, t, reason),
                statusChange("Invited", "Absent", p.fullName),
              )
            }
          >
            {tr("Cannot Read")}
          </Button>
        )}
      {scope !== "attendance" &&
        caps?.recordAssessment &&
        (p.participationRole ?? "TRAINEE") === "TRAINEE" &&
        (p.state === "ATTENDED" || p.state === "ONLINE") &&
        !!sessionOf(p.sessionId)?.assessmentMethod &&
        sessionOf(p.sessionId)?.assessmentMethod !==
          "SELF_READING_CONFIRMATION" && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() => setDialog({ type: "assessment", participant: p })}
          >
            {tr("Record Result")}
          </Button>
        )}
      {mode === "participate" &&
        p.personUserId === user?.id &&
        ["ATTENDED", "ONLINE"].includes(p.state) &&
        p.result === "PENDING" &&
        activity.status === "IN_PROGRESS" &&
        (p.examState === "READY" || p.examState === "OPEN") && (
          <Button
            size="sm"
            variant="default"
            onClick={() =>
              navigate(`/training-management/participations/${p.id}/test`)
            }
          >
            {p.examState === "OPEN" ? tr("Continue the Test") : tr("Take the Test")}
          </Button>
        )}
      {scope !== "attendance" &&
        caps?.recordAttendance &&
        p.examState === "USED" &&
        p.result === "PENDING" && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() => setDialog({ type: "releaseExam", participant: p })}
          >
            {tr("Release the Test")}
          </Button>
        )}
      {mode === "participate" &&
        p.personUserId === user?.id &&
        p.state === "INVITED" &&
        sessionOf(p.sessionId)?.method === "SELF_READING" &&
        ["NOTIFIED", "IN_PROGRESS"].includes(activity.status) && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() =>
              setSign({
                title: tr("Confirm Self-Reading"),
                meaningCode: "TRAINING_READ_CONFIRMED",
                meaningName: "Self-reading Confirmed",
                changes: statusChange("Invited", "Read and understood", "Self-reading"),
                run: async (token, reason) => {
                  await trainingActivitiesApi.confirmRead(p.id, token, reason);
                  return trainingActivitiesApi.get(activity.id);
                },
              })
            }
          >
            {tr("I have read and understood")}
          </Button>
        )}
    </div>
  );
  // The columns of the attendee list APD.0117: No., ID, name, department, session, attendance, result. The actions follow the screen.
  const participantColumns: DataTableColumn<TrainingParticipant>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "code", header: tr("Employee ID"), cell: (p) => p.employeeCode ?? "—" },
    {
      id: "name",
      header: "Full Name",
      cell: (p) => (
        <div className="flex items-start gap-2.5">
          <Avatar name={p.fullName || "User"} src={p.avatar} tone="brand" className="h-8 w-8 shrink-0" />
          <div>
            <span className="font-medium text-slate-900">{p.fullName}</span>
            {!p.personUserId && p.externalOrg ? (
              <div className="text-xs text-slate-500">{p.externalOrg}</div>
            ) : null}
            {p.addedReason ? (
              <div className="max-w-64 whitespace-normal text-xs text-amber-700">
                {trFormat("Added by hand: {reason}", { reason: p.addedReason })}
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "department",
      header: "Department",
      cell: (p) => p.department ?? "—",
    },
    {
      id: "session",
      header: "Session",
      cell: (p) => sessionOf(p.sessionId)?.sessionNo ?? "—",
    },
    {
      id: "participation",
      header: tr("Participation"),
      cell: (p) => (
        <div className="max-w-64 whitespace-normal">
          <div>{PARTICIPATION_ROLE_LABEL[p.participationRole ?? "TRAINEE"]}</div>
          {p.participationReason ? (
            <div className="text-xs text-slate-500">{p.participationReason}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "state",
      header: tr("Attendance"),
      cell: (p) => (
        <div className="max-w-64 whitespace-normal">
          {labelOfState(p)}
          {accountNote(p)}
        </div>
      ),
    },
    {
      id: "result",
      header: "Result",
      cell: (p) => (
        <Badge
          color={
            p.result === "PASSED"
              ? "emerald"
              : p.result === "FAILED"
                ? "red"
                : "slate"
          }
        >
          {p.result === "PASSED" && (p.participationRole ?? "TRAINEE") !== "TRAINEE"
            ? "attended"
            : p.result.toLowerCase()}
          {p.lastPercent != null ? ` (${p.lastPercent}%)` : ""}
        </Badge>
      ),
    },
    {
      id: "attempts",
      header: tr("Re-training"),
      cell: (p) =>
        p.attempts && p.attempts > 1 ? `${p.attempts - 1} time(s)` : "—",
    },
    { id: "actions", header: "Action", cell: (p) => renderActions(p, "all") },
  ];
  const attendanceColumns: DataTableColumn<TrainingParticipant>[] = [
    ...participantColumns.filter((c) =>
      ["rowNo", "code", "name", "department", "session", "participation", "state"].includes(
        c.id,
      ) && !(singleSession && c.id === "session"),
    ),
    { id: "actions", header: "Action", cell: (p) => renderActions(p, "attendance") },
  ];
  const inSession = (p: TrainingParticipant) =>
    !pSession || p.sessionId === pSession;
  // SOP.0003 5.3.4: the list of a self-reading training is the form APD.0108 (training number, reading day, signature).
  const shownSessions = activity.sessions.filter(
    (x) => !pSession || x.id === pSession,
  );
  const selfReading =
    shownSessions.length > 0 &&
    shownSessions.every((x) => x.method === "SELF_READING");
  const columnsShown: DataTableColumn<TrainingParticipant>[] = selfReading
    ? [
        ...participantColumns.filter((c) =>
          ["rowNo", "code", "name", "department"].includes(c.id),
        ),
        {
          id: "trn",
          header: tr("Training number"),
          cell: () => activity.trainingNumber,
        },
        {
          id: "read",
          header: tr("Reading day"),
          cell: (p) => (p.readConfirmedAt ? day(p.readConfirmedAt) : "—"),
        },
        {
          id: "sign",
          header: "Signature",
          cell: (p) =>
            p.state === "READ_CONFIRMED"
              ? p.signMode === "ESIGN"
                ? tr("E-signature")
                : tr("Signed on paper")
              : (
                <>
                  {labelOfState(p)}
                  {accountNote(p)}
                </>
              ),
        },
        ...participantColumns.filter((c) => c.id === "actions"),
      ]
    : participantColumns;
  const groups = [
    { id: "EMPLOYEES", title: "Employees" },
    { id: "ABSENT", title: tr("Absent (stay on the list)") },
    { id: "OUTSIDE", title: tr("Outside persons") },
  ];
  const targetSession =
    activity.sessions.find((x) => x.id === pSession) ?? activity.sessions[0];

  const sessionChips = (
    <SessionPills
      value={pSession}
      onChange={setPSession}
      pills={[
        { id: "", label: `All (${allParticipantStats.total})` },
        ...activity.sessions.map((x) => ({
          id: x.id,
          label: `S${x.sessionNo} ${x.topics[0]?.topicText ?? ""}`.trim() + ` (${activity.participantSummary?.sessions[x.id]?.total ?? 0})`,
        })),
      ]}
    />
  );
  /** The paper pack and the preparation are shown where the organiser works: planning, and before the first session is held. */
  const paperShown = mode === "edit" || mode === "prepare" || (mode === "conduct" && activity.status === "NOTIFIED");
  // Prepare Training (owner decision 2026-11-23): the checklist and the test copies of every session that is planned, in one place; the print of each copy is recorded (who, when, which copy).
  const preparedSessions = activity.sessions.filter((x) => x.status === "PLANNED");
  const paperBlocks = (
    <>
      {mode === "prepare" && (activity.capabilities.startBlockers ?? []).length > 0 && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {`${tr("Before the training can start")}: ${(activity.capabilities.startBlockers ?? []).map(trainingCodeText).join(" ")}`}
        </p>
      )}
      <TrainingPrintedPacks
        activity={activity}
        onChanged={() =>
          void run(() => trainingActivitiesApi.get(activity.id), "Updated")
        }
      />
      {mode === "prepare" && caps?.adjustPlan && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline-emerald" loading={busy} onClick={() => void run(async () => { await trainingPreparationApi.fillIn(activity.id); return trainingActivitiesApi.get(activity.id); }, tr("Preparation filled in from the record"))}>
            {tr("Fill in from the record")}
          </Button>
          <span className="text-xs text-slate-500">{tr("The room, the materials and the notice are ticked when the record already shows them. A line you set yourself is not changed.")}</span>
        </div>
      )}
      {mode === "prepare" ? (
        preparedSessions.map((x) => (
          <div key={x.id} className="space-y-2">
            {preparedSessions.length > 1 && <h3 className="text-sm font-semibold text-slate-900">{`${tr("Session")} ${x.sessionNo}`}</h3>}
            <TrainingPreparationBlock
              activityId={activity.id}
              sessionId={x.id}
              canManage={Boolean(caps?.adjustPlan)}
              paper={{ activity, canPrint: Boolean(caps?.printPaper), onChanged: () => void load() }}
            />
          </div>
        ))
      ) : (
        <TrainingPreparationBlock
          activityId={activity.id}
          canManage={Boolean(caps?.adjustPlan)}
        />
      )}
    </>
  );
  const startBlockers = caps?.startBlockers ?? [];
  const startButton = caps?.startTraining ? (
    <Button
      size="sm"
      variant="default"
      className="whitespace-nowrap"
      loading={busy}
      disabled={startBlockers.length > 0}
      title={startBlockers.map(trainingCodeText).join(" ")}
      onClick={() =>
        signAction(
          tr("Start Training"),
          "TRAINING_SESSION_STARTED",
          "Training Started",
          (t) => trainingActivitiesApi.startTraining(activity.id, activity.version, t),
          statusChange("Notified", "In Progress", "Training activity"),
        )
      }
    >
      {tr("Start Training")}
    </Button>
  ) : null;
  const groupTables = (columns: DataTableColumn<TrainingParticipant>[], renderRow?: (p: TrainingParticipant, index: number) => ReactNode) =>
    groups.map((group) => (
      <TrainingParticipantTable key={group.id} activityId={activity.id} sessionId={workspaceSessionId || pSession || undefined}
        group={group.id} title={group.title} columns={columns} refreshToken={activity} renderRow={renderRow} />
    ));
  /** One person of the attendance step as a line: the status and every action at the right on a desktop, Mark and a menu on a phone. */
  const attendanceRow = (p: TrainingParticipant) => {
    const more = renderActions(p, "attendance", { skipMark: true });
    const hasMore = Children.toArray(more.props.children).length > 0;
    const statusColor = p.plannedAbsence && p.state === "INVITED" ? "amber" : p.state === "ABSENT" ? "red" : p.state === "ATTENDED" || p.state === "ONLINE" ? "emerald" : "slate";
    return (
      <TrainingAttendanceRow
        key={p.id}
        name={p.fullName}
        avatar={p.avatar}
        meta={[p.employeeCode, p.department, !singleSession ? `S${sessionOf(p.sessionId)?.sessionNo ?? ""}` : "", (p.participationRole ?? "TRAINEE") !== "TRAINEE" ? PARTICIPATION_ROLE_LABEL[p.participationRole ?? "TRAINEE"] : ""].filter(Boolean).join(" · ") || "—"}
        notes={
          <>
            {!p.personUserId && p.externalOrg ? <div className="truncate text-xs text-slate-500">{p.externalOrg}</div> : null}
            {p.addedReason ? <div className="text-xs text-amber-700">{trFormat("Added by hand: {reason}", { reason: p.addedReason })}</div> : null}
            {accountNote(p)}
          </>
        }
        status={<Badge color={statusColor} className="max-w-full whitespace-normal">{labelOfState(p)}</Badge>}
        actions={renderActions(p, "attendance")}
        quickAction={canMarkAttendance(p) ? <Button size="sm" variant="outline-emerald" aria-label={`Mark Attendance of ${p.fullName}`} onClick={() => setDialog({ type: "attendance", participant: p })}>{tr("Mark")}</Button> : undefined}
        moreActions={hasMore ? more : undefined}
      />
    );
  };
  const signAction = (
    title: string,
    meaningCode: string,
    meaningName: string,
    runWith: (token: string, reason?: string) => Promise<TrainingActivityDetail>,
    changes?: ReturnType<typeof statusChange>,
  ) => setSign({ title, meaningCode, meaningName, changes, run: runWith });

  const external = activity.kind === "EXTERNAL";

  const sessionSources: CopySource[] = activity.sessions.filter((x) => x.status !== "CANCELLED").map((x) => ({
    key: x.id,
    no: x.sessionNo,
    label: `${tr("Session")} ${x.sessionNo} · ${x.topics[0]?.topicText ?? ""}`,
    form: sessionFormFrom(x),
    people: activity.participantSummary?.sessions[x.id]?.total ?? 0,
  }));
  /** The session as a card shows it (the same card as on the New screen). */
  const sessionCards: SessionCardData[] = activity.sessions.map((s) => {
    const hybrid = s.locationType === "HYBRID";
    const online = s.locationType === "ONLINE" || hybrid;
    const rules = activity.contentRules;
    const content = !external && rules ? s.content : undefined;
    const word = s.assessmentMethod === "CHECKLIST" ? tr("Checklist") : tr("Test");
    return {
      key: s.id,
      no: s.sessionNo,
      topics: s.topics.map((t) => t.topicText),
      mode: !external && s.method ? (METHOD_LABEL[s.method] ?? s.method) : null,
      modeCode: s.method,
      assessmentCode: s.assessmentMethod,
      deliveryCode: s.deliveryMode ?? "ELECTRONIC",
      assessment: !external && s.assessmentMethod ? (ASSESSMENT_LABEL[s.assessmentMethod] ?? s.assessmentMethod) : null,
      trainer: trainerOf(s) === "—" ? null : trainerOf(s),
      date: s.scheduledOn ? day(s.scheduledOn) : null,
      place: !online || hybrid ? s.venue : null,
      online: online ? [s.onlinePlatform, s.meetingLink].filter(Boolean).join(" · ") || null : null,
      delivery: paperShown ? null : DELIVERY_LABEL[s.deliveryMode ?? "ELECTRONIC"],
      heldOn: s.heldOn ? day(s.heldOn) : null,
      status: s.status === "POSTPONED" ? { label: tr("Postponed"), color: "amber" as const } : s.status === "CANCELLED" ? { label: tr("Cancelled"), color: "red" as const } : null,
      afterDue: s.scheduledAfterDue,
      people: activity.participantSummary?.sessions[s.id]?.total ?? null,
      content: content
        ? {
            materials: content.materials ?? 0,
            materialsNeeded: Boolean(content.materialsRequired),
            materialsOk: Boolean(content.materialsSatisfied),
            assessmentNeeded: Boolean(content.testRequired || content.checklistRequired),
            assessmentOk: Boolean(content.assessmentFormSatisfied),
            assessmentLabel: s.assessment?.name ?? null,
            assessmentWord: word,
          }
        : null,
      note: external ? null : renderTrainerCheck(s),
      actions: renderSessionActions(s),
    };
  });


  // The bar of the tabs Training Materials and Assessment: the same pills, with a mark on a session that still lacks something.
  const contentPills: SessionPill[] = [
    { id: "", label: `All (${activity.sessions.filter((x) => x.status !== "CANCELLED").length})` },
    ...activity.sessions.filter((x) => x.status !== "CANCELLED").map((x) => {
      const missing = (x.content?.missing ?? []).length > 0;
      return { id: x.id, label: `S${x.sessionNo} ${x.topics[0]?.topicText ?? ""}`.trim(), mark: external || !activity.contentRules ? undefined : missing ? ("warn" as const) : ("ok" as const) };
    }),
  ];
  const activeSessions = activity.sessions.filter((x) => x.status !== "CANCELLED");
  // One session: its tabs need no bar and look at that session; several: the bar chooses (All, or one).
  const scopedSession = contentSession ? activeSessions.find((x) => x.id === contentSession) : activeSessions.length === 1 ? activeSessions[0] : undefined;


  const open = !["COMPLETED", "CANCELLED"].includes(activity.status);
  const qa = activity.qaList;
  const results = activity.resultsToQa;
  // The retraining of the people who were absent or failed is offered until it is arranged, also after the activity is Completed: a failed person does not stop the completion.
  // The button "Supplementary Training" sits in the header, beside Back; the notice keeps only the people who cannot be put on one now.
  const supplementaryNotice =
    !activity.parentActivityId && (activity.supplementaryBlocked ?? 0) > 0 && ["COMPLETED"].includes(activity.status) ? (
      <WarningBanner
        className="mb-3"
        description={trFormat("{count} person(s) cannot be put on a supplementary training now because their account is not Active (left or suspended); they stay Absent on the list.", { count: activity.supplementaryBlocked ?? 0 })}
      />
    ) : null;
  const supplementaryButton =
    caps?.addSupplementary && (activity.supplementaryPending ?? 0) > 0 ? (
      <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "supplementary" })}>{tr("Supplementary Training")}</Button>
    ) : null;
  // Two notices that guide the manual part of the procedure: the day the list goes to QA (SOP.0003 5.3.6) and the approved vendor list for an outside trainer (SOP.0025).
  // Send Notifications To Training Participants: how many are told, and a button to try again for the ones who were not reached
  const inv = activity.invitations;
  const invitationsNotice = inv && (activity.status === "NOTIFIED" || inv.failed > 0 || inv.waiting > 0) ? (
    <div role="status" className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${inv.failed > 0 ? "border-red-200 bg-red-50 text-red-800" : inv.waiting > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      <span>
        {trFormat("Invitations: {sent} of {total} e-mails sent", { sent: String(inv.sent), total: String(inv.total) })}
        {inv.waiting > 0 ? trFormat(", {n} waiting", { n: String(inv.waiting) }) : ""}
        {inv.failed > 0 ? trFormat(", {n} failed", { n: String(inv.failed) }) : ""}
        {inv.notSent > 0 ? trFormat(", {n} not sent (no e-mail address or the notice is switched off)", { n: String(inv.notSent) }) : ""}
      </span>
      {caps?.resendNotifications && (
        <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} onClick={() => void run(() => trainingActivitiesApi.resendNotifications(activity.id), tr("Invitations are being sent again"))}>
          {tr("Send again to those not reached")}
        </Button>
      )}
    </div>
  ) : null;
  const notices = (
    <>
    {invitationsNotice}
    {open ? (
    <div className="mb-4 space-y-2 empty:hidden">
      {qa && ["DUE", "DUE_TODAY", "OVERDUE", "WAITING"].includes(qa.state) && (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${qa.state === "OVERDUE" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
        >
          {qa.state === "WAITING" &&
            "This training is on a new or revised document. On the day it is held, send the attendance list to QA (SOP.0003 5.3.6)."}
          {qa.state === "DUE" &&
            `Send the attendance list to QA on ${day(qa.dueOn)}, the day of the training (SOP.0003 5.3.6).`}
          {qa.state === "DUE_TODAY" &&
            "Today is the day of the training: send the attendance list to QA today (SOP.0003 5.3.6)."}
          {qa.state === "OVERDUE" &&
            `The attendance list was due to QA on ${day(qa.dueOn)} and has not been sent. Send it now; the delay is recorded.`}
        </p>
      )}
      {external && activity.vendorWarning && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {activity.vendorWarning === "VENDOR_NOT_NAMED" && "Name the training unit: it must be on the register of approved training vendors (SOP.0025)."}
          {activity.vendorWarning === "VENDOR_NOT_APPROVED" && `The training unit "${activity.trainingUnitName ?? ""}" is not on the register of approved training vendors (SOP.0025). Approve it in Training Administration, Training Vendors, or check the name. The training is not blocked.`}
          {activity.vendorWarning === "VENDOR_APPROVAL_ENDED" && `The approval of the training unit "${activity.trainingUnitName ?? ""}" has ended (SOP.0025). Renew it in Training Administration, Training Vendors. The training is not blocked.`}
        </p>
      )}
    </div>
    ) : null}
    {supplementaryNotice}
    </>
  );
  // What the training is about: the topics of its sessions, or its document (SOP.0003 5.3.5). It has no title of its own.
  const activityTopics = activity.trainingTopics ?? activity.topics ?? "";
  const form = draft ?? {
    dueDate: activity.dueDate?.slice(0, 10) ?? "",
    remarks: activity.remarks ?? "",
    trainingUnitName: activity.trainingUnitName ?? "",
    vendorRef: activity.vendorRef ?? "",
  };
  const dueDateField = caps?.edit ? (
    <TrainingDateField label={tr("Due Date")} hint={DATE_HINT.due} value={form.dueDate} onChange={(v) => setDraft({ ...form, dueDate: v })} />
  ) : (
    <ReadonlyField label={tr("Due Date")} value={day(activity.dueDate)} hint={DATE_HINT.due} />
  );
  const formDirty =
    !!draft &&
    (draft.dueDate !== (activity.dueDate?.slice(0, 10) ?? "") ||
      draft.remarks !== (activity.remarks ?? "") ||
      draft.trainingUnitName !== (activity.trainingUnitName ?? "") ||
      draft.vendorRef !== (activity.vendorRef ?? ""));
  const blockers = caps?.notifyBlockers ?? [];
  const stepsToDo = [
    {
      done: activity.sessions.length > 0,
      text: external
        ? tr("Add the session: topic, date and place (General Information)")
        : tr("Add the session: topic, method, trainer and date (General Information)"),
      tab: "overview",
    },
    {
      done: allParticipantStats.total > 0,
      text: "Add the participants of each session (tab Participants)",
      tab: "participants",
    },
    {
      done: stepDone("ATTENDEE_LIST_PREPARED"),
      text: "Confirm the attendee list (button below)",
      tab: "participants",
    },
    ...(external
      ? []
      : [
          // What is asked depends on the case (PLAN-TR-002): only what the activity needs is listed.
          ...(activity.contentRules?.materialsRequired
            ? [{
                done: activity.contentRules.materialsSatisfied,
                text: activity.contentRules.materialsSource === "DOCUMENT"
                  ? tr("The approved document is the training material (add slides or other material in the tab Training Materials if you want)")
                  : tr("Add the training material: a file or a link (tab Training Materials)"),
                tab: "materials",
              }]
            : []),
          ...(activity.contentRules?.testRequired || activity.contentRules?.checklistRequired
            ? [{
                done: activity.contentRules.assessmentFormSatisfied,
                text: activity.contentRules.checklistRequired && !activity.contentRules.testRequired
                  ? tr("Choose an approved checklist of the library (tab Assessment)")
                  : tr("Choose an approved test of the library (tab Assessment)"),
                tab: "assessment",
              }]
            : []),
          {
            done: !!activity.approverPlan,
            text: "Select the two approvers and save (button below)",
            tab: "signatures",
          },
          {
            done: activity.status !== "PLANNED",
            text: "Submit the content for approval (button below)",
            tab: "signatures",
          },
          {
            done: stepDone("CONTENT_APPROVED"),
            text: "The first and the second approver sign the approval",
            tab: "signatures",
          },
        ]),
    {
      done: !["PLANNED", "PENDING_APPROVAL"].includes(activity.status),
      text: "Notify the participants (button below)",
      tab: "overview",
    },
  ];
  const nextSteps =
    ["PLANNED", "NOTIFIED"].includes(activity.status) && caps?.planSessions ? (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">
          {tr("To prepare this training")}
        </h3>
        <ol className="space-y-1.5 text-sm">
          {stepsToDo.map((x, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${x.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}
              >
                {x.done ? "✓" : i + 1}
              </span>
              <button
                type="button"
                className={`text-left ${x.done ? "text-slate-500 line-through" : "text-slate-800 hover:text-emerald-700 hover:underline"}`}
                onClick={() => setTab(x.tab)}
              >
                {x.text}
              </button>
            </li>
          ))}
        </ol>
        {activity.status === "PLANNED" && (caps?.submitBlockers ?? []).length > 0 && (
          <WarningBanner className="mt-3" description={tr("Cannot be submitted for approval yet:")}>
            <ul className="list-disc pl-4">
              {(caps?.submitBlockers ?? []).map((b) => (
                <li key={b}>{trainingCodeText(b)}</li>
              ))}
            </ul>
          </WarningBanner>
        )}
        {activity.listPreparedBy && blockers.length > 0 && (
          <WarningBanner className="mt-3" description={tr("Participants cannot be notified yet:")}>
            <ul className="list-disc pl-4">
              {blockers.map((b) => (
                <li key={b}>{trainingCodeText(b)}</li>
              ))}
            </ul>
          </WarningBanner>
        )}
      </div>
    ) : null;

  // APD.0108: the head of a department confirms the people of that department only; the button is for the departments of which the person is the head and that have people waiting.
  const myWaitingDepartments = (activity.selfReadingDepartments ?? []).filter((d) => d.mine && d.waiting > 0 && d.invited === 0);

  // The signatures that matter, in the order of the flow: the person on the left, the time on the right. A step that does not apply to this training is not shown (a document, a content to review,
  // a self-reading); the others show "-" until they are done, so the person sees how far the flow has come. Preparatory and routine steps (the list prepared, the notice sent) stay in the Audit Trail.
  const confirmed = (kind: string) => activity.confirmations.find((x) => x.kind === kind);
  // Every session that is not cancelled is a self-reading: no attendance list APD.0117 and no check-in (SOP.0003: its list is APD.0108)
  const liveSessions = activity.sessions.filter((x) => x.status !== "CANCELLED");
  const readingOnly = liveSessions.length > 0 && liveSessions.every((x) => x.method === "SELF_READING");
  // the person of an approval: the one who signed; else the one waiting to sign; else the one the organizer selected (not submitted yet)
  const approverCell = (step: TrainingApprovalStep, plannedName?: string | null) => {
    const waiting = stepAssignment(step);
    if (waiting) return trFormat("{name} (waiting for the approval)", { name: waiting.assigneeName ?? "" });
    return plannedName ? trFormat("{name} (selected)", { name: plannedName }) : null;
  };
  const signatureSteps: { key: string; label: string; by?: string | null; on?: string | null }[] = [
    { key: "created", label: tr("Created"), by: activity.createdByName, on: when(activity.createdAt) },
    ...(activity.documentNumber ? [{ key: "docApproved", label: tr("Document Approved"), by: activity.documentApprovedByName, on: activity.documentApprovedAt ?? day(activity.approvedOn) }] : []),
    ...(external ? [] : [
      {
        key: "approvedFirst",
        label: tr("First Approval"),
        by: confirmed("CONTENT_APPROVED_FIRST")?.confirmedByName ?? approverCell("CONTENT_APPROVE_FIRST", activity.approverPlan?.firstName),
        on: when(confirmed("CONTENT_APPROVED_FIRST")?.confirmedAt),
      },
      {
        key: "approved",
        label: tr("Second Approval"),
        by: confirmed("CONTENT_APPROVED")?.confirmedByName ?? approverCell("CONTENT_APPROVE", activity.approverPlan?.secondName),
        on: when(confirmed("CONTENT_APPROVED")?.confirmedAt),
      },
    ]),
    ...activity.confirmations
      .filter((c) => c.kind === "HEAD_SELF_READING")
      .map((c) => ({ key: `read-${c.id}`, label: `Self-reading Verified${c.departmentName ? ` (${c.departmentName})` : ""}`, by: c.confirmedByName, on: when(c.confirmedAt) })),
    ...(hasSelfReading && !activity.confirmations.some((c) => c.kind === "HEAD_SELF_READING") ? [{ key: "read", label: tr("Self-reading Verified"), by: null, on: null }] : []),
    ...(readingOnly ? [] : [{ key: "sent", label: tr("Attendance List Sent to QA"), by: activity.attendanceSentByName, on: activity.attendanceSentAt }]),
    { key: "finished", label: tr("Training Finished and Results Sent to QA"), by: activity.resultsFinishedByName, on: activity.resultsFinishedAt },
    { key: "completion", label: tr("Completion Confirmed by QA"), by: confirmed("QA_COMPLETION")?.confirmedByName, on: when(confirmed("QA_COMPLETION")?.confirmedAt) },
  ];

  // ---- the workspace of one session
  const wsSession = workspace
    ? activity.sessions.find((x) => x.id === workspaceSessionId)
    : undefined;
  const wsPeople = workspace ? activity.sessionParticipants ?? [] : [];
  const wsStatsData = activity.participantSummary?.sessions[workspaceSessionId ?? ""] ?? EMPTY_PARTICIPANT_STATS;
  const wsHeld = !!wsSession && sessionStarted(wsSession);
  const wsPending = wsStatsData.attendancePending;
  const wsEligible = wsStatsData.eligible;
  const wsUnscored = wsStatsData.unscored;
  const wsPresent = wsStatsData.present;
  const wsAbsent = wsStatsData.absent;
  const wsPassed = wsStatsData.passed;
  const wsFailed = wsStatsData.failed;
  const wsScoped: TrainingActivityDetail = {
    ...activity,
    sessions: wsSession ? [wsSession] : [],
    participants: wsPeople,
  };
  const ASSESSMENT_SHORT: Record<string, string> = {
    TEST: "Test",
    CHECKLIST: "Checklist",
    OBSERVATION: "Observation",
    SELF_READING_CONFIRMATION: "Self-reading",
  };
  const wsAttendanceDone = wsHeld && wsPending === 0 && wsStatsData.total > 0;
  const allWsSteps: WorkspaceStep[] = [
    {
      id: "ws-prepare",
      label: "Prepare",
      subtitle: wsHeld ? `Started ${day(wsSession?.heldOn)}` : tr("Not started"),
      description:
        tr("Tick what is ready: the room, the equipment, the materials, the notice, the test and the paper. The training starts with the first attendance."),
      done: wsHeld,
      icon: IconClipboardCheck,
    },
    {
      id: "ws-attendance",
      label: tr("Attendance"),
      subtitle: `${wsPresent} of ${wsStatsData.total} present`,
      description:
        tr("Record who came: with the code or the QR, with the quick roll-call, or one by one; an absence needs its reason. When everyone is recorded, the trainer sends the attendance list to QA with an electronic signature. A mistake is corrected with a reason."),
      done: wsAttendanceDone,
      icon: IconUserCheck,
    },
    {
      id: "ws-training",
      label: "Training",
      subtitle: tr("Approved content"),
      description:
        tr("Teach with the approved content only. Nothing is typed here: the session is held and the attendance recorded."),
      done: wsAttendanceDone,
      icon: IconPresentation,
    },
    {
      id: "ws-assessment",
      label: "Assessment",
      subtitle: wsSession?.assessmentMethod
        ? (ASSESSMENT_SHORT[wsSession.assessmentMethod] ?? "—")
        : "—",
      description:
        tr("Give the test or the checklist. A paper test is printed here and typed in with its scan; a checked file is uploaded as evidence."),
      done: wsEligible > 0 && wsUnscored === 0,
      icon: IconChecklist,
    },
    {
      id: "ws-results",
      label: "Results",
      subtitle: `${wsPassed} passed · ${wsFailed} not passed`,
      description:
        tr("Type the score of each person in the row (the maximum score once, above the table) and save. When every result is in, the trainer finishes the training with a signature: the results are written in the list APD.0117. Then the trainer sends the results to QA."),
      done: !!activity.resultsFinishedAt,
      icon: IconTrophy,
    },
  ];
  // A self-reading has no attendance, no teaching and no assessment: the person signs the reading in the system and the head of the department confirms it (owner decision 2026-10-31)
  const wsReading = wsSession?.method === "SELF_READING";
  const wsSteps: WorkspaceStep[] = wsReading
    ? allWsSteps
        .filter((x) => x.id === "ws-prepare" || x.id === "ws-attendance" || x.id === "ws-results")
        .map((x) =>
          x.id === "ws-attendance"
            ? {
                ...x,
                label: "Reading",
                subtitle: `${wsPresent} of ${wsStatsData.total} read`,
                description:
                  tr("Every invited person reads the document and signs in the system (My Training). A person who has not signed is reminded before the due date (Training Properties), and you can remind one person with Send Reminder. The head of each department then confirms the people of the department."),
                done: wsPending === 0 && wsStatsData.total > 0,
              }
            : x.id === "ws-results"
              ? {
                  ...x,
                  subtitle: `${wsPassed} confirmed by the head`,
                  description:
                    tr("The result of each person comes from the confirmation of the head of the department. When nobody is waiting, the trainer finishes the training with a signature: QA is told and the self-reading lists APD.0108 go with the message."),
                }
              : x,
        )
    : allWsSteps;
  // What still stops the attendance list from going to QA (the same two rules as the server): a session still to be held, a person not recorded yet.
  const attendanceBlockers = [
    [activity.sessions.filter((x) => x.status === "POSTPONED" || sessionNotStarted(x)).length, "session(s) still to be held"],
    [allParticipantStats.pending, "person(s) still to be marked present or absent"],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, text]) => `${n} ${text}`);
  const sendAttendanceList = () =>
    signAction(
      "Send attendance list to QA",
      "TRAINING_ATTENDANCE_SENT",
      "Attendance List Sent to QA",
      (t) => trainingActivitiesApi.sendAttendanceList(activity.id, activity.version, t),
      statusChange("Not sent", "Sent to QA", "Attendance list"),
    );
  // The head signs for the departments of which they are the head and that are ready (every person signed or was recorded as not having read)
  const verifySelfReading = () =>
    signAction(
      "Verify self-reading",
      "TRAINING_READ_VERIFIED",
      "Self-reading Verified",
      (t, reason) => trainingActivitiesApi.verifySelfReading(activity.id, t, reason),
      statusChange("Read and understood", "Verified", `Self-reading of ${myWaitingDepartments.map((d) => d.departmentName).join(", ")}`),
    );
  if (workspace && !stepSettled && wsSession) {
    setStepSettled(true);
    setTab((wsSteps.find((x) => !x.done) ?? wsSteps[wsSteps.length - 1]).id);
  }
  const wsFactList = wsSession
    ? [
        {
          icon: IconCalendar,
          label: "Scheduled",
          value: day(wsSession.scheduledOn),
        },
        {
          icon: IconCalendar,
          label: tr("Conducted on"),
          value: wsSession.heldOn ? day(wsSession.heldOn) : "Not yet",
        },
        { icon: IconUser, label: "Trainer", value: trainerOf(wsSession) },
        ...(results && results.dueOn ? [{ icon: IconCalendar, label: tr("Results due to QA"), value: day(results.dueOn) }] : []),
        {
          icon: IconMapPin,
          label: "Venue",
          value:
            wsSession.locationType === "HYBRID"
              ? `${wsSession.venue ?? ""} + ${wsSession.onlinePlatform ?? "Online"}`
              : wsSession.locationType === "ONLINE"
                ? `${wsSession.onlinePlatform ?? "Online"}`
                : (wsSession.venue ?? ""),
        },
        {
          icon: IconPresentation,
          label: "Mode",
          value: wsSession.method
            ? (METHOD_LABEL[wsSession.method] ?? wsSession.method)
            : "",
        },
        {
          icon: IconBook2,
          label: "Delivery",
          value: DELIVERY_LABEL[wsSession.deliveryMode ?? "ELECTRONIC"],
        },
        {
          icon: IconChecklist,
          label: "Assessment",
          value: wsSession.assessmentMethod
            ? (ASSESSMENT_SHORT[wsSession.assessmentMethod] ??
              wsSession.assessmentMethod)
            : "",
        },
      ]
    : [];
  const wsStats: WorkspaceStat[] = [
    { label: tr("on the list"), value: wsStatsData.total, icon: IconUsers, tone: "slate" },
    { label: wsReading ? tr("not signed yet") : "absent", value: wsReading ? wsPending : wsAbsent, icon: IconUserX, tone: "amber" },
  ];
  const wsRates: WorkspaceRate[] = [
    {
      label: wsReading ? "Read" : tr("Attendance"),
      percent: wsStatsData.total
        ? Math.round((wsPresent / wsStatsData.total) * 100)
        : null,
      detail: `${wsPresent} of ${wsStatsData.total} ${wsReading ? "read" : "present"}`,
      tone: "emerald",
    },
    {
      label: wsReading ? tr("Confirmed by the head") : "Pass rate",
      percent: wsPresent ? Math.round((wsPassed / wsPresent) * 100) : null,
      detail: `${wsPassed} of ${wsPresent} ${wsReading ? "confirmed" : "passed"}`,
      tone: "blue",
    },
  ];
  const refreshActivity = () => void run(() => trainingActivitiesApi.get(activity.id), "Updated");
  const wsContent = !workspace ? null : !wsSession ? (
    <p role="alert" className="text-sm text-red-700">
      {tr("This session was not found in the training activity.")}
    </p>
  ) : (
    <>
      {tab === "ws-prepare" && (
        <WorkspacePrepareStep
          activityId={activity.id}
          scoped={wsScoped}
          session={wsSession}
          caps={caps}
          onPostpone={() => setDialog({ type: "postpone", session: wsSession })}
          onChanged={refreshActivity}
          onPending={setPrepPending}
        />
      )}
      {tab === "ws-attendance" && (
        <WorkspaceAttendanceStep scoped={wsScoped} caps={caps} reading={wsReading} onActivity={() => void load()} table={groupTables(attendanceColumns, attendanceRow)} />
      )}
      {tab === "ws-training" && (
        <WorkspaceTrainingStep activityId={activity.id} mode={mode} external={external} participants={activity.participants} />
      )}
      {tab === "ws-assessment" && (
        <WorkspaceAssessmentStep
          activityId={activity.id}
          scoped={wsScoped}
          people={wsPeople}
          caps={caps}
          mode={mode}
          external={external}
          userId={user?.id}
          onChanged={refreshActivity}
        />
      )}
      {tab === "ws-results" && wsReading && (
        <WorkspaceReadingResultsStep
          departments={activity.selfReadingDepartments ?? []}
          canFinish={Boolean(caps?.finishTraining)}
          finished={!!activity.resultsFinishedAt}
          onConfirm={verifySelfReading}
          formatTime={(value) => when(value)}
        />
      )}
      {tab === "ws-results" && !wsReading && (
        <WorkspaceResultsStep
          table={
            <WorkspaceResultsTable
              activityId={activity.id}
              people={wsPeople}
              passPercent={activity.passPercent}
              defaultMax={activity.assessment?.maxScore ?? undefined}
              locked={!!activity.resultsFinishedAt}
              canRecord={Boolean(caps?.recordAssessment)}
              canRelease={Boolean(caps?.recordAttendance)}
              onRelease={(participant) => setDialog({ type: "releaseExam", participant })}
              assessmentMethod={wsSession.assessmentMethod}
              onActivity={() => void load()}
            />
          }
          absent={wsStatsData.actualAbsent}
          failed={wsFailed}
        />
      )}
    </>
  );

  // The end of the training, in the Session Workspace only: Finish Training is shown by the server once the list is sent, every result is in and every scan is uploaded. One electronic signature finishes the
  // training and sends the results to QA, who is told; there is no other step to send them.
  const endButtons = (
    <>
      {caps?.finishTraining && (
        <Button
          size="sm"
          loading={busy}
          className="whitespace-nowrap"
          onClick={() =>
            signAction(
              "Finish the training and send the results to QA",
              "TRAINING_RESULTS_FINISHED",
              "Training Finished and Results Sent to QA",
              (t) => trainingActivitiesApi.finishTraining(activity.id, activity.version, t),
              statusChange("In Progress", "Pending QA Confirmation", "Training activity"),
            )
          }
        >
          {tr("Finish Training")}
        </Button>
      )}
    </>
  );

  // The revisions of the documents that go with this Training Number and wait for "Complete Training" in Document Control (one button for each).
  const waitingRevisions = (activity.groupRevisions ?? []).filter((r) => r.revisionStatus === "PENDING_TRAINING");
  const cancelButton = caps?.cancel ? (
    <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "cancel" })}>
      {tr("Cancel")}
    </Button>
  ) : null;
  // The content is approved by two people in turn (SOP.0003 5.3.5; DEC-TRAINING-2026-11-23-10). While the activity is Planned the organizer presses Select Approver (the two heads, who approves first) and Save,
  // then Submit for Approval (electronic signature): the activity becomes Pending Approval and the first approver is told. Each approver signs or rejects in the screen of the approval.
  const pendingApproval = activity.status === "PENDING_APPROVAL";
  const selectApproverButton = !external && activity.status === "PLANNED" && caps?.designateApprovers ? (
    <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "approver" })}>
      {tr("Select Approver")}
    </Button>
  ) : null;
  const submitButton = caps?.submitForApproval ? (
    <Button
      size="sm"
      variant="default"
      className="whitespace-nowrap"
      onClick={() =>
        signAction(
          tr("Submit the training content for approval"),
          "TRAINING_CONTENT_SUBMITTED",
          "Training Content Submitted for Approval",
          (t) => trainingActivitiesApi.submitForApproval(activity.id, activity.version, t),
          statusChange("Planned", "Pending Approval", "Training content"),
        )
      }
    >
      {tr("Submit for Approval")}
    </Button>
  ) : null;
  const myApprovalStep: "CONTENT_APPROVE_FIRST" | "CONTENT_APPROVE" | null =
    !external && pendingApproval
      ? iAmAssigned("CONTENT_APPROVE_FIRST") ? "CONTENT_APPROVE_FIRST" : iAmAssigned("CONTENT_APPROVE") ? "CONTENT_APPROVE" : null
      : null;
  const approveButton = myApprovalStep && mode === "approve" ? (
    <Button
      size="sm"
      variant="outline-emerald"
      className="whitespace-nowrap"
      onClick={() =>
        signAction(
          tr("Complete approval of the training content"),
          "TRAINING_CONTENT_APPROVED",
          "Training Content Approved",
          (t) => trainingActivitiesApi.confirmContent(activity.id, myApprovalStep, t),
          statusChange("Pending Approval", myApprovalStep === "CONTENT_APPROVE" ? "Approved" : tr("Approved by the first approver"), "Training content"),
        )
      }
    >
      {tr("Complete Approval")}
    </Button>
  ) : null;
  const rejectButton = myApprovalStep && mode === "approve" ? (
    <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "rejectContent" })}>
      {tr("Reject")}
    </Button>
  ) : null;
  const footer = (
    <>
      {caps?.completeTraining && waitingRevisions.map((r) => (
        <Button
          key={r.revisionId}
          size="sm"
          className="whitespace-nowrap"
          onClick={() => navigate(`/documents/revisions/training/${r.revisionId}`)}
        >
          {waitingRevisions.length > 1 ? `Complete Training (${r.documentNumber})` : tr("Complete Training (Revision)")}
        </Button>
      ))}
      {cancelButton}
      {mode === "conduct" &&
        activity.status === "IN_PROGRESS" &&
        activity.sessions
          .filter((x) => x.status !== "CANCELLED")
          .map((x, _i, all) => (
            <Button
              key={x.id}
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap"
              onClick={() => openWorkspace(x.id)}
            >
              {all.length > 1
                ? `Open Workspace: session ${x.sessionNo}`
                : tr("Open Workspace")}
            </Button>
          ))}
      {(caps?.edit || caps?.editRemarks) && formDirty && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          loading={busy}
          disabled={(external && !form.trainingUnitName.trim()) || !form.remarks.trim()}
          onClick={() =>
            void run(
              () =>
                trainingActivitiesApi.update(activity.id, {
                  version: activity.version,
                  dueDate: form.dueDate || null,
                  remarks: form.remarks.trim() || null,
                  trainingUnitName: external
                    ? form.trainingUnitName.trim()
                    : undefined,
                  vendorRef: external ? form.vendorRef.trim() : undefined,
                }),
              "Changes saved",
            ).then((ok) => {
              if (ok) setDraft(undefined);
            })
          }
        >
          {tr("Save changes")}
        </Button>
      )}
      {caps?.reopenContent && (
        <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "reopenContent" })}>
          {tr("Edit Content")}
        </Button>
      )}
      {caps?.returnForCorrection && (
        <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "returnForCorrection" })}>
          {tr("Return for Correction")}
        </Button>
      )}
      {caps?.confirmList && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() =>
            signAction(
              "Confirm Attendee List",
              "TRAINING_LIST_VERIFIED",
              "Attendance List Verified",
              (t) => trainingActivitiesApi.confirmList(activity.id, t),
              statusChange("Not confirmed", "Confirmed", "Attendee list"),
            )
          }
        >
          {tr("Confirm Attendee List")}
        </Button>
      )}
      {selectApproverButton}
      {submitButton}
      {rejectButton}
      {approveButton}
      {startButton}
      {caps?.notify && activity.listPreparedBy && (
        <Button
          size="sm"
          variant="default"
          className="whitespace-nowrap"
          loading={busy}
          disabled={blockers.length > 0}
          title={blockers.map(trainingCodeText).join(" ")}
          onClick={() =>
            signAction(
              tr("Send Notifications To Training Participants"),
              "TRAINING_ACTIVITY_NOTIFIED",
              "Training Notified",
              (t) => trainingActivitiesApi.notify(activity.id, activity.version, t),
              statusChange("Planned", "Notified", "Training activity"),
            )
          }
        >
          {tr("Send Notifications To Training Participants")}
        </Button>
      )}
      {hasSelfReading && myWaitingDepartments.length > 0 && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
            onClick={verifySelfReading}
          >
            {tr("Verify self-reading")}
          </Button>
        )}
      {hasSelfReading && myWaitingDepartments.some((d) => d.substitute) && (
              <p className="text-xs text-slate-500">{myWaitingDepartments.filter((d) => d.substitute).map((d) => d.departmentName).join(", ")}{tr(": no Department Head is set in the master data. You confirm in place of the head, and the record says so.")}</p>
      )}
      {caps?.confirmCompletion && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() =>
            signAction(
              "Confirm Completion",
              "TRAINING_COMPLETED",
              "Training Completed",
              (t) =>
                trainingActivitiesApi.confirmCompletion(
                  activity.id,
                  activity.version,
                  t,
                ),
              statusChange("Pending QA Confirmation", "Completed"),
            )
          }
        >
          {tr("Confirm Completion")}
        </Button>
      )}
      {supplementaryButton}
    </>
  );
  return (
    <>
      {workspace ? (
        <TrainingSessionWorkspaceShell
          breadcrumbItems={[
            ...trainingBreadcrumbs(navigate, "activities", MODE_TITLE.conduct).slice(0, -1),
            { label: MODE_TITLE.conduct, onClick: () => navigate(`/training-management/activities/${activity.id}/conduct`) },
            { label: title, isActive: true },
          ]}
          onBack={() =>
            navigate(`/training-management/activities/${activity.id}/conduct`)
          }
          trainingNumber={activity.trainingNumber}
          heading={
            wsSession
              ? `S${wsSession.sessionNo}: ${wsSession.topics.map((tp) => tp.topicText).join("; ") || activityTopics}`
              : activityTopics
          }
          badges={
            wsSession
              ? [
                  ...(wsSession.status === "POSTPONED" || wsSession.status === "CANCELLED"
                    ? [{ label: `Session ${wsSession.status.toLowerCase()}`, color: "slate" as const }]
                    : []),
                  {
                    label: STATUS_LABEL[activity.status] ?? activity.status,
                    color: "blue",
                  },
                  {
                    label:
                      DELIVERY_LABEL[wsSession.deliveryMode ?? "ELECTRONIC"],
                    color: "amber",
                  },
                ]
              : []
          }
          facts={wsFactList}
          stats={wsStats}
          rates={wsRates}
          steps={wsSteps}
          current={tab}
          onStep={(id) => {
            if (tab === "ws-prepare" && WORKSPACE_STEPS.indexOf(id) > 0) {
              if (prepPending > 0) return;
              // The training of the session starts here: signed for the first session of a notified activity, at once for a later session.
              if (wsSession && sessionNotStarted(wsSession) && caps?.hold) {
                // the activity was started by Start Training (signed); a session of an activity in progress starts here, with no signature
                void run(async () => { const started = await trainingActivitiesApi.holdSession(wsSession.id); setTab(id); return started; }, "Training started");
                return;
              }
            }
            setTab(id);
          }}
          headerActions={(
            <>
              {!readingOnly && <AttendanceListExport activityId={activity.id} trainingNumber={activity.trainingNumber} />}
              {/* APD.0108 is the record of the self-reading signed in the system (no paper print, no copy number): one list for each department of the session, each saved as its own file named by the department */}
              {wsSession?.method === "SELF_READING" && sessionStarted(wsSession) && (
                <FormDownloadButtons
                  label={tr("The self-reading list")}
                  buttonText="Self-reading List"
                  parts={((activity.selfReadingDepartments ?? []).length > 1 ? activity.selfReadingDepartments ?? [] : [undefined]).map((d) => ({
                    key: d?.departmentId || d?.departmentName || "",
                    load: (format) => trainingFormsApi.selfReading(wsSession.id, format, d?.departmentId || undefined, d?.departmentId ? undefined : d?.departmentName),
                    fileName: (format) => `${activity.trainingNumber.replace(/\//g, "-")}-S${wsSession.sessionNo}-APD.0108${d ? `-${fileSafe(d.departmentName)}` : ""}.${format}`,
                  }))}
                />
              )}
              {caps?.sendAttendanceList && attendanceBlockers.length === 0 && (
                <Button
                  size="sm"
                  loading={busy}
                  onClick={sendAttendanceList}
                >
                  {tr("Send Attendance List to QA")}
                </Button>
              )}
              {endButtons}
            </>
          )}
          nextBlocked={tab === "ws-prepare" && prepPending > 0 ? `Tick all ${prepPending === 1 ? tr("the last line") : `${prepPending} lines`} first.` : undefined}
        >
          {notices}
          {wsContent}
        </TrainingSessionWorkspaceShell>
      ) : (
        <TrainingDetailLayout
          title={title}
          breadcrumbItems={trainingBreadcrumbs(navigate, "activities", title)}
          onBack={goBack}
          workflow={activity.workflow}
          tabs={tabs}
          activeTab={tab}
          onTab={setTab}
          tabLayoutId="training-activity-detail-tab"
          footer={footer}
          afterFooter={showResults ? <TrainingActivityResultsCard activity={activity} sessionId={pSession || undefined} /> : undefined}
          headerExtra={
            <>
              {supplementaryButton}
              {mode !== "confirm" && mode !== "conduct" && mode !== "prepare" ? cancelButton : null}
            </>
          }
          repeatFooterInHeader={mode === "confirm" || mode === "conduct" || mode === "prepare" || mode === "approve"}
        >
          {notices}
          {tab === "overview" && (
            <div className="space-y-4">
              {mode === "edit" && nextSteps}
              {/* The same fields in the same order as New Training Activity: the activity (with who opened it, the document and the days), then the session, then the description. */}
              <ReadonlyGrid>
                <ReadonlyField
                  label={tr("Training Number")}
                  value={activity.trainingNumber}
                />
                <ReadonlyField
                  label={tr("Department")}
                  value={activity.departmentName}
                />
                <ReadonlyField label={tr("Opened By")} value={activity.createdByName} />
                <ReadonlyField label={tr("Training Completed On")} value={day(activity.completedOn)} />
                <ReadonlyField label={tr("Created Time")} value={when(activity.createdAt)} />
                <ReadonlyField
                  label={tr("Type")}
                  value={KIND_LABEL[activity.kind] ?? activity.kind}
                />
                <ReadonlyField
                  label={tr("Reason")}
                  value={
                    activity.kindReason
                      ? (KIND_REASON_LABEL[activity.kindReason] ??
                        activity.kindReason)
                      : ""
                  }
                />
                {external && (
                  <ReadonlyField
                    label={tr("External training")}
                    value={
                      activity.externalType
                        ? EXTERNAL_TYPE_LABEL[activity.externalType]
                        : ""
                    }
                  />
                )}
                {external &&
                  (caps?.edit ? (
                    <>
                      <FormField label={tr("Training unit / individual")} required>
                        <Input
                          value={form.trainingUnitName}
                          maxLength={255}
                          onChange={(e) =>
                            setDraft({
                              ...form,
                              trainingUnitName: e.target.value,
                            })
                          }
                        />
                      </FormField>
                      <FormField label={tr("Vendor reference (SOP.0025)")}>
                        <Input
                          value={form.vendorRef}
                          maxLength={120}
                          onChange={(e) =>
                            setDraft({ ...form, vendorRef: e.target.value })
                          }
                        />
                      </FormField>
                    </>
                  ) : (
                    <>
                      <ReadonlyField
                        label={tr("Training unit / individual")}
                        value={activity.trainingUnitName}
                      />
                      <ReadonlyField
                        label={tr("Vendor reference (SOP.0025)")}
                        value={activity.vendorRef}
                      />
                    </>
                  ))}
                {activity.documentNumber && (
                  <>
                    <ReadonlyField
                      label={tr("Document")}
                      value={activity.documentLabel ?? ""}
                    />
                  </>
                )}
                {(activity.groupRevisions ?? []).filter((r) => !r.isMain).length > 0 && (
                  <ReadonlyField
                    label={tr("Related documents (same Training Number)")}
                    value={(activity.groupRevisions ?? []).filter((r) => !r.isMain).map((r) => r.documentLabel ?? r.documentNumber).join(", ")}
                    wide
                  />
                )}
                {/* The Due Date is one of the fields of the activity: the grid keeps the rows full (ReadonlyGrid). */}
                {dueDateField}
                {/* With a session, or with the form that adds one, the topic is the topic of the session (below): it is not said twice. */}
                {activity.sessions.length === 0 && !caps?.planSessions && (
                  <ReadonlyField
                    label={tr("Training Topic")}
                    value={activityTopics || "—"}
                    wide
                  />
                )}
                {/* A historical activity has no session: the mode and the trainer are the ones written on the paper record. */}
                {activity.kind === "LEGACY" && (
                  <>
                    <ReadonlyField label={tr("Mode")} value={activity.paperMethod ? METHOD_LABEL[activity.paperMethod] ?? activity.paperMethod : "—"} />
                    <ReadonlyField label={tr("Trainer")} value={activity.paperTrainer || "—"} />
                  </>
                )}
              </ReadonlyGrid>
              {/* The sessions of the activity as cards, as on the New screen: the topic, the day, the place, the trainer and what each session still lacks. */}
              <div className="space-y-4">
                <SessionsSection
                  cards={sessionCards}
                  sources={sessionSources}
                  canAdd={Boolean(caps?.planSessions)}
                  external={external}
                  busy={busy}
                  canCopyPeople={!activity.listPreparedBy}
                  initialTopic={activity.documentNumber ? `${activity.documentNumber} ${activity.documentName ?? ""}`.trim() : undefined}
                  documentRevisionId={activity.documentNumber ? (activity.revisionId ?? undefined) : undefined}
                  defaultForm={sessionDefaults ? { method: sessionDefaults.method, assessmentMethod: sessionDefaults.assessmentMethod, instructor: "INTERNAL", trainerUserId: sessionDefaults.trainerUserId ?? "" } : undefined}
                  defaultTrainerName={sessionDefaults?.trainerName ?? undefined}
                  emptyNote={
                    <>
                      {activity.kind === "LEGACY"
                        ? "This training was done on paper before the system and was imported with its document. It has no session; the scan of the paper record and the persons who were trained are in Legacy Training Evidence."
                        : tr("No session yet. Press Add session to add the first one.")}
                      {(activity.proposedParticipantCount ?? 0) > 0 &&
                        ` ${activity.proposedParticipantCount} participant${activity.proposedParticipantCount === 1 ? " was" : "s were"} proposed when the document was prepared; they are put on the list of the first session, and you confirm the list.`}
                    </>
                  }
                  onSave={(body, options) => run(() => trainingActivitiesApi.addSession(activity.id, { ...body, copyPeopleFrom: options.copyPeopleFrom }), "Session added")}
                >
                  {/* The paper pack and the preparation are tools of the person who organises: they are shown where that person works (planning, and before the first session is held);
                      elsewhere they would only be read, and the prints are in the Audit Trail. */}
                  {paperShown && paperBlocks}
                </SessionsSection>
              </div>
              <ReadonlyGrid>
                {caps?.edit || caps?.editRemarks ? (
                  <div className="md:col-span-2">
                    <FormField label={tr("Description")} required>
                      <Textarea
                        rows={3}
                        value={form.remarks}
                        onChange={(e) =>
                          setDraft({ ...form, remarks: e.target.value })
                        }
                      />
                    </FormField>
                  </div>
                ) : (
                  <ReadonlyField
                    label={tr("Description")}
                    value={activity.remarks}
                    wide
                    multiline
                  />
                )}
                {activity.cancelReason && (
                  <ReadonlyField
                    label={tr("Reason for Cancelling")}
                    value={activity.cancelReason}
                    wide
                  />
                )}
              </ReadonlyGrid>
            </div>
          )}

          {tab === "participants" && activity.kind === "LEGACY" && <LegacyPeopleTab activityId={activity.id} />}
          {tab === "participants" && activity.kind !== "LEGACY" && (
            <div className="space-y-6">
              {!singleSession && sessionChips}
              {caps?.addParticipants &&
                (targetSession ? (
                  <ParticipantsPanel
                    key={targetSession.id}
                    activityId={activity.id}
                    session={targetSession}
                    busy={busy}
                    onSave={(body) =>
                      void run(
                        () =>
                          trainingActivitiesApi.addParticipants(
                            activity.id,
                            body,
                          ),
                        "Participants added",
                      )
                    }
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-sm text-slate-600">
                    {tr("Add a session first (General Information): the people are added to a session.")}
                  </p>
                ))}
              {/* Typing the results of a paper test is work of the conduct of the training (and of the person who checks it), not of a screen that only shows the activity. */}
              {(mode === "conduct" || mode === "confirm") && !monitoring && (
                <TrainingTranscriptionBlock
                  activity={activity}
                  userId={user?.id}
                  canEnter={Boolean(caps?.transcribe)}
                  canVerify={Boolean(caps?.verifyTranscription)}
                  onChanged={() =>
                    void run(
                      () => trainingActivitiesApi.get(activity.id),
                      "Updated",
                    )
                  }
                />
              )}
              {groupTables((monitoring ? columnsShown.filter((c) => c.id !== "actions") : columnsShown).filter((c) => !(singleSession && c.id === "session")))}
            </div>
          )}

          {tab === "signatures" && (
            <ReadonlyGrid>
              {signatureSteps.map((x) => (
                <Fragment key={x.key}>
                  <ReadonlyField label={`${x.label} By`} value={x.by} />
                  <ReadonlyField label={`${x.label} On (Date - Time)`} value={x.on} />
                </Fragment>
              ))}
            </ReadonlyGrid>
          )}

          {(tab === "materials" || tab === "assessment") && !external && activeSessions.length > 1 && (
            <div className="mb-4"><SessionPills pills={contentPills} value={contentSession} onChange={setContentSession} /></div>
          )}
          {(tab === "materials" || tab === "assessment") && !external && (
            <ContentRulesPanel
              activity={activity}
              part={tab}
              canExempt={Boolean(caps?.setContentExemptions)}
              onExempt={(body) => run(() => trainingActivitiesApi.setContentExemptions(activity.id, body), "Saved")}
            />
          )}
          {(tab === "materials" || tab === "assessment") && (
            <div className={tab === "assessment" ? "space-y-6" : undefined}>
              {tab === "assessment" && !external && !activity.assessmentExempt && (
                <>
                  {activeSessions.length > 1 && !contentSession ? (
                    <SessionAssessmentList sessions={activeSessions} editable={mode === "edit" && Boolean(caps?.chooseAssessment)} onPick={setContentSession} />
                  ) : (
                    <TrainingAssessmentChoiceBlock activity={activity} session={scopedSession} editable={mode === "edit" && Boolean(caps?.chooseAssessment)} onChanged={() => void load()} />
                  )}
                  <TrainingExamBlock activityId={activity.id} />
                </>
              )}
              <TrainingActivityFilesTab
                key={`${tab}-${contentSession}-${activity.assessment?.assessmentId ?? ""}-${activity.assessment?.chosenAt ?? ""}-${activeSessions.map((x) => x.assessment?.assessmentDefId ?? "").join("")}`}
                sessionId={scopedSession?.id}
                sessions={activeSessions.length > 1 ? activeSessions.map((x) => ({ id: x.id, label: `${tr("Session")} ${x.sessionNo} · ${x.topics[0]?.topicText ?? ""}` })) : undefined}
                part={tab}
                formKind={assessmentFormKind(activity)}
                materialsNeeded={activity.contentRules?.materialsRequired ?? true}
                formNeeded={activity.contentRules ? activity.contentRules.testRequired || activity.contentRules.checklistRequired : true}
                note={external ? null : contentRuleNote(activity, tab)}
                mode={monitoring && tab === "assessment" ? "view" : mode}
                external={external}
                activityId={activity.id}
                participants={activity.participants}
              />
            </div>
          )}

          {tab === "audit" && (
            <AuditTrailTab
              entityId={activity.id}
              entityType="TRAINING_ACTIVITY"
            />
          )}
        </TrainingDetailLayout>
      )}

      {dialog?.type === "editSession" && (
        <SessionEditDialog
          session={dialog.session}
          external={external}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(change) => void run(() => trainingActivitiesApi.updateSession(dialog.session.id, change), "Session changed")}
        />
      )}
      {dialog?.type === "cancelSession" && (
        <ReasonDialog
          title={`${tr("Cancel session")} ${dialog.session.sessionNo}`}
          help={tr("Use this for a session that was added and is not needed. It is signed. The people on it are taken off it (they were not told yet) and the other sessions and the confirmed list stay as they are. The reason stays in the Audit Trail.")}
          confirmText={tr("Cancel session")}
          destructive
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) => {
            const session = dialog.session;
            setDialog(undefined);
            signAction(
              `${tr("Cancel session")} ${session.sessionNo}`,
              "TRAINING_SESSION_CANCELLED",
              "Training Session Cancelled",
              (t) => trainingActivitiesApi.cancelSession(session.id, reason, t),
            );
          }}
        />
      )}
      {dialog?.type === "reopenContent" && (
        <ReasonDialog
          title={tr("Edit the Training Content")}
          help={tr("The approvals that were given stay in the history but no longer count. The activity goes back to Planned: correct it, save and submit it for approval again. The reason is kept in the Audit Trail.")}
          confirmText="Continue"
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) => {
            setDialog(undefined);
            signAction(
              "Edit the training content",
              "TRAINING_CONTENT_REOPENED",
              "Training Content Reopened",
              (t) => trainingActivitiesApi.reopenContent(activity.id, activity.version, reason, t),
              statusChange(activity.status === "NOTIFIED" ? "Notified" : tr("Pending Approval"), "Planned", "Training content"),
            );
          }}
        />
      )}
      {dialog?.type === "rejectContent" && (
        <ReasonDialog
          title={tr("Reject the Training Content")}
          help={tr("The activity goes back to Planned with the same two approvers. The person who prepared it is told your reason, corrects the content and submits it again.")}
          confirmText="Continue"
          destructive
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) => {
            setDialog(undefined);
            signAction(
              "Reject the training content",
              "TRAINING_CONTENT_REJECTED",
              "Training Content Rejected",
              (t) => trainingActivitiesApi.rejectContent(activity.id, activity.version, reason, t),
              statusChange("Pending Approval", "Planned", "Training content"),
            );
          }}
        />
      )}
      {dialog?.type === "returnForCorrection" && (
        <ReasonDialog
          title={tr("Return the Results for Correction")}
          help={tr("Nothing has been written to a personal record yet. The activity goes back to In Progress, the organizer corrects and sends it to QA again.")}
          confirmText="Continue"
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) => {
            setDialog(undefined);
            signAction(
              "Return the results for correction",
              "TRAINING_RETURNED_FOR_CORRECTION",
              "Training Returned for Correction",
              (t) => trainingActivitiesApi.returnForCorrection(activity.id, activity.version, reason, t),
              statusChange("Pending QA Confirmation", "In Progress"),
            );
          }}
        />
      )}
      {dialog?.type === "cancel" && (
        <ReasonDialog
          title={tr("Cancel Training Activity")}
          help={tr("The cancellation is signed. The Training Number is never used again. The reason stays in the record.")}
          confirmText={tr("Cancel activity")}
          destructive
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) => {
            setDialog(undefined);
            signAction(
              "Cancel the training activity",
              "TRAINING_ACTIVITY_CANCELLED",
              "Training Activity Cancelled",
              (t) => trainingActivitiesApi.cancel(activity.id, activity.version, reason, t),
              statusChange(STATUS_LABEL[activity.status] ?? activity.status, STATUS_LABEL.CANCELLED),
            );
          }}
        />
      )}
      {dialog?.type === "releaseExam" && (
        <ReasonDialog
          title={`Release the Test for ${dialog.participant.fullName}`}
          help={tr("The trainee may take the test once more. The reason stays in the Audit Trail.")}
          confirmText="Release"
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) =>
            run(async () => {
              await trainingExamApi.release(dialog.participant.id, reason);
              return trainingActivitiesApi.get(activity.id);
            }, "Test released")
          }
        />
      )}
      {dialog?.type === "postpone" && (
        <PostponeDialog
          busy={busy}
          dueDate={activity.dueDate?.slice(0, 10) ?? ""}
          onClose={() => setDialog(undefined)}
          onSave={(date, reason, moveDueDate) =>
            run(
              () =>
                trainingActivitiesApi.postponeSession(
                  dialog.session.id,
                  date,
                  reason,
                  moveDueDate,
                ),
              "Session postponed",
            )
          }
        />
      )}
      {dialog?.type === "attendance" && (
        <AttendanceDialog
          participant={dialog.participant}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(state, reason) =>
            run(
              () =>
                trainingActivitiesApi.attendance(
                  dialog.participant.id,
                  state,
                  reason,
                ),
              "Attendance recorded",
            )
          }
        />
      )}
      {dialog?.type === "correctAttendance" && (
        <CorrectAttendanceDialog
          participant={dialog.participant}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(state, reason) =>
            run(
              () =>
                trainingActivitiesApi.correctAttendance(
                  dialog.participant.id,
                  state,
                  reason,
                ),
              "Attendance corrected",
            )
          }
        />
      )}
      {dialog?.type === "assessment" && (
        <AssessmentDialog
          participant={dialog.participant}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(got, max, remarks) =>
            run(
              () =>
                trainingActivitiesApi.assessment(
                  dialog.participant.id,
                  got,
                  max,
                  remarks,
                ),
              "Result recorded",
            )
          }
        />
      )}
      {dialog?.type === "approver" && (
        <TrainingApproverSelectModal
          activityId={activity.id}
          initialFirstId={activity.approverPlan?.firstUserId}
          initialSecondId={activity.approverPlan?.secondUserId}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(firstId, secondId) => run(() => trainingActivitiesApi.saveApprovers(activity.id, firstId, secondId), "Approvers saved")}
        />
      )}
      {dialog?.type === "trainerException" && (
        <TrainerExceptionDialog
          sessionId={dialog.session.id}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason, approver) =>
            run(async () => {
              await trainingActivitiesApi.requestTrainerException(
                dialog.session.id,
                reason,
                approver,
              );
              return trainingActivitiesApi.get(activity.id);
            }, "Exception requested")
          }
        />
      )}
      {dialog?.type === "rejectException" && (
        <ReasonDialog
          title={tr("Reject Trainer Exception")}
          help={tr("The session cannot go ahead with this trainer unless another exception is approved.")}
          confirmText="Reject"
          destructive
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) =>
            run(async () => {
              await trainingActivitiesApi.rejectTrainerException(
                dialog.exceptionId,
                reason,
              );
              return trainingActivitiesApi.get(activity.id);
            }, "Exception rejected")
          }
        />
      )}
      {dialog?.type === "removeParticipant" && (
        <ReasonDialog
          title={`Remove ${dialog.participant.fullName}`}
          help={tr("Only before the attendee list is confirmed. The name and the reason stay in the Audit Trail. After that, mark the person absent instead.")}
          confirmText="Remove"
          destructive
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) =>
            run(
              () =>
                trainingActivitiesApi.removeParticipant(
                  dialog.participant.id,
                  reason,
                ),
              "Person removed",
            )
          }
        />
      )}
      {dialog?.type === "participation" && (
        <ParticipationDialog
          participant={dialog.participant}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(role, reason) =>
            run(
              () =>
                trainingActivitiesApi.setParticipation(
                  dialog.participant.id,
                  role,
                  reason,
                ),
              "Participation saved",
            )
          }
        />
      )}
      {dialog?.type === "plannedAbsence" && (
        <ReasonDialog
          title={`Mark ${dialog.participant.fullName} Absent`}
          help={tr("The person stays on the attendee list, as SOP.0003 5.3.4 requires. The reason is written on the row.")}
          confirmText={tr("Mark absent")}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) =>
            run(
              () =>
                trainingActivitiesApi.setPlannedAbsence(
                  dialog.participant.id,
                  reason,
                ),
              "Marked absent",
            )
          }
        />
      )}
      {dialog?.type === "supplementary" && (
        <SupplementaryDialog
          participants={activity.supplementaryCandidates ?? []}
          sessionLabel={(p) => {
            const open = activity.sessions.filter((x) => x.status !== "CANCELLED");
            const no = open.length > 1 ? sessionOf(p.sessionId ?? "")?.sessionNo : undefined;
            return no ? `${tr("Session")} ${no}` : null;
          }}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(ids, reason) =>
            run(async () => {
              const created = await trainingActivitiesApi.supplementary(
                activity.id,
                ids,
                reason,
              );
              navigate(`/training-management/activities/${created.id}/edit`);
              return created;
            }, "Supplementary training created")
          }
        />
      )}
      <ESignatureModal
        isOpen={!!sign}
        onClose={() => setSign(undefined)}
        onConfirm={async (data: { signatureToken: string; reason?: string }) => {
          if (!sign) return;
          const ok = await run(() => sign.run(data.signatureToken, data.reason), SIGNED_DONE[sign.meaningCode] ?? sign.title);
          if (ok) setSign(undefined);
        }}
        actionTitle={sign?.title}
        changes={sign?.changes}
        meaningDisplayName={sign?.meaningName}
        meaningCode={sign?.meaningCode}
        targetDetails={{
          code: activity.trainingNumber,
          title: activityTopics,
          revision: "",
        }}
      />
    </>
  );
}

// ------------------------------------------------------------------------------------------------------------------------------ dialogs

function ReasonDialog({
  title,
  help,
  confirmText,
  destructive,
  busy,
  onClose,
  onSave,
}: {
  title: string;
  help?: string;
  confirmText: string;
  destructive?: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => onSave(reason.trim())}
      title={title}
      description={help}
      confirmText={confirmText}
      confirmVariant={destructive ? "destructive" : "default"}
      isLoading={busy}
      confirmDisabled={!reason.trim()}
      size="md"
    >
      <FormField label={tr("Reason")} required>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
    </FormModal>
  );
}

/** Quick reasons for a person who takes no assessment; the organizer may type any other reason. */
const PARTICIPATION_QUICK_REASONS = ["Senior management attending", "Attends for information"];

function ParticipationDialog({
  participant,
  busy,
  onClose,
  onSave,
}: {
  participant: TrainingParticipant;
  busy: boolean;
  onClose: () => void;
  onSave: (role: ParticipationRole, reason?: string) => void;
}) {
  const current = participant.participationRole ?? "TRAINEE";
  const [role, setRole] = useState<ParticipationRole>(current);
  const [reason, setReason] = useState(participant.participationReason ?? "");
  const trainee = role === "TRAINEE";
  const choose = (value: ParticipationRole) => {
    setRole(value);
    // A trainee has no reason.
    if (value === "TRAINEE") setReason("");
  };
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={`Participation: ${participant.fullName}`}
      description={tr("How the person takes part decides whether they take the assessment. The role, the reason and who set it stay in the Audit Trail. It cannot be changed once the person has a score.")}
      confirmText="Save"
      isLoading={busy}
      confirmDisabled={(role === current && reason.trim() === (participant.participationReason ?? "")) || (!trainee && !reason.trim())}
      size="md"
      onConfirm={() => onSave(role, trainee ? undefined : reason.trim())}
    >
      <div className="grid gap-4">
        <FormField label={tr("Participation")} required>
          <Select
            value={role}
            enableSearch={false}
            onChange={(v) => choose(v as ParticipationRole)}
            options={Object.entries(PARTICIPATION_ROLE_LABEL).map(([value, label]) => ({ label, value }))}
          />
        </FormField>
        <p className="text-xs text-slate-500">{PARTICIPATION_ROLE_HELP[role]}</p>
        {!trainee && (
          <>
            <FormField label={tr("Reason")} required>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
            <div className="flex flex-wrap gap-2">
              {PARTICIPATION_QUICK_REASONS.map((text) => (
                <Button key={text} size="sm" variant="outline-emerald" type="button" onClick={() => setReason(text)}>
                  {text}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </FormModal>
  );
}

/** The last day of the month of an ISO date (yyyy-MM-dd): the Due Date a postponement into a later month asks for. */
function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function PostponeDialog({
  busy,
  dueDate,
  onClose,
  onSave,
}: {
  busy: boolean;
  dueDate: string;
  onClose: () => void;
  onSave: (date: string, reason: string, moveDueDate: boolean) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [moveDue, setMoveDue] = useState("MOVE");
  // The new date falls after the Due Date: SOP.0003 5.3.6 moves the training to the following month, so the user is told and decides.
  const afterDue = Boolean(dueDate && date && date > dueDate);
  const newDue = afterDue ? endOfMonth(date) : "";
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => onSave(date, reason.trim(), afterDue && moveDue === "MOVE")}
      title={tr("Postpone Session")}
      description={tr("The Training Number stays. The old date, the new date and the reason are recorded.")}
      confirmText="Postpone"
      isLoading={busy}
      confirmDisabled={!date || !reason.trim()}
      size="xl"
    >
      <div className="grid gap-4">
        <TrainingDateField label={tr("New date")} value={date} onChange={setDate} />
        {afterDue && (
          <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p>{trFormat("The new date is after the Due Date ({date}). SOP.0003 5.3.6: a training that cannot be completed in its month is conducted in the following month. If it comes from a training requirement, the line of the requirement moves to that month too; the month it was approved for stays on the line.", { date: day(dueDate) })}</p>
            <RadioGroup name="postpone-due" value={moveDue} onChange={(v) => setMoveDue(String(v))}
              options={[{ label: `Move the Due Date to ${day(newDue)}`, value: "MOVE" }, { label: `Keep the Due Date ${day(dueDate)} (the session is then after it)`, value: "KEEP" }]} />
          </div>
        )}
        <FormField label={tr("Reason")} required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </div>
    </FormModal>
  );
}

function AttendanceDialog({
  participant,
  busy,
  onClose,
  onSave,
}: {
  participant: TrainingParticipant;
  busy: boolean;
  onClose: () => void;
  onSave: (state: "ATTENDED" | "ONLINE" | "ABSENT", reason?: string) => void;
}) {
  const [state, setState] = useState<"ATTENDED" | "ONLINE" | "ABSENT">(
    "ATTENDED",
  );
  const [reason, setReason] = useState("");
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={`Attendance: ${participant.fullName}`}
      confirmText="Save"
      isLoading={busy}
      confirmDisabled={state === "ABSENT" && !reason.trim()}
      size="md"
      onConfirm={() => onSave(state, reason.trim() || undefined)}
    >
      <div className="grid gap-4">
        <FormField label={tr("Attendance")} required>
          <Select
            value={state}
            enableSearch={false}
            onChange={(v) => setState(v)}
            options={[
              { label: "Attended", value: "ATTENDED" },
              { label: tr("Attended online"), value: "ONLINE" },
              { label: "Absent", value: "ABSENT" },
            ]}
          />
        </FormField>
        {state === "ABSENT" && (
          <FormField label={tr("Reason for absence")} required>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        )}
      </div>
    </FormModal>
  );
}

function CorrectAttendanceDialog({
  participant,
  busy,
  onClose,
  onSave,
}: {
  participant: TrainingParticipant;
  busy: boolean;
  onClose: () => void;
  onSave: (state: "ATTENDED" | "ONLINE" | "ABSENT", reason: string) => void;
}) {
  const current = participant.state as "ATTENDED" | "ONLINE" | "ABSENT";
  const [state, setState] = useState<"ATTENDED" | "ONLINE" | "ABSENT">(
    current === "ABSENT" ? "ATTENDED" : "ABSENT",
  );
  const [reason, setReason] = useState("");
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={`Correct the Attendance of ${participant.fullName}`}
      description={tr("Use this only for a mistake. The old value, the new value and your reason stay in the Audit Trail. It cannot be changed after the person has a score.")}
      confirmText="Confirm"
      isLoading={busy}
      confirmDisabled={state === current || !reason.trim()}
      size="md"
      onConfirm={() => onSave(state, reason.trim())}
    >
      <div className="grid gap-4">
        <FormField label={tr("Attendance now")}>
          <Input value={PARTICIPANT_STATE_LABEL[current] ?? current} disabled />
        </FormField>
        <FormField label={tr("Correct attendance")} required>
          <Select
            value={state}
            enableSearch={false}
            onChange={(v) => setState(v)}
            options={[
              { label: "Attended", value: "ATTENDED" },
              { label: tr("Attended online"), value: "ONLINE" },
              { label: "Absent", value: "ABSENT" },
            ]}
          />
        </FormField>
        <FormField label={tr("Reason for the correction")} required>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </div>
    </FormModal>
  );
}

function AssessmentDialog({
  participant,
  busy,
  onClose,
  onSave,
}: {
  participant: TrainingParticipant;
  busy: boolean;
  onClose: () => void;
  onSave: (got: number, max: number, remarks?: string) => void;
}) {
  const [got, setGot] = useState("");
  const [max, setMax] = useState("100");
  const [remarks, setRemarks] = useState("");
  const valid =
    got !== "" &&
    Number(max) > 0 &&
    Number(got) >= 0 &&
    Number(got) <= Number(max);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={`Result: ${participant.fullName}`}
      description={tr("Enter the score. The system works out the percentage and the result from the pass mark in force.")}
      confirmText="Save"
      isLoading={busy}
      confirmDisabled={!valid}
      size="md"
      onConfirm={() =>
        onSave(Number(got), Number(max), remarks.trim() || undefined)
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label={tr("Score Obtained")} required>
          <Input
            type="number"
            min={0}
            value={got}
            onChange={(e) => setGot(e.target.value)}
          />
        </FormField>
        <FormField label={tr("Maximum Score")} required>
          <Input
            type="number"
            min={1}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </FormField>
        <div className="col-span-2">
          <FormField label={tr("Remarks")}>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </FormField>
        </div>
      </div>
    </FormModal>
  );
}

function SupplementaryDialog({
  participants,
  sessionLabel,
  busy,
  onClose,
  onSave,
}: {
  participants: TrainingParticipant[];
  /** With several sessions a person who missed more than one has a line for each: the line says which session. */
  sessionLabel?: (p: TrainingParticipant) => string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (ids: string[], reason: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  // The list looks like the one that chooses the Reviewers and Approvers of a document: one line a person, a round mark with the number that becomes a tick when chosen.
  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={tr("Supplementary Training")}
      description={tr("A new activity is created under the same number with the next letter. People who were absent or failed are listed.")}
      confirmText={`Create (${selected.length})`}
      isLoading={busy}
      confirmDisabled={selected.length === 0 || !reason.trim()}
      size="lg"
      onConfirm={() => onSave(selected, reason.trim())}
    >
      {participants.length === 0 ? (
        <p className="text-sm text-slate-600">{tr("No one was absent or failed.")}</p>
      ) : (
        <div className="space-y-4">
          <div className="max-h-[350px] min-h-[100px] overflow-y-auto px-1 -mx-1 custom-scrollbar">
            <div className="space-y-2">
              {participants.map((p, index) => {
                const isSelected = selected.includes(p.id);
                const notActive = p.canOfferSupplementary === false;
                const disabled = notActive || p.hasSupplementary === true;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && toggle(p.id)}
                    title={notActive ? `The account is ${(p.accountStatus ?? "not active").toLowerCase()}: the person cannot be trained until it is Active.` : undefined}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                      isSelected
                        ? "border-emerald-200 bg-emerald-50 shadow-sm"
                        : disabled
                          ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
                          : "border-slate-200 bg-white hover:border-emerald-500/30 hover:shadow-sm",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                        isSelected ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500",
                      )}
                    >
                      {isSelected ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 truncate text-xs font-medium text-slate-900 md:text-sm">
                        {p.fullName}
                        <Badge color={p.state === "ABSENT" ? "amber" : "red"} size="sm">{p.state === "ABSENT" ? "Absent" : "Failed"}</Badge>
                        {sessionLabel?.(p) && <Badge color="slate" size="sm">{sessionLabel(p)}</Badge>}
                        {p.hasSupplementary && <Badge color="slate" size="sm">{tr("Already in a supplementary training")}</Badge>}
                        {notActive && <Badge color="slate" size="sm">{`Account ${(p.accountStatus ?? "not active").toLowerCase()}`}</Badge>}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        <span className="mr-1.5 font-medium text-emerald-600">{p.employeeCode || "-"}</span>
                        • {p.position || "-"} • {p.department || "-"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <FormField label={tr("Reason")} required>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        </div>
      )}
    </FormModal>
  );
}

function TrainerExceptionDialog({
  sessionId,
  busy,
  onClose,
  onSave,
}: {
  sessionId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (reason: string, approver: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState("");
  const search = useCallback(
    async (query: string) => {
      const page = await trainingActivitiesApi.trainerExceptionApprovers(
        sessionId,
        query,
      );
      setPeople(page.data);
      setLoaded(true);
      return page.data.map((p) => ({
        label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
        value: p.id,
      }));
    },
    [sessionId],
  );
  useEffect(() => {
    void search("");
  }, [search]);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => onSave(reason.trim(), id)}
      title={tr("Request an Exception for the Trainer")}
      description={tr("The session goes ahead with this trainer only if the person you choose approves, with a signature.")}
      confirmText="Request"
      isLoading={busy}
      confirmDisabled={!reason.trim() || !id}
      size="md"
    >
      <div className="grid gap-4">
        <FormField label={tr("Reason")} required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        {loaded && people.length === 0 ? (
          <p className="text-sm text-amber-700">
            {tr("No eligible approver was found.")}
          </p>
        ) : (
          <Select
            label={tr("Approver")}
            value={id}
            onChange={setId}
            options={people.map((p) => ({
              label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
              value: p.id,
            }))}
            onSearch={search}
            placeholder={tr("Search by name")}
          />
        )}
      </div>
    </FormModal>
  );
}
