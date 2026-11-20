import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gsap } from "@/lib/gsap";
import { FavouriteStar } from "../FavouriteStar";

const motion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));
const props = { ariaLabel: "star", title: "star", className: "btn" };
const icon = (container: HTMLElement) => container.querySelector("[data-star-icon]") as HTMLElement;
const rays = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>("[data-star-ray]"));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("favourite star", () => {
  it("hops and sends out eight rays when it is pressed to add, then leaves no inline style", async () => {
    motion(false);
    const onToggle = vi.fn();
    const { container } = render(<FavouriteStar starred={false} onToggle={onToggle} {...props} />);
    expect(rays(container)).toHaveLength(8);

    fireEvent.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(gsap.isTweening(icon(container))).toBe(true), { timeout: 1000 });
    await waitFor(() => expect(rays(container).every((ray) => gsap.isTweening(ray))).toBe(true), { timeout: 1000 }); // the rays start a moment after the hop
    await waitFor(() => expect(gsap.isTweening(icon(container))).toBe(false), { timeout: 4000 });
    expect(Number(gsap.getProperty(icon(container), "scale"))).toBe(1);
    // the rays are hidden by their own class again (the test DOM has no stylesheet, so only the inline opacity is checked)
    expect(rays(container).every((ray) => ray.style.opacity === "")).toBe(true);
  });

  it("is quiet when it removes a favourite, and when a favourite only arrives as a prop", () => {
    motion(false);
    const onToggle = vi.fn();
    const { container, rerender } = render(<FavouriteStar starred={false} onToggle={onToggle} {...props} />);
    rerender(<FavouriteStar starred onToggle={onToggle} {...props} />); // loaded from storage: no press
    expect(gsap.isTweening(icon(container))).toBe(false);

    fireEvent.click(screen.getByRole("button")); // remove
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(gsap.isTweening(icon(container))).toBe(false);
  });

  it("still toggles but does not move with reduced motion", () => {
    motion(true);
    const onToggle = vi.fn();
    const { container } = render(<FavouriteStar starred={false} onToggle={onToggle} {...props} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(gsap.isTweening(icon(container))).toBe(false);
  });

  it("keeps its accessible name and pressed state", () => {
    motion(false);
    render(<FavouriteStar starred onToggle={() => {}} ariaLabel="Remove X from favourites" title="t" className="btn" />);
    const button = screen.getByRole("button", { name: "Remove X from favourites" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });
});
