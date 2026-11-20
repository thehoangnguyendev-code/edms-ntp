import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gsap } from "@/lib/gsap";
import { TabNav, type TabItem } from "../TabNav";

const motion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));
const tabs = (count: number): TabItem[] => [
  { id: "a", label: "Alpha", count },
  { id: "b", label: "Beta" },
];
const indicator = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]') as HTMLElement;

beforeEach(() => {
  // the test DOM has no layout: give each tab a position so the indicator has somewhere to go
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", { configurable: true, get() { return this.getAttribute("role") === "tab" ? (this.id === "t-b" ? 100 : 0) : 0; } });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get() { return this.getAttribute("role") === "tab" ? 80 : 0; } });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetLeft;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
});

describe("TabNav motion", () => {
  it("places the indicator at once the first time, then stretches it to the new tab and ends on the exact numbers", async () => {
    motion(false);
    const { container, rerender } = render(<TabNav tabs={tabs(1)} activeTab="a" onChange={() => {}} tabIdPrefix="t" />);
    expect(indicator(container).style.left).toBe("0px");
    expect(indicator(container).style.width).toBe("80px");

    rerender(<TabNav tabs={tabs(1)} activeTab="b" onChange={() => {}} tabIdPrefix="t" />);
    await waitFor(() => { expect(indicator(container).style.left).toBe("100px"); expect(indicator(container).style.width).toBe("80px"); }, { timeout: 2000 });
  });

  it("moves the indicator at once with reduced motion", () => {
    motion(true);
    const { container, rerender } = render(<TabNav tabs={tabs(1)} activeTab="a" onChange={() => {}} tabIdPrefix="t" />);
    rerender(<TabNav tabs={tabs(1)} activeTab="b" onChange={() => {}} tabIdPrefix="t" />);
    expect(indicator(container).style.left).toBe("100px");
  });

  it("pops the count of a tab when it goes up", async () => {
    motion(false);
    const { rerender } = render(<TabNav tabs={tabs(1)} activeTab="a" onChange={() => {}} />);
    const count = () => screen.getByText(/^\d+$/);
    expect(Number(gsap.getProperty(count(), "scale"))).toBe(1);
    rerender(<TabNav tabs={tabs(2)} activeTab="a" onChange={() => {}} />);
    await waitFor(() => expect(Number(gsap.getProperty(count(), "scale"))).toBeGreaterThan(1), { timeout: 1000 });
  });

  it("lifts the label of the tab that was just chosen, not the first render", async () => {
    motion(false);
    const { rerender } = render(<TabNav tabs={tabs(1)} activeTab="a" onChange={() => {}} />);
    const label = (text: string) => screen.getByText(text);
    expect(gsap.isTweening(label("Alpha"))).toBe(false);
    rerender(<TabNav tabs={tabs(1)} activeTab="b" onChange={() => {}} />);
    await waitFor(() => expect(gsap.isTweening(label("Beta"))).toBe(true), { timeout: 1000 });
    expect(gsap.isTweening(label("Alpha"))).toBe(false);
  });
});
