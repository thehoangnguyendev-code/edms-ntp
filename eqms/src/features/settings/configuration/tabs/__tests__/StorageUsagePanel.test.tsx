import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/services/api/client", () => ({ api: http }));

import { StorageUsagePanel, growthOf } from "../StorageUsagePanel";

const GIB = 1024 ** 3;
const snap = (daysAgo: number, totalBytes: number) => ({ measuredAt: new Date(Date.UTC(2026, 9, 28) - daysAgo * 86400000).toISOString(), totalBytes, objectVersions: 10, byDomain: { documents: totalBytes * 0.75, training: totalBytes * 0.25 }, byFileType: { ".pdf": totalBytes } });
const status = (budgetBytes: number | null, warning: boolean | null) => ({ policy: { budgetBytes, warningPercent: 80 }, warning, scanState: { lastResult: "SUCCESS", lastAttemptAt: null, lastSuccessAt: null, stale: false } });

const renderPanel = () => render(<ToastProvider><StorageUsagePanel /></ToastProvider>);

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
    http.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith("/status") ? status(20 * GIB, false) : [snap(0, 12 * GIB), snap(10, 2 * GIB)] }));
    renderPanel();

    expect((await screen.findByRole("progressbar", { name: "Storage used of the budget" })).getAttribute("aria-valuenow")).toBe("60");
    expect(screen.getByText(/Growth over the last 10 days/)).toBeTruthy();
    expect(screen.getByText("8 days")).toBeTruthy();
    expect(screen.getByText("documents")).toBeTruthy();
    expect(screen.getByText(".pdf")).toBeTruthy();
  });

  it("warns when the last measurement reached the threshold", async () => {
    http.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith("/status") ? status(10 * GIB, true) : [snap(0, 9 * GIB)] }));
    renderPanel();

    expect(await screen.findByText(/reached the configured warning threshold/)).toBeTruthy();
  });

  it("takes the budget in GiB and saves it as bytes", async () => {
    http.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith("/status") ? status(null, null) : [] }));
    http.put.mockResolvedValue({ data: {} });
    renderPanel();

    fireEvent.change(await screen.findByLabelText("Budget (GiB)"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Storage Policy" }));

    await waitFor(() => expect(http.put).toHaveBeenCalledWith("/settings/storage-usage/policy", { budgetBytes: 1.5 * GIB, warningPercent: 80 }));
  });

  it("does not save a budget that is not above zero", async () => {
    http.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith("/status") ? status(null, null) : [] }));
    renderPanel();

    fireEvent.change(await screen.findByLabelText("Budget (GiB)"), { target: { value: "-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Storage Policy" }));

    await waitFor(() => expect(screen.getByText("Invalid Storage Budget")).toBeTruthy());
    expect(http.put).not.toHaveBeenCalled();
  });
});
