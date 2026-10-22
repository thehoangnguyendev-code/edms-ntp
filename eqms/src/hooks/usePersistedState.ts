import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

/** The key a list state is kept under for the person who is signed in; the state lives as long as the browser tab, so going to a detail screen and coming back finds it again. */
export const persistedKey = (userId: string | undefined, key: string) => `eqms.list.${userId ?? "anonymous"}.${key}`;

export const readPersisted = <T,>(storageKey: string | undefined): T | undefined => {
  if (!storageKey) return undefined;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
};

export const writePersisted = (storageKey: string | undefined, value: unknown) => {
  if (!storageKey) return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* the filter is only a convenience; without storage it starts empty */
  }
};

/** Like useState, but the value is kept for the browser tab, so a filter chosen on a list is still there when the person comes back from a detail screen. */
export function usePersistedState<T>(key: string, initial: T) {
  const { user } = useAuth() as { user?: { id?: string } | null };
  const storageKey = persistedKey(user?.id, key);
  const [value, setValue] = useState<T>(() => readPersisted<T>(storageKey) ?? initial);
  useEffect(() => { writePersisted(storageKey, value); }, [storageKey, value]);
  return [value, setValue] as const;
}
