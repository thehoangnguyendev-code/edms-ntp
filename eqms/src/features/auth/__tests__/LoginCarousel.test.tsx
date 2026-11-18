// React only listens for "animationend" when the browser has AnimationEvent; jsdom does not, so it is declared before React is loaded.
vi.hoisted(() => { (window as unknown as { AnimationEvent: unknown }).AnimationEvent = class extends Event {}; });

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LoginCarousel } from "../components/LoginCarousel";

const slides = [
  { title: "First title", subtitle: "First subtitle", image: "data:image/png;base64,AAAA" },
  { title: "Second title", subtitle: "Second subtitle", image: "data:image/png;base64,BBBB" },
  { title: "Third title", subtitle: "", image: "data:image/png;base64,CCCC" },
];

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

const region = () => screen.getByRole("region", { name: "Product highlights" });

it("shows the title and subtitle of the first slide and a control for every slide", () => {
  render(<LoginCarousel carousel={{ intervalSeconds: 5, slides }} />);

  expect(screen.getByRole("heading", { name: "First title" })).toBeTruthy();
  expect(screen.getByText("First subtitle")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /^Slide \d of 3$/ })).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Slide 1 of 3" }).getAttribute("aria-current")).toBe("true");
});

it("moves to the chosen slide with the next button, the dots and the arrow keys, and wraps around", async () => {
  render(<LoginCarousel carousel={{ intervalSeconds: 5, slides }} />);

  fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
  expect(await screen.findByRole("heading", { name: "Second title" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Slide 3 of 3" }));
  expect(await screen.findByRole("heading", { name: "Third title" })).toBeTruthy();
  expect(screen.queryByText("Third subtitle")).toBeNull();

  fireEvent.keyDown(region(), { key: "ArrowRight" });
  expect(await screen.findByRole("heading", { name: "First title" })).toBeTruthy();

  fireEvent.keyDown(region(), { key: "ArrowLeft" });
  expect(await screen.findByRole("heading", { name: "Third title" })).toBeTruthy();
});

it("advances by itself when the bar of the slide has filled, and rests while the pointer is on it or it was paused", async () => {
  render(<LoginCarousel carousel={{ intervalSeconds: 4, slides }} />);
  const fill = () => screen.getByRole("button", { name: "Slide 1 of 3" }).querySelector("span > span") as HTMLElement;

  expect(fill().style.animation).toContain("4s");
  expect(fill().style.animationPlayState).toBe("running");

  fireEvent.mouseEnter(region());
  expect(fill().style.animationPlayState).toBe("paused");
  fireEvent.mouseLeave(region());
  expect(fill().style.animationPlayState).toBe("running");

  fireEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
  expect(fill().style.animationPlayState).toBe("paused");
  expect(screen.getByRole("button", { name: "Play slideshow" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Play slideshow" }));

  await act(async () => { fireEvent.animationEnd(fill()); });
  expect(await screen.findByRole("heading", { name: "Second title" })).toBeTruthy();
});

it("keeps the time per slide inside 3 to 30 seconds whatever was saved", () => {
  const { unmount } = render(<LoginCarousel carousel={{ intervalSeconds: 1, slides }} />);
  expect((screen.getByRole("button", { name: "Slide 1 of 3" }).querySelector("span > span") as HTMLElement).style.animation).toContain("3s");
  unmount();
  render(<LoginCarousel carousel={{ intervalSeconds: 99, slides }} />);
  expect((screen.getByRole("button", { name: "Slide 1 of 3" }).querySelector("span > span") as HTMLElement).style.animation).toContain("30s");
});

it("draws a single slide without controls and never moves", () => {
  render(<LoginCarousel carousel={{ slides: [slides[0]] }} />);

  expect(screen.getByRole("heading", { name: "First title" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next slide" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Slide / })).toBeNull();
});

it("does not break when the list gets shorter while a later slide is shown", async () => {
  const { rerender } = render(<LoginCarousel carousel={{ slides }} />);
  fireEvent.click(screen.getByRole("button", { name: "Slide 3 of 3" }));
  expect(await screen.findByRole("heading", { name: "Third title" })).toBeTruthy();

  rerender(<LoginCarousel carousel={{ slides: slides.slice(0, 2) }} />);

  expect(await screen.findByRole("heading", { name: "Second title" })).toBeTruthy();
});

vi.setConfig({ testTimeout: 15000 });
