import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Drop-in replacement for `useState` that keeps one filter value in the URL query string.
 *
 * The value survives Back navigation and page refresh, and the URL can be shared. Writes use
 * `replace`, so changing a filter does not add a history entry. A value equal to `defaultValue`
 * (or an empty string) is removed from the URL to keep links short.
 *
 * Use one call per filter, with a key that is unique on the page:
 *   const [status, setStatus] = useUrlParam<"All" | "Active">("status", "All");
 */
export function useUrlParam<T extends string>(key: string, defaultValue: T) {
  const [params, setParams] = useSearchParams();
  const value = (params.get(key) ?? defaultValue) as T;

  const setValue = useCallback(
    (next: T) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (next === defaultValue || next === "") updated.delete(key);
          else updated.set(key, next);
          return updated;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setParams],
  );

  return [value, setValue] as const;
}
