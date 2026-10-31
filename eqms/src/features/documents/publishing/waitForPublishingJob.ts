import type { PublishingWorkspaceResponse } from "./types";

export type PublishingJobStatus = Pick<PublishingWorkspaceResponse,
  "publishingJobId" | "publishingJobStatus" | "publishingJobMessage" | "publishingJobError">;

/** A timeout or failed API request is never evidence of a completed business operation. */
export async function waitForPublishingJob(initial: PublishingJobStatus,
  fetchStatus: () => Promise<PublishingJobStatus>, maxPolls = 30, intervalMs = 2000) {
  if (!initial.publishingJobId) throw new Error("Server did not return the accepted publishing job.");
  let current = initial;
  for (let poll = 0; ; poll++) {
    if (current.publishingJobId !== initial.publishingJobId) throw new Error("Publishing job identity changed.");
    const state = current.publishingJobStatus?.toUpperCase();
    if (state === "COMPLETED") return { completed: true, status: current };
    if (state === "FAILED") throw new Error(current.publishingJobError || current.publishingJobMessage || "Publishing failed on server.");
    if (poll >= maxPolls) return { completed: false, status: current };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    current = await fetchStatus();
  }
}
