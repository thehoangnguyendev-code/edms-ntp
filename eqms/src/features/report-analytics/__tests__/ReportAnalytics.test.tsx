import "../../report/testing/browserStubs";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ReportAnalyticsView } from "../ReportAnalyticsView";
import { ReportRunDetailView } from "../ReportRunDetailView";
import { ReportOverviewView } from "../ReportOverviewView";
import { ReportAccessScopeView, ReportDeliveryView, ReportRetentionView } from "../admin/ReportAdminScreens";

import { vi } from "vitest";

afterEach(cleanup);
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });

const renderView = (view: React.ReactNode) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>{view}</MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

it.each([
  ["Reports Overview", <ReportOverviewView />],
  ["Quality Analytics", <ReportAnalyticsView />],
  ["RUN-000415", <ReportRunDetailView />],
])("%s renders under the design preview notice", (title, view) => {
  renderView(view);
  expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  expect(screen.getByText("Design preview")).toBeTruthy();
});

// These administration screens read the server; none of them is a design preview.
it.each([
  ["Report Access & Data Scope", <ReportAccessScopeView />],
  ["Report Retention & Legal Hold", <ReportRetentionView />],
  ["Scheduled Report Delivery", <ReportDeliveryView />],
])("%s is a real screen, without the design preview notice", (title, view) => {
  renderView(view);
  expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  expect(screen.queryByText("Design preview")).toBeNull();
});
