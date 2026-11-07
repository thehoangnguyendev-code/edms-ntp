/**
 * Opening a row menu changes only the state of the menu (which row is open, where the menu sits). The screen that owns that state is rendered
 * again, and with it every row of its table: on a table of many rows that is the delay between the click on the three dots and the menu.
 *
 * `usePortalDropdown` opens this gate for the render that its own state change causes, naming the rows that the change touches (the row that was
 * open and the row that is opening). While the gate is open a data table does not render again a row whose data is the same object as before and
 * that the menu does not touch: nothing else changed in that render. The gate closes at the first commit after it opened (or after a short time
 * when no table commits), so every other render, whatever its cause, renders every row as usual.
 */
type Gate = { ids: Set<string>; until: number };

const WINDOW_MS = 200;
let gate: Gate | null = null;

/** Called by the code that changes the state of a menu, just before it sets that state. */
export function openMenuRenderGate(touched: ReadonlyArray<string | null | undefined>): void {
  gate = { ids: new Set(touched.filter((id): id is string => typeof id === 'string' && id.length > 0)), until: now() + WINDOW_MS };
}

/** True while the next render was caused only by a menu. */
export function menuRenderGateOpen(): boolean {
  if (!gate) return false;
  if (now() > gate.until) { gate = null; return false; }
  return true;
}

/** True when the menu change touches this row, so it has to be rendered again. */
export function menuTouchesRow(key: string | number | bigint): boolean {
  return gate?.ids.has(String(key)) ?? false;
}

/** Called after a table has committed: the render that the gate was opened for is done. */
export function closeMenuRenderGate(): void {
  gate = null;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
