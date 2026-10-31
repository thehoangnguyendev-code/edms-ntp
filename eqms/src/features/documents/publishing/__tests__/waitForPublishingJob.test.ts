import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForPublishingJob } from "../waitForPublishingJob";

const initial = { publishingJobId: "job-1", publishingJobStatus: "QUEUED" };
afterEach(() => vi.useRealTimers());
describe("confirmed publishing completion", () => {
  it("a wait timeout remains pending, never a successful publication", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(initial);
    const pending = waitForPublishingJob(initial, fetch, 2, 100);
    await vi.advanceTimersByTimeAsync(200);
    expect(await pending).toEqual({ completed: false, status: initial });
  });
  it("only COMPLETED for the accepted job is successful", async () => {
    expect((await waitForPublishingJob({ ...initial, publishingJobStatus: "COMPLETED" }, vi.fn())).completed).toBe(true);
    vi.useFakeTimers();
    const pending = waitForPublishingJob(initial, async () => ({ publishingJobId: "other-job", publishingJobStatus: "COMPLETED" }), 1, 100);
    const assertion = expect(pending).rejects.toThrow("identity changed");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
  it("a forbidden poll is not treated as a completed publication", async () => {
    vi.useFakeTimers();
    const pending = waitForPublishingJob(initial, async () => { throw new Error("403 Forbidden"); }, 1, 100);
    const assertion = expect(pending).rejects.toThrow("403 Forbidden");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
  it("propagates a recorded server failure", async () => {
    await expect(waitForPublishingJob({ ...initial, publishingJobStatus: "FAILED", publishingJobError: "Content changed" }, vi.fn())).rejects.toThrow("Content changed");
  });
});
