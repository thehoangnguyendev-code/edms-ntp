import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { backupRestore } from "@/components/ui/breadcrumb/breadcrumbs/core";
import { BackupDetailView } from "../views/BackupDetailView";

const api = vi.hoisted(() => ({ get: vi.fn(), job: vi.fn(), verify: vi.fn(), media: vi.fn(), exportEstimate: vi.fn(), requestExport: vi.fn(), rehearsals: vi.fn(), requestRehearsal: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api, waitForBackupJob: vi.fn().mockResolvedValue({ id: "j", job_type: "VERIFY", status: "DONE", result_json: "{\"verification\":\"VERIFIED\"}" }) };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));

const detail = (over = {}) => ({
  id: "BK-20261008-0200-0001", type: "FULL", trigger: "SCHEDULED", status: "COMPLETED", startedAt: "2026-10-08T01:00:00Z", durationSec: 12, sizeBytes: 85_000_000,
  components: [{ key: "DATABASE", status: "COMPLETED", sizeBytes: 85_000_000, sha256: "ab".repeat(32) }], verification: "VERIFIED", verifiedAt: "2026-10-08T01:01:00Z",
  schemaVersion: "561", retention: "PERMANENT", legalHold: false, createdBy: "scheduler", reason: "Scheduled by the active policy",
  locations: [{ target: "T1", path: "/backup/t1/DEV/2026/10/BK-20261008-0200-0001", ok: true }],
  verifications: [{ tier: "V1", result: "VERIFIED", verified_at: "2026-10-08T01:01:00Z", verified_by: "agent", detail: "{}" }], ...over,
});

const renderAt = (path = "/backup-restore/backups/BK-20261008-0200-0001") =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/backup-restore/backups/:backupId" element={<BackupDetailView />} />
            <Route path="/backup-restore/backups" element={<span>history</span>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  perms.granted = new Set(["backup.module.view", "backup.backup.verify"]);
  api.get.mockResolvedValue(detail());
  api.rehearsals.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
});
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
afterEach(cleanup);

describe("Backup Details", () => {
  it("shows one backup on its own screen: what it is, where it is stored, its contents and every check", async () => {
    renderAt();
    await screen.findByRole("tab", { name: /General Information/ });
    for (const title of [/Integrity and Retention/, /Stored At/, /Contents/, /Verification History/, /Restore Tests/]) {
      expect(screen.getByRole("tab", { name: title })).toBeTruthy();
    }
    expect((screen.getByDisplayValue("V561") as HTMLInputElement).readOnly).toBe(true);
    expect(api.get).toHaveBeenCalledWith("BK-20261008-0200-0001");
    fireEvent.click(screen.getByRole("tab", { name: /Stored At/ }));
    expect(screen.getByText("/backup/t1/DEV/2026/10/BK-20261008-0200-0001")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Integrity and Retention/ }));
    expect(screen.getByDisplayValue("Permanently")).toBeTruthy();
    expect(screen.getByText(/passed its integrity check and can be used for a restore request/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Contents/ }));
    expect(screen.getByText("ab".repeat(32))).toBeTruthy();
    // the verification history is the first sub tab under the buttons
    expect(screen.getByText("agent")).toBeTruthy();
  });

  it("warns that a backup without a passing check cannot be restored, and blocks the restore button", async () => {
    api.get.mockResolvedValue(detail({ verification: "NOT_VERIFIED", verifiedAt: null }));
    renderAt();
    expect(await screen.findByText("This backup has not been verified")).toBeTruthy();
    // the same buttons are above and below the tabs, and both are blocked
    const restore = screen.getAllByRole("button", { name: "Restore" }) as HTMLButtonElement[];
    expect(restore).toHaveLength(2);
    expect(restore.every((button) => button.disabled)).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: /Integrity and Retention/ }));
    expect(screen.getByText(/cannot be used for a restore until it is completed and has passed/)).toBeTruthy();
  });

  it("shows why a backup failed", async () => {
    api.get.mockResolvedValue(detail({ status: "FAILED", verification: "NOT_VERIFIED", errorMessage: "pg_dump failed", errorCode: "BACKUP_DUMP_FAILED", locations: [], verifications: [] }));
    renderAt();
    expect(await screen.findByText("This backup failed")).toBeTruthy();
    expect(screen.getByDisplayValue("BACKUP_DUMP_FAILED")).toBeTruthy();
  });

  it("re-checks the backup on request, only with the permission", async () => {
    api.verify.mockResolvedValue({ jobId: "j-1" });
    api.job
      .mockResolvedValueOnce({ id: "j-1", job_type: "VERIFY", status: "RUNNING", progress: 42, result_json: null })
      .mockResolvedValue({
        id: "j-1", job_type: "VERIFY", status: "DONE", progress: 100,
        result_json: JSON.stringify({ backupNumber: "BK-20261008-0200-0001", verification: "VERIFIED", checks: [{ code: "MANIFEST_SIGNATURE", ok: true, detail: "valid" }, { code: "FILES_MATCH_MANIFEST", ok: true, detail: "2 file(s) match" }] }),
      });
    renderAt();
    fireEvent.click((await screen.findAllByRole("button", { name: "Verify Integrity" }))[0]);
    // the check opens in a window, shows the agent's own progress, then the result in the same window
    expect(await screen.findByText("42%")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
    // each finished check is ticked off in turn, then the verdict follows
    expect(await screen.findByText("This backup passed its integrity check", {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("The manifest signature is valid")).toBeTruthy();
    expect(document.querySelector('[data-check="MANIFEST_SIGNATURE"]')?.getAttribute("data-state")).toBe("passed");
    expect(document.querySelector('[data-check="OBJECTS_PRESENT"]')?.getAttribute("data-state")).toBe("skipped");
    expect(api.verify).toHaveBeenCalledWith("BK-20261008-0200-0001");
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    cleanup();
    perms.granted = new Set(["backup.module.view"]);
    renderAt();
    expect(((await screen.findAllByRole("button", { name: "Verify Integrity" })) as HTMLButtonElement[]).every((button) => button.disabled)).toBe(true);
  });

  it("says plainly when the backup cannot be read, and offers the way back", async () => {
    api.get.mockRejectedValue(new Error("not found"));
    renderAt();
    expect(await screen.findByText("Unable to open the backup")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to Backup History" }));
    expect(await screen.findByText("history")).toBeTruthy();
  });

  it("puts the page title, not the backup number, in the breadcrumb, under the Backup group", () => {
    const labels = backupRestore(vi.fn(), "Backup Details", { label: "Backup History", path: "/backup-restore/backups" }, "Backup").map((item) => item.label);
    expect(labels).toEqual(["Dashboard", "Backup & Restore", "Backup", "Backup History", "Backup Details"]);
  });

  it("offers Test Restore only with its permission and only for a backup that passed its check", async () => {
    perms.granted = new Set(["backup.module.view", "backup.restore.test"]);
    renderAt();
    await screen.findByRole("tab", { name: /General Information/ });
    expect(((await screen.findAllByRole("button", { name: "Test Restore" })) as HTMLButtonElement[]).every((b) => !b.disabled)).toBe(true);
    cleanup();
    perms.granted = new Set(["backup.module.view"]);
    renderAt();
    await screen.findByRole("tab", { name: /General Information/ });
    expect(screen.queryByRole("button", { name: "Test Restore" })).toBeNull();
  });

  it("asks for a test restore with a reason and lists the results with their checks", async () => {
    perms.granted = new Set(["backup.module.view", "backup.restore.test"]);
    api.requestRehearsal.mockResolvedValue({ rehearsalId: "RH-20261009-0001" });
    const one = {
      data: [{ id: "r", rehearsalId: "RH-20261009-0001", backupNumber: "BK-20261008-0200-0001", status: "PASSED", requestedBy: "tester", reason: "x", requestedAt: "2026-10-09T01:00:00Z", startedAt: null, finishedAt: null, restoreSeconds: 14, errorCode: null, errorDetail: null, checkCount: 2, failedCount: 0 }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    // The page asks the server for the list and, apart, how many are queued or running (none here).
    api.rehearsals.mockImplementation(async (params?: { status?: string }) => (params?.status ? { data: [], pagination: { page: 1, limit: 1, total: 0, totalPages: 1 } } : one));
    renderAt();
    fireEvent.click(await screen.findByRole("tab", { name: /Restore Tests/ }));
    expect(await screen.findByText("RH-20261009-0001")).toBeTruthy();
    expect(screen.getByText("2 of 2 passed")).toBeTruthy();
    fireEvent.click((await screen.findAllByRole("button", { name: "Test Restore" }))[0]);
    fireEvent.change(await screen.findByRole("textbox", { name: /Reason/ }), { target: { value: "Annual test" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Test" }));
    await waitFor(() => expect(api.requestRehearsal).toHaveBeenCalledWith("BK-20261008-0200-0001", "Annual test"));
  });
});
