import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { RestoreRequestRecord } from "@/services/api/backupRestore";
import type { BackupRecord } from "../types";
import { RestoreRequestView } from "../RestoreRequestView";

const api = vi.hoisted(() => ({
  restoreRequests: vi.fn(),
  approveRestoreRequest: vi.fn(),
  rejectRestoreRequest: vi.fn(),
  createRestoreRequest: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  restoreReadiness: vi.fn(),
  rehearsals: vi.fn(),
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
// The real modal asks for the user's own password and verifies it on the server. Here it is a stand-in that hands over a token
// only when the person presses Sign, so the tests can show that approval waits for the signature.
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

const restoreRow = (over: Partial<RestoreRequestRecord> = {}): RestoreRequestRecord => ({
  id: "1", requestId: "RR-1", backupId: "BK-1", type: "R-FULL", target: "VALIDATION", status: "PENDING_APPROVAL", reason: "Drill",
  changeControlRef: null, requestedBy: "admin", requestedAt: "2026-10-09T01:00:00Z", impactSha256: null, impact: null, rehearsalId: null,
  approvedBy: null, approvalSignatureRef: null, decidedAt: null, decisionReason: null, ...over,
});
const pageOf = <T,>(data: T[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });

const backup = (over: Partial<BackupRecord> = {}): BackupRecord => ({
  id: "BK-20261008-0200-0001", type: "FULL", trigger: "SCHEDULED", status: "COMPLETED", startedAt: "2026-10-08T01:00:00Z", durationSec: 12,
  sizeBytes: 85_000_000, components: [], verification: "VERIFIED", verifiedAt: "2026-10-08T01:01:00Z", schemaVersion: "561", retention: "PERMANENT",
  legalHold: false, createdBy: "scheduler", ...over,
});

const Where: React.FC = () => <span data-testid="where">{useLocation().pathname}</span>;
const renderAt = (path: string, element: React.ReactNode) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/backup-restore/restores/new" element={element} />
            <Route path="*" element={<Where />} />
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
  perms.granted = new Set(["backup.restore.approve", "backup.restore.request"]);
  api.rehearsals.mockResolvedValue(pageOf([]));
});
afterEach(cleanup);

describe("New Restore Request", () => {
  const completed = [backup()];
  beforeEach(() => {
    api.list.mockResolvedValue(pageOf(completed));
    api.get.mockImplementation(async (id: string) => backup({ id }));
    api.restoreReadiness.mockImplementation(async (id: string) => ({ backupId: id, maxAgeDays: 30, testRestore: null }));
  });

  const pickBackupAndContinue = async () => {
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getAllByRole("button", { name: "Next" }).at(-1)!);
  };

  it("offers only completed and verified backups", async () => {
    renderAt("/backup-restore/restores/new", <RestoreRequestView />);
    await screen.findByRole("checkbox");
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: "COMPLETED", verification: "VERIFIED" }));
  });

  it("starts with the backup named in the link", async () => {
    renderAt("/backup-restore/restores/new?backup=BK-20261008-0200-0001", <RestoreRequestView />);
    await screen.findByRole("checkbox");
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Next" }).at(-1)! as HTMLButtonElement).disabled).toBe(false));
  });

  it("blocks a production request without a passed test restore in the last 30 days", async () => {
    renderAt("/backup-restore/restores/new", <RestoreRequestView />);
    await pickBackupAndContinue();
    fireEvent.click(screen.getByRole("button", { name: /Production/ }));
    fireEvent.change(screen.getByPlaceholderText("Why is this restore needed?"), { target: { value: "Data loss" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Change control reference/ }), { target: { value: "CC-2026-0142" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Next" }).at(-1)!);
    expect(await screen.findByText(/No passed test restore of this backup in the last 30 days/)).toBeTruthy();
    expect((screen.getAllByRole("button", { name: "Next" }).at(-1)! as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends the request for a validation restore and returns to the request list", async () => {
    api.createRestoreRequest.mockResolvedValue(restoreRow({ requestId: "RR-9" }));
    renderAt("/backup-restore/restores/new", <RestoreRequestView />);
    await pickBackupAndContinue();
    fireEvent.change(screen.getByPlaceholderText("Why is this restore needed?"), { target: { value: "Annual drill" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Next" }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: "Next" }).at(-1)!);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit for Approval" }));
    await waitFor(() =>
      expect(api.createRestoreRequest).toHaveBeenCalledWith("BK-20261008-0200-0001", {
        type: "R-FULL",
        target: "VALIDATION",
        reason: "Annual drill",
        changeControlRef: undefined,
      }),
    );
    expect(await screen.findByTestId("where")).toBeTruthy();
  });
});
