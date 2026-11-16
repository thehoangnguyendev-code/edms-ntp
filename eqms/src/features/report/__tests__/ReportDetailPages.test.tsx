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
// The Audit Trail tab is the shared one of the Document details; here it only shows what it was asked to read.
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({
  AuditTrailTab: (props: { entityType?: string; entityId?: string }) => <div>{`Audit Trail of ${props.entityType} ${props.entityId}`}</div>,
}));
vi.mock("@/services/api/reports", () => ({
  reportsApi: {
    catalog: vi.fn().mockResolvedValue([]),
    listScheduleRecipients: vi.fn().mockResolvedValue([]),
    recipientPeople: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    recipientGroups: vi.fn().mockResolvedValue([]),
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
  const every = ["viewAuditTrail", "viewRevisions", "edit", "submitForApproval", "approve", "reject", "upgrade", "discardRevision", "disable", "enable", "delete", "createReport"];
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
          <Route path="/report/template-management" element={<h2>Definitions list</h2>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("a new schedule opens on its own page, with a title, a full breadcrumb, and no drawer", async () => {
  renderAt("/report/scheduled/new", <ScheduleEditorPage />, "/report/scheduled/new");
  expect(await screen.findByRole("heading", { name: "New Report Schedule" })).toBeInTheDocument();
  const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(trail).toHaveTextContent("Reports");
  expect(trail).toHaveTextContent("Scheduled Reports");
  expect(trail).toHaveTextContent("New Report Schedule");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  // Back and Save Changes are in the actions and again under the card, as on the other pages; the page has tabs.
  for (const save of screen.getAllByRole("button", { name: "Save" })) expect(save).toBeDisabled();
  expect(screen.getAllByRole("button", { name: "Back" })).toHaveLength(2);
  for (const name of [/General Information/, /Criteria & Columns/, /Recipients/]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
  expect(screen.getByLabelText(/Schedule Name/)).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
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
  expect(screen.getByLabelText(/Reason For The Change/)).toBeInTheDocument();
  for (const save of screen.getAllByRole("button", { name: "Save" })) expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Reason For The Change/), { target: { value: "Move to the first of the month" } });
  for (const save of screen.getAllByRole("button", { name: "Save" })) expect(save).toBeEnabled();
});

it("a schedule whose template is not in the catalog still names its template and offers every format the template allows", async () => {
  vi.mocked(reportsApi.scheduleDetail).mockResolvedValue({
    id: "s2", version: 1, name: "Weekly register", definitionCode: "DOCUMENT_STATUS", cronExpression: "0 0 8 * * MON", format: "PDF", recipientUserIds: [], parameters: {}, fields: [],
    definitionName: "Document Status Report", allowedFormats: ["PDF", "XLSX", "CSV"],
  } as never);
  renderAt("/report/scheduled/s2", <ScheduleEditorPage />, "/report/scheduled/:id");

  expect(await screen.findByDisplayValue("Weekly register")).toBeInTheDocument();
  expect(screen.getByText("Document Status Report")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Output Format" }));
  for (const format of ["PDF", "XLSX", "CSV"]) expect(await screen.findByRole("option", { name: format })).toBeInTheDocument();
});

it("the library shows a template on its page, and Create Report opens the run page", async () => {
  renderAt("/report/templates/DOCUMENT_STATUS", <ReportTemplateDetailPage />, "/report/templates/:code");
  expect(await screen.findByRole("heading", { name: "Report Details" })).toBeInTheDocument();
  const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(trail).toHaveTextContent("Reports");
  expect(trail).toHaveTextContent("Report Library");
  // The page and the breadcrumb name the screen; the name of the template is a fact in the details.
  expect(trail).toHaveTextContent("Report Details");
  expect(trail).not.toHaveTextContent("Document Register");
  expect(screen.getByLabelText("Report Template Name")).toHaveValue("Document Register");
  fireEvent.click(screen.getByRole("tab", { name: /Fields/ }));
  expect(screen.getByText("Document Number")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Role Scopes/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Create Report" })[0]);
  expect(await screen.findByText("Run page")).toBeInTheDocument();
});

it("Report Templates shows the approval and the role scopes of a template, in Reports", async () => {
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByRole("heading", { name: "Report Template Details" })).toBeInTheDocument();
  const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(trail).toHaveTextContent("Reports");
  expect(trail).not.toHaveTextContent("Report Administration");
  expect(trail).toHaveTextContent("Report Templates");
  expect(await screen.findByLabelText("Approval State")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Role Scopes/ }));
  expect(await screen.findByText("Data scope")).toBeInTheDocument();
  expect(screen.getByText("QA")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create Report" })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
  expect(await screen.findByText("Definitions list")).toBeInTheDocument();
});

it("every detail page puts Back in the actions, beside the other buttons, and none uses the arrow beside the title", async () => {
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  await screen.findByRole("heading", { name: "Report Template Details" });
  expect(screen.getAllByRole("button", { name: "Back" })[0]).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Back" })[0].nextElementSibling).toHaveTextContent(/Report Template|Revision/);
  expect(screen.queryByRole("button", { name: "Title arrow" })).not.toBeInTheDocument();
  cleanup();
  renderAt("/report/scheduled/new", <ScheduleEditorPage />, "/report/scheduled/new");
  await screen.findByRole("heading", { name: "New Report Schedule" });
  expect(screen.getAllByRole("button", { name: "Back" })[0].nextElementSibling).toHaveTextContent("Save");
  expect(screen.queryByRole("button", { name: "Title arrow" })).not.toBeInTheDocument();
});

it("a template with an effective revision is changed by Upgrade; Edit comes back when the next revision is open", async () => {
  allow("viewRevisions", "upgrade");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, effectiveRevision: 3, openRevision: null } as never);
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByRole("button", { name: "Upgrade Report Template" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit Report Template" })).not.toBeInTheDocument();
  cleanup();
  allow("viewRevisions", "edit", "discardRevision");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, effectiveRevision: 3, openRevision: 4, openRevisionStatus: "DRAFT" } as never);
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByRole("button", { name: "Edit Report Template" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Upgrade Report Template" })).not.toBeInTheDocument();
});

it("Disable asks for a confirmation and sends it with the optional reason; Discard Revision needs a reason", async () => {
  allow("viewRevisions", "edit", "disable", "discardRevision");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, effectiveRevision: 3, openRevision: 4, openRevisionStatus: "DRAFT" } as never);
  vi.mocked(reportTemplatesApi.setEnabled).mockResolvedValue({ ...template, active: false, effectiveRevision: 3, openRevision: 4, openRevisionStatus: "DRAFT" } as never);
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
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
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  await screen.findByRole("heading", { name: "Report Template Details" });
  await waitFor(() => expect(reportTemplatesApi.capabilities).toHaveBeenCalledWith("DOCUMENT_STATUS"));
  for (const label of ["Upgrade Report Template", "Edit Report Template", "Disable Report Template", "Enable Report Template", "Discard Revision", "Create Report"]) {
    expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
  }
  expect(screen.getAllByRole("button", { name: "Back" })[0]).toBeInTheDocument();
});

it("the Audit Trail is a tab of the page and reads the entries of this template only", async () => {
  allow("viewRevisions", "viewAuditTrail");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, auditEntityId: "audit-key-1" } as never);
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByRole("heading", { name: "Report Template Details" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Audit Trail" })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("tab", { name: "Audit Trail" }));
  expect(await screen.findByText("Audit Trail of REPORT_DEFINITION audit-key-1")).toBeInTheDocument();
});

it("a person without the Audit Trail permission has no Audit Trail tab", async () => {
  allow("createReport");
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, auditEntityId: "audit-key-1" } as never);
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByRole("heading", { name: "Report Template Details" })).toBeInTheDocument();
  await screen.findByRole("tab", { name: /Fields/ });
  expect(screen.queryByRole("tab", { name: "Audit Trail" })).not.toBeInTheDocument();
});

it("the library page has Back and Create Report, and nothing of how the template is made: no revisions, no revision in progress, no Edit", async () => {
  renderAt("/report/templates/DOCUMENT_STATUS", <ReportTemplateDetailPage />, "/report/templates/:code");
  expect(await screen.findByRole("heading", { name: "Report Details" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Back" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Create Report" })).toHaveLength(2);
  expect(screen.queryByRole("tab", { name: /Revisions/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Search revisions" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Revision In Progress")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit Report Template" })).not.toBeInTheDocument();
  expect(await screen.findByLabelText("Approved On")).toBeInTheDocument();
});

it("Report Templates has Revisions as a tab below the footer buttons, with one search and no status filter or column control", async () => {
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByRole("heading", { name: "Report Template Details" })).toBeInTheDocument();
  const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent ?? "");
  expect(tabs.filter((text) => /Revisions/.test(text))).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Back" })).toHaveLength(2);
  expect(await screen.findByRole("textbox", { name: "Search revisions" })).toBeInTheDocument();
  expect(screen.queryByText("Custom Column")).not.toBeInTheDocument();
  expect(screen.queryByText(/does not grant access to source-document content/)).not.toBeInTheDocument();
  const labels = screen.getAllByText(/^(Created Time|Last Updated|Report Template Name)$/).map((node) => node.textContent);
  expect(labels.slice(0, 3)).toEqual(["Created Time", "Last Updated", "Report Template Name"]);
  // the revision is read as 3.0.0, as a Document revision is
  expect(await screen.findByText("3.0.0")).toBeInTheDocument();
});

it("a revision that came into force without approval, under the earlier rule, says so and since when; every other one says who approved it", async () => {
  const notRequired = { ...template, gmpUse: false, approvalBasis: "NOT_REQUIRED", inUseSince: "2026-11-10T07:00:00Z" } as never;
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue(notRequired);
  vi.mocked(reportTemplatesApi.list).mockResolvedValue({ data: [notRequired], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } as never);
  renderAt("/report/templates/DOCUMENT_STATUS", <ReportTemplateDetailPage />, "/report/templates/:code");
  expect(await screen.findByLabelText("In Use Since")).toHaveValue("10/11/2026 14:00:00");
  expect(screen.queryByLabelText("Approved On")).not.toBeInTheDocument();
  cleanup();
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByLabelText("Approval State")).toHaveValue("Not required (in force when saved, under the earlier rule)");
  cleanup();
  vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, gmpUse: false, approvalBasis: "APPROVED", approvalStatus: "APPROVED" } as never);
  renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
  expect(await screen.findByLabelText("Approval State")).toHaveValue("Approved");
});

it("every template, whatever its use, shows the steps of its revision", async () => {
  const workflow = { steps: [{ code: "DRAFT", label: "Step One", terminal: false }, { code: "PENDING_APPROVAL", label: "Step Two", terminal: false }, { code: "EFFECTIVE", label: "Step Three", terminal: false }], currentStepIndex: 1, skippedSteps: [], terminalProgressStep: "" };
  for (const gmpUse of [true, false]) {
    vi.mocked(reportTemplatesApi.detail).mockResolvedValue({ ...template, gmpUse, workflow } as never);
    renderAt("/report/template-management/DOCUMENT_STATUS/details", <ReportTemplateDetailPage inAdministration />, "/report/template-management/:code/details");
    expect((await screen.findAllByText("Step Two")).length).toBeGreaterThan(0); // the stepper draws a label for wide and for narrow screens
    cleanup();
  }
});
