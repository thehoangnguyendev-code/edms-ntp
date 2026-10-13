import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => perms.granted.has(code) }) }));

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
      restoreRules: async () => [],
    },
  };
});
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import { BackupAlertsView } from "../BackupAlertsView";
import { DisasterRecoveryPlanView } from "../DisasterRecoveryPlanView";
import { BackupControlsView } from "../BackupControlsView";

afterEach(cleanup);

const A = ROUTES.SETTINGS.BACKUP_ADMINISTRATION;
const screens = [
  [A.ALERTS, <BackupAlertsView />, "Recipients"],
  [A.DISASTER_RECOVERY, <DisasterRecoveryPlanView />, "Recovery Targets"],
] as const;

const renderAt = (path: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>?
            <Route path={A.CONTROLS} element={<BackupControlsView />} />?
            {screens.map(([route, element]) => (
              <Route key={route} path={route} element={element} />
            ))}
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

it.each(screens.map(([route, , text]) => [route, text]))("%s is its own screen and says it is a design preview", (route, text) => {
  renderAt(route);
  expect(screen.getByText("Design preview")).toBeTruthy();
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
});

it("shows the restore rules as fixed facts, with no switch and no save bar", () => {
  perms.granted = new Set(["backup.admin.restore_controls.view"]);
  renderAt(`${A.CONTROLS}?tab=restore-rules`);
  expect(screen.queryAllByRole("switch")).toHaveLength(0);
  expect(screen.queryByText("Save Changes")).toBeNull();
});

describe("Backup Controls", () => {
  const ALL_CONTROLS = ["backup.admin.restore_controls.view", "backup.admin.verification.view", "backup.admin.retention.view"];

  beforeEach(() => {
    perms.granted = new Set(ALL_CONTROLS);
  });

  it.each([
    ["restore-rules", "Approval"],
    ["verification", "Post-Restore Checks"],
    ["retention", "Legal Hold"],
  ])("opens the %s tab named in the address", (tab, text) => {
    renderAt(`${A.CONTROLS}?tab=${tab}`);
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it("opens the first tab the person may view when the address names none", () => {
    renderAt(A.CONTROLS);
    expect(screen.getAllByText("Approval").length).toBeGreaterThan(0);
  });

  it("offers only the tabs the person may view", () => {
    perms.granted = new Set(["backup.admin.retention.view"]);
    renderAt(A.CONTROLS);
    expect(screen.getByText("Retention & Legal Hold")).toBeTruthy();
    expect(screen.queryByText("Verification & Drills")).toBeNull();
    expect(screen.queryByText("Restore Rules")).toBeNull();
    expect(screen.getAllByText("Permanently").length).toBeGreaterThan(0);
  });
});
