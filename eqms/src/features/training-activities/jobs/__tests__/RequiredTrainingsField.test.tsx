import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDocumentsPage: vi.fn() }));
vi.mock("@/services/api/documents", () => ({ documentApi: api }));

import { RequiredTrainingsField, type PickedTraining } from "../RequiredTrainingsField";

const docs = [
  { id: "d1", documentNumber: "SOP.0003", documentName: "Personnel training" },
  { id: "d2", documentNumber: "SOP.0010", documentName: "Hygiene" },
];

const Harness = ({ initial = [] as PickedTraining[], onValue, showChosen }: { initial?: PickedTraining[]; onValue?: (v: PickedTraining[]) => void; showChosen?: boolean }) => {
  const [value, setValue] = useState(initial);
  return <RequiredTrainingsField value={value} showChosen={showChosen} onChange={(next) => { setValue(next); onValue?.(next); }} />;
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  api.getDocumentsPage.mockReset().mockResolvedValue({ data: docs, pagination: { page: 1, limit: 10, total: 25, totalPages: 3 } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("RequiredTrainingsField", () => {
  it("asks the server for SOPs in effect, one page at a time, and ticks and unticks one", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    const box = await screen.findByRole("checkbox", { name: /Personnel training/ });
    expect(api.getDocumentsPage).toHaveBeenCalledWith(expect.objectContaining({ status: "EFFECTIVE", page: 1, limit: 10 }));
    fireEvent.click(box);
    expect(onValue).toHaveBeenLastCalledWith([expect.objectContaining({ kind: "DOCUMENT", id: "d1", code: "SOP.0003" })]);
    fireEvent.click(box);
    expect(onValue).toHaveBeenLastCalledWith([]);

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(api.getDocumentsPage).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });

  it("offers the typed text as a Training Topic", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.change(screen.getByPlaceholderText("Search a SOP, or type a Training Topic..."), { target: { value: "Gowning" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Gowning/ }));
    expect(onValue).toHaveBeenLastCalledWith([{ kind: "TOPIC", id: "Gowning", code: "", title: "Gowning" }]);
  });

  it("shows a chosen SOP that is not on the shown page, and removes it", async () => {
    const onValue = vi.fn();
    render(<Harness showChosen onValue={onValue} initial={[{ kind: "DOCUMENT", id: "d99", code: "SOP.0099", title: "Cleaning" }]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove SOP.0099 — Cleaning" }));
    expect(onValue).toHaveBeenLastCalledWith([]);
  });

  it("says when the SOPs could not be loaded", async () => {
    api.getDocumentsPage.mockRejectedValue(new Error("down"));
    render(<Harness />);
    expect(await screen.findByText(/The list of SOPs could not be loaded/)).toBeTruthy();
  });

  it("only lists what is chosen when it cannot be edited", () => {
    render(<RequiredTrainingsField disabled value={[{ kind: "TOPIC", id: "Gowning", code: "", title: "Gowning" }]} onChange={vi.fn()} />);

    expect(screen.getByText("Gowning")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(api.getDocumentsPage).not.toHaveBeenCalled();
  });
});
