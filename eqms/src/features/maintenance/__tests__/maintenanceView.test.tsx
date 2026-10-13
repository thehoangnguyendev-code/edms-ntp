import { cleanup, render, waitFor, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaintenanceModeView } from "@/features/auth/MaintenanceModeView";

const ctl = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/features/maintenance/maintenanceStatus", async () => {
  const actual = await vi.importActual<typeof import("@/features/maintenance/maintenanceStatus")>("@/features/maintenance/maintenanceStatus");
  return { ...actual, fetchMaintenanceStatus: ctl.fetch };
});
vi.mock("@/components/branding/BrandLogo", () => ({ BrandLogo: () => null }));

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={["/maintenance"]}>
      <Routes>
        <Route path="/maintenance" element={<MaintenanceModeView />} />
        <Route path="/login" element={<span>login page</span>} />
      </Routes>
    </MemoryRouter>,
  );

const status = (state: string, manual: boolean) => ({ state, endsAt: null, serverNow: new Date().toISOString(), locked: false, manual, source: "agent" as const });

beforeEach(() => ctl.fetch.mockReset());
afterEach(() => cleanup());

describe("maintenance page", () => {
  it("stays while the window is drained or locked", async () => {
    ctl.fetch.mockResolvedValue(status("DRAINED", false));
    renderAt();
    await waitFor(() => expect(ctl.fetch).toHaveBeenCalled());
    expect(screen.getByText(/down for maintenance/i)).toBeTruthy();
  });

  it("stays while the administrator's switch is on, even with the window closed", async () => {
    ctl.fetch.mockResolvedValue(status("NORMAL", true));
    renderAt();
    await waitFor(() => expect(ctl.fetch).toHaveBeenCalled());
    expect(screen.getByText(/down for maintenance/i)).toBeTruthy();
    expect(screen.queryByText("login page")).toBeNull();
  });

  it("leaves by itself once the window is closed and the switch is off", async () => {
    ctl.fetch.mockResolvedValue(status("NORMAL", false));
    renderAt();
    expect(await screen.findByText("login page")).toBeTruthy();
  });
});
