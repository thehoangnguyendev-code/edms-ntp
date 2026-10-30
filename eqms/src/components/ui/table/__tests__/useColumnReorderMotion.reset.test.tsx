import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }));
vi.mock("@/services/api/tablePreferences", () => ({ tablePreferencesApi: api }));

type Row = { id: string; a: string; b: string; c: string };
const rows: Row[] = [{ id: "r1", a: "A1", b: "B1", c: "C1" }];
const columns: DataTableColumn<Row>[] = [
  { id: "no", header: "No.", locked: true, cell: () => "1" },
  { id: "a", header: "Alpha", cell: (r) => r.a },
  { id: "b", header: "Bravo", cell: (r) => r.b },
  { id: "c", header: "Charlie", cell: (r) => r.c },
];
const animate = vi.fn();
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

beforeEach(() => {
  animate.mockReset();
  api.get.mockReset().mockResolvedValue([
    { id: "no", visible: true, order: 0, pinned: true }, { id: "c", visible: true, order: 1, pinned: false },
    { id: "a", visible: true, order: 2, pinned: false }, { id: "b", visible: true, order: 3, pinned: false },
  ]);
  api.reset.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const index = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
    return { left: this.tagName === "TH" ? index * 100 : 0, top: 0, right: 0, bottom: 0, width: 100, height: 20, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
});
afterEach(cleanup);

describe("Reset to default", () => {
  it("moves the columns back to their default places with the same motion as Apply", async () => {
    render(<ToastProvider><DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} customizable={{ tableKey: "t" }} /></ToastProvider>);
    await waitFor(() => expect(screen.getAllByRole("columnheader").map((h) => h.textContent?.trim())).toEqual(["No.", "Charlie", "Alpha", "Bravo"]));
    await wait(40);

    fireEvent.click(screen.getByRole("button", { name: /Custom Column/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Reset to Default" }));

    await waitFor(() => expect(screen.getAllByRole("columnheader").map((h) => h.textContent?.trim())).toEqual(["No.", "Alpha", "Bravo", "Charlie"]));
    expect(animate).toHaveBeenCalled();
  });
});

describe("Custom Column drawer", () => {
  it("does not list the Expand column of the table, only the columns a person arranges", async () => {
    const withExpand: DataTableColumn<Row>[] = [{ id: "expand", header: "", label: "Expand", locked: true, cell: () => "+" }, ...columns];
    render(<ToastProvider><DataTable rows={rows} columns={withExpand} getRowKey={(r) => r.id} customizable={{ tableKey: "t2" }} /></ToastProvider>);
    await waitFor(() => expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(3));

    fireEvent.click(screen.getByRole("button", { name: /Custom Column/ }));
    await screen.findByRole("button", { name: "Reset to Default" });

    expect(screen.getAllByText("No.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Expand")).toBeNull();
    expect(screen.getAllByRole("columnheader").length).toBe(5);
  });
});
