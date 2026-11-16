import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { reportTemplatesApi } from "@/services/api/reportTemplates";
import { ReportChartPreview } from "../templates/ReportChartPreview";

vi.mock("@/services/api/reportTemplates", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  reportTemplatesApi: { chartPreview: vi.fn() },
}));

const chart = { title: "Documents by status", type: "DOUGHNUT" as const, field: "status", metric: "COUNT" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reportTemplatesApi.chartPreview).mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  URL.createObjectURL = vi.fn(() => "blob:sample");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

/** REPORT-CHARTJS-2026-11-15: the sample of a chart is the picture the server draws with Chart.js, not a chart drawn in the browser. */
describe("ReportChartPreview", () => {
  it("shows the picture the server draws, once the author stops changing the chart", async () => {
    render(<ReportChartPreview chart={chart} fieldName="Status" font="OSWALD" />);
    expect(screen.getByRole("status")).toHaveTextContent("Drawing the chart");
    const picture = await screen.findByRole("img", { name: "Sample of the chart Documents by status" }, { timeout: 3000 });
    expect(picture).toHaveAttribute("src", "blob:sample");
    expect(reportTemplatesApi.chartPreview).toHaveBeenCalledTimes(1);
    expect(reportTemplatesApi.chartPreview).toHaveBeenCalledWith(chart, "Status", "OSWALD", expect.any(AbortSignal));
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });

  it("asks the server again for another kind of chart, and not for a change that is not in the picture", async () => {
    const view = render(<ReportChartPreview chart={chart} fieldName="Status" />);
    await screen.findByRole("img", { name: /Sample of the chart/ }, { timeout: 3000 });
    view.rerender(<ReportChartPreview chart={{ ...chart }} fieldName="Status" />);
    view.rerender(<ReportChartPreview chart={{ ...chart, type: "RADAR" }} fieldName="Status" />);
    await waitFor(() => expect(reportTemplatesApi.chartPreview).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(vi.mocked(reportTemplatesApi.chartPreview).mock.calls[1][0]).toMatchObject({ type: "RADAR" });
  });

  it("says so when the server cannot draw the chart", async () => {
    vi.mocked(reportTemplatesApi.chartPreview).mockRejectedValue(new Error("REPORT_CHART_RENDERER_UNAVAILABLE"));
    render(<ReportChartPreview chart={chart} fieldName="Status" />);
    expect(await screen.findByRole("alert", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Sample of the chart/ })).toBeNull();
  });
});
