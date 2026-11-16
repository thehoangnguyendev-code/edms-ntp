import "../testing/browserStubs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportArtifactPreview } from "../history/ReportArtifactPreview";
import { reportsApi } from "@/services/api/reports";

vi.mock("@/features/documents/shared/components/PdfPreviewModal", () => ({ PdfPreviewModal: ({ fileUrl, title }: any) => <div data-testid="pdf-viewer" data-url={fileUrl}>{title}</div> }));
vi.mock("@/features/documents/shared/components/OnlyOfficeDocumentViewer", () => ({
  OnlyOfficeDocumentViewer: ({ loadConfig }: any) => (
    <button onClick={() => loadConfig()}>
      office viewer
    </button>
  ),
}));
vi.mock("@/services/api/reports", () => ({ reportsApi: { previewArtifact: vi.fn(), artifactViewConfig: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:report");
  URL.revokeObjectURL = vi.fn();
  vi.mocked(reportsApi.previewArtifact).mockResolvedValue(new Blob(["%PDF"]) as never);
  vi.mocked(reportsApi.artifactViewConfig).mockResolvedValue({} as never);
});
afterEach(cleanup);

it("a PDF report file is opened in the project PDF viewer through the preview endpoint", async () => {
  render(<ReportArtifactPreview runId="r1" artifactId="a1" format="PDF" title="Due for review" onClose={() => {}} />);
  expect(await screen.findByTestId("pdf-viewer")).toHaveAttribute("data-url", "blob:report");
  expect(reportsApi.previewArtifact).toHaveBeenCalledWith("r1", "a1");
});

it("a CSV or XLSX report file is opened in the read-only OnlyOffice viewer with the view config of the file", async () => {
  render(<ReportArtifactPreview runId="r1" artifactId="a2" format="XLSX" title="Due for review" onClose={() => {}} />);
  const viewer = await screen.findByRole("button", { name: "office viewer" });
  viewer.click();
  await waitFor(() => expect(reportsApi.artifactViewConfig).toHaveBeenCalledWith("r1", "a2"));
  expect(reportsApi.previewArtifact).not.toHaveBeenCalled();
});

it("says so when the PDF cannot be opened", async () => {
  vi.mocked(reportsApi.previewArtifact).mockRejectedValueOnce({ response: { status: 403, data: { code: "REPORT_SCOPE_DENIED" } } });
  render(<ReportArtifactPreview runId="r1" artifactId="a1" format="PDF" title="Due" onClose={() => {}} />);
  expect(await screen.findByText(/./, { selector: "[role=alert], p, div" })).toBeInTheDocument();
  expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
});
