import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { ReportTemplateAccessScope } from "../templates/ReportTemplateAccessScope";
import { reportTemplatesApi } from "@/services/api/reportTemplates";

vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/services/api/reportTemplates", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  reportTemplatesApi: { searchRoles: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(reportTemplatesApi.searchRoles).mockResolvedValue({
    data: [
      { id: "r1", name: "QA Manager", code: "QA_MANAGER", scope: "SYSTEM" },
      { id: "r2", name: "Author", code: "AUTHOR", scope: null },
    ],
    pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    inactive: [{ id: "r9", name: "Old profile", scope: "DEPARTMENT" }],
  } as never);
});
afterEach(cleanup);

const grants = [
  { roleId: "r1", scope: "SYSTEM" as const },
  { roleId: "r9", scope: "DEPARTMENT" as const },
];

it("lists the Access Profiles in the standard table, searched, filtered and paged by the server, and sends the scopes set so far", async () => {
  render(
    <ToastProvider>
      <ReportTemplateAccessScope assignments={grants} editable onChange={() => undefined} />
    </ToastProvider>,
  );
  expect(await screen.findByText("QA Manager")).toBeInTheDocument();
  const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
  expect(headers).toEqual(expect.arrayContaining(["No.", "Access Profile", "Code", "Data scope", "Access"]));
  expect(screen.getByText("Can use this template")).toBeInTheDocument();
  expect(screen.getByText("Show:")).toBeInTheDocument();
  await waitFor(() =>
    expect(reportTemplatesApi.searchRoles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assignment: "ALL",
        sortBy: "name",
        sortDirection: "asc",
        page: 1,
        limit: 10,
        assignments: [
          { roleId: "r1", scope: "SYSTEM" },
          { roleId: "r9", scope: "DEPARTMENT" },
        ],
      }),
    ),
  );
});

it("offers to remove a scope that was given to a profile that is not active any more", async () => {
  const onChange = vi.fn();
  render(
    <ToastProvider>
      <ReportTemplateAccessScope assignments={grants} editable onChange={onChange} />
    </ToastProvider>,
  );
  expect(await screen.findByText(/not active any more/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(onChange).toHaveBeenCalledWith([{ roleId: "r1", scope: "SYSTEM" }]);
});

it("cannot be changed when the template is read-only", async () => {
  render(
    <ToastProvider>
      <ReportTemplateAccessScope assignments={grants} editable={false} onChange={() => undefined} />
    </ToastProvider>,
  );
  await screen.findByText("QA Manager");
  expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  expect(screen.getByText("Entire system")).toBeInTheDocument();
});
