import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reviews = vi.hoisted(() => ({ requirements: vi.fn(), classes: vi.fn(), addToClass: vi.fn(), createClass: vi.fn() }));
const matrix = vi.hoisted(() => ({ positionsPage: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({ ...(await importOriginal<object>()), trainingReviewsApi: reviews, trainingMatrixApi: matrix }));

import { ClassDialog, JobRolesDialog, RetrainingDialog } from "../ReviewDialogs";
import type { TrainingPersonnelReview } from "@/services/api/trainingActivities";

const review = { id: "r1", department: "Quality Assurance", matrixDepartmentId: "d-qa", kind: "ABSENCE_RETURN", jobRoleIds: ["j1"], items: [{ itemCode: "T1", checkType: "TRAINING", status: "PENDING", documentNumber: "SOP.0001", label: "x" }] } as unknown as TrainingPersonnelReview;

beforeEach(() => {
  matrix.positionsPage.mockReset().mockResolvedValue({
    data: [{ id: "j1", code: "QA1", name: "QA Manager", departmentName: "Quality Assurance" }],
    departments: [], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  reviews.requirements.mockReset().mockResolvedValue([
    { key: "SOP.0001", title: "Gowning", documentNumber: "SOP.0001", annualRequired: false, rowGroup: "SOP" },
    { key: "tgmp", title: "GMP basics", topicText: "GMP basics", annualRequired: true, rowGroup: "FACTORY_GENERAL" },
  ]);
  reviews.classes.mockReset().mockResolvedValue({ open: [{ activityId: "a1", trainingNumber: "TRN/QA/26-001", trainingTopics: "GMP basics", createdAt: "2026-11-01", covers: 1, listed: false }], earlier: [], canCreate: true });
  reviews.addToClass.mockReset().mockResolvedValue({ ...review });
  reviews.createClass.mockReset().mockResolvedValue({ ...review, createdActivityId: "a2" });
});
afterEach(cleanup);

describe("review dialogs", () => {
  it("asks the server for the Job Roles of the department of the person only, with a search, and saves the ones ticked", async () => {
    const save = vi.fn();
    render(<JobRolesDialog review={review} busy={false} onClose={() => undefined} onSave={save} />);
    expect(await screen.findByText("QA Manager")).toBeTruthy();
    expect(matrix.positionsPage).toHaveBeenCalledWith(expect.objectContaining({ departmentId: "d-qa" }));
    expect(screen.getByLabelText("Search")).toBeTruthy();
    expect(screen.queryByText("All departments")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith(["j1"]);
  });

  it("offers the trainings of the matrix to repeat after an absence, the lines already chosen ticked", async () => {
    const save = vi.fn();
    render(<RetrainingDialog review={review} busy={false} onClose={() => undefined} onSave={save} />);
    const gowning = await screen.findByLabelText("SOP.0001 — Gowning");
    expect((gowning as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("GMP basics"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith(["SOP.0001", "tgmp"]);
  });

  it("adds the person to an open class, or creates one only for a person who gives Training Numbers", async () => {
    const changed = vi.fn();
    render(<ClassDialog review={review} busy={false} onClose={() => undefined} onChanged={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add to this class" }));
    await waitFor(() => expect(reviews.addToClass).toHaveBeenCalledWith("r1", "a1"));
    expect(changed).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create a class from the matrix" }));
    await waitFor(() => expect(reviews.createClass).toHaveBeenCalledWith("r1"));
    cleanup();
    reviews.classes.mockResolvedValue({ open: [], earlier: [], canCreate: false });
    render(<ClassDialog review={review} busy={false} onClose={() => undefined} onChanged={changed} />);
    expect(await screen.findByText(/Only a person who gives Training Numbers/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create a class from the matrix" })).toBeNull();
  });

  it("shows the refusal of the server instead of closing", async () => {
    reviews.addToClass.mockRejectedValue(new Error("x"));
    render(<ClassDialog review={review} busy={false} onClose={() => undefined} onChanged={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add to this class" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});
