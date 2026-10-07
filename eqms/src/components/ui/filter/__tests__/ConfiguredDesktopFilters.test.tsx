import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfiguredDesktopFilters } from "../ConfiguredDesktopFilters";

const branding = vi.hoisted(() => ({ compactDesktopFilters: true }));
vi.mock("@/components/branding/BrandLogo", () => ({
  useBranding: () => branding,
}));
vi.mock("@/components/ui/datetime-picker/DateRangePicker", () => ({
  DateRangePicker: (props: any) => (
    <>
      <input
        aria-label="From"
        value={props.startDate}
        onChange={(e) => props.onStartDateChange(e.target.value)}
      />
      <input
        aria-label="To"
        value={props.endDate}
        onChange={(e) => props.onEndDateChange(e.target.value)}
      />
      <span>{props.includeTime ? "Date and time" : "Date only"}</span>
    </>
  ),
}));

const options = [
  { label: "All", value: "All" },
  { label: "Active", value: "ACTIVE" },
];
function setup(extra = {}) {
  const change = vi.fn();
  const view = render(
    <ConfiguredDesktopFilters
      search={<input aria-label="Search records" />}
      filters={[
        {
          id: "status",
          label: "Status",
          value: "All",
          options,
          onChange: change,
        },
      ]}
      {...extra}
    >
      <div>Classic filters</div>
    </ConfiguredDesktopFilters>,
  );
  return { change, ...view };
}
beforeEach(() => {
  branding.compactDesktopFilters = true;
});
describe("Configured desktop filter integration", () => {
  it("honors the saved branding toggle and restores the original classic filters", () => {
    branding.compactDesktopFilters = false;
    setup();
    expect(screen.getByText("Classic filters")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Filter" })).toBeNull();
  });
  it("renders existing shared compact UI, applying nothing before Apply", () => {
    const { change } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("radio", { name: "Active" }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("ACTIVE");
  });
  it("Cancel discards selections and reopening restores committed values", () => {
    const { change } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("radio", { name: "Active" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(change).not.toHaveBeenCalled();
  });
  it("Clear all also remains a draft until Apply", () => {
    const change = vi.fn();
    setup({
      filters: [
        {
          id: "status",
          label: "Status",
          value: "ACTIVE",
          options,
          onChange: change,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("All");
  });
  it("preserves atomic date range commits and includeTime without applying each edit", async () => {
    const from = vi.fn(),
      to = vi.fn(),
      apply = vi.fn();
    setup({
      dates: [
        {
          id: "created",
          label: "Created",
          from: "",
          to: "",
          onFromChange: from,
          onToChange: to,
          onApply: apply,
          includeTime: true,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Created" }));
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "05/10/2026 10:00:00" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "06/10/2026 20:00:00" },
    });
    await waitFor(() =>
      expect(screen.getByText("Date and time")).toBeVisible(),
    );
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      startDate: "05/10/2026 10:00:00",
      endDate: "06/10/2026 20:00:00",
    });
    expect(from).not.toHaveBeenCalled();
    expect(to).not.toHaveBeenCalled();
  });
  it("enables dependent department options against the draft business unit", () => {
    const unit = vi.fn(),
      department = vi.fn();
    setup({
      filters: [
        {
          id: "unit",
          label: "Unit",
          value: "All",
          options: [
            { label: "All", value: "All" },
            { label: "Quality", value: "QA" },
          ],
          onChange: unit,
          resetOnChange: { department: "All" },
        },
        {
          id: "department",
          label: "Department",
          value: "All",
          options: [],
          isDisabled: (draft: any) => draft.unit === "All",
          getOptions: (draft: any) =>
            draft.unit === "QA"
              ? [{ label: "QA Department", value: "QA Dept" }]
              : [],
          onChange: department,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("radio", { name: "Quality" }));
    fireEvent.click(screen.getByRole("button", { name: "Department" }));
    fireEvent.click(screen.getByRole("radio", { name: "QA Department" }));
    expect(unit).not.toHaveBeenCalled();
    expect(department).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(unit).toHaveBeenCalledWith("QA");
    expect(department).toHaveBeenCalledWith("QA Dept");
  });
});
