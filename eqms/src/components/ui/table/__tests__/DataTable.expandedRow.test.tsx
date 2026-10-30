import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { motion } from "framer-motion";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

type Row = { id: string; name: string };
const rows: Row[] = [{ id: "r1", name: "First" }, { id: "r2", name: "Second" }];
const columns: DataTableColumn<Row>[] = [{ id: "name", header: "Name", cell: (row) => row.name }];

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const table = (expandedId: string | null, asRow: boolean) => (
  <ToastProvider>
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      expandedRow={{
        isExpanded: (row) => row.id === expandedId,
        render: (row) => (asRow ? <span>detail of {row.name}</span> : <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><td>raw detail of {row.name}</td></motion.tr>),
        asRow,
      }}
    />
  </ToastProvider>
);

describe("DataTable detail row motion", () => {
  it("keeps the record stripe order when an expanded row is inserted", () => {
    render(table("r1", true));
    expect(screen.getByText("First").closest("tr")).toHaveAttribute("data-record-stripe", "false");
    expect(screen.getByText("Second").closest("tr")).toHaveAttribute("data-record-stripe", "true");
    expect(screen.getByText("detail of First").closest("tr")).not.toHaveAttribute("data-record-stripe");
  });
  it.each([[true, "detail of First"], [false, "raw detail of First"]])(
    "opens at once and, when closed, stays for its closing motion before it is removed (content-only detail: %s; the row owns its motion otherwise, as the expand rows do)",
    async (asRow, text) => {
      const view = render(table(null, asRow));
      expect(screen.queryByText(text)).toBeNull();

      view.rerender(table("r1", asRow));
      expect(screen.getByText(text)).toBeInTheDocument();

      view.rerender(table(null, asRow));
      // Not removed in the same instant: it is leaving (the closing motion is running) ...
      expect(screen.getByText(text)).toBeInTheDocument();
      // ... and is gone once that has finished.
      await waitFor(() => expect(screen.queryByText(text)).toBeNull());
    },
  );

  it("opening one row and then another closes the first with its motion", async () => {
    const view = render(table("r1", true));
    expect(screen.getByText("detail of First")).toBeInTheDocument();

    view.rerender(table("r2", true));

    expect(screen.getByText("detail of Second")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("detail of First")).toBeNull());
  });
});
