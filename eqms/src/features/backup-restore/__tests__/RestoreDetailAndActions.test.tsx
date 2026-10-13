import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { RestoreRequestRecord } from "@/services/api/backupRestore";
import { RestoreRequestDetailView } from "../views/RestoreRequestDetailView";
import { RestoreRequestsView } from "../views/RestoreRequestsView";

const api = vi.hoisted(() => ({
  restoreRequests: vi.fn(),
  restoreRequest: vi.fn(),
  get: vi.fn(),
  approveRestoreRequest: vi.fn(),
  rejectRestoreRequest: vi.fn(),
}));
const session = vi.hoisted(() => ({ username: "approver.test1" }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: session.username } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return { ...actual, useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }) };
});
vi.mock("@/components/ui/esign-modal/ESignatureModal", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    ESignatureModal: (props: { isOpen: boolean; meaningCode?: string; onConfirm: (data: { signatureToken: string }) => unknown }) =>
      props.isOpen
        ? React.createElement(
            "div",
            { role: "dialog", "aria-label": "Electronic signature" },
            React.createElement("span", null, `meaning:${props.meaningCode}`),
            React.createElement("button", { type: "button", onClick: () => void props.onConfirm({ signatureToken: "tok-1" }) }, "Sign"),
          )
        : null,
  };
});

const row = (over: Partial<RestoreRequestRecord> = {}): RestoreRequestRecord => ({
  id: "1", restoreNumber: "RS-1", backupNumber: "BK-1", type: "R-FULL", target: "VALIDATION", status: "PENDING_APPROVAL", reason: "Drill",
  changeControlRef: null, requestedBy: "admin", requestedAt: "2026-10-09T01:00:00Z", impactSha256: null,
  impact: {
    backupNumber: "BK-1", measuredAt: "2026-10-09T01:00:00Z", measuredBy: "agent", dbSnapshotAt: null, schemaVersion: "567",
    components: [{ key: "DATABASE", sizeBytes: 1000, objectCount: null, rows: 12 }, { key: "OBJECT_STORE", sizeBytes: 2000, objectCount: 5 }],
    rowsInBackup: 12, targets: [{ target: "T1", ok: true }], liveRowsAfterBackup: { measured: true, auditRows: 3 },
  },
  rehearsalId: null, approvedBy: null, approvalSignatureRef: null, decidedAt: null, decisionReason: null, events: [], ...over,
});
const page = (data: RestoreRequestRecord[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });
const backupDetail = {
  id: "BK-1", type: "FULL", trigger: "SCHEDULED", status: "COMPLETED", startedAt: "2026-10-08T01:00:00Z", durationSec: 12, sizeBytes: 3000,
  components: [{ key: "DATABASE", status: "COMPLETED", sizeBytes: 1000 }, { key: "OBJECT_STORE", status: "COMPLETED", sizeBytes: 2000 }],
  verification: "VERIFIED", verifiedAt: "2026-10-08T01:01:00Z", schemaVersion: "567", legalHold: false, createdBy: "scheduler",
  locations: [{ target: "T1", path: "/backup/t1", ok: true }],
};

const renderRoutes = (path: string, routes: [string, React.ReactNode][]) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            {routes.map(([route, element]) => (
              <Route key={route} path={route} element={element} />
            ))}
            <Route path="*" element={<span>elsewhere</span>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

const renderAt = (path: string, element: React.ReactNode, route: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={route} element={element} />
            <Route path="*" element={<span>elsewhere</span>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  session.username = "approver.test1";
  perms.granted = new Set(["backup.module.view", "backup.restore.approve", "backup.restore.request"]);
  api.get.mockResolvedValue(backupDetail);
});
afterEach(cleanup);

describe("Restore request detail", () => {
  it("shows the four steps and where the request stands", async () => {
    api.restoreRequest.mockResolvedValue(row({ status: "PENDING_APPROVAL" }));
    renderAt("/backup-restore/restores/RS-1", <RestoreRequestDetailView />, "/backup-restore/restores/:requestId");
    expect((await screen.findAllByText("Requested")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending Approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
    expect(screen.getByText("Approve")).toBeTruthy();
  });

  it("shows what the restore would put back, from the backup and from the impact report", async () => {
    api.restoreRequest.mockResolvedValue(row());
    renderAt("/backup-restore/restores/RS-1", <RestoreRequestDetailView />, "/backup-restore/restores/:requestId");
    // each section is a tab: open the impact tab first
    fireEvent.click(await screen.findByText("What This Restore Puts Back"));
    expect(screen.getByText("Backup to Restore")).toBeTruthy();
    expect(await screen.findByText("Documents")).toBeTruthy();
    expect(screen.getByText("Audit rows lost")).toBeTruthy();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("approves only through the electronic signature, and sends the token", async () => {
    api.restoreRequest.mockResolvedValue(row());
    api.approveRestoreRequest.mockResolvedValue(row({ status: "APPROVED", approvedBy: "approver.test1" }));
    renderAt("/backup-restore/restores/RS-1", <RestoreRequestDetailView />, "/backup-restore/restores/:requestId");
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(screen.getByText("meaning:BACKUP_RESTORE_APPROVAL")).toBeTruthy();
    expect(api.approveRestoreRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    await waitFor(() => expect(api.approveRestoreRequest).toHaveBeenCalledWith("RS-1", "tok-1"));
  });

  it("rejects with a reason and then the rejection signature", async () => {
    api.restoreRequest.mockResolvedValue(row());
    api.rejectRestoreRequest.mockResolvedValue(row({ status: "REJECTED" }));
    renderAt("/backup-restore/restores/RS-1", <RestoreRequestDetailView />, "/backup-restore/restores/:requestId");
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Not this backup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to sign" }));
    expect(screen.getByText("meaning:BACKUP_RESTORE_REJECTION")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    await waitFor(() => expect(api.rejectRestoreRequest).toHaveBeenCalledWith("RS-1", "Not this backup", "tok-1"));
  });

  it("hides the decision buttons from the requester, who has no other action on the request", async () => {
    session.username = "admin";
    api.restoreRequest.mockResolvedValue(row({ requestedBy: "admin" }));
    renderAt("/backup-restore/restores/RS-1", <RestoreRequestDetailView />, "/backup-restore/restores/:requestId");
    expect((await screen.findAllByText("Requested")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});

describe("Restore requests list actions", () => {
  it("offers View Detail and, for another person's pending request, Approve Request", async () => {
    api.restoreRequests.mockResolvedValue(page([row({ restoreNumber: "RS-1", requestedBy: "admin" })]));
    renderAt("/backup-restore/restores", <RestoreRequestsView />, "/backup-restore/restores");
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "View Detail" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve Request" })).toBeTruthy();
  });

  it("does not offer Approve Request on the person's own request", async () => {
    session.username = "admin";
    api.restoreRequests.mockResolvedValue(page([row({ restoreNumber: "RS-1", requestedBy: "admin" })]));
    renderAt("/backup-restore/restores", <RestoreRequestsView />, "/backup-restore/restores");
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "View Detail" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve Request" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens the detail screen to approve from the menu, and signs there", async () => {
    api.restoreRequests.mockResolvedValue(page([row({ restoreNumber: "RS-1", requestedBy: "admin" })]));
    api.restoreRequest.mockResolvedValue(row({ restoreNumber: "RS-1", requestedBy: "admin" }));
    api.approveRestoreRequest.mockResolvedValue(row({ status: "APPROVED" }));
    renderRoutes("/backup-restore/restores", [
      ["/backup-restore/restores", <RestoreRequestsView />],
      ["/backup-restore/restores/:requestId", <RestoreRequestDetailView />],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve Request" }));
    expect(await screen.findByText("meaning:BACKUP_RESTORE_APPROVAL")).toBeTruthy();
    expect(api.approveRestoreRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    await waitFor(() => expect(api.approveRestoreRequest).toHaveBeenCalledWith("RS-1", "tok-1"));
  });

  it("opens the detail screen to reject from the menu: reason first, then the rejection signature", async () => {
    api.restoreRequests.mockResolvedValue(page([row({ restoreNumber: "RS-1", requestedBy: "admin" })]));
    api.restoreRequest.mockResolvedValue(row({ restoreNumber: "RS-1", requestedBy: "admin" }));
    api.rejectRestoreRequest.mockResolvedValue(row({ status: "REJECTED" }));
    renderRoutes("/backup-restore/restores", [
      ["/backup-restore/restores", <RestoreRequestsView />],
      ["/backup-restore/restores/:requestId", <RestoreRequestDetailView />],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject Request" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Wrong backup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to sign" }));
    expect(screen.getByText("meaning:BACKUP_RESTORE_REJECTION")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    await waitFor(() => expect(api.rejectRestoreRequest).toHaveBeenCalledWith("RS-1", "Wrong backup", "tok-1"));
  });

  it("opens the backup from its Backup Number", async () => {
    api.restoreRequests.mockResolvedValue(page([row({ restoreNumber: "RS-1", backupNumber: "BK-1", requestedBy: "admin" })]));
    renderRoutes("/backup-restore/restores", [
      ["/backup-restore/restores", <RestoreRequestsView />],
      ["/backup-restore/backups/:backupId", <span>backup detail page</span>],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "BK-1" }));
    expect(await screen.findByText("backup detail page")).toBeTruthy();
  });

  it("names the request column Restore Number", async () => {
    api.restoreRequests.mockResolvedValue(page([row({ restoreNumber: "RS-1", requestedBy: "admin" })]));
    renderAt("/backup-restore/restores", <RestoreRequestsView />, "/backup-restore/restores");
    expect(await screen.findByText("Restore Number")).toBeTruthy();
  });
});
