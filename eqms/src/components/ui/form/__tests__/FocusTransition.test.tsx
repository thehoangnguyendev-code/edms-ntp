import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input, Textarea } from "../ResponsiveForm";

describe("Input and Textarea focus", () => {
  // `transition-all` also animated the browser's dark focus outline while it faded out, so a field showed a black border for a moment
  // before the emerald one. Only the colours that really change are animated.
  it.each([
    ["Input", <Input key="i" aria-label="x" />],
    ["Textarea", <Textarea key="t" aria-label="x" />],
  ])("%s does not animate every property, and turns emerald on focus", (_name, element) => {
    const { container } = render(element);
    const control = container.firstElementChild as HTMLElement;
    expect(control.className).not.toContain("transition-all");
    expect(control.className).toContain("transition-[border-color,box-shadow,background-color]");
    expect(control.className).toContain("focus:border-emerald-500");
    expect(control.className).toContain("focus:ring-emerald-500");
  });
});
