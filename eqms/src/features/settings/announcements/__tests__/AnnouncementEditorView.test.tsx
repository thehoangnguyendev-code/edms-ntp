import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import { AnnouncementEditorView } from "../AnnouncementEditorView";

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), get: vi.fn() }));
vi.mock("@/services/api/announcements", () => ({ announcementApi: api }));

const renderAt = (path: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={ROUTES.SETTINGS.ANNOUNCEMENTS_NEW} element={<AnnouncementEditorView />} />
            <Route path="/settings/announcements/edit/:id" element={<AnnouncementEditorView />} />
            <Route path={ROUTES.SETTINGS.ANNOUNCEMENTS} element={<p>List page</p>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

beforeEach(() => {
  api.create.mockReset().mockResolvedValue({});
  api.update.mockReset().mockResolvedValue({});
  api.get.mockReset();
});
afterEach(cleanup);

it("previews the banner, with its Close button, and follows what is typed", () => {
  renderAt(ROUTES.SETTINGS.ANNOUNCEMENTS_NEW);
  const preview = screen.getByTestId("announcement-preview");
  expect(within(preview).getByText("Title of the announcement")).toBeTruthy();
  expect(within(preview).getByRole("button", { name: "Close" })).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Planned maintenance tonight"), { target: { value: "System maintenance in 12 hours" } });
  fireEvent.change(screen.getByPlaceholderText(/The system will be unavailable from 22:00/), { target: { value: "Save your work.\nThanks." } });
  expect(within(preview).getByText("System maintenance in 12 hours")).toBeTruthy();
  expect(within(preview).getByText(/Save your work\./)).toBeTruthy();
});

it("opens the real modal as a full-screen preview and closes it again", async () => {
  renderAt(ROUTES.SETTINGS.ANNOUNCEMENTS_NEW);
  fireEvent.change(screen.getByPlaceholderText("Planned maintenance tonight"), { target: { value: "Heads up" } });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Preview full screen" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Heads up")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("does not save an incomplete announcement, and says what is missing", () => {
  renderAt(ROUTES.SETTINGS.ANNOUNCEMENTS_NEW);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(api.create).not.toHaveBeenCalled();
  expect(screen.getByText("A title is required.")).toBeTruthy();
  expect(screen.getByText("A message is required.")).toBeTruthy();
});

it("saves a complete announcement with ISO times and goes back to the list", async () => {
  renderAt(ROUTES.SETTINGS.ANNOUNCEMENTS_NEW);
  fireEvent.change(screen.getByPlaceholderText("Planned maintenance tonight"), { target: { value: "Maintenance" } });
  fireEvent.change(screen.getByPlaceholderText(/The system will be unavailable from 22:00/), { target: { value: "Back at 23:30." } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  const payload = api.create.mock.calls[0][0];
  expect(payload).toMatchObject({ title: "Maintenance", message: "Back at 23:30.", severity: "INFO", enabled: true });
  expect(new Date(payload.endsAt).getTime()).toBeGreaterThan(new Date(payload.startsAt).getTime());
  expect(payload.startsAt).toMatch(/Z$/);
  expect(payload.version).toBeUndefined();
  expect(await screen.findByText("List page")).toBeTruthy();
});

it("sends the loaded version when editing, so a stale edit can be refused", async () => {
  api.get.mockResolvedValue({
    id: "x1", title: "Old", message: "Old text", severity: "WARNING", enabled: true, state: "ACTIVE", version: 4,
    startsAt: "2026-10-08T05:00:00Z", endsAt: "2026-10-09T05:00:00Z",
  });
  renderAt("/settings/announcements/edit/x1");
  expect(await screen.findByDisplayValue("Old")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
  expect(api.update.mock.calls[0][0]).toBe("x1");
  expect(api.update.mock.calls[0][1].version).toBe(4);
});

it("tells the administrator when someone else changed the announcement", async () => {
  api.get.mockResolvedValue({
    id: "x1", title: "Old", message: "Old text", severity: "INFO", enabled: true, state: "ACTIVE", version: 1,
    startsAt: "2026-10-08T05:00:00Z", endsAt: "2026-10-09T05:00:00Z",
  });
  api.update.mockRejectedValue({ response: { status: 409 } });
  renderAt("/settings/announcements/edit/x1");
  await screen.findByDisplayValue("Old");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText(/Someone else changed this announcement/)).toBeTruthy();
  expect(screen.queryByText("List page")).toBeNull();
});
