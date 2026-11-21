import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const status = vi.fn();

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/services/api/trainingActivities", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/trainingActivities")>("@/services/api/trainingActivities");
  return {
    ...actual,
    trainingCheckInApi: { status: (...a: unknown[]) => status(...a), open: vi.fn(), close: vi.fn() },
    trainingActivitiesApi: { ...actual.trainingActivitiesApi, get: vi.fn() },
  };
});

import { TrainingCheckInBlock } from "../components/TrainingCheckInBlock";

const activity = { id: "a1", sessions: [{ id: "s1", sessionNo: 1, status: "PLANNED", heldOn: "2026-11-03" }], participants: [] };
const timer = () => screen.getByRole("timer").textContent;

describe("Check-in countdown", () => {
  it("shows every second for a second, across polls that read the time rounded down", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T10:00:00.000Z"));
    // 222.4 s left. The server says the whole seconds, rounded down, at the moment it answers, and the answer takes a different time to arrive each time: a screen that took each answer for the
    // truth would move its end by a fraction of a second at every poll, and one second would be short and another long.
    const end = Date.now() + 222_400;
    const latency = [20, 450, 120, 380];
    let n = 0;
    status.mockImplementation(async () => {
      const body = { open: true, code: "482915", secondsLeft: Math.floor((end - Date.now()) / 1000), checkedIn: 0, invited: 3 };
      await new Promise((resolve) => setTimeout(resolve, latency[n++ % latency.length]));
      return body;
    });
    render(<TrainingCheckInBlock activity={activity as never} onChanged={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const lasted = new Map<string, { from: number; to: number }>();
    const start = Date.now();
    for (let t = 0; t < 16_000; t += 50) {
      await act(async () => { await vi.advanceTimersByTimeAsync(50); });
      const now = Date.now() - start;
      const key = timer() as string;
      const seen = lasted.get(key);
      lasted.set(key, { from: seen?.from ?? now, to: now });
    }
    const lengths = [...lasted.values()].slice(1, -1).map((v) => v.to - v.from + 50);
    expect(lengths.length).toBeGreaterThan(10);
    for (const ms of lengths) expect(ms).toBeGreaterThanOrEqual(950);
    for (const ms of lengths) expect(ms).toBeLessThanOrEqual(1100);
    vi.useRealTimers();
  });

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-21T10:00:00.000Z")); });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("runs from the clock: a poll that says the same time a little rounded does not make it jump or stop", async () => {
    // the server says the seconds left as a whole number, rounded down, at each poll
    const end = Date.now() + 222_000;
    status.mockImplementation(async () => ({ open: true, code: "482915", secondsLeft: Math.floor((end - Date.now()) / 1000), checkedIn: 0, invited: 3 }));
    render(<TrainingCheckInBlock activity={activity as never} onChanged={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(timer()).toBe("3:42");
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    // 222 - 5.1 s = 216.9 s: the poll said 216, and the screen still goes on by the clock
    expect(timer()).toBe("3:37");
    // across several more polls, the seconds go down by one each time the clock passes a second
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      seen.push(timer() as string);
    }
    expect(seen).toEqual(["3:36", "3:35", "3:34", "3:33", "3:32", "3:31", "3:30", "3:29", "3:28", "3:27", "3:26", "3:25"]);
  });

  it("takes the time of a new code as soon as it is read", async () => {
    status.mockResolvedValueOnce({ open: true, code: "482915", secondsLeft: 20, checkedIn: 0, invited: 3 })
      .mockResolvedValue({ open: true, code: "100200", secondsLeft: 300, checkedIn: 0, invited: 3 });
    render(<TrainingCheckInBlock activity={activity as never} onChanged={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(timer()).toBe("0:20");
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    expect(timer()).toBe("5:00");
  });
});
