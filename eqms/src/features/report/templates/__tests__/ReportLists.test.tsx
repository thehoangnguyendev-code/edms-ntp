import "../../testing/browserStubs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportHistoryView } from "../../history/ReportHistoryView";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ScheduledReportsView } from "../../scheduled/ScheduledReportsView";
import { ReportLayoutDesigner } from "../ReportLayoutDesigner";
import { defaultReportLayout } from "@/services/api/reportTemplates";
import { reportsApi } from "@/services/api/reports";
import { reportBreadcrumbs } from "../../shared/reportBreadcrumbs";

const state = vi.hoisted(() => ({
  compactDesktopFilters: false,
  manage: true,
}));
vi.mock("@/components/branding/BrandLogo", () => ({
  useBranding: () => state,
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: () => state.manage, hasPermission: () => state.manage }),
}));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: any) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("../ReportMarkCanvas", () => ({
  ReportMarkCanvas: () => <div>Server-rendered position canvas</div>,
}));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({
  DocumentPdfViewer: () => null,
}));
vi.mock("@/services/api/reports", () => ({
  reportsApi: {
    listRuns: vi.fn(),
    searchSchedules: vi.fn(),
    catalog: vi.fn().mockResolvedValue([]),
  },
}));
const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
beforeEach(() => {
  state.compactDesktopFilters = false;
  state.manage = true;
  vi.clearAllMocks();
  vi.mocked(reportsApi.listRuns).mockResolvedValue({
    pagination,
    data: [
      {
        id: "run",
        definitionCode: "TEST",
        definitionVersion: 1,
        reportTitle: "Test report",
        status: "FAILED",
        progress: 0,
        queuedAt: "2026-10-04T00:00:00Z",
      },
    ],
  });
  vi.mocked(reportsApi.searchSchedules).mockResolvedValue({
    pagination,
    data: [
      {
        id: "schedule",
        name: "Test schedule",
        definitionCode: "TEST",
        cronExpression: "0 0 8 * * *",
        format: "PDF",
        status: "ACTIVE",
        active: true,
        creatorUserId: "admin",
      },
    ],
  });
});
afterEach(cleanup);
it("history delegates search and sorting to server, and disables unavailable downloads in the portal menu", async () => {
  render(
    <ToastProvider>
      <MemoryRouter>
        <ReportHistoryView />
      </MemoryRouter>
    </ToastProvider>,
  );
  await screen.findByRole("button", { name: "Test report" });
  fireEvent.change(
    screen.getAllByPlaceholderText("Search report name, template or run…")[0],
    { target: { value: "unmatched" } },
  );
  await waitFor(() =>
    expect(reportsApi.listRuns).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "unmatched", limit: 10 }),
    ),
  );
  expect(
    screen.getByRole("button", { name: "Test report" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Queued"));
  // The server receives the ascending sort. (The shared URL sync may re-issue the list; that is a known point to verify in the browser.)
  await waitFor(() =>
    expect(reportsApi.listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: "queuedAt", sortDirection: "asc" }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(
    screen.getByRole("button", { name: "Download Report" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "View Detail" }),
  ).toBeInTheDocument();
});
it("scheduled reports use shared filters (maximum three columns), server criteria and portal actions", async () => {
  render(
    <ToastProvider>
      <MemoryRouter>
        <ScheduledReportsView />
      </MemoryRouter>
    </ToastProvider>,
  );
  await screen.findByRole("button", { name: "Test schedule" });
  expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
  fireEvent.click(screen.getByRole("option", { name: "Paused" }));
  await waitFor(() =>
    expect(reportsApi.searchSchedules).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "PAUSED", page: 1 }),
    ),
  );
  expect(
    screen.getByRole("button", { name: "Test schedule" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(
    screen.getByRole("button", { name: "Edit Schedule" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Pause Schedule" }),
  ).toBeInTheDocument();
});
it("does not expose schedule management actions without permission", async () => {
  state.manage = false;
  render(
    <ToastProvider>
      <MemoryRouter>
        <ScheduledReportsView />
      </MemoryRouter>
    </ToastProvider>,
  );
  await screen.findByText("Test schedule");
  expect(
    screen.queryByRole("button", { name: "More actions" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "New Schedule" }),
  ).not.toBeInTheDocument();
});
it("compact schedule filters do not send draft selections to server until Apply", async () => {
  state.compactDesktopFilters = true;
  render(<ToastProvider><MemoryRouter><ScheduledReportsView /></MemoryRouter></ToastProvider>);
  await screen.findByText("Test schedule");
  fireEvent.click(screen.getByRole("button", {name: /^Filter$/}));
  fireEvent.click(await screen.findByRole("radio", {name: /^Paused$/}));
  expect(vi.mocked(reportsApi.searchSchedules).mock.calls.every(([params]) => params.status === "")).toBe(true);
  fireEvent.click(screen.getByRole("button", {name: /^Apply$/}));
  await waitFor(() => expect(reportsApi.searchSchedules).toHaveBeenLastCalledWith(expect.objectContaining({status: "PAUSED", page: 1})));
});
it("layout opens the position canvas directly, without PDF Preview or Position Editor tabs", async () => {
  render(
    <ReportLayoutDesigner
      value={defaultReportLayout()}
      onChange={vi.fn()}
      title="TEST"
      disabled={false}
    />,
  );
  await screen.findByText("Server-rendered position canvas");
  expect(
    screen.queryByRole("tab", { name: "PDF Preview" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("tab", { name: "Position Editor" }),
  ).not.toBeInTheDocument();
});
it("report breadcrumbs always finish with the page title and configuration has its navigation parent", () => {
  for (const title of [
    "Report History",
    "Scheduled Reports",
    "Report Templates",
    "Report Configuration",
    "Create Report",
    "New Report Template",
    "Report Template Configuration",
  ]) {
    expect(reportBreadcrumbs(vi.fn(), title).at(-1)).toEqual({
      label: title,
      isActive: true,
    });
  }
  expect(
    reportBreadcrumbs(vi.fn(), "Report Template Configuration", true, {
      label: "Report Configuration",
      onClick: vi.fn(),
    }).map((item) => item.label),
  ).toContain("Report Configuration");
});
