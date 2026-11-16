import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportAppearanceListView } from "../appearance/ReportAppearanceListView";
import { reportAppearanceApi } from "@/services/api/reportAppearance";

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
vi.mock("../appearance/ReportAppearancePreview", () => ({ ReportAppearancePreview: ({ id, name }: any) => <div data-testid="preview">{`${id}:${name}`}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/services/api/reportAppearance", () => ({ reportAppearanceApi: { list: vi.fn(), activate: vi.fn(), remove: vi.fn(), create: vi.fn() } }));

const rows = [
  { id: "a1", name: "Standard", status: "ACTIVE", version: 2, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z", updatedByName: "Admin", activatedAt: "2026-11-10T00:00:00Z" },
  { id: "a2", name: "Audit look", status: "INACTIVE", version: 1, createdAt: "2026-11-02T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z", updatedByName: "Admin", activatedAt: null },
];

beforeEach(() => {
  canManage = true;
  vi.mocked(reportAppearanceApi.list).mockResolvedValue({ data: rows, pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } } as never);
  vi.mocked(reportAppearanceApi.activate).mockResolvedValue({} as never);
  vi.mocked(reportAppearanceApi.remove).mockResolvedValue({} as never);
});
afterEach(cleanup);

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderView() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/settings/report-appearance"]}>
        <Routes>
          <Route path="/settings/report-appearance" element={<ReportAppearanceListView />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

async function openMenu(name: string) {
  const row = (await screen.findByText(name)).closest("tr")!;
  fireEvent.click(row.querySelector('button[aria-label="More actions"]')!);
}

it("lists the appearances with the Active one marked, asks the server to search, sort and page, and has no sample layout button", async () => {
  renderView();
  expect(await screen.findByText("Audit look")).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByText("Inactive")).toBeInTheDocument();
  expect(reportAppearanceApi.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, sort: "status", direction: "desc" }));
  expect(screen.queryByRole("button", { name: /sample layout/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create Appearance" })).toBeInTheDocument();
});

it("the action menu has Preview, Edit, Duplicate, Activate and Delete, and the Active one can be neither activated nor deleted", async () => {
  renderView();
  await openMenu("Standard");
  expect(await screen.findByText("Preview Report Appearance")).toBeInTheDocument();
  for (const label of ["Edit", "Duplicate"]) expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText("Activate").closest("button")).toBeDisabled();
  expect(screen.getByText("Delete").closest("button")).toBeDisabled();
});

it("Preview opens the pages of that appearance", async () => {
  renderView();
  await openMenu("Audit look");
  fireEvent.click(await screen.findByText("Preview Report Appearance"));
  expect(await screen.findByTestId("preview")).toHaveTextContent("a2:Audit look");
});

it("activating asks for a confirmation that says the present one becomes Inactive, then activates", async () => {
  renderView();
  await openMenu("Audit look");
  fireEvent.click(await screen.findByText("Activate"));
  expect(await screen.findByText(/becomes Inactive/)).toBeInTheDocument();
  expect(reportAppearanceApi.activate).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Activate" }).at(-1)!);
  await waitFor(() => expect(reportAppearanceApi.activate).toHaveBeenCalledWith("a2"));
});

it("deleting an Inactive appearance asks first", async () => {
  renderView();
  await openMenu("Audit look");
  fireEvent.click(await screen.findByText("Delete"));
  await screen.findByText(/cannot be undone/);
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
  await waitFor(() => expect(reportAppearanceApi.remove).toHaveBeenCalledWith("a2"));
});

it("Create Appearance opens the screen of a new appearance, and Duplicate opens it as a copy of the row", async () => {
  renderView();
  fireEvent.click(await screen.findByRole("button", { name: "Create Appearance" }));
  expect(await screen.findByTestId("where")).toHaveTextContent("/settings/report-appearance/new");
  cleanup();
  renderView();
  await openMenu("Audit look");
  fireEvent.click(await screen.findByText("Duplicate"));
  expect(await screen.findByTestId("where")).toHaveTextContent("/settings/report-appearance/new?copyFrom=a2");
});

it("the list has filters for the status, the paper, the font, the cover page and the logo, and for the two dates, and the server applies them", async () => {
  renderView();
  await screen.findByText("Audit look");
  for (const label of ["Appearance Status", "Paper", "Font", "Cover page", "Logo", "Last Updated", "Activated At"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  expect(reportAppearanceApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: undefined, orientation: undefined, font: undefined, cover: undefined, logo: undefined }));
});

it("without the manage permission the list can be read and previewed but not changed", async () => {
  canManage = false;
  renderView();
  await openMenu("Audit look");
  expect(await screen.findByText("Preview Report Appearance")).toBeInTheDocument();
  expect(screen.getByText("View Detail")).toBeInTheDocument();
  expect(screen.queryByText("Activate")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create Appearance" })).not.toBeInTheDocument();
  expect(screen.queryByText("Duplicate")).not.toBeInTheDocument();
});
