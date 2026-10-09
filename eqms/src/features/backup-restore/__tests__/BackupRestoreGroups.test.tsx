import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { backupRestore } from "@/components/ui/breadcrumb/breadcrumbs/core";
import { BackupSchedulesView } from "../views/BackupSchedulesView";
import { BackupVerificationResultsView } from "../views/BackupVerificationResultsView";
import { RestoreApprovalQueueView } from "../views/RestoreApprovalQueueView";
import { RestoreHistoryView } from "../views/RestoreHistoryView";
import { RestoreVerificationReportsView } from "../views/RestoreVerificationReportsView";
import { RestoreRequestsView } from "../views/RestoreRequestsView";
import { BackupsView } from "../views/BackupsView";

vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  const empty = { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };
  return { ...actual, backupRestoreApi: { list: async () => empty, scheduleRows: async () => empty, schedules: async () => ({ version: 1, status: "ACTIVE", scope: "{}", retention: "{}", targets: "{}", schedule: "{}", nextDue: null, zone: "UTC", lastScheduledRun: null }) } };
});
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));
vi.mock("@/components/ui/table/useTableColumnPreferences", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/table/useTableColumnPreferences")>("@/components/ui/table/useTableColumnPreferences");
  return { ...actual, useTableColumnPreferences: (_key: string, defaults: unknown[]) => ({ columns: defaults, saveColumns: vi.fn(), resetColumns: vi.fn() }) };
});
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
afterEach(cleanup);

const renderView = (view: React.ReactNode) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter>{view}</MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

it.each([
  ["Backup Schedules", "Backup", <BackupSchedulesView />],
  ["Backup Verification Results", "Backup", <BackupVerificationResultsView />],
  ["Backup History", "Backup", <BackupsView />],
  ["Restore Approval Queue", "Restore", <RestoreApprovalQueueView />],
  ["Restore Verification Reports", "Restore", <RestoreVerificationReportsView />],
  ["Restore History & Evidence", "Restore", <RestoreHistoryView />],
  ["Restore Requests", "Restore", <RestoreRequestsView />],
])("%s renders under the %s group", (title, _group, view) => {
  renderView(view);
  expect(screen.getAllByText(title).length).toBeGreaterThan(0);
});

it("puts the menu group between the module and the page in the breadcrumb", () => {
  expect(backupRestore(vi.fn(), "Restore Approval Queue", undefined, "Restore").map((item) => item.label)).toEqual(["Dashboard", "Backup & Restore", "Restore", "Restore Approval Queue"]);
  expect(backupRestore(vi.fn()).map((item) => item.label)).toEqual(["Dashboard", "Backup & Restore", "Backup Status Overview"]);
});
