import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserNotificationBridge } from "../BrowserNotificationBridge";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getNotifications: vi.fn(),
  markAsRead: vi.fn(),
  navigate: vi.fn(),
  listener: { current: null as null | ((event: { type: string }) => void) },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { notificationPreferences: { channels: { push: false } } }, isAuthenticated: true }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("@/services/api/notifications", () => ({ notificationApi: { getNotifications: mocks.getNotifications, markAsRead: mocks.markAsRead } }));
vi.mock("@/features/notifications/notificationRealtime", () => ({
  subscribeNotificationRealtime: (listener: (event: { type: string }) => void) => {
    mocks.listener.current = listener;
    return () => undefined;
  },
}));
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")), useNavigate: () => mocks.navigate }));

const notification = (id: string, over: Record<string, unknown> = {}) => ({
  id, type: "training.step_assigned", title: "Training: your action is needed", description: "Approve the content.", priority: "high",
  actionUrl: "/training-management/activities/1", icon: null, iconTone: "purple", ...over,
});

const arrive = async (first: unknown, second: unknown) => {
  mocks.getNotifications.mockResolvedValueOnce({ data: [first] });
  render(<MemoryRouter><BrowserNotificationBridge /></MemoryRouter>);
  await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(1));
  mocks.getNotifications.mockResolvedValueOnce({ data: [second] });
  mocks.listener.current?.({ type: "notification-updated" });
  await waitFor(() => expect(mocks.showToast).toHaveBeenCalled());
};

describe("the toast of a new notification", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((value) => typeof value === "function" && "mockReset" in value && (value as ReturnType<typeof vi.fn>).mockReset());
    mocks.markAsRead.mockResolvedValue({});
  });
  afterEach(cleanup);

  it("carries the notification's own icon colours and a warning for a high priority", async () => {
    await arrive(notification("n1"), notification("n2"));
    const toast = mocks.showToast.mock.calls[0][0];
    expect(toast).toMatchObject({ type: "warning", title: "Training: your action is needed", message: "Approve the content." });
    expect(toast.iconClassName).toContain("purple");   // the tone chosen for the notification
    expect(toast.icon).toBeTruthy();
  });

  it("opens what the notification is about and marks it read when it is clicked", async () => {
    await arrive(notification("n1"), notification("n2"));
    mocks.showToast.mock.calls[0][0].onOpen();
    expect(mocks.markAsRead).toHaveBeenCalledWith("n2");
    expect(mocks.navigate).toHaveBeenCalledWith("/training-management/activities/1");
  });

  it("is not clickable when the notification opens nothing, and is information for a normal priority", async () => {
    await arrive(notification("n1"), notification("n2", { actionUrl: null, priority: "medium" }));
    const toast = mocks.showToast.mock.calls[0][0];
    expect(toast.type).toBe("info");
    expect(toast.onOpen).toBeUndefined();
  });

  it("shows nothing for the notification that was already there when the page opened", async () => {
    mocks.getNotifications.mockResolvedValue({ data: [notification("n1")] });
    render(<MemoryRouter><BrowserNotificationBridge /></MemoryRouter>);
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalled());
    mocks.listener.current?.({ type: "notification-updated" });
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(2));
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
});
