import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentControlVisibilityPicker } from "../DocumentControlVisibilityPicker";
import { DOCUMENT_CONTROL_VIEW_ALL_CODES, DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE } from "../documentControlVisibility";

const none = new Set<string>();

describe("DocumentControlVisibilityPicker", () => {
  it("shows the three levels and marks the one the permissions grant", () => {
    render(<DocumentControlVisibilityPicker selectedCodes={new Set([DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE])} lockedCodes={none} onChoose={() => {}} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
  });

  it("reports the choice", () => {
    const onChoose = vi.fn();
    render(<DocumentControlVisibilityPicker selectedCodes={none} lockedCodes={none} onChoose={onChoose} />);
    fireEvent.click(screen.getAllByRole("radio")[2]);
    expect(onChoose).toHaveBeenCalledWith("VIEW_EVERYTHING");
    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(onChoose).toHaveBeenCalledWith("DEPARTMENT");
  });

  it("does not let a level that comes from a shared set be lowered, and says which set grants it", () => {
    const all = new Set<string>(DOCUMENT_CONTROL_VIEW_ALL_CODES);
    const notes = new Map<string, string>(DOCUMENT_CONTROL_VIEW_ALL_CODES.map((c) => [c, "Granted by shared set: Document Control - View Everything"]));
    render(<DocumentControlVisibilityPicker selectedCodes={all} lockedCodes={all} lockedNotes={notes} onChoose={() => {}} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.getAttribute("aria-disabled") === "true")).toEqual([true, true, false]);
    expect(screen.getByText(/Document Control - View Everything/)).toBeTruthy();
  });

  it("warns about an incomplete bundle and leaves no level selected", () => {
    render(<DocumentControlVisibilityPicker selectedCodes={new Set(["documents.document.view_all"])} lockedCodes={none} onChoose={() => {}} />);
    expect((screen.getAllByRole("radio") as HTMLInputElement[]).some((r) => r.checked)).toBe(false);
    expect(screen.getByText(/only part of/i)).toBeTruthy();
  });

  it("is read-only when the person may not edit", () => {
    render(<DocumentControlVisibilityPicker selectedCodes={none} lockedCodes={none} disabled onChoose={() => {}} />);
    expect((screen.getAllByRole("radio") as HTMLInputElement[]).every((r) => r.getAttribute("aria-disabled") === "true")).toBe(true);
  });
});
