import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), overview: vi.fn(), participantPage: vi.fn(), sendAttendanceList: vi.fn(), finishTraining: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: api }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true, hasPermissionAlias: () => true }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => <div>audit</div> }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, actionTitle, onConfirm }: { isOpen: boolean; actionTitle?: string; onConfirm: (d: { signatureToken: string }) => void }) =>
    isOpen ? <button onClick={() => onConfirm({ signatureToken: "tok" })}>SIGN: {actionTitle}</button> : null,
}));
vi.mock("../components/AttendanceListExport", () => ({ AttendanceListExport: () => <button>Training Attendance List</button> }));
vi.mock("../components/workspace/WorkspacePrepareStep", () => ({ WorkspacePrepareStep: () => <div>PREPARE</div> }));
vi.mock("../components/workspace/WorkspaceAttendanceStep", () => ({ WorkspaceAttendanceStep: () => <div>ATTENDANCE</div> }));
vi.mock("../components/workspace/WorkspaceTrainingStep", () => ({ WorkspaceTrainingStep: () => <div>TRAINING</div> }));
vi.mock("../components/workspace/WorkspaceAssessmentStep", () => ({ WorkspaceAssessmentStep: () => <div>ASSESSMENT</div> }));
vi.mock("../components/workspace/WorkspaceResultsTable", () => ({ WorkspaceResultsTable: () => <div>RESULTS TABLE</div> }));

import { withParticipantSummary } from "./trainingQueryFixture";

const installQueryMocks = () => {
  api.overview.mockImplementation(async () => withParticipantSummary(await api.get()));
  api.participantPage.mockImplementation(async (_id, query) => {
    const a = await api.get();
    const rows = a.participants.filter((p: { sessionId: string; personUserId?: string; state: string; plannedAbsence?: string }) => (!query.sessionId || p.sessionId === query.sessionId) && (query.group === "EMPLOYEES" ? p.personUserId && p.state !== "ABSENT" && !(p.state === "INVITED" && p.plannedAbsence) : query.group === "ABSENT" ? p.personUserId && (p.state === "ABSENT" || (p.state === "INVITED" && p.plannedAbsence)) : !p.personUserId));
    return { data: rows, pagination: { total: rows.length, totalPages: 1 } };
  });
};

import { TrainingActivityDetailPage } from "../TrainingActivityDetailPage";

const session = { id: "s1", sessionNo: 1, status: "PLANNED", scheduledOn: "2026-10-20", heldOn: "2026-10-20", method: "CLASSROOM", deliveryMode: "PAPER", assessmentMethod: "TEST", locationType: "ONSITE", venue: "Room 3", trainerUserId: "t1", trainerName: "Tina Trainer", topics: [{ id: "t", topicText: "Topic" }], trainerQualification: { applies: false, qualified: true, reasons: [] } };
const person = (n: number, state: string, result: string) => ({ id: `p${n}`, sessionId: "s1", personUserId: `u${n}`, fullName: `Trainee ${n}`, employeeCode: `E-${n}`, department: "QA", state, result });
const activity = (over: Record<string, unknown> = {}, caps: Record<string, unknown> = {}, people = [person(1, "ATTENDED", "PENDING"), person(2, "ABSENT", "PENDING")]) => ({
  id: "a1", trainingNumber: "TRN/QA/26-099", trainingTopics: "End buttons", status: "IN_PROGRESS", kind: "UNPLANNED", kindReason: "OTHER", version: 5, departmentName: "QA", createdAt: "2026-10-20T07:00:00Z", createdByName: "Admin",
  sessions: [session], participants: people, confirmations: [], approvers: [], qaList: null, resultsToQa: null, proposedParticipantCount: 0, passPercent: 70,
  capabilities: { sendAttendanceList: false, finishTraining: false, ...caps }, ...over,
});

const renderWorkspace = (a: object) => {
  api.get.mockResolvedValue(a);
  return render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={["/training-management/activities/a1/sessions/s1/workspace?step=ws-attendance"]}>
        <Routes>
          <Route path="/training-management/activities/:activityId/sessions/:sessionId/workspace" element={<TrainingActivityDetailPage mode="conduct" workspaceSessionId="s1" />} />
        </Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
};
const button = (name: string) => screen.queryByRole("button", { name });

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Object.values(api).forEach((f) => f.mockReset());
  installQueryMocks();
});
afterEach(cleanup);

describe("The end of the training in the Session Workspace: one button at a time, in order", () => {
  it("shows no Confirm attendance button at all", async () => {
    renderWorkspace(activity({}, { sendAttendanceList: true }, [person(1, "ATTENDED", "PENDING"), person(2, "ABSENT", "PENDING")]));
    await screen.findByRole("button", { name: "Send attendance list to QA" });
    expect(button("Confirm attendance")).toBeNull();
  });

  it("Send attendance list to QA is not shown while someone is not recorded, and appears once everyone is", async () => {
    const waiting = renderWorkspace(activity({}, { sendAttendanceList: true }, [person(1, "ATTENDED", "PENDING"), person(2, "INVITED", "PENDING")]));
    await screen.findAllByRole("button", { name: /Back/ });
    expect(button("Send attendance list to QA")).toBeNull();
    waiting.unmount();
    renderWorkspace(activity({}, { sendAttendanceList: true }));
    const on = (await screen.findByRole("button", { name: "Send attendance list to QA" })) as HTMLButtonElement;
    expect(on.disabled).toBe(false);
    expect(button("Finish Training")).toBeNull();
  });

  it("the trainer signs, and the list goes: the answer of the server replaces the screen", async () => {
    api.sendAttendanceList.mockImplementation(async () => {
      const updated = activity({ attendanceSentAt: "24 Oct 2026" }, { finishTraining: false });
      api.get.mockResolvedValue(updated);
      return updated;
    });
    renderWorkspace(activity({}, { sendAttendanceList: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Send attendance list to QA" }));
    fireEvent.click(await screen.findByRole("button", { name: /SIGN: Send attendance list to QA/ }));
    await waitFor(() => expect(api.sendAttendanceList).toHaveBeenCalledWith("a1", 5, "tok"));
    await waitFor(() => expect(button("Send attendance list to QA")).toBeNull());
  });

  it("after the list is sent only Finish Training shows (there is no separate Send results step), once the server says every result is in", async () => {
    renderWorkspace(activity({ attendanceSentAt: "24 Oct 2026" }, { finishTraining: true }));
    await screen.findByRole("button", { name: "Finish Training" });
    expect(button("Send attendance list to QA")).toBeNull();
  });

  it("while results are missing, Finish Training does not show", async () => {
    renderWorkspace(activity({ attendanceSentAt: "24 Oct 2026" }, {}));
    await screen.findByRole("button", { name: "Training Attendance List" });
    expect(button("Finish Training")).toBeNull();
    expect(button("Send attendance list to QA")).toBeNull();
  });

  it("Finish Training asks for ONE signature, calls the server once, and nothing more is offered: the results went to QA with it", async () => {
    api.finishTraining.mockImplementation(async () => {
      const updated = activity({ status: "PENDING_QA_CONFIRMATION", attendanceSentAt: "24 Oct 2026", resultsFinishedAt: "24 Oct 2026" }, {});
      api.get.mockResolvedValue(updated);
      return updated;
    });
    renderWorkspace(activity({ attendanceSentAt: "24 Oct 2026" }, { finishTraining: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Finish Training" }));
    fireEvent.click(await screen.findByRole("button", { name: /SIGN: Finish the training and send the results to QA/ }));
    await waitFor(() => expect(api.finishTraining).toHaveBeenCalledWith("a1", 5, "tok"));
    expect(api.finishTraining).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button("Finish Training")).toBeNull());
  });

  it("the outside screen Conduct Training does not carry Finish Training: it is only in the Session Workspace", async () => {
    api.get.mockResolvedValue(activity({ attendanceSentAt: "24 Oct 2026" }, { finishTraining: true }));
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/training-management/activities/a1/conduct"]}>
          <Routes><Route path="/training-management/activities/:activityId/conduct" element={<TrainingActivityDetailPage mode="conduct" />} /></Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    await screen.findAllByRole("button", { name: /Back/ });
    expect(button("Finish Training")).toBeNull();
  });

  it("a refusal from the server leaves the button where it was and reports nothing as done", async () => {
    api.finishTraining.mockRejectedValue({ response: { status: 409, data: { message: "TRAINING_RESULT_PENDING" } } });
    renderWorkspace(activity({ attendanceSentAt: "24 Oct 2026" }, { finishTraining: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Finish Training" }));
    fireEvent.click(await screen.findByRole("button", { name: /SIGN: Finish the training/ }));
    await waitFor(() => expect(api.finishTraining).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Finish Training" })).toBeTruthy();
  });

  it("the end of the story: nothing is offered once the results are sent", async () => {
    renderWorkspace(activity({ status: "PENDING_QA_CONFIRMATION", attendanceSentAt: "24 Oct 2026", resultsFinishedAt: "24 Oct 2026" }, {}));
    await screen.findByRole("button", { name: "Training Attendance List" });
    expect(button("Finish Training")).toBeNull();
    expect(button("Send attendance list to QA")).toBeNull();
  });
});
