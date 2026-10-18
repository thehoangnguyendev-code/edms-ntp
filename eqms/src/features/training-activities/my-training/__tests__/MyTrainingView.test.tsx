import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ tasks: vi.fn(), approvals: vi.fn(), records: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/services/api/myTraining", () => ({ myTrainingApi: api }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: any) => <h1>{title}</h1> }));
vi.mock("@/hooks/useTableDragScroll", () => ({ useTableDragScroll: () => ({}) }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({ ESignatureModal: () => null }));
vi.mock("@/components/ui/table/DataTable", () => ({
  useCustomColumnLayout: () => ({ layout: {}, control: null }),
  DataTable: ({ columns, pagination }: any) => <div>{columns.map((column: any) => column.sort && <button key={column.id} onClick={column.sort.onSort}>{column.header}</button>)}{pagination}</div>,
}));
vi.mock("@/components/ui/table/TablePagination", () => ({
  TablePagination: ({ currentPage, onPageChange }: any) => <button onClick={() => onPageChange(currentPage + 1)}>Next page</button>,
}));
vi.mock("@/features/report/shared/ReportListToolbar", () => ({
  pickerDateToIso: (value: string) => value,
  ReportListToolbar: ({ search, onSearch, filters, onClear, children }: any) => <div>
    <input aria-label="Search" value={search} onChange={(event) => onSearch(event.target.value)} />
    {filters.map((filter: any) => <select key={filter.id} aria-label={filter.label} value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>{filter.options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>)}
    <button onClick={onClear}>Clear Filters</button>{children}
  </div>,
}));

import { MyTrainingView } from "../MyTrainingView";

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of Object.values(api)) method.mockImplementation(async (params: any) => ({ data: [], pagination: { page: params.page, limit: params.limit, total: 25, totalPages: 3 } }));
});

describe("My Training server tables", () => {
  it("sends task search, filters, sort and pagination to the server and clears them", async () => {
    render(<MemoryRouter><MyTrainingView /></MemoryRouter>);
    await waitFor(() => expect(api.tasks).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, sortBy: "dueDate" })));
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "CLASSROOM" } });
    await waitFor(() => expect(api.tasks).toHaveBeenLastCalledWith(expect.objectContaining({ method: "CLASSROOM", page: 1 })));
    fireEvent.click(screen.getByRole("button", { name: "Training Number" }));
    await waitFor(() => expect(api.tasks).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "trainingNumber" })));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(api.tasks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "GMP" } });
    await waitFor(() => expect(api.tasks).toHaveBeenLastCalledWith(expect.objectContaining({ search: "GMP", page: 1 })));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(api.tasks).toHaveBeenLastCalledWith(expect.objectContaining({ method: undefined, search: undefined, page: 1 })));
  });

  it("queries the complete signature table on the server without carrying another tab's sort", async () => {
    render(<MemoryRouter initialEntries={["/?sortBy=dueDate&page=2"]}><MyTrainingView /></MemoryRouter>);
    await waitFor(() => expect(api.tasks).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("tab", { name: /Waiting for my signature/ }));
    await waitFor(() => expect(api.approvals).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sortBy: "assignedAt" })));
    fireEvent.change(screen.getByLabelText("Step"), { target: { value: "RECEIVER_ACCEPT" } });
    await waitFor(() => expect(api.approvals).toHaveBeenLastCalledWith(expect.objectContaining({ stepCode: "RECEIVER_ACCEPT" })));
    expect(screen.getByRole("tabpanel", { name: /Waiting for my signature/ })).toBeInTheDocument();
  });

  it("passes personal record filters and sortable columns to the personal server endpoint", async () => {
    render(<MemoryRouter initialEntries={["/?tab=records"]}><MyTrainingView /></MemoryRouter>);
    await waitFor(() => expect(api.records).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "READ" } });
    fireEvent.change(screen.getByLabelText("Record"), { target: { value: "VALID" } });
    await waitFor(() => expect(api.records).toHaveBeenLastCalledWith(expect.objectContaining({ result: "READ", recordState: "VALID", limit: 10 })));
    fireEvent.click(screen.getByRole("button", { name: "Topic" }));
    await waitFor(() => expect(api.records).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "topicText" })));
  });
});
