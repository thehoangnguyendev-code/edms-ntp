import "../testing/browserStubs";
import { cleanup, render, screen } from "@testing-library/react";
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
  expect(await screen.findByText("Rev 2")).toBeInTheDocument();
  expect(screen.getAllByText("Effective").length).toBeGreaterThan(1); // the stepper and the status badge
  expect(screen.getAllByText("Pending Approval").length).toBeGreaterThan(0); // the stepper shows the steps of a revision
  expect(screen.getByText("Approver")).toBeInTheDocument();
  expect(screen.getAllByText("Output formats").length).toBe(2);
  expect(screen.getByText("CSV, PDF")).toBeInTheDocument();
  expect(screen.getByText("Document Number")).toBeInTheDocument();
  expect(reportTemplatesApi.compareRevision).toHaveBeenCalledWith("RPT.0003", 2, "previous");
});
