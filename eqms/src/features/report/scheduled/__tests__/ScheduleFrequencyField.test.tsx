import "../../testing/browserStubs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduleFrequencyField } from "../ScheduleFrequencyField";

afterEach(cleanup);

function Harness({ start, onCron }: { start: string; onCron: (cron: string) => void }) {
  const [cron, setCron] = useState(start);
  return (
    <ScheduleFrequencyField
      cron={cron}
      onChange={(next) => {
        setCron(next);
        onCron(next);
      }}
    />
  );
}

describe("ScheduleFrequencyField", () => {
  it("opens a schedule on the choices its cron stands for, and says it in words", () => {
    render(<Harness start="0 0 8 * * MON-FRI" onCron={vi.fn()} />);

    expect(screen.getByText(/Every weekday, Monday to Friday, at 08:00 \(UTC\+7\)\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Monday")).toBeChecked();
    expect(screen.getByLabelText("Saturday")).not.toBeChecked();
  });

  it("any days of the week can be chosen, and the cron follows", () => {
    const onCron = vi.fn();
    render(<Harness start="0 0 8 * * MON-FRI" onCron={onCron} />);

    fireEvent.click(screen.getByLabelText("Tuesday"));
    fireEvent.click(screen.getByLabelText("Thursday"));
    fireEvent.click(screen.getByLabelText("Saturday"));

    expect(onCron).toHaveBeenLastCalledWith("0 0 8 * * MON,WED,FRI,SAT");
    expect(screen.getByText(/Every Monday, Wednesday, Friday and Saturday at 08:00/)).toBeInTheDocument();
  });

  it("the last day that is ticked cannot be unticked: a weekly schedule on no day never runs", () => {
    render(<Harness start="0 0 8 * * MON" onCron={vi.fn()} />);

    expect(screen.getByLabelText("Monday")).toBeDisabled();
  });

  it("a custom cron is typed and kept exactly", () => {
    const onCron = vi.fn();
    render(<Harness start="0 0 7 ? * MON#1" onCron={onCron} />);

    expect(screen.getByText("A custom schedule: 0 0 7 ? * MON#1 (UTC+7).")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Cron Expression/), { target: { value: "0 0 6 * * MON,FRI" } });

    expect(onCron).toHaveBeenLastCalledWith("0 0 6 * * MON,FRI");
  });

  it("a daily schedule has a time and no weekdays; a monthly one can be on the last day", () => {
    render(<Harness start="0 30 6 * * *" onCron={vi.fn()} />);

    expect(screen.getByText("Every day at 06:30 (UTC+7).")).toBeInTheDocument();
    expect(screen.queryByText("Days Of The Week")).not.toBeInTheDocument();
    cleanup();
    render(<Harness start="0 0 8 L * *" onCron={vi.fn()} />);
    expect(screen.getByText("On the last day of every month at 08:00 (UTC+7).")).toBeInTheDocument();
  });
});
