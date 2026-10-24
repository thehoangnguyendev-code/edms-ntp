import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ permissions: new Set<string>() }));
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });
const api = vi.hoisted(() => ({ records: vi.fn(), jobs: vi.fn(), reviews: vi.fn(), specimens: vi.fn() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (c: string) => state.permissions.has(c) }) }));
vi.mock("@/services/api/trainingActivities", () => ({
  trainingRecordsApi: { list: api.records }, trainingJobsApi: { list: api.jobs }, trainingReviewsApi: { list: api.reviews }, trainingSpecimenApi: { list: api.specimens },
}));
const toast = vi.hoisted(() => ({ showToast: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));

import { TrainingPersonRelatedCard } from "../TrainingPersonRelatedCard";

const renderCard = () => render(<MemoryRouter><TrainingPersonRelatedCard personId="person-1" /></MemoryRouter>);

beforeEach(() => {
  state.permissions = new Set();
  api.records.mockReset().mockResolvedValue(page([{ id: "r1", trainingNumber: "TR-1", activityId: "a1", topicText: "GMP", method: "CLASSROOM", result: "PASSED", completedOn: "2026-10-01" }]));
  api.jobs.mockReset().mockResolvedValue(page([{ id: "j1", issueNo: 2, caseType: "CHANGE", status: "EFFECTIVE", positionName: "Analyst", createdAt: "2026-10-01" }]));
  api.reviews.mockReset().mockResolvedValue(page([]));
  api.specimens.mockReset().mockResolvedValue(page([]));
});
afterEach(cleanup);

describe("TrainingPersonRelatedCard", () => {
  it("shows nothing to a person who may open none of the screens", () => {
    const { container } = renderCard();

    expect(container.textContent).toBe("");
    expect(api.records).not.toHaveBeenCalled();
  });

  it("shows only the tabs the person may open, and asks the server for the entries of this person only", async () => {
    state.permissions = new Set(["training.record.view", "training.job_assignment.view"]);
    renderCard();

    expect(await screen.findByText("TR-1")).toBeTruthy();
    expect(api.records).toHaveBeenCalledWith(expect.objectContaining({ personId: "person-1", limit: 10 }));
    expect(screen.getByRole("tab", { name: /Job Assignments/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Training Reviews/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Specimen Signatures/ })).toBeNull();
  });

  it("opens the job assignments of the person in another tab", async () => {
    state.permissions = new Set(["training.job_assignment.view"]);
    renderCard();

    expect(await screen.findByText("Issue 2")).toBeTruthy();
    expect(api.jobs).toHaveBeenCalledWith(expect.objectContaining({ personId: "person-1" }));
    fireEvent.click(screen.getByRole("tab", { name: /Training Reviews/ }));
    await waitFor(() => expect(api.reviews).toHaveBeenCalledWith(expect.objectContaining({ personId: "person-1" })));
  });
});
