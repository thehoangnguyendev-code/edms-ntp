import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const branding = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/components/branding/BrandLogo", () => ({
  BrandLogo: () => <img alt="logo" />,
  useBranding: () => branding.value,
}));
vi.mock("@/features/maintenance/LoginMaintenanceNotice", () => ({ LoginMaintenanceNotice: () => null }));
vi.mock("@/components/branding/AuthVideoBackground", () => ({ AuthVideoBackground: () => null }));
vi.mock("@/components/branding/loginLogoTransition", () => ({ captureLoginLogo: () => null, startLoginLogoTransition: vi.fn() }));
vi.mock("@/components/ui/loading/Loading", () => ({ FullPageLoading: () => null }));

import { LoginView } from "../LoginView";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

const renderLogin = (onLogin = vi.fn().mockResolvedValue({ success: false, error: "Invalid username or password." })) => {
  render(<MemoryRouter><LoginView onLogin={onLogin} /></MemoryRouter>);
  return onLogin;
};

it("shows the split sign-in screen when the administrator chose SPLIT, and signing in still goes through onLogin", async () => {
  branding.value = { loginLayout: "SPLIT", systemFooterLeft: "© {year} Example. All rights reserved.", systemFooterRight: "" };
  const onLogin = renderLogin();

  expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeTruthy();
  expect(document.querySelector('[data-login-layout="SPLIT"]')).toBeTruthy();
  expect(screen.getByText(`© ${new Date().getFullYear()} Example. All rights reserved.`)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Forgot password" })).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "admin" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
  fireEvent.click(screen.getByRole("button", { name: "Log In" }));

  await waitFor(() => expect(onLogin).toHaveBeenCalledWith("admin", "secret1"));
});

it("keeps the classic screen when nothing was chosen or the value is unknown", () => {
  for (const loginLayout of [undefined, "CLASSIC", "something-else"]) {
    branding.value = { loginLayout };
    const { unmount } = render(<MemoryRouter><LoginView onLogin={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Sign In To Your Account" })).toBeTruthy();
    expect(document.querySelector('[data-login-layout="SPLIT"]')).toBeNull();
    unmount();
  }
});

it("shows the field error under the field in the split screen", async () => {
  branding.value = { loginLayout: "SPLIT" };
  renderLogin();

  fireEvent.click(screen.getByRole("button", { name: "Log In" }));

  expect(await screen.findByText("Username or email is required")).toBeTruthy();
  expect(screen.getByText("Password is required")).toBeTruthy();
});
