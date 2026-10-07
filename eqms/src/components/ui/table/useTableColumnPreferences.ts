import { useCallback, useEffect, useRef, useState } from "react";
import { tablePreferencesApi, type SavedColumnPreference } from "@/services/api/tablePreferences";

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

/**
 * Loads and saves one table's column layout for the signed-in user. Until the saved layout arrives
 * the defaults are shown, so the table never waits on the preference request.
 */
const LOAD_ATTEMPTS = 3;

export function useTableColumnPreferences(tableKey: string, defaults: CustomizableColumn[]) {
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [columns, setColumns] = useState<CustomizableColumn[]>(() => mergeSavedColumns(defaults, []));
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The first request can fail while the session is still settling (for example right after sign-in).
    // Retry before falling back, so a saved layout is not silently replaced by the defaults.
    const load = async (attempt: number): Promise<void> => {
      try {
        const saved = await tablePreferencesApi.get(tableKey);
        if (cancelled) return;
        setColumns(mergeSavedColumns(defaultsRef.current, saved));
        setLoadFailed(false);
        setLoaded(true);
      } catch {
        if (cancelled) return;
        if (attempt < LOAD_ATTEMPTS) {
          await new Promise((resolve) => window.setTimeout(resolve, 800 * attempt));
          if (!cancelled) return load(attempt + 1);
          return;
        }
        setColumns(mergeSavedColumns(defaultsRef.current, []));
        setLoadFailed(true);
        setLoaded(true);
      }
    };
    setLoaded(false);
    void load(1);
    return () => {
      cancelled = true;
    };
  }, [tableKey]);

  // Returns false when the server did not accept the layout, and restores what was on screen before.
  const saveColumns = useCallback(
    async (next: CustomizableColumn[]): Promise<boolean> => {
      const previous = columnsRef.current;
      const merged = mergeSavedColumns(defaultsRef.current, toSavedColumns(next));
      setColumns(merged);
      try {
        await tablePreferencesApi.save(tableKey, toSavedColumns(merged));
        return true;
      } catch {
        setColumns(previous);
        return false;
      }
    },
    [tableKey],
  );

  const resetColumns = useCallback(async (): Promise<boolean> => {
    const previous = columnsRef.current;
    setColumns(mergeSavedColumns(defaultsRef.current, []));
    try {
      await tablePreferencesApi.reset(tableKey);
      return true;
    } catch {
      setColumns(previous);
      return false;
    }
  }, [tableKey]);

  return { columns, saveColumns, resetColumns, loaded, loadFailed };
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
