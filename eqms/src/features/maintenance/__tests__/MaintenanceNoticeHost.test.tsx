import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ logout: vi.fn(), user: null as null | { permissions: string[] } }));
const maintenance = vi.hoisted(() => ({ state: "LOCKED" as string }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ logout: auth.logout, user: auth.user }),
}));
vi.mock("@/features/maintenance/MaintenanceStatusProvider", () => ({
  useMaintenance: () => ({
    status: { state: maintenance.state, endsAt: null, requestId: "RS-1", manual: false },
    remaining: null,
    noticeOpen: false,
    closeNotice: vi.fn(),
  }),
}));

import { MaintenanceNoticeHost } from "../MaintenanceNoticeHost";

beforeEach(() => {
  auth.logout.mockReset().mockResolvedValue(undefined);
  maintenance.state = "LOCKED";
});
afterEach(cleanup);

const renderHost = () =>
  render(
    <MemoryRouter>
      <MaintenanceNoticeHost />
    </MemoryRouter>,
  );

describe("MaintenanceNoticeHost", () => {
  it("signs out a person without the maintenance bypass when the system is locked", async () => {
    auth.user = { permissions: ["documents.view"] };
    renderHost();
    await waitFor(() => expect(auth.logout).toHaveBeenCalled());
  });

  it("keeps a person with the maintenance bypass signed in while the system is locked", async () => {
    auth.user = { permissions: ["security.maintenance.bypass"] };
    renderHost();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
