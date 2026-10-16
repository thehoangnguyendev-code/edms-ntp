import "../../testing/browserStubs";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useState } from "react";
import { ReportChartsEditor } from "../ReportChartsEditor";
import type { ReportChart } from "@/services/api/reportTemplates";

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
  fireEvent.click(screen.getByRole("option", { name: "Monthly trend" }));
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
