import "../../testing/browserStubs";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useState } from "react";
import { vi } from "vitest";
import { ReportChartsEditor } from "../ReportChartsEditor";
import type { ReportChart } from "@/services/api/reportTemplates";

vi.mock("../ReportChartPreview", () => ({ ReportChartPreview: () => <div>Sample picture</div> }));

const fields = [
  { code: "status", name: "Status", type: "TEXT" },
  { code: "createdAt", name: "Created", type: "DATE" },
];

function Charts({ initial = [] as ReportChart[], disabled = false }) {
  const [charts, setCharts] = useState<ReportChart[]>(initial);
  return <ReportChartsEditor charts={charts} fields={fields} disabled={disabled} onChange={setCharts} />;
}

it("offers monthly trends only for server-declared date fields", () => {
  render(<Charts initial={[{ title: "Timeline", type: "BAR", field: "status", metric: "COUNT" }]} />);
  fireEvent.click(screen.getByRole("combobox", { name: "Chart type" }));
  fireEvent.click(screen.getByRole("option", { name: "Monthly trend (line)" }));
  expect(screen.getByRole("combobox", { name: "Group by" })).toHaveTextContent("Created");
  fireEvent.click(screen.getByRole("combobox", { name: "Group by" }));
  expect(screen.queryByRole("option", { name: "Status" })).not.toBeInTheDocument();
});

it("creates a sensible count chart, and removes it again", () => {
  render(<Charts />);
  expect(screen.getByText("This template has no charts.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add chart" }));
  expect(screen.getByLabelText("Chart title")).toHaveValue("Records by Status");
  expect(screen.getByRole("combobox", { name: "Group by" })).toHaveTextContent("Status");
  expect(screen.getByText(/Each chart appears on its own PDF page/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove chart" }));
  expect(screen.queryByLabelText("Chart title")).not.toBeInTheDocument();
});

it("cannot be changed without edit capability", () => {
  render(<Charts initial={[{ title: "Timeline", type: "BAR", field: "status", metric: "COUNT" }]} disabled />);
  expect(screen.getByLabelText("Chart title")).toBeDisabled();
});

/** REPORT-CHARTJS-2026-11-15: eight kinds of chart; the trends by month need a date field. */
it("offers the eight kinds of chart, the trends only when there is a date field", () => {
  const { unmount } = render(<Charts initial={[{ title: "T", type: "BAR", field: "status", metric: "COUNT" }]} />);
  fireEvent.click(screen.getByRole("combobox", { name: "Chart type" }));
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Column", "Horizontal bar", "Pie", "Doughnut", "Polar area", "Radar", "Monthly trend (line)", "Monthly trend (area)",
  ]);
  unmount();
  function NoDates() {
    const [charts, setCharts] = useState<ReportChart[]>([{ title: "T", type: "BAR", field: "status", metric: "COUNT" }]);
    return <ReportChartsEditor charts={charts} fields={[{ code: "status", name: "Status", type: "TEXT" }]} disabled={false} onChange={setCharts} />;
  }
  render(<NoDates />);
  fireEvent.click(screen.getByRole("combobox", { name: "Chart type" }));
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Column", "Horizontal bar", "Pie", "Doughnut", "Polar area", "Radar"]);
});

it("moves to a date field when an area trend is chosen, and hides the number of groups for a trend", () => {
  render(<Charts initial={[{ title: "T", type: "DOUGHNUT", field: "status", metric: "COUNT" }]} />);
  expect(screen.getByRole("combobox", { name: "Most groups shown" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Chart type" }));
  fireEvent.click(screen.getByRole("option", { name: "Monthly trend (area)" }));
  expect(screen.getByRole("combobox", { name: "Group by" })).toHaveTextContent("Created");
  expect(screen.queryByRole("combobox", { name: "Most groups shown" })).not.toBeInTheDocument();
  expect(screen.getByText(/Dates are grouped by month/)).toBeInTheDocument();
});

it("says that a chart is a page of the PDF and a sheet of the XLSX, drawn on the server, and that a CSV has none", () => {
  render(<Charts />);
  expect(screen.getByText(/its own sheet of an XLSX/)).toBeInTheDocument();
  expect(screen.getByText(/A CSV has no chart/)).toBeInTheDocument();
});
