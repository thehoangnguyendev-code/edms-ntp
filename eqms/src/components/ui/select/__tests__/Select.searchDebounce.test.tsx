import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Select } from "../Select";
import { MultiSelect } from "../MultiSelect";

afterEach(() => { cleanup(); vi.useRealTimers(); });
const options = [{ label: "Alpha", value: "a" }, { label: "Bravo", value: "b" }];

it.each(["Select", "MultiSelect"])("%s debounces local search without delaying typing or changing selected values", (kind) => {
  vi.useFakeTimers();
  const change = vi.fn();
  render(kind === "Select" ? <Select value="" onChange={change} options={options} /> : <MultiSelect value={[]} onChange={change} options={options} />);
  fireEvent.click(screen.getByRole("combobox"));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Al" } });
  act(() => vi.advanceTimersByTime(200));
  fireEvent.change(input, { target: { value: "Bravo" } });
  expect(input).toHaveValue("Bravo");
  act(() => vi.advanceTimersByTime(299));
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  expect(screen.getByText("Bravo")).toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "" } });
  expect(screen.getByText("Alpha")).toBeInTheDocument();
});

it.each(["Select", "MultiSelect"])("%s keeps one 300ms debounce for server search, cancels intermediate typing and unmounts safely", async (kind) => {
  vi.useFakeTimers();
  const search = vi.fn().mockResolvedValue(options);
  const view = render(kind === "Select" ? <Select value="" onChange={vi.fn()} options={[]} onSearch={search} /> : <MultiSelect value={[]} onChange={vi.fn()} options={[]} onSearch={search} />);
  fireEvent.click(screen.getByRole("combobox"));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Al" } });
  await act(() => vi.advanceTimersByTimeAsync(200));
  fireEvent.change(input, { target: { value: "Bravo" } });
  await act(() => vi.advanceTimersByTimeAsync(299));
  expect(search).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(search).toHaveBeenCalledExactlyOnceWith("Bravo");
  fireEvent.change(input, { target: { value: "discard" } });
  view.unmount();
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(search).toHaveBeenCalledTimes(1);
});
