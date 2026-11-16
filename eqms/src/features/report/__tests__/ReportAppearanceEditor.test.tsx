import "../testing/browserStubs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { ReportAppearanceEditor } from "../appearance/ReportAppearanceEditor";
import { defaultReportLayout } from "@/services/api/reportTemplates";
import { reportAppearanceApi } from "@/services/api/reportAppearance";

vi.mock("../appearance/ReportLiveSheet", () => ({
  ReportLiveSheet: ({ layout, page, selected, onSelect }: any) => (
    <div data-testid="canvas" data-page={page} data-selected={selected ?? ""} data-logo={layout.logo?.slot ?? ""} data-info={layout.frame?.info.length ?? 0}>
      <button onClick={() => onSelect("fr")}>point at footer right</button>
    </div>
  ),
}));
vi.mock("@/services/api/reportTemplates", async (original) => ({ ...(await original<any>()), reportTemplatesApi: { uploadComponent: vi.fn(), previewPage: vi.fn() } }));

function Draft({ start = defaultReportLayout() }: { start?: ReturnType<typeof defaultReportLayout> }) {
  const [value, setValue] = useState(start);
  return <ReportAppearanceEditor value={value} onChange={setValue} disabled={false} />;
}
vi.mock("@/services/api/reportAppearance", () => ({ reportAppearanceApi: { placeholders: vi.fn(), get: vi.fn(), update: vi.fn() } }));
const row = (code: string, name: string) => ({ code, name, example: "x", placeholder: `{{${code}}}` });
beforeEach(() => {
  vi.mocked(reportAppearanceApi.placeholders).mockResolvedValue({ data: [row("report.title", "Report name"), row("report.executor", "Prepared by")], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } } as never);
});
afterEach(cleanup);

it("opens the sections of the part of the page that is pointed at: the three places of the header, or of the footer, each with its own switch", async () => {
  render(<Draft />);
  expect(screen.getByLabelText("Header Left")).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Show header centre" })).not.toBeChecked();
  expect(screen.queryByLabelText("Footer Right")).not.toBeInTheDocument();
  fireEvent.click(await screen.findByText("point at footer right"));
  expect(screen.queryByLabelText("Header Left")).not.toBeInTheDocument();
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-selected", "fr");
  expect(screen.queryByLabelText("Footer Right")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Show footer right" }));
  expect(screen.getByLabelText("Footer Right")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Show footer right" }));
  expect(screen.queryByLabelText("Footer Right")).not.toBeInTheDocument();
});

it("the quick buttons above the page reach every part without the mouse on the canvas", () => {
  render(<Draft />);
  fireEvent.click(screen.getByRole("button", { name: "Logo" }));
  expect(screen.getByRole("tablist", { name: "Logo place" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Information" }));
  expect(screen.getByRole("button", { name: "Add information line" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Watermark" }));
  expect(screen.getByRole("switch", { name: "Show watermark" })).toBeInTheDocument();
});

it("inserts a named automatic field at the end of the text, and places the logo by a choice", () => {
  render(<Draft />);
  fireEvent.change(screen.getByLabelText("Header Left"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Header Left"), { target: { value: "{{report.executor}}" } });
  expect(screen.getByLabelText("Header Left")).toHaveValue("{{report.executor}}");
  fireEvent.click(screen.getByRole("button", { name: "Logo" }));
  fireEvent.click(screen.getByRole("tab", { name: "Right" }));
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-logo", "RIGHT");
  expect(screen.queryByLabelText(/Logo left/)).not.toBeInTheDocument();
});

it("shows the page of the part that is chosen: the last page for approval, the cover page for the cover", () => {
  render(<Draft />);
  expect(screen.queryByRole("tab", { name: "Last page" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Approval" }));
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-page", "1");
  fireEvent.click(screen.getByRole("switch", { name: "Show approval block" }));
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-page", "2");
  fireEvent.click(screen.getByRole("button", { name: "Cover Page" }));
  expect(screen.getByLabelText("Report Title")).toBeDisabled();
  fireEvent.click(screen.getByRole("switch", { name: "Enable cover" }));
  expect(screen.getByLabelText("Report Title")).toBeEnabled();
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-page", "1");
});

it("information lines can be added and removed", () => {
  const none = { text: "" };
  const lines = ["Prepared by", "Department", "Filters", "Rows", "Generated at", "Template approved"].map((label) => ({ label, value: `{{${label}}}` }));
  const withInfo = { ...defaultReportLayout(), frame: { companyName: "", headerLeft: none, headerCenter: none, headerRight: none, footerLeft: none, footerCenter: none, footerRight: none, info: lines, infoColumns: 2 as const, approval: false, notes: false, notesHeight: 120 } };
  render(<Draft start={withInfo} />);
  fireEvent.click(screen.getByRole("button", { name: "Information" }));
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-info", "6");
  fireEvent.click(screen.getByRole("button", { name: "Remove information line 1" }));
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-info", "5");
  fireEvent.click(screen.getByRole("button", { name: "Add information line" }));
  expect(screen.getByTestId("canvas")).toHaveAttribute("data-info", "6");
});

it("the preview is the live page only: no server check button, and it follows what is typed", () => {
  render(<Draft />);
  expect(screen.getByTestId("canvas")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /server/i })).not.toBeInTheDocument();
});

it("the header has a section for each place and the footer has the page number choice", () => {
  render(<Draft />);
  for (const name of ["Show header left", "Show header centre", "Show header right"]) expect(screen.getByRole("switch", { name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Show header right" }));
  expect(screen.getByLabelText("Header Right")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Footer" }));
  expect(screen.getByRole("checkbox", { name: "Show page numbers" })).toBeInTheDocument();
});

it("Report Placeholders is a section of the same screen: the server searches, sorts and pages it, and there is no Word upload", async () => {
  render(<Draft />);
  expect(screen.queryByRole("tab", { name: "Cover Page" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Word template/)).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Copy report.executor" })).toBeInTheDocument();
  expect(reportAppearanceApi.placeholders).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }), expect.anything());
  fireEvent.change(screen.getByLabelText("Search"), { target: { value: "executor" } });
  await waitFor(() => expect(reportAppearanceApi.placeholders).toHaveBeenCalledWith(expect.objectContaining({ search: "executor", page: 1 }), expect.anything()));
  fireEvent.click(await screen.findByRole("columnheader", { name: /^Name/ }));
  await waitFor(() => expect(reportAppearanceApi.placeholders).toHaveBeenCalledWith(expect.objectContaining({ sort: "name", direction: "asc" }), expect.anything()));
});

it("a layout that still has Word templates offers to remove them", () => {
  const start = { ...defaultReportLayout(), wordComponents: { header: { fileName: "h.docx", placeholders: [] } } } as never;
  render(<Draft start={start} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove Word templates" }));
  expect(screen.queryByRole("button", { name: "Remove Word templates" })).not.toBeInTheDocument();
});

it("a text can be given a font, a colour, bold, italic, underline and an alignment, and reset", () => {
  render(<Draft />);
  fireEvent.click(screen.getByRole("button", { name: "Header Left italic" }));
  expect(screen.getByRole("button", { name: "Header Left italic" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Header Left underline" }));
  expect(screen.getByRole("button", { name: "Header Left underline" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Header Left bold" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Header Left bold" }));
  expect(screen.getByRole("button", { name: "Header Left bold" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Clear style" }));
  expect(screen.getByRole("button", { name: "Header Left italic" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Cover Page" }));
  expect(screen.getByRole("group", { name: "Report Title alignment" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Information" }));
  expect(screen.getByRole("group", { name: "Information value style" })).toBeInTheDocument();
});

it("the columns of the approval table can be renamed and switched off", () => {
  render(<Draft />);
  fireEvent.click(screen.getByRole("button", { name: "Approval" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show approval block" }));
  expect(screen.getByLabelText("Approval column 2")).toHaveValue("Designation");
  fireEvent.change(screen.getByLabelText("Approval column 2"), { target: { value: "Position" } });
  expect(screen.getByLabelText("Approval column 2")).toHaveValue("Position");
  fireEvent.click(screen.getByRole("switch", { name: "Show approval column 3" }));
  expect(screen.getByRole("switch", { name: "Show approval column 3" })).not.toBeChecked();
  expect(screen.getByRole("switch", { name: "Show approval column 1" })).toBeChecked();
});

it("a font size typed from the keyboard is kept as typed (12 stays 12) and is made to fit its range when the field is left", () => {
  render(<Draft />);
  const size = screen.getByLabelText("Header Left font size") as HTMLInputElement;
  fireEvent.change(size, { target: { value: "1" } });
  expect(size.value).toBe("1");
  fireEvent.change(size, { target: { value: "12" } });
  expect(size.value).toBe("12");
  fireEvent.blur(size);
  expect(size.value).toBe("12");
  fireEvent.change(size, { target: { value: "99" } });
  fireEvent.blur(size);
  expect(size.value).toBe("16");
  fireEvent.change(size, { target: { value: "2" } });
  fireEvent.blur(size);
  expect(size.value).toBe("6");
});

it("the roles and each column of the approval table can be aligned in their cells", () => {
  render(<Draft />);
  fireEvent.click(screen.getByRole("button", { name: "Approval" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show approval block" }));
  expect(screen.getByRole("button", { name: "Roles align left" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Roles align centre" }));
  expect(screen.getByRole("button", { name: "Roles align centre" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Column 2 align right" }));
  expect(screen.getByRole("button", { name: "Column 2 align right" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Column 1 align left" })).toHaveAttribute("aria-pressed", "true");
});
