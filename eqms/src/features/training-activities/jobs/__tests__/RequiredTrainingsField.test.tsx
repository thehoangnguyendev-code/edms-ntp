import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDocumentsPage: vi.fn() }));
vi.mock("@/services/api/documents", () => ({ documentApi: api }));

import { RequiredTrainingsField, type PickedTraining } from "../RequiredTrainingsField";

const docs = [
  { id: "d1", documentNumber: "SOP.0003", documentName: "Training" },
  { id: "d2", documentNumber: "SOP.0010", documentName: "Hygiene" },
];

const Harness = ({ initial = [] as PickedTraining[], onValue }: { initial?: PickedTraining[]; onValue?: (v: PickedTraining[]) => void }) => {
  const [value, setValue] = useState(initial);
  return <RequiredTrainingsField value={value} onChange={(next) => { setValue(next); onValue?.(next); }} />;
};

beforeEach(() => api.getDocumentsPage.mockReset().mockResolvedValue({ data: docs }));
afterEach(cleanup);

describe("RequiredTrainingsField", () => {
  it("moves a SOP from the available list to the chosen list with the arrow, and back", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.click(await screen.findByText("Training"));
    fireEvent.click(screen.getByRole("button", { name: "Move to selected" }));
    expect(onValue).toHaveBeenLastCalledWith([{ kind: "DOCUMENT", id: "d1", code: "SOP.0003", title: "Training" }]);
    expect(screen.getByText("Selected Trainings (1)")).toBeTruthy();

    fireEvent.click(within(screen.getByRole("listbox", { name: "Selected trainings" })).getByText("Training"));
    fireEvent.click(screen.getByRole("button", { name: "Move to available" }));
    expect(onValue).toHaveBeenLastCalledWith([]);
  });

  it("moves one with a double click, and offers the typed text as a Training Topic", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await screen.findByText("Hygiene");

    fireEvent.change(screen.getByLabelText("Search available trainings"), { target: { value: "Gowning" } });
    const topic = await screen.findByText("Gowning");
    fireEvent.doubleClick(topic);

    await waitFor(() => expect(onValue).toHaveBeenLastCalledWith([{ kind: "TOPIC", id: "Gowning", code: "", title: "Gowning" }]));
  });

  it("moves a training by dragging it to the other list, and back", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const store: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => { store[k] = v; }, getData: (k: string) => store[k] ?? "", effectAllowed: "", dropEffect: "" };

    fireEvent.dragStart((await screen.findByText("Training")).closest("[role=option]")!, { dataTransfer });
    fireEvent.drop(screen.getByRole("listbox", { name: "Selected trainings" }), { dataTransfer });
    expect(onValue).toHaveBeenLastCalledWith([expect.objectContaining({ id: "d1" })]);

    fireEvent.dragStart(within(screen.getByRole("listbox", { name: "Selected trainings" })).getByText("Training").closest("[role=option]")!, { dataTransfer });
    fireEvent.drop(screen.getByRole("listbox", { name: "Available trainings" }), { dataTransfer });
    expect(onValue).toHaveBeenLastCalledWith([]);
  });

  it("does not offer a SOP that is already chosen", async () => {
    render(<Harness initial={[{ kind: "DOCUMENT", id: "d1", code: "SOP.0003", title: "Training" }]} />);
    await screen.findByText("Hygiene");

    expect(within(screen.getByRole("listbox", { name: "Available trainings" })).queryByText("Training")).toBeNull();
  });

  it("asks only for the SOPs that are in effect", async () => {
    render(<Harness />);
    await screen.findByText("Hygiene");

    expect(api.getDocumentsPage).toHaveBeenCalledWith(expect.objectContaining({ status: "EFFECTIVE" }));
  });

  it("only lists what is chosen when it cannot be edited", () => {
    render(<RequiredTrainingsField disabled value={[{ kind: "TOPIC", id: "Gowning", code: "", title: "Gowning" }]} onChange={vi.fn()} />);

    expect(screen.getByText("Gowning")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Move to selected" })).toBeNull();
    expect(api.getDocumentsPage).not.toHaveBeenCalled();
  });
});

