import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

type Row = { id: string; name: string };
const columns: DataTableColumn<Row>[] = [{ id: "name", header: "Name", cell: (row) => row.name }];
const loading = <div>Loading block</div>;
const view = (rows: Row[], isLoading: boolean) => (
  <ToastProvider>
    <DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} isLoading={isLoading} loadingContent={loading} emptyState={<div>Nothing</div>} pagination={<div>Pager</div>} />
  </ToastProvider>
);

afterEach(cleanup);

describe("DataTable while the next rows are fetched", () => {
  it("shows the loading block on the first load, when there is nothing to keep", () => {
    render(view([], true));
    expect(screen.getByText("Loading block")).toBeTruthy();
  });

  it("keeps the rows and the pager on screen (busy) instead of the loading block on a reload", () => {
    const { rerender } = render(view([{ id: "1", name: "First" }], false));
    rerender(view([], true));
    expect(screen.queryByText("Loading block")).toBeNull();
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Pager")).toBeTruthy();
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("shows the new rows, no longer busy, when the answer arrives", () => {
    const { rerender } = render(view([{ id: "1", name: "First" }], false));
    rerender(view([], true));
    rerender(view([{ id: "2", name: "Second" }], false));
    expect(screen.queryByText("First")).toBeNull();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
  });
});
