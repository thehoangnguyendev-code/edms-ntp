import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ assessment: vi.fn() }));
const files = vi.hoisted(() => ({ list: vi.fn(), uploadEvidence: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingActivitiesApi: api, trainingFilesApi: files }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../../../shared/TrainingScannedTestsModal", () => ({ TrainingScannedTestsModal: () => <div>SCANNED TESTS</div> }));

import { WorkspaceResultsTable } from "../WorkspaceResultsTable";
import type { TrainingParticipant } from "@/services/api/trainingActivities";

const person = (n: number, over: Partial<TrainingParticipant> = {}): TrainingParticipant => ({
  id: `p${n}`, sessionId: "s1", personUserId: `u${n}`, fullName: `Trainee ${n}`, employeeCode: `E-${n}`, department: "QA", state: "ATTENDED", result: "PENDING", ...over,
});
const props = (people: TrainingParticipant[], over: Record<string, unknown> = {}) => ({
  activityId: "a1", people, passPercent: 80, locked: false, canRecord: true, canRelease: false, onRelease: vi.fn(), assessmentMethod: "TEST", onActivity: vi.fn(), ...over,
});
const score = (n: number) => screen.getByLabelText(`Score of Trainee ${n}`) as HTMLInputElement;
const maxField = () => screen.getByLabelText("Maximum score of the test") as HTMLInputElement;

beforeEach(() => {
  api.assessment.mockReset();
  files.list.mockReset();
  files.list.mockResolvedValue({ evidence: [], canUploadEvidence: true });
});
afterEach(cleanup);

describe("Results typed in the row of each person", () => {
  it("shows the pass mark of Training Properties as the server sends it, and the result of a typed score with that mark", async () => {
    render(<WorkspaceResultsTable {...props([person(1), person(2)])} />);
    expect(await screen.findByText("80%")).toBeTruthy();
    fireEvent.change(maxField(), { target: { value: "10" } });
    fireEvent.change(score(1), { target: { value: "8" } });
    fireEvent.change(score(2), { target: { value: "7" } });
    expect(screen.getByText(/Pass \(80%\)/)).toBeTruthy();
    expect(screen.getByText(/Not passed \(70%\)/)).toBeTruthy();
  });

  it("takes no score when the server sent no pass mark: nothing is invented", async () => {
    render(<WorkspaceResultsTable {...props([person(1)], { passPercent: undefined })} />);
    await waitFor(() => expect(files.list).toHaveBeenCalled());
    expect(screen.queryByLabelText("Score of Trainee 1")).toBeNull();
  });

  it("starts with an empty maximum score and keeps the one already saved", async () => {
    const { unmount } = render(<WorkspaceResultsTable {...props([person(1)])} />);
    expect(maxField().value).toBe("");
    unmount();
    render(<WorkspaceResultsTable {...props([person(1), person(2, { result: "PASSED", lastScore: 9, lastMax: 20, lastPercent: 45 })])} />);
    expect(maxField().value).toBe("20");
  });

  it("refuses a score above the maximum and does not save", async () => {
    render(<WorkspaceResultsTable {...props([person(1)])} />);
    fireEvent.change(maxField(), { target: { value: "10" } });
    fireEvent.change(score(1), { target: { value: "11" } });
    expect((screen.getByRole("button", { name: /Save all/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(score(1), { key: "Enter" });
    expect(api.assessment).not.toHaveBeenCalled();
  });

  it("saves only the rows that were typed with Save all, and leaves the others open for later", async () => {
    api.assessment.mockResolvedValue({ id: "a1" });
    const onActivity = vi.fn();
    render(<WorkspaceResultsTable {...props([person(1), person(2), person(3)], { onActivity })} />);
    fireEvent.change(maxField(), { target: { value: "10" } });
    fireEvent.change(score(1), { target: { value: "9" } });
    fireEvent.change(score(3), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Save all \(2\)/ }));
    await waitFor(() => expect(api.assessment).toHaveBeenCalledTimes(2));
    expect(api.assessment).toHaveBeenNthCalledWith(1, "p1", 9, 10);
    expect(api.assessment).toHaveBeenNthCalledWith(2, "p3", 5, 10);
    expect(api.assessment).not.toHaveBeenCalledWith("p2", expect.anything(), expect.anything());
    await waitFor(() => expect(onActivity).toHaveBeenCalledTimes(2));
    // the second person is still there to be typed
    expect(score(2).value).toBe("");
  });

  it("stops at the first refusal and keeps the rows that were not saved", async () => {
    api.assessment.mockRejectedValueOnce({ response: { data: { message: "TRAINING_ALREADY_FINISHED" } } });
    render(<WorkspaceResultsTable {...props([person(1), person(2)])} />);
    fireEvent.change(maxField(), { target: { value: "10" } });
    fireEvent.change(score(1), { target: { value: "9" } });
    fireEvent.change(score(2), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /Save all/ }));
    await waitFor(() => expect(api.assessment).toHaveBeenCalledTimes(1));
    expect(score(1).value).toBe("9");
    expect(score(2).value).toBe("8");
  });

  it("takes no entry after the training is finished", async () => {
    render(<WorkspaceResultsTable {...props([person(1, { result: "PASSED", lastScore: 9, lastMax: 10, lastPercent: 90 })], { locked: true })} />);
    await waitFor(() => expect(files.list).toHaveBeenCalled());
    expect(screen.queryByLabelText("Score of Trainee 1")).toBeNull();
    expect(screen.queryByRole("button", { name: /Save all/ })).toBeNull();
    expect(screen.getByText("9 / 10")).toBeTruthy();
  });

  it("does not offer a score for a person who was absent, and a person who passed keeps the score as text", async () => {
    render(<WorkspaceResultsTable {...props([person(1, { state: "ABSENT", absenceReason: "On leave" }), person(2, { result: "PASSED", lastScore: 8, lastMax: 10, lastPercent: 80 })])} />);
    await waitFor(() => expect(files.list).toHaveBeenCalled());
    expect(screen.queryByLabelText("Score of Trainee 1")).toBeNull();
    expect(screen.queryByLabelText("Score of Trainee 2")).toBeNull();
    expect(screen.getByText("Absent: On leave")).toBeTruthy();
  });
});
