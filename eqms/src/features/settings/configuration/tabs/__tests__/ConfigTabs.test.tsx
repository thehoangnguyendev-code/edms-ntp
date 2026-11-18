import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigTabs, HISTORY_TAB, revertFields, changedTabs } from "../ConfigTabs";

afterEach(() => cleanup());

const tabs = [{ id: "one", label: "One" }, { id: "two", label: "Two" }, HISTORY_TAB] as const;

describe("ConfigTabs", () => {
  it("offers to discard the changes of the open tab only when it has some, and discards just that tab", () => {
    const onReset = vi.fn();
    const { rerender } = render(<ConfigTabs tabs={tabs} activeTab="one" onChange={vi.fn()} changed={new Set(["two"] as const)} onReset={onReset} ariaLabel="x" idPrefix="x">content</ConfigTabs>);

    expect(screen.queryByRole("button", { name: "Discard changes in this tab" })).toBeNull();

    rerender(<ConfigTabs tabs={tabs} activeTab="two" onChange={vi.fn()} changed={new Set(["two"] as const)} onReset={onReset} ariaLabel="x" idPrefix="x">content</ConfigTabs>);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes in this tab" }));
    expect(onReset).toHaveBeenCalledWith("two");
  });

  it("ends with the History tab", () => {
    render(<ConfigTabs tabs={tabs} activeTab="one" onChange={vi.fn()} ariaLabel="x" idPrefix="x">content</ConfigTabs>);

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["One", "Two", "History"]);
  });
});

describe("revertFields and changedTabs", () => {
  it("puts back only the named fields, and removes one that was not saved", () => {
    const saved = { a: 1, b: { x: 1 } };
    const draft = { a: 2, b: { x: 2 }, c: 3 };

    expect(revertFields(draft, saved as never, ["a"])).toEqual({ a: 1, b: { x: 2 }, c: 3 });
    expect(revertFields(draft, saved as never, ["b", "c"])).toEqual({ a: 2, b: { x: 1 } });
    const copy = revertFields(draft, saved as never, ["b"]) as { b: object };
    expect(copy.b).not.toBe(saved.b);
    expect(revertFields(draft, null, ["a"])).toBe(draft);
  });

  it("agrees with the tab that holds the change", () => {
    expect([...changedTabs({ a: 2, b: 1 }, { a: 1, b: 1 }, { one: ["a"], two: ["b"], history: [] })]).toEqual(["one"]);
  });
});
