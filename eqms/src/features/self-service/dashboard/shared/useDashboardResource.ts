import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface DashboardResource<T> {
  data: T | null;
  loading: boolean;
  /** True when the request failed; `data` is null so callers cannot show a stale or zero figure. */
  error: boolean;
  reload: () => void;
}

/**
 * Loads one dashboard section on its own, so a failing endpoint only affects the
 * cards that depend on it and never turns into a misleading "0".
 */
export function useDashboardResource<T>(load: () => Promise<T>, deps: DependencyList = []): DashboardResource<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    setState((current) => ({ data: current.data, loading: true, error: false }));
    loadRef.current()
      .then((data) => { if (active) setState({ data, loading: false, error: false }); })
      .catch(() => { if (active) setState({ data: null, loading: false, error: true }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
