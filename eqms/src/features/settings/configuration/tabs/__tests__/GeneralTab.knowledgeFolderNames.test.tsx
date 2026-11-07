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
  systemFooterLeft: "",
  adminEmail: "admin@example.com",
  maintenanceMode: false,
  dateTimeFormat: "DD/MM/YYYY HH:mm:ss",
  timeZone: "UTC",
  backupSettings: {},
  locale: { language: "en", numberFormat: "en-US" },
  appearance: { theme: "light", primaryColor: "#10b981", compactMode: false, showBreadcrumbs: true, sidebarDefaultCollapsed: false, animationsEnabled: true },
} as unknown as GeneralConfig;

describe("GeneralTab > User Interface > Knowledge Base > Folder names", () => {
  it("shows the full name unless the administrator chose the abbreviation", () => {
    const { rerender } = render(<GeneralTab config={baseConfig} onChange={vi.fn()} />);
    expect(screen.getAllByText("Full name")).toHaveLength(2);
    rerender(<GeneralTab config={{ ...baseConfig, appearance: { ...baseConfig.appearance, knowledgeFolderNames: "ABBREVIATION" } }} onChange={vi.fn()} />);
    // the sidebar follows the layout until it is chosen on its own
    expect(screen.getAllByText("Abbreviation")).toHaveLength(2);
  });

  it("lets the sidebar differ from the layout", () => {
    render(<GeneralTab config={{ ...baseConfig, appearance: { ...baseConfig.appearance, knowledgeFolderNames: "FULL", knowledgeSidebarFolderNames: "ABBREVIATION" } }} onChange={vi.fn()} />);
    expect(screen.getAllByText("Full name")).toHaveLength(1);
    expect(screen.getAllByText("Abbreviation")).toHaveLength(1);
  });

  it("changes the sidebar names without touching the layout names", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={baseConfig} onChange={onChange} />);
    // the second select is the sidebar's
    fireEvent.click(screen.getAllByText("Full name")[1]);
    fireEvent.click(screen.getByText("Abbreviation"));
    const draft = onChange.mock.calls[0][0] as GeneralConfig;
    expect(draft.appearance?.knowledgeSidebarFolderNames).toBe("ABBREVIATION");
    expect(draft.appearance?.knowledgeFolderNames).toBeUndefined();
  });

  it("changes only the folder names setting", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={baseConfig} onChange={onChange} />);
    fireEvent.click(screen.getAllByText("Full name")[0]);
    fireEvent.click(screen.getByText("Abbreviation"));
    const draft = onChange.mock.calls[0][0] as GeneralConfig;
    expect(draft.appearance?.knowledgeFolderNames).toBe("ABBREVIATION");
    expect(draft.appearance?.theme).toBe("light");
    expect(draft.systemName).toBe("EQMS");
  });

  it("opens the Knowledge Base in a new tab unless the administrator turns that off", () => {
    const onChange = vi.fn();
    render(<GeneralTab config={baseConfig} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Open the Knowledge Base in a new browser tab" }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect((onChange.mock.calls[0][0] as GeneralConfig).appearance?.knowledgeOpenInNewTab).toBe(false);
  });
});
