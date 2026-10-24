import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

type Row = { id: string; a: string; b: string; c: string };
const rows: Row[] = [{ id: "r1", a: "A1", b: "B1", c: "C1" }];
const columns: DataTableColumn<Row>[] = [
  { id: "a", header: "Alpha", cell: (r) => r.a },
  { id: "b", header: "Bravo", cell: (r) => r.b },
  { id: "c", header: "Charlie", cell: (r) => r.c },
];

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());

describe("DataTable with a Custom Column layout", () => {
  it("shows the columns of the layout in its order and leaves out the one the user hid, even when the screen passes the default columns", () => {
    render(
      <ToastProvider>
        <DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} columnLayout={{ columns: [columns[2], columns[0]], pinnedIds: [] }} />
      </ToastProvider>,
    );

    expect(headers()).toEqual(["Charlie", "Alpha"]);
    expect(screen.queryByText("B1")).toBeNull();
  });

  it("shows the default columns when no layout is given", () => {
    render(<ToastProvider><DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} /></ToastProvider>);

    expect(headers()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});
