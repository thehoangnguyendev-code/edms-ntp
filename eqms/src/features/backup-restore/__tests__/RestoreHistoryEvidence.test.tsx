import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { RestoreHistoryView } from "../views/RestoreHistoryView";

const api = vi.hoisted(() => ({ restoreRequests: vi.fn(), restoreEvidence: vi.fn() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));

const rejected = {
  id: "row-1",
  restoreNumber: "RS-20261009-0001",
  backupNumber: "BK-20261009-1900-0001",
  type: "R-FULL",
  target: "VALIDATION",
  status: "REJECTED",
  reason: "Test",
  changeControlRef: null,
  requestedBy: "requester.one",
  requestedAt: "2026-10-09T02:00:00Z",
  impactSha256: null,
  impact: null,
  rehearsalId: null,
  approvedBy: null,
  approvalSignatureRef: null,
  decidedAt: "2026-10-09T03:00:00Z",
  decisionReason: "Not needed",
};

beforeEach(() => {
  api.restoreRequests.mockReset();
  api.restoreEvidence.mockReset();
  api.restoreRequests.mockResolvedValue({ data: [rejected], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  URL.createObjectURL = vi.fn(() => "blob:evidence");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <RestoreHistoryView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Restore history: evidence pack download", () => {
  it("asks the server for the signed pack of the chosen request and offers it as a file", async () => {
    api.restoreEvidence.mockResolvedValue({ pack: '{"type":"RESTORE_EVIDENCE"}', sha256: "ab".repeat(32), signature: "c2ln", keyId: "f1d108b4c8608e4e" });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Download" }));

    await waitFor(() => expect(api.restoreEvidence).toHaveBeenCalledWith("RS-20261009-0001"));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:evidence");
  });

  it("shows the reason when the pack cannot be fetched and offers no file", async () => {
    api.restoreEvidence.mockRejectedValue(Object.assign(new Error("denied"), { response: { data: { message: "Permission required" } } }));
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Download" }));

    await waitFor(() => expect(api.restoreEvidence).toHaveBeenCalled());
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
