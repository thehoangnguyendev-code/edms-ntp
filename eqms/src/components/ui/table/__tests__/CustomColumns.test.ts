import { describe, expect, it } from "vitest";
import { mergeSavedColumns, toSavedColumns, type CustomizableColumn } from "../useTableColumnPreferences";
import { normalizeColumnOrder } from "../useTableColumnPreferences";

const defaults: CustomizableColumn[] = [
  { id: "no", label: "No.", visible: true, order: 0, locked: true },
  { id: "name", label: "Name", visible: true, order: 1, pinned: true },
  { id: "email", label: "Email", visible: true, order: 2 },
  { id: "phone", label: "Phone", visible: true, order: 3 },
];

describe("mergeSavedColumns", () => {
  it("returns the defaults when nothing is saved", () => {
    expect(mergeSavedColumns(defaults, []).map((c) => c.id)).toEqual(["no", "name", "email", "phone"]);
  });

  it("applies saved order, visibility and pinning", () => {
    const merged = mergeSavedColumns(defaults, [
      { id: "phone", visible: false, order: 0, pinned: false },
      { id: "email", visible: true, order: 1, pinned: true },
      { id: "name", visible: true, order: 2, pinned: false },
    ]);
    expect(merged.map((c) => c.id)).toEqual(["no", "phone", "email", "name"]);
    expect(merged.find((c) => c.id === "phone")?.visible).toBe(false);
    expect(merged.find((c) => c.id === "email")?.pinned).toBe(true);
  });

  it("drops unknown ids and appends new default columns as visible", () => {
    const merged = mergeSavedColumns(defaults, [
      { id: "retired", visible: true, order: 0, pinned: false },
      { id: "name", visible: true, order: 1, pinned: true },
    ]);
    expect(merged.map((c) => c.id)).not.toContain("retired");
    expect(merged.map((c) => c.id)).toEqual(expect.arrayContaining(["email", "phone"]));
    expect(merged.find((c) => c.id === "email")?.visible).toBe(true);
  });

  it("keeps locked columns visible and in place whatever was saved", () => {
    const merged = mergeSavedColumns(defaults, [
      { id: "no", visible: false, order: 9, pinned: false },
      { id: "email", visible: true, order: 0, pinned: false },
    ]);
    expect(merged[0].id).toBe("no");
    expect(merged[0].visible).toBe(true);
    expect(merged[0].pinned).toBe(true);
  });
});

describe("normalizeColumnOrder", () => {
  it("places locked columns first, then pinned, then the rest", () => {
    const ordered = normalizeColumnOrder([
      { id: "email", label: "Email", visible: true, order: 0 },
      { id: "name", label: "Name", visible: true, order: 1, pinned: true },
      { id: "no", label: "No.", visible: true, order: 2, locked: true },
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["no", "name", "email"]);
    expect(ordered.map((c) => c.order)).toEqual([0, 1, 2]);
  });
});

describe("toSavedColumns", () => {
  it("renumbers order from zero and keeps flags", () => {
    const saved = toSavedColumns([
      { id: "b", label: "B", visible: false, order: 5, pinned: true },
      { id: "a", label: "A", visible: true, order: 2 },
    ]);
    expect(saved).toEqual([
      { id: "a", visible: true, order: 0, pinned: false },
      { id: "b", visible: false, order: 1, pinned: true },
    ]);
  });
});

describe("pinning rules", () => {
  it("does not treat a hidden column as pinned", () => {
    const ordered = normalizeColumnOrder([
      { id: "name", label: "Name", visible: false, order: 0, pinned: true },
      { id: "email", label: "Email", visible: true, order: 1 },
      { id: "phone", label: "Phone", visible: true, order: 2, pinned: true },
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["phone", "name", "email"]);
  });
});
