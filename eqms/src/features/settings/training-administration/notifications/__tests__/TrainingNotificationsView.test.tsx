import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const api = vi.hoisted(() => ({ log: vi.fn(), runReminders: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/trainingActivities")>()),
  trainingNotificationsApi: api,
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

import { TrainingNotificationsView } from "../TrainingNotificationsView";

const row = (id: string, eventCode: string, status: "SENT" | "SKIPPED" | "FAILED", extra: Record<string, unknown> = {}) => ({
  id, eventCode, channel: "IN_APP", status, reasonCode: null, title: `Notice ${id}`, createdAt: "2026-10-19T02:00:00Z", recipientName: "Nguyen Van An", ...extra,
});

const page = () => ({
  data: [row("a", "TRAINING_DUE_SOON", "SENT"), row("b", "TRAINING_OVERDUE", "SKIPPED", { reasonCode: "DUPLICATE_KEY", channel: "EMAIL" })],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
  summary: { SENT: 7, SKIPPED: 3, FAILED: 1 },
});

const renderView = () => render(<ToastProvider><BreadcrumbProvider><MemoryRouter><TrainingNotificationsView /></MemoryRouter></BreadcrumbProvider></ToastProvider>);

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  api.log.mockReset();
  api.runReminders.mockReset();
  api.log.mockResolvedValue(page());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TrainingNotificationsView", () => {
  it("lists the notices with readable event names and the totals by outcome", async () => {
    renderView();

    expect(await screen.findByText("Due soon")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Duplicate key")).toBeTruthy();
    const totals = screen.getByLabelText("Notices by outcome");
    expect(within(totals).getByRole("button", { name: /Sent/ }).textContent).toContain("7");
    expect(within(totals).getByRole("button", { name: /Skipped/ }).textContent).toContain("3");
    expect(within(totals).getByRole("button", { name: /Failed/ }).textContent).toContain("1");
  });

  it("asks the server for the failed notices when the Failed total is pressed, and again for all when it is pressed twice", async () => {
    renderView();
    await screen.findByText("Due soon");

    fireEvent.click(within(screen.getByLabelText("Notices by outcome")).getByRole("button", { name: /Failed/ }));
    await waitFor(() => expect(api.log).toHaveBeenLastCalledWith(expect.objectContaining({ status: "FAILED", page: 1 })));

    fireEvent.click(within(screen.getByLabelText("Notices by outcome")).getByRole("button", { name: /Failed/ }));
    await waitFor(() => expect(api.log).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined })));
  });

  it("runs the reminders only after the person confirms, and reports what the server says it really sent", async () => {
    api.runReminders.mockResolvedValue({ candidates: 6, sent: 4, skipped: 2, failed: 0 });
    renderView();
    await screen.findByText("Due soon");

    fireEvent.click(screen.getByRole("button", { name: /Run Reminders Now/ }));
    expect(api.runReminders).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Run Reminders" }));

    expect(await screen.findByText("4 notices sent, 2 skipped (already sent for this day or week), 0 failed.")).toBeTruthy();
    expect(api.runReminders).toHaveBeenCalledTimes(1);
  });

  it("says the run failed instead of pretending it worked", async () => {
    api.runReminders.mockRejectedValue(new Error("boom"));
    renderView();
    await screen.findByText("Due soon");

    fireEvent.click(screen.getByRole("button", { name: /Run Reminders Now/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Run Reminders" }));

    expect(await screen.findByText("Reminders Run Failed")).toBeTruthy();
  });
});
