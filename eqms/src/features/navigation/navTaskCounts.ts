import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { navigationApi } from "@/services/api/navigation";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";

/** What waits for the signed-in person, by menu id. `shared` are queues that several people can work. The server works every number out; nothing is added or taken away here. */
export interface NavTaskCounts { counts: Record<string, number>; shared: Record<string, number> }

const NONE: NavTaskCounts = { counts: {}, shared: {} };
const REFRESH_MS = 60_000;
let snapshot = NONE;
const listeners = new Set<() => void>();

export const setNavTaskCounts = (next: NavTaskCounts) => {
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useNavTaskCounts = () => useSyncExternalStore(subscribe, () => snapshot);

/** Sent by the API client after every request that may have changed something. */
export const DATA_CHANGED_EVENT = "eqms:data-changed";
/** The server's announcements that can change what waits for somebody: a record changed, a queue changed, a notification arrived. */
const SERVER_EVENTS = new Set(["entity-changed", "task-counts-changed", "notification-updated"]);

/**
 * Reads the counts for the whole application (used once, by the sidebar), at once and without waiting: after the person's own changes, when the server announces a
 * change, on a change of page, on coming back to the tab, and every minute as a safety net. One read runs at a time; what arrives while it runs is answered by one
 * more read when it ends, so a burst never piles up and an older answer never replaces a newer one. When a read fails the numbers are removed: an old or a zero
 * number would be read as a fact.
 */
export function useNavTaskCountsSync(userId: string | undefined, pathname: string) {
  const reading = useRef(false);
  const again = useRef(false);
  const load = useCallback(() => {
    if (!userId) return setNavTaskCounts(NONE);
    if (reading.current) {
      again.current = true;
      return;
    }
    reading.current = true;
    void navigationApi.getTaskCounts()
      .then((r) => setNavTaskCounts({ counts: r.counts ?? {}, shared: r.shared ?? {} }))
      .catch(() => setNavTaskCounts(NONE))
      .finally(() => {
        reading.current = false;
        if (!again.current) return;
        again.current = false;
        load();
      });
  }, [userId]);

  useEffect(() => { load(); }, [load, pathname]);
  useEffect(() => {
    const whenVisible = () => { if (!document.hidden) load(); };
    const interval = window.setInterval(whenVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", whenVisible);
    window.addEventListener(DATA_CHANGED_EVENT, load);
    const unsubscribe = userId ? subscribeNotificationRealtime((event) => { if (SERVER_EVENTS.has(event.type)) whenVisible(); }) : undefined;
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", whenVisible);
      window.removeEventListener(DATA_CHANGED_EVENT, load);
      unsubscribe?.();
    };
  }, [load, userId]);
}

interface Entry { id: string; children?: Entry[] }

/**
 * The number of one menu entry: its own when the server gave one (work that names the person, or a queue), otherwise the sum of the entries under it.
 * A module for which the server gives its own number (Training Management: each task once, although it shows in two places) is not summed again.
 */
export function navBadge(item: Entry, taskCounts: NavTaskCounts): number | undefined {
  const own = taskCounts.counts[item.id] ?? taskCounts.shared[item.id];
  if (own !== undefined) return own;
  const sum = (item.children ?? []).reduce((total, child) => total + (navBadge(child, taskCounts) ?? 0), 0);
  return sum > 0 ? sum : undefined;
}
