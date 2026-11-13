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
      <MemoryRouter initialEntries={["/report/templates/RPT.0003/revisions/2"]}>
        <Routes>
          <Route path="/report/templates/:code/revisions/:revision" element={<ReportTemplateRevisionPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  expect(await screen.findByRole("heading", { name: "Report Template Revision" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Report Template Details");
  expect(await screen.findByLabelText("Revision")).toHaveValue("2.0.0");
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
