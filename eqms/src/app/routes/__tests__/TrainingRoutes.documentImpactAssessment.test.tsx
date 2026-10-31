import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/middleware/ProtectedRoute", () => ({ ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/features/training-activities/matrices/DocumentImpactAssessmentView", () => ({ DocumentImpactAssessmentView: () => <h1>Document Impact Assessment screen</h1> }));

import { trainingRoutes } from "../TrainingRoutes";

afterEach(cleanup);

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

const open = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes>{trainingRoutes()}</Routes><Where /></MemoryRouter>);

it("opens the screen on its new address", async () => {
  open("/training-management/document-impact-assessment");

  expect(await screen.findByText("Document Impact Assessment screen")).toBeTruthy();
});

it("sends the earlier address (Document Trainings) to the new one, so a notification already sent or a bookmark still works", async () => {
  open("/training-management/document-trainings");

  expect(await screen.findByText("Document Impact Assessment screen")).toBeTruthy();
  expect(screen.getByTestId("where").textContent).toBe("/training-management/document-impact-assessment");
});
