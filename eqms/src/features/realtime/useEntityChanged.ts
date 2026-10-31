import { useEffect, useRef } from "react";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";

export type ChangedEntityType = "REVISION" | "DOCUMENT" | "CONTROLLED_COPY" | "CONTROLLED_COPY_BATCH" | "UNCONTROLLED_COPY" | "EXECUTED_RECORD" | "TRAINING";

export interface EntityChangedEvent {
  entityType: ChangedEntityType;
  id: string;
  documentId?: string;
}

interface UseEntityChangedOptions {
  /** Only react to events whose entity id is one of these (ignored when empty/undefined = any id). */
  ids?: Array<string | null | undefined>;
  /** Also react to events that belong to this document (any entity type listed in `types`). */
  documentId?: string | null;
  /** Coalesce a burst of events into one callback (default 400 ms). */
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Runs `onChange` when the server announces (server-sent event `entity-changed`, ids only) that a Document,
 * Revision or Controlled Copy this screen shows was changed by anyone, so the screen can refetch through its
 * normal authorised API instead of staying stale until a manual reload. Bursts are coalesced. The event never
 * carries data, only "this changed".
 *
 * A screen that lists many entities passes no `ids`/`documentId` and reacts to every event of `types`.
 */
export const useEntityChanged = (
  types: ChangedEntityType[],
  onChange: (events: EntityChangedEvent[]) => void,
  options: UseEntityChangedOptions = {},
) => {
  const { ids, documentId, debounceMs = 400, enabled = true } = options;
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;
  const typesKey = types.join("|");
  const idsKey = (ids ?? []).filter(Boolean).join("|");

  useEffect(() => {
    if (!enabled) return;
    const wantedTypes = new Set(typesKey ? (typesKey.split("|") as ChangedEntityType[]) : []);
    const wantedIds = new Set(idsKey ? idsKey.split("|") : []);
    const filtered = wantedIds.size > 0 || Boolean(documentId);
    const pending = new Map<string, EntityChangedEvent>();
    let timer: number | null = null;

    const flush = () => {
      timer = null;
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      const batch = [...pending.values()];
      pending.clear();
      if (batch.length > 0) callbackRef.current(batch);
    };

    const schedule = () => {
      if (pending.size > 0 && timer === null && document.visibilityState !== "hidden" && navigator.onLine) {
        timer = window.setTimeout(flush, debounceMs);
      }
    };
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("online", schedule);

    const unsubscribe = subscribeNotificationRealtime((event) => {
      if (event.type !== "entity-changed") return;
      let payload: EntityChangedEvent;
      try {
        payload = JSON.parse(event.data) as EntityChangedEvent;
      } catch {
        return; // malformed event; the screen keeps what it has
      }
      if (!payload?.id || !wantedTypes.has(payload.entityType)) return;
      if (filtered) {
        const matchesId = wantedIds.has(payload.id);
        const matchesDocument = Boolean(documentId) && payload.documentId === documentId;
        if (!matchesId && !matchesDocument) return;
      }
      pending.set(`${payload.entityType}:${payload.id}:${payload.documentId ?? ""}`, payload);
      schedule();
    });

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("online", schedule);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [typesKey, idsKey, documentId, debounceMs, enabled]);
};
