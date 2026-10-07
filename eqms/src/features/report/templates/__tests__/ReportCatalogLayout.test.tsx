import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ReportTemplateCatalog } from "../ReportTemplateCatalog";

const branding = vi.hoisted(() => ({ compactDesktopFilters: false }));
vi.mock("@/components/branding/BrandLogo", () => ({
  useBranding: () => branding,
}));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: () => true }),
}));
vi.mock("../ReportTemplateRun", () => ({ ReportTemplateRun: () => null }));
vi.mock("@/services/api/reportTemplates", () => ({
  reportError: () => "Request failed",
  reportTemplatesApi: {
    list: vi
      .fn()
      .mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      }),
  },
}));

afterEach(() => {
  cleanup();
  branding.compactDesktopFilters = false;
});

it("uses the shared table shell/empty state and caps classic filters at three columns", async () => {
  render(
    <MemoryRouter>
      <ReportTemplateCatalog />
    </MemoryRouter>,
  );
  await screen.findByText("No Report Templates Found");
  const grid = screen
    .getByRole("combobox", { name: "Status" })
    .closest(".grid");
  expect(grid).toHaveClass("md:grid-cols-2", "lg:grid-cols-3");
  expect(grid).not.toHaveClass("xl:grid-cols-5");
  expect(grid?.children).toHaveLength(6); // Search, four filters, then Clear Filters.
  expect(grid).toContainElement(
    screen.getByRole("button", { name: "Clear Filters" }),
  );
  expect(screen.getByRole("columnheader", { name: "Action" })).toHaveClass(
    "sticky",
    "right-0",
    "before:bg-slate-200",
  );
  expect(screen.getByRole("table").parentElement).toHaveClass(
    "overflow-x-auto",
  );
});

it("retains the system compact-filter setting and shared advanced filter trigger", async () => {
  branding.compactDesktopFilters = true;
  render(
    <MemoryRouter>
      <ReportTemplateCatalog admin />
    </MemoryRouter>,
  );
  await screen.findByText("No Report Templates Found");
  expect(
      screen.getByRole("button", { name: /^Filter$/ }),
  ).toHaveAttribute("aria-haspopup", "dialog");
  expect(
    screen.queryByRole("combobox", { name: "Status" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Clear Filters" }),
  ).not.toBeInTheDocument();
});
