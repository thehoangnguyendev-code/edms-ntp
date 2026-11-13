import { useCallback, useSyncExternalStore } from "react";
import { APP_SIDEBAR_WIDTH, clampSidebarWidth } from "./sidebarWidths";

/** Per browser, like the collapsed state: the width is a viewing preference, not account data. */
export const SIDEBAR_WIDTH_STORAGE_KEY = "eqms.sidebar.width";

const listeners = new Set<() => void>();
let current: number | null = null;

const readStored = (): number => {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw === null) return APP_SIDEBAR_WIDTH;
    return clampSidebarWidth(Number(raw));
  } catch {
    return APP_SIDEBAR_WIDTH;
  }
};

const getSnapshot = (): number => {
  if (current === null) current = readStored();
  return current;
};

const getServerSnapshot = (): number => APP_SIDEBAR_WIDTH;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SIDEBAR_WIDTH_STORAGE_KEY) return;
    current = readStored();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const publish = (next: number) => {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
};

/** Test helper: forget the in-memory value so the next read comes from storage again. */
export const resetSidebarWidthCache = () => {
  current = null;
  listeners.forEach((listener) => listener());
};

/**
 * The sidebar width the user chose, always within the allowed range.
 * `setWidth` changes it live (used while dragging); `commit` also stores it; `reset` goes back to the default.
 */
export function useSidebarWidth() {
  const width = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setWidth = useCallback((next: number) => publish(clampSidebarWidth(next)), []);

  const commit = useCallback((next?: number) => {
    const value = clampSidebarWidth(next ?? getSnapshot());
    publish(value);
    try {
      if (value === APP_SIDEBAR_WIDTH) window.localStorage.removeItem(SIDEBAR_WIDTH_STORAGE_KEY);
      else window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(value));
    } catch {
      // Storage can be blocked; the width then lasts until the page is reloaded.
    }
  }, []);

  const reset = useCallback(() => commit(APP_SIDEBAR_WIDTH), [commit]);

  return { width, setWidth, commit, reset };
}
