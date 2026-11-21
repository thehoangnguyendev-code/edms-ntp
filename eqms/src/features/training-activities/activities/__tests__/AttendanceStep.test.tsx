import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const status = vi.fn();
const openCheckIn = vi.fn();
const closeCheckIn = vi.fn();

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/services/api/trainingActivities", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/trainingActivities")>("@/services/api/trainingActivities");
  return {
    ...actual,
    trainingCheckInApi: { status: (...a: unknown[]) => status(...a), open: (...a: unknown[]) => openCheckIn(...a), close: (...a: unknown[]) => closeCheckIn(...a) },
    trainingActivitiesApi: { ...actual.trainingActivitiesApi, get: vi.fn() },
  };
});
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({ ESignatureModal: () => null }));

import { WorkspaceAttendanceStep } from "../components/workspace/WorkspaceAttendanceStep";
import { TrainingAttendanceRow } from "../components/TrainingAttendanceRow";

const person = (id: string, state: string) => ({ id, sessionId: "s1", state, fullName: id });
const activity = {
  id: "a1", trainingNumber: "TRN/QA/26-952",
  sessions: [{ id: "s1", sessionNo: 1, status: "PLANNED", heldOn: "2026-10-31" }],
  participants: [person("p1", "ATTENDED"), person("p2", "ATTENDED"), person("p3", "INVITED"), person("p4", "INVITED"), person("p5", "ABSENT"), person("p6", "INVITED")],
};
const caps = { rollCall: true } as never;
const open = { open: true, code: "482915", secondsLeft: 222, checkedIn: 2, invited: 3 };

const renderStep = (over: Partial<{ reading: boolean; activity: unknown }> = {}) => render(
  <WorkspaceAttendanceStep scoped={(over.activity ?? activity) as never} caps={caps} reading={over.reading} onActivity={vi.fn()} table={<div>THE LIST</div>} />,
);

describe("Attendance step: the check-in panel beside the list", () => {
  beforeEach(() => { vi.clearAllMocks(); status.mockResolvedValue(open); });

  it("shows the code, the people present out of all, and the quick roll-call in one panel", async () => {
    renderStep();
    // the digits are sliding columns; the code is read out from the hidden text
    expect((await screen.findByLabelText("Check-in code")).querySelector(".sr-only")?.textContent).toBe("482915");
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "People present in the session" }).getAttribute("aria-valuenow")).toBe("2");
    expect(screen.getByText("3 still to mark")).toBeTruthy();
    expect(screen.getByText("1 absent")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quick roll-call" })).toBeTruthy();
    expect(screen.getByText("THE LIST")).toBeTruthy();
  });

  it("offers to open the check-in when it is closed", async () => {
    status.mockResolvedValue({ open: false, checkedIn: 0, invited: 3 });
    openCheckIn.mockResolvedValue(open);
    renderStep();
    expect(await screen.findByText("Closed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open the check-in" }));
    await waitFor(() => expect(openCheckIn).toHaveBeenCalledWith("s1"));
  });

  it("opens the QR in a sheet on a phone, and closes the check-in from it", async () => {
    closeCheckIn.mockResolvedValue({ open: false, checkedIn: 2, invited: 3 });
    renderStep();
    await screen.findByLabelText("Check-in code");
    fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
    const closers = await screen.findAllByRole("button", { name: "Close the check-in" });
    fireEvent.click(closers[closers.length - 1]);
    await waitFor(() => expect(closeCheckIn).toHaveBeenCalledWith("s1"));
  });

  it("draws no panel before a session is held, and none for a self-reading", () => {
    renderStep({ activity: { ...activity, sessions: [{ id: "s1", sessionNo: 1, status: "PLANNED", heldOn: null }] } });
    expect(screen.queryByText("Self check-in")).toBeNull();
    expect(screen.getByText("THE LIST")).toBeTruthy();
  });

  it("draws no panel for a self-reading", () => {
    renderStep({ reading: true });
    expect(screen.queryByText("Self check-in")).toBeNull();
  });
});

describe("Attendance row", () => {
  it("keeps the other actions behind the menu button on a phone, and the main one beside the name", () => {
    render(<ul><TrainingAttendanceRow name="Le Hoang Minh" meta="EMP-0078 · QC Laboratory" status={<span>Invited</span>} actions={<button>All actions</button>}
      quickAction={<button>Mark</button>} moreActions={<button>Correct Attendance</button>} /></ul>);
    expect(screen.getByText("EMP-0078 · QC Laboratory")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark" })).toBeTruthy();
    expect(screen.queryAllByText("Correct Attendance")).toHaveLength(0);
    const more = screen.getByRole("button", { name: "More actions for Le Hoang Minh" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Correct Attendance" })).toBeTruthy();
  });

  it("draws no menu button when there are no other actions", () => {
    render(<ul><TrainingAttendanceRow name="Vo Thi Mai" meta="EMP-0133" status={<span>Absent</span>} actions={null} /></ul>);
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
  });
});
