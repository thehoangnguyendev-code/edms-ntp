import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCountdown } from "../components/useCountdown";

describe("useCountdown", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-21T10:00:00.000Z")); });
  afterEach(() => vi.useRealTimers());

  it("counts the whole seconds left one at a time: no second is skipped, none is repeated", () => {
    const deadline = Date.now() + 60_000;
    const { result } = renderHook(() => useCountdown(deadline));
    const seen: number[] = [result.current as number];
    // the page is read every 100 ms for twelve seconds, as a busy page would be
    for (let t = 0; t < 12_000; t += 100) {
      act(() => { vi.advanceTimersByTime(100); });
      if (result.current !== seen[seen.length - 1]) seen.push(result.current as number);
    }
    expect(seen.join(",")).toBe("60,59,58,57,56,55,54,53,52,51,50,49");
  });

  it("keeps the right second when the time of the page is not a whole second away from the end", () => {
    const deadline = Date.now() + 59_400;
    const { result } = renderHook(() => useCountdown(deadline));
    expect(result.current).toBe(60);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(59);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(58);
  });

  it("stops at zero, and has nothing to count when there is no deadline", () => {
    const { result, rerender } = renderHook(({ d }) => useCountdown(d), { initialProps: { d: Date.now() + 2_000 } });
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(result.current).toBe(0);
    rerender({ d: 0 });
    expect(result.current).toBeNull();
  });

  it("reads the clock again when the tab is shown after it was in the background", () => {
    const deadline = Date.now() + 60_000;
    const { result } = renderHook(() => useCountdown(deadline));
    vi.setSystemTime(Date.now() + 30_000); // the timers of a hidden tab did not run
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current).toBe(30);
  });
});
