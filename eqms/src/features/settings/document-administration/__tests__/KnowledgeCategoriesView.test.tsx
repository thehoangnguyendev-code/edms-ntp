import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks", () => ({
  useDebounce: (value: unknown) => value,
  usePortalDropdown: () => ({ openId: null, position: {}, getRef: () => () => undefined, toggle: vi.fn(), close: vi.fn() }),
  useTableDragScroll: () => ({ scrollerRef: { current: null }, isDragging: false, dragEvents: {} }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

const { knowledgeApiMock } = vi.hoisted(() => ({
  knowledgeApiMock: { listHierarchies: vi.fn(), setDefault: vi.fn(), deleteHierarchy: vi.fn() },
}));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: knowledgeApiMock }));

import { KnowledgeCategoriesView } from "../KnowledgeCategoriesView";

const row = {
  id: "h1",
  name: "Business Unit Hierarchy",
  description: "desc",
  determinatorField: "BUSINESS_UNIT",
  determinatorLabel: "Business Unit",
  active: true,
  isDefault: true,
  levels: [{ id: "l1", fieldCode: "DEPARTMENT", fieldLabel: "Department", displayOrder: 10 }],
  updatedAt: "2026-09-21T09:31:10Z",
  updatedByName: "Nguyen The Hoang",
};

describe("KnowledgeCategoriesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeApiMock.listHierarchies.mockResolvedValue({ data: [row], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
  });

  it("asks the server for search, sort and paging instead of doing it in the browser", async () => {
    render(<MemoryRouter><KnowledgeCategoriesView /></MemoryRouter>);
    await screen.findByText("Business Unit Hierarchy");
    expect(knowledgeApiMock.listHierarchies).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, limit: 10, sortBy: "name", sortDir: "asc" }),
    );

    fireEvent.change(screen.getAllByPlaceholderText("Search by name or description...")[1], { target: { value: "unit" } });
    await waitFor(() =>
      expect(knowledgeApiMock.listHierarchies).toHaveBeenLastCalledWith(expect.objectContaining({ search: "unit", page: 1 })),
    );

    fireEvent.click(screen.getByText("Last Updated"));
    await waitFor(() =>
      expect(knowledgeApiMock.listHierarchies).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "updatedAt", sortDir: "asc" })),
    );
    fireEvent.click(screen.getByText("Last Updated"));
    await waitFor(() =>
      expect(knowledgeApiMock.listHierarchies).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "updatedAt", sortDir: "desc" })),
    );
  });

  it("shows Last Updated and Updated By in separate columns", async () => {
    render(<MemoryRouter><KnowledgeCategoriesView /></MemoryRouter>);
    await screen.findByText("Business Unit Hierarchy");
    expect(screen.getByText("Updated By")).toBeTruthy();
    expect(screen.getByText("Nguyen The Hoang")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
  });

  it("expands the levels on chevron click", async () => {
    render(<MemoryRouter><KnowledgeCategoriesView /></MemoryRouter>);
    await screen.findByText("Business Unit Hierarchy");
    expect(screen.queryByText(/Knowledge Category Levels/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Show levels"));
    expect(await screen.findByText(/Knowledge Category Levels \(1\)/)).toBeTruthy();
    expect(screen.getByText(/order 10/)).toBeTruthy();
  });
});
