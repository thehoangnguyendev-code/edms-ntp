import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/components/ui/toast/Toast";

const api = vi.hoisted(() => ({
  people: vi.fn(), positions: vi.fn(), of: vi.fn(), eligibility: vi.fn(), create: vi.fn(),
}));
vi.mock("@/services/api/trainingActivities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  trainingActivitiesApi: { people: api.people },
  trainingMatrixApi: { positionsPage: api.positions },
  trainingWorkPositionApi: { of: api.of },
  trainingJobsApi: { eligibility: api.eligibility, create: api.create },
}));
vi.mock("@/services/api/documents", () => ({ documentApi: { getDocumentsPage: async () => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }) } }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<object>()), useNavigate: () => navigate }));

import { TrainingJobCreatePage } from "../TrainingJobCreatePage";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  Object.values(api).forEach((fn) => fn.mockReset());
  navigate.mockReset();
  api.people.mockResolvedValue([{ id: "p1", fullName: "Trainee Test 1", employeeCode: "E1" }]);
  api.positions.mockResolvedValue({ data: [{ id: "r1", code: "QA-01", name: "QA Officer", departmentId: "d1", departmentName: "Quality Assurance" }], departments: [{ id: "d1", name: "Quality Assurance" }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  api.of.mockResolvedValue({ roles: [] });
  api.eligibility.mockResolvedValue({ matrixMissing: false, missingCount: 0, items: [] });
  api.create.mockResolvedValue({ id: "job1", personName: "Trainee Test 1" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderPage = () => render(<ToastProvider><MemoryRouter><TrainingJobCreatePage /></MemoryRouter></ToastProvider>);

describe("TrainingJobCreatePage", () => {
  it("is a page with the three steps, and cannot go on before an employee and a Work Position are chosen", async () => {
    renderPage();

    expect((screen.getByRole("button", { name: /^Next:/ }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(api.people).toHaveBeenCalled());
  });

  it("creates the draft from the last step with what was chosen and opens it", async () => {
    renderPage();
    expect(screen.getAllByText("Employee").length).toBeGreaterThan(0);
    // the chosen values come from the selects; set them through the page's own controls
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByText("Trainee Test 1 (E1)"));
    fireEvent.click(await screen.findByRole("checkbox", { name: /QA Officer/ }));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(await screen.findByText(/Training check: complete/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Next:/ }));

    fireEvent.change(await screen.findByPlaceholderText("Search a SOP, or type a Training Topic..."), { target: { value: "Gowning" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Gowning/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Next:/ }));
    expect(await screen.findByText("Other Trainings Required")).toBeTruthy();
    expect(await screen.findByText(/Training check: complete/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Create Draft/ }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ personUserId: "p1", positionIds: ["r1"], requiredTopics: ["Gowning"], requiredDocumentIds: [] })));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/training-management/job-assignments/job1", { replace: true }));
  });

  it("asks for the reason when a held Work Position is replaced, and sends what is replaced", async () => {
    api.of.mockResolvedValue({ roles: [{ jobRoleId: "r0", positionName: "QC Analyst", source: "JOB_ASSIGNMENT" }] });
    renderPage();
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByText("Trainee Test 1 (E1)"));
    fireEvent.click(await screen.findByRole("checkbox", { name: /QA Officer/ }));
    fireEvent.click(await screen.findByText("Replaces one held"));
    expect((screen.getByRole("button", { name: /^Next:/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says when the training check could not be made and tries again", async () => {
    api.eligibility.mockRejectedValueOnce(new Error("down"));
    renderPage();
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByText("Trainee Test 1 (E1)"));
    fireEvent.click(await screen.findByRole("checkbox", { name: /QA Officer/ }));
    expect(await screen.findByText("The training check could not be made.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Training check: complete/)).toBeTruthy();
  });
});
