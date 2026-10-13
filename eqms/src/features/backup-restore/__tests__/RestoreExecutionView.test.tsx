import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { RestoreExecutionChecks } from "@/services/api/backupRestore";
import { RestoreExecutionView } from "../views/RestoreExecutionView";

const api = vi.hoisted(() => ({ restoreExecution: vi.fn(), scheduleRestore: vi.fn(), enterRestoreWindow: vi.fn(), startTestRestore: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));

const checks = (over: Partial<RestoreExecutionChecks> = {}): RestoreExecutionChecks => ({
  restoreNumber: "RS-1",
  status: "APPROVED",
  checks: [
    { code: "REQUEST_APPROVED", ok: true, detail: "The request is APPROVED" },
    { code: "NO_OPEN_SCHEDULE", ok: true, detail: "No other restore of this backup is scheduled" },
  ],
  readyToSchedule: true,
  schedule: null,
  systemState: "NORMAL",
  systemRequestId: null,
  testRestore: null,
  notCheckedYet: ["Khóa giải mã trên máy thực thi"],
  ...over,
});

beforeEach(() => {
  api.restoreExecution.mockReset();
  api.scheduleRestore.mockReset();
  api.enterRestoreWindow.mockReset();
  api.startTestRestore.mockReset();
  perms.granted = new Set(["backup.module.view", "backup.restore.execute"]);
});
afterEach(cleanup);

const renderAt = () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  return render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/backup-restore/restores/RS-1/execution"]}>
          <Routes>
            <Route path="/backup-restore/restores/:requestId/execution" element={<RestoreExecutionView />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );
};

describe("Restore Execution Console", () => {
  it("shows every pre-check and what is not checked yet, and keeps the execute control off", async () => {
    api.restoreExecution.mockResolvedValue(checks());
    renderAt();
    expect(await screen.findByText("REQUEST_APPROVED")).toBeTruthy();
    expect(screen.getByText("Not checked yet")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Execute Restore" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not offer scheduling while a check is not passed", async () => {
    api.restoreExecution.mockResolvedValue(checks({ readyToSchedule: false, checks: [{ code: "BACKUP_VERIFIED", ok: false, detail: "No passing check" }] }));
    renderAt();
    expect(await screen.findByText("BACKUP_VERIFIED")).toBeTruthy();
    expect(screen.getByText("A check above blocks scheduling.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Schedule Window" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("schedules a window that starts later, sending it as an instant", async () => {
    api.restoreExecution.mockResolvedValue(checks());
    api.scheduleRestore.mockResolvedValue(checks({ schedule: { id: "1", status: "SCHEDULED", windowStart: "2099-01-01T10:00:00Z", scheduledBy: "executor.one", scheduledAt: "2026-10-09T10:00:00Z" } }));
    renderAt();
    const input = (await screen.findByLabelText("Window starts")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2099-01-01T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule Window" }));
    await waitFor(() => expect(api.scheduleRestore).toHaveBeenCalledWith("RS-1", new Date("2099-01-01T10:00").toISOString()));
    expect(await screen.findByText("executor.one")).toBeTruthy();
  });

  it("does not let a person without the execute permission schedule", async () => {
    perms.granted = new Set(["backup.module.view"]);
    api.restoreExecution.mockResolvedValue(checks());
    renderAt();
    expect(await screen.findByText("Scheduling needs the execute permission.")).toBeTruthy();
    expect((screen.getByLabelText("Window starts") as HTMLInputElement).disabled).toBe(true);
  });

  it("enters the window only after the window has come and the no-users confirmation is ticked", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const scheduled = checks({ schedule: { id: "1", status: "SCHEDULED", windowStart: past, scheduledBy: "executor.one", scheduledAt: past } });
    api.restoreExecution.mockResolvedValueOnce(scheduled).mockResolvedValue(checks({ ...scheduled, systemState: "LOCKED_RESTORING", systemRequestId: "RS-1" }));
    api.enterRestoreWindow.mockResolvedValue({ restoreNumber: "RS-1", systemState: "LOCKED_RESTORING" });
    renderAt();
    const button = (await screen.findByRole("button", { name: "Enter Restore Window" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(api.enterRestoreWindow).toHaveBeenCalledWith("RS-1", true));
    expect((await screen.findAllByText(/LOCKED_RESTORING/)).length).toBeGreaterThan(0);
  });

  it("does not offer to enter a window that has not started", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    api.restoreExecution.mockResolvedValue(checks({ schedule: { id: "1", status: "SCHEDULED", windowStart: future, scheduledBy: "executor.one", scheduledAt: future } }));
    renderAt();
    expect(await screen.findByText("The window has not started yet.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Enter Restore Window" }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.enterRestoreWindow).not.toHaveBeenCalled();
  });

  it("starts the test restore only after the window is entered, and shows the queued record", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const scheduled = checks({ schedule: { id: "1", status: "SCHEDULED", windowStart: past, scheduledBy: "executor.one", scheduledAt: past } });
    const locked = checks({ ...scheduled, systemState: "LOCKED_RESTORING", systemRequestId: "RS-1" });
    const queued = checks({
      ...locked,
      testRestore: { rehearsalId: "RH-20261009-0007", status: "QUEUED", requestedBy: "admin", errorCode: null, errorDetail: null, checks: [] },
    });
    api.restoreExecution.mockResolvedValueOnce(scheduled).mockResolvedValueOnce(locked).mockResolvedValue(queued);
    api.enterRestoreWindow.mockResolvedValue({ restoreNumber: "RS-1", systemState: "LOCKED_RESTORING" });
    api.startTestRestore.mockResolvedValue({ restoreNumber: "RS-1", rehearsalId: "RH-20261009-0007", status: "QUEUED" });
    renderAt();
    const start = (await screen.findByRole("button", { name: "Start Test Restore" })) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enter Restore Window" }));
    await waitFor(() => expect(api.enterRestoreWindow).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole("button", { name: "Start Test Restore" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Start Test Restore" }));
    await waitFor(() => expect(api.startTestRestore).toHaveBeenCalledWith("RS-1"));
    expect((await screen.findAllByText(/RH-20261009-0007/)).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Start Test Restore" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the outcome of the test restore and each of its checks, read from the server", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    api.restoreExecution.mockResolvedValue(
      checks({
        schedule: { id: "1", status: "SCHEDULED", windowStart: past, scheduledBy: "executor.one", scheduledAt: past },
        systemState: "LOCKED_RESTORING",
        systemRequestId: "RS-1",
        testRestore: {
          rehearsalId: "RH-20261009-0007",
          status: "PASSED",
          requestedBy: "admin",
          errorCode: null,
          errorDetail: null,
          checks: [{ code: "C1", title: "Schema version matches the manifest", required: true, ok: true, detail: "ok" }],
        },
      }),
    );
    renderAt();
    expect(await screen.findByText("PASSED")).toBeTruthy();
    expect(screen.getByText("C1")).toBeTruthy();
    expect(screen.getByText("Schema version matches the manifest")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Start Test Restore" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
