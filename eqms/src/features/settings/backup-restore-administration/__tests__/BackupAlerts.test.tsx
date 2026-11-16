import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { AlertRuleRecord, BackupAlertRecord } from "@/services/api/backupRestore";
import { BackupAlertsView } from "../BackupAlertsView";

const api = vi.hoisted(() => ({
  alerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  alertRecipients: vi.fn(),
  addAlertRecipient: vi.fn(),
  removeAlertRecipient: vi.fn(),
  alertRules: vi.fn(),
  changeAlertRule: vi.fn(),
}));
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

const rule = (over: Partial<AlertRuleRecord> = {}): AlertRuleRecord => ({
  code: "CAPACITY_HIGH",
  label: "A backup target is nearly full",
  hint: "The share of the disk of a target that is used.",
  inApp: true,
  email: true,
  thresholdValue: 80,
  thresholdUnit: "% used",
  thresholdMin: 50,
  thresholdMax: 99,
  updatedBy: null,
  updatedAt: null,
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.alerts.mockResolvedValue({ data: [alert()], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
  api.alertRecipients.mockResolvedValue([{ username: "dco.test1", addedBy: "admin", addedAt: "2026-10-13T01:00:00Z" }]);
  api.acknowledgeAlert.mockResolvedValue({ id: alert().id, acknowledgedBy: "admin" });
  api.addAlertRecipient.mockResolvedValue({ username: "qa.reviewer", addedBy: "admin", addedAt: "2026-10-13T02:00:00Z" });
  api.removeAlertRecipient.mockResolvedValue(undefined);
  api.alertRules.mockResolvedValue([rule(), rule({ code: "BACKUP_FAILED", label: "A backup fails", hint: "A backup could not be written.", thresholdValue: null, thresholdUnit: null, thresholdMin: null, thresholdMax: null })]);
  api.changeAlertRule.mockResolvedValue(rule());
  perms.granted = new Set(["backup.admin.alerts.view", "backup.admin.alerts.manage"]);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(cleanup);

const renderView = (tab?: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[tab ? `/alerts?tab=${tab}` : "/alerts"]}>
          <BackupAlertsView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Backup alerts", () => {
  it("lists the open alerts from the server", async () => {
    renderView();
    expect(await screen.findByText("BACKUP_V2_MISSED")).toBeTruthy();
    expect(api.alerts).toHaveBeenCalledWith(expect.objectContaining({ state: "OPEN", page: 1, limit: 10 }));
  });

  it("is a live screen: no sample data, no design-preview notice, no Save Changes bar", async () => {
    renderView();
    await screen.findByText("BACKUP_V2_MISSED");
    expect(screen.queryByText("Design preview")).toBeNull();
    expect(screen.queryByText("Save Changes")).toBeNull();
    expect(screen.queryByDisplayValue("qa-admin@example.com")).toBeNull();
  });

  it("sorts on the server by the key of the column clicked, and asks again from the first page", async () => {
    renderView();
    await screen.findByText("BACKUP_V2_MISSED");
    const keys: Record<string, string> = { at: "at", severity: "severity", code: "code", ref: "ref", ack: "acknowledgedAt" };
    for (const [column, sortBy] of Object.entries(keys)) {
      fireEvent.click(document.querySelector(`[data-table-col="${column}"]`) as HTMLElement);
      await waitFor(() => expect(api.alerts).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy, page: 1 })));
    }
    expect(api.alerts).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "acknowledgedAt", sortDirection: "asc" }));
  });

  it("acknowledges an alert with the note typed, through the server", async () => {
    renderView();
    // the action is in the menu of the three dots, as in every table
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Checked with the agent log" } });
    const confirm = screen.getAllByRole("button", { name: "Acknowledge" }).pop() as HTMLElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(api.acknowledgeAlert).toHaveBeenCalledWith(alert().id, "Checked with the agent log"));
  });

  it("offers no change to someone who may only view the alerts", async () => {
    perms.granted = new Set(["backup.admin.alerts.view"]);
    renderView();
    await screen.findByText("BACKUP_V2_MISSED");
    expect(screen.queryByRole("button", { name: "Acknowledge" })).toBeNull();
  });
});

describe("Backup alert recipients", () => {
  it("lists the people who are told, adds one by username and removes one", async () => {
    renderView("recipients");
    await screen.findByText("dco.test1");
    fireEvent.change(screen.getByRole("textbox", { name: "Username" }), { target: { value: "qa.reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    await waitFor(() => expect(api.addAlertRecipient).toHaveBeenCalledWith("qa.reviewer"));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.removeAlertRecipient).toHaveBeenCalledWith("dco.test1"));
  });

  it("offers no change to someone who may only view", async () => {
    perms.granted = new Set(["backup.admin.alerts.view"]);
    renderView("recipients");
    await screen.findByText("dco.test1");
    expect(screen.queryByRole("button", { name: "Add recipient" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });
});

describe("Backup alert rules", () => {
  it("shows the rules the server holds, with their limits and channels", async () => {
    renderView("rules");
    expect(await screen.findByText("A backup target is nearly full")).toBeTruthy();
    expect(screen.getByText("80 % used")).toBeTruthy();
    expect(screen.getByText("A backup fails")).toBeTruthy();
    expect(api.alertRules).toHaveBeenCalled();
  });

  it("changes a rule only with a reason and a limit in range, and sends exactly what was chosen", async () => {
    renderView("rules");
    await screen.findByText("A backup target is nearly full");
    fireEvent.click(screen.getAllByRole("button", { name: "Change" })[0]);
    const save = () => screen.getAllByRole("button", { name: "Save" }).pop() as HTMLButtonElement;
    // nothing changed and no reason: not allowed
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "120" } });
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "The NAS is large" } });
    // 120 is outside 50-99
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "90" } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(api.changeAlertRule).toHaveBeenCalledWith("CAPACITY_HIGH", { inApp: true, email: true, threshold: 90, reason: "The NAS is large" }));
  });

  it("numbers the rules, and keeps no history of its own: the changes are in the Audit Trail", async () => {
    renderView("rules");
    await screen.findByText("A backup target is nearly full");
    const header = document.querySelector('[data-table-col="no"]');
    expect(header?.textContent).toContain("No.");
    expect(screen.queryByRole("tab", { name: "Change History" })).toBeNull();
    expect(screen.getByText(/Audit Trail/)).toBeTruthy();
  });

  it("offers no change to someone who may only view", async () => {
    perms.granted = new Set(["backup.admin.alerts.view"]);
    renderView("rules");
    await screen.findByText("A backup target is nearly full");
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  });
});
