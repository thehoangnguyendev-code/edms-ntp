import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gsap } from "@/lib/gsap";
import { NavCountBadge } from "../NavCountBadge";

const motion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));
const badge = () => screen.queryByText(/^\(\d+\+?\)$/) as HTMLElement | null;
const scale = (element: HTMLElement) => Number(gsap.getProperty(element, "scale"));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sidebar count badge", () => {
  it("shows nothing for a count that is 0 or not known yet, and the number otherwise", () => {
    motion(false);
    const { rerender } = render(<NavCountBadge value={undefined} className="pill" />);
    expect(badge()).toBeNull();
    rerender(<NavCountBadge value={0} className="pill" />);
    expect(badge()).toBeNull();
    rerender(<NavCountBadge value={3} className="pill" />);
    expect(badge()?.textContent).toBe("(3)");
    expect(badge()?.className).toBe("pill");
  });

  it("pops when a known count goes up, and comes back to its normal size", async () => {
    motion(false);
    const { rerender } = render(<NavCountBadge value={2} className="pill" />);
    expect(scale(badge() as HTMLElement)).toBe(1); // the first value does not pop

    rerender(<NavCountBadge value={3} className="pill" />);
    await waitFor(() => expect(scale(badge() as HTMLElement)).toBeGreaterThan(1), { timeout: 4000 });
    // (the real browser also leaves no inline style; the test DOM keeps an identity transform, so only the size is asserted here)
    await waitFor(() => expect(scale(badge() as HTMLElement)).toBe(1), { timeout: 4000 });
  });

  it("pops when the count comes up from 0 (the element appears with the number)", async () => {
    motion(false);
    const { rerender } = render(<NavCountBadge value={0} className="pill" />);

    rerender(<NavCountBadge value={1} className="pill" />);

    await waitFor(() => expect(scale(badge() as HTMLElement)).toBeGreaterThan(1), { timeout: 4000 });
  });

  it("does not pop for the first number that arrives, for a drop, or for the same number again", () => {
    motion(false);
    const { rerender } = render(<NavCountBadge value={undefined} className="pill" />);
    rerender(<NavCountBadge value={5} className="pill" />); // the answer arrives: not "one more"
    expect(scale(badge() as HTMLElement)).toBe(1);

    rerender(<NavCountBadge value={5} className="pill other" />);
    expect(scale(badge() as HTMLElement)).toBe(1);

    rerender(<NavCountBadge value={4} className="pill" />);
    expect(scale(badge() as HTMLElement)).toBe(1);
  });

  it("does not move when the person asked for reduced motion", () => {
    motion(true);
    const { rerender } = render(<NavCountBadge value={2} className="pill" />);

    rerender(<NavCountBadge value={3} className="pill" />);

    expect(scale(badge() as HTMLElement)).toBe(1);
  });
});
