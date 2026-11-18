import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ReportTabsFrame } from "../ReportTabsFrame";
import { reportBreadcrumbs } from "../reportBreadcrumbs";

let granted: string[] = [];
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAnyPermission: (codes: string[]) => codes.some((code) => granted.includes(code)) }),
}));

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path: string, pair: "runs" | "scheduled") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BreadcrumbProvider>
        <ReportTabsFrame pair={pair}>
          <p>list</p>
        </ReportTabsFrame>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </BreadcrumbProvider>
    </MemoryRouter>,
  );
}

/** REPORT-MENU-2026-11-15: a menu entry holds a second list as a tab; the title is the name of the entry for both tabs and every tab has its own address. */
describe("ReportTabsFrame", () => {
  it("shows both tabs to a person who may see the registers and opens the other tab at its own address below the menu entry", async () => {
    granted = ["reports.definition.view"];
    renderAt("/report/history", "runs");
    expect(screen.getByRole("heading", { name: "Report Run History" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Run History" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Legal Hold Register" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/report/history/legal-holds");
  });

  it("keeps the title of the entry on the second tab and marks that tab", () => {
    granted = ["reports.definition.view"];
    renderAt("/report/scheduled/delivery-log", "scheduled");
    expect(screen.getByRole("heading", { name: "Scheduled Reports" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Delivery Log" })).toHaveAttribute("aria-selected", "true");
  });

  it("draws no tabs for a person who may see only the first tab, but still the list", () => {
    granted = [];
    const { container } = renderAt("/report/scheduled", "scheduled");
    expect(container.querySelector("[role=tablist]")).toBeNull();
    expect(screen.getByText("list")).toBeInTheDocument();
  });
});

describe("reportBreadcrumbs", () => {
  const trail = (title: string, parent?: string, configuration = false) =>
    reportBreadcrumbs(() => undefined, title, configuration, parent ? { label: parent, onClick: () => undefined } : undefined).map((item) => item.label);

  it("puts the menu group (when the entry has one) between Reports and the page, as the sidebar does", () => {
    expect(trail("Report Library").slice(-2)).toEqual(["Reports", "Report Library"]);
    expect(trail("Report Run History").slice(-2)).toEqual(["Reports", "Report Run History"]);
    expect(trail("All Revisions").slice(-3)).toEqual(["Reports", "Template Management", "All Revisions"]);
    expect(trail("Scheduled Reports").slice(-2)).toEqual(["Reports", "Scheduled Reports"]);
  });

  it("finds the group of a page that opens one record by its parent", () => {
    expect(trail("Report Run Details", "Report Run History").slice(-3)).toEqual(["Reports", "Report Run History", "Report Run Details"]);
    expect(trail("Report Template Details", "Report Templates").slice(-4)).toEqual(["Reports", "Template Management", "Report Templates", "Report Template Details"]);
    expect(trail("Create Report", "Report Library").slice(-3)).toEqual(["Reports", "Report Library", "Create Report"]);
  });

  it("leaves a page of Report Administration without the menu group", () => {
    expect(trail("Report Types", undefined, true)).not.toContain("Reports");
  });
});
