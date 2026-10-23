import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrainingMatrixRow, TrainingPosition } from "@/services/api/trainingActivities";
import { CompletionHeatmap } from "../../../compliance/components/CompletionHeatmap";
import { TrainingMatrixGrid } from "../TrainingMatrixGrid";

afterEach(cleanup);

const positions: TrainingPosition[] = [{ id: "p1", code: "OP", name: "Operator" }, { id: "p2", code: "QC", name: "QC Analyst" }];
const rows: TrainingMatrixRow[] = [
  { rowGroup: "FACTORY_GENERAL", topicId: "t1", topicCode: "GMP", topicName: "GMP overview", annualRequired: true, positionIds: ["p1"] },
  { rowGroup: "SOP", documentId: "d1", documentNumber: "SOP.0003", documentName: "Training", annualRequired: false, positionIds: ["p1", "p2"] },
];

describe("TrainingMatrixGrid (APD.0011 layout)", () => {
  it("shows No, SOP No, title, the positions under Work position, and Annual Yes/No, in groups", () => {
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("Work position")).toBeTruthy();
    expect(screen.getByText("SOP No")).toBeTruthy();
    expect(screen.getByText("Subject / SOP title")).toBeTruthy();
    expect(screen.getByText("General training of the whole factory")).toBeTruthy();
    expect(screen.getByText("SOP for each position")).toBeTruthy();
    expect(screen.getByText("GMP overview")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Operator" })).toBeTruthy();
  });

  it("shows only the rows of the chosen position and collapses a group", () => {
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Show only the rows of a position"), { target: { value: "p2" } });
    expect(screen.queryByText("GMP overview")).toBeNull();
    expect(screen.getByText("Training")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse SOP for each position" }));
    expect(screen.queryByText("Training")).toBeNull();
  });

  it("marks what was added, removed and changed against the version before", () => {
    const before: TrainingMatrixRow[] = [
      { rowGroup: "SOP", documentId: "d1", documentNumber: "SOP.0003", documentName: "Training", annualRequired: false, positionIds: ["p1"] },
      { rowGroup: "SOP", documentId: "d9", documentNumber: "SOP.0009", documentName: "Gone", annualRequired: false, positionIds: ["p1"] },
    ];
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} baseline={before} baselineNo={1} />);

    expect(screen.getByText(/Compared with version 1: 1 added, 1 removed, 1 changed/)).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText(/Removed: SOP.0009 Gone/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Changes only" }));
    expect(screen.queryByText("GMP overview")).toBeTruthy();
  });

  it("toggles a position and the annual flag only when editing, and counts the rows per position", () => {
    const onToggle = vi.fn();
    const onAnnual = vi.fn();
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing onToggle={onToggle} onAnnual={onAnnual} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "GMP GMP overview — QC Analyst" }));
    expect(onToggle).toHaveBeenCalledWith(0, "p2");
    fireEvent.click(screen.getByRole("switch", { name: "Annual training required: Training" }));
    expect(onAnnual).toHaveBeenCalledWith(1, true);
    const footer = screen.getByText("Rows required of the position").closest("tr") as HTMLElement;
    expect(within(footer).getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox", { name: "GMP GMP overview — Operator" }).getAttribute("aria-checked")).toBe("true");
  });

  it("has no checkboxes when it is only being read", () => {
    render(<TrainingMatrixGrid rows={rows} positions={positions} editing={false} onToggle={vi.fn()} onAnnual={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
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
