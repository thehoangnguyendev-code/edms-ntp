import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { TrainingScanBatchUpload } from "../components/TrainingScanBatchUpload";

const api = vi.hoisted(() => ({ uploadScanBatch: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingFilesApi: api }));

afterEach(cleanup);

describe("Scanned batch upload", () => {
  it("asks nothing, sends the PDF at once and lists what was sorted and what was not recognised", async () => {
    api.uploadScanBatch.mockResolvedValue({
      totalPages: 4, stored: 1,
      files: [{ packCode: "TRN/QA/26-1/S1/E1", person: "Nguyen A", pagesFound: 2, pagesExpected: 3, duplicatePages: 0, state: "STORED_INCOMPLETE" }],
      unrecognisedPages: [2, 4],
    });
    const done = vi.fn();
    const { container } = render(<ToastProvider><TrainingScanBatchUpload activityId="a1" onDone={done} /></ToastProvider>);
    expect(screen.queryByText("Type")).toBeNull();
    expect(screen.queryByText(/Paper copy/i)).toBeNull();
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(api.uploadScanBatch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Nguyen A")).toBeTruthy());
    expect(screen.getByText("Stored, pages missing")).toBeTruthy();
    expect(screen.getByText(/page 2, 4/)).toBeTruthy();
    expect(done).toHaveBeenCalled();
  });
});
