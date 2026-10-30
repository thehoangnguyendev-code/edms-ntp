import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({ passPercent: 70, documentTrainingDaysDefault: 14, annualRequirementDueMonth: 12, annualRequirementDueDay: 31, absenceRetrainMonths: 6, retentionYearsAfterLeaving: 10, reviewReadyReminderDays: 3, reviewOpenReminderDays: 14, resultsDueDays: 7, warnScheduledAfterDue: true, version: 1 }));
const updateSettings = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => code === "training.settings.manage" }) }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  trainingSettingsApi: { get: () => Promise.resolve(settings), update: updateSettings },
}));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <div><h1>{title}</h1>{actions}</div> }));

import { TrainingPropertiesView } from "../TrainingPropertiesView";

beforeEach(() => { window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList); });
afterEach(cleanup);

describe("TrainingPropertiesView", () => {
  it("shows one subject per tab, each with a sentence that says what it governs", async () => {
    render(<MemoryRouter><TrainingPropertiesView /></MemoryRouter>);

    expect(await screen.findByText("Pass mark (%)")).toBeTruthy();
    expect(screen.getByText(/How a test is marked/)).toBeTruthy();
    expect(screen.getByText("Days to finish the training and send the results to QA")).toBeTruthy();
    expect(screen.getByDisplayValue("7")).toBeTruthy();
    expect(screen.queryByText("Years to keep records after the employee leaves")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Review Reminders" }));
    expect(await screen.findByText("Days before a review ready to close is reminded")).toBeTruthy();
    expect(screen.getByText(/A reminder is sent once a week/)).toBeTruthy();
  });

  it("keeps a change made in one tab when another tab is opened, and saves all tabs together", async () => {
    render(<MemoryRouter><TrainingPropertiesView /></MemoryRouter>);
    const pass = await screen.findByDisplayValue("70");
    fireEvent.change(pass, { target: { value: "80" } });

    fireEvent.click(screen.getByRole("tab", { name: "Records Retention" }));
    expect((screen.getByRole("button", { name: "Save Changes" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: "Assessment" }));
    expect(screen.getByDisplayValue("80")).toBeTruthy();
  });

  it("confirms a save without requesting or inventing a reason", async () => {
    updateSettings.mockResolvedValue({ ...settings, passPercent: 80, version: 2 });
    render(<MemoryRouter><TrainingPropertiesView /></MemoryRouter>);
    fireEvent.change(await screen.findByDisplayValue("70"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Save Training Properties?")).toBeTruthy();
    expect(screen.queryByLabelText(/Reason for the change/i)).toBeNull();
    const buttons = screen.getAllByRole("button", { name: "Save Changes" });
    fireEvent.click(buttons[buttons.length - 1]);
    await vi.waitFor(() => expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ passPercent: 80, version: 1 })));
    expect(updateSettings.mock.calls.at(-1)?.[0]).not.toHaveProperty("reason");
  });

  it("has no switch for the link with Document Control and no due day setting, and has the scheduling warning", async () => {
    render(<MemoryRouter><TrainingPropertiesView /></MemoryRouter>);
    await screen.findByText("Pass mark (%)");
    fireEvent.click(screen.getByRole("tab", { name: "Document Training" }));
    expect(await screen.findByText("Warn when a session is scheduled after the due date")).toBeTruthy();
    expect(screen.queryByText("Link with Document Control")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Annual & Retraining" }));
    await screen.findByText("Due month");
    expect(screen.queryByText("Due day of the planned month (periodic training)")).toBeNull();
  });
});
