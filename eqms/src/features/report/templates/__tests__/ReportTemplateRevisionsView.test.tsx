import "../../testing/browserStubs";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportTemplateRevisionsView } from "../ReportTemplateRevisionsView";
import { reportTemplatesApi } from "@/services/api/reportTemplates";

vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title, breadcrumbItems }: any) => (
  <header><h1>{title}</h1><nav aria-label="Breadcrumb">{(breadcrumbItems ?? []).map((item: any) => item.label).join(" > ")}</nav></header>
) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/services/api/reportTemplates", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  reportTemplatesApi: { allRevisions: vi.fn(), sources: vi.fn() },
}));

const pagination = { page: 1, limit: 10, total: 2, totalPages: 1 };
const rows = [
  { definitionCode: "RPT.0024", displayName: "Batch release register", sourceCode: "DOCUMENT_STATUS", revision: 2, status: "PENDING_APPROVAL", gmpUse: true, approvalBasis: "APPROVED", createdByName: "Author", lastChangedAt: "2026-11-15T07:00:00Z" },
  { definitionCode: "RPT.0008", displayName: "Audit e2e", sourceCode: "AUDIT_TRAIL", revision: 1, status: "EFFECTIVE", gmpUse: false, approvalBasis: "NOT_REQUIRED", createdByName: "Author", lastChangedAt: "2026-11-14T07:00:00Z", effectiveAt: "2026-11-14T07:00:00Z" },
];

function show(pendingApproval = false) {
  render(
    <ToastProvider><MemoryRouter initialEntries={["/report/template-revisions"]}>
      <Routes>
        <Route path="/report/template-revisions" element={<ReportTemplateRevisionsView pendingApproval={pendingApproval} />} />
        <Route path="/report/template-management/:code/revisions/:revision" element={<h2>Revision page</h2>} />
        <Route path="/report/template-management/:code/details" element={<h2>Template page</h2>} />
        <Route path="/report/template-management/:code" element={<h2>Template editor</h2>} />
      </Routes>
    </MemoryRouter></ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reportTemplatesApi.sources).mockResolvedValue([{ code: "DOCUMENT_STATUS", name: "Document status", fields: {}, requiredFields: [] }, { code: "AUDIT_TRAIL", name: "Audit trail", fields: {}, requiredFields: [] }] as never);
  vi.mocked(reportTemplatesApi.allRevisions).mockResolvedValue({ data: rows, pagination } as never);
});

describe("Report Template Revisions list", () => {
  it("lists the revisions of every template with a GMP column, and the approval each one has", async () => {
    show();
    expect(await screen.findByRole("heading", { name: "All Revisions" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Reports");
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: /GMP/ })).toBeInTheDocument();
    expect(await within(table).findByText("RPT.0024")).toBeInTheDocument();
    expect(within(table).getAllByText("GMP")).toHaveLength(1); // the badge of the GMP revision (the column heading is Used for GMP Decisions)
    expect(within(table).getByText("Used for GMP Decisions")).toBeInTheDocument();
    expect(within(table).getByText("Not GMP")).toBeInTheDocument();
    expect(within(table).getByText("Not required")).toBeInTheDocument(); // the revision nobody had to approve
    expect(within(table).getByText("Pending Approval")).toBeInTheDocument();
    expect(within(table).getByText("Effective")).toBeInTheDocument();
    // A revision is read as 1.0.0, as a Document revision is; a revision being written is 1.0.1.
    expect(within(table).getByText("1.0.1")).toBeInTheDocument();
    expect(within(table).getByText("1.0.0")).toBeInTheDocument();
  });

  it("asks the server for the whole list, and sends the filter on GMP", async () => {
    show();
    await screen.findByText("RPT.0024");
    await waitFor(() => expect(reportTemplatesApi.allRevisions).toHaveBeenCalledWith(expect.objectContaining({ scope: "all", page: 1, limit: 10 })));
    fireEvent.click(screen.getByRole("combobox", { name: "Used for GMP Decisions" }));
    fireEvent.click(await screen.findByRole("option", { name: "Yes" }));
    await waitFor(() => expect(reportTemplatesApi.allRevisions).toHaveBeenLastCalledWith(expect.objectContaining({ gmp: "YES" })));
  });

  it("Pending My Approval asks only for what this person may decide", async () => {
    show(true);
    expect(await screen.findByRole("heading", { name: "Pending My Approval" })).toBeInTheDocument();
    await waitFor(() => expect(reportTemplatesApi.allRevisions).toHaveBeenCalledWith(expect.objectContaining({ scope: "pending-approval" })));
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
  });

  it("opens the revision, and the template, on their own pages", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "1.0.1" }));
    expect(await screen.findByText("Revision page")).toBeInTheDocument();
  });

  it("from Pending My Approval a revision opens on the page where it is approved or returned", async () => {
    show(true);
    fireEvent.click(await screen.findByRole("button", { name: "1.0.1" }));
    expect(await screen.findByText("Template editor")).toBeInTheDocument();
  });

  it("has a row menu built from the status and what the server allows: View Details for all, Approve Revision on a pending one, Upgrade on the one in force", async () => {
    const can = (...names: string[]) => ({ resourceType: "REPORT_TEMPLATE", resourceId: "x", state: "ACTIVE", actions: Object.fromEntries(names.map((name) => [name, { allowed: true }])) });
    vi.mocked(reportTemplatesApi.allRevisions).mockResolvedValue({ data: [{ ...rows[0], capabilities: can("approve") }, { ...rows[1], capabilities: can("upgrade") }], pagination } as never);
    show();
    const menus = await screen.findAllByRole("button", { name: "More actions" });
    expect(menus).toHaveLength(2);
    fireEvent.click(menus[0]);
    expect(await screen.findByText("View Details")).toBeInTheDocument();
    expect(screen.getByText("Approve Revision")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade Report Template")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Approve Revision"));
    expect(await screen.findByText("Template editor")).toBeInTheDocument();
  });

  it("opens the details page of the template with the Upgrade dialog asked for, from the revision in force", async () => {
    const can = (...names: string[]) => ({ resourceType: "REPORT_TEMPLATE", resourceId: "x", state: "ACTIVE", actions: Object.fromEntries(names.map((name) => [name, { allowed: true }])) });
    vi.mocked(reportTemplatesApi.allRevisions).mockResolvedValue({ data: [{ ...rows[1], capabilities: can("upgrade") }], pagination } as never);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("Upgrade Report Template"));
    expect(await screen.findByText("Template page")).toBeInTheDocument();
  });

  it("offers a person with no permission only View Details", async () => {
    show();
    fireEvent.click((await screen.findAllByRole("button", { name: "More actions" }))[0]);
    expect(await screen.findByText("View Details")).toBeInTheDocument();
    expect(screen.queryByText("Approve Revision")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit Revision")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("View Details"));
    expect(await screen.findByText("Revision page")).toBeInTheDocument();
  });

  it("says so when nothing is waiting", async () => {
    vi.mocked(reportTemplatesApi.allRevisions).mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } } as never);
    show(true);
    expect(await screen.findByText("Nothing Is Waiting For Your Approval")).toBeInTheDocument();
  });
});
