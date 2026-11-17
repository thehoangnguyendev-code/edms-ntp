import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useResetPageOnChange } from "../useResetPageOnChange";

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
import { useDictionaryServerTable } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";

describe("useResetPageOnChange", () => {
  it("does nothing when first shown and goes back to page 1 only when a filter changes", () => {
    const setPage = vi.fn();
    const { rerender } = renderHook(({ status }) => useResetPageOnChange(setPage, [status, "2026-01-01"]), { initialProps: { status: "All" } });

    expect(setPage).not.toHaveBeenCalled();
    rerender({ status: "All" });
    expect(setPage).not.toHaveBeenCalled();
    rerender({ status: "Active" });
    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenCalledWith(1);
    rerender({ status: "Active" });
    expect(setPage).toHaveBeenCalledTimes(1);
  });

  it("keeps the page of the address on a list that filters, and returns to page 1 when the filter changes", async () => {
    const fetcher = vi.fn((params: Record<string, unknown>) =>
      Promise.resolve({ data: ["row"], pagination: { page: Number(params.page), limit: 10, total: 40, totalPages: 4 } }));
    const { result, rerender } = renderHook(
      ({ status }) => {
        const table = useDictionaryServerTable<string>({ fetcher, defaultSortBy: "name" });
        useResetPageOnChange(table.setCurrentPage, [status]);
        return table;
      },
      {
        initialProps: { status: "All" },
        wrapper: ({ children }) => <MemoryRouter initialEntries={["/list?page=3"]}>{children}</MemoryRouter>,
      },
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 3 })));
    expect(result.current.currentPage).toBe(3);

    rerender({ status: "Active" });
    await waitFor(() => expect(result.current.currentPage).toBe(1));
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(result.current.currentPage).toBe(2));
  });
});
