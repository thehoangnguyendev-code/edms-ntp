import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The filters of every table screen share one layout: a grid of at most three columns (md: two, lg: three) with Clear Filters in the grid, never a 4, 5, 6 or 12 column grid and never a
 * filter that spans several columns. This reads every screen that draws Clear Filters and refuses a filter grid that breaks the rule, so a screen cannot drift from the standard again.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const BROKEN_GRID = /(?:^|[\s"'`:])(?:(?:sm|md|lg|xl):)?grid-cols-(?:4|5|6|7|8|9|10|11|12)(?![\d])|\bcol-span-(?:[2-9]|1[0-2])\b/;

describe("filter layout standard", () => {
  const files = sources(join(process.cwd(), "src")).filter((file) => readFileSync(file, "utf8").includes("<ClearFiltersButton"));

  it("refuses a wide filter grid and a spanning filter, and accepts the standard", () => {
    expect('<div className="hidden md:grid lg:grid-cols-4 items-end">').toMatch(BROKEN_GRID);
    expect('<div className="grid grid-cols-12 items-end">').toMatch(BROKEN_GRID);
    expect('<div className="lg:col-span-4">').toMatch(BROKEN_GRID);
    expect('<div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">').not.toMatch(BROKEN_GRID);
    expect('<div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">').not.toMatch(BROKEN_GRID);
  });

  it("finds the screens that draw Clear Filters", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files.map((file) => [file.replace(process.cwd(), "")]))("%s keeps its filters in a grid of at most three columns", (name) => {
    const lines = readFileSync(join(process.cwd(), String(name)), "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.includes("<ClearFiltersButton")) return;
      // the grid of the filters is the nearest container above the button that is a grid with items-end (the filter row)
      for (let up = index; up >= Math.max(0, index - 80); up--) {
        if (/\bgrid\b/.test(lines[up]) && /items-end/.test(lines[up])) {
          expect(lines[up], `${name}:${up + 1}`).not.toMatch(BROKEN_GRID);
          break;
        }
      }
    });
  });
});
