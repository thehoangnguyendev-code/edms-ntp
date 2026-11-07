import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "../breadcrumb/Breadcrumb";
import { TablePagination } from "../table/TablePagination";

/**
 * jsdom has no layout. The room is a number set here, and what the element needs is 10 pixels for each character it shows, so the
 * test can say "a box of 400 pixels" and see what the control gives up to fit it.
 */
let room = 2000;
const original = {
  client: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
  scroll: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth"),
};

beforeEach(() => {
  room = 2000;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => room });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get() { return (this as HTMLElement).textContent!.length * 10; } });
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
});
afterEach(() => {
  cleanup();
  if (original.client) Object.defineProperty(HTMLElement.prototype, "clientWidth", original.client); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  if (original.scroll) Object.defineProperty(HTMLElement.prototype, "scrollWidth", original.scroll); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
});

const pagination = () => render(<TablePagination currentPage={3} totalPages={113} totalItems={1124} itemsPerPage={10} onPageChange={vi.fn()} onItemsPerPageChange={vi.fn()} />);

describe("TablePagination fits the room it has", () => {
  it("shows everything, with the page numbers, when there is room", () => {
    room = 900;
    pagination();
    expect(screen.getByText("results", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Show:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "113" })).toBeInTheDocument();
    expect(screen.queryByText("3/113")).toBeNull();
  });

  it("swaps the page numbers for 3/113 before it gives up anything else", () => {
    room = 560;
    pagination();
    expect(screen.queryByRole("button", { name: "113" })).toBeNull();
    expect(screen.getByText("3/113")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByText("results", { exact: false })).toBeInTheDocument();
  });

  it("then turns Previous and Next into arrows, then drops the word results, then the word Show", () => {
    room = 420;
    const { unmount } = pagination();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.getByText("results", { exact: false })).toBeInTheDocument();
    unmount();

    room = 340;
    const second = pagination();
    expect(screen.queryByText("results", { exact: false })).toBeNull();
    expect(screen.getByText("Show:")).toBeInTheDocument();
    second.unmount();

    room = 250;
    pagination();
    expect(screen.queryByText("Show:")).toBeNull();
    expect(screen.getByText("3/113")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("never lets its content wrap: the row is one line that clips instead", () => {
    room = 900;
    const { container } = pagination();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("whitespace-nowrap");
    expect(root.className).toContain("overflow-hidden");
    expect(root.className).not.toContain("flex-wrap");
  });
});

const items = [
  { label: "Dashboard", onClick: vi.fn() },
  { label: "Training Management", onClick: vi.fn() },
  { label: "Training Programme", onClick: vi.fn() },
  { label: "Training Requirements", onClick: vi.fn() },
  { label: "Training Requirement Details", isActive: true },
];

describe("Breadcrumb fits the room it has", () => {
  it("shows every label when there is room", () => {
    room = 2000;
    render(<Breadcrumb items={items} />);
    expect(screen.getByText("Training Management")).toBeInTheDocument();
    expect(screen.getByText("Training Programme")).toBeInTheDocument();
    expect(screen.getByText("Training Requirement Details")).toBeInTheDocument();
  });

  it("turns the middle labels into ... when they do not fit, and keeps the page you are on", () => {
    room = 330;
    render(<Breadcrumb items={items} />);
    expect(screen.queryByText("Training Management")).toBeNull();
    expect(screen.queryByText("Training Programme")).toBeNull();
    expect(screen.getAllByText("...").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Training Requirement Details")).toBeInTheDocument();
  });

  it("cuts the last label with an ellipsis, with the whole name in the tooltip, when even that does not fit", () => {
    room = 150;
    render(<Breadcrumb items={items} />);
    const last = screen.getByText("Training Requirement Details");
    expect(last.className).toContain("truncate");
    expect(last).toHaveAttribute("title", "Training Requirement Details");
  });

  it("is as wide as its parent and clips, so it can never run under the controls beside it", () => {
    const { container } = render(<Breadcrumb items={items} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("w-full");
    expect(root.className).toContain("min-w-0");
    expect(root.className).toContain("overflow-hidden");
  });
});
