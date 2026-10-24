import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

type Row = { id: string; a: string; b: string; c: string };
const rows: Row[] = [{ id: "r1", a: "A1", b: "B1", c: "C1" }];
const all: DataTableColumn<Row>[] = [
  { id: "a", header: "Alpha", cell: (r) => r.a },
  { id: "b", header: "Bravo", cell: (r) => r.b },
  { id: "c", header: "Charlie", cell: (r) => r.c },
];
const pick = (...ids: string[]) => ids.map((id) => all.find((c) => c.id === id)!);

const animate = vi.fn();
const frame = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });

beforeEach(() => {
  animate.mockReset();
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  // Every header sits 100px to the right of the one before it, so a column that changes place has moved.
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const index = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
    return { left: this.tagName === "TH" ? index * 100 : 0, top: 0, right: 0, bottom: 0, width: 100, height: 20, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
});
afterEach(cleanup);

const table = (columns: DataTableColumn<Row>[], token: number) => (
  <ToastProvider><DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} columnLayout={{ columns, pinnedIds: [], reorderToken: token }} /></ToastProvider>
);

describe("column motion", () => {
  it("slides the columns that changed place when the person applies a new layout", async () => {
    const view = render(table(pick("a", "b", "c"), 0));
    await frame();

    view.rerender(table(pick("c", "a", "b"), 1));

    // Charlie moved from the third place to the first (header and cell), Alpha and Bravo each one place to the right.
    expect(animate).toHaveBeenCalledTimes(6);
    expect(animate.mock.calls.some(([frames]) => frames[0].transform === "translateX(200px)")).toBe(true);
    expect(animate.mock.calls.some(([frames]) => frames[0].transform === "translateX(-100px)")).toBe(true);
  });

  it("does not move anything when the order changes without the person applying a layout", async () => {
    const view = render(table(pick("a", "b", "c"), 0));
    await frame();

    view.rerender(table(pick("c", "a", "b"), 0));

    expect(animate).not.toHaveBeenCalled();
  });

  it("fades in a column that was hidden", async () => {
    const view = render(table(pick("a", "b"), 0));
    await frame();

    view.rerender(table(pick("a", "b", "c"), 1));

    expect(animate.mock.calls.some(([frames]) => frames[0].opacity === 0)).toBe(true);
  });

  it("takes longer when the columns have far to go, the same time for all of them", async () => {
    const wide: DataTableColumn<Row>[] = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, header: id.toUpperCase(), cell: () => id }));
    const view = render(table(wide, 0));
    await frame();

    view.rerender(table([...wide].reverse(), 1));

    // The farthest column travels 600 px: 450 + 0.8 * 600 = 930 ms, for every column.
    const durations = new Set(animate.mock.calls.map(([, options]) => options.duration));
    expect([...durations]).toEqual([930]);
  });

  it("keeps the base duration for a short move", async () => {
    const view = render(table(pick("a", "b", "c"), 0));
    await frame();

    view.rerender(table(pick("b", "a", "c"), 1));

    expect(new Set(animate.mock.calls.map(([, options]) => options.duration))).toEqual(new Set([600]));
  });
});
