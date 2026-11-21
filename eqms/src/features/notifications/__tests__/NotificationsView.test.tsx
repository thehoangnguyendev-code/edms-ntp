import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const api = vi.hoisted(() => ({
  getSummary: vi.fn(), getNotifications: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn(), deleteNotification: vi.fn(),
  markGroupAsRead: vi.fn(), deleteNotifications: vi.fn(), clearAllRead: vi.fn(),
}));
vi.mock("@/services/api/notifications", () => ({ notificationApi: api }));
vi.mock("@/services/api/tableExport", () => ({ downloadTableExport: vi.fn() }));
const stable = vi.hoisted(() => ({
  toast: { showToast: vi.fn() },
  branding: { navigationLabelOverrides: {}, compactDesktopFilters: false, notificationInboxLayout: undefined as string | undefined },
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => stable.toast }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => stable.branding }));

import { NotificationsView } from "../NotificationsView";

const daysAgo = (days: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 30, 0);
  return d.toISOString();
};
const item = (id: string, over: Record<string, unknown> = {}) => ({
  id, type: "review-request", scope: "personal", title: `Title ${id}`, description: `Description ${id}`, module: "DOCUMENT_CONTROL", priority: "medium", status: "read",
  createdAt: daysAgo(0), actionUrl: null, relatedItem: null, metadata: null, ...over,
});
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });

const Where = () => <span data-testid="where">{useLocation().pathname}{useLocation().search}</span>;
const renderView = (path = "/notifications") =>
  render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={[path]}>
        <NotificationsView />
        <Where />
      </MemoryRouter>
    </BreadcrumbProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  stable.toast.showToast.mockReset();
  stable.branding.notificationInboxLayout = undefined;
  api.getSummary.mockResolvedValue({ all: 6, unread: 2, personal: 4, system: 2, byType: {}, byPriority: { critical: 1, high: 1, medium: 3, low: 1 } });
  api.getNotifications.mockResolvedValue(page([
    item("1", { status: "unread", priority: "critical", actionUrl: "/controlled-copies/9", relatedItem: { documentNumber: "CC-2026-0148" }, title: "Recall overdue" }),
    item("2", { status: "unread", priority: "high", title: "Review requested" }),
    item("3", { createdAt: daysAgo(1), title: "One day ago", priority: "low" }),
    item("4", { createdAt: daysAgo(5), title: "Older one" }),
    item("5", { createdAt: daysAgo(6), title: "Oldest one" }),
  ]));
  api.markAsRead.mockResolvedValue(undefined);
  api.deleteNotification.mockResolvedValue(undefined);
});

describe("Notifications inbox, priority tabs (the layout when nothing was chosen)", () => {
  it("has the tabs All, High, Medium, Low and Unread with their counts, and no scope tabs", async () => {
    renderView();
    await screen.findByText("Recall overdue");
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["All6", "High2", "Medium3", "Low1", "Unread2"]);
    expect(screen.getByRole("tab", { name: /^All/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("tab", { name: /For Me/ })).toBeNull();
  });

  it("asks the server for the priority of a tab, and for unread notifications with Unread", async () => {
    renderView();
    await screen.findByText("Recall overdue");
    fireEvent.click(screen.getByRole("tab", { name: /^High/ }));
    await waitFor(() => expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ priority: "critical,high", status: undefined })));
    expect(screen.getByRole("tab", { name: /^High/ }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: /^Unread/ }));
    await waitFor(() => expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ priority: undefined, status: "unread" })));
    fireEvent.click(screen.getByRole("tab", { name: /^All/ }));
    await waitFor(() => expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ priority: undefined, status: undefined })));
  });

  it("lights no tab while the filters are something no tab stands for", async () => {
    renderView("/notifications?priority=critical");
    await screen.findByText("Recall overdue");
    for (const tab of screen.getAllByRole("tab")) expect(tab.getAttribute("aria-selected")).toBe("false");
  });

  it("tells the priority of every line to a screen reader, as its icon colour tells it to the eye", async () => {
    renderView();
    await screen.findByText("Recall overdue");
    expect(screen.getAllByText("Priority: critical").length).toBe(1);
    expect(screen.getAllByText("Priority: low").length).toBe(1);
  });

  it("opens the record when the line is pressed, and marks an unread notification read", async () => {
    renderView();
    fireEvent.click((await screen.findByText("Recall overdue")).closest("button")!);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/controlled-copies/9"));
    expect(api.markAsRead).toHaveBeenCalledWith("1");
  });

  it("only marks a notification read when it has no record to open", async () => {
    renderView();
    fireEvent.click((await screen.findByText("Review requested")).closest("button")!);
    await waitFor(() => expect(api.markAsRead).toHaveBeenCalledWith("2"));
    expect(screen.getByTestId("where").textContent).toBe("/notifications");
  });

  it("says that the list could not be read, instead of showing an empty inbox, and tries again", async () => {
    api.getNotifications.mockRejectedValueOnce(new Error("down"));
    renderView();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Unable to load notifications/)).toBeTruthy();
    expect(screen.queryByText("You're all caught up!")).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Recall overdue")).toBeTruthy();
  });

  it("says the person is all caught up when there is nothing", async () => {
    api.getNotifications.mockResolvedValue(page([]));
    renderView();
    expect(await screen.findByText("You're all caught up!")).toBeTruthy();
  });

  it("shows no selection boxes until Select notifications is chosen, then marks the selection read", async () => {
    api.markGroupAsRead.mockResolvedValue(undefined);
    renderView();
    await screen.findByText("Recall overdue");
    expect(screen.queryAllByRole("checkbox", { name: "Select notification" })).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Select notifications" }));
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select notification" })[0]);
    expect(await screen.findByText("1 selected")).toBeTruthy();
    fireEvent.click(within(screen.getByText("1 selected").parentElement!).getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(api.markGroupAsRead).toHaveBeenCalledWith(["1"]));
  });

  it("is off in Mark all as read when nothing is unread", async () => {
    api.getSummary.mockResolvedValue({ all: 6, unread: 0, personal: 4, system: 2, byType: {}, byPriority: {} });
    renderView();
    await screen.findByText("Recall overdue");
    expect((screen.getByRole("button", { name: "Mark all as read" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Notifications inbox, timeline (chosen in Configuration)", () => {
  beforeEach(() => { stable.branding.notificationInboxLayout = "TIMELINE"; });

  it("has the scope tabs and groups the notifications by day on a timeline", async () => {
    renderView();
    await screen.findByText("Recall overdue");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["All Notifications6", "For Me4", "Systems2"]);
    const headings = screen.getAllByText(/^(Today|Yesterday|Earlier)/).map((h) => h.textContent?.replace(/\d.*$/, ""));
    expect(headings).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(screen.queryByRole("tab", { name: /^High/ })).toBeNull();
  });

  it("writes the priority on each card as a badge", async () => {
    renderView();
    await screen.findByText("Recall overdue");
    expect(screen.getByText("critical")).toBeTruthy();
    expect(screen.getByText("low")).toBeTruthy();
  });

  it("filters in the same card as the list, as User Management does, and asks the server for the priority chosen", async () => {
    renderView();
    await screen.findByText("Recall overdue");
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    fireEvent.click(screen.getByRole("combobox", { name: "Priority" }));
    fireEvent.click(await screen.findByRole("option", { name: "High" }));
    await waitFor(() => expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ priority: "high", page: 1 })));
  });

  it("asks the server for the scope of the tab", async () => {
    renderView();
    await screen.findByText("Recall overdue");
    fireEvent.click(screen.getByRole("tab", { name: /For Me/ }));
    await waitFor(() => expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "personal" })));
  });

  it("opens the record when the card is pressed", async () => {
    renderView();
    fireEvent.click((await screen.findByText("Recall overdue")).closest("button")!);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/controlled-copies/9"));
    expect(api.markAsRead).toHaveBeenCalledWith("1");
  });
});
