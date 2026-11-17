import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const branding = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/components/branding/BrandLogo", () => ({
  BrandLogo: () => <img alt="logo" />,
  useBranding: () => branding.value,
}));
vi.mock("@/components/branding/AuthVideoBackground", () => ({ AuthVideoBackground: () => null }));
vi.mock("@/utils/viewport", () => ({ resetViewportZoom: () => undefined, blurActiveInput: () => undefined }));

import { ForgotPasswordView } from "../ForgotPasswordView";
import { SPLIT_AUTH_UI, AUTH_UI } from "../auth-ui";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

const open = () => render(<MemoryRouter><ForgotPasswordView onBackToLogin={vi.fn()} onRequestSubmit={vi.fn()} /></MemoryRouter>);

it("draws every authentication screen in the split design when the administrator chose SPLIT: the card with the blue panel, the logo lifted to the corner, the split input and button", () => {
  branding.value = { loginLayout: "SPLIT", systemFooterLeft: "© {year} Example." };
  open();

  expect(document.querySelector('[data-login-layout="SPLIT"]')).toBeTruthy();
  expect(document.querySelector(".auth-brand")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Forgot Password" })).toBeTruthy();
  expect(screen.getByPlaceholderText("Enter your email or username").className).toContain("rounded-[10px]");
  expect(screen.getByRole("button", { name: "Send Reset Link" }).className).toContain("#3f3cf0");
});

it("keeps the classic design for the same screen when nothing was chosen", () => {
  branding.value = {};
  open();

  expect(document.querySelector('[data-login-layout="SPLIT"]')).toBeNull();
  expect(screen.getByPlaceholderText("Enter your email or username").className).toContain("rounded-xl");
  expect(screen.getByRole("button", { name: "Send Reset Link" }).className).toContain("bg-emerald-900");
});

it("has the same keys in both designs, so a screen can take either set unchanged", () => {
  expect(Object.keys(SPLIT_AUTH_UI).sort()).toEqual(Object.keys(AUTH_UI).sort());
});
