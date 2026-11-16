import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportAppearanceView } from "../appearance/ReportAppearanceView";
import { reportAppearanceApi } from "@/services/api/reportAppearance";
import { defaultReportLayout } from "@/services/api/reportTemplates";

let canManage = true;
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAnyPermission: (codes: string[]) => canManage && codes.includes("reports.appearance.manage"), hasPermission: () => canManage }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: any) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("../appearance/ReportAppearanceEditor", () => ({
  ReportAppearanceEditor: ({ value, disabled, onChange }: any) => (
    <div data-testid="appearance" data-disabled={disabled}>
      <input aria-label="Appearance header" value={value.header} disabled={disabled} onChange={(e) => onChange({ ...value, header: e.target.value })} />
    </div>
  ),
}));
vi.mock("@/services/api/reportAppearance", () => ({ reportAppearanceApi: { get: vi.fn(), update: vi.fn(), create: vi.fn(), list: vi.fn() } }));

const loaded = { id: "a1", name: "Standard", status: "ACTIVE", appearance: defaultReportLayout(), version: 4, createdAt: "2026-11-14T00:00:00Z", updatedAt: "2026-11-14T00:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  canManage = true;
  vi.mocked(reportAppearanceApi.get).mockResolvedValue(loaded as never);
});
afterEach(cleanup);

function renderView(path = "/settings/report-appearance/a1") {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/report-appearance/new" element={<ReportAppearanceView />} />
          <Route path="/settings/report-appearance/:id" element={<ReportAppearanceView />} />
          <Route path="/settings/report-appearance" element={<p>the list</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("opens the appearance of its address, named by its function, and saves only after a confirmation that names the Audit Trail", async () => {
  vi.mocked(reportAppearanceApi.update).mockResolvedValue({ ...loaded, version: 5 } as never);
  renderView();
  expect(await screen.findByRole("heading", { name: "Report Appearance Details" })).toBeInTheDocument();
  expect(reportAppearanceApi.get).toHaveBeenCalledWith("a1");
  const save = await screen.findByRole("button", { name: "Save" });
  expect(save).toBeDisabled();
  fireEvent.change(await screen.findByLabelText("Appearance header"), { target: { value: "ACME header" } });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(await screen.findByText(/recorded in the Audit Trail/)).toBeInTheDocument();
  expect(screen.getByText(/It is the Active appearance/)).toBeInTheDocument();
  expect(reportAppearanceApi.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Save" }).at(-1)!);
  await waitFor(() => expect(reportAppearanceApi.update).toHaveBeenCalledWith("a1", { version: 4, name: "Standard", appearance: expect.objectContaining({ header: "ACME header" }) }));
});

it("a new name alone makes the page changed, ready to save", async () => {
  renderView();
  await screen.findByTestId("appearance");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/^Appearance Name/), { target: { value: "Audit look" } });
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

it("is read-only without the manage permission: no Save, a locked name and a locked designer", async () => {
  canManage = false;
  renderView();
  expect(await screen.findByLabelText("Appearance header")).toBeDisabled();
  expect(screen.getByLabelText(/^Appearance Name/)).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
});

it("says so when the appearance cannot be read, and offers a retry", async () => {
  vi.mocked(reportAppearanceApi.get).mockRejectedValueOnce({ response: { status: 403 } });
  renderView();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByLabelText("Appearance header")).toBeInTheDocument();
});

it("has a Back button that returns to the list, and no Preview, sample layout or guided setup button", async () => {
  renderView();
  await screen.findByTestId("appearance");
  expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /sample layout/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /guided/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByText("the list")).toBeInTheDocument();
});

it("at the address new it makes a new appearance: a name is needed, it is created Inactive with the layout that was set, and the screen of the new one opens", async () => {
  vi.mocked(reportAppearanceApi.list).mockResolvedValue({ data: [loaded], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } } as never);
  vi.mocked(reportAppearanceApi.create).mockResolvedValue({ ...loaded, id: "n1", name: "Site B", status: "INACTIVE", version: 1 } as never);
  renderView("/settings/report-appearance/new");
  expect(await screen.findByRole("heading", { name: "Create Appearance" })).toBeInTheDocument();
  expect(reportAppearanceApi.get).not.toHaveBeenCalled();
  expect(screen.getByText("New")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/^Appearance Name/), { target: { value: "Site B" } });
  fireEvent.change(screen.getByLabelText("Appearance header"), { target: { value: "ACME header" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText(/created Inactive/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(reportAppearanceApi.create).toHaveBeenCalledWith("Site B", expect.objectContaining({ header: "ACME header" }), undefined));
});

it("a copy opens with the layout of the row and a name that says it is a copy", async () => {
  vi.mocked(reportAppearanceApi.list).mockResolvedValue({ data: [loaded], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } } as never);
  renderView("/settings/report-appearance/new?copyFrom=a1");
  expect(await screen.findByDisplayValue("Standard copy")).toBeInTheDocument();
  expect(reportAppearanceApi.get).toHaveBeenCalledWith("a1");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});
