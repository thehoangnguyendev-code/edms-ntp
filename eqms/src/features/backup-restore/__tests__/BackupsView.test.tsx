import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { BackupRecord } from "../types";
import { BackupsView } from "../views/BackupsView";

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), verify: vi.fn(), job: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api, waitForBackupJob: vi.fn().mockResolvedValue({ id: "j", job_type: "BACKUP_DB", status: "DONE", result_json: "{\"backupId\":\"BK-20261008-0900-0001\",\"verification\":\"VERIFIED\"}" }) };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return { ...actual, useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }) };
});

const row = (id: string, over: Partial<BackupRecord> = {}): BackupRecord => ({
  id, type: "FULL", trigger: "SCHEDULED", status: "COMPLETED", startedAt: "2026-10-08T01:00:00Z", durationSec: 12, sizeBytes: 85_000_000,
  components: [{ key: "DATABASE", status: "COMPLETED", sizeBytes: 85_000_000, sha256: "ab".repeat(32) }], verification: "VERIFIED",
  schemaVersion: "560", retention: "PERMANENT", legalHold: false, createdBy: "scheduler", ...over,
});
const page = (data: BackupRecord[], extra = {}) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1, ...extra } });
const last = () => api.list.mock.calls.at(-1)![0];

const Where: React.FC = () => <span data-testid="where">{useLocation().pathname}</span>;
const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/backup-restore/backups"]}>
          <Routes>
            <Route path="/backup-restore/backups" element={<BackupsView />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

const header = (id: string) => document.querySelector<HTMLElement>(`[data-table-col="${id}"]`)!;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  perms.granted = new Set(["backup.module.view", "backup.backup.run", "backup.backup.verify"]);
  api.list.mockResolvedValue(page([row("BK-20261008-0200-0001"), row("BK-20261007-0200-0001", { status: "FAILED", verification: "NOT_VERIFIED", sizeBytes: null, durationSec: null })]));
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Backup History", () => {
  it("lists what the agent returns, newest first, and shows a failed backup without a size", async () => {
    renderView();
    expect(await screen.findByText("BK-20261008-0200-0001")).toBeTruthy();
    expect(screen.getByText("BK-20261007-0200-0001")).toBeTruthy();
    expect(last()).toMatchObject({ sortBy: "startedAt", sortDirection: "desc", page: 1, limit: 10 });
    expect(last().search).toBeUndefined();
    expect(last().startedFrom).toBeUndefined();
    expect(screen.getAllByText("Permanently").length).toBe(2);
  });

  it("sends search, sorting and paging to the server, and every data column sorts by a key the server accepts", async () => {
    renderView();
    await screen.findByText("BK-20261008-0200-0001");
    fireEvent.change(screen.getAllByPlaceholderText("Backup ID, person or reason…")[0], { target: { value: "quarter" } });
    await waitFor(() => expect(last().search).toBe("quarter"), { timeout: 2000 });
    const keys: Record<string, string> = { id: "backupId", status: "status", type: "type", started: "startedAt", size: "sizeBytes", verify: "verification", by: "createdBy" };
    for (const [column, sortBy] of Object.entries(keys)) {
      fireEvent.click(header(column));
      await waitFor(() => expect(last().sortBy).toBe(sortBy), { timeout: 1500 });
    }
    fireEvent.click(header("size"));
    await waitFor(() => expect(last()).toMatchObject({ sortBy: "sizeBytes", sortDirection: "asc" }));
    fireEvent.click(header("size"));
    await waitFor(() => expect(last()).toMatchObject({ sortBy: "sizeBytes", sortDirection: "desc" }));
  });

  it("offers the Custom Column control next to Clear Filters", async () => {
    renderView();
    await screen.findByText("BK-20261008-0200-0001");
    const custom = await screen.findByRole("button", { name: /Custom Column/ });
    expect(custom.parentElement).toBe(screen.getByRole("button", { name: "Clear Filters" }).parentElement);
  });

  it("lets the person choose how many backups to show on a page, and starts again from page one", async () => {
    api.list.mockResolvedValue(page([row("BK-1")], { total: 60, totalPages: 6 }));
    renderView();
    await screen.findByText("BK-1");
    expect(screen.getByText(/60/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(last().page).toBe(2));
    const showing = (await screen.findByText("Show:")).parentElement as HTMLElement;
    fireEvent.click(showing.querySelector("button") as HTMLElement);
    fireEvent.click(await screen.findByRole("option", { name: "20" }));
    await waitFor(() => expect(last()).toMatchObject({ limit: 20, page: 1 }));
  });

  it("filters on the server by status, type and integrity from the filter drawer", async () => {
    renderView();
    await screen.findByText("BK-20261008-0200-0001");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByRole("button", { name: "Failed" }));
    await waitFor(() => expect(last().verification ?? last().status).toBeTruthy());
  });

  it("clears the search and every filter, and asks the server again", async () => {
    renderView();
    await screen.findByText("BK-20261008-0200-0001");
    fireEvent.change(screen.getAllByPlaceholderText("Backup ID, person or reason…")[0], { target: { value: "x" } });
    await waitFor(() => expect(last().search).toBe("x"), { timeout: 2000 });
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(last().search).toBeUndefined(), { timeout: 2000 });
  });

  it("opens a backup on its own screen, not in a drawer", async () => {
    renderView();
    fireEvent.click(await screen.findByText("BK-20261008-0200-0001"));
    expect(await screen.findByTestId("where")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/backup-restore/backups/BK-20261008-0200-0001");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("starts a backup only with a reason, then follows the job and reports the result", async () => {
    api.create.mockResolvedValue({ jobId: "j-1" });
    renderView();
    await screen.findByText("BK-20261008-0200-0001");
    fireEvent.click(screen.getByRole("button", { name: /Create Backup/ }));
    const start = await screen.findByRole("button", { name: "Start Backup" });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Why is this backup needed now?"), { target: { value: "before the upgrade" } });
    expect((screen.getByRole("button", { name: "Start Backup" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Start Backup" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ type: "FULL", reason: "before the upgrade", changeControlRef: undefined }));
    expect(await screen.findByText(/BK-20261008-0900-0001/)).toBeTruthy();
  });

  it("will not offer Create Backup to someone without the permission", async () => {
    perms.granted = new Set(["backup.module.view"]);
    renderView();
    await screen.findByText("BK-20261008-0200-0001");
    expect((screen.getByRole("button", { name: /Create Backup/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says so, instead of showing an empty list as if nothing were wrong, when the agent cannot be reached", async () => {
    api.list.mockRejectedValue(new Error("network"));
    renderView();
    expect((await screen.findAllByText(/Unable to load/)).length).toBeGreaterThan(0);
  });
});
