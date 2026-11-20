import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardReviewStep } from "../WizardReviewStep";

const base = {
  name: "QA Reviewer",
  description: "Reviews documents",
  permissionMode: "existing" as const,
  sets: [{ id: "s1", name: "Document Reviewer", count: 24 }, { id: "s2", name: "Training Viewer", count: 9 }],
  permissionTotal: 32,
  permissionsByModule: { "Document Control": 23, "Training Management": 9 },
  visibility: [{ module: "Document Control", level: "Records of the person’s department" }],
  roles: [{ code: "DOC_REVIEWER", label: "Document Reviewer", module: "documents" }],
  users: [{ id: "u1", fullName: "Nguyễn Thị Phương Thảo Anh", employeeCode: "NTP.0017", department: "Quality Assurance" }],
};

// the laptop table and the phone list are both in the DOM (the screen width decides which one shows), so a text may appear in both
describe("WizardReviewStep (matrix by module)", () => {
  it("shows one row per module with its permissions, records and roles, and the distinct total", () => {
    render(<WizardReviewStep {...base} onEdit={vi.fn()} />);
    expect(screen.getAllByText("Document Control").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Training Management").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Records of the person’s department").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Document Reviewer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("32").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 permission sets: Document Reviewer \(24\), Training Viewer \(9\)/)).toBeTruthy();
    expect(screen.getAllByText("NTP.0017").length).toBeGreaterThan(0);
  });

  it("shows permissions the catalogue does not place in a module on an Other line, so the total is never hidden", () => {
    render(<WizardReviewStep {...base} permissionTotal={34} onEdit={vi.fn()} />);
    expect(screen.getAllByText("Other").length).toBeGreaterThan(0);
  });

  it("on a phone a module opens on a tap to show its records and roles, one at a time", () => {
    render(<WizardReviewStep {...base} onEdit={vi.fn()} />);
    const lines = screen.getAllByRole("button", { expanded: false });
    expect(lines).toHaveLength(2);
    fireEvent.click(lines[0]);
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
  });

  it("says so when nothing is granted and when there are no users, and the Edit links go to the deciding step", () => {
    const onEdit = vi.fn();
    render(<WizardReviewStep {...base} sets={[]} permissionTotal={0} permissionsByModule={{}} visibility={[]} roles={[]} users={[]} onEdit={onEdit} />);
    expect(screen.getByText(/grants nothing yet/)).toBeTruthy();
    expect(screen.getByText(/assign users later/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    expect(onEdit).toHaveBeenCalledWith(3);
  });
});
