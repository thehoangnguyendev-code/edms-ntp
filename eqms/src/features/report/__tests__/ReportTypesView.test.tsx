import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportTypesView } from "../types/ReportTypesView";
import { reportTypesApi } from "@/services/api/reportTypes";

let canManage = true;
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAnyPermission: () => canManage, hasPermission: () => canManage }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title }: any) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));
vi.mock("@/services/api/reportTypes", () => ({ reportTypesApi: { list: vi.fn(), detail: vi.fn(), setEnabled: vi.fn() } }));

const documents = {
  code: "DOCUMENT_STATUS", name: "Document Register", category: "Documents", description: "Controlled documents", columnCount: 8, templateCount: 3, enabled: true, version: 1,
};
const page = { data: [documents], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }, categories: ["Documents"] };

beforeEach(() => {
  canManage = true;
  vi.mocked(reportTypesApi.list).mockResolvedValue(page);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderView() {
  render(
    <ToastProvider>
      <MemoryRouter>
        <ReportTypesView />
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("lists the report types the server returns and asks the server to search, filter and sort", async () => {
  renderView();
  expect(await screen.findByText("Document Register")).toBeInTheDocument();
  expect(screen.getByText("Enabled")).toBeInTheDocument();
  expect(vi.mocked(reportTypesApi.list)).toHaveBeenCalledWith(expect.objectContaining({ status: "ALL", sortBy: "name", sortDirection: "asc", page: 1 }));
});

it("has no row that opens under a type: its columns and filters are on its detail page", async () => {
  renderView();
  await screen.findByText("Document Register");
  expect(screen.queryByRole("button", { name: "Expand" })).not.toBeInTheDocument();
  expect(reportTypesApi.detail).not.toHaveBeenCalled();
});

it("disables a type only with a reason, and sends the version that was read", async () => {
  vi.mocked(reportTypesApi.setEnabled).mockResolvedValue({ ...documents, enabled: false, version: 2, columns: [], filters: [], usePermissions: [], requiredPermissions: [] });
  renderView();
  await screen.findByText("Document Register");
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(await screen.findByText("Disable"));
  fireEvent.click(screen.getAllByRole("button", { name: "Disable" }).at(-1)!);
  expect(await screen.findByText(/A reason is required/)).toBeInTheDocument();
  expect(reportTypesApi.setEnabled).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText(/Recorded with your name/), { target: { value: "retired source" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Disable" }).at(-1)!);
  await waitFor(() => expect(reportTypesApi.setEnabled).toHaveBeenCalledWith("DOCUMENT_STATUS", 1, false, "retired source"));
});

it("offers no Enable or Disable to a person without the manage permission", async () => {
  canManage = false;
  renderView();
  await screen.findByText("Document Register");
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(await screen.findByText("View Detail")).toBeInTheDocument();
  expect(screen.queryByText("Disable")).not.toBeInTheDocument();
});

it("has a Modified Date Range filter, and the server is asked for the range", async () => {
  renderView();
  await screen.findByText("Document Register");
  expect(screen.getAllByText("Modified Date Range").length).toBeGreaterThan(0);
  expect(vi.mocked(reportTypesApi.list)).toHaveBeenCalledWith(expect.objectContaining({ modifiedFrom: undefined, modifiedTo: undefined }));
});
