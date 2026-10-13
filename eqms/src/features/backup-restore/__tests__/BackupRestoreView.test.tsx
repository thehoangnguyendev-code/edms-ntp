import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ROUTES } from "@/app/routes.constants";
import {
  BackupOverviewView,
  DrDrillsView,
  BackupsView,
  RestoreRequestsView,
  RestoreRequestView,
} from "..";

afterEach(cleanup);

const R = ROUTES.BACKUP_RESTORE;
const renderAt = (path: string) =>
  render(
    <ToastProvider>
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={R.OVERVIEW} element={<BackupOverviewView />} />
            <Route path={R.BACKUPS} element={<BackupsView />} />
            <Route path={R.RESTORES} element={<RestoreRequestsView />} />
            <Route path={R.RESTORE_NEW} element={<RestoreRequestView />} />
            <Route path={R.DR_DRILLS} element={<DrDrillsView />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>
    </ToastProvider>,
  );

// Overview, Backup History, Restore Requests and New Restore Request read the Backup Agent and are tested in their own files.
// Disaster recovery still shows sample data.
it("Disaster Recovery Drills is its own screen and says it is a design preview", () => {
  renderAt(R.DR_DRILLS);
  expect(screen.getByText("Design preview")).toBeTruthy();
  expect(screen.getAllByText("DR-20260612-001").length).toBeGreaterThan(0);
});
