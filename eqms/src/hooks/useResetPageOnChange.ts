import { useEffect, useRef } from "react";

/**
 * Sends a table back to its first page when one of its filters changes, but not when it is first shown: a page restored from the address
 * (the Back button of a detail screen, a link) is kept. Filters are compared by value, so pass plain values, not objects made on every render.
 */
export function useResetPageOnChange(setPage: (page: number) => void, filters: ReadonlyArray<unknown>) {
  const previous = useRef(filters);
  useEffect(() => {
    const changed = filters.length !== previous.current.length || filters.some((value, index) => !Object.is(value, previous.current[index]));
    previous.current = filters;
    if (changed) setPage(1);
  });
}
