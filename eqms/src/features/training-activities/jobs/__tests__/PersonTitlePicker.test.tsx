import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const people = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/trainingActivities", () => ({ trainingActivitiesApi: { people } }));
vi.mock("@/components/ui/select/MultiSelect", () => ({
  MultiSelect: ({ value, options, onChange }: { value: (string | number)[]; options: { value: string; label: string }[]; onChange: (v: (string | number)[]) => void }) => (
    <div data-testid="multiselect">
      <span data-testid="chosen">{value.join("|")}</span>
      {options.map((o) => <button key={o.value} type="button" onClick={() => onChange(value.includes(o.value) ? value.filter((x) => x !== o.value) : [...value, o.value])}>{o.label}</button>)}
    </div>
  ),
}));
vi.mock("@/components/ui/select/Select", () => ({ Select: () => <div data-testid="select" /> }));

import { PersonTitlePicker } from "../PersonTitlePicker";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("uses the multi select when several people can be chosen, and writes them separated by '; '", async () => {
  people.mockResolvedValue([{ fullName: "An Nguyen", position: "QA Specialist" }, { fullName: "Binh Tran", position: null }]);
  const onChange = vi.fn();
  render(<PersonTitlePicker label="Job title of subordinates" multiple value="An Nguyen - QA Specialist" onChange={onChange} />);
  expect(screen.getByTestId("multiselect")).toBeTruthy();
  expect(screen.getByTestId("chosen").textContent).toBe("An Nguyen - QA Specialist");
  fireEvent.click(await screen.findByRole("button", { name: "Binh Tran" }));
  expect(onChange).toHaveBeenCalledWith("An Nguyen - QA Specialist; Binh Tran");
});

it("can be left empty: removing the last person writes an empty value", async () => {
  people.mockResolvedValue([{ fullName: "An Nguyen", position: "QA Specialist" }]);
  const onChange = vi.fn();
  render(<PersonTitlePicker label="Job title of subordinates" multiple value="An Nguyen - QA Specialist" onChange={onChange} />);
  fireEvent.click(await screen.findByRole("button", { name: "An Nguyen - QA Specialist" }));
  expect(onChange).toHaveBeenCalledWith("");
});

it("keeps a value that was typed before (not a person) as a chosen item", async () => {
  people.mockResolvedValue([]);
  render(<PersonTitlePicker label="Job title of subordinates" multiple value="none" onChange={vi.fn()} />);
  await waitFor(() => expect(people).toHaveBeenCalled());
  expect(screen.getByTestId("chosen").textContent).toBe("none");
});

it("when it cannot be changed and is empty it shows the empty read-only field (it was blank before)", () => {
  render(<PersonTitlePicker label="Job title of subordinates" multiple disabled value="" onChange={vi.fn()} />);
  const box = screen.getByLabelText("Job title of subordinates") as HTMLInputElement;
  expect(box.readOnly).toBe(true);
  expect(box.placeholder).toBe("—");
  expect(people).not.toHaveBeenCalled();
});

it("when it cannot be changed it shows the first two people and the rest in a popover count", () => {
  render(<PersonTitlePicker label="Job title of subordinates" multiple disabled value="A - X; B - Y; C - Z; D - W" onChange={vi.fn()} />);
  expect(screen.getByText("A - X")).toBeTruthy();
  expect(screen.getByText("B - Y")).toBeTruthy();
  expect(screen.queryByText("C - Z")).toBeNull();
  expect(screen.getByRole("button", { name: "View 2 more" })).toBeTruthy();
});

it("a single person still uses the single select", () => {
  people.mockResolvedValue([]);
  render(<PersonTitlePicker label="Substitute in absence" value="" onChange={vi.fn()} />);
  expect(screen.getByTestId("select")).toBeTruthy();
});
