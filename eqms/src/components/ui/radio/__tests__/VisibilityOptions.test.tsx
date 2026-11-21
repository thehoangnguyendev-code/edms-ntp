import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VisibilityOptions } from "../VisibilityOptions";

const options = [
  { value: "A", label: "Only named", description: "a" },
  { value: "B", label: "Department", description: "b" },
  { value: "C", label: "All records", description: "c", disabled: true },
];

describe("VisibilityOptions: the frame of the chosen card", () => {
  it("has one frame, shown when a level is chosen and hidden when none is", () => {
    const { rerender } = render(<VisibilityOptions name="v" value="B" options={options} onChange={vi.fn()} />);
    const frame = screen.getByTestId("visibility-frame");
    expect(frame.style.visibility).toBe("inherit");
    rerender(<VisibilityOptions name="v" value="" options={options} onChange={vi.fn()} />);
    expect(screen.getByTestId("visibility-frame").style.visibility).toBe("hidden");
  });

  it("still behaves as a radio group: the choice is made on the radio, and a locked level cannot be chosen", () => {
    const onChange = vi.fn();
    render(<VisibilityOptions name="v" value="A" options={options} onChange={onChange} />);
    expect((screen.getByRole("radio", { name: /Only named/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Department/ }));
    expect(onChange).toHaveBeenCalledWith("B");
    onChange.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: /All records/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is hidden from assistive technology, so the radios stay the only controls", () => {
    render(<VisibilityOptions name="v" value="A" options={options} onChange={vi.fn()} />);
    expect(screen.getByTestId("visibility-frame").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
});
