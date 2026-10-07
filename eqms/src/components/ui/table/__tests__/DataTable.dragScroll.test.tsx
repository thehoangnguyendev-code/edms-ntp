import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

type Row = { id: string; name: string };
const rows: Row[] = [{ id: "r1", name: "First" }];
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

const scrollerOf = (container: HTMLElement) => container.querySelector(".overflow-x-auto") as HTMLDivElement;

describe("DataTable drag to scroll", () => {
  it("scrolls sideways by dragging the table, on any screen, without the screen having to wire anything", () => {
    const { container } = render(
      <ToastProvider>
        <DataTable rows={rows} columns={columns} getRowKey={(row) => row.id} />
      </ToastProvider>,
    );
    const scroller = scrollerOf(container);
    scroller.scrollLeft = 0;

    fireEvent.mouseDown(scroller, { button: 0, clientX: 300, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 200, clientY: 10 });

    // Dragged 100 px to the left: the content moves 100 px.
    expect(scroller.scrollLeft).toBe(100);
    expect(scroller.className).toContain("cursor-grabbing");

    fireEvent.mouseUp(scroller, { clientX: 200, clientY: 10 });
    expect(scroller.className).not.toContain("cursor-grabbing");
  });

  it("does not take over a press that starts on a button, so clicks still work", () => {
    const { container, getByRole } = render(
      <ToastProvider>
        <DataTable rows={rows} columns={[{ id: "act", header: "Act", cell: () => <button type="button">Go</button> }]} getRowKey={(row) => row.id} />
      </ToastProvider>,
    );
    const scroller = scrollerOf(container);
    scroller.scrollLeft = 0;

    fireEvent.mouseDown(getByRole("button", { name: "Go" }), { button: 0, clientX: 300, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 100, clientY: 10 });

    expect(scroller.scrollLeft).toBe(0);
  });

  it("leaves a screen that runs its own useTableDragScroll in charge (no second set of handlers)", () => {
    const onMouseDown = vi.fn();
    const { container } = render(
      <ToastProvider>
        <DataTable rows={rows} columns={columns} getRowKey={(row) => row.id} scrollProps={{ onMouseDown }} isDragging={false} />
      </ToastProvider>,
    );
    const scroller = scrollerOf(container);
    scroller.scrollLeft = 0;

    fireEvent.mouseDown(scroller, { button: 0, clientX: 300, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 100, clientY: 10 });

    expect(onMouseDown).toHaveBeenCalledTimes(1);
    expect(scroller.scrollLeft).toBe(0);
  });
});
