import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportTemplateRevisionPage } from "../templates/ReportTemplateRevisionPage";
import { reportTemplatesApi } from "@/services/api/reportTemplates";

vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, breadcrumbItems, actions }: any) => (
    <header>
      <h1>{title}</h1>
      <nav aria-label="Breadcrumb">{breadcrumbItems.map((item: any) => <span key={item.label}>{item.label}</span>)}</nav>
      {actions}
    </header>
  ),
}));
vi.mock("@/services/api/reportTemplates", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  reportTemplatesApi: { revision: vi.fn(), revisions: vi.fn(), compareRevision: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(reportTemplatesApi.revisions).mockResolvedValue({ data: [{ revision: 1 }, { revision: 2 }], pagination: { page: 1, limit: 100, total: 2, totalPages: 1 } } as never);
  vi.mocked(reportTemplatesApi.revision).mockResolvedValue({
    definitionCode: "RPT.0003", revision: 2, status: "EFFECTIVE", changeReason: "Add PDF", createdByName: "Author", approvedByName: "Approver",
    // the stepper comes from the server with the revision
    workflow: {
      steps: [
        { code: "DRAFT", label: "Draft", terminal: false },
        { code: "PENDING_APPROVAL", label: "Pending Approval", terminal: false },
        { code: "EFFECTIVE", label: "Effective", terminal: false },
        { code: "OBSOLETE", label: "Obsoleted", terminal: true },
        { code: "DISCARDED", label: "Closed - Cancelled", terminal: true },
      ],
      currentStepIndex: 2,
      skippedSteps: [],
      terminalProgressStep: "",
    },
    approvedAt: "2026-10-14T10:00:00Z", effectiveAt: "2026-10-14T10:00:00Z",
    content: { displayName: "Register", sourceCode: "DOCUMENT_STATUS", active: true, allowedFormats: ["CSV", "PDF"], fields: [{ code: "documentNumber", name: "Document Number", type: "TEXT", allowed: true, defaultSelected: true, required: true, order: 0 }], roleScopes: [] },
  } as never);
  vi.mocked(reportTemplatesApi.compareRevision).mockResolvedValue({
    revision: 2, comparedWith: 1, changes: [{ section: "Output", item: "Output formats", kind: "CHANGED", from: "CSV", to: "CSV, PDF" }],
  } as never);
});
afterEach(cleanup);

it("shows a revision on its own page, its approval facts, its content and what changed from the revision before", async () => {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/report/template-management/RPT.0003/revisions/2"]}>
        <Routes>
          <Route path="/report/template-management/:code/revisions/:revision" element={<ReportTemplateRevisionPage inAdministration />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  // The page is named by what it is for, as the Document Control pages of a revision are; which revision of which template it is shows in the fields.
  expect(await screen.findByRole("heading", { name: "Revision Details" })).toBeInTheDocument();
  // Opened by its address, its parent is All Revisions; the breadcrumb ends with the same words as the title.
  expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Template ManagementAll RevisionsRevision Details");
  expect(await screen.findByLabelText("Report Template Revision")).toHaveValue("2.0.0");
  expect(screen.getByLabelText("Status")).toHaveValue("Effective");
  expect(screen.getAllByText("Effective").length).toBeGreaterThan(0); // the stepper
  expect(screen.getAllByText("Pending Approval").length).toBeGreaterThan(0); // the stepper shows the steps of a revision
  expect(screen.getByLabelText("Approved By")).toHaveValue("Approver");
  expect(screen.getByLabelText("Output Formats")).toHaveValue("CSV · PDF");
  // the content is in tabs, as in the Report Template Details
  fireEvent.click(screen.getByRole("tab", { name: /Fields/ }));
  expect(await screen.findByText("Document Number")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Back" }).length).toBeGreaterThan(0);
  expect(reportTemplatesApi.compareRevision).toHaveBeenCalledWith("RPT.0003", 2, "previous");
});

it("a revision of a template not used for GMP says that no approval was needed, not who approved it", async () => {
  vi.mocked(reportTemplatesApi.revision).mockResolvedValue({
    definitionCode: "RPT.0003", revision: 2, status: "EFFECTIVE", approvalBasis: "NOT_REQUIRED", approvedByName: null, approvedAt: null, effectiveAt: "2026-11-10T07:00:00Z",
    content: { displayName: "Register", gmpUse: false, allowedFormats: ["PDF"], fields: [], roleScopes: [] },
    workflow: { steps: [{ code: "DRAFT", label: "Step One", terminal: false }, { code: "EFFECTIVE", label: "Step Two", terminal: false }], currentStepIndex: 1, skippedSteps: [], terminalProgressStep: "" },
  } as never);
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/report/template-management/RPT.0003/revisions/2"]}>
        <Routes>
          <Route path="/report/template-management/:code/revisions/:revision" element={<ReportTemplateRevisionPage inAdministration />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  expect(await screen.findByLabelText("Approved By")).toHaveValue("Not required (in force when saved, under the earlier rule)");
  expect(screen.getByLabelText("In Use Since")).toHaveValue("10/11/2026 14:00:00");
  // No approval took place, so the steps of an approval are not drawn.
  expect(screen.queryAllByText("Step One")).toHaveLength(0);
});

/** REPORT-REVISION-TITLES-2026-11-15: the breadcrumb of a revision page leads back to the list or page it was opened from, and ends with the title. */
it.each([
  [{ from: "/report/template-revisions/pending-approval" }, "Template ManagementPending My ApprovalRevision Details"],
  [{ from: "/report/template-revisions" }, "Template ManagementAll RevisionsRevision Details"],
  [{ from: "/report/template-management/RPT.0003/details" }, "Template ManagementReport TemplatesReport Template DetailsRevision Details"],
  [undefined, "Template ManagementAll RevisionsRevision Details"],
])("the revision page opened from %j has the breadcrumb %s", async (state, trail) => {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: "/report/template-management/RPT.0003/revisions/2", state }]}>
        <Routes>
          <Route path="/report/template-management/:code/revisions/:revision" element={<ReportTemplateRevisionPage inAdministration />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  expect(await screen.findByRole("heading", { name: "Revision Details" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(trail);
});
