import "../../testing/browserStubs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReportListToolbar } from "../ReportListToolbar";

const branding = vi.hoisted(() => ({ compactDesktopFilters: false }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => branding }));

afterEach(() => {
  cleanup();
  branding.compactDesktopFilters = false;
});

function renderToolbar(onClear = vi.fn()) {
  render(
    <ReportListToolbar
      searchPlaceholder="Search things…"
      search=""
      onSearch={vi.fn()}
      filters={[
        {
          id: "status",
          label: "Status",
          value: "",
          options: [
            { label: "All", value: "" },
            { label: "Active", value: "ACTIVE" },
          ],
          onChange: vi.fn(),
        },
      ]}
      hasActiveFilters
      onClear={onClear}
      customControl={<button type="button">Custom Column</button>}
    >
      <div>table</div>
    </ReportListToolbar>,
  );
  return onClear;
}

it("puts Clear Filters and Custom Column side by side in the last cell of the desktop filter grid, as User Management does", () => {
  const onClear = renderToolbar();
  const clear = screen.getByRole("button", { name: "Clear Filters" });
  const custom = screen.getByRole("button", { name: "Custom Column" });
  expect(clear.parentElement).toBe(custom.parentElement);
  expect(clear.parentElement).toHaveClass("flex", "items-end", "gap-2");
  // That cell is the last item of the grid that also holds Search and the filters.
  const grid = clear.parentElement!.parentElement!;
  expect(grid).toHaveClass("md:grid", "lg:grid-cols-3");
  expect(grid.lastElementChild).toBe(clear.parentElement);
  expect(grid).toContainElement(screen.getByRole("combobox", { name: "Status" }));
  fireEvent.click(clear);
  expect(onClear).toHaveBeenCalledTimes(1);
});

it("shows the table in the unified card, below the filter section", () => {
  renderToolbar();
  const table = screen.getByText("table");
  const card = table.closest(".shadow-sm");
  expect(card).toBeTruthy();
  expect(card).toContainElement(screen.getByRole("button", { name: "Clear Filters" }));
});

it("in the compact filter mode the filters move into the shared panel, with Custom Column as its trailing control", () => {
  branding.compactDesktopFilters = true;
  renderToolbar();
  expect(screen.queryByRole("button", { name: "Clear Filters" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Custom Column" })).toBeInTheDocument();
});

it("opens the Filters drawer on a phone", () => {
  renderToolbar();
  fireEvent.click(screen.getAllByRole("button", { name: "Filters" })[0]);
  expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
});

it("keeps the bottom padding of the filter section in the classic layout, so the filters do not touch the table", () => {
  renderToolbar();
  const card = screen.getByText("table").closest(".shadow-sm")!;
  const section = card.querySelector(".compact-filter-section")!;
  // The global stylesheet removes this padding when the section holds the compact toolbar's marker; the classic layout must not carry it.
  expect(section.querySelector("[data-advanced-search-icon]")).toBeNull();
  expect(section).toHaveClass("md:p-5");
  expect(section.nextElementSibling).toContainElement(screen.getByText("table"));
});

it("carries the compact marker only in the compact filter mode, where the stylesheet expects it", () => {
  branding.compactDesktopFilters = true;
  renderToolbar();
  const section = screen.getByText("table").closest(".shadow-sm")!.querySelector(".compact-filter-section")!;
  expect(section.querySelector("[data-advanced-search-icon]")).not.toBeNull();
});
