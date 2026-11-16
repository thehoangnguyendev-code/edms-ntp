import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Read as a file: the test run does not process stylesheets.
const css = readFileSync(resolve(process.cwd(), "src/features/audit-trail/components/timeline/auditTimeline.css"), "utf-8");

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The declarations of the rule of a selector, as written in the stylesheet. */
const rule = (selector: string) => {
  const found = new RegExp(`(?:^|[}/\\s])${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "m").exec(css);
  expect(found, `the rule of ${selector}`).not.toBeNull();
  return (found as RegExpExecArray)[1];
};
const zIndex = (selector: string) => Number(/z-index:\s*(-?\d+)/.exec(rule(selector))?.[1] ?? Number.NaN);

/**
 * AUDIT-TAB-TIMELINE-2026-11-16: the line of a timeline is under its marks at every moment. A mark that is sliding in has a transform and an opacity, which make it a layer of
 * its own: without a z-index above the line, the line (drawn after it) ran over the icon until the slide ended (date column, scrolling).
 */
describe("the stacking of the timeline", () => {
  it("keeps the progress line and the track of the date column under the marks", () => {
    expect(zIndex(".aud-lit__spine::before")).toBe(0);
    expect(zIndex(".aud-lit__spine::after")).toBe(0);
    expect(zIndex(".aud-lit .aud-ev")).toBeGreaterThan(zIndex(".aud-lit__spine::after"));
    expect(rule(".aud-lit__spine")).toContain("isolation: isolate");
  });

  it("keeps the dots, the nodes and the avatars of the other looks above their lines", () => {
    expect(zIndex(".aud-rail__dot")).toBeGreaterThan(0);
    expect(zIndex(".aud-center__node")).toBeGreaterThan(0);
    expect(zIndex(".aud-compact .aud-av")).toBeGreaterThan(0);
    expect(zIndex(".aud-lit__pin")).toBeGreaterThan(0);
  });

  it("keeps the connector of the centre spine from the card to its node", () => {
    expect(rule(".aud-center__box::after")).toContain("width: 13px");
    expect(rule(".aud-center .is-left .aud-center__box::after")).toContain("right: -13px");
    expect(rule(".aud-center .is-right .aud-center__box::after")).toContain("left: -13px");
  });
});
