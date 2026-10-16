import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportNameFormatsView } from "../name-formats/ReportNameFormatsView";
import { reportNameFormatsApi } from "@/services/api/reportNameFormats";

vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAnyPermission: () => true, hasPermission: () => true }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: any) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("@/services/api/reportNameFormats", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  reportNameFormatsApi: { list: vi.fn(), setActive: vi.fn() },
}));

const item = { id: "f1", code: "EQMS_TITLE", name: "EQMS title", separator: " - ", active: true, version: 2, partCount: 2, example: "EQMS - <Title>" };

beforeEach(() => {
  vi.mocked(reportNameFormatsApi.list).mockResolvedValue({ data: [item], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } as never);
});
afterEach(cleanup);

function renderList() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/settings/report-name-formats"]}>
        <Routes>
          <Route path="/settings/report-name-formats" element={<ReportNameFormatsView />} />
          <Route path="/settings/report-name-formats/:id" element={<h2>Format page</h2>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("is built like the Document Name Formats table: No. column, three-dot menu, and a row that expands to show its parts", async () => {
  vi.mocked(reportNameFormatsApi.list).mockResolvedValue({
    data: [{ ...item, updatedAt: "2026-10-14T03:00:00Z", parts: [{ type: "FIXED", fixedText: "EQMS" }, { type: "INPUT", inputLabel: "Title", inputRule: "TEXT", maxLength: 100 }] }],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
  } as never);
  renderList();
  await screen.findByText("EQMS title");
  const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
  expect(headers).toEqual(expect.arrayContaining(["No.", "Name", "Code", "Separator", "Description", "Status", "Modified Date"]));
  expect(screen.getByText("e.g. EQMS - <Title>")).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(vi.mocked(reportNameFormatsApi.list).mock.calls.length).toBeLessThan(4); // one load, not a loop

  // The row expands to its parts.
  fireEvent.click(screen.getByRole("button", { name: "Expand" }));
  expect(await screen.findByText("Name Parts (2)")).toBeInTheDocument();
  expect(screen.getByText("EQMS")).toBeInTheDocument();

  // Three-dot menu: View Detail, Edit, Disable. Disabling asks for a reason first and sends nothing without it.
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(await screen.findByText("View Detail")).toBeInTheDocument();
  expect(screen.getByText("Edit Report Name Format")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Disable"));
  expect(await screen.findByText("Deactivate Report Name Format?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
  expect(await screen.findByText(/A reason is required/)).toBeInTheDocument();
  expect(reportNameFormatsApi.setActive).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText("Recorded with your name and the time"), { target: { value: "Retired" } });
  vi.mocked(reportNameFormatsApi.setActive).mockResolvedValue({} as never);
  fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
  await waitFor(() => expect(reportNameFormatsApi.setActive).toHaveBeenCalledWith("f1", 2, false, "Retired"));
});
