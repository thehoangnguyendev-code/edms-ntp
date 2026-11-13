import "../../report/testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { reportsApi } from "@/services/api/reports";
import { ReportAnalyticsView } from "../ReportAnalyticsView";
import { ReportOverviewView } from "../ReportOverviewView";
import { ReportAccessScopeView, ReportDeliveryView, ReportRetentionView } from "../admin/ReportAdminScreens";

vi.mock("@/services/api/reports", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/api/reports")>();
  return {
  ...original,
  reportsApi: {
    ...original.reportsApi,
    overview: vi.fn(),
    listPins: vi.fn(),
    pinReport: vi.fn(),
    unpinReport: vi.fn(),
    searchSchedules: vi.fn(),
    listRuns: vi.fn(),
    analyticsDocuments: vi.fn(),
    analyticsTraining: vi.fn(),
    analyticsUsage: vi.fn(),
  },
  };
});

const permissionState = vi.hoisted(() => ({ codes: ["documents.module.view", "training.compliance.view"] as string[] }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: (codes: string[]) => codes.some((code) => permissionState.codes.includes(code)), hasPermission: (code: string) => permissionState.codes.includes(code), hasPermissionAlias: (code: string) => permissionState.codes.includes(code) }),
}));

afterEach(cleanup);
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });

const Where: React.FC = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;

const renderView = (view: React.ReactNode) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <Routes>
            <Route path="*" element={<>{view}<Where /></>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

const denied = () => Promise.reject({ response: { status: 403 } });
const failed = () => Promise.reject(new Error("network"));
const emptyPage = { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };

describe("Reports Overview reads the server and shows no sample", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reportsApi.overview).mockResolvedValue({ attention: [], generatedAt: "2026-11-12T00:00:00Z" });
    vi.mocked(reportsApi.listPins).mockResolvedValue([]);
    vi.mocked(reportsApi.searchSchedules).mockResolvedValue(emptyPage as never);
    vi.mocked(reportsApi.listRuns).mockResolvedValue(emptyPage as never);
  });

  it("has no design-preview notice and no sample data", async () => {
    renderView(<ReportOverviewView />);
    await screen.findByText("Nothing needs your attention.");
    expect(screen.queryByText("Design preview")).toBeNull();
    expect(screen.queryByText(/RUN-000415|Weekly Document Status|Quality Admin/)).toBeNull();
    expect(screen.getByText("No pinned report. Pin one from the Report Library.")).toBeTruthy();
    expect(screen.getByText("No scheduled report.")).toBeTruthy();
    expect(screen.getByText("No run yet.")).toBeTruthy();
  });

  it("lists what needs attention, and a click opens the page where it is handled", async () => {
    vi.mocked(reportsApi.overview).mockResolvedValue({
      attention: [{ code: "FAILED_RUNS", tone: "red", count: 2, title: "2 runs failed", detail: "In the last 30 days.", path: "/report/history?status=FAILED" }],
      generatedAt: "x",
    });
    renderView(<ReportOverviewView />);
    fireEvent.click(await screen.findByText("2 runs failed"));
    expect(screen.getByTestId("where").textContent).toBe("/report/history?status=FAILED");
  });

  it("runs a pinned report, and unpins it", async () => {
    vi.mocked(reportsApi.listPins).mockResolvedValue([{ code: "RPT.0001", name: "Monthly register", active: true, pinnedAt: "2026-11-01T00:00:00Z" }]);
    vi.mocked(reportsApi.unpinReport).mockResolvedValue({} as never);
    renderView(<ReportOverviewView />);
    await screen.findByText("Monthly register");
    fireEvent.click(screen.getByRole("button", { name: "Unpin Monthly register" }));
    await waitFor(() => expect(reportsApi.unpinReport).toHaveBeenCalledWith("RPT.0001"));
    await waitFor(() => expect(reportsApi.listPins).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByTestId("where").textContent).toBe("/report/templates/RPT.0001/run");
  });

  it("does not offer to run a pinned report whose template is disabled", async () => {
    vi.mocked(reportsApi.listPins).mockResolvedValue([{ code: "RPT.0001", name: "Old", active: false, pinnedAt: "x" }]);
    renderView(<ReportOverviewView />);
    await screen.findByText("Old");
    expect((screen.getByRole("button", { name: "Run" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the next scheduled runs and the latest runs from the server, and opens a run", async () => {
    vi.mocked(reportsApi.searchSchedules).mockResolvedValue({
      data: [
        { id: "s1", name: "Weekly register", definitionCode: "RPT.0001", cronExpression: "0 0 6 * * 1", format: "PDF", status: "ACTIVE", active: true, version: 1, nextRunAt: "2026-11-16T06:00:00Z" },
        { id: "s2", name: "Paused one", definitionCode: "RPT.0002", cronExpression: "0 0 6 * * 1", format: "CSV", status: "SUSPENDED_AUTHORIZATION_CHANGED", active: false, version: 1, nextRunAt: null },
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    } as never);
    vi.mocked(reportsApi.listRuns).mockResolvedValue({
      data: [{ id: "run-1", reportTitle: "Register June", definitionCode: "RPT.0001", definitionVersion: 1, status: "COMPLETED", progress: 100, queuedAt: "2026-11-11T01:00:00Z", fullRun: true }],
      pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
    } as never);
    renderView(<ReportOverviewView />);
    await screen.findByText("Weekly register");
    expect(screen.getByText(/suspended authorization changed/i)).toBeTruthy();
    fireEvent.click(await screen.findByText("Register June"));
    expect(screen.getByTestId("where").textContent).toBe("/report/runs/run-1");
    expect(screen.getByText("Full")).toBeTruthy();
  });

  it("says a section failed and retries it, never showing an empty list as if it were true", async () => {
    vi.mocked(reportsApi.listRuns).mockImplementation(failed);
    renderView(<ReportOverviewView />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be loaded");
    expect(screen.queryByText("No run yet.")).toBeNull();
    vi.mocked(reportsApi.listRuns).mockResolvedValue(emptyPage as never);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("No run yet.");
  });

  it("says when the person may not see a section", async () => {
    vi.mocked(reportsApi.searchSchedules).mockImplementation(denied);
    renderView(<ReportOverviewView />);
    await screen.findByText("You do not have access to scheduled reports.");
  });
});

describe("Quality Analytics reads the server and shows no sample", () => {
  const docs = {
    effectiveDocuments: 412, revisedLast90Days: 37, revisionsInProgress: 29, revisionsWaitingOver14Days: 6, reviewsDue: 18, reviewsOverdue: 4, controlledCopiesOut: 96, controlledCopiesExpired: 5,
    revisionsByStage: [{ label: "Pending Review", value: 9 }], byType: [{ type: "SOP", effective: 168, inRevision: 12, reviewDue: 7 }, { type: "Empty type", effective: 0, inRevision: 0, reviewDue: 0 }],
  };
  beforeEach(() => {
    permissionState.codes = ["documents.module.view", "training.compliance.view"];
    vi.clearAllMocks();
    vi.mocked(reportsApi.analyticsDocuments).mockResolvedValue(docs);
    vi.mocked(reportsApi.analyticsTraining).mockResolvedValue({
      overdueActivities: 3, dueSoonActivities: 2, openActivities: 10, absentInOpenActivities: 4, activitiesByStatus: [{ label: "Planned", value: 5 }],
      requirements: 200, trained: 150, notTrained: 40, annualDue: 10, percentTrained: 75,
    });
    vi.mocked(reportsApi.analyticsUsage).mockResolvedValue({ runsPerWeek: [{ weekStart: "2026-11-09", value: 3 }], runsLast30Days: 8, failedLast30Days: 1, fullRunsLast30Days: 2, allUsers: false });
  });

  it("draws the numbers the server counted and has no design-preview notice", async () => {
    renderView(<ReportAnalyticsView />);
    await screen.findByText("412");
    expect(screen.queryByText("Design preview")).toBeNull();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("Last 30 days: 8 runs, 1 failed, 2 run with Full.")).toBeTruthy();
    expect(screen.getByText("Your runs, last 6 weeks")).toBeTruthy();
  });

  it("lists a document type in the table, and omits an empty bar from the chart series", async () => {
    renderView(<ReportAnalyticsView />);
    await screen.findByText("412");
    expect(screen.getAllByText("SOP").length).toBeGreaterThan(0);
  });

  it("does not ask for a section the person has no permission for, and keeps the others", async () => {
    permissionState.codes = [];
    renderView(<ReportAnalyticsView />);
    await screen.findByText("Report runs per week");
    await waitFor(() => expect(screen.queryByLabelText("Document Control indicators")).toBeNull());
    expect(screen.queryByLabelText("Training indicators")).toBeNull();
    expect(screen.getByText("Last 30 days: 8 runs, 1 failed, 2 run with Full.")).toBeTruthy();
    expect(reportsApi.analyticsDocuments).not.toHaveBeenCalled();
    expect(reportsApi.analyticsTraining).not.toHaveBeenCalled();
  });

  it("leaves out a section that the server refuses (permission withdrawn since the page opened)", async () => {
    vi.mocked(reportsApi.analyticsDocuments).mockImplementation(denied);
    renderView(<ReportAnalyticsView />);
    await screen.findByText("Report runs per week");
    await waitFor(() => expect(screen.queryByLabelText("Document Control indicators")).toBeNull());
  });

  it("shows a dash, not a zero, when a figure could not be loaded, and a retry", async () => {
    vi.mocked(reportsApi.analyticsDocuments).mockImplementation(failed);
    renderView(<ReportAnalyticsView />);
    await screen.findByText(/Document Control figures could not be loaded/);
    const strip = screen.getByLabelText("Document Control indicators");
    expect(strip.textContent).not.toMatch(/\b0\b/);
    expect(strip.textContent).toContain("—");
    vi.mocked(reportsApi.analyticsDocuments).mockResolvedValue(docs);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("412");
  });

  it("says why there are no Training figures for a person with no department, with no figure at all", async () => {
    vi.mocked(reportsApi.analyticsTraining).mockResolvedValue({ note: "NO_DEPARTMENT" });
    renderView(<ReportAnalyticsView />);
    await screen.findByText(/has no department/);
    expect(screen.queryByLabelText("Training indicators")).toBeNull();
  });

  it("shows no percentage when there is no requirement", async () => {
    vi.mocked(reportsApi.analyticsTraining).mockResolvedValue({ overdueActivities: 0, dueSoonActivities: 0, openActivities: 0, absentInOpenActivities: 0, activitiesByStatus: [], requirements: 0, trained: 0, notTrained: 0, annualDue: 0, percentTrained: null });
    renderView(<ReportAnalyticsView />);
    await screen.findByText("No training activity.");
    expect(screen.getByLabelText("Training indicators").textContent).toContain("—");
    expect(screen.getByLabelText("Training indicators").textContent).not.toContain("0%");
  });
});

// These administration screens read the server; none of them is a design preview.
it.each([
  ["Report Access & Data Scope", <ReportAccessScopeView />],
  ["Report Retention & Legal Hold", <ReportRetentionView />],
  ["Scheduled Report Delivery", <ReportDeliveryView />],
])("%s is a real screen, without the design preview notice", (title, view) => {
  renderView(view);
  expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  expect(screen.queryByText("Design preview")).toBeNull();
});
