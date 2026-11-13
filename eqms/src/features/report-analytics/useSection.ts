import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One section of a screen, loaded on its own: a section that fails or that the person may not see never changes another, and a failure is shown as a failure, never as a zero.
 * "denied" is a 403: the person has no permission for that part, so the section says so (or is left out) instead of showing an error.
 */
export type SectionState<T> =
  | { status: "loading"; data: null }
  | { status: "ready"; data: T }
  | { status: "denied"; data: null }
  | { status: "error"; data: null };

export function useSection<T>(load: () => Promise<T>): { state: SectionState<T>; reload: () => void } {
  const [state, setState] = useState<SectionState<T>>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let active = true;
    setState((current) => (current.status === "ready" ? current : { status: "loading", data: null }));
    loadRef.current()
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        setState(status === 403 ? { status: "denied", data: null } : { status: "error", data: null });
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}
