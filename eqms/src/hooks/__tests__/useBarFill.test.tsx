import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gsap } from "@/lib/gsap";
import { BarFill } from "@/components/ui/progress/BarFill";
import { useBarWipe } from "../useBarFill";

const motion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));
const Bar = ({ percent }: { percent: number }) => <div data-testid="track"><BarFill percent={percent} className="x" /></div>;
const fill = () => screen.getByTestId("track").firstElementChild as HTMLElement;

function Wipe({ sig }: { sig: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useBarWipe(ref, sig);
  return <div ref={ref} data-testid="wipe" />;
}
const wipe = () => screen.getByTestId("wipe");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("bar fill", () => {
  it("grows from 0 when it first appears and ends on exactly its width", async () => {
    motion(false);
    render(<Bar percent={40} />);
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(true), { timeout: 1000 });
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(false), { timeout: 3000 });
    expect(fill().style.width).toBe("40%");
  });

  it("moves from the old width to the new one when the figure changes, and not for the same figure", async () => {
    motion(false);
    const { rerender } = render(<Bar percent={40} />);
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(true), { timeout: 1000 });
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(false), { timeout: 3000 });
    rerender(<Bar percent={40} />);
    expect(gsap.isTweening(fill())).toBe(false);
    rerender(<Bar percent={70} />);
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(true), { timeout: 1000 });
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(false), { timeout: 3000 });
    expect(fill().style.width).toBe("70%");
  });

  it("still plays when React mounts, cleans up and mounts again at once (StrictMode)", async () => {
    motion(false);
    render(<StrictMode><Bar percent={40} /></StrictMode>);
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(true), { timeout: 1000 });
    await waitFor(() => expect(gsap.isTweening(fill())).toBe(false), { timeout: 3000 });
    expect(fill().style.width).toBe("40%");
  });

  it("does not move with reduced motion", () => {
    motion(true);
    render(<Bar percent={40} />);
    expect(gsap.isTweening(fill())).toBe(false);
    expect(fill().style.width).toBe("40%");
  });
});

describe("bar wipe", () => {
  it("reveals a segmented bar when its figures change and leaves no clip-path behind", async () => {
    motion(false);
    const { rerender } = render(<Wipe sig="1,2" />);
    await waitFor(() => expect(gsap.isTweening(wipe())).toBe(true), { timeout: 1000 });
    await waitFor(() => expect(gsap.isTweening(wipe())).toBe(false), { timeout: 3000 });
    expect(wipe().style.clipPath ?? "").toBe("");
    rerender(<Wipe sig="1,2" />);
    expect(gsap.isTweening(wipe())).toBe(false);
    rerender(<Wipe sig="2,2" />);
    await waitFor(() => expect(gsap.isTweening(wipe())).toBe(true), { timeout: 1000 });
  });
});
