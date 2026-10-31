import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEntityChanged } from "../useEntityChanged";

const realtime = vi.hoisted(() => ({ listener: undefined as undefined | ((event: { type: string; data: string }) => void), unsubscribe: vi.fn() }));
vi.mock("@/features/notifications/notificationRealtime", () => ({
  subscribeNotificationRealtime: (listener: typeof realtime.listener) => {
    realtime.listener = listener;
    return realtime.unsubscribe;
  },
}));

const change = (id = "revision-1", documentId = "document-1") => realtime.listener?.({
  type: "entity-changed", data: JSON.stringify({ entityType: "REVISION", id, documentId }),
});

describe("useEntityChanged refresh scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("deduplicates a burst while preserving distinct changed entities", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useEntityChanged(["REVISION"], callback));
    act(() => { change(); change(); change("revision-2"); vi.advanceTimersByTime(400); });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toHaveLength(2);
    unmount();
  });

  it("defers hidden-tab work and flushes once when the tab becomes visible", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const callback = vi.fn();
    const { unmount } = renderHook(() => useEntityChanged(["REVISION"], callback));
    act(() => { change(); change(); vi.advanceTimersByTime(5000); });
    expect(callback).not.toHaveBeenCalled();
    act(() => { visibility.mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange")); vi.advanceTimersByTime(400); });
    expect(callback).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("keeps scope filtering and cancels pending refreshes on unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useEntityChanged(["REVISION"], callback, { ids: ["revision-2"] }));
    act(() => { change(); vi.advanceTimersByTime(400); });
    expect(callback).not.toHaveBeenCalled();
    act(() => change("revision-2"));
    unmount();
    act(() => vi.advanceTimersByTime(400));
    expect(callback).not.toHaveBeenCalled();
    expect(realtime.unsubscribe).toHaveBeenCalled();
  });

  it("waits for connectivity and uses the latest callback", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const first = vi.fn(); const latest = vi.fn();
    const { rerender, unmount } = renderHook(({ callback }) => useEntityChanged(["REVISION"], callback), { initialProps: { callback: first } });
    act(() => { change(); vi.advanceTimersByTime(400); });
    rerender({ callback: latest });
    act(() => { online.mockReturnValue(true); window.dispatchEvent(new Event("online")); vi.advanceTimersByTime(400); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    unmount();
  });
});
