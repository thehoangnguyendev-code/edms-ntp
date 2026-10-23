import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ permissions: new Set<string>(), list: vi.fn() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => state.permissions.has(code) }) }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingMatrixApi: { list: state.list } }));
vi.mock("../TrainingMatrixListView", () => ({ TrainingMatrixListView: () => <div>All department matrices</div> }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import { TrainingMatrixLandingPage } from "../TrainingMatrixLandingPage";

const renderLanding = () => render(
  <MemoryRouter initialEntries={["/training-management/matrix"]}>
    <Routes>
      <Route path="/training-management/matrix" element={<TrainingMatrixLandingPage />} />
      <Route path="/training-management/matrix/:versionId" element={<div>Version page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { state.permissions = new Set(); state.list.mockReset(); });
afterEach(cleanup);

describe("TrainingMatrixLandingPage", () => {
  it("shows the list of every department to a person with training.scope.all, without asking the server for one matrix", () => {
    state.permissions = new Set(["training.scope.all"]);
    renderLanding();

    expect(screen.getByText("All department matrices")).toBeTruthy();
    expect(state.list).not.toHaveBeenCalled();
  });

  it("opens the effective version of the own department at once", async () => {
    state.list.mockResolvedValue({ data: [{ id: "m1", effectiveVersionId: "v-eff", openVersionId: "v-draft" }] });
    renderLanding();

    expect(await screen.findByText("Version page")).toBeTruthy();
  });

  it("opens the draft when the department has no effective version yet", async () => {
    state.list.mockResolvedValue({ data: [{ id: "m1", effectiveVersionId: null, openVersionId: "v-draft" }] });
    renderLanding();

    expect(await screen.findByText("Version page")).toBeTruthy();
  });

  it("shows the list, where a matrix is created, when the department has none", async () => {
    state.list.mockResolvedValue({ data: [] });
    renderLanding();

    await waitFor(() => expect(screen.getByText("All department matrices")).toBeTruthy());
  });

  it("shows the list when the matrix cannot be read", async () => {
    state.list.mockRejectedValue(new Error("denied"));
    renderLanding();

    await waitFor(() => expect(screen.getByText("All department matrices")).toBeTruthy());
  });
});
