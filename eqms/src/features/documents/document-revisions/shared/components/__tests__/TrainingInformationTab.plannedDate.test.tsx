import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrainingInformationTab } from "../TrainingInformationTab";

describe("TrainingInformationTab planned date", () => {
  it("is chosen with the same date picker as the other two dates, and still works out the period end", () => {
    const onChange = vi.fn();
    render(
      <TrainingInformationTab
        canEditPlannedDate
        onChange={onChange}
        data={{ trainingPlannedDate: "10/10/2026", trainingPeriodDays: 10 }}
      />,
    );

    expect(screen.getByText("Training Planned Date")).toBeTruthy();
    expect(screen.getByText("Training Period End Date")).toBeTruthy();
    expect(screen.getByText("Training Completion Date")).toBeTruthy();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.trainingPlannedDate).toBe("10/10/2026");
    expect(last.trainingPeriodEndDate).toContain("20/10/2026");
  });

  it("never fills the planned date in on its own", () => {
    const onChange = vi.fn();
    render(<TrainingInformationTab canEditPlannedDate onChange={onChange} data={{ trainingPeriodDays: 10 }} />);

    expect(screen.getByText("Select planned date")).toBeTruthy();
    expect(onChange.mock.calls.every(([value]) => !value.trainingPlannedDate)).toBe(true);
  });

  it("stays read-only for users without the planned-date permission", () => {
    render(<TrainingInformationTab data={{ trainingPlannedDate: "10/10/2026", trainingPeriodDays: 10 }} />);
    const trigger = screen.getByText("10/10/2026").closest("button");
    expect(trigger === null || trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true").toBe(true);
  });
});
