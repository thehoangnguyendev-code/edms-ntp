import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ branding: { systemDisplayName: "Quality Management System", appIconVersion: "", appShortName: "" } as Record<string, string> }));
vi.mock("../BrandLogo", () => ({ useBranding: () => state.branding }));

import { PwaBranding } from "../PwaBranding";

beforeEach(() => {
  document.head.innerHTML = '<link rel="manifest" href="/pwa/manifest.webmanifest" /><link rel="apple-touch-icon" href="/pwa/icon/apple-touch-icon.png" />';
  state.branding = { systemDisplayName: "Quality Management System", appIconVersion: "", appShortName: "" };
});
afterEach(cleanup);

describe("PwaBranding", () => {
  it("leaves the manifest as the page loaded it, and adds the version to the touch icon only when a custom icon is set", () => {
    const manifest = document.querySelector('link[rel="manifest"]');
    const { rerender } = render(<PwaBranding />);
    expect(document.querySelector('link[rel="manifest"]')).toBe(manifest);
    expect(document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute("href")).toBe("/pwa/icon/apple-touch-icon.png");

    state.branding = { ...state.branding, appIconVersion: "abc123" };
    rerender(<PwaBranding />);
    expect(document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute("href")).toBe("/pwa/icon/apple-touch-icon.png?v=abc123");
  });

  it("replaces the manifest link when the icon changes, at the same address, so the browser reads it again", () => {
    const { rerender } = render(<PwaBranding />);
    const before = document.querySelector('link[rel="manifest"]');

    state.branding = { ...state.branding, appIconVersion: "v2" };
    rerender(<PwaBranding />);

    const after = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    expect(after).not.toBe(before);
    expect(after?.getAttribute("href")).toBe("/pwa/manifest.webmanifest");
    expect(document.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
  });

  it("writes the label iOS uses for the shortcut: the short name, or else the display name", () => {
    const { rerender } = render(<PwaBranding />);
    expect(document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content).toBe("Quality Management System");

    state.branding = { ...state.branding, appShortName: "EQMS QA" };
    rerender(<PwaBranding />);
    expect(document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content).toBe("EQMS QA");
  });
});
