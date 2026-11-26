/**
 * The last two screens the person was on, kept only so a "Leave without saving?" question can name where Back goes: Back is a step in the history, not a path. Only the address is kept, in memory.
 */
let current: string | undefined;
let previous: string | undefined;

/** Called by the shell on every change of address. A reload of the same address is not a step. */
export function recordRoute(pathname: string) {
  if (pathname === current) return;
  previous = current;
  current = pathname;
}

/** The screen before the current one, when this session has seen one. */
export function previousRoute(): string | undefined {
  return previous;
}
