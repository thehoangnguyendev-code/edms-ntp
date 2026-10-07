import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { ReportLayoutDesigner } from "../ReportLayoutDesigner";
import {
  defaultReportLayout,
  reportTemplatesApi,
  type ReportLayout,
} from "@/services/api/reportTemplates";

vi.mock("@/services/api/reportTemplates", async (original) => ({
  ...(await original<any>()),
  reportTemplatesApi: { previewLayout: vi.fn(), uploadComponent: vi.fn() },
}));
vi.mock("../ReportMarkCanvas", () => ({
  ReportMarkCanvas: ({ title, layout, disabled }: any) => (
    <div data-testid="position-editor" data-disabled={disabled}>
      {title} · {layout.header}
    </div>
  ),
}));
function Draft() {
  const [value, setValue] = useState(defaultReportLayout());
  return (
    <ReportLayoutDesigner
      value={value}
      onChange={setValue}
      title="TEST"
      disabled={false}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
});
it("passes draft edits directly to the position editor, without a separate PDF viewer", async () => {
  render(<Draft />);
  fireEvent.click(screen.getByRole("tab", { name: "Page Templates" }));
  fireEvent.change(screen.getByLabelText("Header"), {
    target: { value: "New header" },
  });
  expect(reportTemplatesApi.previewLayout).not.toHaveBeenCalled();
  expect(await screen.findByTestId("position-editor")).toHaveTextContent(
    "TEST · New header",
  );
  expect(
    screen.queryByRole("tab", { name: "PDF Preview" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Header"), {
    target: { value: "Changed after preview" },
  });
  expect(screen.getByTestId("position-editor")).toHaveTextContent(
    "Changed after preview",
  );
});
it("previews a new layout even before the template name is entered", async () => {
  render(
    <ReportLayoutDesigner
      value={defaultReportLayout()}
      onChange={vi.fn()}
      title=""
      disabled={false}
    />,
  );
  expect(await screen.findByTestId("position-editor")).toHaveTextContent(
    "Report preview",
  );
});
it("offers monthly trends only for server-declared date fields", () => {
  function DateCharts() {
    const [layout, setLayout] = useState<ReportLayout>({
      ...defaultReportLayout(),
      charts: [
        { title: "Timeline", type: "BAR", field: "status", metric: "COUNT" },
      ],
    });
    return (
      <ReportLayoutDesigner
        title="TEST"
        value={layout}
        onChange={setLayout}
        disabled={false}
        fields={[
          { code: "status", name: "Status", type: "TEXT" },
          { code: "createdAt", name: "Created", type: "DATE" },
        ]}
      />
    );
  }
  render(<DateCharts />);
  fireEvent.click(screen.getByRole("tab", { name: "Charts" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Chart type" }));
  fireEvent.click(screen.getByRole("option", { name: "Monthly trend" }));
  expect(screen.getByRole("combobox", { name: "Group by" })).toHaveTextContent(
    "Created",
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Group by" }));
  expect(
    screen.queryByRole("option", { name: "Status" }),
  ).not.toBeInTheDocument();
});
it("disables draft generation without configuration edit capability", () => {
  render(
    <ReportLayoutDesigner
      value={defaultReportLayout()}
      onChange={vi.fn()}
      title="TEST"
      disabled
    />,
  );
  expect(screen.getByLabelText("Header")).toBeDisabled();
  expect(reportTemplatesApi.previewLayout).not.toHaveBeenCalled();
});
it("inserts a named automatic field into the explicit header target without remembering a key", () => {
  render(<Draft />);
  fireEvent.click(screen.getByRole("tab", { name: "Page Templates" }));
  fireEvent.change(screen.getByLabelText("Header"), { target: { value: "" } });
  fireEvent.click(
    screen.getByRole("combobox", { name: "Insert field into header" }),
  );
  fireEvent.click(screen.getByRole("option", { name: /^Prepared by/ }));
  expect(screen.getByLabelText("Header")).toHaveValue("{{report.executor}}");
  expect(
    screen.getByText(/Prepared by: filled automatically by the server/),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Insert server field"),
  ).not.toBeInTheDocument();
});
it("creates a sensible count chart and tells the user where to preview it", () => {
  function Charts() {
    const [layout, setLayout] = useState(defaultReportLayout());
    return (
      <ReportLayoutDesigner
        title="TEST"
        value={layout}
        onChange={setLayout}
        disabled={false}
        fields={[
          { code: "status", name: "Status" },
          { code: "effectiveDate", name: "Effective Date" },
        ]}
      />
    );
  }
  render(<Charts />);
  fireEvent.click(screen.getByRole("tab", { name: "Charts" }));
  fireEvent.click(screen.getByRole("button", { name: "Add chart" }));
  expect(screen.getByLabelText("Chart title")).toHaveValue("Records by Status");
  expect(screen.getByRole("combobox", { name: "Group by" })).toHaveTextContent(
    "Status",
  );
  expect(
    screen.getByText(/Each chart appears on its own PDF/),
  ).toBeInTheDocument();
});
it("shows every placeholder with a copy action and an explanation, without signature terminology", () => {
  render(<Draft />);
  fireEvent.click(screen.getByRole("tab", { name: "Page Templates" }));
  for (const code of [
    "report.title",
    "report.code",
    "template.version",
    "report.executor",
    "report.generatedAt",
    "report.asOfAt",
    "page.number",
    "page.total",
  ]) {
    expect(
      screen.getByRole("button", { name: `Copy ${code}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Explain ${code}` }),
    ).toBeInTheDocument();
  }
  expect(
    screen.getByText(/Names and times are server-derived information/),
  ).toBeInTheDocument();
});
it("uses server inspected Word references without applying a saved template", async () => {
  vi.mocked(reportTemplatesApi.uploadComponent).mockResolvedValue({
    id: "test",
    sha256: "a".repeat(64),
    fileName: "header.docx",
    placeholders: ["report.executor"],
  });
  render(<Draft />);
  const file = new File(["fixture"], "header.docx");
  fireEvent.click(screen.getByRole("tab", { name: "Page Templates" }));
  fireEvent.change(screen.getByLabelText("Upload header Word template"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.getByText("header.docx")).toBeInTheDocument(),
  );
  expect(reportTemplatesApi.uploadComponent).toHaveBeenCalledWith(
    "header",
    file,
  );
  expect(screen.getByText("Detected: {{report.executor}}")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Use text settings instead" }),
  );
  expect(screen.queryByText("header.docx")).not.toBeInTheDocument();
});
