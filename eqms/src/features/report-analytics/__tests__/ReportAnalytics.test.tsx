import "../../report/testing/browserStubs";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ReportDeliveryView, ReportRetentionView } from "../admin/ReportAdminScreens";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: () => true, hasPermission: () => true, hasPermissionAlias: () => true }),
}));

afterEach(cleanup);
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });

const renderView = (view: React.ReactNode) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>
          <Routes>
            <Route path="*" element={view} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

// These administration screens read the server; none of them is a design preview.
it.each([
  ["Report Run History", <ReportRetentionView />],
  ["Scheduled Reports", <ReportDeliveryView />],
])("the register under %s is a real screen, without the design preview notice", (title, view) => {
  renderView(view);
  expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  expect(screen.queryByText("Design preview")).toBeNull();
});
