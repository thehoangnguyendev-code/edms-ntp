import { describe, expect, it } from "vitest";
import fs from "node:fs";

/** The menu is drawn by memoised functions: without the reader of the counts in their dependencies the numbers arrive and are never painted. */
describe("sidebar task counts", () => {
  it("draws the menu again when the counts arrive", () => {
    const source = fs.readFileSync("src/components/layout/sidebar/Sidebar.tsx", "utf8");
    const from = source.indexOf("const renderMenuItem = useCallback(");
    const deps = source.slice(from, source.indexOf("// Close collapsed flyout", from));

    expect(deps).toMatch(/\n\s+badgeOf,\r?\n/);
    expect(source).toMatch(/\[hoverMenu\.expandedSubItems, activeId, handleSubItemClick, badgeOf,/);
  });
});
