import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrainingMatrixRow, TrainingPosition } from "@/services/api/trainingActivities";
import { CompletionHeatmap } from "../../../compliance/components/CompletionHeatmap";
import { TrainingMatrixGrid } from "../TrainingMatrixGrid";

afterEach(cleanup);

const positions: TrainingPosition[] = [{ id: "p1", code: "OP", name: "Operator" }, { id: "p2", code: "QC", name: "QC Analyst" }];
const rows: TrainingMatrixRow[] = [
  { rowGroup: "FACTORY_GENERAL", topicText: "GMP overview", annualRequired: true, positionIds: ["p1"] },
  { rowGroup: "SOP", documentId: "d1", documentNumber: "SOP.0003", documentName: "Training", annualRequired: false, positionIds: ["p1", "p2"] },
];

describe("TrainingMatrixGrid (APD.0011 layout)", () => {
  it("shows No, SOP No, title, the positions under Work position, and Annual Yes/No, in groups", () => {
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getAllByText("Work Position").length).toBeGreaterThan(0);
    expect(screen.getByText("Code")).toBeTruthy();
    expect(screen.getByText("Subject / Title")).toBeTruthy();
    expect(screen.getByText("General training of the whole factory")).toBeTruthy();
    expect(screen.getByText("SOP for each Work Position")).toBeTruthy();
    expect(screen.getByText("GMP overview")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Operator" })).toBeTruthy();
  });

  it("shows only the rows of the chosen position and collapses and expands a group", async () => {
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Work Position" }));
    fireEvent.click(await screen.findByRole("option", { name: "QC Analyst" }));
    expect(screen.queryByText("GMP overview")).toBeNull();
    expect(screen.getByText("Training")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Operator" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "QC Analyst" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse SOP for each Work Position" }));
    await waitFor(() => expect(screen.queryByText("Training")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Expand SOP for each Work Position" }));
    expect(await screen.findByText("Training")).toBeTruthy();
  });

  it("marks what was added, removed and changed against the version before", async () => {
    const before: TrainingMatrixRow[] = [
      { rowGroup: "SOP", documentId: "d1", documentNumber: "SOP.0003", documentName: "Training", annualRequired: false, positionIds: ["p1"] },
      { rowGroup: "SOP", documentId: "d9", documentNumber: "SOP.0009", documentName: "Gone", annualRequired: false, positionIds: ["p1"] },
    ];
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} baseline={before} baselineNo={1} />);

    expect(screen.getByText(/Compared with version 1: 1 added, 1 removed, 1 changed/)).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText(/Removed: SOP.0009 Gone/)).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "Changes" }));
    fireEvent.click(await screen.findByRole("option", { name: "Changed since the previous version" }));
    expect(screen.queryByText("GMP overview")).toBeTruthy();
  });

  it("toggles a position and the annual flag only when editing, and counts the rows per position", () => {
    const onToggle = vi.fn();
    const onAnnual = vi.fn();
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing onToggle={onToggle} onAnnual={onAnnual} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "GMP overview — QC Analyst" }));
    expect(onToggle).toHaveBeenCalledWith(0, "p2");
    fireEvent.click(screen.getByRole("switch", { name: "Annual training required: Training" }));
    expect(onAnnual).toHaveBeenCalledWith(1, true);
    const footer = screen.getByText("Rows required of the Work Position").closest("tr") as HTMLElement;
    expect(within(footer).getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox", { name: "GMP overview — Operator" }).getAttribute("aria-checked")).toBe("true");
  });

  it("has no checkboxes when it is only being read", () => {
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("drags the matrix horizontally without taking over checkbox clicks", () => {
    const onToggle = vi.fn();
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing onToggle={onToggle} onAnnual={vi.fn()} onRemove={vi.fn()} />);
    const scroller = screen.getByRole("table").parentElement as HTMLDivElement;
    fireEvent.mouseDown(scroller, { button: 0, clientX: 300, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 200, clientY: 10 });
    expect(scroller.scrollLeft).toBe(100);
    expect(scroller.className).toContain("cursor-grabbing");
    fireEvent.mouseUp(scroller, { clientX: 200, clientY: 10 });
    fireEvent.click(scroller);
    const checkbox = screen.getByRole("checkbox", { name: "GMP overview — QC Analyst" });
    fireEvent.mouseDown(checkbox, { button: 0, clientX: 300, clientY: 10 });
    fireEvent.mouseMove(scroller, { clientX: 100, clientY: 10 });
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith(0, "p2");
    expect(scroller.scrollLeft).toBe(100);
  });

  it("uses a sticky, centered Work Position label without a scroll position handler", () => {
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} />);
    const scroller = screen.getByRole("table").parentElement as HTMLDivElement;
    const roleHeader = screen.getByRole("columnheader", { name: "Work Position" });
    const label = within(roleHeader).getByText("Work Position");
    expect(scroller.className).toContain("[container-type:inline-size]");
    expect(label.className).toContain("sticky");
    expect(label.className).toContain("text-center");
    expect(label.className).toContain("md:w-[min(100%,calc(100cqw-540px))]");
    fireEvent.scroll(scroller);
    expect(label.style.left).toBe("");
  });
});

describe("CompletionHeatmap", () => {
  const columns = [
    { rowId: "r1", group: "FACTORY_GENERAL" as const, code: "GMP", title: "GMP overview", annual: true },
    { rowId: "r2", group: "SOP" as const, code: "SOP.0003", title: "Training", annual: false },
  ];
  const people = [{ personId: "u1", fullName: "Nguyen Van An", employeeCode: "NTP.0005", done: 1, required: 2, eligibleForAssignment: false, cells: { r1: { status: "QUALIFIED" as const }, r2: { status: "REQUIRED" as const } } }];

  it("shows the code over the title of each column, one coloured cell per state, and opens the cell that is pressed", () => {
    const onPick = vi.fn();
    render(<CompletionHeatmap people={people} columns={columns} firstNo={21} onPick={onPick} />);

    expect(screen.getByText("GMP")).toBeTruthy();
    expect(screen.getByText("Factory")).toBeTruthy();
    expect(screen.getByText("Annual")).toBeTruthy();
    expect(screen.getByText("21")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Required: Nguyen Van An, Training" }));
    expect(onPick).toHaveBeenCalledWith(people[0], columns[1], { status: "REQUIRED" });
    expect(screen.getByRole("button", { name: "Qualified: Nguyen Van An, GMP overview" })).toBeTruthy();
  });

  it("draws only the people in view, however many are loaded, and asks for the next page when the list does not fill the box", async () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ personId: "u" + i, fullName: "Person " + i, employeeCode: "E" + i, done: 0, required: 2, eligibleForAssignment: false, cells: { r1: { status: "REQUIRED" as const }, r2: { status: "QUALIFIED" as const } } }));
    const onNearEnd = vi.fn();
    render(<CompletionHeatmap people={many} columns={columns} firstNo={1} onPick={vi.fn()} onNearEnd={onNearEnd} />);

    expect(screen.queryByText("Person 0")).toBeTruthy();
    expect(screen.queryByText("Person 299")).toBeNull();
    expect(document.querySelectorAll("tbody tr").length).toBeLessThan(40);
    await waitFor(() => expect(onNearEnd).toHaveBeenCalled());
  });
});
