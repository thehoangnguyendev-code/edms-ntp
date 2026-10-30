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
  trainingMatrixApi: { positions: api.positions },
  trainingWorkPositionApi: { of: api.of },
  trainingJobsApi: { eligibility: api.eligibility, create: api.create },
}));
vi.mock("../RequiredTrainingsField", () => ({
  pickedIds: (list: { kind: string; id: string; title: string }[]) => ({ topics: list.filter((p) => p.kind === "TOPIC").map((p) => p.title), documentIds: list.filter((p) => p.kind === "DOCUMENT").map((p) => p.id) }),
  RequiredTrainingsField: ({ onChange }: { onChange: (v: unknown[]) => void }) => <button onClick={() => onChange([{ kind: "TOPIC", id: "Gowning", code: "", title: "Gowning" }])}>pick-topic</button>,
}));
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
  api.positions.mockResolvedValue([{ id: "r1", name: "QA Officer", departmentId: "d1", departmentName: "Quality Assurance" }]);
  api.of.mockResolvedValue({ roles: [] });
  api.eligibility.mockResolvedValue({ matrixMissing: false, missingCount: 0, items: [] });
  api.create.mockResolvedValue({ id: "job1", personName: "Trainee Test 1" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderPage = () => render(<ToastProvider><MemoryRouter><TrainingJobCreatePage /></MemoryRouter></ToastProvider>);

describe("TrainingJobCreatePage", () => {
  it("is a page with the three steps, and cannot go on before an employee and a Work Position are chosen", async () => {
    renderPage();

    expect(screen.getByText("Step 1 of 3: Employee and Work Positions")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(api.people).toHaveBeenCalled());
  });

  it("creates the draft from the last step with what was chosen and opens it", async () => {
    renderPage();
    const select = (label: string) => screen.getByText(label);
    expect(select("Employee")).toBeTruthy();
    // the chosen values come from the selects; set them through the page's own controls
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByText("Trainee Test 1 (E1)"));
    fireEvent.doubleClick(await screen.findByText("QA Officer (Quality Assurance)"));
    expect(screen.getByText("Selected Work Positions (1)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    fireEvent.click(await screen.findByText("pick-topic"));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByText("Step 3 of 3: Review and Create")).toBeTruthy();
    expect(await screen.findByText(/Training check: complete/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Create Draft/ }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ personUserId: "p1", positionIds: ["r1"], requiredTopics: ["Gowning"], requiredDocumentIds: [] })));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/training-management/job-assignments/job1", { replace: true }));
  });
});
