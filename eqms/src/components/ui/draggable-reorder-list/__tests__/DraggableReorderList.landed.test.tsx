import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DraggableReorderList } from "../DraggableReorderList";

const items = [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("reorder list landing mark", () => {
  it("has an invisible wash on each row that no one can click or hear", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }));
    const { container } = render(<DraggableReorderList items={items} onReorder={() => undefined} />);

    const washes = container.querySelectorAll<HTMLElement>("[data-reorder-landed]");
    expect(washes).toHaveLength(2);
    washes.forEach((wash) => {
      expect(wash.className).toContain("pointer-events-none");
      expect(wash.className).toContain("opacity-0");
      expect(wash.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("still lists the rows and their drag handles as before", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }));
    const { getByLabelText, getByText } = render(<DraggableReorderList items={items} onReorder={() => undefined} />);

    expect(getByText("Alpha")).toBeTruthy();
    expect(getByLabelText("Drag Beta")).toBeTruthy();
  });
});
