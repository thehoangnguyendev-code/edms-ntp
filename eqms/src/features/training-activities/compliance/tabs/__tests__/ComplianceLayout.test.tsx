import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComplianceCompletionTab } from "../ComplianceCompletionTab";
import { ComplianceGapsTab } from "../ComplianceGapsTab";

const api = vi.hoisted(() => ({ positions: vi.fn(), matrixCompletion: vi.fn(), coverage: vi.fn(), gapTrainings: vi.fn() }));
const access = vi.hoisted(() => ({ organize: false }));
vi.mock("@/services/api/trainingActivities", async (original) => ({ ...(await original<object>()), trainingComplianceApi: api }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => access.organize }) }));

const department = { id: "department", label: "Department", value: "qa", options: [{ label: "Quality Assurance", value: "qa" }], onChange: vi.fn() };
const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  access.organize = false;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  api.positions.mockResolvedValue([{ id: "dco", name: "DCO Staff", code: "DCO", peopleCount: 3, rowCount: 1 }]);
  api.matrixCompletion.mockResolvedValue({ hasEffectiveMatrix: true, data: [], columns: [], pagination: { ...pagination, total: 0 }, columnPagination: pagination });
  api.gapTrainings.mockResolvedValue({ matrixVersionNo: 1, data: [{ id: "gmp", title: "GMP basics", people: 3, missing: 3, updateNeeded: 0, due: 0 }] });
  api.coverage.mockResolvedValue({ data: [{ pid: "p1", fullName: "Trainee One", employeeCode: "TEST-01", positionName: "DCO Staff", title: "GMP basics", status: "MISSING", annualRequired: true }], pagination });
});
afterEach(cleanup);

describe("M1 / G1 preserve filter and authorization behavior", () => {
  it("keeps row mode's server parameters and only offers person filters in person mode", async () => {
    render(<MemoryRouter><ComplianceCompletionTab departmentId="qa" departmentFilter={department} /></MemoryRouter>);
    await waitFor(() => expect(api.matrixCompletion).toHaveBeenCalledWith(expect.objectContaining({ departmentId: "qa", positionId: "dco", columnLimit: 200, page: 1 })));
    expect(screen.queryByRole("combobox", { name: "State" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /By person/i }));
    expect(screen.getByRole("combobox", { name: "State" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Gap analysis" })).toBeTruthy();
    await waitFor(() => expect(api.matrixCompletion).toHaveBeenLastCalledWith(expect.objectContaining({ columnLimit: 12, page: 1 })));
  });

  it("clears the search while retaining the selected department and position", async () => {
    render(<MemoryRouter><ComplianceCompletionTab departmentId="qa" departmentFilter={department} /></MemoryRouter>);
    await waitFor(() => expect(api.matrixCompletion).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "Trainee" } });
    await waitFor(() => expect(api.matrixCompletion).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Trainee", positionId: "dco" })));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(api.matrixCompletion).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, departmentId: "qa", positionId: "dco" })));
    expect(department.onChange).not.toHaveBeenCalled();
  });

  it("keeps training chips as server filters and does not offer selection without organize permission", async () => {
    render(<MemoryRouter><ComplianceGapsTab departmentId="qa" departmentFilter={department} /></MemoryRouter>);
    await screen.findByText("Trainee One");
    fireEvent.click(screen.getByRole("button", { name: /GMP basics\s*3/ }));
    await waitFor(() => expect(api.coverage).toHaveBeenLastCalledWith(expect.objectContaining({ departmentId: "qa", rowId: "gmp", page: 1 })));
    expect(screen.queryByRole("checkbox", { name: /Select the lines/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to a Training" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Employees" })).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Not trained" }));
    await waitFor(() => expect(api.coverage).toHaveBeenLastCalledWith(expect.objectContaining({ status: "MISSING", rowId: "gmp" })));
    fireEvent.click(screen.getByRole("combobox", { name: "Employees" }));
    fireEvent.click(screen.getByRole("option", { name: "New employees only" }));
    await waitFor(() => expect(api.coverage).toHaveBeenLastCalledWith(expect.objectContaining({ newOnly: true, rowId: "gmp" })));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(api.coverage).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined, newOnly: undefined, rowId: "gmp", departmentId: "qa" })));
  });

  it("keeps permitted record selection and the add-to-training action", async () => {
    access.organize = true;
    render(<MemoryRouter><ComplianceGapsTab departmentId="qa" departmentFilter={department} /></MemoryRouter>);
    await screen.findByText("Trainee One");
    fireEvent.click(screen.getByRole("checkbox", { name: /Select Trainee One/ }));
    expect(screen.getByRole("button", { name: "Add to a Training" })).not.toBeDisabled();
  });
});
