import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const brandingState = vi.hoisted(() => ({ knowledgeOpenInNewTab: undefined as boolean | undefined }));

vi.mock("@/components/branding/BrandLogo", () => ({
  BrandLogo: () => <span>logo</span>,
  useBranding: () => ({ showSidebarUserProfile: false, knowledgeOpenInNewTab: brandingState.knowledgeOpenInNewTab }),
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
vi.mock("../../header/SearchDropdown", () => ({ SearchDropdown: () => null }));

import { Sidebar } from "../Sidebar";

const renderSidebar = (onNavigate: (id: string) => void, initialPath = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar isCollapsed={false} activeId="" onNavigate={onNavigate} isMobileOpen={false} onClose={vi.fn()} onToggleSidebar={vi.fn()} />
    </MemoryRouter>,
  );

const openKnowledgeBase = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /^Self-Service/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^Knowledge/ }));
};

describe("Sidebar Knowledge Base entry", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    brandingState.knowledgeOpenInNewTab = undefined;
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => openSpy.mockRestore());

  it("opens the Explorer in a new tab and leaves the current page alone", async () => {
    const onNavigate = vi.fn();
    renderSidebar(onNavigate);
    await openKnowledgeBase();
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith("/documents/knowledge/explorer", "_blank", "noopener,noreferrer"));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("opens the Explorer in a new tab when the administrator chose that", async () => {
    brandingState.knowledgeOpenInNewTab = true;
    const onNavigate = vi.fn();
    renderSidebar(onNavigate);
    await openKnowledgeBase();
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("opens the Explorer in the current tab, as a navigation, when the administrator turned the new tab off", async () => {
    brandingState.knowledgeOpenInNewTab = false;
    const onNavigate = vi.fn();
    renderSidebar(onNavigate);
    await openKnowledgeBase();
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("knowledge-base"));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("asks to confirm leaving an unsaved form when the Explorer replaces the current page", async () => {
    brandingState.knowledgeOpenInNewTab = false;
    const onNavigate = vi.fn();
    renderSidebar(onNavigate, "/documents/all/new");
    await openKnowledgeBase();
    await waitFor(() => expect(screen.getAllByText(/leave/i).length).toBeGreaterThan(0));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does not ask to confirm leaving an unsaved form, because nothing is left", async () => {
    const onNavigate = vi.fn();
    renderSidebar(onNavigate, "/documents/all/new");
    await openKnowledgeBase();
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/leave/i)).toBeNull();
  });

  it("still guards other menu entries on that form", async () => {
    const onNavigate = vi.fn();
    renderSidebar(onNavigate, "/documents/all/new");
    // Let the server-driven nav (mocked getNavigation, resolved async) settle before interacting --
    // otherwise a click can race the swap from the local fallback tree to the server-filtered one.
    await screen.findByRole("button", { name: /^Self-Service/ });
    fireEvent.click(await screen.findByRole("button", { name: /^Document Control/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^All Documents/ }));
    // The unsaved-changes confirmation intercepts it: the router is not asked to move yet.
    await waitFor(() => expect(screen.getAllByText(/leave/i).length).toBeGreaterThan(0));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });
});
