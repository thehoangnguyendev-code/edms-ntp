import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), matrixGaps: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingReviewsApi: api, trainingActivitiesApi: {}, trainingError: () => "" }));
const toast = vi.hoisted(() => ({ showToast: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: () => null }));
vi.mock("../../shared/TrainingPersonRelatedCard", () => ({ TrainingPersonRelatedCard: () => null }));
vi.mock("@/features/documents/shared/components/AuditTrailTab", () => ({ AuditTrailTab: () => null }));

import { PersonnelReviewDetailPage } from "../PersonnelReviewDetailPage";

const review = {
  id: "rv1", reviewNo: 1, personUserId: "p1", fullName: "User A", kind: "NEW_HIRE", status: "OPEN", capabilities: { editItems: true }, workflow: undefined,
  items: [{ itemCode: "SPECIMEN", label: "Specimen signature", hint: "Hint", status: "PENDING", canLink: false,
    systemCheck: { found: true, parts: [{ template: "Specimen signature record, version {version}, effective {date}.", values: { version: 7, date: "29/10/2026" } }] } }],
};

afterEach(cleanup);

describe("PersonnelReviewDetailPage checklist", () => {
  it("writes the system check from its sentences and keeps the actions of a row in a menu", async () => {
    api.get.mockResolvedValue(review);
    api.matrixGaps.mockResolvedValue({ required: 0, missing: 0, due: 0, done: 0, gaps: [] });
    render(<MemoryRouter initialEntries={["/r/rv1"]}><Routes><Route path="/r/:reviewId" element={<PersonnelReviewDetailPage />} /></Routes></MemoryRouter>);

    fireEvent.click(await screen.findByRole("tab", { name: /Checklist/ }));

    expect(await screen.findByText("Specimen signature record, version 7, effective 29/10/2026.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Update" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByText("Update")).toBeTruthy();
    expect(screen.queryByText("View scanned tests")).toBeNull();
  });
});
