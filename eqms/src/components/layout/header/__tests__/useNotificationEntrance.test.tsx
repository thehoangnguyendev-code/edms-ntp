import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gsap } from "@/lib/gsap";
import { useNotificationEntrance } from "../useNotificationEntrance";

const motion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));

function List({ ids, settled }: { ids: string[]; settled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useNotificationEntrance(ref, ids, settled);
  return <div ref={ref}>{ids.map((id) => <div key={id} data-notification-id={id} data-testid={id} />)}</div>;
}
const tweening = (id: string, root: HTMLElement) => gsap.isTweening(root.querySelector(`[data-testid="${id}"]`) as HTMLElement);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("notification list entrance", () => {
  it("animates the items once the list is loaded, not while it is loading", () => {
    motion(false);
    const { container, rerender } = render(<List ids={["a", "b"]} settled={false} />);
    expect(tweening("a", container)).toBe(false);
    rerender(<List ids={["a", "b"]} settled />);
    expect(tweening("a", container)).toBe(true);
    expect(tweening("b", container)).toBe(true);
  });

  it("animates only the item that arrives later", () => {
    motion(false);
    const { container, rerender } = render(<List ids={["a"]} settled />);
    gsap.killTweensOf(container.querySelectorAll("[data-notification-id]"));
    rerender(<List ids={["n", "a"]} settled />);
    expect(tweening("n", container)).toBe(true);
    expect(tweening("a", container)).toBe(false);
  });

  it("does not move with reduced motion", () => {
    motion(true);
    const { container } = render(<List ids={["a"]} settled />);
    expect(tweening("a", container)).toBe(false);
  });
});
