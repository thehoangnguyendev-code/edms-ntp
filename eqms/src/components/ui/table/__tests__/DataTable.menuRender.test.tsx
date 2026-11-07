import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "../DataTable";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { closeMenuRenderGate, menuRenderGateOpen, menuTouchesRow, openMenuRenderGate } from "../rowRenderGate";

type Row = { id: string; name: string };
const ROWS: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, name: `Name ${i}` }));

/** How many times each row's name cell was rendered. */
let renders: Record<string, number>;

function Screen({ rows = ROWS }: { rows?: Row[] }) {
  const menu = usePortalDropdown();
  const [suffix, setSuffix] = useState("");
  const columns: DataTableColumn<Row>[] = [
    { id: "name", header: "Name", cell: (row) => { renders[row.id] = (renders[row.id] ?? 0) + 1; return <span>{row.name}{suffix}</span>; } },
  ];
  const open = rows.find((row) => row.id === menu.openId);
  return (
    <div>
      <button type="button" onClick={() => setSuffix((value) => `${value}!`)}>Change something else</button>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        columns={columns}
        action={{ cell: (row) => (
          <button type="button" ref={menu.getRef(row.id)} aria-label={`More actions ${row.id}`} aria-expanded={menu.openId === row.id} onClick={(event) => menu.toggle(row.id, event)}>
            <MoreVertical className="h-4 w-4" />
          </button>
        ) }}
      />
      <PortalDropdownMenu isOpen={!!open} onClose={menu.close} position={menu.position}>
        {open && <div className="py-1"><DropdownMenuItem onClick={menu.close}>View {open.name}</DropdownMenuItem></div>}
      </PortalDropdownMenu>
    </div>
  );
}

beforeEach(() => {
  renders = {};
  closeMenuRenderGate();
  window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: true, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) as MediaQueryList);
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

const total = () => Object.values(renders).reduce((sum, value) => sum + value, 0);
const flush = () => act(async () => { await Promise.resolve(); });

describe("opening a row menu does not render the whole table again", () => {
  it("renders only the row that opens, not the other rows", async () => {
    render(<Screen />);
    expect(total()).toBeGreaterThanOrEqual(ROWS.length); // the table renders its rows again once its scroller is mounted
    renders = {};

    fireEvent.click(screen.getByLabelText("More actions r20"));
    await flush();

    expect(await screen.findByText("View Name 20")).toBeInTheDocument();
    expect(renders.r20).toBe(1);
    expect(total()).toBeLessThanOrEqual(2); // the row that opens (and, at most, the one that closes)
    expect(screen.getByLabelText("More actions r20")).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the row that was open and the row that opens, so neither shows a stale state", async () => {
    render(<Screen />);
    fireEvent.click(screen.getByLabelText("More actions r5"));
    await flush();
    expect(screen.getByLabelText("More actions r5")).toHaveAttribute("aria-expanded", "true");
    renders = {};

    fireEvent.click(screen.getByLabelText("More actions r30"));
    await flush();

    expect(screen.getByLabelText("More actions r5")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("More actions r30")).toHaveAttribute("aria-expanded", "true");
    expect(renders.r5).toBe(1);
    expect(renders.r30).toBe(1);
    expect(total()).toBe(2);
  });

  it("renders every row again for any other change, and the gate does not stay open after a menu", async () => {
    render(<Screen />);
    fireEvent.click(screen.getByLabelText("More actions r10"));
    await flush();
    expect(menuRenderGateOpen()).toBe(false); // closed after the table committed
    renders = {};

    fireEvent.click(screen.getByText("Change something else"));
    await flush();

    expect(total()).toBe(ROWS.length);
    expect(screen.getByText("Name 0!")).toBeInTheDocument();
    expect(screen.getByText("Name 39!")).toBeInTheDocument();
  });

  it("renders a row whose data changed, even in a render that opens a menu", async () => {
    const { rerender } = render(<Screen />);
    renders = {};
    openMenuRenderGate(["r1"]);
    rerender(<Screen rows={ROWS.map((row) => (row.id === "r7" ? { ...row, name: "Renamed" } : row))} />);
    await flush();

    expect(renders.r7).toBe(1);
    expect(screen.getByText("Renamed")).toBeInTheDocument();
  });
});

describe("the gate", () => {
  it("names the rows it touches and closes", () => {
    openMenuRenderGate(["a", null, undefined, "b"]);
    expect(menuRenderGateOpen()).toBe(true);
    expect(menuTouchesRow("a")).toBe(true);
    expect(menuTouchesRow("b")).toBe(true);
    expect(menuTouchesRow("c")).toBe(false);
    closeMenuRenderGate();
    expect(menuRenderGateOpen()).toBe(false);
    expect(menuTouchesRow("a")).toBe(false);
  });

  it("expires by itself when no table commits", () => {
    openMenuRenderGate(["a"]);
    const realNow = performance.now.bind(performance);
    performance.now = () => realNow() + 1000;
    try {
      expect(menuRenderGateOpen()).toBe(false);
    } finally {
      performance.now = realNow;
    }
  });
});

describe("a row that was left as it was still opens and closes its menu correctly", () => {
  it("closes the menu of a row on the second click, and a skipped row opens another menu in one click", async () => {
    render(<Screen />);
    fireEvent.click(screen.getByLabelText("More actions r3"));
    await flush();
    expect(screen.getByLabelText("More actions r3")).toHaveAttribute("aria-expanded", "true");

    // r25 was not rendered again when r3 opened: its button still holds the toggle of the earlier render.
    fireEvent.click(screen.getByLabelText("More actions r25"));
    await flush();
    expect(screen.getByLabelText("More actions r3")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("More actions r25")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByLabelText("More actions r25"));
    await flush();
    expect(screen.getByLabelText("More actions r25")).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(screen.queryByText("View Name 25")).toBeNull()); // after the closing motion
  });
});
