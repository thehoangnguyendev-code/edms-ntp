export interface SharedPollingResource<T> {
  getSnapshot: () => T | undefined;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
}

/** One loader/timer per resource, even when many components consume it. */
export const createSharedPollingResource = <T>(loader: () => Promise<T>, intervalMs: number): SharedPollingResource<T> => {
  let snapshot: T | undefined;
  let inFlight: Promise<void> | null = null;
  let timer: number | null = null;
  let subscribers = 0;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());
  const refresh = async () => {
    if (inFlight) return inFlight;
    inFlight = loader().then((value) => {
      snapshot = value;
      notify();
    }).catch(() => {
      // Keep the last verified snapshot during transient outages.
    }).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };
  const start = () => {
    if (timer !== null) return;
    void refresh();
    timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, intervalMs);
  };
  const handleVisibility = () => {
    if (!document.hidden && subscribers > 0) void refresh();
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      subscribers += 1;
      start();
      return () => {
        listeners.delete(listener);
        subscribers = Math.max(0, subscribers - 1);
        if (subscribers === 0) stop();
      };
    },
    refresh,
  };
};
