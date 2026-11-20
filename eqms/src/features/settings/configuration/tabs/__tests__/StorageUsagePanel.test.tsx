import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/services/api/client", () => ({ api: http }));
// the chart itself is Chart.js on a canvas: what it is given is what matters here
vi.mock("@/components/ui/chart", () => ({ ChartCanvas: ({ config }: { config: unknown }) => <div data-testid="chart" data-config={JSON.stringify(config)} /> }));

import { StorageUsagePanel, growthOf } from "../StorageUsagePanel";
import { useStoragePolicyDraft } from "../../useStoragePolicyDraft";

const GIB = 1024 ** 3;
const snap = (daysAgo: number, totalBytes: number) => ({ measuredAt: new Date(Date.UTC(2026, 9, 28) - daysAgo * 86400000).toISOString(), totalBytes, objectVersions: 10, byDomain: { documents: totalBytes * 0.75, training: totalBytes * 0.25 }, byFileType: { ".pdf": totalBytes } });
const status = (budgetBytes: number | null, warning: boolean | null, scanState: Record<string, unknown> = { lastResult: "SUCCESS", lastAttemptAt: null, lastSuccessAt: null, stale: false }) => ({ policy: { budgetBytes, warningPercent: 80 }, warning, scanState });

/** The panel the way the page holds it: the budget and the threshold live in the page's draft. */
function Harness() {
  const policy = useStoragePolicyDraft(true);
  return <><StorageUsagePanel policy={policy} /><output data-testid="state">{`${policy.isDirty}/${policy.isValid}`}</output></>;
}
const answer = (statusBody: unknown, snapshots: unknown) => http.get.mockImplementation((url: string) => (url.endsWith("/status") ? Promise.resolve({ data: statusBody }) : Promise.resolve({ data: snapshots })));
const chartConfig = () => JSON.parse(screen.getByTestId("chart").getAttribute("data-config") ?? "{}");

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  http.get.mockReset(); http.put.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("growthOf", () => {
  it("is the change between the oldest and the newest measurement, per day", () => {
    const growth = growthOf([snap(0, 12 * GIB), snap(10, 2 * GIB)]);
    expect(growth?.days).toBe(10);
    expect(growth?.delta).toBe(10 * GIB);
    expect(growth?.perDay).toBe(GIB);
  });

  it("says nothing without two measurements at least a day apart", () => {
    expect(growthOf([snap(0, GIB)])).toBeNull();
    expect(growthOf([snap(0, GIB), snap(0.2, GIB)])).toBeNull();
  });
});

describe("StorageUsagePanel", () => {
  it("shows the share of the budget, the growth and how long the budget lasts, from the measurements", async () => {
    answer(status(20 * GIB, false), [snap(0, 12 * GIB), snap(10, 2 * GIB)]);
    render(<Harness />);

    expect((await screen.findByRole("progressbar", { name: "Storage used of the budget" })).getAttribute("aria-valuenow")).toBe("60");
    expect(screen.getByText("+10 GiB in 10 days")).toBeTruthy();
    expect(screen.getByText("+1 GiB")).toBeTruthy(); // a day
    expect(screen.getByText("8 days")).toBeTruthy();
    expect(screen.getAllByText("documents").length).toBeGreaterThan(0);
    expect(screen.getAllByText(".pdf").length).toBeGreaterThan(0);
  });

  it("draws the budget and the warning level on the chart, and nothing extra without a budget", async () => {
    answer(status(20 * GIB, false), [snap(0, 12 * GIB), snap(10, 2 * GIB)]);
    const { unmount } = render(<Harness />);
    await screen.findByTestId("chart");
    expect(chartConfig().data.datasets.map((d: { label: string }) => d.label)).toEqual(["Object-version size", "Budget 20 GiB", "Warning at 80%", "Estimate at the current growth", "Biggest jumps"]);
    expect(chartConfig().data.datasets[2].data[0].y).toBe(16 * GIB);
    unmount();

    answer(status(null, null), [snap(0, 12 * GIB), snap(10, 2 * GIB)]);
    render(<Harness />);
    await screen.findByTestId("chart");
    // without a budget there are no budget lines and no estimate; the biggest jump is still marked
    expect(chartConfig().data.datasets.map((d: { label: string }) => d.label)).toEqual(["Object-version size", "Biggest jumps"]);
    expect(screen.getByText(/No budget set/)).toBeTruthy();
  });

  it("follows the budget while it is typed, without saving anything", async () => {
    answer(status(null, null), [snap(0, 12 * GIB), snap(10, 2 * GIB)]);
    render(<Harness />);

    fireEvent.change(await screen.findByLabelText("Budget (GB)"), { target: { value: "24" } });

    expect((await screen.findByRole("progressbar", { name: "Storage used of the budget" })).getAttribute("aria-valuenow")).toBe("50");
    await waitFor(() => expect(chartConfig().data.datasets[1].label).toBe("Budget 24 GiB"));
    expect(screen.getByTestId("state").textContent).toBe("true/true");
    expect(http.put).not.toHaveBeenCalled(); // the page's Save does that, not this panel
  });

  it("says what is wrong with a budget that is not above zero, and marks the draft as one that cannot be saved", async () => {
    answer(status(null, null), [snap(0, GIB)]);
    render(<Harness />);

    fireEvent.change(await screen.findByLabelText("Budget (GB)"), { target: { value: "-3" } });

    expect(await screen.findByText("Enter a budget in GiB greater than 0, or leave it empty.")).toBeTruthy();
    expect(screen.getByLabelText("Budget (GB)").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByTestId("state").textContent).toBe("true/false");
    fireEvent.change(screen.getByLabelText("Warning threshold (%)"), { target: { value: "150" } });
    expect(await screen.findByText("Enter a whole number from 1 to 100.")).toBeTruthy();
  });

  it("has no Save button of its own", async () => {
    answer(status(null, null), [snap(0, GIB)]);
    render(<Harness />);
    await screen.findByLabelText("Budget (GB)");
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("warns when the last measurement reached the threshold", async () => {
    answer(status(10 * GIB, true), [snap(0, 9 * GIB)]);
    render(<Harness />);

    expect(await screen.findByText(/reached the configured warning threshold/)).toBeTruthy();
  });

  it("keeps the policy fields and explains when there is no measurement yet", async () => {
    answer(status(null, null), []);
    render(<Harness />);

    expect(await screen.findByText("No successful measurement is available yet")).toBeTruthy();
    expect(screen.getByLabelText("Budget (GB)")).toBeTruthy();
  });

  it("offers to try again when the measurements cannot be loaded", async () => {
    http.get.mockImplementation((url: string) => (url.endsWith("/status") ? Promise.resolve({ data: status(null, null) }) : Promise.reject(new Error("down"))));
    render(<Harness />);

    expect((await screen.findByRole("alert")).textContent).toBe("Unable to load storage measurements.");
    http.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith("/status") ? status(null, null) : [snap(0, GIB)] }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Budget (GB)")).toBeTruthy();
  });

  it("sums the small parts into 'others' and keeps the four biggest apart", async () => {
    const wide = { ...snap(0, 100 * GIB), byDomain: { a: 40 * GIB, b: 30 * GIB, c: 20 * GIB, d: 5 * GIB, e: 4 * GIB, f: 0.5 * GIB, g: 0.5 * GIB } };
    answer(status(null, null), [wide]);
    render(<Harness />);

    const domain = (await screen.findByRole("img", { name: /^By storage domain/ })).parentElement as HTMLElement;
    expect(domain.textContent).toContain("others (3)");
    expect(domain.textContent).toContain("5 GiB"); // 4 + 0.5 + 0.5: the fifth biggest and the two small ones
  });
});
