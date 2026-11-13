import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ProductionRestoresView } from "../views/ProductionRestoresView";

const api = vi.hoisted(() => ({ list: vi.fn(), capabilities: vi.fn(), job: vi.fn(), restore: vi.fn(), finalize: vi.fn(), rollback: vi.fn() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, productionRestoreApi: api, backupRestoreApi: { list: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }) } };
});
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));

const waiting = {
  run_code: "RS-0123456789ab",
  backup_number: "BK-20261008-1900-0017",
  status: "PENDING_FINALIZATION",
  restored_by: "qa.one",
  restore_signature: "SIG-1",
  restored_at: "2026-11-09T02:00:00Z",
  closed_by: null,
  close_signature: null,
  closed_at: null,
  kept_old_db: "eqms-database_pre_0123456789ab",
  post_db: null,
};
const finalized = { ...waiting, run_code: "RS-ba9876543210", status: "FINALIZED", closed_by: "qa.two", close_signature: "SIG-2", closed_at: "2026-11-09T05:00:00Z" };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.list.mockResolvedValue({ data: [waiting, finalized], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(cleanup);

const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/restores"]}>
          <Routes>
            <Route path="/restores" element={<ProductionRestoresView />} />
            <Route path="/backup-restore/backups/:id" element={<div>detail of the backup</div>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Restore: who sees which action", () => {
  it("shows the restore button and the finalize and roll back actions only to a person who may use them", async () => {
    api.capabilities.mockResolvedValue({ view: true, restore: true, rollback: true, finalize: true });
    renderView();
    await screen.findByText("RS-0123456789ab");
    expect(screen.getByRole("button", { name: "Restore a Backup" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Finalize" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Roll Back" })).toHaveLength(1);
  });

  it("shows no action to a person with view only, and nothing for a restore that is already closed", async () => {
    api.capabilities.mockResolvedValue({ view: true, restore: false, rollback: false, finalize: false });
    renderView();
    await screen.findByText("RS-0123456789ab");
    expect(screen.queryByRole("button", { name: "Restore a Backup" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Finalize" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Roll Back" })).toBeNull();
  });

  it("lets a person who may only finalize finalize but not roll back, and warns that another restore is blocked", async () => {
    api.capabilities.mockResolvedValue({ view: true, restore: false, rollback: false, finalize: true });
    renderView();
    await screen.findByText("RS-0123456789ab");
    expect(screen.getByRole("button", { name: "Finalize" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Roll Back" })).toBeNull();
    expect(screen.getByText(/No other restore can start/)).toBeTruthy();
  });

  it("opens the backup in its own screen when its number is clicked", async () => {
    api.capabilities.mockResolvedValue({ view: true, restore: false, rollback: false, finalize: false });
    renderView();
    fireEvent.click((await screen.findAllByRole("button", { name: "BK-20261008-1900-0017" }))[0]);
    expect(await screen.findByText("detail of the backup")).toBeTruthy();
  });

  it("sends the part and both date ranges to the server and starts again from the first page", async () => {
    api.capabilities.mockResolvedValue({ view: true, restore: false, rollback: false, finalize: false });
    renderView();
    await screen.findByText("RS-0123456789ab");
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ part: undefined, restoredFrom: undefined, closedFrom: undefined, page: 1 }));
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "Files" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ part: "OBJECT_STORE", page: 1 })));
    for (const [column, sortBy] of Object.entries({ closedBy: "closedBy", components: "components" })) {
      fireEvent.click(document.querySelector(`[data-table-col="${column}"]`) as HTMLElement);
      await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy })));
    }
  });

  it("asks the server for the page, the filter and the sort instead of cutting the list here", async () => {
    api.capabilities.mockResolvedValue({ view: true, restore: false, rollback: false, finalize: false });
    renderView();
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(api.list.mock.calls[0][0]).toMatchObject({ sortBy: "restoredAt", sortDirection: "desc", page: 1, limit: 10 });
  });
});
