import { TrainingPersonName } from "../shared/TrainingPersonName";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
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
  type WorkspaceNext,
  type WorkspaceRate,
  type WorkspaceStat,
  type WorkspaceStep,
} from "./components/TrainingSessionWorkspaceShell";
import { WorkspacePrepareStep } from "./components/workspace/WorkspacePrepareStep";
import { WorkspaceAttendanceStep } from "./components/workspace/WorkspaceAttendanceStep";
import { WorkspaceTrainingStep } from "./components/workspace/WorkspaceTrainingStep";
import { WorkspaceAssessmentStep } from "./components/workspace/WorkspaceAssessmentStep";
import { WorkspaceResultsStep } from "./components/workspace/WorkspaceResultsStep";
import { TrainingExamBlock } from "./components/TrainingExamBlock";
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

const ACTIVITY_STEPS = [
  { status: "RESERVED", label: "Waiting for approval" },
  { status: "PLANNED", label: "Planned" },
  { status: "NOTIFIED", label: "Notified" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "PENDING_QA_CONFIRMATION", label: "Waiting for QA confirmation" },
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
  conduct: "today",
  review: "materials",
  approve: "materials",
  confirm: "overview",
  participate: "participants",
};
const MODE_CAPS: Record<ActivityMode, string[]> = {
  view: [],
  edit: [
    "edit",
    "planSessions",
    "adjustPlan",
    "addParticipants",
    "removeParticipants",
    "confirmList",
    "designateApprovers",
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
    "addSupplementary",
    "cancel",
  ],
  review: [],
  approve: [],
  confirm: ["confirmCompletion"],
  participate: [],
};
const limitCaps = (
  raw: TrainingCapabilities,
  mode: ActivityMode,
): TrainingCapabilities => {
  const allowed = new Set(MODE_CAPS[mode]);
  const out: Record<string, unknown> = { ...raw };
  for (const key of Object.keys(out))
    if (key !== "notifyBlockers" && !allowed.has(key)) out[key] = false;
  return out as unknown as TrainingCapabilities;
};

type Dialog =
  | { type: "cancel" }
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
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);
  const [pSession, setPSession] = useState(workspaceSessionId ?? "");
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
      mode === "conduct"
        ? [
            { id: "today", label: "Overview" },
            {
              id: "sessions",
              label: "Sessions",
              count: activity?.sessions.length,
            },
            { id: "materials", label: "Training Materials" },
            { id: "audit", label: "Audit Trail" },
          ]
        : [
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
    [mode, activity?.sessions.length, activity?.participants.length],
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

  /** The workspace of one session opens in a new tab, so the person can keep the activity open beside it. */
  const openWorkspace = (sessionId: string) =>
    window.open(
      `/training-management/activities/${activity.id}/sessions/${sessionId}/workspace`,
      "_blank",
      "noopener",
    );
  /** The real name of the trainer; only an external activity with no name given shows the generic label. */
  const trainerOf = (s: TrainingSession) =>
    s.trainerName?.trim() ||
    s.externalTrainerName?.trim() ||
    (activity.kind === "EXTERNAL" ? "External Trainer" : "—");
  const sessionColumns: DataTableColumn<TrainingSession>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "no", header: "Session", cell: (s) => s.sessionNo },
    {
      id: "topics",
      header: "Topics",
      cell: (s) => (
        <div className="max-w-80 whitespace-normal">
          {s.topics.map((t) => t.topicText).join("; ")}
        </div>
      ),
    },
    {
      id: "method",
      header: "Method",
      cell: (s) => (s.method ? (METHOD_LABEL[s.method] ?? s.method) : "—"),
    },
    {
      id: "delivery",
      header: "Delivery",
      cell: (s) => DELIVERY_LABEL[s.deliveryMode ?? "ELECTRONIC"],
    },
    {
      id: "assessment",
      header: "Assessment",
      cell: (s) =>
        s.assessmentMethod
          ? (ASSESSMENT_LABEL[s.assessmentMethod] ?? s.assessmentMethod)
          : "—",
    },
    { id: "trainer", header: "Trainer", cell: (s) => trainerOf(s) },
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
                s.status === "PLANNED" &&
                caps?.adjustPlan && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDialog({ type: "trainerException", session: s })
                    }
                  >
                    Request exception
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
                          statusChange("Waiting for approval", "Approved", "Trainer exception"),
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
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
      },
    },
    {
      id: "location",
      header: "Location",
      cell: (s) =>
        s.locationType === "ONLINE" ? (
          <div className="max-w-60 whitespace-normal">
            {s.onlinePlatform}:{" "}
            <a
              href={s.meetingLink ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-emerald-600 hover:underline"
            >
              {s.meetingLink}
            </a>
          </div>
        ) : (
          (s.venue ?? "—")
        ),
    },
    { id: "scheduled", header: "Scheduled", cell: (s) => day(s.scheduledOn) },
    { id: "held", header: "Held", cell: (s) => day(s.heldOn) },
    {
      id: "status",
      header: "Status",
      cell: (s) => (
        <Badge color={s.status === "HELD" ? "emerald" : "slate"}>
          {s.status.toLowerCase()}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: (s) =>
        s.status === "PLANNED" && (caps?.hold || caps?.adjustPlan) ? (
          <div className="flex flex-wrap gap-2">
            {s.status === "PLANNED" && caps?.hold && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() =>
                  void run(
                    () => trainingActivitiesApi.holdSession(s.id),
                    "Session held",
                  )
                }
              >
                Mark as held
              </Button>
            )}
            {s.status === "PLANNED" && caps?.adjustPlan && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialog({ type: "postpone", session: s })}
              >
                Postpone
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

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
            variant="outline"
            onClick={() =>
              void run(
                () => trainingActivitiesApi.setPlannedAbsence(p.id, ""),
                "Absence cleared",
              )
            }
          >
            Clear absence
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDialog({ type: "plannedAbsence", participant: p })
            }
          >
            Mark absent
          </Button>
        ))}
      {scope !== "results" &&
        caps?.removeParticipants &&
        p.state === "INVITED" && (
          <Button
            size="sm"
            variant="outline"
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
            variant="outline"
            onClick={() =>
              setDialog({ type: "correctAttendance", participant: p })
            }
          >
            Correct attendance
          </Button>
        )}
      {scope !== "results" &&
        caps?.recordAttendance &&
        p.state === "INVITED" &&
        sessionOf(p.sessionId)?.status === "HELD" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialog({ type: "attendance", participant: p })}
          >
            Mark attendance
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
            Record result
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
            {p.examState === "OPEN" ? "Continue the test" : "Take the test"}
          </Button>
        )}
      {scope !== "attendance" &&
        caps?.recordAttendance &&
        p.examState === "USED" &&
        p.result === "PENDING" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialog({ type: "releaseExam", participant: p })}
          >
            Release the test
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
                title: "Confirm self-reading",
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
    { id: "actions", header: "", cell: (p) => renderActions(p, "all") },
  ];
  const attendanceColumns: DataTableColumn<TrainingParticipant>[] = [
    ...participantColumns.filter((c) =>
      ["rowNo", "code", "name", "department", "session", "state"].includes(
        c.id,
      ),
    ),
    { id: "actions", header: "", cell: (p) => renderActions(p, "attendance") },
  ];
  const resultColumns: DataTableColumn<TrainingParticipant>[] = [
    ...participantColumns.filter((c) =>
      ["rowNo", "name", "session", "state", "result", "attempts"].includes(
        c.id,
      ),
    ),
    { id: "actions", header: "", cell: (p) => renderActions(p, "results") },
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
        userId={user?.id}
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
  const conductToday = (
    <div className="space-y-4">
      <ReadonlyGrid>
        <ReadonlyField
          label="Training Number"
          value={activity.trainingNumber}
        />
        <ReadonlyField label="Training Title" value={activity.trainingTitle} />
        <ReadonlyField label="Department" value={activity.departmentName} />
        <ReadonlyField label="Due" value={day(activity.dueDate)} />
      </ReadonlyGrid>
      {activity.sessions.length > 0 && (
        <TabBlock title="Sessions">
          <ul className="divide-y divide-slate-100">
            {activity.sessions.map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-slate-900">
                    Session {x.sessionNo}
                  </span>
                  <span className="text-slate-600">
                    {" "}
                    · {x.topics.map((tp) => tp.topicText).join("; ") ||
                      "—"} · {day(x.scheduledOn)}
                  </span>
                </div>
                <Badge color={x.status === "HELD" ? "emerald" : "slate"}>
                  {x.status.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </TabBlock>
      )}
    </div>
  );

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
  // Two notices that guide the manual part of the procedure: the day the list goes to QA (SOP.0003 5.3.6) and the approved vendor list for an outside trainer (SOP.0025).
  const notices = open ? (
    <div className="mb-4 space-y-2 empty:hidden">
      {mode === "conduct" &&
        !workspace &&
        activity.status === "IN_PROGRESS" && (
          <p
            role="status"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            The training has started. The title, due date, content, materials,
            test and approvers are fixed. You can hold sessions, record
            attendance and results, and add scans. The attendee list is not
            changed: a person who is not on it is trained in a supplementary training or a new
            unplanned training (SOP.0003 5.3.4). Attendance recorded by mistake
            is corrected with a reason.
          </p>
        )}
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
          {
            done: stepDone("CONTENT_REVIEWED") && stepDone("CONTENT_APPROVED"),
            text: "Designate who reviews and approves the content (tab Approvers); add the materials and the exam (tabs Training Materials and Assessment)",
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
  const wsHeld = wsSession?.status === "HELD";
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
      subtitle: wsHeld ? `Held ${day(wsSession?.heldOn)}` : "Not held yet",
      description:
        "Check the session, print the paper pack if the session is on paper, and mark the session as held when it takes place.",
      done: wsHeld,
      icon: IconClipboardCheck,
    },
    {
      id: "ws-attendance",
      label: "Attendance",
      subtitle: `${wsPresent} of ${wsPeople.length} present`,
      description:
        "Record who came: with the code or the QR, with the quick roll-call, or one by one. A mistake is corrected with a reason.",
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
        "See the result of each person, record a missing one, or release a test for another try. When all is recorded, send it to QA.",
      done: wsEligible.length > 0 && wsUnscored === 0,
      icon: IconTrophy,
    },
  ];
  const wsNext: WorkspaceNext | null = !wsSession
    ? null
    : wsSession.status === "PLANNED"
      ? {
          text: "Mark the session as held when it takes place.",
          tone: "go",
          action: caps?.hold
            ? {
                label: "Mark as held",
                loading: busy,
                onClick: () =>
                  void run(
                    () => trainingActivitiesApi.holdSession(wsSession.id),
                    "Session held",
                  ),
              }
            : undefined,
        }
      : wsSession.status !== "HELD"
        ? {
            text: `The session is ${wsSession.status.toLowerCase()}.`,
            tone: "wait",
          }
        : wsPending > 0
          ? {
              text: `${wsPending} ${wsPending === 1 ? "person is" : "people are"} still to be marked present or absent.`,
              tone: "go",
              action: {
                label: "Go to attendance",
                onClick: () => setTab("ws-attendance"),
              },
            }
          : wsUnscored > 0
            ? {
                text: `${wsUnscored} ${wsUnscored === 1 ? "person has" : "people have"} no result yet.`,
                tone: "go",
                action: {
                  label: "Go to assessment",
                  onClick: () => setTab("ws-assessment"),
                },
              }
            : activity.status !== "IN_PROGRESS"
              ? { text: "The results were sent to QA.", tone: "done" }
              : activity.sessions.some((x) =>
                    ["PLANNED", "POSTPONED"].includes(x.status),
                  )
                ? {
                    text: "Everything is recorded for this session. Other sessions of this training are still to be held; send to QA when all are done.",
                    tone: "done",
                    action: {
                      label: "Back to Conduct Training",
                      onClick: () =>
                        navigate(
                          `/training-management/activities/${activity.id}/conduct`,
                        ),
                    },
                  }
                : {
                    text: "Everything is recorded. Send the attendance list and the results to QA.",
                    tone: "done",
                    action: caps?.submitForConfirmation
                      ? {
                          label: "Send to QA",
                          loading: busy,
                          onClick: () =>
                            void run(
                              () =>
                                trainingActivitiesApi.submitForConfirmation(
                                  activity.id,
                                  activity.version,
                                ),
                              "Sent to QA",
                            ),
                        }
                      : undefined,
                  };
  const wsFactList = wsSession
    ? [
        {
          icon: IconCalendar,
          label: "Scheduled",
          value: day(wsSession.scheduledOn),
        },
        {
          icon: IconCalendar,
          label: "Held",
          value: wsSession.heldOn ? day(wsSession.heldOn) : "Not yet",
        },
        { icon: IconUser, label: "Trainer", value: trainerOf(wsSession) },
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
          label: "Method",
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
      {tab === "ws-prepare" && (
        <WorkspacePrepareStep
          activityId={activity.id}
          scoped={wsScoped}
          session={wsSession}
          caps={caps}
          busy={busy}
          userId={user?.id}
          onHold={() => void run(() => trainingActivitiesApi.holdSession(wsSession.id), "Session held")}
          onPostpone={() => setDialog({ type: "postpone", session: wsSession })}
          onChanged={refreshActivity}
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
      {tab === "ws-results" && <WorkspaceResultsStep table={groupTables(resultColumns)} />}
    </>
  );

  // What still stops the list from going to QA: the same three rules the server checks when the button is pressed.
  const submitBlockers = [
    [activity.sessions.filter((x) => ["PLANNED", "POSTPONED"].includes(x.status)).length, "session(s) still to be held"],
    [activity.participants.filter((x) => x.state === "INVITED" && !x.plannedAbsence).length, "person(s) still to be marked present or absent"],
    [activity.participants.filter((x) => ["ATTENDED", "ONLINE", "READ_CONFIRMED"].includes(x.state) && x.result === "PENDING").length, "person(s) without a result"],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, text]) => `${n} ${text}`);

  const footer = (
    <>
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
                ? `Open workspace: session ${x.sessionNo}`
                : "Open workspace"}
            </Button>
          ))}
      {caps?.edit && formDirty && (
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
            void run(
              () => trainingActivitiesApi.notify(activity.id, activity.version),
              "Participants notified",
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
      {caps?.submitForConfirmation && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          loading={busy}
          disabled={submitBlockers.length > 0}
          title={submitBlockers.length > 0 ? `Not ready to send to QA: ${submitBlockers.join("; ")}.` : undefined}
          onClick={() =>
            void run(
              () =>
                trainingActivitiesApi.submitForConfirmation(
                  activity.id,
                  activity.version,
                ),
              "Sent to QA",
            )
          }
        >
          Send to QA
        </Button>
      )}
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
              statusChange("Waiting for QA confirmation", "Completed"),
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
    ? [...ACTIVITY_STEPS.map((x) => x.label), "Cancelled"]
    : ACTIVITY_STEPS.map((x) => x.label);
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
                  {
                    label:
                      wsSession.status === "HELD"
                        ? "Session held"
                        : `Session ${wsSession.status.toLowerCase()}`,
                    color: wsSession.status === "HELD" ? "emerald" : "slate",
                  },
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
          onStep={setTab}
          next={wsNext}
        >
          {notices}
          {wsContent}
        </TrainingSessionWorkspaceShell>
      ) : (
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
          repeatFooterInHeader={mode === "confirm" || mode === "conduct"}
        >
          {notices}
          {tab === "overview" && (
            <div className="space-y-6">
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
                <ReadonlyField
                  label="Approved On"
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
                  label="Completed On"
                  value={day(activity.completedOn)}
                />
                {caps?.edit ? (
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
              {mode !== "conduct" && paperBlocks}
              <TabBlock title="Sessions">
                <DataTable
                  rows={activity.sessions}
                  getRowKey={(s) => s.id}
                  columns={sessionColumns}
                  emptyState={
                    <p className="p-4 text-sm text-slate-500">
                      No session yet. Fill in the form above to add the first
                      one.
                      {(activity.proposedParticipantCount ?? 0) > 0 &&
                        ` ${activity.proposedParticipantCount} participant${activity.proposedParticipantCount === 1 ? " was" : "s were"} proposed when the document was prepared; they are put on the list of the first session, and you confirm the list.`}
                    </p>
                  }
                />
              </TabBlock>
            </div>
          )}

          {mode === "conduct" && !workspace && tab === "today" && conductToday}

          {tab === "participants" && mode !== "conduct" && (
            <div className="space-y-6">
              {sessionChips}
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
              {mode === "view" && (
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
                      columns={columnsShown}
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
                                      ? statusChange("Waiting for review", "Reviewed", "Training content")
                                      : statusChange("Waiting for approval", "Approved", "Training content"),
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
                        : "Waiting for QA."}
                  </p>
                </TabBlock>
              </div>
            )}

          {tab === "assessment" && !external && (
            <TrainingExamBlock
              activityId={activity.id}
              editable={mode === "edit"}
            />
          )}
          {(tab === "materials" || tab === "assessment") && (
            <TrainingActivityFilesTab
              key={tab}
              part={tab}
              mode={mode}
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

      {dialog?.type === "cancel" && (
        <ReasonDialog
          title="Cancel training activity"
          help="The Training Number is never used again. The reason stays in the record."
          confirmText="Cancel activity"
          destructive
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason) =>
            run(
              () =>
                trainingActivitiesApi.cancel(
                  activity.id,
                  activity.version,
                  reason,
                ),
              "Activity cancelled",
            )
          }
        />
      )}
      {dialog?.type === "releaseExam" && (
        <ReasonDialog
          title={`Release the test for ${dialog.participant.fullName}`}
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
          title="Reject trainer exception"
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
          title={`Mark ${dialog.participant.fullName} absent`}
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
          const ok = await run(() => sign.run(data.signatureToken), sign.title);
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
      title="Postpone session"
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
      title={`Correct the attendance of ${participant.fullName}`}
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
        <FormField label="Score obtained" required>
          <Input
            type="number"
            min={0}
            value={got}
            onChange={(e) => setGot(e.target.value)}
          />
        </FormField>
        <FormField label="Maximum score" required>
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
      title="Supplementary training"
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
      title="Request an exception for the trainer"
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
