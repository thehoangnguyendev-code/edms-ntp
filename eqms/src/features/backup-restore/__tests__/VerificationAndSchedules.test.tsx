import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { BackupRecord } from "../types";
import { BackupSchedulesView } from "../views/BackupSchedulesView";
import { BackupVerificationResultsView } from "../views/BackupVerificationResultsView";

const api = vi.hoisted(() => ({ list: vi.fn(), verify: vi.fn(), schedules: vi.fn(), scheduleRows: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return {
    ...actual,
    backupRestoreApi: api,
    waitForBackupJob: vi.fn().mockResolvedValue({ id: "j", job_type: "VERIFY", status: "DONE", result_json: "{\"verification\":\"VERIFIED\"}" }),
  };
});
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return { ...actual, useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }) };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));

const backup = (id: string, verification: BackupRecord["verification"]): BackupRecord => ({
  id, type: "FULL", trigger: "SCHEDULED", status: "COMPLETED", startedAt: "2026-10-08T01:00:00Z", durationSec: 9, sizeBytes: 1000,
  components: [], verification, schemaVersion: "560", retention: "PERMANENT", legalHold: false, createdBy: "scheduler",
});

const renderView = (view: React.ReactNode) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>{view}</MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

const header = (id: string) => document.querySelector<HTMLElement>(`[data-table-col="${id}"]`)!;
const lastList = () => api.list.mock.calls.at(-1)![0];
const one = (rows: BackupRecord[]) => ({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  perms.granted = new Set(["backup.module.view", "backup.backup.verify"]);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Backup Verification Results", () => {
  it("asks the server for completed backups with problems first", async () => {
    api.list.mockResolvedValue(one([backup("BK-1", "FAILED"), backup("BK-2", "VERIFIED")]));
    renderView(<BackupVerificationResultsView />);
    expect(await screen.findByText("BK-1")).toBeTruthy();
    expect(lastList()).toMatchObject({ status: "COMPLETED", sortBy: "verification", sortDirection: "asc", page: 1, limit: 10 });
  });

  it("searches, filters, sorts and pages on the server", async () => {
    api.list.mockResolvedValue(one([backup("BK-1", "FAILED")]));
    renderView(<BackupVerificationResultsView />);
    await screen.findByText("BK-1");
    fireEvent.change(screen.getAllByPlaceholderText("Backup Number or person…")[0], { target: { value: "sched" } });
    await waitFor(() => expect(lastList().search).toBe("sched"), { timeout: 2000 });
    fireEvent.click(header("started"));
    await waitFor(() => expect(lastList()).toMatchObject({ sortBy: "startedAt", sortDirection: "asc" }));
    fireEvent.click(header("id"));
    await waitFor(() => expect(lastList().sortBy).toBe("backupNumber"));
  });

  it("lets the person limit by when the backup was taken and when it was checked, as date ranges with a time", async () => {
    api.list.mockResolvedValue(one([backup("BK-1", "FAILED")]));
    renderView(<BackupVerificationResultsView />);
    await screen.findByText("BK-1");
    for (const label of ["Backup Taken Date Range", "Checked Date Range"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("Backup taken from")).toBeNull();
    expect(lastList().startedFrom).toBeUndefined();
    expect(lastList().checkedFrom).toBeUndefined();
  });

  it("sorts by when the backup was checked", async () => {
    api.list.mockResolvedValue(one([backup("BK-1", "FAILED")]));
    renderView(<BackupVerificationResultsView />);
    await screen.findByText("BK-1");
    fireEvent.click(header("verifiedAt"));
    await waitFor(() => expect(lastList()).toMatchObject({ sortBy: "verifiedAt", sortDirection: "asc" }));
  });

  it("offers Custom Column beside Clear Filters", async () => {
    api.list.mockResolvedValue(one([backup("BK-1", "FAILED")]));
    renderView(<BackupVerificationResultsView />);
    await screen.findByText("BK-1");
    const custom = await screen.findByRole("button", { name: /Custom Column/ });
    expect(custom.parentElement).toBe(screen.getByRole("button", { name: "Clear Filters" }).parentElement);
  });

  it("re-checks a backup on request and reloads the list", async () => {
    api.list.mockResolvedValue(one([backup("BK-1", "NOT_VERIFIED")]));
    api.verify.mockResolvedValue({ jobId: "j-1" });
    renderView(<BackupVerificationResultsView />);
    fireEvent.click(await screen.findByRole("button", { name: "Verify Again" }));
    await waitFor(() => expect(api.verify).toHaveBeenCalledWith("BK-1"));
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("does not offer the re-check without the permission", async () => {
    perms.granted = new Set(["backup.module.view"]);
    api.list.mockResolvedValue(one([backup("BK-1", "VERIFIED")]));
    renderView(<BackupVerificationResultsView />);
    expect(((await screen.findByRole("button", { name: "Verify Again" })) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reports an unreachable agent instead of an empty list", async () => {
    api.list.mockRejectedValue(new Error("network"));
    renderView(<BackupVerificationResultsView />);
    expect((await screen.findAllByText(/could not be loaded/)).length).toBeGreaterThan(0);
  });
});

describe("Backup Schedules", () => {
  const policy = {
    version: 1, status: "ACTIVE", scope: "{}", retention: "{}", targets: "{}", zone: "Asia/Ho_Chi_Minh",
    schedule: "{}", nextDue: "2026-10-09T19:00:00Z",
    lastScheduledRun: { backupNumber: "BK-20261008-0822-0001", status: "FAILED", startedAt: "2026-10-08T08:22:00Z" },
  };
  const rowsPage = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });
  const lastRows = () => api.scheduleRows.mock.calls.at(-1)![0];
  const all = [
    { component: "DATABASE", type: "FULL", frequency: "DAILY", time: "02:00", status: "ACTIVE" },
    { component: "OBJECT_STORE", type: "", frequency: "", time: "", status: "NOT_SCHEDULED" },
  ];

  beforeEach(() => {
    api.schedules.mockResolvedValue(policy);
    api.scheduleRows.mockResolvedValue(rowsPage(all));
  });

  it("shows the policy, the next run, the last scheduled run and a row per component", async () => {
    renderView(<BackupSchedulesView />);
    expect(await screen.findByText("Version 1 (Active)")).toBeTruthy();
    expect(screen.getByText("BK-20261008-0822-0001")).toBeTruthy();
    expect(await screen.findByText("02:00")).toBeTruthy();
    expect(screen.getByText("Not scheduled", { selector: "span" })).toBeTruthy();
  });

  it("searches, filters, sorts and pages on the server", async () => {
    renderView(<BackupSchedulesView />);
    await screen.findByText("02:00");
    expect(lastRows()).toMatchObject({ sortBy: "component", sortDirection: "asc", page: 1, limit: 10 });
    fireEvent.change(screen.getAllByPlaceholderText("Component, type, frequency or time…")[0], { target: { value: "daily" } });
    await waitFor(() => expect(lastRows().search).toBe("daily"), { timeout: 2000 });
    const keys: Record<string, string> = { component: "component", type: "type", frequency: "frequency", time: "time", status: "status" };
    for (const [column, sortBy] of Object.entries(keys)) {
      fireEvent.click(header(column));
      await waitFor(() => expect(lastRows().sortBy).toBe(sortBy), { timeout: 1500 });
    }
  });

  it("filters on the server by backup type and frequency from the filter drawer", async () => {
    renderView(<BackupSchedulesView />);
    await screen.findByText("02:00");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByRole("button", { name: "Backup type" }));
    fireEvent.click(await screen.findByRole("button", { name: "Full" }));
    await waitFor(() => expect(lastRows().type).toBe("FULL"));
    fireEvent.click(screen.getByRole("button", { name: "Frequency" }));
    fireEvent.click(await screen.findByRole("button", { name: "Weekly" }));
    await waitFor(() => expect(lastRows()).toMatchObject({ type: "FULL", frequency: "WEEKLY" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(lastRows().frequency).toBeUndefined());
    expect(lastRows().type).toBeUndefined();
  });

  it("offers Custom Column beside Clear Filters", async () => {
    renderView(<BackupSchedulesView />);
    await screen.findByText("02:00");
    const custom = await screen.findByRole("button", { name: /Custom Column/ });
    expect(custom.parentElement).toBe(screen.getByRole("button", { name: "Clear Filters" }).parentElement);
  });

  it("says so when the agent cannot be reached", async () => {
    api.schedules.mockRejectedValue(new Error("network"));
    api.scheduleRows.mockRejectedValue(new Error("network"));
    renderView(<BackupSchedulesView />);
    expect((await screen.findAllByText(/Unable to (read|load)/)).length).toBeGreaterThan(0);
  });
});
