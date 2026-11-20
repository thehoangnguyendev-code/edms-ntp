import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider, useBreadcrumb } from "@/contexts/BreadcrumbContext";

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSessions: vi.fn(),
  getPasswordPolicy: vi.fn(),
  changePassword: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));
vi.mock("@/services/api/auth", () => ({ authApi: api }));
// Stable values, as the real providers give: a new object on every call would make the header loop for a reason that is not the screen's.
const stable = vi.hoisted(() => ({ auth: { user: { id: "1", fullName: "Test User", username: "test" }, updateUser: () => undefined }, toast: { showToast: vi.fn() }, branding: { navigationLabelOverrides: {} } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => stable.auth }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => stable.toast }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => stable.branding }));

import { ProfileView } from "../ProfileView";

/** Stands for the header: it re-renders whenever the breadcrumb context hands out a new value. */
const headerRenders = { count: 0 };
const BreadcrumbConsumer = () => {
  useBreadcrumb();
  headerRenders.count += 1;
  return null;
};

beforeEach(() => {
  headerRenders.count = 0;
  stable.toast.showToast.mockClear();
  api.changePassword.mockReset();
  api.getCurrentUser.mockResolvedValue({ fullName: "Test User", username: "test", email: "test@example.com", phone: "", accessProfileNames: [] });
  api.getSessions.mockResolvedValue([]);
  api.getPasswordPolicy.mockResolvedValue({ passwordMinLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: true });
});

const renderProfile = () =>
  render(
    <BreadcrumbProvider>
      <MemoryRouter>
        <BreadcrumbConsumer />
        <ProfileView />
      </MemoryRouter>
    </BreadcrumbProvider>,
  );

describe("ProfileView, saving", () => {
  it("keeps both Save buttons disabled until something is changed, and disabled again when the change is taken back", async () => {
    renderProfile();
    fireEvent.click(await screen.findByRole("tab", { name: "Password" }));
    const input = await screen.findByPlaceholderText("Enter new password");
    const saves = () => screen.getAllByRole("button", { name: "Save" });

    expect(saves()).toHaveLength(2);
    for (const save of saves()) expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: "A" } });
    for (const save of saves()) expect(save).toBeEnabled();
    fireEvent.change(input, { target: { value: "" } });
    for (const save of saves()) expect(save).toBeDisabled();
  });

  it("tells the person why the server refused the new password, for example a password used before", async () => {
    api.changePassword.mockRejectedValue({ response: { data: { error: { code: "BAD_REQUEST", message: "You cannot reuse any of your last 5 passwords" } } } });
    renderProfile();
    fireEvent.click(await screen.findByRole("tab", { name: "Password" }));
    fireEvent.change(await screen.findByPlaceholderText("Enter new password"), { target: { value: "Abcdef1!" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), { target: { value: "Abcdef1!" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

    await waitFor(() => expect(stable.toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", message: "You cannot reuse any of your last 5 passwords" })));
  });
});

describe("ProfileView, password reuse rule", () => {
  it("shows the rule before the person types, as a note and not as a tick", async () => {
    api.getPasswordPolicy.mockResolvedValue({ passwordMinLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: true, preventPasswordReuse: true, passwordHistoryCount: 5 });
    renderProfile();
    fireEvent.click(await screen.findByRole("tab", { name: "Password" }));

    expect(await screen.findByText(/Must be different from your last 5 passwords/)).toBeTruthy();
  });

  it("says nothing when the policy does not prevent reuse", async () => {
    api.getPasswordPolicy.mockResolvedValue({ passwordMinLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: true, preventPasswordReuse: false, passwordHistoryCount: 0 });
    renderProfile();
    fireEvent.click(await screen.findByRole("tab", { name: "Password" }));
    await waitFor(() => expect(api.getPasswordPolicy).toHaveBeenCalled());

    expect(screen.queryByText(/Must be different from your last/)).toBeNull();
  });
});

describe("ProfileView, typing a new password", () => {
  it("does not re-publish the breadcrumbs, so the header is left alone while the person types", async () => {
    renderProfile();

    fireEvent.click(await screen.findByRole("tab", { name: "Password" }));
    const input = await screen.findByPlaceholderText("Enter new password");
    await waitFor(() => expect(api.getPasswordPolicy).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const before = headerRenders.count;
    for (const text of ["A", "Ab", "Ab1", "Ab1!", "Ab1!x", "Ab1!xy"]) fireEvent.change(input, { target: { value: text } });

    // Six keystrokes. Before the fix every one of them cleared and re-set the breadcrumbs (two header renders each).
    expect(headerRenders.count - before).toBeLessThanOrEqual(1);
  });
});
