import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ActiveAnnouncement } from "@/features/settings/announcements/types";
import { AnnouncementHost } from "../AnnouncementHost";
import { clearDismissedAnnouncements, getDismissedAnnouncementIds } from "../announcementDismissal";

const state = vi.hoisted(() => ({ authenticated: true }));
const api = vi.hoisted(() => ({ getActive: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: state.authenticated }) }));
vi.mock("@/services/api/announcements", () => ({ announcementApi: api }));

const maintenance: ActiveAnnouncement = {
  id: "a1",
  title: "Planned maintenance",
  message: "The system will be unavailable at 22:00.",
  severity: "WARNING",
  startsAt: "2026-10-08T00:00:00Z",
  endsAt: "2026-10-09T00:00:00Z",
};
const other: ActiveAnnouncement = { ...maintenance, id: "a2", title: "New release", message: "Version 2 is live.", severity: "INFO" };

beforeEach(() => {
  state.authenticated = true;
  api.getActive.mockReset();
  window.sessionStorage.clear();
});
afterEach(cleanup);

it("shows the first active announcement in a dialog after sign-in, with how many are waiting", async () => {
  api.getActive.mockResolvedValue([maintenance, other]);
  render(<AnnouncementHost />);
  expect(await screen.findByText("Planned maintenance")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("1 of 2")).toBeTruthy();
  expect(screen.queryByText("New release")).toBeNull(); // one at a time
});

it("closes one announcement, then shows the next, and remembers what was closed for this sign-in", async () => {
  api.getActive.mockResolvedValue([maintenance, other]);
  render(<AnnouncementHost />);
  await screen.findByText("Planned maintenance");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(await screen.findByText("New release")).toBeTruthy();
  expect(screen.queryByText("Planned maintenance")).toBeNull();
  expect(screen.getByText("2 of 2")).toBeTruthy();
  expect(getDismissedAnnouncementIds()).toEqual(["a1"]);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(getDismissedAnnouncementIds()).toEqual(["a1", "a2"]);
});

it("does not show again an announcement already closed in this sign-in (for example after a page reload)", async () => {
  window.sessionStorage.setItem("eqms:announcements:dismissed", JSON.stringify(["a1"]));
  api.getActive.mockResolvedValue([maintenance, other]);
  render(<AnnouncementHost />);
  await screen.findByText("New release");
  expect(screen.queryByText("Planned maintenance")).toBeNull();
});

it("shows it again after the next sign-in, which clears what was closed", async () => {
  api.getActive.mockResolvedValue([maintenance]);
  const first = render(<AnnouncementHost />);
  await screen.findByText("Planned maintenance");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  first.unmount();

  act(() => clearDismissedAnnouncements()); // what AuthContext does on a successful sign-in or a sign-out
  render(<AnnouncementHost />);
  expect(await screen.findByText("Planned maintenance")).toBeTruthy();
});

it("shows nothing, and asks for nothing, when nobody is signed in", async () => {
  state.authenticated = false;
  render(<AnnouncementHost />);
  expect(api.getActive).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("stays silent when the announcements cannot be loaded", async () => {
  api.getActive.mockRejectedValue(new Error("network"));
  render(<AnnouncementHost />);
  await waitFor(() => expect(api.getActive).toHaveBeenCalled());
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("shows nothing when there is no active announcement", async () => {
  api.getActive.mockResolvedValue([]);
  render(<AnnouncementHost />);
  await waitFor(() => expect(api.getActive).toHaveBeenCalled());
  expect(screen.queryByRole("dialog")).toBeNull();
});
