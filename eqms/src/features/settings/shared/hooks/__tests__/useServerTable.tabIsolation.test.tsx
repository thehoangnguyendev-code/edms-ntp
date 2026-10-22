import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));
import { useServerTable } from "../useServerTable";

beforeEach(() => vi.clearAllMocks());

it("retains URL initialization by default for existing list screens", async () => {
  const fetcher = vi.fn(async (params: any) => ({ data: [], pagination: { page: params.page, limit: params.limit, total: 30, totalPages: 3 } }));
  renderHook(() => useServerTable({ fetcher, defaultSortBy: "name" }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={["/?search=GMP&page=2&sortBy=created&sortDirection=desc"]}>{children}</MemoryRouter>,
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ search: "GMP", page: 2, sortBy: "created", sortDirection: "desc" })));
});

it("ignores another table's URL query when URL synchronization is disabled", async () => {
  const fetcher = vi.fn(async (params: any) => ({ data: [], pagination: { page: params.page, limit: params.limit, total: 0, totalPages: 1 } }));
  renderHook(() => useServerTable({ fetcher, defaultSortBy: "assignedAt", syncToUrl: false }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={["/?search=GMP&page=2&sortBy=dueDate&limit=50"]}>{children}</MemoryRouter>,
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ search: undefined, page: 1, limit: 10, sortBy: "assignedAt" })));
});

it("sorts ascending on the first click of a list that sorts descending by default, and stays ascending", async () => {
  const fetcher = vi.fn(async (params: any) => ({ data: [], pagination: { page: params.page, limit: params.limit, total: 0, totalPages: 1 } }));
  const { result } = renderHook(() => useServerTable({ fetcher, defaultSortBy: "completedOn", defaultSortDirection: "desc" }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>,
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  act(() => result.current.handleSort("employeeCode"));
  await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "employeeCode", sortDirection: "asc" })));
  // The address now carries sortDirection=asc; reading it back must not turn it into the default (desc).
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(result.current.sortConfig).toEqual({ key: "employeeCode", direction: "asc" });
  expect(fetcher).not.toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "employeeCode", sortDirection: "desc" }));
});
