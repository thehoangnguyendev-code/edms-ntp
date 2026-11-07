import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src");
const css = readFileSync(resolve(root, "styles/utilities.css"), "utf8");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== "__tests__" && name !== "node_modules") sources(path, out); }
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

describe("the cell of Clear Filters and the Custom Column icon", () => {
  it("never wraps", () => {
    const rule = css.slice(css.indexOf(".filter-actions {"));
    expect(rule).toMatch(/flex-wrap:\s*nowrap/);
  });

  it("is not a button with a name any more: the icon stays, the name is the tooltip and the accessible name", () => {
    const source = readFileSync(resolve(root, "components/ui/table/CustomColumnDrawer.tsx"), "utf8");
    expect(source).toContain('aria-label="Custom Column"');
    expect(source).not.toContain("custom-column-label");
    expect(css).not.toContain("custom-column-label");
  });

  it("is the cell of every screen that puts Clear Filters in a cell of its own, and none of them lets the two buttons wrap", () => {
    const offenders: string[] = [];
    for (const file of sources(root)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/<ClearFiltersButton/.test(line)) return;
        const cell = lines.slice(Math.max(0, i - 2), i).reverse().find((l) => /<div className="[^"]*\bflex\b/.test(l));
        if (cell && /flex-wrap/.test(cell)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
