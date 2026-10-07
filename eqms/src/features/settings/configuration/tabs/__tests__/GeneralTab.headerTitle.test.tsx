import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/services/api/settings", () => ({ settingsApi: {} }));

import { GeneralTab } from "../GeneralTab";
import type { GeneralConfig } from "../../types";

const baseConfig = {
  systemName: "EQMS",
  systemDisplayName: "EQMS",
  systemLogo: "",
  systemFavicon: "",
  systemFooter: "",
  adminEmail: "admin@example.com",
  maintenanceMode: false,
  dateTimeFormat: "DD/MM/YYYY HH:mm:ss",
  timeZone: "UTC",
  backupSettings: {},
  locale: { language: "en", numberFormat: "en-US" },
  appearance: { theme: "light", primaryColor: "#10b981", compactMode: false, showBreadcrumbs: true, sidebarDefaultCollapsed: false, animationsEnabled: true },
} as unknown as GeneralConfig;

const DEFAULT_TEXT = "Electronic Quality Management Software";
const input = () => screen.getByLabelText("Header Title (Dashboard)") as HTMLInputElement;

describe("GeneralTab > Branding > Header Title", () => {
  it("sits in the Branding section and shows the built-in text as the placeholder when nothing is set", () => {
    render(<GeneralTab config={baseConfig} onChange={vi.fn()} />);
    const branding = screen.getByRole("heading", { name: "Branding" }).closest(".rounded-xl");
    expect(branding).toContainElement(input());
    expect(input().value).toBe("");
    expect(input().placeholder).toBe(DEFAULT_TEXT);
    expect(screen.getByText(/Leave empty to use/)).toHaveTextContent(DEFAULT_TEXT);
    expect(screen.getByText(/stays there while the page is scrolled/)).toBeInTheDocument();
  });

  it("shows the configured text", () => {
    render(<GeneralTab config={{ ...baseConfig, systemHeaderTitle: "Quality Hub" }} onChange={vi.fn()} />);
    expect(input().value).toBe("Quality Hub");
  });

  it("changes only the header title", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={baseConfig} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "Quality Hub" } });
    const draft = onChange.mock.calls[0][0] as GeneralConfig;
    expect(draft.systemHeaderTitle).toBe("Quality Hub");
    expect(draft.systemFooter).toBe(baseConfig.systemFooter);
    expect(draft.systemDisplayName).toBe(baseConfig.systemDisplayName);
    expect(draft.appearance).toEqual(baseConfig.appearance);
  });

  it("keeps the title to one line of at most 120 characters, like the server requires", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={baseConfig} onChange={onChange} />);
    expect(input().maxLength).toBe(120);

    // A browser input drops line breaks by itself (jsdom does too); the tab is ours to turn into a space.
    fireEvent.change(input(), { target: { value: "two\nlines\there" } });
    const typed = (onChange.mock.calls[0][0] as GeneralConfig).systemHeaderTitle ?? "";
    expect(typed).not.toMatch(/[\r\n\t]/);
    expect(typed).toBe("twolines here");

    fireEvent.change(input(), { target: { value: "x".repeat(150) } });
    expect(((onChange.mock.calls[1][0] as GeneralConfig).systemHeaderTitle ?? "").length).toBe(120);
  });

  it("lets the administrator clear it to go back to the default", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={{ ...baseConfig, systemHeaderTitle: "Quality Hub" }} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "" } });
    expect((onChange.mock.calls[0][0] as GeneralConfig).systemHeaderTitle).toBe("");
  });
});
