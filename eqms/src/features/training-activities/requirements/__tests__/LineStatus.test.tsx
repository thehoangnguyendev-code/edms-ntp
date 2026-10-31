import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LineStatus } from "../TrainingRequirementDetailPage";

afterEach(cleanup);

describe("LineStatus of a line of a Training Requirement", () => {
  it("shows the status of the activity once one is opened for the line, the same words as the page of the activity", () => {
    render(<LineStatus line={{ lineStatus: "IN_PROGRESS", activityId: "a1", activityStatus: "PLANNED" }} />);
    expect(screen.getByText("Planned")).toBeTruthy();
    expect(screen.queryByText("In Progress")).toBeNull();
  });
  it.each([["NOTIFIED", "Notified"], ["IN_PROGRESS", "In Progress"], ["PENDING_QA_CONFIRMATION", "Pending QA Confirmation"], ["COMPLETED", "Completed"]])("%s -> %s", (status, label) => {
    render(<LineStatus line={{ lineStatus: "IN_PROGRESS", activityId: "a1", activityStatus: status }} />);
    expect(screen.getByText(label)).toBeTruthy();
  });
  it("shows the status of the plan when there is no activity, or the activity was cancelled", () => {
    render(<LineStatus line={{ lineStatus: "POSTPONED" }} />);
    expect(screen.getByText("Postponed")).toBeTruthy();
    cleanup();
    render(<LineStatus line={{ lineStatus: "PLANNED", activityId: "a1", activityStatus: "CANCELLED" }} />);
    expect(screen.getByText("Planned")).toBeTruthy();
  });
});
