import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), overview: vi.fn(), participantPage: vi.fn(), people: vi.fn() }));
const files = vi.hoisted(() => ({ list: vi.fn(), personEvidenceFile: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => {
  const original = await importOriginal<{ trainingFilesApi: object }>();
  return { ...original, trainingActivitiesApi: api, trainingDocumentSourcesApi: { get: async () => ({ documents: [], sessionDefaults: null }) }, trainingFilesApi: { ...original.trainingFilesApi, ...files } };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true, hasPermissionAlias: () => true }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => <div>audit</div> }));
vi.mock("../components/TrainingPaperBlock", async (importOriginal) => ({ ...(await importOriginal<object>()), TrainingPrintedPacks: () => <div>PAPER BLOCK</div> }));
vi.mock("../components/TrainingPreparationBlock", () => ({ TrainingPreparationBlock: () => <div>PREPARATION BLOCK</div> }));
vi.mock("../components/TrainingTranscriptionBlock", () => ({ TrainingTranscriptionBlock: () => <div>TRANSCRIPTION BLOCK</div> }));
vi.mock("../components/TrainingExamBlock", () => ({ TrainingExamBlock: () => <div>EXAM BLOCK</div> }));
vi.mock("../components/TrainingActivityFilesTab", () => ({ TrainingActivityFilesTab: ({ mode }: { mode: string }) => <div>FILES TAB mode={mode}</div> }));

import { withParticipantSummary } from "./trainingQueryFixture";

const installQueryMocks = () => {
  api.overview.mockImplementation(async () => withParticipantSummary(await api.get()));
  api.participantPage.mockImplementation(async (_id, query) => {
    const a = await api.get();
    const rows = a.participants.filter((p: { sessionId: string; personUserId?: string; state: string; plannedAbsence?: string }) => (!query.sessionId || p.sessionId === query.sessionId) && (query.group === "ALL" ? true : query.group === "EMPLOYEES" ? p.personUserId && p.state !== "ABSENT" && !(p.state === "INVITED" && p.plannedAbsence) : query.group === "ABSENT" ? p.personUserId && (p.state === "ABSENT" || (p.state === "INVITED" && p.plannedAbsence)) : !p.personUserId));
    return { data: rows, pagination: { total: rows.length, totalPages: 1 } };
  });
};

import { TrainingActivityDetailPage } from "../TrainingActivityDetailPage";

const session = (n: number, status = "HELD") => ({
  id: `s${n}`, sessionNo: n, status, scheduledOn: "2026-10-20", heldOn: status === "HELD" ? "2026-10-20" : null, method: "CLASSROOM", deliveryMode: "PAPER",
  assessmentMethod: "TEST", locationType: "ONSITE", venue: "Room 3", trainerUserId: "trainer-1", trainerName: "Tina Trainer", topics: [{ id: `t${n}`, topicText: `Topic ${n}` }],
  trainerQualification: { applies: false, qualified: true, reasons: [] },
});
const person = (n: number, sessionId: string, state: string, result: string) => ({
  id: `p${n}`, sessionId, personUserId: `u${n}`, fullName: `Trainee ${n}`, employeeCode: `E-${n}`, department: "Quality Assurance", state, result, attempts: 1,
});

const activity = (status: string) => ({
  id: "a1", trainingNumber: "TRN/QA/26-070", trainingTopics: "Self check-in screen", status, kind: "UNPLANNED", kindReason: "OTHER", version: 3,
  departmentName: "Quality Assurance", createdAt: "2026-10-20T07:35:46Z", createdByName: "Admin", dueDate: null, approvedOn: null, completedOn: null,
  sessions: [session(1), session(2, "PLANNED")],
  participants: [person(1, "s1", "ATTENDED", "PASSED"), person(2, "s1", "ABSENT", "PENDING")],
  confirmations: [], approvers: [], qaList: null, resultsToQa: null, proposedParticipantCount: 0, cancelledFromStatus: null,
  capabilities: { hold: true, adjustPlan: true, rollCall: true, printPaper: true, transcribe: true, addSupplementary: true },
});

const renderPage = (status: string) => {
  api.get.mockResolvedValue(activity(status));
  return render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={["/training-management/activities/a1/conduct"]}>
        <Routes>
          <Route path="/training-management/activities/:activityId/conduct" element={<TrainingActivityDetailPage mode="conduct" />} />
        </Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
};
const openTab = async (name: RegExp) => fireEvent.click(await screen.findByRole("tab", { name }));

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(api).forEach(f => f.mockReset());
  Object.values(files).forEach(f => f.mockReset());
  files.list.mockResolvedValue({ materials: [], evidence: [], canUploadMaterial: false, canSeeAnswerKey: false, canUploadEvidence: false, canReceive: false });
  installQueryMocks();
});
afterEach(cleanup);

describe("Conduct Training of a training in progress", () => {
  it("shows the sessions without the paper pack and the preparation, and without extra lines (the buttons of the workspace are in the foot of the page)", async () => {
    renderPage("IN_PROGRESS");
    await openTab(/^General Information/);

    expect(await screen.findByText("Topic 1")).toBeTruthy();
    expect(screen.queryByText(/The work of a session is done in its Session Workspace/)).toBeNull();
    expect(screen.queryByText(/of 2 present/)).toBeNull();
    expect(screen.queryByText("PAPER BLOCK")).toBeNull();
    expect(screen.queryByText("PREPARATION BLOCK")).toBeNull();
    // one button for each session, in the foot of the page and beside the title
    expect(screen.getAllByRole("button", { name: "Open Workspace: session 1" }).length).toBe(2);
  });

  it("lists the participants without the actions of attendance and results, and without typing results from paper", async () => {
    renderPage("IN_PROGRESS");
    await openTab(/^Participants/);

    expect(await screen.findByText("Trainee 1")).toBeTruthy();
    expect(screen.queryByText("TRANSCRIPTION BLOCK")).toBeNull();
    expect(screen.queryByRole("button", { name: /Record result|Mark absent|Correct/ })).toBeNull();
  });

  it("shows the evidence of the assessment read only", async () => {
    renderPage("IN_PROGRESS");
    await openTab(/^Assessment/);

    expect(await screen.findByText("FILES TAB mode=view")).toBeTruthy();
  });
});

describe("Conduct Training before the training is in progress", () => {
  it("keeps the paper pack and the preparation of the sessions in the General Information tab", async () => {
    renderPage("NOTIFIED");
    await openTab(/^General Information/);

    await waitFor(() => expect(screen.getByText("PAPER BLOCK")).toBeTruthy());
    expect(screen.getByText("PREPARATION BLOCK")).toBeTruthy();
    expect(screen.queryByText(/The work of a session is done in its Session Workspace/)).toBeNull();
  });
});

describe("Sessions (General Information tab)", () => {
  it("shows each session as the form that created it, read only, and not as a table", async () => {
    renderPage("NOTIFIED");
    await openTab(/^General Information/);

    // each session is a card, the same card as on New Training Activity: the topic, the place, the trainer, the mode, with its count in the title
    expect(await screen.findByText("Topic 1")).toBeTruthy();
    expect(screen.getAllByText("Room 3").length).toBe(2);
    expect(screen.getAllByText("Tina Trainer").length).toBe(2);
    expect(screen.getByRole("region", { name: "Session 1" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Session 2" })).toBeTruthy();
    expect(screen.queryAllByRole("columnheader").length).toBe(0);
  });
});

describe("Training Activity Details (view)", () => {
  it("does not show the paper pack and the preparation: nobody works on them there", async () => {
    api.get.mockResolvedValue(activity("IN_PROGRESS"));
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/training-management/activities/a1"]}>
          <Routes>
            <Route path="/training-management/activities/:activityId" element={<TrainingActivityDetailPage mode="view" />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    await openTab(/^General Information/);

    expect(await screen.findByText("Topic 1")).toBeTruthy();
    expect(screen.queryByText("PAPER BLOCK")).toBeNull();
    expect(screen.queryByText("PREPARATION BLOCK")).toBeNull();
  });
});

describe("Training Activity Details of an activity with one session", () => {
  const renderView = () => {
    api.get.mockResolvedValue({ ...activity("IN_PROGRESS"), sessions: [session(1)] });
    return render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/training-management/activities/a1"]}>
          <Routes>
            <Route path="/training-management/activities/:activityId" element={<TrainingActivityDetailPage mode="view" />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
  };

  it("shows the session without a status badge, and the participants without the choice of a session, the Session column or the paper results", async () => {
    renderView();
    await openTab(/^General Information/);
    expect(await screen.findByText("Topic 1")).toBeTruthy();
    expect(screen.queryByText("held")).toBeNull();

    await openTab(/^Participants/);
    expect(await screen.findByText("Trainee 1")).toBeTruthy();
    expect(screen.queryByText(/All \(2\)/)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Session" })).toBeNull();
    expect(screen.queryByText("TRANSCRIPTION BLOCK")).toBeNull();
  });
});

describe("Training Activity in Planned (edit)", () => {
  it("offers the organizer the checkbox of the Training Materials: the capability is kept by the screen", async () => {
    api.get.mockResolvedValue({ ...activity("PLANNED"), capabilities: { edit: true, setContentExemptions: true }, contentRules: { materialsRequired: true, materialsSatisfied: false, materialsSource: "NONE", testRequired: false, checklistRequired: false, assessmentFormSatisfied: false, inherited: false, missing: ["TRAINING_MATERIALS_REQUIRED"] } });
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/training-management/activities/a1/edit"]}>
          <Routes>
            <Route path="/training-management/activities/:activityId/edit" element={<TrainingActivityDetailPage mode="edit" />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    await openTab(/^Training Materials/);

    expect(await screen.findByText(/Required before the content is approved: a file or a link/)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Required Training Materials?" })).toBeTruthy();
  });

  it("does not ask for the topic twice: with a session the form of another one opens on request, in the Add session dialog", async () => {
    api.get.mockResolvedValue({ ...activity("PLANNED"), capabilities: { edit: true, planSessions: true } });
    api.people.mockResolvedValue([]);
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/training-management/activities/a1/edit"]}>
          <Routes>
            <Route path="/training-management/activities/:activityId/edit" element={<TrainingActivityDetailPage mode="edit" />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );

    const another = await screen.findByRole("button", { name: "Add session" });
    expect(screen.queryByPlaceholderText(/What will be taught/)).toBeNull();
    fireEvent.click(another);
    expect(await screen.findByPlaceholderText(/What will be taught/)).toBeTruthy();
  });
});

describe("Retraining of a person who failed, from a finished activity", () => {
  // A failed person does not stop the activity from being completed; the retraining is a new activity with the next letter, arranged from the finished one.
  const renderDetails = (status: string, mode: "view" | "confirm", capabilities: Record<string, boolean>) => {
    api.get.mockResolvedValue({ ...activity(status), supplementaryPending: 1, supplementaryBlocked: 0, capabilities });
    return render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/training-management/activities/a1"]}>
          <Routes>
            <Route path="/training-management/activities/:activityId" element={<TrainingActivityDetailPage mode={mode} />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
  };

  it("offers Supplementary Training in the header beside Back and in the foot, on a Completed activity", async () => {
    renderDetails("COMPLETED", "view", { addSupplementary: true });
    await openTab(/^General Information/);

    expect(await screen.findAllByRole("button", { name: "Supplementary Training" })).toHaveLength(2);
    expect(screen.queryByText(/have no supplementary training yet/)).toBeNull();
  });

  it("does not offer it before the activity is Completed (the people who failed do not stop the completion)", async () => {
    renderDetails("PENDING_QA_CONFIRMATION", "confirm", { addSupplementary: true, confirmCompletion: true });
    await openTab(/^General Information/);

    expect((await screen.findAllByRole("button", { name: "Confirm Completion" })).length).toBeGreaterThan(0);
    expect(screen.queryByText(/have no supplementary training yet/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Supplementary Training" })).toBeNull();
  });

  it("opens the dialog at once when the list menu sends the person here", async () => {
    api.get.mockResolvedValue({ ...activity("COMPLETED"), supplementaryPending: 1, supplementaryBlocked: 0, supplementaryCandidates: [], capabilities: { addSupplementary: true } });
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[{ pathname: "/training-management/activities/a1", state: { openSupplementary: true } }]}>
          <Routes>
            <Route path="/training-management/activities/:activityId" element={<TrainingActivityDetailPage mode="view" />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("shows no button to a person who may not organize", async () => {
    renderDetails("COMPLETED", "view", { addSupplementary: false });
    await openTab(/^General Information/);

    expect((await screen.findAllByRole("button", { name: "Back" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Supplementary Training" })).toBeNull();
  });
});

describe("Results in Training Activity Details", () => {
  const renderDetails = (status: string, mode: "view" | "participate" = "view") => {
    api.get.mockResolvedValue({
      ...activity(status), passPercent: 70, assessment: { maxScore: 20 },
      participants: [{ ...person(1, "s1", "ATTENDED", "FAILED"), lastScore: 10, lastMax: 20, lastPercent: 50 }, { ...person(2, "s1", "ATTENDED", "PASSED"), lastScore: 18, lastMax: 20, lastPercent: 90 }],
      capabilities: { recordAssessment: true, recordAttendance: true },
    });
    return render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/training-management/activities/a1"]}>
          <Routes>
            <Route path="/training-management/activities/:activityId" element={<TrainingActivityDetailPage mode={mode} />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
  };

  const scan = (participantId: string) => ({ id: `e-${participantId}`, kind: "ASSESSMENT", originalName: `${participantId}-paper.PDF`, sizeBytes: 1200, sha256: "x", uploadedAt: "2026-10-20T08:00:00Z", participantId, uploadedByName: "Admin", contentType: "application/pdf" });

  it("lists the score, the result and the scan file of everyone under the command buttons, in a sub tab, not in the tabs of the page", async () => {
    files.list.mockResolvedValue({ materials: [], evidence: [scan("p1")], canUploadMaterial: false, canSeeAnswerKey: false, canUploadEvidence: false, canReceive: false });
    renderDetails("PENDING_QA_CONFIRMATION");

    // the scan is named Training Number, employee code, name (here with the extension of the uploaded file)
    expect(await screen.findByText("TRN-QA-26-070_E-1_Trainee 1.pdf")).toBeTruthy();
    expect(screen.getByText("10 / 20 (50%)")).toBeTruthy();
    expect(screen.getByText("18 / 20 (90%)")).toBeTruthy();
    expect(screen.getByText("Not passed")).toBeTruthy();
    expect(screen.getByText("Passed")).toBeTruthy();
    // the sub tab is below the Back and command buttons, and the page has no tab of that name any more
    const subTab = screen.getByRole("tab", { name: /^Results/ });
    const backButtons = screen.getAllByRole("button", { name: "Back" });
    expect(backButtons.at(-1)!.compareDocumentPosition(subTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("tab", { name: /^Results/ })).toHaveLength(1);
    // nothing can be typed, saved or uploaded there: the results are written in the Session Workspace
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("button", { name: /Upload the scan/ })).toBeNull();
  });

  it("offers View Scan and Download Scan in the menu of a person who has a scan, and nothing to a person who has none", async () => {
    files.list.mockResolvedValue({ materials: [], evidence: [scan("p1")], canUploadMaterial: false, canSeeAnswerKey: false, canUploadEvidence: false, canReceive: false });
    renderDetails("COMPLETED");
    await screen.findByText("TRN-QA-26-070_E-1_Trainee 1.pdf");

    expect(screen.queryByRole("button", { name: "Actions for the scan of Trainee 2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Actions for the scan of Trainee 1" }));
    expect(await screen.findByText("View Scan")).toBeTruthy();
    expect(screen.getByText("Download Scan")).toBeTruthy();
  });

  it("has no results card before the training starts, nor for a person who only takes part", async () => {
    renderDetails("NOTIFIED");
    await screen.findByRole("tab", { name: /^Participants/ });
    expect(screen.queryByRole("tab", { name: /^Results/ })).toBeNull();
    cleanup();

    renderDetails("COMPLETED", "participate");
    await screen.findByRole("tab", { name: /^Participants/ });
    expect(screen.queryByRole("tab", { name: /^Results/ })).toBeNull();
  });
});
