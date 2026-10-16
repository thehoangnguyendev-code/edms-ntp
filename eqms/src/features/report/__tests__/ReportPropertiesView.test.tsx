import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportPropertiesView } from "../properties/ReportPropertiesView";
import { reportPropertiesApi } from "@/services/api/reportProperties";
import { defaultReportLayout } from "@/services/api/reportTemplates";

let canManage = true;
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAnyPermission: () => canManage, hasPermission: () => canManage }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: any) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("../templates/ReportLayoutDesigner", () => ({
  ReportLayoutDesigner: ({ value, disabled, onChange }: any) => (
    <div data-testid="appearance" data-disabled={disabled}>
      <input aria-label="Appearance header" value={value.header} disabled={disabled} onChange={(e) => onChange({ ...value, header: e.target.value })} />
    </div>
  ),
}));
vi.mock("@/services/api/reportProperties", () => ({ reportPropertiesApi: { get: vi.fn(), update: vi.fn() } }));

const properties = {
  templateNumberPrefix: "RPT", templateNumberDigits: 4, templateNumberSeparator: ".", lastTemplateSerial: 5, nextTemplateNumber: "RPT.0006",
  maxRows: 10000, maxScheduleRecipients: 200, scheduleRetryMinutes: 5, version: 2, appearance: defaultReportLayout(),
};

beforeEach(() => {
  canManage = true;
  vi.mocked(reportPropertiesApi.get).mockResolvedValue(properties as never);
});
afterEach(cleanup);

function renderView() {
  render(
    <ToastProvider>
      <MemoryRouter>
        <ReportPropertiesView />
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("shows the settings in sections like Document Properties and saves only after a confirmation that names the Audit Trail", async () => {
  vi.mocked(reportPropertiesApi.update).mockResolvedValue({ ...properties, templateNumberPrefix: "QA", version: 3 } as never);
  renderView();
  expect(await screen.findByRole("heading", { name: "Report Properties" })).toBeInTheDocument();
  expect(await screen.findByText("Template Numbering & Name")).toBeInTheDocument();
  expect(screen.getByText("Report Size & Retention")).toBeInTheDocument();
  expect(screen.getByText("Scheduled Reports")).toBeInTheDocument();
  expect(screen.getByText("Report Appearance")).toBeInTheDocument();
  expect(screen.getByDisplayValue("RPT.0006")).toBeInTheDocument();
  const save = screen.getByRole("button", { name: "Save Changes" });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByDisplayValue("RPT"), { target: { value: "qa" } });
  expect(screen.getByDisplayValue("QA.0006")).toBeInTheDocument(); // the preview follows the field
  expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(await screen.findByText(/recorded in the Audit Trail/)).toBeInTheDocument();
  expect(reportPropertiesApi.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Save Changes" }).at(-1)!);
  await waitFor(() => expect(reportPropertiesApi.update).toHaveBeenCalledWith(expect.objectContaining({ version: 2, templateNumberPrefix: "QA", maxRows: 10000, maxScheduleRecipients: 200, scheduleRetryMinutes: 5 })));
});

it("is read-only without the manage permission: no Save Changes and the fields are locked", async () => {
  canManage = false;
  renderView();
  await screen.findByText("Template Numbering & Name");
  expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  expect(screen.getByDisplayValue("RPT")).toBeDisabled();
  expect(screen.getByLabelText("Appearance header")).toBeDisabled();
});

it("keeps a number inside its limit", async () => {
  renderView();
  await screen.findByText("Scheduled Reports");
  fireEvent.change(screen.getByDisplayValue("10000"), { target: { value: "500000" } });
  expect(screen.getByDisplayValue("100000")).toBeInTheDocument();
});

it("saves the company appearance with the settings, after the same confirmation", async () => {
  vi.mocked(reportPropertiesApi.update).mockResolvedValue({ ...properties, version: 3 } as never);
  renderView();
  await screen.findByText("Report Appearance");
  fireEvent.change(screen.getByLabelText("Appearance header"), { target: { value: "ACME header" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Save Changes" }).at(-1)!);
  await waitFor(() =>
    expect(reportPropertiesApi.update).toHaveBeenCalledWith(expect.objectContaining({ version: 2, appearance: expect.objectContaining({ header: "ACME header" }) })),
  );
});
