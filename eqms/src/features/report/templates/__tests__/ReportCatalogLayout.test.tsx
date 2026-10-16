import "../../testing/browserStubs";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ReportTemplateCatalog } from "../ReportTemplateCatalog";
import { ToastProvider } from "@/components/ui/toast/Toast";

const branding = vi.hoisted(() => ({ compactDesktopFilters: false }));
vi.mock("@/components/branding/BrandLogo", () => ({
  useBranding: () => branding,
}));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: () => true, hasPermission: () => true }),
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

function renderCatalog(admin = false) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ReportTemplateCatalog inAdministration={admin} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

it("uses the shared list toolbar: search, status filter, clear, and the shared table empty state", async () => {
  renderCatalog();
  await screen.findByText("No Report Templates Found");
  expect(screen.getAllByRole("textbox", { name: "Search" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
});

it("keeps the system compact-filter setting and the shared Filters drawer trigger", async () => {
  branding.compactDesktopFilters = true;
  renderCatalog(true);
  await screen.findByText("No Report Templates Found");
  expect(screen.getAllByRole("button", { name: /^Filters?$/ }).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Clear Filters" })).not.toBeInTheDocument();
});
