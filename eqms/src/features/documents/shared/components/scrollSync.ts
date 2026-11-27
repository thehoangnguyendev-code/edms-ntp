/**
 * Keeps two editors on the same place while one is scrolled. Positions come from the bridge inside the Document Server (deploy/onlyoffice/eqms-scroll-bridge.js), at 100 % zoom.
 * The distance between the two is fixed when synchronising starts, so a reader can align two passages, then turn it on again and keep that alignment; reaching the end of
 * the shorter file does not shift it.
 */
export type PaneIndex = 0 | 1;

export interface PanePosition {
  y: number;
  max: number;
}

export const createScrollSync = (move: (pane: PaneIndex, y: number) => void) => {
  const positions: [PanePosition, PanePosition] = [{ y: 0, max: 0 }, { y: 0, max: 0 }];
  let offset = 0; // right minus left
  let enabled = true;

  return {
    setEnabled(next: boolean) {
      if (next && !enabled) offset = positions[1].y - positions[0].y;
      enabled = next;
    },
    /** The starting point of a pane (its "ready" message): nothing is moved. */
    start(pane: PaneIndex, position: PanePosition) {
      positions[pane] = position;
    },
    /** A pane reports that it moved or that its length changed. */
    report(pane: PaneIndex, position: PanePosition) {
      const moved = Math.abs(position.y - positions[pane].y) > 0.5;
      positions[pane] = position;
      if (!moved || !enabled) return;
      const other: PaneIndex = pane === 0 ? 1 : 0;
      const wanted = pane === 0 ? position.y + offset : position.y - offset;
      const target = Math.max(0, Math.min(wanted, positions[other].max));
      positions[other] = { ...positions[other], y: target };
      move(other, target);
    },
  };
};
