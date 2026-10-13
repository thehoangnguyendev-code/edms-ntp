import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { BackupAlertRecord } from "@/services/api/backupRestore";
import { BackupAlertsView } from "../views/BackupAlertsView";

const api = vi.hoisted(() => ({ alerts: vi.fn(), acknowledgeAlert: vi.fn(), alertRecipients: vi.fn(), addAlertRecipient: vi.fn(), removeAlertRecipient: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));

const alert = (over: Partial<BackupAlertRecord> = {}): BackupAlertRecord => ({
  id: "11111111-2222-3333-4444-555555555555",
  at: "2026-10-13T02:00:00Z",
  severity: "HIGH",
  code: "BACKUP_V2_MISSED",
  detail: "The weekly V2 verification did not run on schedule",
  ref: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.alerts.mockResolvedValue({ data: [alert()], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
  api.alertRecipients.mockResolvedValue([{ username: "dco.test1", addedBy: "admin", addedAt: "2026-10-13T01:00:00Z" }]);
  api.acknowledgeAlert.mockResolvedValue({ id: alert().id, acknowledgedBy: "admin" });
  api.addAlertRecipient.mockResolvedValue({ username: "qa.reviewer", addedBy: "admin", addedAt: "2026-10-13T02:00:00Z" });
  api.removeAlertRecipient.mockResolvedValue(undefined);
  perms.granted = new Set(["backup.admin.alerts.view", "backup.admin.alerts.manage"]);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(cleanup);

const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <BackupAlertsView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Backup alerts and recipients", () => {
  it("lists the open alerts from the server and the people who receive them", async () => {
    renderView();
    expect(await screen.findByText("BACKUP_V2_MISSED")).toBeTruthy();
    expect(screen.getByText("dco.test1")).toBeTruthy();
    expect(api.alerts).toHaveBeenCalledWith(expect.objectContaining({ state: "OPEN", page: 1, limit: 10 }));
  });

  it("acknowledges an alert with the note typed, through the server", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Checked with the agent log" } });
    // two buttons carry the name: the row's and the one that confirms in the dialog; the dialog's is the last one
    const confirm = screen.getAllByRole("button", { name: "Acknowledge" }).pop() as HTMLElement;
    fireEvent.click(confirm);

    await waitFor(() => expect(api.acknowledgeAlert).toHaveBeenCalledWith(alert().id, "Checked with the agent log"));
  });

  it("adds a recipient by username and removes one", async () => {
    renderView();
    await screen.findByText("dco.test1");
    fireEvent.change(screen.getByRole("textbox", { name: "Username" }), { target: { value: "qa.reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    await waitFor(() => expect(api.addAlertRecipient).toHaveBeenCalledWith("qa.reviewer"));

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.removeAlertRecipient).toHaveBeenCalledWith("dco.test1"));
  });

  it("offers no change to someone who may only view the alerts", async () => {
    perms.granted = new Set(["backup.admin.alerts.view"]);
    renderView();
    await screen.findByText("BACKUP_V2_MISSED");
    expect(screen.queryByRole("button", { name: "Acknowledge" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add recipient" })).toBeNull();
  });
});
