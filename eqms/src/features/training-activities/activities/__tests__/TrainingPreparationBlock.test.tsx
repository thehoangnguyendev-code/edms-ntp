import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const get = vi.fn();
const update = vi.fn();
const changeMode = vi.fn();
const ask = vi.fn();
let hasPrint = false;

vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/services/api/trainingActivities", () => ({
  trainingPreparationApi: { get: (...a: unknown[]) => get(...a), update: (...a: unknown[]) => update(...a) },
  trainingError: (e: unknown) => String(e),
}));
vi.mock("../components/TrainingPaperBlock", () => ({
  DELIVERY_LABEL: { ELECTRONIC: "Electronic", PAPER: "Paper", MIXED: "Mixed" },
  useTrainingPaper: () => ({ hasPrint: () => hasPrint, ask, changeMode, printed: () => 0, printedExam: () => 0, busy: false, dialog: null }),
}));

import { TrainingPreparationBlock } from "../components/TrainingPreparationBlock";

const sessions = (statuses: string[]) => [{
  sessionId: "s1",
  sessionNo: 1,
  items: ["VENUE", "EQUIPMENT", "MATERIALS", "NOTICE"].map((itemCode, i) => ({ itemCode, status: statuses[i] })),
}];
const activity = { id: "a1", status: "PLANNED", contentRules: null, sessions: [{ id: "s1", sessionNo: 1, deliveryMode: "ELECTRONIC", status: "PLANNED" }] };

const renderBlock = (canManage = true) => render(
  <TrainingPreparationBlock activityId="a1" sessionId="s1" canManage={canManage} paper={{ activity: activity as never, canPrint: true, onChanged: vi.fn() }} />,
);

describe("Prepare step checklist", () => {
  beforeEach(() => { vi.clearAllMocks(); hasPrint = false; get.mockResolvedValue(sessions(["DONE", "PENDING", "PENDING", "DONE"])); });

  it("says how many lines are ready and ticks by the checkbox, with no Status column", async () => {
    update.mockResolvedValue(sessions(["DONE", "DONE", "PENDING", "DONE"]));
    renderBlock();
    expect(await screen.findByText("2 of 4 ready")).toBeTruthy();
    expect(screen.queryByRole("columnheader")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Equipment for practice" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("s1", "EQUIPMENT", { status: "DONE" }));
    expect(await screen.findByText("3 of 4 ready")).toBeTruthy();
  });

  it("chooses the delivery with radio buttons and changes it when nothing was printed", async () => {
    renderBlock();
    const group = await screen.findByRole("radiogroup", { name: "Delivery of session 1" });
    expect(group).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Electronic" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Paper" }));
    expect(changeMode).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), "PAPER");
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks first when the session already has a print, and locks the radios for a person who cannot manage", async () => {
    hasPrint = true;
    const { unmount } = renderBlock();
    fireEvent.click(await screen.findByRole("radio", { name: "Mixed" }));
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ kind: "mode", mode: "MIXED" }));
    expect(changeMode).not.toHaveBeenCalled();
    unmount();
    renderBlock(false);
    expect((await screen.findByRole("radio", { name: "Paper" }) as HTMLInputElement).getAttribute("aria-disabled")).toBe("true");
  });
});
