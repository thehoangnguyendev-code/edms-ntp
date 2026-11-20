import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";

type Row = { id: string; name: string };
const columns: DataTableColumn<Row>[] = [{ id: "name", header: "Name", cell: (row) => row.name }];
const make = (...ids: string[]): Row[] => ids.map((id) => ({ id, name: `Row ${id}` }));
const motion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({
  matches: reduce && query.includes("reduce"), media: query, onchange: null,
  addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
}));

const table = (rows: Row[], isLoading = false) => <DataTable rows={rows} columns={columns} getRowKey={(row) => row.id} isLoading={isLoading} />;
const row = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`tr[data-table-row="${id}"]`) as HTMLElement;
const settled = (container: HTMLElement, ids: string[]) => ids.every((id) => row(container, id).style.opacity === "");

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("table row entrance", () => {
  it("fades the first rows in, hidden before the first paint, and leaves no style behind", async () => {
    motion(false);
    const { container } = render(table(make("a", "b", "c")));

    expect(["a", "b", "c"].every((id) => row(container, id).style.opacity === "0")).toBe(true);
    await waitFor(() => expect(settled(container, ["a", "b", "c"])).toBe(true), { timeout: 4000 });
  });

  it("fades in the rows of a new page, but not when the same rows come again", async () => {
    motion(false);
    const { container, rerender } = render(table(make("a", "b")));
    await waitFor(() => expect(settled(container, ["a", "b"])).toBe(true), { timeout: 4000 });

    rerender(table(make("a", "b"))); // a refresh with the same rows
    expect(settled(container, ["a", "b"])).toBe(true);

    rerender(table(make("c", "d"))); // the next page
    expect(["c", "d"].every((id) => row(container, id).style.opacity === "0")).toBe(true);
    await waitFor(() => expect(settled(container, ["c", "d"])).toBe(true), { timeout: 4000 });
  });

  it("fades in only the row that was added to what is shown", async () => {
    motion(false);
    const { container, rerender } = render(table(make("a", "b")));
    await waitFor(() => expect(settled(container, ["a", "b"])).toBe(true), { timeout: 4000 });

    rerender(table(make("n", "a", "b")));

    expect(row(container, "n").style.opacity).toBe("0");
    expect(settled(container, ["a", "b"])).toBe(true);
    await waitFor(() => expect(settled(container, ["n"])).toBe(true), { timeout: 4000 });
  });

  it("does not play for a sort, the same rows in another order", async () => {
    motion(false);
    const { container, rerender } = render(table(make("a", "b", "c")));
    await waitFor(() => expect(settled(container, ["a", "b", "c"])).toBe(true), { timeout: 4000 });

    rerender(table(make("c", "b", "a")));

    expect(settled(container, ["a", "b", "c"])).toBe(true);
  });

  it("keeps the old rows still while the next page is being fetched", async () => {
    motion(false);
    const { container, rerender } = render(table(make("a", "b")));
    await waitFor(() => expect(settled(container, ["a", "b"])).toBe(true), { timeout: 4000 });

    rerender(table(make("a", "b"), true)); // loading: the rows on screen are kept

    expect(settled(container, ["a", "b"])).toBe(true);
  });

  it("moves nothing when the person asked for reduced motion", () => {
    motion(true);
    const { container, rerender } = render(table(make("a", "b")));
    expect(settled(container, ["a", "b"])).toBe(true);

    rerender(table(make("c", "d")));
    expect(settled(container, ["c", "d"])).toBe(true);
  });
});
