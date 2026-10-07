import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ExecutedRecordsTab } from "../ExecutedRecordsTab";

const getExecutedRecords = vi.fn();

vi.mock("@/services/api/executedRecords", () => ({
  executedRecordApi: { getExecutedRecords: (...args: unknown[]) => getExecutedRecords(...args) },
}));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/features/documents/executed-records/RecordScanPreview", () => ({
  RecordScanPreview: ({ record }: { record: { recordNumber: string } | null }) => (record ? <div>preview {record.recordNumber}</div> : null),
}));

const record = {
  id: "r1", recordNumber: "REC-1", captureMethod: "PAPER_SCAN", status: "EXECUTED", filledByName: "Ann",
  filledAt: "2026-10-01T00:00:00Z", sourceControlledCopyNumber: "CC-1", fileAvailable: true, fileName: "scan.pdf",
};

describe("ExecutedRecordsTab", () => {
  beforeEach(() => {
    getExecutedRecords.mockReset();
    getExecutedRecords.mockResolvedValue({ data: [record], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  });

  it("asks the server for the records of one copy and opens the scan on row click", async () => {
    render(<ExecutedRecordsTab controlledCopyId="copy-1" />);
    await waitFor(() => expect(screen.getAllByText("REC-1").length).toBeGreaterThan(0));
    expect(getExecutedRecords).toHaveBeenCalledWith(expect.objectContaining({ controlledCopyId: "copy-1", page: 1 }));
    fireEvent.click(screen.getAllByText("REC-1")[0]);
    expect(screen.getByText("preview REC-1")).toBeTruthy();
  });

  it("has no approve or reject action: a record is filed already executed", async () => {
    render(<ExecutedRecordsTab formDocumentId="doc-1" />);
    await waitFor(() => expect(screen.getAllByText("REC-1").length).toBeGreaterThan(0));
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();
  });

  it("names the columns in full and asks the server to sort by each of them", async () => {
    render(<ExecutedRecordsTab controlledCopyId="copy-1" />);
    await waitFor(() => expect(getExecutedRecords).toHaveBeenCalled());
    for (const [name, key] of [
      ["Record Number", "number"], ["Controlled Copy Number", "copy"], ["Recipient", "recipient"],
      ["Received Date", "filled"], ["Scan", "scan"],
    ] as const) {
      fireEvent.click(await screen.findByRole("columnheader", { name: new RegExp(`^${name}`) }));
      await waitFor(() => expect(getExecutedRecords).toHaveBeenLastCalledWith(expect.objectContaining({ controlledCopyId: "copy-1", sortBy: key, page: 1 })));
    }
  });
});
