import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import { BackupAlertsView } from "../BackupAlertsView";
import { DisasterRecoveryPlanView } from "../DisasterRecoveryPlanView";
import { BackupVerificationView } from "../BackupVerificationView";
import { RestoreControlsView } from "../RestoreControlsView";

afterEach(cleanup);

const A = ROUTES.SETTINGS.BACKUP_ADMINISTRATION;
const screens = [
  [A.VERIFICATION, <BackupVerificationView />, "Post-Restore Checks"],
  [A.RESTORE_CONTROLS, <RestoreControlsView />, "Approval"],
  [A.ALERTS, <BackupAlertsView />, "Recipients"],
  [A.DISASTER_RECOVERY, <DisasterRecoveryPlanView />, "Recovery Targets"],
] as const;

const renderAt = (path: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
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

it("keeps Save Changes disabled until something changes, then asks for a reason", () => {
  renderAt(A.RESTORE_CONTROLS);
  const save = () => screen.getByText("Save Changes").closest("button") as HTMLButtonElement;
  expect(save().disabled).toBe(true);
  fireEvent.click(screen.getAllByRole("switch")[0]);
  expect(save().disabled).toBe(false);
  fireEvent.click(save());
  expect(screen.getByText("Reason for change")).toBeTruthy();
});
