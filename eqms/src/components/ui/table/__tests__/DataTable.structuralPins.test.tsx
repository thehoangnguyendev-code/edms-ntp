import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { ToastProvider } from "@/components/ui/toast/Toast";

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }));
vi.mock("@/services/api/tablePreferences", () => ({ tablePreferencesApi: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "pin-user" } }) }));

const columns: DataTableColumn<{ id: string }>[] = [
  { id: "expand", header: "", label: "Expand", locked: true, cell: () => "+" },
  { id: "no", header: "No.", locked: true, cell: () => "1" },
  { id: "name", header: "Name", cell: () => "Record" },
];
const saved = [
  { id: "expand", visible: true, order: 0, pinned: false },
  { id: "no", visible: true, order: 1, pinned: false },
  { id: "name", visible: true, order: 2, pinned: false },
];
const view = () => <ToastProvider><DataTable rows={[{ id: "r1" }]} columns={columns} getRowKey={(row) => row.id} customizable={{ tableKey: "structural.pins" }} /></ToastProvider>;

beforeEach(() => {
  api.get.mockReset().mockResolvedValue(saved);
  api.save.mockReset().mockResolvedValue(undefined);
  api.reset.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, onchange: null, dispatchEvent: () => false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as typeof window.matchMedia;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(48);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("structural column pins", () => {
  it("saves No. and Expand independently, measures offsets and restores them after remount", async () => {
    const first = render(view());
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Custom Column" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pin Expand" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin No." }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("structural.pins", [
      { ...saved[0], pinned: true }, { ...saved[1], pinned: true }, saved[2],
    ]));
    await waitFor(() => expect(screen.getByText("1").closest("td")).toHaveStyle({ position: "sticky", left: "48px" }));
    expect(screen.getByText("+").closest("td")).toHaveStyle({ position: "sticky", left: "0px" });
    api.get.mockResolvedValue(api.save.mock.calls[0][1]);
    first.unmount();
    render(view());
    await waitFor(() => expect(screen.getByText("1").closest("td")).toHaveAttribute("data-pinned", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Custom Column" }));
    fireEvent.click(await screen.findByRole("button", { name: "Unpin Expand" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByText("+").closest("td")).not.toHaveAttribute("data-pinned"));
    expect(screen.getByText("1").closest("td")).toHaveStyle({ position: "sticky", left: "0px" });
  });

  it("rolls back the pin when the server refuses the save", async () => {
    api.save.mockRejectedValue(new Error("offline"));
    render(view());
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Custom Column" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pin No." }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Column layout not saved");
    expect(screen.getByText("1").closest("td")).not.toHaveAttribute("data-pinned");
  });

  it("does not fix columns or offer the desktop customizer on mobile", async () => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, dispatchEvent: () => false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as typeof window.matchMedia;
    api.get.mockResolvedValue(saved.map((column) => ({ ...column, pinned: true })));
    render(view());
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Custom Column" })).toBeNull();
    expect(screen.getByText("1").closest("td")).not.toHaveAttribute("data-pinned");
    expect(screen.getByText("+").closest("td")).not.toHaveAttribute("data-pinned");
  });
});
