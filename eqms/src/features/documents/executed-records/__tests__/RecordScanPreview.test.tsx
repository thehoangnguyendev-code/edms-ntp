import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({
  DocumentPdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("@/services/api/executedRecords", () => ({
  executedRecordApi: { fetchExecutedRecordPreview: vi.fn(() => Promise.resolve(new Blob(["x"], { type: "application/pdf" }))) },
}));

import { RecordScanPreview } from "../RecordScanPreview";
import type { ExecutedRecord } from "@/services/api/executedRecords";

const record = { id: "r1", recordNumber: "REC-1", formDocumentNumber: "SOP-1", sourceControlledCopyNumber: "CC-1", fileName: "scan.pdf" } as ExecutedRecord;

describe("RecordScanPreview", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => "blob:scan") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
  });

  it("shows nothing until a record is chosen", () => {
    render(<RecordScanPreview record={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps showing the same scan while it fades out, then removes it, instead of vanishing the instant it is closed", async () => {
    const view = render(<RecordScanPreview record={record} onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "REC-1" })).toBeInTheDocument();

    view.rerender(<RecordScanPreview record={null} onClose={() => {}} />);

    // Right after closing it is still on screen (the closing animation is running) and still shows the record it showed ...
    expect(screen.getByRole("dialog", { name: "REC-1" })).toBeInTheDocument();
    // ... and only then is it removed.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
