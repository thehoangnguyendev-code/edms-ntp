import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LANGUAGE_FLAG_ICONS, UnitedKingdomFlagIcon, VietnamFlagIcon } from "../Flags";

describe("language flags", () => {
  it("draw an svg, hidden from screen readers, at the size the caller gives", () => {
    const { container } = render(<><VietnamFlagIcon className="h-4" /><UnitedKingdomFlagIcon className="h-4" /></>);
    const flags = container.querySelectorAll("svg");
    expect(flags).toHaveLength(2);
    flags.forEach((flag) => expect(flag.getAttribute("aria-hidden")).toBe("true"));
    expect(flags[0].getAttribute("class")).toContain("h-4");
  });

  it("belong to the two interface languages", () => {
    expect(LANGUAGE_FLAG_ICONS.vi).toBe(VietnamFlagIcon);
    expect(LANGUAGE_FLAG_ICONS.en).toBe(UnitedKingdomFlagIcon);
  });
});
