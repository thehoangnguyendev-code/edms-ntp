import "../testing/browserStubs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportAppearancePreview } from "../appearance/ReportAppearancePreview";
import { reportAppearanceApi } from "@/services/api/reportAppearance";

vi.mock("@/features/documents/shared/components/PdfPreviewModal", () => ({
  PdfPreviewModal: ({ fileUrl, title, wide }: any) => (
    <div data-testid="pdf-viewer" data-url={fileUrl} data-wide={String(wide)}>
      {title}
    </div>
  ),
}));
vi.mock("@/services/api/reportAppearance", () => ({ reportAppearanceApi: { preview: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:appearance");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

it("opens every page of the appearance in the project PDF viewer, wide, from the preview endpoint", async () => {
  vi.mocked(reportAppearanceApi.preview).mockResolvedValue(new Blob(["%PDF"]) as never);
  render(<ReportAppearancePreview id="a1" name="Standard" onClose={() => {}} />);
  const viewer = await screen.findByTestId("pdf-viewer");
  expect(viewer).toHaveAttribute("data-url", "blob:appearance");
  expect(viewer).toHaveAttribute("data-wide", "true");
  expect(viewer).toHaveTextContent("Preview: Standard");
  expect(reportAppearanceApi.preview).toHaveBeenCalledWith("a1");
});

it("says so when the pages cannot be drawn", async () => {
  vi.mocked(reportAppearanceApi.preview).mockRejectedValueOnce({ response: { status: 403, data: { code: "REPORT_SCOPE_DENIED" } } });
  render(<ReportAppearancePreview id="a1" name="Standard" onClose={() => {}} />);
  await waitFor(() => expect(screen.queryByText("Drawing the pages…")).not.toBeInTheDocument());
  expect(screen.queryByTestId("pdf-viewer")).not.toBeInTheDocument();
});
