import { useRef } from "react";

/**
 * The latest non-empty value, kept after the value becomes null/undefined. A modal whose content is chosen by the parent
 * (`{item && <Modal .../>}`) vanishes the instant the item is cleared, so its closing animation never plays. Keep the modal
 * mounted, drive `isOpen` with the live value, and render its text from this retained one: the modal can then fade out still
 * showing what it showed.
 */
export function useRetainedValue<T>(value: T | null | undefined): T | null {
  const retained = useRef<T | null>(null);
  if (value != null) retained.current = value;
  return retained.current;
}
