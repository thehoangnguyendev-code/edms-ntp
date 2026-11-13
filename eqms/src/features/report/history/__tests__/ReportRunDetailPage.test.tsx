import "../../testing/browserStubs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportRunDetailPage } from "../ReportRunDetailPage";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { reportsApi, type ReportRunDetail } from "@/services/api/reports";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: () => true, hasPermission: () => true }),
}));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: any) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({
  DocumentPdfViewer: () => null,
}));
vi.mock("@/services/api/reports", () => ({
  reportsApi: { getRun: vi.fn(), downloadArtifact: vi.fn(), setLegalHold: vi.fn(), retryRun: vi.fn() },
}));

const run: ReportRunDetail = {
  id: "run-1",
  reportTitle: "EQMS - Document status register",
  definitionCode: "EQMS_TOPIC_DOC_STATUS",
  definitionVersion: 3,
  revision: 2,
  requesterUserId: "user-1",
  requesterName: "Nguyen The Hoang",
  requestType: "SCHEDULED",
  scheduleId: "sched-1",
  scheduleName: "Monthly register",
  requestedFormat: "PDF",
  parameters: { search: "SOP" },
  selectedFields: ["documentNumber", "documentName"],
  sortSpec: [{ field: "documentNumber", direction: "asc" }],
  authorizationSnapshot: {},
  status: "COMPLETED",
  progress: 100,
  attemptCount: 1,
  queuedAt: "2026-10-14T06:00:00Z",
  startedAt: "2026-10-14T06:00:02Z",
  completedAt: "2026-10-14T06:00:09Z",
  asOfAt: "2026-10-14T06:00:02Z",
  reasonCode: undefined,
  errorMessage: undefined,
  artifacts: [
    {
      id: "art-1",
      format: "PDF",
      generatedFilename: "eqms_topic_doc_status-run-1.pdf",
      mimeType: "application/pdf",
      byteSize: 593288,
      sha256: "a2420669ba44458fd55aca19204cc0cbd7259718eb3f6a701a6e046f775a229d",
      expiresAt: null,
      legalHold: false,
      purgedAt: null,
      createdAt: "2026-10-14T06:00:09Z",
    },
  ],
  events: [
    { eventType: "QUEUED", reasonCode: undefined, detail: { format: "PDF" }, createdAt: "2026-10-14T06:00:00Z" },
    { eventType: "COMPLETED", reasonCode: undefined, detail: { artifactId: "art-1" }, createdAt: "2026-10-14T06:00:09Z" },
  ],
  templateAtRun: {
    displayName: "EQMS - Document status register",
    gmpUse: true,
    approvalStatus: "APPROVED",
    approvedVersion: 3,
    approvedAt: "2026-10-14T05:00:00Z",
    nameFormatId: "fmt-1",
  },
  deliveries: [
    { channel: "IN_APP", eventCode: "REPORT_READY", status: "SENT", createdAt: "2026-10-14T06:00:10Z", recipientName: "Approver Test 1" },
  ],
} as unknown as ReportRunDetail;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reportsApi.getRun).mockResolvedValue(run);
});
afterEach(cleanup);

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/report/runs/run-1"]}>
        <Routes>
          <Route path="/report/runs/:runId" element={<ReportRunDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("shows every part of a run on its own page, in tabs and read-only inputs", async () => {
  renderPage();

  // The page names the screen; the report's own name is a fact in the run details.
  expect(await screen.findByRole("heading", { name: "Report Run Details" })).toBeTruthy();
  expect(screen.getByLabelText("Report Name")).toHaveValue("EQMS - Document status register");
  // Run facts
  expect(screen.getByLabelText("Request")).toHaveValue("Scheduled");
  expect(screen.getByLabelText("Schedule")).toHaveValue("Monthly register");
  expect(screen.getByLabelText("Requested By")).toHaveValue("Nguyen The Hoang");
  expect(screen.getByLabelText("Status")).toHaveValue("Completed");
  // Template as it was at run time
  expect(screen.getByLabelText("Approval At Run Time")).toHaveValue("Approved");
  expect(screen.getByLabelText("Template Revision")).toHaveValue("2.0.0");
  expect(screen.getByLabelText("Approved Version")).toHaveValue("v3");
  // No identifier of the run is shown
  expect(screen.queryByText("Run ID")).toBeNull();
  // Criteria
  expect((screen.getByLabelText("Filters And Parameters") as HTMLTextAreaElement).value).toContain('"search": "SOP"');
  expect((screen.getByLabelText("Fields") as HTMLTextAreaElement).value).toContain("documentNumber");
  // Files: checksum and retention
  fireEvent.click(screen.getByRole("tab", { name: /Report Files/ }));
  expect(await screen.findByText(/a2420669ba44/)).toBeTruthy();
  expect(screen.getByText("Kept permanently")).toBeTruthy();
  // Timeline and notices; machine values are shown as ordinary text, not in capitals.
  fireEvent.click(screen.getByRole("tab", { name: /Timeline/ }));
  expect((await screen.findAllByText("Queued")).length).toBeGreaterThan(0);
  expect(screen.queryByText("QUEUED")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /Notices Sent/ }));
  expect(await screen.findByText("Approver Test 1")).toBeTruthy();
  // Back, Refresh are in the footer row
  expect(screen.getAllByRole("button", { name: "Back" }).length).toBeGreaterThan(0);
});

it("writes the dates of the filters in the display format of the system, not as ISO (REPORT-TIME-FORMAT-2026-11-12)", async () => {
  vi.mocked(reportsApi.getRun).mockResolvedValue({ ...run, parameters: { createdFrom: "2026-11-11", createdTo: "2026-11-12", search: "2026-07-28 typed" } } as ReportRunDetail);
  renderPage();

  const filters = (await screen.findByLabelText("Filters And Parameters")) as HTMLTextAreaElement;
  expect(filters.value).toContain('"createdFrom": "11/11/2026"');
  expect(filters.value).toContain('"createdTo": "12/11/2026"');
  expect(filters.value).toContain('"search": "2026-07-28 typed"'); // a text that was typed is not changed
});

it("hides the notices list when the viewer may not see recipients", async () => {
  vi.mocked(reportsApi.getRun).mockResolvedValue({ ...run, deliveries: null } as ReportRunDetail);
  renderPage();

  fireEvent.click(await screen.findByRole("tab", { name: /Notices Sent/ }));
  expect(await screen.findByText("Shown to people who manage scheduled reports.")).toBeTruthy();
});

it("does not break when a list arrives in the wrong shape; it shows the list as empty", async () => {
  // The server once returned a raw database object here; the page must not crash on it.
  vi.mocked(reportsApi.getRun).mockResolvedValue({
    ...run,
    selectedFields: { type: "jsonb", value: "[\"documentNumber\"]" },
    sortSpec: { type: "jsonb", value: "[]" },
  } as unknown as ReportRunDetail);
  renderPage();

  expect(await screen.findByRole("heading", { name: "Report Run Details" })).toBeTruthy();
  expect(await screen.findByLabelText("Sort")).toHaveValue("Default");
});
