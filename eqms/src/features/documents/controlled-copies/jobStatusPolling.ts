import type { ControlledCopyDistributionJobStatus } from "@/services/api/documents";

type JobAction = "DISTRIBUTE" | "RECALL" | "CANCEL";

interface StartJobStatusPollingOptions {
  batchId: string;
  action: JobAction;
  fetchStatus: (batchId: string, action: JobAction, signal?: AbortSignal) => Promise<ControlledCopyDistributionJobStatus>;
  onStatus: (status: ControlledCopyDistributionJobStatus) => void;
}

/** SSE is authoritative; this is a visibility-aware, backoff fallback for missed events. */
export function startControlledCopyJobStatusPolling({
  batchId,
  action,
  fetchStatus,
  onStatus,
}: StartJobStatusPollingOptions): () => void {
  let stopped = false;
  let timer: number | undefined;
  let delay = 3000;
  let requestInFlight = false;
  const abortController = new AbortController();

  const schedule = (nextDelay: number) => {
    if (stopped) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(run, nextDelay);
  };

  const run = async () => {
    if (stopped) return;
    if (document.visibilityState !== "visible" || !navigator.onLine || requestInFlight) {
      schedule(1000);
      return;
    }
    requestInFlight = true;
    try {
      const status = await fetchStatus(batchId, action, abortController.signal);
      if (stopped) return;
      onStatus(status);
      delay = 3000;
    } catch (error) {
      if (abortController.signal.aborted) return;
      delay = Math.min(Math.round(delay * 1.8), 15000) + Math.floor(Math.random() * 500);
    } finally {
      requestInFlight = false;
      schedule(delay);
    }
  };

  const onVisibilityOrOnline = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      delay = 3000;
      schedule(0);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityOrOnline);
  window.addEventListener("online", onVisibilityOrOnline);
  schedule(0);

  return () => {
    stopped = true;
    abortController.abort();
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityOrOnline);
    window.removeEventListener("online", onVisibilityOrOnline);
  };
}
