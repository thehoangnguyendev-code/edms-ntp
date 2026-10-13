import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { RestoreRulesView } from "../views/RestoreRulesView";

const api = vi.hoisted(() => ({ restoreRules: vi.fn(), changeRestoreRule: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
const esign = vi.hoisted(() => ({ confirm: undefined as undefined | ((data: { signatureToken?: string }) => unknown), open: false }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: (props: { isOpen: boolean; meaningCode?: string; onConfirm: (data: { signatureToken?: string }) => unknown }) => {
    esign.open = props.isOpen;
    if (!props.isOpen) return null;
    esign.confirm = props.onConfirm;
    return <div data-testid="esign">meaning:{props.meaningCode}</div>;
  },
}));

const rule = {
  code: "REHEARSAL_MAX_AGE_DAYS",
  value: 30,
  min: 1,
  max: 90,
  description: "How many days a passed test restore stays valid.",
  updatedBy: "system",
  updatedAt: "2026-10-10T00:00:00Z",
};

beforeEach(() => {
  api.restoreRules.mockReset();
  api.changeRestoreRule.mockReset();
  api.restoreRules.mockResolvedValue([rule]);
  api.changeRestoreRule.mockResolvedValue({ code: rule.code, value: 45, previous: 30 });
  perms.granted = new Set(["backup.admin.restore_controls.view", "backup.admin.restore_rules.manage"]);
  esign.open = false;
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
          <RestoreRulesView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Restore approval and execution rules", () => {
  it("shows each rule with its value, its range and the fixed controls", async () => {
    renderView();
    expect(await screen.findByText("REHEARSAL_MAX_AGE_DAYS")).toBeTruthy();
    expect(screen.getByText(/Allowed: 1 to 90/)).toBeTruthy();
    expect(screen.getByText("The person who asked for a restore cannot approve it.")).toBeTruthy();
  });

  it("changes a rule only after the new value, the reason and the electronic signature", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "45" } });
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Annual restore plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));

    expect(await screen.findByText("meaning:BACKUP_RESTORE_RULE_CHANGE")).toBeTruthy();
    expect(api.changeRestoreRule).not.toHaveBeenCalled();
    await esign.confirm?.({ signatureToken: "tok-9" });
    await waitFor(() => expect(api.changeRestoreRule).toHaveBeenCalledWith("REHEARSAL_MAX_AGE_DAYS", 45, "Annual restore plan", "tok-9"));
  });

  it("refuses a value outside the range and an unchanged value", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "120" } });
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "why" } });
    expect((screen.getByRole("button", { name: "Continue to sign" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "30" } });
    expect((screen.getByRole("button", { name: "Continue to sign" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers no change to someone who may only view the rules", async () => {
    perms.granted = new Set(["backup.admin.restore_controls.view"]);
    renderView();
    await screen.findByText("REHEARSAL_MAX_AGE_DAYS");
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  });
});
