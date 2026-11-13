import { describe, expect, it } from "vitest";
import { sameHtml } from "../sameHtml";

describe("the wording an editor gives back is the wording that was saved", () => {
  it("ignores the white space between tags and runs of white space", () => {
    expect(sameHtml('<div style="x">\n  <p>Hello {{recipientName}},</p>\n  <p>Body</p>\n</div>', '<div style="x"><p>Hello {{recipientName}},</p><p>Body</p></div>')).toBe(true);
    expect(sameHtml("<p>a   b</p>", "<p>a b</p>")).toBe(true);
    expect(sameHtml(null, "")).toBe(true);
  });

  it("still sees a real change", () => {
    expect(sameHtml("<p>Hello</p>", "<p>Hello!</p>")).toBe(false);
    expect(sameHtml("<p>Hello</p>", "<p>Hello</p><p>More</p>")).toBe(false);
    expect(sameHtml("<p>{{a}}</p>", "<p>{{b}}</p>")).toBe(false);
  });
});
