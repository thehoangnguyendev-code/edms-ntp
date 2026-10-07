import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ExecutedRecordsView } from "../ExecutedRecordsView";
import { ToastProvider } from "@/components/ui/toast/Toast";

const renderView = () => render(<ToastProvider><ExecutedRecordsView /></ToastProvider>);

const getExecutedRecords = vi.fn();
const navigateTo = vi.fn();

vi.mock("@/services/api/executedRecords", () => ({
  executedRecordApi: { getExecutedRecords: (...args: unknown[]) => getExecutedRecords(...args) },
}));
vi.mock("@/hooks", () => ({
  useDebounce: (v: unknown) => v,
  useNavigateWithLoading: () => ({ navigateTo }),
  usePortalDropdown: () => ({ openId: null, position: { top: 0, left: 0 }, getRef: () => undefined, toggle: vi.fn(), close: vi.fn() }),
}));
vi.mock("@/features/realtime/useEntityChanged", () => ({ useEntityChanged: () => undefined }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("../RecordScanPreview", () => ({ RecordScanPreview: ({ record }: { record: { recordNumber: string } | null }) => (record ? <div>preview {record.recordNumber}</div> : null) }));

const record = {
  id: "r1", recordNumber: "REC-1", formDocumentId: "d1", formDocumentNumber: "SOP-001", formDocumentTitle: "Cleaning",
  captureMethod: "PAPER_SCAN", status: "EXECUTED", filledByName: "Ann", filledAt: "2026-10-01T00:00:00Z",
  sourceControlledCopyId: "c1", sourceControlledCopyNumber: "CC-1", fileAvailable: true, fileName: "scan.pdf",
};

describe("ExecutedRecordsView", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    getExecutedRecords.mockReset();
    navigateTo.mockReset();
    getExecutedRecords.mockResolvedValue({ data: [record], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  });

  it("loads the first page from the server and opens the preview on row click", async () => {
    renderView();
    await waitFor(() => expect(screen.getAllByText("REC-1").length).toBeGreaterThan(0));
    expect(getExecutedRecords).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20, sortBy: "created", sortDirection: "desc" }));
    fireEvent.click(screen.getAllByText("REC-1")[0]);
    expect(screen.getByText("preview REC-1")).toBeTruthy();
  });

  it("sends the search to the server instead of filtering locally", async () => {
    renderView();
    await waitFor(() => expect(getExecutedRecords).toHaveBeenCalled());
    fireEvent.change(screen.getAllByPlaceholderText("Record, document or copy number...")[0], { target: { value: "CC-9" } });
    await waitFor(() => expect(getExecutedRecords).toHaveBeenLastCalledWith(expect.objectContaining({ search: "CC-9", page: 1 })));
  });

  it("names the columns in full and asks the server to sort by each of them", async () => {
    renderView();
    await waitFor(() => expect(getExecutedRecords).toHaveBeenCalled());
    for (const [name, key] of [
      ["Record Number", "number"], ["Document", "document"], ["Controlled Copy Number", "copy"], ["Recipient", "recipient"],
      ["Received Date", "filled"], ["Recorded Date", "created"],
    ] as const) {
      fireEvent.click(await screen.findByRole("columnheader", { name: new RegExp(`^${name}`) }));
      await waitFor(() => expect(getExecutedRecords).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: key, page: 1 })));
    }
  });

  it("reverses the direction when the same header is clicked again", async () => {
    renderView();
    const header = await screen.findByRole("columnheader", { name: /^Record Number/ });

    fireEvent.click(header);
    await waitFor(() => expect(getExecutedRecords).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "number", sortDirection: "asc" })));
    fireEvent.click(screen.getByRole("columnheader", { name: /^Record Number/ }));
    await waitFor(() => expect(getExecutedRecords).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "number", sortDirection: "desc" })));
  });

  it("makes the record, document and controlled copy numbers links that open the scan, the document and the copy", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open scan of REC-1" }));
    expect(screen.getByText("preview REC-1")).toBeTruthy();
    expect(navigateTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open document SOP-001" }));
    expect(navigateTo).toHaveBeenLastCalledWith("/documents/d1");

    fireEvent.click(screen.getByRole("button", { name: "Open controlled copy CC-1" }));
    expect(navigateTo).toHaveBeenLastCalledWith("/documents/controlled-copies/c1");
    // Each link does only its own job: the row's own click (preview) did not fire a second time.
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });

  it("shows a record that has no scan or no copy as plain text, not as a dead link", async () => {
    getExecutedRecords.mockResolvedValue({
      data: [{ ...record, fileAvailable: false, sourceControlledCopyId: null, sourceControlledCopyNumber: null }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderView();

    expect(await screen.findByText("REC-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open scan of/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Open controlled copy/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Open document SOP-001" })).toBeTruthy();
  });
});
