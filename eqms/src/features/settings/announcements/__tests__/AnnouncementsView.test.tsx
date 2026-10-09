import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { AnnouncementsView } from "../AnnouncementsView";
import type { Announcement } from "../types";

const api = vi.hoisted(() => ({ list: vi.fn(), setEnabled: vi.fn(), remove: vi.fn() }));
vi.mock("@/services/api/announcements", () => ({ announcementApi: api }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAnyPermission: () => true }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return { ...actual, useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }) };
});

const row = (id: string, title: string, over: Partial<Announcement> = {}): Announcement => ({
  id, title, message: `Message of ${title}`, severity: "WARNING", enabled: true, state: "ACTIVE", version: 0,
  startsAt: "2026-10-08T05:00:00Z", endsAt: "2026-10-09T05:00:00Z", createdBy: "Quality Admin", updatedBy: "Quality Admin", ...over,
});
const page = (data: Announcement[], extra = {}) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1, ...extra } });

const lastParams = () => api.list.mock.calls.at(-1)![0];

beforeEach(() => {
  api.list.mockReset().mockResolvedValue(page([row("a1", "Planned maintenance"), row("a2", "New release", { severity: "INFO" })]));
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderView = () =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <AnnouncementsView />
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

const header = (id: string) => document.querySelector<HTMLElement>(`[data-table-col="${id}"]`)!;

it("loads the first page from the server, newest start first, with no filter", async () => {
  renderView();
  expect(await screen.findByText("Planned maintenance")).toBeTruthy();
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(lastParams()).toMatchObject({ state: "ALL", severity: "ALL", page: 1, limit: 10, sortBy: "startsAt", sortDirection: "desc" });
  expect(lastParams().search).toBeUndefined();
  expect(lastParams().startsFrom).toBeUndefined();
});

it("sends the search text to the server, after a short pause, and starts again from page one", async () => {
  renderView();
  await screen.findByText("Planned maintenance");
  fireEvent.change(screen.getByPlaceholderText("Title, message or person…"), { target: { value: "mainten" } });
  await waitFor(() => expect(lastParams().search).toBe("mainten"), { timeout: 2000 });
  expect(lastParams().page).toBe(1);
});

it("sorts on the server: a click sorts ascending, the next click descending, and another column starts ascending", async () => {
  renderView();
  await screen.findByText("Planned maintenance");
  fireEvent.click(header("severity"));
  await waitFor(() => expect(lastParams()).toMatchObject({ sortBy: "severity", sortDirection: "asc" }));
  fireEvent.click(header("severity"));
  await waitFor(() => expect(lastParams()).toMatchObject({ sortBy: "severity", sortDirection: "desc" }));
  fireEvent.click(header("title"));
  await waitFor(() => expect(lastParams()).toMatchObject({ sortBy: "title", sortDirection: "asc" }));
});

it("makes every data column sortable by a key the server accepts", async () => {
  renderView();
  await screen.findByText("Planned maintenance");
  const keys: Record<string, string> = { title: "title", severity: "severity", state: "state", starts: "startsAt", ends: "endsAt", updatedAt: "updatedAt", updatedBy: "updatedBy", createdBy: "createdBy" };
  for (const [column, sortBy] of Object.entries(keys)) {
    fireEvent.click(header(column));
    await waitFor(() => expect(lastParams().sortBy).toBe(sortBy), { timeout: 1500 });
  }
  expect(header("no").className).not.toContain("cursor-pointer"); // the row number is not a sort
});

it("filters on the server by status and severity from the filter drawer", async () => {
  renderView();
  await screen.findByText("Planned maintenance");
  fireEvent.click(screen.getByRole("button", { name: "Filters" })); // the drawer is a portal, without a dialog role
  fireEvent.click(await screen.findByRole("button", { name: "Active" }));
  await waitFor(() => expect(lastParams().state).toBe("ACTIVE"));
  fireEvent.click(screen.getByRole("button", { name: "Severity" })); // opens that group
  fireEvent.click(await screen.findByRole("button", { name: "Critical" }));
  await waitFor(() => expect(lastParams()).toMatchObject({ state: "ACTIVE", severity: "CRITICAL" }));
});

it("clears the search and every filter, and asks the server again", async () => {
  renderView();
  await screen.findByText("Planned maintenance");
  fireEvent.change(screen.getByPlaceholderText("Title, message or person…"), { target: { value: "x" } });
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("button", { name: "Scheduled" }));
  await waitFor(() => expect(lastParams()).toMatchObject({ state: "SCHEDULED", search: "x" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
  await waitFor(() => expect(lastParams()).toMatchObject({ state: "ALL", severity: "ALL", page: 1 }));
  // the search box is debounced, so the request without the search text follows a moment later
  await waitFor(() => expect(lastParams().search).toBeUndefined(), { timeout: 2000 });
});

it("pages on the server and shows what the server reports", async () => {
  api.list.mockResolvedValue(page([row("a1", "First page row")], { total: 25, totalPages: 3 }));
  renderView();
  expect(await screen.findByText("First page row")).toBeTruthy();
  expect(screen.getByText(/25/)).toBeTruthy();
  api.list.mockResolvedValue(page([row("a9", "Second page row")], { page: 2, total: 25, totalPages: 3 }));
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  await waitFor(() => expect(lastParams().page).toBe(2));
  expect(await screen.findByText("Second page row")).toBeTruthy();
});

it("offers the Custom Column control next to Clear Filters", async () => {
  renderView();
  await screen.findByText("Planned maintenance");
  const custom = await screen.findByRole("button", { name: /Custom Column/ });
  expect(custom.parentElement).toBe(screen.getByRole("button", { name: "Clear Filters" }).parentElement);
});

it("says so, with the reason, when the server cannot be reached", async () => {
  api.list.mockRejectedValue(new Error("network"));
  renderView();
  expect(await screen.findByText("Unable to load announcements")).toBeTruthy();
});
