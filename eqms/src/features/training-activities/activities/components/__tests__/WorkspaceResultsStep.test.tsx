import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceResultsStep } from "../workspace/WorkspaceResultsStep";

afterEach(cleanup);

describe("WorkspaceResultsStep", () => {
  it("offers the supplementary training for the people who were absent or did not pass", () => {
    const onArrange = vi.fn();
    render(<WorkspaceResultsStep table={<div>results table</div>} absent={2} failed={1} canArrange onArrange={onArrange} />);

    expect(screen.getByText(/2 absent and 1 did not pass/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Arrange supplementary training" }));
    expect(onArrange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("results table")).toBeTruthy();
  });

  it("says nothing when everyone attended and passed", () => {
    render(<WorkspaceResultsStep table={<div>results table</div>} absent={0} failed={0} canArrange onArrange={() => undefined} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the notice but no button to a person who may not arrange training", () => {
    render(<WorkspaceResultsStep table={<div>results table</div>} absent={0} failed={3} canArrange={false} onArrange={() => undefined} />);

    expect(screen.getByText(/3 did not pass/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Arrange supplementary training" })).toBeNull();
  });
});
