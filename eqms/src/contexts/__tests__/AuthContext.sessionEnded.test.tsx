import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const storedUser = { id: "u1", username: "admin", fullName: "Admin", permissions: [] };

vi.mock("@/utils/security", () => ({
  secureStorage: { getItem: vi.fn(() => JSON.stringify(storedUser)), setItem: vi.fn(), removeItem: vi.fn() },
  tokenUtils: {},
  auditLog: { log: vi.fn() },
  csrfToken: { generate: () => "csrf", store: vi.fn() },
}));
vi.mock("@/services/authTokenStore", () => ({ authTokenStore: { get: () => "token", set: vi.fn(), clear: vi.fn() } }));
vi.mock("@/services/activeUser", () => ({ setActiveUserId: vi.fn(), clearActiveUserId: vi.fn() }));
vi.mock("@/components/layout/announcementDismissal", () => ({ clearDismissedAnnouncements: vi.fn() }));
vi.mock("@/services/api", () => ({
  authApi: {
    getCurrentUser: vi.fn(async () => ({ ...storedUser, email: "a@b.c" })),
    refreshToken: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from "../AuthContext";
import { dispatchSessionEnded } from "@/app/navigation/routeRedirect";

const Probe = () => {
  const { isAuthenticated, loading } = useAuth();
  return <div>{loading ? "loading" : isAuthenticated ? "signed-in" : "signed-out"}</div>;
};

beforeEach(() => undefined);
afterEach(() => cleanup());

it("drops the signed-in state when the API layer reports that the server ended the session, so the login page does not bounce back to the dashboard", async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("signed-in")).toBeTruthy());

  act(() => dispatchSessionEnded());

  expect(screen.getByText("signed-out")).toBeTruthy();
});
