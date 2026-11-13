import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => ({ compactDesktopFilters: false }) }));

// The disaster recovery plan reads the backup agent; this file checks the layout only.
vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return {
    ...actual,
    backupRestoreApi: {
      ...actual.backupRestoreApi,
      drScenarios: async () => [],
      drKit: async () => [],
      drAuthority: async () => ({ key: "DECLARATION_AUTHORITY", value: "admin" }),
      drReadiness: async () => [],
      drDeclarations: async () => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
    },
  };
});
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import { DisasterRecoveryPlanView } from "../DisasterRecoveryPlanView";

afterEach(cleanup);
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  perms.granted = new Set(["backup.admin.disaster_recovery.view", "backup.admin.disaster_recovery.manage"]);
});

const A = ROUTES.SETTINGS.BACKUP_ADMINISTRATION;

const renderAt = (path: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={A.DISASTER_RECOVERY} element={<DisasterRecoveryPlanView />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

it("the Disaster Recovery Plan is a live screen: it reads the server and carries no design-preview notice or Save Changes bar", async () => {
  renderAt(A.DISASTER_RECOVERY);
  expect((await screen.findAllByText("Recovery Targets")).length).toBeGreaterThan(0);
  expect(screen.queryByText("Design preview")).toBeNull();
  expect(screen.queryByText("Save Changes")).toBeNull();
});

it.each([
  ["plan", "Rebuild Kit"],
  ["declarations", "Declare a Disaster"],
])("opens the %s tab named in the address", async (tab, text) => {
  renderAt(`${A.DISASTER_RECOVERY}?tab=${tab}`);
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
});

it("offers no declaration to someone who may only view the plan", async () => {
  perms.granted = new Set(["backup.admin.disaster_recovery.view"]);
  renderAt(`${A.DISASTER_RECOVERY}?tab=declarations`);
  await screen.findByText("How a declaration works");
  expect(screen.queryByRole("button", { name: "Declare a Disaster" })).toBeNull();
});
