import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateTimePicker } from "../DateTimePicker";

function Harness({ initial = "", onValue }: { initial?: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateTimePicker
      monthOnly
      minMonth="2031-02"
      maxMonth="2031-11"
      value={value}
      placeholder="Select month"
      onChange={(v) => { setValue(v); onValue?.(v); }}
    />
  );
}

const month = (name: string) => screen.getByLabelText(name) as HTMLButtonElement;

describe("DateTimePicker monthOnly", () => {
  afterEach(cleanup);

  it("opens on the months, gives the first day of the chosen month and shows MM/yyyy", () => {
    const seen = vi.fn();
    render(<Harness initial="01/01/2031" onValue={seen} />);
    fireEvent.click(screen.getByText("01/2031"));
    expect(document.querySelector("[role=grid]")).toBeNull();
    fireEvent.click(month("March"));
    expect(seen).toHaveBeenCalledWith("01/03/2031");
    expect(screen.getByText("03/2031")).toBeTruthy();
  });

  it("does not allow a month outside min and max", () => {
    render(<Harness initial="01/05/2031" />);
    fireEvent.click(screen.getByText("05/2031"));
    expect(month("January").disabled).toBe(true);
    expect(month("December").disabled).toBe(true);
    expect(month("June").disabled).toBe(false);
  });
});
