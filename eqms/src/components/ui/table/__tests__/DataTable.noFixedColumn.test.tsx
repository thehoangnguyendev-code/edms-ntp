import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast/Toast";

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }));
vi.mock("@/services/api/tablePreferences", () => ({ tablePreferencesApi: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import { DataTable, useCustomColumnLayout, type DataTableColumn } from "../DataTable";
import { TableMarkup as T } from "../TablePrimitives";

type Row = { id: string; name: string; phone: string };
const rows: Row[] = [{ id: "r1", name: "An", phone: "0901" }];
const columns: DataTableColumn<Row>[] = [
  { id: "no", header: "No.", locked: true, cell: (_row, index) => index + 1 },
  { id: "name", header: "Name", cell: (row) => row.name },
  { id: "phone", header: "Phone", cell: (row) => row.phone },
];

function Screen() {
  const { layout } = useCustomColumnLayout("t", columns);
  return <DataTable rows={rows} columns={columns} columnLayout={layout} getRowKey={(row) => row.id} />;
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue([{ id: "no", visible: true, order: 0, pinned: true }, { id: "name", visible: true, order: 1, pinned: true }, { id: "phone", visible: true, order: 2, pinned: false }]);
  api.save.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("the No. column is not fixed", () => {
  it("scrolls with the table, while a column the person pinned stays fixed", async () => {
    render(<ToastProvider><Screen /></ToastProvider>);

    const name = await screen.findByText("An");
    await waitFor(() => expect(name.closest("td")).toHaveAttribute("data-pinned", "true"));
    expect(name.closest("td")!.style.position).toBe("sticky");
    expect(name.closest("td")!.style.left).toBe("0px"); // the first fixed column starts at the edge: nothing fixed stands before it

    const number = screen.getByText("1").closest("td")!;
    expect(number.style.position).toBe("");
    expect(number).not.toHaveAttribute("data-pinned");
    expect(screen.getByRole("columnheader", { name: "No." }).style.position).toBe("");
    expect(screen.getByText("0901").closest("td")!.style.position).toBe("");
  });

  it("does not fix a No. column of a plain table either, nor the selection column before it", () => {
    render(
      <T.Root aria-label="Records"><T.Head><T.Row><T.HeaderCell>Select</T.HeaderCell><T.HeaderCell>No.</T.HeaderCell><T.HeaderCell>Name</T.HeaderCell></T.Row></T.Head><T.Body>
        <T.Row><T.Cell><input aria-label="Select row" type="checkbox" /></T.Cell><T.Cell>1</T.Cell><T.Cell>An</T.Cell></T.Row>
      </T.Body></T.Root>,
    );

    for (const cell of [screen.getByRole("columnheader", { name: "No." }), screen.getByRole("columnheader", { name: "Select" }), screen.getByText("1"), screen.getByLabelText("Select row").closest("td")!]) {
      expect(cell).not.toHaveAttribute("data-number-sticky");
      expect(cell.style.position).toBe("");
    }
  });
});
