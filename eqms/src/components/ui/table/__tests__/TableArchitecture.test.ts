import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("table component boundary", () => {
  it("keeps native table markup inside the shared renderer across all screens and nested components", () => {
    const sourceRoot = path.resolve("src");
    const nativeTags = new Set(["table", "thead", "tbody", "tfoot", "tr", "th", "td", "col", "colgroup", "caption"]);
    const violations: string[] = [];
    function check(directory: string) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") check(file);
          continue;
        }
        if (!file.endsWith(".tsx") || entry.name === "TablePrimitives.tsx") continue;
        const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node: ts.Node) {
          if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && nativeTags.has(node.tagName.getText(source))) {
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            violations.push(`${path.relative(sourceRoot, file)}:${line}`);
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    check(sourceRoot);
    expect(violations).toEqual([]);
  });
});
