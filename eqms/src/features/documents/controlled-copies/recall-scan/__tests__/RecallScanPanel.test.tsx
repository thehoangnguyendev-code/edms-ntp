import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecallScanPanel, type RecallScanProgress } from "../RecallScanPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const progress = (over: Partial<RecallScanProgress> = {}): RecallScanProgress => ({ index: 1, count: 2, fileName: "a.pdf", percent: 20, filePercent: 40, processing: true, step: "Reading the QR code", ...over });
const line = (container: HTMLElement) => container.querySelector('[data-recall-part="line-holder"]') as HTMLElement | null;
const passed = (container: HTMLElement) => container.querySelector('[data-recall-part="passed"]') as HTMLElement | null;

describe("Recall scan panel", () => {
  it("puts the scan line where the real work of the file stands, and says which file and what the server is doing", async () => {
    const { container, rerender } = render(<RecallScanPanel progress={progress()} queue={[]} onStop={() => undefined} />);

    // the first position is set at once, with no glide
    expect(line(container)?.style.top).toBe("40%");
    expect(passed(container)?.style.height).toBe("40%");
    expect(screen.getByText(/File 1 of 2 · a\.pdf/)).toBeTruthy();
    expect(screen.getByText("Reading the QR code")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Upload progress" }).getAttribute("aria-valuenow")).toBe("20");

    rerender(<RecallScanPanel progress={progress({ filePercent: 85, percent: 42 })} queue={[]} onStop={() => undefined} />);
    // the real value is on the element at once; the line glides there and arrives
    expect(line(container)?.getAttribute("data-scan-percent")).toBe("85");
    await waitFor(() => expect(line(container)?.style.top).toBe("85%"), { timeout: 3000 });
    await waitFor(() => expect(passed(container)?.style.height).toBe("85%"), { timeout: 3000 });
  });

  it("jumps straight to the real position when the person asked for reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query }));
    const { container, rerender } = render(<RecallScanPanel progress={progress()} queue={[]} onStop={() => undefined} />);

    rerender(<RecallScanPanel progress={progress({ filePercent: 85, percent: 42 })} queue={[]} onStop={() => undefined} />);

    expect(line(container)?.style.top).toBe("85%");
    expect(passed(container)?.style.height).toBe("85%");
  });

  it("says the file is being sent, not read, until all its bytes are in", () => {
    render(<RecallScanPanel progress={progress({ processing: false, filePercent: 6 })} queue={[]} onStop={() => undefined} />);

    expect(screen.getByText(/Sending the file/)).toBeTruthy();
  });

  it("shows a check instead of the line once every code is read", () => {
    const { container } = render(<RecallScanPanel progress={progress({ percent: 100, filePercent: 100, finished: true, step: "Done." })} queue={[]} onStop={() => undefined} />);

    expect(container.querySelector('[data-recall-part="check"]')).toBeTruthy();
    expect(line(container)).toBeNull();
    expect(screen.getByText("All codes are read.")).toBeTruthy();
  });

  it("starts the line again at the top for the next file", () => {
    const { container, rerender } = render(<RecallScanPanel progress={progress({ filePercent: 95 })} queue={[]} onStop={() => undefined} />);
    const first = container.querySelector('[data-recall-part="sheet"]');

    rerender(<RecallScanPanel progress={progress({ index: 2, fileName: "b.pdf", filePercent: 0, percent: 50 })} queue={[]} onStop={() => undefined} />);

    expect(container.querySelector('[data-recall-part="sheet"]')).not.toBe(first);
    expect(line(container)?.style.top).toBe("0%");
  });

  it("offers to stop only when there is more than one file and the set is not finished", () => {
    const queue = [{ name: "a.pdf", size: 2048, state: "active" as const }, { name: "b.pdf", size: 2048, state: "waiting" as const }];
    const { rerender } = render(<RecallScanPanel progress={progress()} queue={queue} onStop={() => undefined} />);
    expect(screen.getByRole("button", { name: "Stop After This File" })).toBeTruthy();

    rerender(<RecallScanPanel progress={progress({ percent: 100, finished: true })} queue={queue} onStop={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Stop After This File" })).toBeNull();
  });
});
