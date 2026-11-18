import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { LoginCarouselEditor } from "../LoginCarouselEditor";

afterEach(() => cleanup());

const slide = (n: number) => ({ title: `Title ${n}`, subtitle: `Subtitle ${n}`, image: `data:image/png;base64,A${n}` });

it("starts empty: tells the administrator the product preview is shown and sets no speed", () => {
  render(<LoginCarouselEditor value={null} onChange={vi.fn()} />);

  expect(screen.getByText(/No slides yet/)).toBeTruthy();
  expect(screen.getByText("Add a second slide to set the speed.")).toBeTruthy();
  expect((screen.getByLabelText("Time per slide") as HTMLInputElement).disabled).toBe(true);
});

it("edits the title and subtitle of one slide without touching the others", () => {
  const onChange = vi.fn();
  render(<LoginCarouselEditor value={{ intervalSeconds: 6, slides: [slide(1), slide(2)] }} onChange={onChange} />);

  fireEvent.change(screen.getAllByLabelText("Title")[1], { target: { value: "New headline" } });

  expect(onChange).toHaveBeenCalledWith({ intervalSeconds: 6, slides: [slide(1), { ...slide(2), title: "New headline" }] });

  fireEvent.change(screen.getAllByLabelText("Subtitle")[0], { target: { value: "New line" } });
  expect(onChange).toHaveBeenLastCalledWith({ intervalSeconds: 6, slides: [{ ...slide(1), subtitle: "New line" }, slide(2)] });
});

it("sets the speed, moves a slide and removes one; removing the last slide clears the whole setting", () => {
  const onChange = vi.fn();
  const { rerender } = render(<LoginCarouselEditor value={{ intervalSeconds: 6, slides: [slide(1), slide(2)] }} onChange={onChange} />);

  fireEvent.change(screen.getByLabelText("Time per slide"), { target: { value: "12" } });
  expect(onChange).toHaveBeenLastCalledWith({ intervalSeconds: 12, slides: [slide(1), slide(2)] });

  fireEvent.click(screen.getByRole("button", { name: "Move slide 1 down" }));
  expect(onChange).toHaveBeenLastCalledWith({ intervalSeconds: 6, slides: [slide(2), slide(1)] });
  expect((screen.getByRole("button", { name: "Move slide 1 up" }) as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]);
  expect(onChange).toHaveBeenLastCalledWith({ intervalSeconds: 6, slides: [slide(2)] });

  rerender(<LoginCarouselEditor value={{ intervalSeconds: 6, slides: [slide(1)] }} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it("does not allow more than six slides", () => {
  render(<LoginCarouselEditor value={{ intervalSeconds: 6, slides: [1, 2, 3, 4, 5, 6].map(slide) }} onChange={vi.fn()} />);

  expect((screen.getByRole("button", { name: /Add slide/ }) as HTMLButtonElement).disabled).toBe(true);
});

it("keeps each slide's text with its picture when the order is changed with the arrows", () => {
  const onChange = vi.fn();
  render(<LoginCarouselEditor value={{ intervalSeconds: 6, slides: [slide(1), slide(2), slide(3)] }} onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Move slide 3 up" }));

  expect(onChange).toHaveBeenLastCalledWith({ intervalSeconds: 6, slides: [slide(1), slide(3), slide(2)] });
});

it("draws the sign-in screen with the slides as they are now, and offers a handle to drag each slide when there are several", () => {
  const { rerender } = render(<LoginCarouselEditor value={{ intervalSeconds: 6, slides: [slide(1)] }} onChange={vi.fn()} />);

  expect(screen.getByRole("img", { name: /Preview of the sign-in screen/ })).toBeTruthy();
  expect(screen.getAllByText("Title 1").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /Drag slide/ })).toBeNull();

  rerender(<LoginCarouselEditor value={{ intervalSeconds: 6, slides: [slide(1), slide(2)] }} onChange={vi.fn()} />);
  expect(screen.getAllByRole("button", { name: /Drag slide \d to change its place/ })).toHaveLength(2);
});

it("shows the product preview in the preview while there are no slides", () => {
  render(<LoginCarouselEditor value={null} onChange={vi.fn()} />);

  expect(screen.getByRole("img", { name: /Preview of the sign-in screen/ })).toBeTruthy();
  expect(screen.getByText("Keep your quality processes under control.")).toBeTruthy();
});
