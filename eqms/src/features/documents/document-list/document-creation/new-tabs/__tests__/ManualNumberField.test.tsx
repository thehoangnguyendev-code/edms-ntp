import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ManualNumberField } from "../ManualNumberField";

describe("ManualNumberField", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const type = (value: string) => {
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value } });
  };
  const settle = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
  };

  it("warns at once when the typed number is already used, and reports it as not accepted", async () => {
    const runCheck = vi.fn(async (typed: string) =>
      typed ? { valid: false, message: "This number is already used by SOP.0003 - Admin SOP (Draft). Choose another number." } : { valid: false, suggestion: "SOP.0008" },
    );
    const onValueChange = vi.fn();
    render(<ManualNumberField label="Document Number" runCheck={runCheck} onValueChange={onValueChange} />);

    type("sop.0003");
    await settle();

    expect(screen.getByText(/already used by SOP.0003/)).toBeTruthy();
    expect(onValueChange).toHaveBeenLastCalledWith("SOP.0003", false);
    expect(runCheck).toHaveBeenCalledWith("SOP.0003");
  });

  it("accepts a free number, and shows a warning (still accepted) when the server flags it", async () => {
    const runCheck = vi.fn(async (typed: string) =>
      typed ? { valid: true, warning: true, message: "This number is far ahead of the next one (SOP.0008)." } : { valid: false, suggestion: "SOP.0008" },
    );
    const onValueChange = vi.fn();
    render(<ManualNumberField label="Document Number" runCheck={runCheck} onValueChange={onValueChange} />);

    type("SOP.0500");
    await settle();

    expect(screen.getByText(/far ahead/)).toBeTruthy();
    expect(onValueChange).toHaveBeenLastCalledWith("SOP.0500", true);
  });

  it("offers the next number when nothing is typed, and does not check while the box is blocked", async () => {
    const runCheck = vi.fn(async () => ({ valid: false, suggestion: "SOP.0008" }));
    const { rerender } = render(<ManualNumberField label="Document Number" runCheck={runCheck} blockedReason="Choose the Document Type first." />);
    await settle();
    expect(runCheck).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);

    rerender(<ManualNumberField label="Document Number" runCheck={runCheck} />);
    await settle();
    expect(screen.getByText("Use SOP.0008")).toBeTruthy();
    fireEvent.click(screen.getByText("Use SOP.0008"));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("SOP.0008");
  });

  it("changes a saved number only with a reason and a valid number", async () => {
    const runCheck = vi.fn(async (typed: string) => ({ valid: Boolean(typed) && typed !== "SOP.0001", message: typed === "SOP.0001" ? "This number is already used." : null }));
    const applyChange = vi.fn(async (typed: string) => typed);
    const onChanged = vi.fn();
    render(
      <ManualNumberField
        label="Document Number"
        savedNumber="SOP.0008"
        runCheck={runCheck}
        loadChangeState={async () => ({ editable: true })}
        applyChange={applyChange}
        onChanged={onChanged}
      />,
    );
    await settle();
    fireEvent.click(screen.getByText("Change"));

    type("SOP.0009");
    await settle();
    const save = screen.getByText("Save number") as HTMLButtonElement;
    expect(save.disabled).toBe(true); // no reason yet

    fireEvent.change(screen.getByPlaceholderText(/Reason for the change/), { target: { value: "typed the wrong one" } });
    await settle();
    expect((screen.getByText("Save number") as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByText("Save number"));
    });
    expect(applyChange).toHaveBeenCalledWith("SOP.0009", "typed the wrong one");
    expect(onChanged).toHaveBeenCalledWith("SOP.0009");
  });

  it("shows why a saved number can no longer be changed", async () => {
    render(
      <ManualNumberField
        label="Document Number"
        savedNumber="SOP.0008"
        runCheck={async () => ({ valid: true })}
        loadChangeState={async () => ({ editable: false, message: "A source file is already stored under this number." })}
        applyChange={async (typed) => typed}
      />,
    );
    await settle();
    expect(screen.getByText(/source file is already stored/)).toBeTruthy();
    expect(screen.queryByText("Change")).toBeNull();
  });
});
