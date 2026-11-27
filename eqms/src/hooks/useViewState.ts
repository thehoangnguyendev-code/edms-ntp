import { useCallback, useContext, useEffect, useRef, useState, type DependencyList, type Dispatch, type EffectCallback, type SetStateAction } from "react";
import { UNSAFE_LocationContext as LocationContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { persistedKey, readPersisted, writePersisted } from "./usePersistedState";

/** UI state only: scoped to the signed-in person, browser tab, route and owning component. */
export function useViewState<T>(name: string, initial: T | (() => T), preferInitial = false): readonly [T, Dispatch<SetStateAction<T>>] {
  const location = useContext(LocationContext)?.location;
  const { user } = useAuth();
  // Reusable standalone tables have no route to return to; retain their ordinary local-state behavior.
  const key = location ? persistedKey(user?.id, `view:${location.pathname}:${name}`) : undefined;
  const initialValue = useRef(initial);
  initialValue.current = initial;
  const initialize = useCallback(() => {
    const saved = preferInitial ? undefined : readPersisted<T>(key);
    return saved ?? (typeof initialValue.current === "function" ? (initialValue.current as () => T)() : initialValue.current);
  }, [key, preferInitial]);
  const [cell, setCell] = useState(() => ({ key, value: initialize() }));
  let current = cell;
  if (cell.key !== key) {
    current = { key, value: initialize() };
    setCell(current);
  }
  const value = current.value;
  useEffect(() => { writePersisted(key, value); }, [key, value]);
  const setValue: Dispatch<SetStateAction<T>> = useCallback((action) => setCell((previous) => {
    const before = previous.key === key ? previous.value : initialize();
    return { key, value: typeof action === "function" ? (action as (v: T) => T)(before) : action };
  }), [key, initialize]);
  return [value, setValue] as const;
}

/** A filter change resets paging; merely returning to a saved list does not. Also safe under StrictMode. */
export function useViewFilterChange(effect: EffectCallback, dependencies: DependencyList) {
  const previous = useRef(dependencies);
  useEffect(() => {
    const changed = dependencies.length !== previous.current.length || dependencies.some((value, index) => !Object.is(value, previous.current[index]));
    previous.current = dependencies;
    if (changed) return effect();
    // Same contract as useEffect: the caller supplies the filter dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
