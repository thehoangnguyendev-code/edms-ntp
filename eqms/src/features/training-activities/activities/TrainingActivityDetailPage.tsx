import { sessionStarted, sessionNotStarted } from "@/services/api/trainingActivities";
import { SessionEditDialog } from "./components/SessionEditDialog";
import { SessionDetails } from "./components/SessionDetails";
import { ContentRulesPanel, assessmentFormKind, contentRuleNote } from "./components/ContentRulesPanel";
import { TrainingPersonName } from "../shared/TrainingPersonName";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import {
  SignatureFields,
  type SignatureRecord,
} from "@/features/documents/shared/components/SignatureFields";
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
import { WorkspaceResultsTable } from "./components/workspace/WorkspaceResultsTable";
import { TrainingExamBlock } from "./components/TrainingExamBlock";
import { TrainingAssessmentChoiceBlock } from "./components/TrainingAssessmentChoiceBlock";
import { AttendanceListExport } from "./components/AttendanceListExport";
import { TrainingPreparationBlock } from "./components/TrainingPreparationBlock";
import { TrainingTranscriptionBlock } from "./components/TrainingTranscriptionBlock";
import {
  TrainingPaperBlock,
  DELIVERY_LABEL,
} from "./components/TrainingPaperBlock";
import { TrainingActivityFilesTab } from "./components/TrainingActivityFilesTab";
import { TrainingDateField } from "../shared/TrainingDateField";
import {
  ParticipantsPanel,
  SessionPanel,
} from "./components/TrainingActivityPlanning";
import {
  ReadonlyField,
  ReadonlyGrid,
  TabBlock,
  TrainingDetailLayout,
} from "../shared/TrainingDetailLayout";
import {
  trainingActivitiesApi,
  trainingExamApi,
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
  ASSESSMENT_LABEL,
  EXTERNAL_TYPE_LABEL,
  KIND_LABEL,
  KIND_REASON_LABEL,
  METHOD_LABEL,
  PARTICIPANT_STATE_LABEL,
  STATUS_LABEL,
  STEP_LABEL,
  day,
  trainingBreadcrumbs,
  when, statusChange } from "../shared/trainingLabels";
import { useTrainingBack } from "../shared/useTrainingBack";

const ACTIVITY_STEPS = [
  { status: "RESERVED", label: "Pending Document Approval" },
  { status: "PLANNED", label: "Planned" },
  { status: "NOTIFIED", label: "Notified" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "PENDING_QA_CONFIRMATION", label: "Pending QA Confirmation" },
  { status: "COMPLETED", label: "Completed" },
];

/** One screen for each thing a person does with an activity; the Details screen only looks (like Document Details and the Review, Approval and Training screens of a revision). */
export type ActivityMode =
  | "view"
  | "edit"
  | "conduct"
  | "review"
  | "approve"
  | "confirm"
  | "participate";
const MODE_TITLE: Record<ActivityMode, string> = {
  view: "Training Activity Details",
  edit: "Edit Training Activity",
  conduct: "Conduct Training",
  review: "Review Training Content",
  approve: "Approve Training Content",
  confirm: "Confirm Training Completion",
  participate: "Training Participation",
};
const MODE_TAB: Record<ActivityMode, string> = {
  view: "overview",
  edit: "overview",
  conduct: "overview",
  review: "materials",
  approve: "materials",
  confirm: "overview",
  participate: "participants",
};
const MODE_CAPS: Record<ActivityMode, string[]> = {
  view: [],
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
    "setContentExemptions",
    "chooseAssessment",
    "notify",
    "cancel",
  ],
  conduct: [
    "adjustPlan",
    "printPaper",
    "rollCall",
    "transcribe",
    "verifyTranscription",
    "hold",
    "recordAttendance",
    "recordAssessment",
    "submitForConfirmation",
    "finishTraining",
    "sendAttendanceList",
    "addSupplementary",
    "cancel",
  ],
  review: [],
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
    if (key !== "notifyBlockers" && key !== "completeTraining" && !allowed.has(key)) out[key] = false;
  return out as unknown as TrainingCapabilities;
};

type Dialog =
  | { type: "cancel" }
  | { type: "editSession"; session: TrainingSession }
  | { type: "reopenContent" }
  | { type: "returnForCorrection" }
  | { type: "releaseExam"; participant: TrainingParticipant }
  | { type: "postpone"; session: TrainingSession }
  | { type: "attendance"; participant: TrainingParticipant }
  | { type: "correctAttendance"; participant: TrainingParticipant }
  | { type: "assessment"; participant: TrainingParticipant }
  | { type: "designate"; step: TrainingApprovalStep }
  | { type: "supplementary" }
  | { type: "removeParticipant"; participant: TrainingParticipant }
  | { type: "plannedAbsence"; participant: TrainingParticipant }
  | { type: "trainerException"; session: TrainingSession }
  | { type: "rejectException"; exceptionId: string }
  | undefined;

/** What the toast says once a signed action is done (the title of the signing window says what is about to be done). */
const SIGNED_DONE: Record<string, string> = {
  TRAINING_LIST_VERIFIED: "Attendee list confirmed",
  TRAINING_CONTENT_REVIEWED: "Training content reviewed",
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
};

interface SignRequest {
  title: string;
  meaningCode: string;
  meaningName: string;
  changes?: ReturnType<typeof statusChange>;
  run: (signatureToken: string) => Promise<TrainingActivityDetail>;
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
  const { hasPermission } = usePermissions();
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
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);
  const [pSession, setPSession] = useState(workspaceSessionId ?? "");
  // Lines of the Prepare step still to be ticked; the steps after it wait for them while the session is not held.
  const [prepPending, setPrepPending] = useState(0);
  const [draft, setDraft] = useState<{
    trainingTitle: string;
    dueDate: string;
    remarks: string;
    trainingUnitName: string;
    vendorRef: string;
  }>();

  const load = useCallback(() => {
    setError("");
    trainingActivitiesApi
      .get(activityId)
      .then(setActivity)
      .catch((e) => setError(trainingError(e)));
  }, [activityId]);
  useEffect(load, [load]);
  useEntityChanged(["TRAINING"], load);

  /** Runs a command; the answer is the new state of the activity. */
  const run = async (
    action: () => Promise<TrainingActivityDetail>,
    done: string,
  ) => {
    setBusy(true);
    try {
      setActivity(await action());
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
        title: "The action was not done",
        message: trainingError(e),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const caps = activity ? limitCaps(activity.capabilities, mode) : undefined;
  const title = workspace ? "Session Workspace" : MODE_TITLE[mode];
  const tabs: TabItem[] = useMemo(
    () =>
      [
        { id: "overview", label: "General Information" },
        {
          id: "sessions",
          label: "Sessions",
          count: activity?.sessions.length,
        },
        {
          id: "participants",
          label: "Participants",
          count: activity?.participants.length,
        },
        { id: "materials", label: "Training Materials" },
        { id: "assessment", label: "Assessment" },
        { id: "approvals", label: "Approvers" },
        { id: "audit", label: "Audit Trail" },
      ],
    [activity?.sessions.length, activity?.participants.length],
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
  const canClose = hasPermission("training.activity.close");
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
        if (q.qualified) return <Badge color="emerald">Qualified</Badge>;
        const ex = q.exception;
        return (
          <div className="max-w-64 space-y-1 whitespace-normal">
            {ex?.status === "APPROVED" ? (
              <Badge color="amber">Exception approved</Badge>
            ) : ex?.status === "PENDING" ? (
              <Badge color="amber">Exception waiting</Badge>
            ) : (
              <Badge color="red">Not qualified</Badge>
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
                Last exception rejected: {ex.rejectReason}
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
                    Request Exception
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
                      Complete Approve
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
                      Reject
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
                Change
              </Button>
            )}
            {sessionNotStarted(s) && caps?.adjustPlan && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => setDialog({ type: "postpone", session: s })}
              >
                Postpone
              </Button>
            )}
          </div>
        ) : null;

  const sessionOf = (id: string) => activity.sessions.find((s) => s.id === id);
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
  const renderActions = (
    p: TrainingParticipant,
    scope: "all" | "attendance" | "results",
  ) => (
    <div className="flex flex-wrap gap-2">
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
            Clear Absence
          </Button>
        ) : (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() =>
              setDialog({ type: "plannedAbsence", participant: p })
            }
          >
            Mark Absent
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
            Remove
          </Button>
        )}
      {scope === "attendance" &&
        caps?.recordAttendance &&
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
            Correct Attendance
          </Button>
        )}
      {scope !== "results" &&
        caps?.recordAttendance &&
        p.state === "INVITED" &&
        sessionStarted(sessionOf(p.sessionId) ?? { status: "" }) && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() => setDialog({ type: "attendance", participant: p })}
          >
            Mark Attendance
          </Button>
        )}
      {scope !== "attendance" &&
        caps?.recordAssessment &&
        (p.state === "ATTENDED" || p.state === "ONLINE") &&
        !!sessionOf(p.sessionId)?.assessmentMethod &&
        sessionOf(p.sessionId)?.assessmentMethod !==
          "SELF_READING_CONFIRMATION" && (
          <Button
            size="sm"
           variant="outline-emerald"
            onClick={() => setDialog({ type: "assessment", participant: p })}
          >
            Record Result
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
            {p.examState === "OPEN" ? "Continue the Test" : "Take the Test"}
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
            Release the Test
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
                title: "Confirm Self-Reading",
                meaningCode: "TRAINING_READ_CONFIRMED",
                meaningName: "Self-reading Confirmed",
                changes: statusChange("Invited", "Read and understood", "Self-reading"),
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
  );
  // The columns of the attendee list APD.0117: No., ID, name, department, session, attendance, result. The actions follow the screen.
  const participantColumns: DataTableColumn<TrainingParticipant>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "code", header: "Employee ID", cell: (p) => p.employeeCode ?? "—" },
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
                Added by hand: {p.addedReason}
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
      id: "state",
      header: "Attendance",
      cell: (p) => (
        <div className="max-w-64 whitespace-normal">{labelOfState(p)}</div>
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
          {p.result.toLowerCase()}
          {p.lastPercent != null ? ` (${p.lastPercent}%)` : ""}
        </Badge>
      ),
    },
    {
      id: "attempts",
      header: "Re-training",
      cell: (p) =>
        p.attempts && p.attempts > 1 ? `${p.attempts - 1} time(s)` : "—",
    },
    { id: "actions", header: "Action", cell: (p) => renderActions(p, "all") },
  ];
  const attendanceColumns: DataTableColumn<TrainingParticipant>[] = [
    ...participantColumns.filter((c) =>
      ["rowNo", "code", "name", "department", "session", "state"].includes(
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
          ["rowNo", "code", "name"].includes(c.id),
        ),
        {
          id: "trn",
          header: "Training number",
          cell: () => activity.trainingNumber,
        },
        {
          id: "read",
          header: "Reading day",
          cell: (p) => (p.readConfirmedAt ? day(p.readConfirmedAt) : "—"),
        },
        {
          id: "sign",
          header: "Signature",
          cell: (p) =>
            p.state === "READ_CONFIRMED"
              ? p.signMode === "ESIGN"
                ? "E-signature"
                : "Signed on paper"
              : labelOfState(p),
        },
        ...participantColumns.filter((c) => c.id === "actions"),
      ]
    : participantColumns;
  const isAway = (p: TrainingParticipant) =>
    !!p.personUserId &&
    (p.state === "ABSENT" || (p.state === "INVITED" && !!p.plannedAbsence));
  const groups = [
    {
      id: "employees",
      title: "Employees",
      rows: activity.participants.filter(
        (p) => inSession(p) && p.personUserId && !isAway(p),
      ),
    },
    {
      id: "absent",
      title: "Absent (stay on the list)",
      rows: activity.participants.filter((p) => inSession(p) && isAway(p)),
    },
    {
      id: "outside",
      title: "Outside persons",
      rows: activity.participants.filter(
        (p) => inSession(p) && !p.personUserId,
      ),
    },
  ];
  const targetSession =
    activity.sessions.find((x) => x.id === pSession) ?? activity.sessions[0];

  const sessionChips = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-700 sm:text-sm">
        Session
      </span>
      {[
        { id: "", label: `All (${activity.participants.length})` },
        ...activity.sessions.map((x) => ({
          id: x.id,
          label:
            `S${x.sessionNo} ${x.topics[0]?.topicText ?? ""}`.trim() +
            ` (${activity.participants.filter((p) => p.sessionId === x.id).length})`,
        })),
      ].map((chip) => (
        <button
          key={chip.id || "all"}
          type="button"
          onClick={() => setPSession(chip.id)}
          className={`max-w-xs truncate rounded-full border px-3 py-1 text-xs font-medium transition-colors ${pSession === chip.id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );

  const paperBlocks = (
    <>
      <TrainingPaperBlock
        activity={activity}
        canPrint={Boolean(caps?.printPaper)}
        canMode={Boolean(caps?.adjustPlan)}
        onChanged={() =>
          void run(() => trainingActivitiesApi.get(activity.id), "Updated")
        }
      />
      <TrainingPreparationBlock
        activityId={activity.id}
        canManage={Boolean(caps?.adjustPlan)}
      />
    </>
  );
  const groupTables = (columns: DataTableColumn<TrainingParticipant>[]) =>
    groups
      .filter((g) => g.rows.length > 0 || g.id === "employees")
      .map((g) => (
        <TabBlock key={g.id} title={`${g.title} (${g.rows.length})`}>
          <DataTable
            rows={g.rows}
            getRowKey={(p) => p.id}
            columns={columns}
            emptyState={
              <p className="p-4 text-sm text-slate-500">No participant yet.</p>
            }
          />
        </TabBlock>
      ));
  const signAction = (
    title: string,
    meaningCode: string,
    meaningName: string,
    runWith: (token: string) => Promise<TrainingActivityDetail>,
    changes?: ReturnType<typeof statusChange>,
  ) => setSign({ title, meaningCode, meaningName, changes, run: runWith });

  const external = activity.kind === "EXTERNAL";
  const open = !["COMPLETED", "CANCELLED"].includes(activity.status);
  const qa = activity.qaList;
  const results = activity.resultsToQa;
  // The days to send the results to QA (SOP.0003 5.3.7), counted in calendar days from the day the last session was held.
  const resultsNotice = open && results && ["DUE", "DUE_TODAY", "OVERDUE"].includes(results.state) ? (
    <p
      role="status"
      className={`rounded-lg border px-3 py-2 text-sm ${results.state === "OVERDUE" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
    >
      {results.state === "DUE" && `Send the results to QA by ${day(results.dueOn)}: ${results.days} days after the training was held (SOP.0003 5.3.7).`}
      {results.state === "DUE_TODAY" && "Today is the last day to send the results to QA (SOP.0003 5.3.7)."}
      {results.state === "OVERDUE" && `The results were due to QA on ${day(results.dueOn)} and have not been sent. Send them now; the delay is recorded.`}
    </p>
  ) : null;
  // Two notices that guide the manual part of the procedure: the day the list goes to QA (SOP.0003 5.3.6) and the approved vendor list for an outside trainer (SOP.0025).
  const notices = open ? (
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
      {external && !activity.vendorRef?.trim() && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Check that the training unit is on the approved vendor list (SOP.0025)
          and enter its reference in "Vendor reference". The system does not
          hold the vendor list.
        </p>
      )}
    </div>
  ) : null;
  const form = draft ?? {
    trainingTitle: activity.trainingTitle,
    dueDate: activity.dueDate?.slice(0, 10) ?? "",
    remarks: activity.remarks ?? "",
    trainingUnitName: activity.trainingUnitName ?? "",
    vendorRef: activity.vendorRef ?? "",
  };
  const formDirty =
    !!draft &&
    (draft.trainingTitle !== activity.trainingTitle ||
      draft.dueDate !== (activity.dueDate?.slice(0, 10) ?? "") ||
      draft.remarks !== (activity.remarks ?? "") ||
      draft.trainingUnitName !== (activity.trainingUnitName ?? "") ||
      draft.vendorRef !== (activity.vendorRef ?? ""));
  const blockers = caps?.notifyBlockers ?? [];
  const stepsToDo = [
    {
      done: activity.sessions.length > 0,
      text: external
        ? "Add the session: topic, date and place (tab Sessions)"
        : "Add the session: topic, method, trainer and date (tab Sessions)",
      tab: "sessions",
    },
    {
      done: activity.participants.length > 0,
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
                  ? "The approved document is the training material (add slides or other material in the tab Training Materials if you want)"
                  : "Add the training material: a file or a link (tab Training Materials)",
                tab: "materials",
              }]
            : []),
          ...(activity.contentRules?.testRequired || activity.contentRules?.checklistRequired
            ? [{
                done: activity.contentRules.assessmentFormSatisfied || (activity.contentRules.testRequired && activity.contentRules.onlineTest),
                text: activity.contentRules.checklistRequired && !activity.contentRules.testRequired
                  ? "Add the checklist form (APD.0009) (tab Assessment)"
                  : "Add the test (APD.0009), as a file or written in the system (tab Assessment)",
                tab: "assessment",
              }]
            : []),
          {
            done: stepDone("CONTENT_REVIEWED") && stepDone("CONTENT_APPROVED"),
            text: "Designate who reviews and approves the content (tab Approvers)",
            tab: "approvals",
          },
        ]),
    {
      done: activity.status !== "PLANNED",
      text: "Notify the participants (button below)",
      tab: "overview",
    },
  ];
  const nextSteps =
    ["PLANNED", "NOTIFIED"].includes(activity.status) && caps?.planSessions ? (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">
          To prepare this training
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
        {activity.listPreparedBy && blockers.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Participants cannot be notified yet:
            <ul className="mt-1 list-disc pl-4">
              {blockers.map((b) => (
                <li key={b}>{trainingCodeText(b)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ) : null;

  const confirmation = (label: string, kind: string): SignatureRecord => {
    const c = activity.confirmations.find((x) => x.kind === kind);
    return {
      actionBy: `${label} By`,
      actionByName: c?.confirmedByName ?? "-",
      actionOn: `${label} On (Date - Time)`,
      actionOnValue: c?.confirmedAt ?? "-",
    };
  };
  const signatureRecords: SignatureRecord[] = [
    confirmation("Attendee List Confirmed", "ATTENDEE_LIST_PREPARED"),
    confirmation("Content Reviewed", "CONTENT_REVIEWED"),
    confirmation("Content Approved", "CONTENT_APPROVED"),
    ...(activity.confirmations.some((c) => c.kind === "HEAD_SELF_READING")
      ? [confirmation("Self-reading Verified", "HEAD_SELF_READING")]
      : []),
    confirmation("Completion Confirmed", "QA_COMPLETION"),
  ];

  // ---- the workspace of one session
  const wsSession = workspace
    ? activity.sessions.find((x) => x.id === workspaceSessionId)
    : undefined;
  const wsPeople = workspace
    ? activity.participants.filter((p) => p.sessionId === workspaceSessionId)
    : [];
  const wsHeld = !!wsSession && sessionStarted(wsSession);
  const wsPending = wsPeople.filter(
    (p) => p.state === "INVITED" && !p.plannedAbsence,
  ).length;
  const wsEligible = wsPeople.filter(
    (p) => p.personUserId && ["ATTENDED", "ONLINE"].includes(p.state),
  );
  const wsUnscored = wsEligible.filter((p) => p.result === "PENDING").length;
  const wsPresent = wsPeople.filter((p) =>
    ["ATTENDED", "ONLINE", "READ_CONFIRMED"].includes(p.state),
  ).length;
  const wsAbsent = wsPeople.filter(
    (p) =>
      p.state === "ABSENT" || (p.state === "INVITED" && !!p.plannedAbsence),
  ).length;
  const wsPassed = wsPeople.filter((p) => p.result === "PASSED").length;
  const wsFailed = wsPeople.filter((p) => p.result === "FAILED").length;
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
  const wsAttendanceDone = wsHeld && wsPending === 0 && wsPeople.length > 0;
  const wsSteps: WorkspaceStep[] = [
    {
      id: "ws-prepare",
      label: "Prepare",
      subtitle: wsHeld ? `Started ${day(wsSession?.heldOn)}` : "Not started",
      description:
        "Tick what is ready: the room, the equipment, the materials, the notice, the test and the paper. The training starts with the first attendance.",
      done: wsHeld,
      icon: IconClipboardCheck,
    },
    {
      id: "ws-attendance",
      label: "Attendance",
      subtitle: `${wsPresent} of ${wsPeople.length} present`,
      description:
        "Record who came: with the code or the QR, with the quick roll-call, or one by one; an absence needs its reason. When everyone is recorded, the trainer sends the attendance list to QA with an electronic signature. A mistake is corrected with a reason.",
      done: wsAttendanceDone,
      icon: IconUserCheck,
    },
    {
      id: "ws-training",
      label: "Training",
      subtitle: "Approved content",
      description:
        "Teach with the approved content only. Nothing is typed here: the session is held and the attendance recorded.",
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
        "Give the test or the checklist. A paper test is printed here and typed in with its scan; a checked file is uploaded as evidence.",
      done: wsEligible.length > 0 && wsUnscored === 0,
      icon: IconChecklist,
    },
    {
      id: "ws-results",
      label: "Results",
      subtitle: `${wsPassed} passed · ${wsFailed} not passed`,
      description:
        "Type the score of each person in the row (the maximum score once, above the table) and save. When every result is in, the trainer finishes the training with a signature: the results are written in the list APD.0117. Then the trainer sends the results to QA.",
      done: !!activity.resultsFinishedAt,
      icon: IconTrophy,
    },
  ];
  // What still stops the attendance list from going to QA (the same two rules as the server): a session still to be held, a person not recorded yet.
  const attendanceBlockers = [
    [activity.sessions.filter((x) => x.status === "POSTPONED" || sessionNotStarted(x)).length, "session(s) still to be held"],
    [activity.participants.filter((x) => x.state === "INVITED").length, "person(s) still to be marked present or absent"],
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
          label: "Conducted on",
          value: wsSession.heldOn ? day(wsSession.heldOn) : "Not yet",
        },
        { icon: IconUser, label: "Trainer", value: trainerOf(wsSession) },
        ...(results && results.dueOn ? [{ icon: IconCalendar, label: "Results due to QA", value: day(results.dueOn) }] : []),
        {
          icon: IconMapPin,
          label: "Venue",
          value:
            wsSession.locationType === "ONLINE"
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
    { label: "on the list", value: wsPeople.length, icon: IconUsers, tone: "slate" },
    { label: "absent", value: wsAbsent, icon: IconUserX, tone: "amber" },
  ];
  const wsRates: WorkspaceRate[] = [
    {
      label: "Attendance",
      percent: wsPeople.length
        ? Math.round((wsPresent / wsPeople.length) * 100)
        : null,
      detail: `${wsPresent} of ${wsPeople.length} present`,
      tone: "emerald",
    },
    {
      label: "Pass rate",
      percent: wsPresent ? Math.round((wsPassed / wsPresent) * 100) : null,
      detail: `${wsPassed} of ${wsPresent} passed`,
      tone: "blue",
    },
  ];
  const refreshActivity = () => void run(() => trainingActivitiesApi.get(activity.id), "Updated");
  const wsContent = !workspace ? null : !wsSession ? (
    <p role="alert" className="text-sm text-red-700">
      This session was not found in the training activity.
    </p>
  ) : (
    <>
      {tab === "ws-results" && resultsNotice}
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
        <WorkspaceAttendanceStep scoped={wsScoped} caps={caps} onActivity={setActivity} table={groupTables(attendanceColumns)} />
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
      {tab === "ws-results" && (
        <WorkspaceResultsStep
          table={
            <WorkspaceResultsTable
              activityId={activity.id}
              people={wsPeople}
              passPercent={activity.passPercent}
              defaultMax={activity.assessment?.maxScore}
              locked={!!activity.resultsFinishedAt}
              canRecord={Boolean(caps?.recordAssessment)}
              canRelease={Boolean(caps?.recordAttendance)}
              onRelease={(participant) => setDialog({ type: "releaseExam", participant })}
              assessmentMethod={wsSession.assessmentMethod}
              onActivity={setActivity}
            />
          }
          absent={wsPeople.filter((p) => p.state === "ABSENT").length}
          failed={wsFailed}
          canArrange={Boolean(caps?.addSupplementary)}
          onArrange={() => setDialog({ type: "supplementary" })}
        />
      )}
    </>
  );

  // The end of the training, one button at a time, each shown by the server when its turn comes (capabilities): Finish Training once every result is in, then Send results to QA.
  const endButtons = (
    <>
      {caps?.finishTraining && (
        <Button
          size="sm"
          loading={busy}
          className="whitespace-nowrap"
          onClick={() =>
            signAction(
              "Finish the training",
              "TRAINING_RESULTS_FINISHED",
              "Training Finished by Trainer",
              (t) => trainingActivitiesApi.finishTraining(activity.id, activity.version, t),
              statusChange("Results recorded", "Training finished", "Training"),
            )
          }
        >
          Finish Training
        </Button>
      )}
      {caps?.submitForConfirmation && (
        <Button
          size="sm"
          loading={busy}
          className="whitespace-nowrap"
          onClick={() =>
            signAction(
              "Send results to QA",
              "TRAINING_SUBMITTED_FOR_CONFIRMATION",
              "Results Sent to QA",
              (t) => trainingActivitiesApi.submitForConfirmation(activity.id, activity.version, t),
              statusChange("In progress", "Pending QA Confirmation", "Training activity"),
            )
          }
        >
          Send results to QA
        </Button>
      )}
    </>
  );

  // The revisions of the documents that go with this Training Number and wait for "Complete Training" in Document Control (one button for each).
  const waitingRevisions = (activity.groupRevisions ?? []).filter((r) => r.revisionStatus === "PENDING_TRAINING");
  const footer = (
    <>
      {caps?.completeTraining && waitingRevisions.map((r) => (
        <Button
          key={r.revisionId}
          size="sm"
          className="whitespace-nowrap"
          onClick={() => navigate(`/documents/revisions/training/${r.revisionId}`)}
        >
          {waitingRevisions.length > 1 ? `Complete Training (${r.documentNumber})` : "Complete Training (Revision)"}
        </Button>
      ))}
      {caps?.cancel && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() => setDialog({ type: "cancel" })}
        >
          Cancel
        </Button>
      )}
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
                : "Open Workspace"}
            </Button>
          ))}
      {(caps?.edit || caps?.editRemarks) && formDirty && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          loading={busy}
          disabled={
            !form.trainingTitle.trim() ||
            (external && !form.trainingUnitName.trim())
          }
          onClick={() =>
            void run(
              () =>
                trainingActivitiesApi.update(activity.id, {
                  version: activity.version,
                  trainingTitle: form.trainingTitle.trim(),
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
          Save changes
        </Button>
      )}
      {caps?.reopenContent && (
        <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "reopenContent" })}>
          Reopen Content
        </Button>
      )}
      {caps?.returnForCorrection && (
        <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog({ type: "returnForCorrection" })}>
          Return for Correction
        </Button>
      )}
      {caps?.confirmList && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() =>
            signAction(
              "Confirm attendee list",
              "TRAINING_LIST_VERIFIED",
              "Attendance List Verified",
              (t) => trainingActivitiesApi.confirmList(activity.id, t),
              statusChange("Not confirmed", "Confirmed", "Attendee list"),
            )
          }
        >
          Confirm attendee list
        </Button>
      )}
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
              "Notify participants",
              "TRAINING_ACTIVITY_NOTIFIED",
              "Training Notified",
              (t) => trainingActivitiesApi.notify(activity.id, activity.version, t),
              statusChange("Planned", "Notified", "Training activity"),
            )
          }
        >
          Notify participants
        </Button>
      )}
      {hasSelfReading &&
        caps?.hold &&
        activity.participants.some(
          (p) => p.state === "READ_CONFIRMED" && p.result === "PENDING",
        ) && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
            onClick={() =>
              signAction(
                "Verify self-reading",
                "TRAINING_READ_VERIFIED",
                "Self-reading Verified",
                (t) => trainingActivitiesApi.verifySelfReading(activity.id, t),
                statusChange("Read and understood", "Verified", "Self-reading"),
              )
            }
          >
            Verify self-reading
          </Button>
        )}
      {endButtons}
      {caps?.confirmCompletion && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() =>
            signAction(
              "Confirm completion",
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
          Confirm completion
        </Button>
      )}
      {caps?.addSupplementary && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() => setDialog({ type: "supplementary" })}
        >
          Supplementary training
        </Button>
      )}
    </>
  );
  const cancelled = activity.status === "CANCELLED";
  const steps = cancelled
    ? [...ACTIVITY_STEPS.map((x) => x.label), STATUS_LABEL.CANCELLED]
    : ACTIVITY_STEPS.map((x) => x.label);
  // A cancelled activity shows how far it had come: the steps up to the one it was cancelled from are done, the ones after it are striped.
  const reachedBeforeCancel = ACTIVITY_STEPS.find((x) => x.status === activity.cancelledFromStatus) ?? ACTIVITY_STEPS[0];
  const stepIndex = cancelled
    ? steps.length - 1
    : Math.max(
        0,
        ACTIVITY_STEPS.findIndex((x) => x.status === activity.status),
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
              ? `S${wsSession.sessionNo}: ${wsSession.topics.map((tp) => tp.topicText).join("; ") || activity.trainingTitle}`
              : activity.trainingTitle
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
                if (activity.status === "NOTIFIED")
                  signAction(
                    "Start the training",
                    "TRAINING_SESSION_STARTED",
                    "Training Started",
                    async (t) => {
                      const started = await trainingActivitiesApi.holdSession(wsSession.id, t);
                      setTab(id);
                      return started;
                    },
                    statusChange("Notified", "In progress", "Training activity"),
                  );
                else void run(async () => { const started = await trainingActivitiesApi.holdSession(wsSession.id); setTab(id); return started; }, "Training started");
                return;
              }
            }
            setTab(id);
          }}
          headerActions={(
            <>
              <AttendanceListExport activityId={activity.id} trainingNumber={activity.trainingNumber} />
              {caps?.sendAttendanceList && (
                <Button
                  size="sm"
                  loading={busy}
                  disabled={attendanceBlockers.length > 0}
                  title={attendanceBlockers.length > 0 ? `Not ready to send the attendance list: ${attendanceBlockers.join("; ")}.` : undefined}
                  onClick={sendAttendanceList}
                >
                  Send attendance list to QA
                </Button>
              )}
              {endButtons}
            </>
          )}
          nextBlocked={tab === "ws-prepare" && prepPending > 0 ? `Tick all ${prepPending === 1 ? "the last line" : `${prepPending} lines`} first.` : undefined}
        >
          {notices}
          {wsContent}
        </TrainingSessionWorkspaceShell>
      ) : (
        <TrainingDetailLayout
          title={title}
          breadcrumbItems={trainingBreadcrumbs(navigate, "activities", title)}
          onBack={goBack}
          steps={steps}
          currentStepIndex={stepIndex}
          terminalProgressStep={reachedBeforeCancel.label}
          tabs={tabs}
          activeTab={tab}
          onTab={setTab}
          tabLayoutId="training-activity-detail-tab"
          footer={footer}
          repeatFooterInHeader={mode === "confirm" || mode === "conduct"}
        >
          {notices}
          {tab === "overview" && (
            <div className="space-y-6">
              {resultsNotice}
              {mode === "edit" && nextSteps}
              <ReadonlyGrid>
                <ReadonlyField
                  label="Training Number"
                  value={activity.trainingNumber}
                />
                <ReadonlyField
                  label="Type"
                  value={KIND_LABEL[activity.kind] ?? activity.kind}
                />
                <ReadonlyField label="Created Time" value={when(activity.createdAt)} />
                <ReadonlyField label="Opened By" value={activity.createdByName} />
                <ReadonlyField
                  label="Reason"
                  value={
                    activity.kindReason
                      ? (KIND_REASON_LABEL[activity.kindReason] ??
                        activity.kindReason)
                      : ""
                  }
                />
                {external && (
                  <ReadonlyField
                    label="External Training"
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
                      <FormField label="Training unit / individual" required>
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
                      <FormField label="Vendor Reference (SOP.0025)">
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
                        label="Training unit / individual"
                        value={activity.trainingUnitName}
                      />
                      <ReadonlyField
                        label="Vendor reference (SOP.0025)"
                        value={activity.vendorRef}
                      />
                    </>
                  ))}
                {caps?.edit ? (
                  <div className="md:col-span-2">
                    <FormField label="Training Title" required>
                      <Input
                        value={form.trainingTitle}
                        maxLength={255}
                        onChange={(e) =>
                          setDraft({ ...form, trainingTitle: e.target.value })
                        }
                      />
                    </FormField>
                  </div>
                ) : (
                  <ReadonlyField
                    label="Training Title"
                    value={activity.trainingTitle}
                    wide
                  />
                )}
                <ReadonlyField
                  label="Department"
                  value={activity.departmentName}
                />
                <ReadonlyField
                  label="Document"
                  value={
                    activity.documentNumber
                      ? `${activity.documentNumber}${activity.revisionNumber ? ` Rev ${activity.revisionNumber}` : ""}`
                      : ""
                  }
                />
                {(activity.groupRevisions ?? []).filter((r) => !r.isMain).length > 0 && (
                  <ReadonlyField
                    label="Related documents (same Training Number)"
                    value={(activity.groupRevisions ?? []).filter((r) => !r.isMain).map((r) => `${r.documentNumber}${r.revisionNumber ? ` Rev ${r.revisionNumber}` : ""}`).join(", ")}
                    wide
                  />
                )}
                {activity.attendanceSentAt && (
                  <ReadonlyField label="Attendance list sent to QA" value={`${activity.attendanceSentAt}${activity.attendanceSentByName ? ` by ${activity.attendanceSentByName}` : ""}`} />
                )}
                <ReadonlyField
                  label="Document Approved On"
                  value={day(activity.approvedOn)}
                />
                {caps?.edit ? (
                  <TrainingDateField
                    label="Due"
                    value={form.dueDate}
                    onChange={(v) => setDraft({ ...form, dueDate: v })}
                  />
                ) : (
                  <ReadonlyField label="Due" value={day(activity.dueDate)} />
                )}
                <ReadonlyField
                  label="Training Completed On"
                  value={day(activity.completedOn)}
                />
                {caps?.edit || caps?.editRemarks ? (
                  <div className="md:col-span-2">
                    <FormField label="Remarks">
                      <Textarea
                        rows={2}
                        value={form.remarks}
                        onChange={(e) =>
                          setDraft({ ...form, remarks: e.target.value })
                        }
                      />
                    </FormField>
                  </div>
                ) : (
                  <ReadonlyField
                    label="Remarks"
                    value={activity.remarks}
                    wide
                  />
                )}
                {activity.cancelReason && (
                  <ReadonlyField
                    label="Reason for Cancelling"
                    value={activity.cancelReason}
                    wide
                  />
                )}
              </ReadonlyGrid>
            </div>
          )}

          {tab === "sessions" && (
            <div className="space-y-4">
              {caps?.planSessions && (
                <SessionPanel
                  external={external}
                  busy={busy}
                  onSave={(body) =>
                    void run(
                      () => trainingActivitiesApi.addSession(activity.id, body),
                      "Session added",
                    )
                  }
                />
              )}
              {/* The paper pack and the preparation are tools of the person who organises: they are shown where that person works (planning, and before the first session is held);
                  elsewhere they would only be read, and the prints are in the Audit Trail. */}
              {(mode === "edit" || (mode === "conduct" && activity.status === "NOTIFIED")) && paperBlocks}
              {activity.sessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                  <p className="p-4 text-sm text-slate-500">
                      No session yet. Fill in the form above to add the first
                      one.
                      {(activity.proposedParticipantCount ?? 0) > 0 &&
                        ` ${activity.proposedParticipantCount} participant${activity.proposedParticipantCount === 1 ? " was" : "s were"} proposed when the document was prepared; they are put on the list of the first session, and you confirm the list.`}
                    </p>
                </div>
              ) : (
                <SessionDetails
                  sessions={activity.sessions}
                  external={external}
                  trainerOf={trainerOf}
                  trainerCheck={renderTrainerCheck}
                  actions={renderSessionActions}
                />
              )}
            </div>
          )}

          {tab === "participants" && (
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
                    Add a session first (tab Sessions): the people are added to
                    a session.
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
              {groups
                .filter((g) => g.rows.length > 0 || g.id === "employees")
                .map((g) => (
                  <TabBlock key={g.id} title={`${g.title} (${g.rows.length})`}>
                    <DataTable
                      rows={g.rows}
                      getRowKey={(p) => p.id}
                      columns={(monitoring ? columnsShown.filter((c) => c.id !== "actions") : columnsShown).filter((c) => !(singleSession && c.id === "session"))}
                      emptyState={
                        <p className="p-4 text-sm text-slate-500">
                          No participant yet.
                        </p>
                      }
                    />
                  </TabBlock>
                ))}
            </div>
          )}

          {tab === "approvals" &&
            !["edit", "review", "approve"].includes(mode) && (
              <SignatureFields records={signatureRecords} />
            )}

          {tab === "approvals" &&
            ["edit", "review", "approve"].includes(mode) && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  The person who prepares the training chooses who reviews and
                  approves the content. Only a person who holds the permission
                  for the step, in the right department, and who is not the
                  person who prepared it, can be chosen. The person chosen signs
                  with an electronic signature.
                </p>
                {external && (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-sm text-slate-600">
                    An external training has no content or test of its own, so
                    there is no review or approval of content. QA confirms the
                    completion.
                  </p>
                )}
                {(external
                  ? []
                  : ([
                      "CONTENT_REVIEW",
                      "CONTENT_APPROVE",
                    ] as TrainingApprovalStep[])
                ).map((step) => {
                  const assigned = stepAssignment(step);
                  const done = stepDone(
                    step === "CONTENT_REVIEW"
                      ? "CONTENT_REVIEWED"
                      : "CONTENT_APPROVED",
                  );
                  const rows = activity.approvers.filter(
                    (a) => a.stepCode === step,
                  );
                  return (
                    <TabBlock
                      key={step}
                      title={STEP_LABEL[step]}
                      action={
                        <div className="flex flex-wrap gap-2">
                          {!done &&
                            !assigned &&
                            caps?.designateApprovers &&
                            ["PLANNED", "NOTIFIED"].includes(
                              activity.status,
                            ) && (
                              <Button
                                size="sm"
                                variant="outline-emerald"
                                onClick={() =>
                                  setDialog({ type: "designate", step })
                                }
                              >
                                Designate
                              </Button>
                            )}
                          {!done &&
                            assigned &&
                            iAmAssigned(step) &&
                            mode ===
                              (step === "CONTENT_REVIEW"
                                ? "review"
                                : "approve") && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() =>
                                  signAction(
                                    step === "CONTENT_REVIEW"
                                      ? "Confirm review"
                                      : "Complete approval of the training content",
                                    step === "CONTENT_REVIEW"
                                      ? "TRAINING_CONTENT_REVIEWED"
                                      : "TRAINING_CONTENT_APPROVED",
                                    step === "CONTENT_REVIEW"
                                      ? "Training Content Reviewed"
                                      : "Training Content Approved",
                                    (t) =>
                                      trainingActivitiesApi.confirmContent(
                                        activity.id,
                                        step as
                                          | "CONTENT_REVIEW"
                                          | "CONTENT_APPROVE",
                                        t,
                                      ),
                                    step === "CONTENT_REVIEW"
                                      ? statusChange("Pending Review", "Reviewed", "Training content")
                                      : statusChange("Pending Approval", "Approved", "Training content"),
                                  )
                                }
                              >
                                {step === "CONTENT_REVIEW"
                                  ? "Sign review"
                                  : "Complete Approval"}
                              </Button>
                            )}
                        </div>
                      }
                    >
                      <DataTable
                        rows={rows}
                        getRowKey={(r) => r.id}
                        columns={
                          [
                            {
                              id: "rowNo",
                              header: "No.",
                              locked: true,
                              cell: (_r, i) => i + 1,
                            },
                            {
                              id: "who",
                              header: "Full Name",
                              cell: (r) => (
                                <TrainingPersonName
                                  fullName={r.assigneeName}
                                  avatar={r.avatar}
                                />
                              ),
                            },
                            {
                              id: "status",
                              header: "Status",
                              cell: (r) => r.status.toLowerCase(),
                            },
                            {
                              id: "at",
                              header: "Date",
                              cell: (r) => when(r.completedAt ?? r.assignedAt),
                            },
                          ] as DataTableColumn<(typeof rows)[number]>[]
                        }
                        emptyState={
                          <p className="p-4 text-sm text-slate-500">
                            {done ? "Done" : "No one designated yet."}
                          </p>
                        }
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
                        : "Pending QA confirmation."}
                  </p>
                </TabBlock>
              </div>
            )}

          {(tab === "materials" || tab === "assessment") && !external && (
            <ContentRulesPanel
              activity={activity}
              part={tab}
              canExempt={Boolean(caps?.setContentExemptions)}
              onExempt={(body) => run(() => trainingActivitiesApi.setContentExemptions(activity.id, body), "Saved")}
            />
          )}
          {tab === "assessment" && !external && (
            <TrainingAssessmentChoiceBlock activity={activity} editable={mode === "edit" && Boolean(caps?.chooseAssessment)} onChanged={setActivity} />
          )}
          {tab === "assessment" && !external && (
            <TrainingExamBlock
              activityId={activity.id}
              editable={mode === "edit" && (assessmentFormKind(activity) === "TEST" || assessmentFormKind(activity) === "BOTH") && !!activity.contentRules?.testRequired}
            />
          )}
          {(tab === "materials" || tab === "assessment") && (
            <TrainingActivityFilesTab
              key={tab}
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
      {dialog?.type === "reopenContent" && (
        <ReasonDialog
          title="Reopen the Training Content"
          help="The review and the approval that were given stay in the history but no longer count; the content must be reviewed and approved again. If the people were notified, the activity goes back to Planned and they are notified again after the new approval."
          confirmText="Continue"
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) => {
            setDialog(undefined);
            signAction(
              "Reopen the training content",
              "TRAINING_CONTENT_REOPENED",
              "Training Content Reopened",
              (t) => trainingActivitiesApi.reopenContent(activity.id, activity.version, reason, t),
              statusChange("Reviewed and approved", "Pending Review", "Training content"),
            );
          }}
        />
      )}
      {dialog?.type === "returnForCorrection" && (
        <ReasonDialog
          title="Return the Results for Correction"
          help="Nothing has been written to a personal record yet. The activity goes back to In progress, the organizer corrects and sends it to QA again."
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
              statusChange("Pending QA Confirmation", "In progress"),
            );
          }}
        />
      )}
      {dialog?.type === "cancel" && (
        <ReasonDialog
          title="Cancel Training Activity"
          help="The cancellation is signed. The Training Number is never used again. The reason stays in the record."
          confirmText="Cancel activity"
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
          help="The trainee may take the test once more. The reason stays in the Audit Trail."
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
          onClose={() => setDialog(undefined)}
          onSave={(date, reason) =>
            run(
              () =>
                trainingActivitiesApi.postponeSession(
                  dialog.session.id,
                  date,
                  reason,
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
      {dialog?.type === "designate" && (
        <DesignateDialog
          activityId={activity.id}
          step={dialog.step}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(personId) =>
            run(
              () =>
                trainingActivitiesApi.designate(
                  activity.id,
                  dialog.step,
                  personId,
                ),
              "Person designated",
            )
          }
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
          title="Reject Trainer Exception"
          help="The session cannot go ahead with this trainer unless another exception is approved."
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
          help="Only before the attendee list is confirmed. The name and the reason stay in the Audit Trail. After that, mark the person absent instead."
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
      {dialog?.type === "plannedAbsence" && (
        <ReasonDialog
          title={`Mark ${dialog.participant.fullName} Absent`}
          help="The person stays on the attendee list, as SOP.0003 5.3.4 requires. The reason is written on the row."
          confirmText="Mark absent"
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
          participants={activity.participants.filter(
            (p) => p.state === "ABSENT" || p.result === "FAILED",
          )}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(ids, reason) =>
            run(async () => {
              const created = await trainingActivitiesApi.supplementary(
                activity.id,
                ids,
                reason,
              );
              navigate(`/training-management/activities/${created.id}`);
              return created;
            }, "Supplementary training created")
          }
        />
      )}
      <ESignatureModal
        isOpen={!!sign}
        onClose={() => setSign(undefined)}
        onConfirm={async (data: { signatureToken: string }) => {
          if (!sign) return;
          const ok = await run(() => sign.run(data.signatureToken), SIGNED_DONE[sign.meaningCode] ?? sign.title);
          if (ok) setSign(undefined);
        }}
        actionTitle={sign?.title}
        changes={sign?.changes}
        meaningDisplayName={sign?.meaningName}
        meaningCode={sign?.meaningCode}
        targetDetails={{
          code: activity.trainingNumber,
          title: activity.trainingTitle,
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
      <FormField label="Reason" required>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
    </FormModal>
  );
}

function PostponeDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (date: string, reason: string) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => onSave(date, reason.trim())}
      title="Postpone Session"
      description="The Training Number stays. The old date, the new date and the reason are recorded."
      confirmText="Postpone"
      isLoading={busy}
      confirmDisabled={!date || !reason.trim()}
      size="md"
    >
      <div className="grid gap-4">
        <TrainingDateField label="New date" value={date} onChange={setDate} />
        <FormField label="Reason" required>
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
        <FormField label="Attendance" required>
          <Select
            value={state}
            enableSearch={false}
            onChange={(v) => setState(v)}
            options={[
              { label: "Attended", value: "ATTENDED" },
              { label: "Attended online", value: "ONLINE" },
              { label: "Absent", value: "ABSENT" },
            ]}
          />
        </FormField>
        {state === "ABSENT" && (
          <FormField label="Reason for absence" required>
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
      description="Use this only for a mistake. The old value, the new value and your reason stay in the Audit Trail. It cannot be changed after the person has a score."
      confirmText="Confirm"
      isLoading={busy}
      confirmDisabled={state === current || !reason.trim()}
      size="md"
      onConfirm={() => onSave(state, reason.trim())}
    >
      <div className="grid gap-4">
        <FormField label="Attendance now">
          <Input value={PARTICIPANT_STATE_LABEL[current] ?? current} disabled />
        </FormField>
        <FormField label="Correct attendance" required>
          <Select
            value={state}
            enableSearch={false}
            onChange={(v) => setState(v)}
            options={[
              { label: "Attended", value: "ATTENDED" },
              { label: "Attended online", value: "ONLINE" },
              { label: "Absent", value: "ABSENT" },
            ]}
          />
        </FormField>
        <FormField label="Reason for the correction" required>
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
      description="Enter the score. The system works out the percentage and the result from the pass mark in force."
      confirmText="Save"
      isLoading={busy}
      confirmDisabled={!valid}
      size="md"
      onConfirm={() =>
        onSave(Number(got), Number(max), remarks.trim() || undefined)
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Score Obtained" required>
          <Input
            type="number"
            min={0}
            value={got}
            onChange={(e) => setGot(e.target.value)}
          />
        </FormField>
        <FormField label="Maximum Score" required>
          <Input
            type="number"
            min={1}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </FormField>
        <div className="col-span-2">
          <FormField label="Remarks">
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

function DesignateDialog({
  activityId,
  step,
  busy,
  onClose,
  onSave,
}: {
  activityId: string;
  step: TrainingApprovalStep;
  busy: boolean;
  onClose: () => void;
  onSave: (personId: string) => void;
}) {
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [personId, setPersonId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const search = useCallback(
    async (query: string) => {
      const page = await trainingActivitiesApi.eligibleApprovers(
        activityId,
        step,
        query,
      );
      setPeople(page.data);
      setLoaded(true);
      return page.data.map((p) => ({
        label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
        value: p.id,
      }));
    },
    [activityId, step],
  );
  useEffect(() => {
    void search("");
  }, [search]);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={`Designate: ${STEP_LABEL[step]}`}
      description="Only people the system found eligible for this step are listed."
      confirmText="Designate"
      isLoading={busy}
      confirmDisabled={!personId}
      size="md"
      onConfirm={() => onSave(personId)}
    >
      {loaded && people.length === 0 ? (
        <p className="text-sm text-amber-700">
          No eligible person was found. A person needs the permission of the
          step in this department and cannot be the person who prepared the
          activity.
        </p>
      ) : (
        <Select
          label="Person"
          value={personId}
          onChange={setPersonId}
          options={people.map((p) => ({
            label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
            value: p.id,
          }))}
          onSearch={search}
          placeholder="Search by name"
        />
      )}
    </FormModal>
  );
}

function SupplementaryDialog({
  participants,
  busy,
  onClose,
  onSave,
}: {
  participants: TrainingParticipant[];
  busy: boolean;
  onClose: () => void;
  onSave: (ids: string[], reason: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title="Supplementary Training"
      description="A new activity is created under the same number with the next letter. People who were absent or failed are listed."
      confirmText="Create"
      isLoading={busy}
      confirmDisabled={selected.length === 0 || !reason.trim()}
      size="md"
      onConfirm={() => onSave(selected, reason.trim())}
    >
      {participants.length === 0 ? (
        <p className="text-sm text-slate-600">No one was absent or failed.</p>
      ) : (
        <div className="grid gap-3">
          {participants.map((p) => (
            <Checkbox
              key={p.id}
              checked={selected.includes(p.id)}
              onChange={(c) =>
                setSelected(
                  c
                    ? [...selected, p.id]
                    : selected.filter((id) => id !== p.id),
                )
              }
              label={`${p.fullName} — ${p.state === "ABSENT" ? "absent" : "failed"}`}
            />
          ))}
          <FormField label="Reason" required>
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
      title="Request an Exception for the Trainer"
      description="The session goes ahead with this trainer only if the person you choose approves, with a signature."
      confirmText="Request"
      isLoading={busy}
      confirmDisabled={!reason.trim() || !id}
      size="md"
    >
      <div className="grid gap-4">
        <FormField label="Reason" required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        {loaded && people.length === 0 ? (
          <p className="text-sm text-amber-700">
            No eligible approver was found.
          </p>
        ) : (
          <Select
            label="Approver"
            value={id}
            onChange={setId}
            options={people.map((p) => ({
              label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
              value: p.id,
            }))}
            onSearch={search}
            placeholder="Search by name"
          />
        )}
      </div>
    </FormModal>
  );
}
