import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

type Row = { id: string; name: string };
const rows: Row[] = [{ id: "r1", name: "First" }];
const columns: DataTableColumn<Row>[] = [{ id: "name", header: "Name", cell: (row) => row.name }];
let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
const paint = () => act(() => {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach(callback => callback(0));
});
const originalCaret = document.caretRangeFromPoint;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.caretRangeFromPoint = originalCaret;
});

beforeEach(() => {
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
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
    paint();

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

  it("lets the native scrollbar own its gesture without moving the content a second time", () => {
    const { container } = render(<ToastProvider><DataTable rows={rows} columns={columns} getRowKey={row => row.id} /></ToastProvider>);
    const scroller = scrollerOf(container);
    Object.defineProperties(scroller, { clientWidth: { value: 400 }, clientHeight: { value: 180 } });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 200 } as DOMRect);
    fireEvent.mouseDown(scroller, { button: 0, clientX: 300, clientY: 190 });
    // Simulate the browser moving its thumb; the drag handler must leave this value alone.
    scroller.scrollLeft = 240;
    fireEvent.mouseMove(scroller, { clientX: 200, clientY: 190 });
    paint();
    expect(scroller.scrollLeft).toBe(240);
    expect(scroller).not.toHaveClass('cursor-grabbing');
  });

  it("coalesces pointer moves into one scroll write per frame and skips caret hit testing during dragging", () => {
    const { container } = render(<ToastProvider><DataTable rows={rows} columns={columns} getRowKey={row => row.id} /></ToastProvider>);
    const scroller = scrollerOf(container);
    const write = vi.fn();
    Object.defineProperty(scroller, 'scrollLeft', { configurable: true, get: () => 0, set: write });
    document.caretRangeFromPoint = vi.fn(() => null);
    fireEvent.mouseDown(scroller, { button: 0, clientX: 300, clientY: 10 });
    vi.mocked(document.caretRangeFromPoint).mockClear();
    fireEvent.mouseMove(scroller, { clientX: 280, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 240, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 200, clientY: 10 });
    expect(write).not.toHaveBeenCalled();
    expect(document.caretRangeFromPoint).not.toHaveBeenCalled();
    paint();
    expect(write).toHaveBeenCalledExactlyOnceWith(100);
  });

  it("flushes a quick release and still prevents accidental row clicks", () => {
    const clicked = vi.fn();
    const { container } = render(<ToastProvider><DataTable rows={rows} columns={columns} getRowKey={row => row.id} onRowClick={clicked} /></ToastProvider>);
    const scroller = scrollerOf(container);
    scroller.style.scrollBehavior = 'smooth';
    fireEvent.mouseDown(scroller, { button: 0, clientX: 300, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 200, clientY: 10 });
    expect(scroller.style.scrollBehavior).toBe('auto');
    fireEvent.mouseUp(scroller, { clientX: 200, clientY: 10 });
    expect(scroller.style.scrollBehavior).toBe('smooth');
    expect(scroller.scrollLeft).toBe(100);
    fireEvent.click(container.querySelector('tbody tr')!);
    expect(clicked).not.toHaveBeenCalled();
    paint();
    expect(scroller.scrollLeft).toBe(100);
  });

  it("cancels pending scroll work on unmount", () => {
    const { container, unmount } = render(<ToastProvider><DataTable rows={rows} columns={columns} getRowKey={row => row.id} /></ToastProvider>);
    const scroller = scrollerOf(container);
    fireEvent.mouseDown(scroller, { button: 0, clientX: 300, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 200, clientY: 10 });
    unmount();
    paint();
    expect(scroller.scrollLeft).toBe(0);
  });

  it("preserves native selection when the gesture starts on record text", () => {
    const { container, getByText } = render(<ToastProvider><DataTable rows={rows} columns={columns} getRowKey={row => row.id} /></ToastProvider>);
    const scroller = scrollerOf(container);
    const text = getByText('First');
    const caret = document.createRange();
    caret.setStart(text.firstChild!, 0);
    document.caretRangeFromPoint = vi.fn(() => caret);
    vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => [{ left: 100, right: 200, top: 0, bottom: 30 }],
    } as unknown as Range);
    fireEvent.mouseDown(text, { button: 0, clientX: 150, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 50, clientY: 10 });
    paint();
    expect(scroller.scrollLeft).toBe(0);
    expect(scroller).not.toHaveClass('cursor-grabbing');
  });
});
