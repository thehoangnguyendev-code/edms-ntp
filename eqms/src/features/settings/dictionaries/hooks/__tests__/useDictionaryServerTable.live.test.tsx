import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useDictionaryServerTable } from "../useDictionaryServerTable";

const showToast = vi.fn();
let announce: ((event: { type: string; data: string }) => void) | undefined;

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/features/notifications/notificationRealtime", () => ({
  subscribeNotificationRealtime: (listener: (event: { type: string; data: string }) => void) => {
    announce = listener;
    return () => { announce = undefined; };
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
const page = (names: string[]) => ({ data: names.map((name) => ({ name })), pagination: { page: 1, limit: 10, total: names.length, totalPages: 1 } });
const setVisibility = (state: "visible" | "hidden") => Object.defineProperty(document, "visibilityState", { value: state, configurable: true });

describe("a table that refreshes itself", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    showToast.mockReset();
    setVisibility("visible");
  });
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

  it("reads the rows again, without a loading state, when the server announces a change of its kind", async () => {
    const fetcher = vi.fn().mockResolvedValue(page(["a"]));
    const { result } = renderHook(() => useDictionaryServerTable<{ name: string }>({ fetcher, defaultSortBy: "name", liveTypes: ["USER_SESSION"] }), { wrapper });
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    fetcher.mockResolvedValue(page(["a", "b"]));
    await act(async () => {
      announce?.({ type: "entity-changed", data: JSON.stringify({ entityType: "USER_SESSION", id: "s1" }) });
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores an announcement of another kind", async () => {
    const fetcher = vi.fn().mockResolvedValue(page(["a"]));
    renderHook(() => useDictionaryServerTable<{ name: string }>({ fetcher, defaultSortBy: "name", liveTypes: ["USER_SESSION"] }), { wrapper });
    await flush();
    await act(async () => {
      announce?.({ type: "entity-changed", data: JSON.stringify({ entityType: "DOCUMENT", id: "d1" }) });
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes on the timer only while the tab is visible", async () => {
    const fetcher = vi.fn().mockResolvedValue(page(["a"]));
    renderHook(() => useDictionaryServerTable<{ name: string }>({ fetcher, defaultSortBy: "name", refreshIntervalMs: 60_000 }), { wrapper });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
    expect(fetcher).toHaveBeenCalledTimes(2); // nothing asked while nobody looks

    setVisibility("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); });
    expect(fetcher).toHaveBeenCalledTimes(3); // back after longer than the interval: read at once
  });

  it("keeps the rows and says nothing when a refresh nobody asked for fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(page(["a", "b"]));
    const { result } = renderHook(() => useDictionaryServerTable<{ name: string }>({ fetcher, defaultSortBy: "name", refreshIntervalMs: 60_000 }), { wrapper });
    await flush();
    expect(result.current.items).toHaveLength(2);

    fetcher.mockRejectedValue(new Error("network"));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.items).toHaveLength(2);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("has no timer unless one is asked for", async () => {
    const fetcher = vi.fn().mockResolvedValue(page(["a"]));
    renderHook(() => useDictionaryServerTable<{ name: string }>({ fetcher, defaultSortBy: "name" }), { wrapper });
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
