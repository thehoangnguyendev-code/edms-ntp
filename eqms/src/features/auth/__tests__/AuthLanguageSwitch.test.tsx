import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const lang = vi.hoisted(() => ({ setLanguage: vi.fn(async () => undefined), language: "vi" as "vi" | "en" }));
vi.mock("@/i18n", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useLanguage: () => ({ language: lang.language, setLanguage: lang.setLanguage, t: (_k: string, f: string) => f, tLabel: (e: string) => e }),
}));
const branding = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/components/branding/BrandLogo", () => ({ BrandLogo: () => <img alt="logo" />, useBranding: () => branding.value }));
vi.mock("@/components/branding/AuthVideoBackground", () => ({ AuthVideoBackground: () => null }));
vi.mock("@/utils/viewport", () => ({ resetViewportZoom: () => undefined, blurActiveInput: () => undefined }));

import { AuthLanguageSwitch } from "../components/AuthLanguageSwitch";
import { ForgotPasswordView } from "../ForgotPasswordView";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  lang.setLanguage.mockClear();
  lang.language = "vi";
});
afterEach(() => cleanup());

it("offers Tiếng Việt and English, marks the current one and switches the language when the other is chosen", () => {
  render(<AuthLanguageSwitch />);
  const vi = screen.getByRole("tab", { name: "Tiếng Việt" });
  const en = screen.getByRole("tab", { name: "English" });
  expect(vi.getAttribute("aria-selected")).toBe("true");
  fireEvent.click(en);
  expect(lang.setLanguage).toHaveBeenCalledWith("en");
});

it("is on the sign-in screen in both layouts", () => {
  for (const loginLayout of ["CLASSIC", "SPLIT"]) {
    branding.value = { loginLayout, systemFooterLeft: "© {year} Example." };
    const { unmount } = render(<MemoryRouter><ForgotPasswordView onBackToLogin={vi.fn()} onRequestSubmit={vi.fn()} /></MemoryRouter>);
    expect(document.querySelector("[data-auth-language]"), loginLayout).toBeTruthy();
    unmount();
  }
});
