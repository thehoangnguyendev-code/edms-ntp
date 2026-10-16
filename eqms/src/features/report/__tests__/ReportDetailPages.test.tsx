import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ScheduleEditorPage } from "../scheduled/ScheduleEditorPage";
import { ReportTemplateDetailPage } from "../templates/ReportTemplateDetailPage";
import { reportTemplatesApi, type ReportTemplate } from "@/services/api/reportTemplates";
import { reportsApi } from "@/services/api/reports";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: () => true, hasPermission: () => true }),
}));
// The header shows its title and its breadcrumb labels, so each page's title and trail can be checked.
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, breadcrumbItems, actions, onBack }: any) => (
    <header>
      <h1>{title}</h1>
      <nav aria-label="Breadcrumb">
        {breadcrumbItems.map((item: any) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </nav>
      {onBack && <button type="button" aria-label="Title arrow" onClick={onBack}>arrow</button>}
      {actions}
    </header>
  ),
}));
vi.mock("@/services/api/reportTemplates", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  reportTemplatesApi: { list: vi.fn(), detail: vi.fn(), revisions: vi.fn(), setEnabled: vi.fn(), discardRevision: vi.fn(), capabilities: vi.fn() },
}));
vi.mock("@/services/api/reports", () => ({
  reportsApi: {
    catalog: vi.fn().mockResolvedValue([]),
    listScheduleRecipients: vi.fn().mockResolvedValue([]),
    scheduleDetail: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
  },
}));

const template = {
  code: "DOCUMENT_STATUS",
  sourceCode: "DOCUMENT_STATUS",
  displayName: "Document Register",
  description: "Actual metadata",
  category: "METADATA",
  classification: "REGULATED",
  active: true,
  definitionVersion: 3,
  allowedFormats: ["PDF", "CSV"],
  fields: [{ code: "documentNumber", name: "Document Number", type: "TEXT", allowed: true, defaultSelected: true, required: true, order: 0 }],
  roleScopes: [{ roleId: "role", roleName: "QA", scope: "DEPARTMENT" }],
  lifecycleStatus: "ACTIVE",
  approvalStatus: "APPROVED",
  approvedVersion: 3,
  gmpUse: true,
  layout: { orientation: "PORTRAIT" },
} as unknown as ReportTemplate;

/** The server's decision for the template: the listed actions are allowed, the others are not. */
function allow(...allowed: string[]) {
  const every = ["viewRevisions", "edit", "submitForApproval", "approve", "reject", "upgrade", "discardRevision", "disable", "enable", "delete", "createReport"];
  vi.mocked(reportTemplatesApi.capabilities).mockResolvedValue({
    resourceType: "REPORT_TEMPLATE", resourceId: "DOCUMENT_STATUS", state: "ACTIVE",
    actions: Object.fromEntries(every.map((action) => [action, { allowed: allowed.includes(action) }])),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  allow("viewRevisions", "edit", "createReport", "disable", "upgrade", "discardRevision");
  vi.mocked(reportsApi.catalog).mockResolvedValue([]);
  vi.mocked(reportsApi.listScheduleRecipients).mockResolvedValue([]);
  vi.mocked(reportTemplatesApi.list).mockResolvedValue({ data: [template], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } as never);
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue(template);
  vi.mocked(reportTemplatesApi.revisions).mockResolvedValue({ data: [{ revision: 3, status: "EFFECTIVE", changeReason: "Approved", createdByName: "Author" }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } as never);
});
afterEach(cleanup);

function renderAt(path: string, element: React.ReactNode, route: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          <Route path="/report/scheduled" element={<h2>Scheduled list</h2>} />
          <Route path="/report/templates" element={<h2>Library list</h2>} />
          <Route path="/report/templates/:code/run" element={<h2>Run page</h2>} />
          <Route path="/settings/report-configuration" element={<h2>Definitions list</h2>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("a new schedule opens on its own page, with a title, a full breadcrumb, and no drawer", async () => {
  renderAt("/report/scheduled/new", <ScheduleEditorPage />, "/report/scheduled/new");
  expect(await screen.findByRole("heading", { name: "New Report Schedule" })).toBeInTheDocument();
  const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(trail).toHaveTextContent("Reports & Analytics");
  expect(trail).toHaveTextContent("Scheduled Reports");
  expect(trail).toHaveTextContent("New Report Schedule");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByText("Scheduled list")).toBeInTheDocument();
});

it("an existing schedule is edited on its page and needs a reason before it can be saved", async () => {
  vi.mocked(reportsApi.scheduleDetail).mockResolvedValue({
    id: "s1", version: 2, name: "Monthly register", definitionCode: "DOCUMENT_STATUS", cronExpression: "0 0 8 1 * *",
    format: "PDF", recipientUserIds: [], parameters: {}, fields: [],
  } as never);
  renderAt("/report/scheduled/s1", <ScheduleEditorPage />, "/report/scheduled/:id");
  expect(await screen.findByRole("heading", { name: "Edit Report Schedule" })).toBeInTheDocument();
  expect(await screen.findByDisplayValue("Monthly register")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
});

it("the library shows a template on its page, and Create Report opens the run page", async () => {
  renderAt("/report/templates/DOCUMENT_STATUS", <ReportTemplateDetailPage />, "/report/templates/:code");
  expect(await screen.findByRole("heading", { name: "Report Template Details" })).toBeInTheDocument();
  const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(trail).toHaveTextContent("Reports & Analytics");
  expect(trail).toHaveTextContent("Report Library");
  // The page and the breadcrumb name the screen; the name of the template is a fact in the details.
  expect(trail).toHaveTextContent("Report Template Details");
  expect(trail).not.toHaveTextContent("Document Register");
  expect(screen.getByText("Template name")).toBeInTheDocument();
  expect(screen.getByText("Document Register")).toBeInTheDocument();
  expect(screen.getByText("Document Number")).toBeInTheDocument();
  expect(screen.queryByText("Role scopes")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create Report" }));
  expect(await screen.findByText("Run page")).toBeInTheDocument();
});

it("Report Definitions shows the approval and the role scopes of a template, under Report Administration", async () => {
  renderAt("/settings/report-configuration/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/settings/report-configuration/:code/details");
  expect(await screen.findByRole("heading", { name: "Report Template Details" })).toBeInTheDocument();
  const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(trail).toHaveTextContent("Report Administration");
  expect(trail).toHaveTextContent("Report Definitions");
  await waitFor(() => expect(screen.getByText("Role scopes")).toBeInTheDocument());
  expect(screen.getByText("Approval")).toBeInTheDocument();
  expect(screen.getByText("QA")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create Report" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByText("Definitions list")).toBeInTheDocument();
});

it("every detail page puts Back in the actions, beside the other buttons, and none uses the arrow beside the title", async () => {
  renderAt("/report/templates/DOCUMENT_STATUS", <ReportTemplateDetailPage />, "/report/templates/:code");
  await screen.findByRole("heading", { name: "Report Template Details" });
  expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Back" }).nextElementSibling).toHaveTextContent("Edit Report Template");
  expect(screen.queryByRole("button", { name: "Title arrow" })).not.toBeInTheDocument();
  cleanup();
  renderAt("/report/scheduled/new", <ScheduleEditorPage />, "/report/scheduled/new");
  await screen.findByRole("heading", { name: "New Report Schedule" });
  expect(screen.getByRole("button", { name: "Back" }).nextElementSibling).toHaveTextContent("Save Changes");
  expect(screen.queryByRole("button", { name: "Title arrow" })).not.toBeInTheDocument();
});

it("a template with an effective revision is changed by Upgrade; Edit comes back when the next revision is open", async () => {
  allow("viewRevisions", "upgrade");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, effectiveRevision: 3, openRevision: null } as never);
  renderAt("/settings/report-configuration/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/settings/report-configuration/:code/details");
  expect(await screen.findByRole("button", { name: "Upgrade Report Template" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit Report Template" })).not.toBeInTheDocument();
  cleanup();
  allow("viewRevisions", "edit", "discardRevision");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, effectiveRevision: 3, openRevision: 4, openRevisionStatus: "DRAFT" } as never);
  renderAt("/settings/report-configuration/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/settings/report-configuration/:code/details");
  expect(await screen.findByRole("button", { name: "Edit Report Template" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Upgrade Report Template" })).not.toBeInTheDocument();
});

it("Disable asks for a confirmation and sends it with the optional reason; Discard Revision needs a reason", async () => {
  allow("viewRevisions", "edit", "disable", "discardRevision");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, effectiveRevision: 3, openRevision: 4, openRevisionStatus: "DRAFT" } as never);
  vi.mocked(reportTemplatesApi.setEnabled).mockResolvedValue({ ...template, active: false, effectiveRevision: 3, openRevision: 4, openRevisionStatus: "DRAFT" } as never);
  renderAt("/settings/report-configuration/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/settings/report-configuration/:code/details");
  fireEvent.click(await screen.findByRole("button", { name: "Disable Report Template" }));
  fireEvent.click(await screen.findByRole("button", { name: "Disable" }));
  allow("viewRevisions", "edit", "enable", "discardRevision");
  await waitFor(() => expect(reportTemplatesApi.setEnabled).toHaveBeenCalledWith("DOCUMENT_STATUS", false, ""));
  expect(await screen.findByRole("button", { name: "Enable Report Template" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Discard Revision" }));
  expect(await screen.findByRole("button", { name: "Discard" })).toBeDisabled();
});

it("shows no action the server does not allow for this user, whoever the user is", async () => {
  allow("viewRevisions");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, effectiveRevision: 3, openRevision: null } as never);
  renderAt("/settings/report-configuration/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/settings/report-configuration/:code/details");
  await screen.findByRole("heading", { name: "Report Template Details" });
  await waitFor(() => expect(reportTemplatesApi.capabilities).toHaveBeenCalledWith("DOCUMENT_STATUS"));
  for (const label of ["Upgrade Report Template", "Edit Report Template", "Disable Report Template", "Enable Report Template", "Discard Revision", "Create Report"]) {
    expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
});
