import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormModal } from "../FormModal";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FormModal focus", () => {
  it("moves focus to the first button when nothing inside the dialog has focus yet", () => {
    vi.useFakeTimers();
    render(
      <FormModal isOpen onClose={() => undefined} title="Reason" confirmText="Save" onConfirm={() => undefined}>
        <textarea aria-label="Reason text" />
      </FormModal>,
    );
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });

  it("does not take focus back from a field the person has already moved to", () => {
    vi.useFakeTimers();
    render(
      <FormModal isOpen onClose={() => undefined} title="Reason" confirmText="Save" onConfirm={() => undefined}>
        <textarea aria-label="Reason text" />
      </FormModal>,
    );
    const field = screen.getByLabelText("Reason text");
    act(() => {
      field.focus();
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(document.activeElement).toBe(field);
  });
});
