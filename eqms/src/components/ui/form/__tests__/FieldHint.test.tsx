import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldHint } from "../FieldHint";

describe("FieldHint", () => {
  it("is half the width of its container from md up and full width on a small screen, like the half-width controls above it", () => {
    render(<FieldHint>Short hint.</FieldHint>);
    const hint = screen.getByText("Short hint.");
    expect(hint.className).toContain("md:w-1/2");
    expect(hint.className).not.toMatch(/(^|\s)w-1\/2/); // no fixed half width on a small screen
    expect(hint.className).toContain("text-xs");
    expect(hint.className).not.toContain("ml-7");
  });

  it("lines up under a checkbox label when indented and keeps the caller's spacing", () => {
    render(<FieldHint indent className="mt-1">Under a checkbox.</FieldHint>);
    const hint = screen.getByText("Under a checkbox.");
    expect(hint.className).toContain("ml-7");
    expect(hint.className).toContain("mt-1");
    expect(hint.className).toContain("md:w-1/2");
  });
});
