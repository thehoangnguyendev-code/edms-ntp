import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { DrDrillsView } from "../views/DrDrillsView";

const api = vi.hoisted(() => ({ drDrills: vi.fn(), drScenarios: vi.fn(), recordDrDrill: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));

const scenario = { code: "SERVER_LOSS", label: "Server lost, site intact", description: "Hardware failure.", rpoHours: 24, rtoHours: 24, status: "PROPOSED", approvedBy: null, approvedAt: null };
const drill = {
  drillCode: "DR-20261013-001",
  scenario: "SERVER_LOSS",
  performedAt: "2026-10-12T02:00:00Z",
  lead: "Pham Quoc Dung",
  rpoTargetHours: 24,
  rtoTargetHours: 24,
  achievedRtoHours: 19.5,
  result: "PASSED",
  findings: null,
  recordedBy: "dr.lead",
  recordedAt: "2026-10-13T02:00:00Z",
};

beforeEach(() => {
  api.drDrills.mockReset();
  api.drScenarios.mockReset();
  api.recordDrDrill.mockReset();
  api.drDrills.mockResolvedValue({ data: [drill], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } });
  api.drScenarios.mockResolvedValue([scenario]);
  api.recordDrDrill.mockResolvedValue(drill);
  perms.granted = new Set(["backup.admin.disaster_recovery.view", "backup.admin.disaster_recovery.manage"]);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
});
afterEach(cleanup);

const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <DrDrillsView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

describe("Disaster recovery drills", () => {
  it("lists the recorded drills from the server, without any design-preview notice", async () => {
    renderView();
    expect(await screen.findByText("DR-20261013-001")).toBeTruthy();
    expect(screen.queryByText("Design preview")).toBeNull();
  });

  /** Fills the drill form with the shared controls: the scenario and result selects, the calendar picker, and the text fields. */
  const fillDrill = async (values: { scenario: RegExp; result?: RegExp; lead: string; hours: string }) => {
    const dialog = await screen.findByRole("dialog");
    const [scenarioBox, resultBox] = within(dialog).getAllByRole("combobox");
    fireEvent.click(scenarioBox);
    fireEvent.click(screen.getByRole("option", { name: values.scenario }));
    if (values.result) {
      fireEvent.click(resultBox);
      fireEvent.click(screen.getByRole("option", { name: values.result }));
    }
    fireEvent.click(within(dialog).getByText("Select date and time"));
    fireEvent.click(document.querySelector('[data-day="12"]') as HTMLElement);
    fireEvent.click(screen.getByText("Apply"));
    fireEvent.change(dialog.querySelector('input:not([type="number"])') as HTMLInputElement, { target: { value: values.lead } });
    fireEvent.change(dialog.querySelector('input[type="number"]') as HTMLInputElement, { target: { value: values.hours } });
    return dialog;
  };

  it("does not record a drill that did not pass cleanly without findings", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Record Disaster Recovery Drill" }));
    const dialog = await fillDrill({ scenario: /Server lost/, result: /^Failed$/, lead: "Pham Quoc Dung", hours: "30" });
    expect((screen.getByRole("button", { name: "Record drill" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(dialog.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Restore took longer than planned" } });
    expect((screen.getByRole("button", { name: "Record drill" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("records a drill through the server with its scenario, time and result", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Record Disaster Recovery Drill" }));
    await fillDrill({ scenario: /Server lost/, lead: "Pham Quoc Dung", hours: "19.5" });
    fireEvent.click(screen.getByRole("button", { name: "Record drill" }));

    await waitFor(() => expect(api.recordDrDrill).toHaveBeenCalledWith(expect.objectContaining({
      scenario: "SERVER_LOSS",
      lead: "Pham Quoc Dung",
      achievedRtoHours: 19.5,
      result: "PASSED",
    })));
  });

  it("sends the search, the filters and the sort to the server", async () => {
    renderView();
    await screen.findByText("DR-20261013-001");
    fireEvent.change(screen.getAllByPlaceholderText("Drill, scenario or person…")[0], { target: { value: "Dung" } });
    await waitFor(() => expect(api.drDrills).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Dung", sortBy: "performedAt", sortDirection: "desc", page: 1 })));
  });

  it("offers no recording to someone who may only view the drills", async () => {
    perms.granted = new Set(["backup.admin.disaster_recovery.view"]);
    renderView();
    await screen.findByText("DR-20261013-001");
    expect(screen.queryByRole("button", { name: "Record Disaster Recovery Drill" })).toBeNull();
  });
});
