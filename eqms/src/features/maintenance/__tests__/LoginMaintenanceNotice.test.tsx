import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MaintenanceStatus } from "../maintenanceStatus";

const fetchStatus = vi.hoisted(() => vi.fn());
vi.mock("../maintenanceStatus", async () => {
  const actual = await vi.importActual<typeof import("../maintenanceStatus")>("../maintenanceStatus");
  return { ...actual, fetchMaintenanceStatus: fetchStatus };
});

import { LoginMaintenanceNotice } from "../LoginMaintenanceNotice";

const status = (over: Partial<MaintenanceStatus> = {}): MaintenanceStatus => ({
  state: "NORMAL",
  endsAt: null,
  serverNow: new Date().toISOString(),
  locked: false,
  source: "agent",
  ...over,
});

beforeEach(() => fetchStatus.mockReset());
afterEach(cleanup);

describe("LoginMaintenanceNotice", () => {
  it("shows the countdown to the sign-in page while a notice runs", async () => {
    const now = Date.now();
    fetchStatus.mockResolvedValue(status({ state: "NOTICE", endsAt: new Date(now + 240_000).toISOString(), serverNow: new Date(now).toISOString() }));
    render(<LoginMaintenanceNotice />);
    expect(await screen.findByText(/System maintenance starts in 4:00/)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows nothing in normal operation", async () => {
    fetchStatus.mockResolvedValue(status());
    const { container } = render(<LoginMaintenanceNotice />);
    await waitFor(() => expect(fetchStatus).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("shows nothing after the window has started", async () => {
    fetchStatus.mockResolvedValue(status({ state: "DRAINED" }));
    const { container } = render(<LoginMaintenanceNotice />);
    await waitFor(() => expect(fetchStatus).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

});
