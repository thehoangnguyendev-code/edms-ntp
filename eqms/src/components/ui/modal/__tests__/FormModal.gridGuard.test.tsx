import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormModal } from "../FormModal";

afterEach(cleanup);

describe("FormModal body on a narrow screen", () => {
  it("marks its body so a grid without columns inside it can shrink to the modal instead of being cut off", () => {
    render(
      <FormModal isOpen onClose={vi.fn()} title="Attach the scan">
        <div className="grid gap-4"><div>wide content</div></div>
      </FormModal>,
    );
    const body = screen.getByText("wide content").closest(".form-modal-body");
    expect(body).not.toBeNull();
    expect(body!.querySelector(".grid")).not.toBeNull();
  });

  it("has one column that may shrink, and items that may shrink, for such a grid, and leaves a grid that sets its own columns alone", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/utilities.css"), "utf8");
    const rule = /\.form-modal-body \.grid:not\(\[class\*="grid-cols"\]\)[^{]*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/;
    expect(css).toMatch(rule);
    expect(css).toMatch(/\.form-modal-body \.grid:not\(\[class\*="grid-cols"\]\)[^{]*> \* \{\s*min-width:\s*0;/);
    // a grid that already has columns, flows by column or sets a template is not touched
    expect(css).toContain(':not([class*="grid-flow"])');
    expect(css).toContain(':not([style*="grid-template"])');
  });
});
