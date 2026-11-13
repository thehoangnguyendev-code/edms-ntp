import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TransferPicker } from "../TransferPicker";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("keeps typing immediate and waits for the final search without changing selection", () => {
  vi.useFakeTimers();
  const remove = vi.fn();
  render(<TransferPicker noun="roles" available={[]} selected={["Alpha", "Bravo"]} getKey={(v) => v} getTitle={(v) => v} onAdd={vi.fn()} onRemove={remove} query="" onQueryChange={vi.fn()} />);
  const input = screen.getByRole("textbox", { name: "Search selected roles" });
  fireEvent.change(input, { target: { value: "Al" } });
  act(() => vi.advanceTimersByTime(200));
  fireEvent.change(input, { target: { value: "Bravo" } });
  expect(input).toHaveValue("Bravo");
  act(() => vi.advanceTimersByTime(299));
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  expect(screen.getByText("Bravo")).toBeInTheDocument();
  expect(remove).not.toHaveBeenCalled();
});
