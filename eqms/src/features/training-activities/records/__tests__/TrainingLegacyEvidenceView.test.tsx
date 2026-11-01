import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rows = [
  { revisionId: "r1", documentId: "d1", activityId: "a1", documentNumber: "SOP.0010", documentName: "Cleaning of rooms", revisionNumber: "2.0", paperTrainingNumber: "TRN/QA/26-010", completionDate: "2026-03-01", evidenceId: "e1", evidenceStatus: "VERIFIED", notEvidenced: false, originalName: "Danh sách đào tạo 26-010.pdf" },
  { revisionId: "r2", documentId: "d2", activityId: null, documentNumber: "SOP.0011", documentName: "Gowning", revisionNumber: "1.0", paperTrainingNumber: null, completionDate: "2026-03-02", evidenceId: null, evidenceStatus: null, notEvidenced: null, originalName: null },
  { revisionId: "r3", documentId: "d3", activityId: "a3", documentNumber: "SOP.0012", documentName: "Sampling", revisionNumber: "3.0", paperTrainingNumber: "TRN/QA/26-012", completionDate: "2026-03-03", evidenceId: "e3", evidenceStatus: "FILED", notEvidenced: false, originalName: "scan.png" },
];
const api = vi.hoisted(() => ({ queue: vi.fn(), submit: vi.fn(), download: vi.fn(), view: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/services/api/trainingActivities", () => ({ trainingLegacyApi: api, trainingError: () => "error" }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/hooks/usePersistedState", () => ({ usePersistedState: (_k: string, v: unknown) => React.useState(v) }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: any) => <h1>{title}</h1> }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({ ESignatureModal: () => null }));
vi.mock("@/components/ui/modal/FormModal", () => ({ FormModal: ({ isOpen, title, children, footerExtra, showCancel }: any) => (isOpen ? <div role="dialog" aria-label={title} data-cancel={String(showCancel)}>{children}{footerExtra}</div> : null) }));
vi.mock("@/features/documents/shared/components/PdfPreviewModal", () => ({
  PdfPreviewModal: ({ title, fileUrl, showCancel }: any) => <div role="dialog" aria-label={title} data-url={fileUrl} data-cancel={String(showCancel)} />,
}));
vi.mock("../../shared/useListFilters", () => ({
  resettingDates: () => [],
  useDateRange: () => ({ filter: {}, params: () => ({}), clear: vi.fn(), isSet: false, from: "", to: "" }),
  useDepartmentOptions: () => [],
}));
vi.mock("@/features/settings/shared/hooks/useServerTable", () => ({
  useServerTable: () => ({
    items: rows, isLoading: false, sortConfig: {}, handleSort: vi.fn(), currentPage: 1, itemsPerPage: 10, totalItems: 3, totalPages: 1,
    setCurrentPage: vi.fn(), setItemsPerPage: vi.fn(), searchQuery: "", setSearchQuery: vi.fn(), reload: vi.fn(),
  }),
}));
vi.mock("@/components/ui/table/DataTable", () => ({
  useCustomColumnLayout: () => ({ layout: {}, control: null }),
  DataTable: ({ rows: data, columns, action }: any) => (
    <table>
      <thead><tr>{columns.map((c: any) => <th key={c.id}>{c.header}</th>)}</tr></thead>
      <tbody>{data.map((r: any, i: number) => <tr key={r.revisionId}>{columns.map((c: any) => <td key={c.id}>{c.cell(r, i)}</td>)}<td>{action.cell(r)}</td></tr>)}</tbody>
    </table>
  ),
}));
vi.mock("@/features/report/shared/ReportListToolbar", () => ({
  ReportListToolbar: ({ searchPlaceholder, children }: any) => <div><input aria-label="Search" placeholder={searchPlaceholder} />{children}</div>,
}));

import { TrainingLegacyEvidenceView } from "../TrainingLegacyEvidenceView";

const downloads: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  downloads.length = 0;
  api.queue.mockResolvedValue({ data: rows, canSubmit: true, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } });
  URL.createObjectURL = vi.fn(() => "blob:scan");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
});

describe("Legacy Training Evidence table", () => {
  it("shows the Training Number, Document Number, Document Name and Document Revision as columns", () => {
    render(<MemoryRouter><TrainingLegacyEvidenceView /></MemoryRouter>);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    for (const name of ["Training Number", "Document Number", "Document Name", "Document Revision"]) expect(headers).toContain(name);
    expect(screen.getByText("TRN/QA/26-010")).toBeTruthy();
    expect(screen.getByText("SOP.0010")).toBeTruthy();
    expect(screen.getByText("Cleaning of rooms")).toBeTruthy();
    expect(screen.getByText("2.0")).toBeTruthy();
    expect(screen.getByPlaceholderText(/training number/i)).toBeTruthy();
  });

  it("offers View Scan only for a row that has a scan", () => {
    render(<MemoryRouter><TrainingLegacyEvidenceView /></MemoryRouter>);
    const buttons = screen.getAllByLabelText("More actions");
    fireEvent.click(buttons[1]);
    expect(screen.queryByText("View Scan")).toBeNull();
    fireEvent.click(buttons[0]);
    expect(screen.getByText("View Scan")).toBeTruthy();
  });

  it("opens a PDF scan in the PDF viewer, as a view and not a download, with one Close only and no Download button", async () => {
    api.view.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    render(<MemoryRouter><TrainingLegacyEvidenceView /></MemoryRouter>);
    fireEvent.click(screen.getAllByLabelText("More actions")[0]);
    fireEvent.click(screen.getByText("View Scan"));
    const dialog = await screen.findByRole("dialog", { name: "Scan of the paper training record" });
    expect(api.view).toHaveBeenCalledWith("e1");
    expect(api.download).not.toHaveBeenCalled();
    expect(dialog.getAttribute("data-url")).toBe("blob:scan");
    expect(dialog.getAttribute("data-cancel")).toBe("false");
    expect(screen.queryByRole("button", { name: /Download$/ })).toBeNull();
  });

  it("downloads the scan from the menu under the name it was uploaded with", async () => {
    api.download.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    render(<MemoryRouter><TrainingLegacyEvidenceView /></MemoryRouter>);
    fireEvent.click(screen.getAllByLabelText("More actions")[0]);
    fireEvent.click(screen.getByText("Download the scan"));
    await waitFor(() => expect(downloads).toEqual(["Danh sách đào tạo 26-010.pdf"]));
    expect(api.download).toHaveBeenCalledWith("e1");
  });

  it("links the Training Number, the Document Number and the Document Revision to their details", () => {
    render(<MemoryRouter><TrainingLegacyEvidenceView /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "TRN/QA/26-010" }).getAttribute("href")).toBe("/training-management/activities/a1");
    expect(screen.getByRole("link", { name: "SOP.0010" }).getAttribute("href")).toBe("/documents/d1");
    expect(screen.getByRole("link", { name: "2.0" }).getAttribute("href")).toBe("/documents/revisions/r1");
    // a revision without a historical activity has a number that is only text
    expect(screen.queryByRole("link", { name: "TRN/QA/26-012-none" })).toBeNull();
    expect(screen.getByRole("link", { name: "SOP.0011" }).getAttribute("href")).toBe("/documents/d2");
  });

  it("shows an image scan in the window of the page and releases the file when it is closed", async () => {
    api.view.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
    render(<MemoryRouter><TrainingLegacyEvidenceView /></MemoryRouter>);
    fireEvent.click(screen.getAllByLabelText("More actions")[2]);
    fireEvent.click(screen.getByText("View Scan"));
    const image = await screen.findByAltText("scan.png");
    expect(image.getAttribute("src")).toBe("blob:scan");
  });

  it("tells the person when the scan cannot be opened", async () => {
    api.view.mockRejectedValue(new Error("no"));
    render(<MemoryRouter><TrainingLegacyEvidenceView /></MemoryRouter>);
    fireEvent.click(screen.getAllByLabelText("More actions")[0]);
    fireEvent.click(screen.getByText("View Scan"));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
