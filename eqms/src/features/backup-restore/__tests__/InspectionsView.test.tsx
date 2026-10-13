import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import type { InspectionRecord } from "@/services/api/backupRestore";
import { InspectionsView } from "../views/InspectionsView";

const api = vi.hoisted(() => ({
  inspections: vi.fn(),
  askInspection: vi.fn(),
  approveInspection: vi.fn(),
  rejectInspection: vi.fn(),
  closeInspection: vi.fn(),
}));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
const session = vi.hoisted(() => ({ username: "approver.test1" }));
const esign = vi.hoisted(() => ({ lastMeaning: "" as string, lastConfirm: undefined as undefined | ((data: { signatureToken?: string }) => unknown) }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: session.username } }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: (props: { isOpen: boolean; meaningCode?: string; onConfirm: (data: { signatureToken?: string }) => unknown }) => {
    if (!props.isOpen) return null;
    esign.lastMeaning = props.meaningCode ?? "";
    esign.lastConfirm = props.onConfirm;
    return <div data-testid="esign">meaning:{props.meaningCode}</div>;
  },
}));

const row = (over: Partial<InspectionRecord> = {}): InspectionRecord => ({
  id: "row-1",
  inspectionNumber: "IS-20261010-0002",
  backupNumber: "BK-20261009-1900-0001",
  status: "PENDING_APPROVAL",
  reason: "Look at revision 164",
  requestedBy: "admin",
  requestedAt: "2026-10-10T04:55:00Z",
  approvedBy: null,
  approvalSignatureRef: null,
  decidedAt: null,
  decisionReason: null,
  scratchDb: null,
  openedAt: null,
  expiresAt: null,
  closedAt: null,
  closedBy: null,
  closeReason: null,
  errorCode: null,
  errorDetail: null,
  ...over,
});

const page = (rows: InspectionRecord[]) => ({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.inspections.mockResolvedValue(page([row()]));
  perms.granted = new Set(["backup.module.view", "backup.restore.request", "backup.restore.approve"]);
  session.username = "approver.test1";
  esign.lastMeaning = "";
  esign.lastConfirm = undefined;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(cleanup);

const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <InspectionsView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Backup Inspections", () => {
  it("lists the inspections from the server with their status", async () => {
    renderView();
    expect(await screen.findByText("IS-20261010-0002")).toBeTruthy();
    expect(screen.getByText("Waiting for approval")).toBeTruthy();
    expect(api.inspections).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }));
  });

  it("offers approval only to a different person than the one who asked", async () => {
    renderView();
    await screen.findByText("IS-20261010-0002");
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();

    cleanup();
    session.username = "admin";
    renderView();
    await screen.findByText("IS-20261010-0002");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("approves only after the e-signature modal returns a token, and sends that token", async () => {
    api.approveInspection.mockResolvedValue(row({ status: "APPROVED" }));
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("meaning:BACKUP_INSPECTION_APPROVAL")).toBeTruthy();
    expect(api.approveInspection).not.toHaveBeenCalled();

    await esign.lastConfirm?.({ signatureToken: "tok-1" });
    await waitFor(() => expect(api.approveInspection).toHaveBeenCalledWith("IS-20261010-0002", "tok-1"));
  });

  it("rejects with a reason, then the e-signature for rejection", async () => {
    api.rejectInspection.mockResolvedValue(row({ status: "REJECTED" }));
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    await screen.findByRole("button", { name: "Continue to sign" });
    // the search box is a textbox too; the reason is the modal's textarea
    const reason = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(reason, { target: { value: "Not needed now" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));

    expect(await screen.findByText("meaning:BACKUP_INSPECTION_REJECTION")).toBeTruthy();
    await esign.lastConfirm?.({ signatureToken: "tok-2" });
    await waitFor(() => expect(api.rejectInspection).toHaveBeenCalledWith("IS-20261010-0002", "Not needed now", "tok-2"));
  });

  it("shows the copy's time left only while it is open", async () => {
    api.inspections.mockResolvedValue(page([row({ status: "OPEN", expiresAt: new Date(Date.now() + 240_000).toISOString(), approvedBy: "approver.test1" })]));
    renderView();
    expect(await screen.findByText(/left$/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close now" })).toBeTruthy();
  });
});
