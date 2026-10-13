import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const prefs = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));

vi.mock("@/components/branding/BrandLogo", () => ({
  BrandLogo: () => <span>logo</span>,
  useBranding: () => ({ showSidebarUserProfile: false, knowledgeExplorerEnabled: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", permissions: ["documents.module.view"] }, logout: vi.fn() }),
}));
vi.mock("@/services/api", () => ({
  documentApi: { getPendingCounts: vi.fn(async () => ({ pendingReview: 0, pendingApproval: 0 })) },
  navigationApi: {
    getNavigation: vi.fn(async () => [
      { id: "self-service", label: "Self-Service", children: [{ id: "dashboard", label: "Dashboard" }, { id: "knowledge-base", label: "Knowledge" }] },
      { id: "doc-control", label: "Document Control", children: [{ id: "doc-all", label: "All Documents" }] },
    ]),
  },
}));
vi.mock("@/services/api/navigation", () => ({ invalidateNavigationCache: vi.fn() }));
vi.mock("@/services/api/notifications", () => ({ notificationApi: { getUnreadCount: vi.fn(async () => 0), getSummary: vi.fn(async () => ({})) } }));
vi.mock("@/features/notifications/events", () => ({ subscribeNotificationsChanged: () => () => undefined }));
vi.mock("@/services/api/userUiPreferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/userUiPreferences")>()),
  userUiPreferencesApi: prefs,
}));
vi.mock("../../header/SearchDropdown", () => ({ SearchDropdown: () => null }));

import { Sidebar } from "../Sidebar";

const renderSidebar = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Sidebar isCollapsed={false} activeId="" onNavigate={vi.fn()} isMobileOpen={false} onClose={vi.fn()} onToggleSidebar={vi.fn()} />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  prefs.get.mockResolvedValue({});
  prefs.save.mockResolvedValue(undefined);
});

describe("Sidebar favourites", () => {
  it("stars a menu together with everything beneath it and keeps that for the user on the server", async () => {
    renderSidebar();
    fireEvent.click(await screen.findByRole("button", { name: "Add Self-Service to favourites" }));

    expect(screen.getByRole("button", { name: "Remove Self-Service from favourites" })).toHaveAttribute("aria-pressed", "true");
    expect(prefs.save).toHaveBeenCalledWith("sidebar-favorites", { ids: ["self-service", "dashboard", "knowledge-base"] });
    expect(screen.getByRole("tab", { name: /Favourite/ })).toHaveTextContent("3");

    fireEvent.click(screen.getByRole("tab", { name: /Favourite/ }));
    const panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getByRole("button", { name: /^Self-Service/ })); // the group opens in place
    expect(await within(panel).findByRole("button", { name: /^Dashboard/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /^Knowledge/ })).toBeInTheDocument();
    expect(within(panel).queryByText("Document Control")).toBeNull();
  });

  it("starring one child shows it under its group, and the group's other children stay out", async () => {
    prefs.get.mockResolvedValue({ ids: ["knowledge-base"] });
    renderSidebar();
    await screen.findByRole("button", { name: /^Self-Service/ });
    fireEvent.click(screen.getByRole("tab", { name: /Favourite/ }));

    const panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getByRole("button", { name: /^Self-Service/ }));
    expect(await within(panel).findByRole("button", { name: /^Knowledge/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Dashboard/ })).toBeNull();
  });

  it("restores the user's stars from the server and drops one that is no longer allowed", async () => {
    prefs.get.mockResolvedValue({ ids: ["doc-control", "gone", "doc-all"] });
    renderSidebar();
    await screen.findByRole("button", { name: /^Self-Service/ });
    await waitFor(() => expect(screen.getByRole("tab", { name: /Favourite/ })).toHaveTextContent("2"));

    fireEvent.click(screen.getByRole("tab", { name: /Favourite/ }));
    expect(within(screen.getByRole("tabpanel")).getByRole("button", { name: /^Document Control/ })).toBeInTheDocument();
    expect(within(screen.getByRole("tabpanel")).queryByRole("button", { name: /^Self-Service/ })).toBeNull();
  });

  it("removing a starred menu removes everything beneath it too, and says so when none is left", async () => {
    prefs.get.mockResolvedValue({ ids: ["self-service", "dashboard", "knowledge-base"] });
    renderSidebar();
    await screen.findByRole("button", { name: /^Self-Service/ });
    fireEvent.click(screen.getByRole("tab", { name: /Favourite/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Remove Self-Service from favourites" }));

    expect(prefs.save).toHaveBeenLastCalledWith("sidebar-favorites", { ids: [] });
    expect(screen.getByText(/No favourites yet/)).toBeInTheDocument();
  });
});

describe("Collapsed sidebar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("toggles a flyout favourite without navigating or closing the menu", async () => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const onNavigate = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar isCollapsed activeId="dashboard" onNavigate={onNavigate} isMobileOpen={false} onClose={vi.fn()} onToggleSidebar={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /^Self-Service/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Add Knowledge to favourites" }));
    expect(prefs.save).toHaveBeenLastCalledWith("sidebar-favorites", { ids: ["knowledge-base"] });
    expect(screen.getByRole("button", { name: "Remove Knowledge from favourites" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Dashboard/ })).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove Knowledge from favourites" }));
    expect(prefs.save).toHaveBeenLastCalledWith("sidebar-favorites", { ids: [] });
  });

  it("fills the icon of the top-level menu that holds the current screen, and only that one", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar isCollapsed activeId="dashboard" onNavigate={vi.fn()} isMobileOpen={false} onClose={vi.fn()} onToggleSidebar={vi.fn()} />
      </MemoryRouter>,
    );
    const tile = await screen.findByTestId("collapsed-active-tile");
    expect(tile.className).toContain("bg-emerald-100");
    expect(screen.getAllByTestId("collapsed-active-tile")).toHaveLength(1);
  });
});
