import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/services/api/client", () => ({ api: http }));
vi.mock("@/components/ui/chart", () => ({ ChartCanvas: ({ config }: { config: unknown }) => <div data-testid="chart" data-config={JSON.stringify(config)} /> }));

import { StorageUsagePanel } from "../StorageUsagePanel";
import { useStoragePolicyDraft } from "../../useStoragePolicyDraft";

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 19, 4, 0, 0);
const snap = (daysAgo: number, parts: Record<string, number>, files: Record<string, number> = {}) => {
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { measuredAt: new Date(NOW - daysAgo * DAY).toISOString(), totalBytes: total, objectVersions: 10, byDomain: parts, byFileType: files };
};
const status = (budgetBytes: number | null, scanState: Record<string, unknown> = {}) => ({
  policy: { budgetBytes, warningPercent: 80 }, warning: null,
  scanState: { lastResult: "SUCCESS", lastAttemptAt: null, lastSuccessAt: null, stale: false, ...scanState },
});

function Harness() {
  const policy = useStoragePolicyDraft(true);
  return <StorageUsagePanel policy={policy} />;
}
const answer = (statusBody: unknown, snapshots: unknown) => http.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith("/status") ? statusBody : snapshots }));
const chartLabels = () => (JSON.parse(screen.getByTestId("chart").getAttribute("data-config") ?? "{}").data.datasets as { label: string }[]).map((d) => d.label);

/** 40 days of history: documents grow steadily and training jumps by 60 MiB 3 days ago. */
const history = () => [
  snap(0, { documents: 120 * MIB, training: 100 * MIB }, { pdf: 220 * MIB }),
  snap(3, { documents: 110 * MIB, training: 100 * MIB }, { pdf: 210 * MIB }),
  snap(4, { documents: 108 * MIB, training: 40 * MIB }, { pdf: 148 * MIB }),
  snap(20, { documents: 80 * MIB, training: 40 * MIB }, { pdf: 120 * MIB }),
  snap(40, { documents: 50 * MIB, training: 40 * MIB }, { pdf: 90 * MIB }),
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  http.get.mockReset(); http.put.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Storage Usage: growth, period, table and export", () => {
  it("shows what grew in the period, biggest first, and switches to the file types", async () => {
    answer(status(null), history());
    render(<Harness />);

    const panel = (await screen.findByText("What grew")).closest("section") as HTMLElement;
    const names = within(panel).getAllByRole("listitem").map((li) => li.textContent);
    expect(names[0]).toContain("documents");
    expect(names[0]).toContain("+70 MiB");
    expect(names[1]).toContain("training");
    expect(names[1]).toContain("+60 MiB");

    fireEvent.click(within(panel).getByRole("tab", { name: "By file type" }));
    expect(within(panel).getAllByRole("listitem")[0].textContent).toContain("pdf");
  });

  it("works everything out from the period that is chosen: a shorter period has less to say", async () => {
    answer(status(null), history());
    render(<Harness />);
    await screen.findByText("What grew");

    fireEvent.click(screen.getByRole("tab", { name: "7 days" }));

    // within 7 days the measurements are those of 0, 3 and 4 days ago: training jumped by 60 MiB and documents grew by 12 MiB, over 4 days
    const panel = screen.getByText("What grew").closest("section") as HTMLElement;
    const rows = within(panel).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(rows[0]).toContain("training");
    expect(rows[0]).toContain("+60 MiB");
    expect(rows[1]).toContain("documents");
    expect(rows[1]).toContain("+12 MiB");
    expect(screen.getByText(/in 4 days/)).toBeTruthy();
  });

  it("marks the budget estimate on the chart only when the size is below the budget and growing", async () => {
    answer(status(1 * GIB), history());
    render(<Harness />);
    await screen.findByTestId("chart");
    expect(chartLabels()).toContain("Estimate at the current growth");
    expect(screen.getByText(/an estimate/)).toBeTruthy();
    cleanup();

    answer(status(100 * MIB), history()); // already past the budget
    render(<Harness />);
    await screen.findByTestId("chart");
    expect(chartLabels()).not.toContain("Estimate at the current growth");
  });

  it("shows the measurements as a table with one row for each day, and hides the chart", async () => {
    answer(status(null), history());
    render(<Harness />);
    await screen.findByTestId("chart");

    fireEvent.click(screen.getByRole("tab", { name: "Table" }));

    expect(screen.queryByTestId("chart")).toBeNull();
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(1 + 5); // the header and one row for each of the 5 days
    expect(rows[1].textContent).toContain("220 MiB");
    expect(rows[1].textContent).toContain("+10 MiB"); // since the day before
  });

  it("exports the measurements of the period as a CSV file", async () => {
    answer(status(null), history());
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", { ...URL, createObjectURL: (blob: Blob) => { blobs.push(blob); return "blob:csv"; }, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Harness />);
    await screen.findByTestId("chart");

    fireEvent.click(screen.getByRole("tab", { name: "30 days" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));

    expect(click).toHaveBeenCalledTimes(1);
    const text = await blobs[0].text();
    expect(text.split("\r\n")[0]).toBe("Measured,Total bytes,Object versions");
    expect(text.trim().split("\r\n")).toHaveLength(1 + 4); // 4 measurements within 30 days
  });
});

describe("Storage Usage: state and the last warning", () => {
  it("says over the warning level and what is recorded about the last warning, with the number of administrators", async () => {
    // 220 MiB of 250 MiB is 88%, over the 80% threshold
    answer(status(250 * MIB, { warningSentAt: new Date(NOW - 2 * DAY).toISOString(), warningRecipients: 3 }), history());
    render(<Harness />);

    expect(await screen.findByText("Over the warning level")).toBeTruthy();
    expect(screen.getByText(/Last warning sent .* to 3 administrators\./)).toBeTruthy();
  });

  it("says within budget, and does not claim that no warning was ever sent when none is recorded", async () => {
    // 220 MiB of 400 MiB is 55%
    answer(status(400 * MIB), history());
    render(<Harness />);

    expect(await screen.findByText("Within budget")).toBeTruthy();
    expect(screen.getByText("No warning is recorded.")).toBeTruthy();
    expect(screen.queryByText(/No warning has been sent/)).toBeNull();
  });

  it("says one administrator in the singular", async () => {
    answer(status(250 * MIB, { warningSentAt: new Date(NOW).toISOString(), warningRecipients: 1 }), history());
    render(<Harness />);

    expect(await screen.findByText(/to 1 administrator\./)).toBeTruthy();
  });
});
