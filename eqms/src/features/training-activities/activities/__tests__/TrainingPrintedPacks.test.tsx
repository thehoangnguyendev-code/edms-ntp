import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { TrainingPrintedPacks } from "../components/TrainingPaperBlock";

vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
const api = vi.hoisted(() => ({ packs: vi.fn(), markCopy: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingPaperApi: api }));

const pack = (n: number, status: string, scans = 0) => ({
  id: `p${n}`, sessionId: "s1", sessionNo: 1, packKind: "ATTENDANCE", packCode: `TRN/QA/26-1/S1/P${n}`, copyNo: n, pageCount: 1, peopleCount: 1, printedByName: "Trainer",
  printedAt: "2026-10-30T10:00:00Z", reason: null, scanCount: scans, status, statusAt: null, statusReason: null, statusByName: "Trainer",
});
const show = () => render(<ToastProvider><TrainingPrintedPacks activity={{ id: "a1", trainingNumber: "TRN/QA/26-1" } as never} onChanged={() => undefined} /></ToastProvider>);

afterEach(cleanup);

describe("Printed packs", () => {
  it("numbers the rows, and an Issued copy offers only Lost and Void (it returns by its scan)", async () => {
    api.packs.mockResolvedValue([pack(1, "ISSUED"), pack(2, "RETURNED", 1)]);
    show();
    await waitFor(() => expect(screen.getByText("TRN/QA/26-1/S1/P1")).toBeTruthy());
    expect(screen.getByRole("columnheader", { name: "No." })).toBeTruthy();
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getAllByRole("cell")[0].textContent).toBe("1");
    expect(within(rows[1]).getAllByRole("cell")[0].textContent).toBe("2");
    expect(within(rows[0]).getByRole("button", { name: "Lost" })).toBeTruthy();
    expect(within(rows[0]).getByRole("button", { name: "Void" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Returned" })).toBeNull();
    expect(within(rows[1]).getByText("Returned")).toBeTruthy();
  });

  it("draws nothing when nothing was printed", async () => {
    api.packs.mockResolvedValue([]);
    const { container } = show();
    await waitFor(() => expect(api.packs).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
