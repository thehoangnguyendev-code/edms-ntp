import { useLayoutEffect, useRef, type MutableRefObject } from "react";
import { useReducedMotion } from "framer-motion";

const DURATION_MS = 600;
// Longest a change may take, and how much a long way adds: 450 ms plus 0.8 ms for each pixel the farthest column travels (600 ms for 190 px, 1.2 s for 940 px).
const MAX_DURATION_MS = 1400;
const MIN_TRAVEL_MS = 450;
const MS_PER_PIXEL = 0.8;
const EASING = "cubic-bezier(0.45, 0, 0.2, 1)";
// The layout is applied from a drawer that closes in about this time. The columns stay where they were (fill: backwards) until it has closed and then move,
// so the person sees the motion on the table and not behind the drawer.
const START_DELAY_MS = 300;

/** What the Custom Column control calls the moment the person presses Apply or Reset: it notes where the columns are before the layout changes. */
export interface ColumnMotionHandle {
  capture: () => void;
}

// Set localStorage "eqms.debug.columns" to 1 to see in the console what the motion decided (for a report of a motion that did not play).
const debug = (...values: unknown[]) => {
  try {
    if (window.localStorage.getItem("eqms.debug.columns")) console.debug("[column-motion]", ...values);
  } catch {
    /* storage blocked */
  }
};

/** Where the header cells are, measured on the content of the scroller so that scrolling does not change them. */
function measure(root: HTMLElement): Map<string, number> {
  const origin = root.getBoundingClientRect().left - root.scrollLeft;
  const out = new Map<string, number>();
  root.querySelectorAll<HTMLElement>("th[data-table-col]").forEach((cell) => {
    const id = cell.getAttribute("data-table-col");
    if (id) out.set(id, cell.getBoundingClientRect().left - origin);
  });
  return out;
}

/**
 * Moves the columns to their new place when the person applies a new Custom Column layout: each column slides from where it was to where it is, and a column that
 * was hidden fades in. It runs only when `token` changes (a layout the person applied or reset), never when the data of the table changes, and not at all for a person who asks
 * for less motion. Where the columns were is measured once a frame after every render, so it is up to date when the layout changes. Pinned columns are not moved while the
 * table is scrolled sideways, because a pinned column does not scroll with the table.
 */
export function useColumnReorderMotion(root: HTMLElement | null, pinnedIds: string[], token: number | undefined, handle?: MutableRefObject<ColumnMotionHandle | null>) {
  const reduce = useReducedMotion();
  const before = useRef<Map<string, number>>(new Map());
  const seen = useRef(token);
  const frame = useRef(0);

  // The control asks for the positions at the moment of the press, so they never depend on when the last frame was measured.
  useLayoutEffect(() => {
    if (!root || !handle) return;
    handle.current = { capture: () => { before.current = measure(root); debug("captured", before.current.size, "columns"); } };
    return () => { handle.current = null; };
  }, [root, handle]);

  useLayoutEffect(() => {
    if (!root) return;
    if (token !== seen.current) {
      debug("layout changed", { token, before: before.current.size, reduce, animate: typeof Element !== "undefined" && typeof Element.prototype.animate });
      seen.current = token;
      if (!reduce && typeof Element !== "undefined" && typeof Element.prototype.animate === "function" && before.current.size > 0) {
        const after = measure(root);
        const scrolled = root.scrollLeft > 0;
        const moves: { id: string; distance: number }[] = [];
        const appearing: string[] = [];
        after.forEach((left, id) => {
          const previous = before.current.get(id);
          if (previous === undefined) { appearing.push(id); return; }
          const distance = previous - left;
          if (Math.abs(distance) >= 1 && !(scrolled && pinnedIds.includes(id))) moves.push({ id, distance });
        });
        // One duration for all the columns of this change, longer when the farthest column has far to go (a reset moves many columns across the table):
        // a column that travels far then moves at the speed of one that travels a little, and the whole table settles together.
        const farthest = moves.reduce((max, move) => Math.max(max, Math.abs(move.distance)), 0);
        const duration = Math.min(MAX_DURATION_MS, Math.max(DURATION_MS, MIN_TRAVEL_MS + farthest * MS_PER_PIXEL));
        debug("moving", { moves: moves.length, appearing: appearing.length, duration, farthest });
        const timing: KeyframeAnimationOptions = { duration, delay: START_DELAY_MS, easing: EASING, fill: "backwards" };
        const cellsOf = (id: string) => Array.from(root.querySelectorAll<HTMLElement>("[data-table-col]")).filter((cell) => cell.getAttribute("data-table-col") === id);
        appearing.forEach((id) => cellsOf(id).forEach((cell) => cell.animate([{ opacity: 0 }, { opacity: 1 }], timing)));
        moves.forEach(({ id, distance }) => cellsOf(id).forEach((cell) => cell.animate([{ transform: `translateX(${distance}px)` }, { transform: "translateX(0)" }], timing)));
      }
    }
  });

  // Remember where the columns are, once a frame after the last render and after the window was resized.
  useLayoutEffect(() => {
    if (!root) return;
    const remember = () => {
      window.cancelAnimationFrame(frame.current);
      frame.current = window.requestAnimationFrame(() => { before.current = measure(root); });
    };
    remember();
    window.addEventListener("resize", remember);
    return () => {
      window.cancelAnimationFrame(frame.current);
      window.removeEventListener("resize", remember);
    };
  });
}
