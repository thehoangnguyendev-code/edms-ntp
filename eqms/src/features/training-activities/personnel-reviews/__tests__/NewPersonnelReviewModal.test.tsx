import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ plan: vi.fn(), create: vi.fn() }));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  trainingReviewsApi: api,
  trainingActivitiesApi: { people: () => Promise.resolve([]) },
}));
vi.mock("../../shared/useListFilters", () => ({ useDepartmentNameOptions: () => [{ label: "Quality Assurance", value: "Quality Assurance" }, { label: "Quality Control", value: "Quality Control" }] }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { NewPersonnelReviewModal, emptyReviewForm } from "../NewPersonnelReviewModal";

const plan = { departmentFrom: "Quality Assurance", closerName: "Carol Pham", closerUserId: "c1", absenceRetrainMonths: 6, problem: null };
const iso = (offsetDays: number) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const people = [{ label: "Anne Tran (E-001)", value: "p1" }];
const open = (form = emptyReviewForm) => render(<MemoryRouter><NewPersonnelReviewModal isOpen onClose={() => undefined} initialForm={form} initialPeople={people} /></MemoryRouter>);
const openButton = () => screen.getByRole("button", { name: "Open review" }) as HTMLButtonElement;

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  api.plan.mockReset().mockResolvedValue(plan);
  api.create.mockReset();
});
afterEach(cleanup);

describe("NewPersonnelReviewModal", () => {
  it("asks for the employee first: the event waits for it", () => {
    open();

    expect(screen.getByText("Choose the employee first")).toBeTruthy();
    expect(openButton().disabled).toBe(true);
  });

  it("shows the head of the department as the person who closes the review, and cannot be typed", async () => {
    open({ ...emptyReviewForm, personId: "p1", kind: "NEW_HIRE", eventDate: iso(-1) });

    const closer = await screen.findByDisplayValue("Carol Pham") as HTMLInputElement;
    expect(closer.readOnly).toBe(true);
    await waitFor(() => expect(openButton().disabled).toBe(false));
  });

  it("says at once that the date of the event is in the future", async () => {
    open({ ...emptyReviewForm, personId: "p1", kind: "NEW_HIRE", eventDate: iso(3) });

    expect(await screen.findByText("The date cannot be later than today: the event has already happened.")).toBeTruthy();
    expect(openButton().disabled).toBe(true);
  });

  it("asks a return to follow an absence of more than the months of the SOP", async () => {
    open({ ...emptyReviewForm, personId: "p1", kind: "ABSENCE_RETURN", absenceFrom: iso(-100), absenceTo: iso(-10), eventDate: iso(-5) });

    expect(await screen.findByText("SOP.0003 asks for a review after an absence of more than 6 months.")).toBeTruthy();
    expect(openButton().disabled).toBe(true);
  });

  it("fills the previous department of a transfer from the records and keeps it read-only", async () => {
    open({ ...emptyReviewForm, personId: "p1", kind: "DEPT_TRANSFER" });

    const previous = await screen.findByDisplayValue("Quality Assurance") as HTMLInputElement;
    expect(previous.readOnly).toBe(true);
    expect(screen.getByText("Choose the new department")).toBeTruthy();
  });

  it("reports why the head cannot close the review", async () => {
    api.plan.mockResolvedValue({ ...plan, closerName: null, closerUserId: null, problem: "TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING" });
    open({ ...emptyReviewForm, personId: "p1", kind: "NEW_HIRE", eventDate: iso(-1) });

    expect(await screen.findByText(/The department has no head/)).toBeTruthy();
    fireEvent.click(openButton());
    expect(api.create).not.toHaveBeenCalled();
  });
});
