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
  appearance: {
    theme: "light",
    primaryColor: "#10b981",
    compactMode: false,
    showBreadcrumbs: true,
    sidebarDefaultCollapsed: false,
    animationsEnabled: true,
    showSidebarUserProfile: true,
  },
} as unknown as GeneralConfig;

describe("GeneralTab Knowledge Base setting", () => {
  it("groups the interface options together and organizes branding/localization like SecurityTab", () => {
    render(<GeneralTab config={baseConfig} onChange={vi.fn()} />);
    const section = screen.getByRole('heading', { name: 'User Interface' }).closest('.rounded-xl');
    expect(section).toContainElement(screen.getByLabelText(/Show signed-in user profile/));
    expect(section).toContainElement(screen.getByLabelText('Use compact desktop filters'));
    expect(section).toContainElement(screen.getByLabelText(/Knowledge Base in the new Explorer/));
    for (const title of ['System Identity', 'Footer', 'Logos & Browser Icon', 'Sidebar',
      'Desktop Filters', 'Knowledge Base', 'Date & Time', 'Language & Numbers']) {
      expect(screen.getByText(title)).toHaveClass('uppercase', 'tracking-wide');
    }
  });

  it("updates desktop filters without changing the other configuration values", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={baseConfig} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Use compact desktop filters'));
    const draft = onChange.mock.calls[0][0] as GeneralConfig;
    expect(draft.appearance.compactDesktopFilters).toBe(true);
    expect(draft.appearance.showSidebarUserProfile).toBe(true);
    expect(draft.adminEmail).toBe(baseConfig.adminEmail);
    expect(draft.locale).toEqual(baseConfig.locale);
  });

  it("is off by default and explains what it does", () => {
    render(<GeneralTab config={baseConfig} onChange={vi.fn()} />);
    const checkbox = screen.getByLabelText(/Knowledge Base in the new Explorer/) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText(/opens a file-manager style explorer/)).toBeTruthy();
  });

  it("turns the Explorer on without losing the other appearance settings", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={baseConfig} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Knowledge Base in the new Explorer/));
    const saved = onChange.mock.calls[0][0] as GeneralConfig;
    expect(saved.appearance.knowledgeExplorerEnabled).toBe(true);
    expect(saved.appearance.showSidebarUserProfile).toBe(true);
    expect(saved.appearance.showBreadcrumbs).toBe(true);
    expect(saved.appearance.animationsEnabled).toBe(true);
  });

  it("keeps the Explorer setting when another appearance option changes", () => {
    const onChange = vi.fn();
    const enabled = { ...baseConfig, appearance: { ...baseConfig.appearance, knowledgeExplorerEnabled: true } } as GeneralConfig;
    render(<GeneralTab config={enabled} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Show signed-in user profile/));
    const saved = onChange.mock.calls[0][0] as GeneralConfig;
    expect(saved.appearance.showSidebarUserProfile).toBe(false);
    expect(saved.appearance.knowledgeExplorerEnabled).toBe(true);
  });

  it("turns the Explorer off again", () => {
    const onChange = vi.fn();
    const enabled = { ...baseConfig, appearance: { ...baseConfig.appearance, knowledgeExplorerEnabled: true } } as GeneralConfig;
    render(<GeneralTab config={enabled} onChange={onChange} />);
    const checkbox = screen.getByLabelText(/Knowledge Base in the new Explorer/) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect((onChange.mock.calls[0][0] as GeneralConfig).appearance.knowledgeExplorerEnabled).toBe(false);
  });
});
