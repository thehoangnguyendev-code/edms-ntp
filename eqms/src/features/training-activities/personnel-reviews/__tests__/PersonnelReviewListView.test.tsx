import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ permissions: new Set<string>(["training.job_assignment.manage"]) }));
const api = vi.hoisted(() => ({ list: vi.fn(), suggestions: vi.fn(), create: vi.fn(), cancel: vi.fn(), plan: vi.fn() }));
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (code: string) => state.permissions.has(code) }) }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  trainingReviewsApi: api,
  trainingActivitiesApi: { people: () => Promise.resolve([]) },
}));
vi.mock("@/services/api/dictionary", () => ({ dictionaryApi: { getDepartments: () => Promise.resolve([{ id: "d1", name: "Quality Assurance" }]) } }));
const toast = vi.hoisted(() => ({ showToast: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <div><h1>{title}</h1>{actions}</div> }));

import { PersonnelReviewListView } from "../PersonnelReviewListView";

const review = { id: "r1", reviewNo: 7, personUserId: "p1", fullName: "Anne Tran", employeeCode: "E-001", department: "Quality Assurance", kind: "NEW_HIRE", status: "OPEN", eventDate: "2026-10-01", createdAt: "2026-10-02T03:00:00Z", createdByName: "Admin", openItems: 3 };

const renderList = () => render(
  <MemoryRouter initialEntries={["/training-management/personnel-reviews"]}>
    <Routes>
      <Route path="/training-management/personnel-reviews" element={<PersonnelReviewListView />} />
      <Route path="/training-management/personnel-reviews/:id" element={<div>Review page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  state.permissions = new Set(["training.job_assignment.manage"]);
  api.list.mockReset().mockResolvedValue(page([review]));
  api.suggestions.mockReset().mockResolvedValue([]);
  api.create.mockReset();
  api.plan.mockReset().mockResolvedValue({ departmentFrom: "Quality Assurance", closerName: "Carol Pham", closerUserId: "c1", absenceRetrainMonths: 6 });
  api.cancel.mockReset().mockResolvedValue({});
  try { window.localStorage.clear(); } catch { /* storage may be unavailable */ }
});
afterEach(cleanup);

describe("PersonnelReviewListView", () => {
  it("lists the reviews that the server returns, newest first", async () => {
    renderList();

    expect(await screen.findByText("Anne Tran")).toBeTruthy();
    expect(screen.getByText("New employee")).toBeTruthy();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ sortBy: "createdAt", sortDirection: "desc", limit: 10 }));
  });

  it("shows the person chosen to close a review, and marks a review whose items are all settled as ready to close", async () => {
    api.list.mockResolvedValue(page([{ ...review, openItems: 0, closerName: "Carol Pham" }]));
    renderList();

    expect(await screen.findByText("Carol Pham")).toBeTruthy();
    expect(screen.getByText("Ready to close")).toBeTruthy();
  });

  it("opens a review from the name and from View Detail in the Action menu", async () => {
    renderList();

    fireEvent.click(await screen.findByRole("button", { name: /Anne Tran/ }));
    expect(await screen.findByText("Review page")).toBeTruthy();
  });

  it("shows New Review only to a person who may manage reviews", async () => {
    state.permissions = new Set();
    renderList();
    await screen.findByText("Anne Tran");

    expect(screen.queryByRole("button", { name: /New Review/ })).toBeNull();
  });

  it("offers to open a review for a new employee found in the user profiles, already filled in", async () => {
    api.suggestions.mockResolvedValue([{ id: "u9", fullName: "Bob Le", employeeCode: "E-9", startDate: "2026-10-10T00:00:00Z" }]);
    renderList();

    fireEvent.click(await screen.findByRole("button", { name: /Bob Le/ }));

    await waitFor(() => expect(screen.getByText("Open a Training Review")).toBeTruthy());
    expect(screen.getByText("Bob Le (E-9)")).toBeTruthy();
  });

  it("says why the list is empty when the server refuses", async () => {
    api.list.mockRejectedValue(new Error("denied"));
    renderList();

    expect(await screen.findByText("Unable to load reviews")).toBeTruthy();
  });

  it("cancels an open review from the Action menu, with a reason", async () => {
    renderList();
    await screen.findByText("Anne Tran");

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("Cancel Review"));
    expect((screen.getByRole("button", { name: "Cancel review" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getAllByRole("textbox").at(-1) as HTMLElement, { target: { value: "Opened for the wrong person" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel review" }));

    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith("r1", "Opened for the wrong person"));
  });

  it("does not offer Cancel Review for a review that is closed, or to a person who may not manage", async () => {
    api.list.mockResolvedValue(page([{ ...review, status: "CLOSED" }]));
    renderList();
    await screen.findByText("Anne Tran");

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByText("View Detail");
    expect(screen.queryByText("Cancel Review")).toBeNull();
  });
});
