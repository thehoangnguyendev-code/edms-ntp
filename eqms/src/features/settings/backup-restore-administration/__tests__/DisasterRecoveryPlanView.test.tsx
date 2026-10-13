import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { DisasterRecoveryPlanView } from "../DisasterRecoveryPlanView";

const api = vi.hoisted(() => ({
  drScenarios: vi.fn(),
  drKit: vi.fn(),
  drAuthority: vi.fn(),
  verifyDrKitItem: vi.fn(),
  changeDrAuthority: vi.fn(),
}));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
const esign = vi.hoisted(() => ({ confirm: undefined as undefined | ((data: { signatureToken?: string }) => unknown) }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: { ...actual.backupRestoreApi, ...api } };
});
vi.mock("@/services/api/metadata", () => ({
  metadataApi: {
    getUsersLookup: async () => [
      { id: "u1", username: "qa.lead", fullName: "Quality Lead", accessProfiles: [] },
      { id: "u2", username: "", fullName: "Without Login", accessProfiles: [] },
    ],
  },
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: (props: { isOpen: boolean; meaningCode?: string; onConfirm: (data: { signatureToken?: string }) => unknown }) => {
    if (!props.isOpen) return null;
    esign.confirm = props.onConfirm;
    return <div data-testid="esign">meaning:{props.meaningCode}</div>;
  },
}));

const kitItem = (code: string, label: string, verified: boolean) => ({
  code,
  label,
  detail: "detail",
  lastVerifiedAt: verified ? "2026-10-10T08:00:00Z" : null,
  lastVerifiedBy: verified ? "admin" : null,
  note: null,
  state: verified ? "VERIFIED" : "NOT_VERIFIED",
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.drScenarios.mockResolvedValue([
    { code: "SERVER_LOSS", label: "Server lost, site intact", description: "Hardware failure.", rpoHours: 24, rtoHours: 24, status: "PROPOSED", approvedBy: null, approvedAt: null },
  ]);
  api.drKit.mockResolvedValue([kitItem("RUNBOOK", "Step-by-step rebuild procedure", false), kitItem("BACKUP_KEY", "Backup encryption key custody", true)]);
  api.drAuthority.mockResolvedValue({ key: "DECLARATION_AUTHORITY", value: "admin" });
  api.verifyDrKitItem.mockResolvedValue(undefined);
  api.changeDrAuthority.mockResolvedValue({ key: "DECLARATION_AUTHORITY", value: "qa.lead" });
  perms.granted = new Set(["backup.admin.disaster_recovery.view", "backup.admin.disaster_recovery.manage"]);
  esign.confirm = undefined;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(cleanup);

const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <DisasterRecoveryPlanView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Disaster Recovery Plan", () => {
  it("warns that a rebuild-kit item has never been verified, and shows who verified the others", async () => {
    renderView();
    expect(await screen.findByText(/item\(s\) have never been checked/)).toBeTruthy();
    expect(screen.getByText(/by admin/)).toBeTruthy();
  });

  it("records a check by a person with its date, through the server", async () => {
    renderView();
    fireEvent.click((await screen.findAllByRole("button", { name: "Record check" }))[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Record check" }).pop() as HTMLElement);
    await waitFor(() => expect(api.verifyDrKitItem).toHaveBeenCalledWith("RUNBOOK", expect.any(String), ""));
  });

  it("changes who may declare a disaster only after the electronic signature", async () => {
    renderView();
    await screen.findByText("Who may declare a disaster");
    fireEvent.click(screen.getAllByRole("button", { name: "Change" }).pop() as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: /qa.lead/ }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Delegate to QA" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));

    expect(await screen.findByText("meaning:BACKUP_DR_AUTHORITY_CHANGE")).toBeTruthy();
    expect(api.changeDrAuthority).not.toHaveBeenCalled();
    await esign.confirm?.({ signatureToken: "tok-7" });
    await waitFor(() => expect(api.changeDrAuthority).toHaveBeenCalledWith("qa.lead", "Delegate to QA", "tok-7"));
  });
});
