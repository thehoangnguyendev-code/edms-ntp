import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { queryUserAuthorizationSummary: mocks.query } }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "actor" } }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("../../components/EditAccessProfilesModal", () => ({ EditAccessProfilesModal: ({ isOpen, currentProfileIds }: { isOpen: boolean; currentProfileIds: string[] }) => isOpen ? <div>Assigned: {currentProfileIds.join(",")}</div> : null }));
import { SecurityAuthorizationTab } from "../SecurityAuthorizationTab";
import type { User } from "../../../types";
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { cleanup(); mocks.query.mockReset(); });
it("delegates search/paging and keeps off-page assignment IDs for editing", async () => {
  mocks.query.mockResolvedValue({ userId: "target", accessProfiles: [{ id: "one", name: "Server selected row", code: "P1", active: true }], assignedProfileIds: ["one", "two"], effectivePermissionCount: 12, pagination: { total: 11, totalPages: 2 } });
  render(<MemoryRouter><SecurityAuthorizationTab user={{ id: "target", fullName: "Target" } as User} canEdit mfaRequiredByAdmin={false} isEditingProfile onMfaRequiredByAdminChange={vi.fn()} /></MemoryRouter>);
  await screen.findByText("Server selected row");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(mocks.query).toHaveBeenLastCalledWith("target", { search: undefined, page: 2, limit: 10 }));
  fireEvent.change(screen.getByPlaceholderText("Search access profiles..."), { target: { value: "not-a-local-match" } });
  await waitFor(() => expect(mocks.query).toHaveBeenLastCalledWith("target", { search: "not-a-local-match", page: 1, limit: 10 }));
  expect(screen.getByText("Server selected row")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit Access Profile" }));
  expect(screen.getByText("Assigned: one,two")).toBeTruthy();
});

it("draws the pagination inside the frame of the table, and the MFA explanation across the full width in one short sentence", async () => {
  mocks.query.mockResolvedValue({ userId: "target", accessProfiles: [{ id: "one", name: "Server selected row", code: "P1", active: true }], assignedProfileIds: ["one"], effectivePermissionCount: 12, pagination: { total: 11, totalPages: 2 } });
  render(<MemoryRouter><SecurityAuthorizationTab user={{ id: "target", fullName: "Target" } as User} canEdit mfaRequiredByAdmin={false} isEditingProfile onMfaRequiredByAdminChange={vi.fn()} /></MemoryRouter>);
  await screen.findByText("Server selected row");

  const frame = screen.getByRole("table").closest(".rounded-xl");
  expect(frame?.contains(screen.getByRole("button", { name: "Next" }))).toBe(true);
  const explanation = screen.getByText(/The user must set up MFA before using the system/);
  expect(explanation.className).not.toMatch(/max-w-/);
  expect(screen.getByText("Search")).toBeTruthy();
});

it("shows the empty state of a search that matches nothing inside the table, keeping the search box", async () => {
  mocks.query.mockResolvedValueOnce({ userId: "target", accessProfiles: [{ id: "one", name: "Server selected row", code: "P1", active: true }], assignedProfileIds: ["one"], effectivePermissionCount: 1, pagination: { total: 1, totalPages: 1 } });
  mocks.query.mockResolvedValue({ userId: "target", accessProfiles: [], assignedProfileIds: ["one"], effectivePermissionCount: 1, pagination: { total: 0, totalPages: 1 } });
  render(<MemoryRouter><SecurityAuthorizationTab user={{ id: "target", fullName: "Target" } as User} canEdit mfaRequiredByAdmin={false} isEditingProfile onMfaRequiredByAdminChange={vi.fn()} /></MemoryRouter>);
  await screen.findByText("Server selected row");

  fireEvent.change(screen.getByPlaceholderText("Search access profiles..."), { target: { value: "zzz" } });

  expect(await screen.findByText("No access profiles found")).toBeTruthy();
  expect(screen.getByPlaceholderText("Search access profiles...")).toBeTruthy();
});
