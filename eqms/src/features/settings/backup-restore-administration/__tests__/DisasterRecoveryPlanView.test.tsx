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
  drReadiness: vi.fn(),
  drDeclarations: vi.fn(),
  declareDisaster: vi.fn(),
  closeDeclaration: vi.fn(),
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
  api.drReadiness.mockResolvedValue([
    { scenario: "SERVER_LOSS", dataSource: "NEWEST_VERIFIED_BACKUP", dataAgeHours: 3.2, rpoHours: 24, rpoState: "WITHIN", testedRestoreHours: 0.5, rtoHours: 24, rtoState: "WITHIN" },
  ]);
  api.drDeclarations.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  api.declareDisaster.mockResolvedValue({ code: "DR-2026-0001" });
  api.closeDeclaration.mockResolvedValue({ code: "DR-2026-0001" });
  perms.granted = new Set(["backup.admin.disaster_recovery.view", "backup.admin.disaster_recovery.manage"]);
  esign.confirm = undefined;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(cleanup);

const renderView = (tab?: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[tab ? `/dr?tab=${tab}` : "/dr"]}>
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

  it("shows each target next to what the records show now, from the server", async () => {
    renderView();
    expect(await screen.findByText("Targets Against The Records")).toBeTruthy();
    expect(await screen.findByText("3.2 h")).toBeTruthy();
    expect(screen.getAllByText("Within the target").length).toBe(2);
    expect(api.drReadiness).toHaveBeenCalled();
  });

  it("calls an item overdue when its check is older than the review period", async () => {
    api.drKit.mockResolvedValue([{ ...kitItem("RUNBOOK", "Step-by-step rebuild procedure", true), state: "OVERDUE" }]);
    renderView();
    expect(await screen.findByText("Rebuild kit checks are overdue")).toBeTruthy();
    expect(screen.getByText("Check overdue")).toBeTruthy();
  });

  it("declares a disaster only after the electronic signature, and sends exactly what was written", async () => {
    renderView("declarations");
    fireEvent.click(await screen.findByRole("button", { name: "Declare a Disaster" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Server lost, site intact" }));
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "The server room flooded" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));
    expect(await screen.findByText("meaning:BACKUP_DR_DECLARE")).toBeTruthy();
    expect(api.declareDisaster).not.toHaveBeenCalled();
    await esign.confirm?.({ signatureToken: "tok-9" });
    await waitFor(() => expect(api.declareDisaster).toHaveBeenCalledWith("SERVER_LOSS", "The server room flooded", "tok-9"));
  });

  it("lets only one declaration be open and closes it with a summary and a signature", async () => {
    api.drDeclarations.mockResolvedValue({
      data: [{ code: "DR-2026-0001", scenario: "SERVER_LOSS", scenarioLabel: "Server lost, site intact", status: "OPEN", declaredBy: "admin", declaredAt: "2026-11-11T01:00:00Z", reason: "flood", rpoTargetHours: 24, rtoTargetHours: 24, closedBy: null, closedAt: null, summary: null, hoursTaken: null }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    renderView("declarations");
    expect((await screen.findByRole("button", { name: "Declare a Disaster" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close the Open Declaration" }));
    await screen.findByRole("dialog");
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Rebuilt on the spare server" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));
    expect(await screen.findByText("meaning:BACKUP_DR_CLOSE")).toBeTruthy();
    await esign.confirm?.({ signatureToken: "tok-10" });
    await waitFor(() => expect(api.closeDeclaration).toHaveBeenCalledWith("DR-2026-0001", "Rebuilt on the spare server", "tok-10"));
  });

  it("searches and filters the declarations on the server by status and scenario", async () => {
    renderView("declarations");
    await screen.findByRole("button", { name: "Declare a Disaster" });
    await waitFor(() => expect(api.drDeclarations).toHaveBeenCalledWith(expect.objectContaining({ sortBy: "declaredAt", sortDirection: "desc", page: 1, limit: 10 })));
    fireEvent.change(screen.getAllByPlaceholderText("Declaration, scenario, person or reason…")[0], { target: { value: "flood" } });
    await waitFor(() => expect(api.drDeclarations).toHaveBeenLastCalledWith(expect.objectContaining({ search: "flood", page: 1 })), { timeout: 2000 });
    fireEvent.click(document.querySelector('[data-table-col="status"]') as HTMLElement);
    await waitFor(() => expect(api.drDeclarations).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "status" })));
    // the open declaration is read separately so the banner and the buttons do not depend on the page being shown
    expect(api.drDeclarations).toHaveBeenCalledWith({ status: "OPEN", page: 1, limit: 1 });
  });
});
