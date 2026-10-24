import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }));
const auth = vi.hoisted(() => ({ userId: "u1" }));
vi.mock("@/services/api/tablePreferences", () => ({ tablePreferencesApi: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: auth.userId } }) }));

import { useTableColumnPreferences, type CustomizableColumn } from "../useTableColumnPreferences";

const defaults: CustomizableColumn[] = [
  { id: "no", label: "No.", visible: true, order: 0, pinned: true, locked: true },
  { id: "a", label: "Alpha", visible: true, order: 1 },
  { id: "b", label: "Bravo", visible: true, order: 2 },
];
const reversed = [{ id: "no", visible: true, order: 0, pinned: true }, { id: "b", visible: true, order: 1, pinned: false }, { id: "a", visible: false, order: 2, pinned: false }];
const ids = (columns: CustomizableColumn[]) => columns.map((c) => `${c.id}${c.visible ? "" : "(hidden)"}`);

beforeEach(() => {
  auth.userId = "u1";
  api.get.mockReset();
  api.save.mockReset().mockResolvedValue(undefined);
  api.reset.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
});
afterEach(cleanup);

describe("useTableColumnPreferences", () => {
  it("opens in the layout this browser saw last, before the server answers, then follows the server", async () => {
    window.localStorage.setItem("eqms.table-columns.v1:u1:t", JSON.stringify(reversed));
    let answer: (value: unknown) => void = () => undefined;
    api.get.mockReturnValue(new Promise((resolve) => { answer = resolve; }));

    const { result } = renderHook(() => useTableColumnPreferences("t", defaults));

    expect(ids(result.current.columns)).toEqual(["no", "b", "a(hidden)"]);
    await act(async () => { answer([{ id: "no", visible: true, order: 0, pinned: true }, { id: "a", visible: true, order: 1, pinned: false }, { id: "b", visible: true, order: 2, pinned: false }]); });
    await waitFor(() => expect(ids(result.current.columns)).toEqual(["no", "a", "b"]));
    expect(JSON.parse(window.localStorage.getItem("eqms.table-columns.v1:u1:t") ?? "[]")).toHaveLength(3);
  });

  it("keeps the layout on screen when the server cannot be reached, and reports it", async () => {
    window.localStorage.setItem("eqms.table-columns.v1:u1:t", JSON.stringify(reversed));
    api.get.mockRejectedValue(new Error("offline"));
    vi.useFakeTimers();

    const { result } = renderHook(() => useTableColumnPreferences("t", defaults));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    vi.useRealTimers();

    expect(result.current.loadFailed).toBe(true);
    expect(ids(result.current.columns)).toEqual(["no", "b", "a(hidden)"]);
  });

  it("never uses the copy of another person", async () => {
    window.localStorage.setItem("eqms.table-columns.v1:u1:t", JSON.stringify(reversed));
    auth.userId = "u2";
    api.get.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useTableColumnPreferences("t", defaults));

    expect(ids(result.current.columns)).toEqual(["no", "a", "b"]);
  });

  it("keeps a copy after a save, and removes it on a reset", async () => {
    api.get.mockResolvedValue([]);
    const { result } = renderHook(() => useTableColumnPreferences("t", defaults));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => { await result.current.saveColumns([{ ...defaults[0] }, { ...defaults[2], order: 1 }, { ...defaults[1], order: 2, visible: false }]); });
    expect(ids(result.current.columns)).toEqual(["no", "b", "a(hidden)"]);
    expect(window.localStorage.getItem("eqms.table-columns.v1:u1:t")).not.toBeNull();

    const afterSave = result.current.changes;
    await act(async () => { await result.current.resetColumns(); });
    expect(result.current.changes).toBeGreaterThan(afterSave);
    expect(ids(result.current.columns)).toEqual(["no", "a", "b"]);
    expect(window.localStorage.getItem("eqms.table-columns.v1:u1:t")).toBeNull();
  });
});
