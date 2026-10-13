import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrainingInformationTab } from "../TrainingInformationTab";

describe("TrainingInformationTab planned date", () => {
  it("takes the planned date typed by hand, adds the slashes, and still works out the period end", () => {
    const onChange = vi.fn();
    render(
      <TrainingInformationTab
        canEditPlannedDate
        onChange={onChange}
        data={{ trainingPeriodDays: 10 }}
      />,
    );

    const input = screen.getByPlaceholderText("dd/mm/yyyy") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "10102026" } });

    expect(input.value).toBe("10/10/2026");
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.trainingPlannedDate).toBe("10/10/2026");
    expect(last.trainingPeriodEndDate).toContain("20/10/2026");
  });

  it("refuses a date that does not exist, and says so once the field has been touched", () => {
    render(<TrainingInformationTab canEditPlannedDate data={{ trainingPeriodDays: 10 }} />);

    const input = screen.getByPlaceholderText("dd/mm/yyyy") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "31022026" } });

    expect(input.value).toBe("31/02/2026");
    expect(screen.getByText("Enter a real date as dd/mm/yyyy.")).toBeTruthy();
  });

  it("stays read-only for users without the planned-date permission", () => {
    render(<TrainingInformationTab data={{ trainingPeriodDays: 10 }} />);
    expect((screen.getByPlaceholderText("dd/mm/yyyy") as HTMLInputElement).disabled).toBe(true);
  });

  it("takes the planned date from the calendar too, and never fills it in on its own", () => {
    const onChange = vi.fn();
    const { container } = render(<TrainingInformationTab canEditPlannedDate onChange={onChange} data={{ trainingPeriodDays: 10 }} />);

    expect((screen.getByPlaceholderText("dd/mm/yyyy") as HTMLInputElement).value).toBe("");
    expect(onChange.mock.calls.every(([v]) => !v.trainingPlannedDate)).toBe(true);

    const calendar = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(calendar, { target: { value: "2026-10-10" } });

    expect((screen.getByPlaceholderText("dd/mm/yyyy") as HTMLInputElement).value).toBe("10/10/2026");
  });
});
