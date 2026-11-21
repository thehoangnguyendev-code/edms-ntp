import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const get = vi.fn();
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/services/api/trainingActivities", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/trainingActivities")>("@/services/api/trainingActivities");
  return { ...actual, trainingExamApi: { ...actual.trainingExamApi, get: (...a: unknown[]) => get(...a) } };
});

import { TrainingExamBlock } from "../components/TrainingExamBlock";

const exam = {
  canEdit: false, canSeeKey: true, minutes: 20,
  questions: [{ id: "q1", qNo: 1, kind: "SINGLE", prompt: "Which area needs Grade A?", points: 2, options: [{ id: "A", text: "Filling zone" }, { id: "B", text: "Corridor" }], correct: ["A"] }],
};

describe("Test in the system block", () => {
  beforeEach(() => get.mockResolvedValue(exam));

  it("marks the right answer for a person who may see the key", async () => {
    render(<TrainingExamBlock activityId="a1" editable={false} />);
    expect(await screen.findByText("Right")).toBeTruthy();
  });

  it("never shows the right answer in the Session Workspace, even to a person who may see the key", async () => {
    render(<TrainingExamBlock activityId="a1" editable={false} hideKey />);
    expect(await screen.findByText(/Which area needs Grade A[?]/)).toBeTruthy();
    expect(screen.queryByText("Right")).toBeNull();
    // the Workspace shows the question, its kind and points, and not even the choices
    expect(screen.queryByText("Filling zone")).toBeNull();
    expect(screen.getByText(/One right answer · 2 pt/)).toBeTruthy();
  });

  it("keeps the long explanation out of the page, behind the help button", async () => {
    render(<TrainingExamBlock activityId="a1" editable={false} hideKey />);
    await screen.findByText(/Which area needs Grade A[?]/);
    expect(screen.queryByText(/graded automatically/)).toBeNull();
    expect(screen.getByRole("button", { name: "About Test in the system" })).toBeTruthy();
  });
});

describe("Test in the system block: summary", () => {
  it("tells the screen how many questions it holds, and nothing when it has none", async () => {
    const onSummary = vi.fn();
    get.mockResolvedValue(exam);
    const { unmount } = render(<TrainingExamBlock activityId="a1" editable={false} hideKey onSummary={onSummary} />);
    await screen.findByText(/Which area needs Grade A[?]/);
    expect(onSummary).toHaveBeenLastCalledWith(1);
    unmount();
    const none = vi.fn();
    get.mockResolvedValue({ ...exam, questions: [] });
    render(<TrainingExamBlock activityId="a1" editable={false} hideKey onSummary={none} />);
    await vi.waitFor(() => expect(none).toHaveBeenLastCalledWith(undefined));
  });
});
