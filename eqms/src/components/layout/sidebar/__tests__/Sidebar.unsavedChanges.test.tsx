import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const prefs = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));

vi.mock("@/components/branding/BrandLogo", () => ({
  BrandLogo: () => <span>logo</span>,
  useBranding: () => ({ showSidebarUserProfile: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", permissions: ["settings.config_general.view"] }, logout: vi.fn() }),
}));
vi.mock("@/services/api", () => ({
  documentApi: { getPendingCounts: vi.fn(async () => ({ pendingReview: 0, pendingApproval: 0 })) },
  navigationApi: {
    getNavigation: vi.fn(async () => [
      {
        id: "system-administration", label: "System Administration", children: [
          {
            id: "config", label: "Configuration", children: [
              { id: "config-general", label: "General", path: "/settings/configuration/general" },
              { id: "config-security", label: "Security", path: "/settings/configuration/security" },
            ],
          },
        ],
      },
    ]),
  },
}));
vi.mock("@/services/api/navigation", () => ({ invalidateNavigationCache: vi.fn(), navigationApi: { getTaskCounts: vi.fn(async () => ({ counts: {}, shared: {} })) } }));
vi.mock("@/services/api/notifications", () => ({ notificationApi: { getUnreadCount: vi.fn(async () => 0), getSummary: vi.fn(async () => ({})) } }));
vi.mock("@/features/notifications/events", () => ({ subscribeNotificationsChanged: () => () => undefined }));
vi.mock("@/services/api/userUiPreferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/userUiPreferences")>()),
  userUiPreferencesApi: prefs,
}));
vi.mock("../../header/SearchDropdown", () => ({ SearchDropdown: () => null }));
vi.mock("@/components/ui/modal/NavigationGuardModal", () => ({
  NavigationGuardModal: ({ isOpen, onConfirm, currentPageTitle, destinationLabel }: any) =>
    isOpen ? <div role="dialog">Leave {currentPageTitle} for {destinationLabel}<button onClick={onConfirm}>Leave</button></div> : null,
}));

import { Sidebar } from "../Sidebar";
import { useReportUnsavedChanges } from "@/hooks/useReportUnsavedChanges";

/** Stands for a Configuration page that holds edits that were not saved. */
const PageWithEdits: React.FC<{ dirty: boolean }> = ({ dirty }) => {
  useReportUnsavedChanges("configuration-security", dirty);
  return null;
};

const onNavigate = vi.fn();
const renderSidebar = (dirty: boolean) =>
  render(
    <MemoryRouter initialEntries={["/settings/configuration/security"]}>
      <PageWithEdits dirty={dirty} />
      <Sidebar isCollapsed={false} activeId="config-security" onNavigate={onNavigate} isMobileOpen={false} onClose={vi.fn()} onToggleSidebar={vi.fn()} />
    </MemoryRouter>,
  );

/** The group of the page that is open is already open; the nested Configuration group opens with a click. */
const openGeneral = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /^Configuration/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^General/ }));
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  prefs.get.mockResolvedValue({});
  prefs.save.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("the sidebar and a Configuration page with edits that were not saved", () => {
  it("asks before it goes to another page of Configuration, and goes only when the person confirms", async () => {
    renderSidebar(true);
    await openGeneral();
    expect(await screen.findByRole("dialog")).toHaveTextContent("Leave");
    expect(screen.getByRole("dialog")).toHaveTextContent("General");
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("config-general"));
  });

  it("goes at once when the page has nothing that was not saved", async () => {
    renderSidebar(false);
    await openGeneral();
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("config-general"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
