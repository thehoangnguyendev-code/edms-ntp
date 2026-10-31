import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));
import { useServerTable, type ServerPageResponse, type ServerQuery } from "../useServerTable";

beforeEach(() => vi.clearAllMocks());
const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
const page = (name: string): ServerPageResponse<string> => ({ data: [name], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });

it("keeps existing rows while searching and ignores an old response even when the fetcher ignores abort", async () => {
  const pending: Array<{ signal?: AbortSignal; resolve: (page: ServerPageResponse<string>) => void }> = [];
  const fetcher = vi.fn((_params: ServerQuery, signal?: AbortSignal) => new Promise<ServerPageResponse<string>>((resolve) => pending.push({ signal, resolve })));
  const { result, unmount } = renderHook(() => useServerTable({ fetcher, defaultSortBy: "name", syncToUrl: false, searchDelayMs: 20 }), { wrapper });
  await act(async () => pending[0].resolve(page("initial")));
  act(() => result.current.setSearchQuery("first"));
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(result.current.isLoading).toBe(false);expect(result.current.isFetching).toBe(true);expect(result.current.items).toEqual(["initial"]);
  act(() => result.current.setSearchQuery("second"));
  await waitFor(() => expect(pending).toHaveLength(3));expect(pending[1].signal?.aborted).toBe(true);
  await act(async () => pending[2].resolve(page("latest")));
  await act(async () => pending[1].resolve(page("stale")));
  expect(result.current.items).toEqual(["latest"]);expect(result.current.isFetching).toBe(false);
  unmount();expect(pending[2].signal?.aborted).toBe(true);expect(toast.showToast).not.toHaveBeenCalled();
});

it("aborted request errors do not clear the newer result or show an error toast", async () => {
  const fetcher = vi.fn((params: ServerQuery, signal?: AbortSignal) => params.search
    ? Promise.resolve(page("found"))
    : new Promise<ServerPageResponse<string>>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
  const { result } = renderHook(() => useServerTable({ fetcher, defaultSortBy: "name", syncToUrl: false, searchDelayMs: 20 }), { wrapper });
  act(() => result.current.setSearchQuery("find"));
  await waitFor(() => expect(result.current.items).toEqual(["found"]));expect(toast.showToast).not.toHaveBeenCalled();
});
