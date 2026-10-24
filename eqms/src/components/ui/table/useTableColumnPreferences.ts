import { useCallback, useEffect, useRef, useState } from "react";
import { tablePreferencesApi, type SavedColumnPreference } from "@/services/api/tablePreferences";
import { useAuth } from "@/contexts/AuthContext";

/** A table column as the customizer sees it. `locked` columns (e.g. "No.") cannot be hidden, moved or unpinned. */
export interface CustomizableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  pinned?: boolean;
  locked?: boolean;
}

/**
 * Applies a user's saved layout onto the table's default columns. Saved entries whose id no longer
 * exists are dropped, new default columns are appended as visible, and locked columns always keep
 * their default position and visibility, whatever was saved.
 */
export function mergeSavedColumns(defaults: CustomizableColumn[], saved: SavedColumnPreference[]): CustomizableColumn[] {
  const savedById = new Map(saved.map((entry) => [entry.id, entry]));
  const known = defaults.filter((column) => column.locked || savedById.has(column.id));
  const unsaved = defaults.filter((column) => !column.locked && !savedById.has(column.id));

  const ordered = [...known].sort((a, b) => {
    const orderA = a.locked ? a.order : (savedById.get(a.id)?.order ?? a.order);
    const orderB = b.locked ? b.order : (savedById.get(b.id)?.order ?? b.order);
    return orderA - orderB;
  });

  const merged = [...ordered, ...unsaved].map((column, index) => {
    if (column.locked) return { ...column, order: column.order, visible: true, pinned: true };
    const entry = savedById.get(column.id);
    return {
      ...column,
      visible: entry ? entry.visible : column.visible,
      pinned: entry ? entry.pinned : Boolean(column.pinned),
      order: index,
    };
  });
  return merged.sort((a, b) => a.order - b.order);
}

/** Converts the in-memory columns to the payload the server stores (order is re-numbered 0..n). */
export function toSavedColumns(columns: CustomizableColumn[]): SavedColumnPreference[] {
  return [...columns]
    .sort((a, b) => a.order - b.order)
    .map((column, index) => ({ id: column.id, visible: column.visible, order: index, pinned: Boolean(column.pinned) }));
}

const LOAD_ATTEMPTS = 3;

// The last layout the server returned for this person and table is kept in the browser, so the table opens in the saved layout at once and the server only confirms it.
// The server stays the truth: what it answers replaces the copy, and a copy never leaves the browser or reaches another person (the key holds the user id).
const cacheKey = (userId: string | undefined, tableKey: string) => (userId ? `eqms.table-columns.v1:${userId}:${tableKey}` : null);

function readCache(userId: string | undefined, tableKey: string): SavedColumnPreference[] | null {
  const key = cacheKey(userId, tableKey);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string | undefined, tableKey: string, saved: SavedColumnPreference[] | null) {
  const key = cacheKey(userId, tableKey);
  if (!key) return;
  try {
    if (saved === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    /* storage may be full or blocked: the table still works from the server */
  }
}

const sameLayout = (a: CustomizableColumn[], b: CustomizableColumn[]) => JSON.stringify(toSavedColumns(a)) === JSON.stringify(toSavedColumns(b));

/**
 * Loads and saves one table's column layout for the signed-in user. The table opens in the last layout this browser saw for the person (or the defaults on a first visit)
 * and the server confirms it: a layout is never lost by a slow or failed request, and a failed load is tried again when the window gets focus or the network returns.
 */
export function useTableColumnPreferences(tableKey: string, defaults: CustomizableColumn[]) {
  const { user } = useAuth();
  const userId = user?.id;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [columns, setColumns] = useState<CustomizableColumn[]>(() => mergeSavedColumns(defaults, readCache(userId, tableKey) ?? []));
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Counts the saves and resets made here: an answer to a load that started before one of them must not undo it.
  const changes = useRef(0);
  // The same count as state: the table moves its columns to the new place when a layout is applied or reset (and not when the server confirms the layout it opened with).
  const [changeCount, setChangeCount] = useState(0);

  const load = useCallback(async (): Promise<boolean> => {
    const started = changes.current;
    for (let attempt = 1; attempt <= LOAD_ATTEMPTS; attempt += 1) {
      try {
        const saved = await tablePreferencesApi.get(tableKey);
        if (changes.current !== started) return true;
        writeCache(userId, tableKey, saved);
        const next = mergeSavedColumns(defaultsRef.current, saved);
        setColumns((current) => (sameLayout(current, next) ? current : next));
        setLoadFailed(false);
        setLoaded(true);
        return true;
      } catch {
        // The first request can fail while the session is still settling (for example right after sign-in): wait and ask again.
        if (attempt < LOAD_ATTEMPTS) await new Promise((resolve) => window.setTimeout(resolve, 800 * attempt));
      }
    }
    // Keep what is on screen (the copy of the browser, or the defaults): a layout is never replaced because the server did not answer.
    setLoadFailed(true);
    setLoaded(true);
    return false;
  }, [tableKey, userId]);

  useEffect(() => {
    const cached = readCache(userId, tableKey);
    const next = mergeSavedColumns(defaultsRef.current, cached ?? []);
    setColumns((current) => (sameLayout(current, next) ? current : next));
    setLoaded(false);
    void load();
  }, [tableKey, userId, load]);

  // A load that failed is tried again when the person comes back to the window or the network returns.
  useEffect(() => {
    if (!loadFailed) return;
    const retry = () => void load();
    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
    };
  }, [loadFailed, load]);

  // Returns false when the server did not accept the layout, and restores what was on screen before.
  const saveColumns = useCallback(
    async (next: CustomizableColumn[]): Promise<boolean> => {
      const previous = columnsRef.current;
      const merged = mergeSavedColumns(defaultsRef.current, toSavedColumns(next));
      changes.current += 1;
      setChangeCount((n) => n + 1);
      setColumns(merged);
      try {
        const payload = toSavedColumns(merged);
        await tablePreferencesApi.save(tableKey, payload);
        writeCache(userId, tableKey, payload);
        return true;
      } catch {
        setColumns(previous);
        return false;
      }
    },
    [tableKey, userId],
  );

  const resetColumns = useCallback(async (): Promise<boolean> => {
    const previous = columnsRef.current;
    changes.current += 1;
    setChangeCount((n) => n + 1);
    setColumns(mergeSavedColumns(defaultsRef.current, []));
    try {
      await tablePreferencesApi.reset(tableKey);
      writeCache(userId, tableKey, null);
      return true;
    } catch {
      setColumns(previous);
      return false;
    }
  }, [tableKey, userId]);

  return { columns, saveColumns, resetColumns, loaded, loadFailed, changes: changeCount };
}

/**
 * Most columns a user may pin. Pinned columns stay on screen while the table scrolls, so more than
 * this leaves too little room for the rest of the table.
 */
export const MAX_PINNED_COLUMNS = 3;

/**
 * Stable order used by the customizer and by Apply: locked columns first, then pinned, then the rest.
 * Pinning is therefore always a continuous run from the left (after the locked columns), never a gap.
 * A hidden column is never pinned.
 */
export function normalizeColumnOrder(columns: CustomizableColumn[]): CustomizableColumn[] {
  const rank = (column: CustomizableColumn) => (column.locked ? 0 : column.pinned && column.visible ? 1 : 2);
  return [...columns]
    .sort((a, b) => rank(a) - rank(b) || a.order - b.order)
    .map((column, index) => ({ ...column, order: index }));
}
