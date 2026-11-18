import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/services/api/settings", () => ({ settingsApi: {} }));
vi.mock("../ConfigHistory", () => ({ ConfigHistory: ({ page }: { page: string }) => <p>History of {page}</p> }));

import { GeneralTab } from "../GeneralTab";
import { changedGeneralTabs, generalTabFromParam, revertGeneralTab } from "../generalTabs";
import type { GeneralConfig } from "../../types";

const config = {
  systemName: "EQMS", systemDisplayName: "EQMS", systemLogo: "", systemFavicon: "", systemFooterLeft: "", adminEmail: "admin@example.com",
  maintenanceMode: false, dateTimeFormat: "DD/MM/YYYY HH:mm:ss", timeZone: "UTC", backupSettings: {}, locale: { language: "en", numberFormat: "en-US" },
  appearance: { theme: "light", primaryColor: "#10b981", compactMode: false, showBreadcrumbs: true, sidebarDefaultCollapsed: false, animationsEnabled: true },
} as unknown as GeneralConfig;

afterEach(() => cleanup());

const open = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

describe("General configuration tabs", () => {
  it("shows the five tabs and the History tab, opens Branding first and shows only the sections of the open tab", () => {
    render(<GeneralTab config={config} onChange={vi.fn()} />);

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Branding", "Sign-in Screen", "Appearance", "Module Display", "System", "History"]);
    expect(screen.getByRole("tab", { name: "Branding" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Header Title (Dashboard)")).toBeTruthy();
    expect(screen.queryByText("Sidebar")).toBeNull();
    expect(screen.queryByText("System Maintenance")).toBeNull();
  });

  it("puts every setting on exactly one tab", () => {
    render(<GeneralTab config={config} onChange={vi.fn()} />);

    open("Sign-in Screen");
    expect(screen.getByText("Sign-in screen layout")).toBeTruthy();
    expect(screen.getByText("Authentication Background")).toBeTruthy();
    expect(screen.queryByText("Main Layout")).toBeNull();

    open("Appearance");
    expect(screen.getByText("Page Backgrounds")).toBeTruthy();
    expect(screen.getByText("Main Layout")).toBeTruthy();
    expect(screen.queryByText("Authentication")).toBeNull();
    expect(screen.queryByText("Training Management")).toBeNull();

    open("Module Display");
    expect(screen.getByText("Training Management")).toBeTruthy();
    expect(screen.getByText("Audit Trail Tabs")).toBeTruthy();

    open("System");
    expect(screen.getByText("Admin Email")).toBeTruthy();
    expect(screen.getByText("Localization")).toBeTruthy();
    expect(screen.getByLabelText("Enable Maintenance Mode")).toBeTruthy();
  });

  it("draws what the page gives for the Module Display tab, and only there", () => {
    render(<GeneralTab config={config} onChange={vi.fn()} extra={<p>Dashboard defaults</p>} />);

    expect(screen.queryByText("Dashboard defaults")).toBeNull();
    open("Module Display");
    expect(screen.getByText("Dashboard defaults")).toBeTruthy();
  });

  it("follows the tab that the page keeps and reports a click", () => {
    const onTabChange = vi.fn();
    render(<GeneralTab config={config} onChange={vi.fn()} activeTab="system" onTabChange={onTabChange} />);

    expect(screen.getByText("Admin Email")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    expect(onTabChange).toHaveBeenCalledWith("appearance");
  });

  it("marks only the tabs that hold a change that is not saved yet", () => {
    const draft = { ...config, systemFooterLeft: "New", appearance: { ...config.appearance, loginLayout: "SPLIT" } } as unknown as GeneralConfig;
    render(<GeneralTab config={draft} savedConfig={config} onChange={vi.fn()} />);

    const marked = screen.getAllByRole("tab").filter((t) => t.querySelector('[role="img"][aria-label="Not saved yet"]')).map((t) => t.textContent);
    expect(marked).toEqual(["Branding", "Sign-in Screen"]);
  });
});

describe("changedGeneralTabs", () => {
  it("is empty when nothing differs, even though editing writes the default of two appearance fields", () => {
    const touched = { ...config, appearance: { ...config.appearance, showSidebarUserProfile: false, compactDesktopFilters: false } } as unknown as GeneralConfig;
    expect(changedGeneralTabs(touched, config).size).toBe(0);
    expect(changedGeneralTabs(config, null).size).toBe(0);
  });

  it("finds the tab of a changed field", () => {
    const draft = { ...config, maintenanceMode: true, appearance: { ...config.appearance, knowledgeOpenInNewTab: false, tableColumnDividers: true } } as unknown as GeneralConfig;
    expect([...changedGeneralTabs(draft, config)].sort()).toEqual(["appearance", "module-display", "system"]);
  });
});

describe("generalTabFromParam", () => {
  it("falls back to Branding for a missing or unknown value", () => {
    expect(generalTabFromParam(null)).toBe("branding");
    expect(generalTabFromParam("nope")).toBe("branding");
    expect(generalTabFromParam("sign-in")).toBe("sign-in");
  });
});

describe("General tab: discard and history", () => {
  it("discards the changes of the open tab only", () => {
    const onChange = vi.fn();
    const draft = { ...config, systemFooterLeft: "New", maintenanceMode: true, appearance: { ...config.appearance, loginLayout: "SPLIT" } } as unknown as GeneralConfig;
    render(<GeneralTab config={draft} savedConfig={config} onChange={onChange} activeTab="system" />);

    fireEvent.click(screen.getByRole("button", { name: "Discard changes in this tab" }));

    const next = onChange.mock.calls[0][0] as GeneralConfig;
    expect(next.maintenanceMode).toBe(false);
    expect(next.systemFooterLeft).toBe("New");
    expect((next.appearance as unknown as Record<string, unknown>).loginLayout).toBe("SPLIT");
  });

  it("puts a field that was never saved back to unset, in the top level and in the appearance", () => {
    const draft = { ...config, systemHeaderTitle: "Hello", appearance: { ...config.appearance, loginLayout: "SPLIT", tableColumnDividers: true } } as unknown as GeneralConfig;

    const branding = revertGeneralTab(draft, config, "branding") as unknown as Record<string, unknown>;
    expect("systemHeaderTitle" in branding).toBe(false);
    expect((branding.appearance as Record<string, unknown>).loginLayout).toBe("SPLIT");
    const signIn = revertGeneralTab(draft, config, "sign-in");
    expect((signIn.appearance as unknown as Record<string, unknown>).loginLayout).toBeUndefined();
    expect((signIn.appearance as unknown as Record<string, unknown>).tableColumnDividers).toBe(true);
  });

  it("opens the History of the page as its last tab", () => {
    render(<GeneralTab config={config} onChange={vi.fn()} activeTab="history" />);

    expect(screen.getByText("History of general")).toBeTruthy();
  });
});
