import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

// Overview and Backup History read the Backup Agent and are tested in their own files. These screens still show sample data.
it.each([
  [R.RESTORES, "RS-20261008-001"],
  [R.DR_DRILLS, "DR-20260612-001"],
])("%s is its own screen and says it is a design preview", (path, text) => {
  renderAt(path);
  expect(screen.getByText("Design preview")).toBeTruthy();
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
});

it("blocks a production restore without a change control reference", () => {
  renderAt(`${R.RESTORE_NEW}?backup=BK-20261007-0200`);
  fireEvent.click(screen.getByText("Next"));
  fireEvent.click(screen.getByText("Production"));
  fireEvent.change(screen.getByPlaceholderText("Why is this restore needed?"), { target: { value: "Recover corrupted register" } });
  fireEvent.click(screen.getByText("Next"));
  expect(screen.getByText("Blocks restore")).toBeTruthy();
  expect((screen.getByText("Next").closest("button") as HTMLButtonElement).disabled).toBe(true);
});

it("requires a disaster declaration reference before a disaster recovery can be submitted", () => {
  renderAt(`${R.RESTORE_NEW}?backup=BK-20261007-0200`);
  fireEvent.click(screen.getByText("Next"));
  fireEvent.click(screen.getByText("Disaster recovery"));
  fireEvent.change(screen.getByPlaceholderText("Why is this restore needed?"), { target: { value: "Server room lost" } });
  fireEvent.click(screen.getByText("Next"));
  expect(screen.getByText("Disaster declaration")).toBeTruthy();
  expect(screen.getByText("Blocks restore")).toBeTruthy();
  expect((screen.getByText("Next").closest("button") as HTMLButtonElement).disabled).toBe(true);
});
