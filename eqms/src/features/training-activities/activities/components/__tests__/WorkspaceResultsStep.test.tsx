import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceResultsStep } from "../workspace/WorkspaceResultsStep";

afterEach(cleanup);

describe("WorkspaceResultsStep", () => {
  it("tells that the people who were absent or did not pass are trained again after the training is Completed, and offers no button here", () => {
    render(<WorkspaceResultsStep table={<div>results table</div>} absent={2} failed={1} />);

    expect(screen.getByText(/2 absent and 1 did not pass/)).toBeTruthy();
    expect(screen.getByText(/after the training is Completed/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /supplementary training/i })).toBeNull();
    expect(screen.getByText("results table")).toBeTruthy();
  });

  it("says nothing when everyone attended and passed", () => {
    render(<WorkspaceResultsStep table={<div>results table</div>} absent={0} failed={0} />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
