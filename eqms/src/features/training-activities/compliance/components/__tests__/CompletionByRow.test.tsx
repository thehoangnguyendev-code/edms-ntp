import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CompletionColumn, CompletionSummary } from "@/services/api/trainingActivities";
import { CompletionByRow, CompletionSummaryStrip } from "../CompletionByRow";

afterEach(cleanup);

const columns: CompletionColumn[] = [
  { rowId: "r1", group: "FACTORY_GENERAL", code: "GMP", title: "GMP overview", annual: true },
  { rowId: "r2", group: "SOP", code: "SOP.0003", title: "Training", annual: false },
];
const summary: CompletionSummary = {
  people: 4, ready: 1, withGap: 2,
  rows: {
    r1: { counts: { QUALIFIED: 2, REQUIRED: 1, IN_PROGRESS: 1 }, open: [{ personId: "a", fullName: "Nguyen Van An", employeeCode: "E1", status: "REQUIRED" }, { personId: "b", fullName: "Tran Thi Binh", employeeCode: "E2", status: "IN_PROGRESS" }, { personId: "c", fullName: "Le Van Cuong", employeeCode: "E3", status: "DUE" }], moreOpen: 2 },
    r2: { counts: { QUALIFIED: 4 }, open: [], moreOpen: 0 },
  },
};

describe("CompletionByRow (APD.0011 layout)", () => {
  it("lists the rows in their groups with the SOP number, title and Annual Yes/No", () => {
    render(<CompletionByRow columns={columns} summary={summary} />);

    expect(screen.getAllByText("General training of the whole factory").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SOP for each position").length).toBeGreaterThan(0);
    expect(screen.getAllByText("GMP overview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SOP.0003").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Yes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No").length).toBeGreaterThan(0);
  });

  it("shows how far the row is through, from the server counts, and says when everyone is done", () => {
    render(<CompletionByRow columns={columns} summary={summary} />);

    expect(screen.getAllByText("2 / 4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4 / 4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Everyone is done").length).toBeGreaterThan(0);
  });

  it("names the people still to be trained when the row is opened, and says how many more there are", () => {
    render(<CompletionByRow columns={columns} summary={summary} />);
    expect(screen.queryByText("Le Van Cuong")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /Show the people still to be trained on GMP overview/ })[0]);

    expect(screen.getAllByText("Le Van Cuong").length).toBeGreaterThan(0);
    expect(screen.getAllByText("and 2 more").length).toBeGreaterThan(0);
  });

  it("totals the position: people, ready, with a gap and finished rows", () => {
    render(<CompletionSummaryStrip summary={summary} columns={columns} />);

    expect(screen.getByText("1 / 4")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });
});
