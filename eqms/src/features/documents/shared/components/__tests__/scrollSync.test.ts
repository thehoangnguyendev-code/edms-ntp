import { describe, expect, it, vi } from "vitest";
import { createScrollSync } from "../scrollSync";

const started = () => {
  const move = vi.fn();
  const sync = createScrollSync(move);
  sync.start(0, { y: 0, max: 1000 });
  sync.start(1, { y: 0, max: 600 });
  return { move, sync };
};

describe("scroll synchronisation", () => {
  it("moves the other pane by the same place, from either side", () => {
    const { move, sync } = started();
    sync.report(0, { y: 200, max: 1000 });
    expect(move).toHaveBeenLastCalledWith(1, 200);
    sync.report(1, { y: 300, max: 600 });
    expect(move).toHaveBeenLastCalledWith(0, 300);
  });

  it("stops at the end of the shorter file and does not drift on the way back", () => {
    const { move, sync } = started();
    sync.report(0, { y: 900, max: 1000 });
    expect(move).toHaveBeenLastCalledWith(1, 600);
    sync.report(0, { y: 100, max: 1000 });
    expect(move).toHaveBeenLastCalledWith(1, 100);
  });

  it("keeps the alignment made while it was off", () => {
    const { move, sync } = started();
    sync.setEnabled(false);
    sync.report(1, { y: 150, max: 600 });
    expect(move).not.toHaveBeenCalled();
    sync.setEnabled(true);
    sync.report(0, { y: 100, max: 1000 });
    expect(move).toHaveBeenLastCalledWith(1, 250);
  });

  it("ignores a change of length that moved nothing", () => {
    const { move, sync } = started();
    sync.report(0, { y: 0, max: 1200 });
    expect(move).not.toHaveBeenCalled();
  });
});
