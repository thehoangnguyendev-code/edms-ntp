import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportNameFormatEditView } from "../name-formats/ReportNameFormatEditView";
import { reportNameFormatsApi } from "@/services/api/reportNameFormats";

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
  reportNameFormatsApi: { detail: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(reportNameFormatsApi.detail).mockResolvedValue({
    id: "f1", code: "EQMS_TOPIC", name: "EQMS topic", separator: " - ", description: "DEV test rule", active: true, version: 2,
    parts: [
      { order: 1, type: "FIXED", fixedText: "EQMS", inputLabel: null, inputRule: null, maxLength: null },
      { order: 2, type: "INPUT", fixedText: null, inputLabel: "Report topic", inputRule: "TEXT", maxLength: 100 },
    ],
  } as never);
});
afterEach(cleanup);

it("lists the parts as compact numbered rows like the components of a document name format, and adds a part in a dialog", async () => {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/settings/report-name-formats/f1"]}>
        <Routes>
          <Route path="/settings/report-name-formats/:id" element={<ReportNameFormatEditView />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  expect(await screen.findByRole("heading", { name: "Edit Report Name Format" })).toBeInTheDocument();
  // Compact rows: the name of the part with its chip, no form fields inside the row.
  expect(await screen.findByText("Fixed text")).toBeInTheDocument();
  expect(screen.getByText("Report topic")).toBeInTheDocument();
  expect(screen.getByText("{{typed}}")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Move up" })).toHaveLength(2);
  expect(screen.getByText("EQMS - <Report topic>")).toBeInTheDocument(); // the preview

  // New Part opens a dialog; the part is added only when it is complete.
  fireEvent.click(screen.getByRole("button", { name: /New Part/ }));
  const dialog = await screen.findByRole("dialog");
  const add = within(dialog).getByRole("button", { name: "Add Part" });
  expect(add).toBeDisabled();
  fireEvent.change(within(dialog).getByPlaceholderText("e.g. Report title"), { target: { value: "Year" } });
  expect(add).toBeEnabled();
  fireEvent.click(add);
  expect(await screen.findByText("Year")).toBeInTheDocument();
  expect(screen.getByText("EQMS - <Report topic> - <Year>")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Move up" })).toHaveLength(3);
});
