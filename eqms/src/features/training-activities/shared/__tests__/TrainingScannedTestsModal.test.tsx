import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingScannedTestsModal } from "../TrainingScannedTestsModal";

const personEvidence = vi.fn();
const personEvidenceFile = vi.fn();

vi.mock("@/services/api/trainingActivities", () => ({
  trainingError: (e: unknown) => String(e),
  trainingFilesApi: {
    personEvidence: (...args: unknown[]) => personEvidence(...args),
    personEvidenceFile: (...args: unknown[]) => personEvidenceFile(...args),
    personEvidenceViewConfig: vi.fn(),
  },
}));
vi.mock("@/features/documents/shared/components/OnlyOfficeDocumentViewer", () => ({ OnlyOfficeDocumentViewer: () => <div data-testid="office-viewer" /> }));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({ DocumentPdfViewer: ({ fileUrl }: { fileUrl: string }) => <div data-testid="pdf-viewer" data-url={fileUrl} /> }));
// One stable function, as the real toast hook gives: a new one on every render would make the table load again and again.
const toast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u" } }) }));

const row = (id: string, originalName: string, contentType: string, extra: Record<string, unknown> = {}) => ({
  id, kind: "ASSESSMENT", originalName, contentType, sizeBytes: 2048, sha256: "x", uploadedAt: "2026-10-21T00:00:00", uploadedByName: "A. Trainer", wholeSession: false, ...extra,
});
const page = (data: unknown[], extra: Record<string, unknown> = {}) => ({
  trainingNumber: "TRN/QA/26-001", trainingTitle: "Title", data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 }, ...extra,
});
const renderModal = () => render(<MemoryRouter><TrainingScannedTestsModal personId="p" activityId="a" onClose={vi.fn()} /></MemoryRouter>);

describe("TrainingScannedTestsModal", () => {
  beforeEach(() => {
    personEvidence.mockReset();
    personEvidenceFile.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });

  it("puts View and Download in the menu of the row, and offers View only for a PDF, a picture and a Word file", async () => {
    personEvidence.mockResolvedValue(page([
      row("1", "scan.pdf", "application/pdf"),
      row("2", "photo.png", "image/png", { wholeSession: true }),
      row("3", "sheet.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      row("4", "table.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ]));
    renderModal();
    await screen.findByText(/scan.pdf/);
    const menus = screen.getAllByRole("button", { name: "More actions" });
    expect(menus).toHaveLength(4);
    expect(screen.getByText("Whole session")).toBeTruthy();
    expect(screen.getByText("No.")).toBeTruthy();
    fireEvent.click(menus[0]);
    expect(await screen.findByText("View")).toBeTruthy();
    expect(screen.getByText("Download")).toBeTruthy();
    fireEvent.click(menus[3]); // a spreadsheet can only be saved
    await waitFor(() => expect(screen.queryByText("View")).toBeNull());
    expect(screen.getByText("Download")).toBeTruthy();
  });

  it("asks the server to search, sort and page", async () => {
    personEvidence.mockResolvedValue(page([row("1", "scan.pdf", "application/pdf")]));
    renderModal();
    await screen.findByText(/scan.pdf/);
    expect(personEvidence).toHaveBeenCalledWith("p", "a", expect.objectContaining({ page: 1, limit: 10, sortBy: "uploadedAt", sortDirection: "asc" }));
    fireEvent.click(screen.getByText("File"));
    await waitFor(() => expect(personEvidence).toHaveBeenLastCalledWith("p", "a", expect.objectContaining({ sortBy: "originalName" })));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "apd" } });
    await waitFor(() => expect(personEvidence).toHaveBeenLastCalledWith("p", "a", expect.objectContaining({ search: "apd", page: 1 })));
  });

  it("opens a PDF in a second modal over the list, with Download beside Close, and Close leaves the list in place", async () => {
    personEvidence.mockResolvedValue(page([row("1", "scan.pdf", "application/pdf")]));
    personEvidenceFile.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    const onClose = vi.fn();
    render(<MemoryRouter><TrainingScannedTestsModal personId="p" activityId="a" onClose={onClose} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("View"));
    await waitFor(() => expect(screen.getByTestId("pdf-viewer").getAttribute("data-url")).toBe("blob:test"));
    expect(personEvidenceFile).toHaveBeenCalledWith("p", "a", "1", true);
    expect(screen.getAllByRole("button", { name: "Download" }).length).toBeGreaterThan(0); // the button in the footer of the preview, beside Close
    expect(screen.getByText(/Scanned tests/)).toBeTruthy(); // the list is still there below
    const closes = screen.getAllByRole("button", { name: "Close" });
    fireEvent.click(closes[closes.length - 1]); // the footer of the preview, the last in the page
    await waitFor(() => expect(screen.queryByTestId("pdf-viewer")).toBeNull());
    expect(screen.getByText(/Scanned tests/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens a Word file in the OnlyOffice viewer and does not fetch its bytes", async () => {
    personEvidence.mockResolvedValue(page([row("3", "sheet.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]));
    renderModal();
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("View"));
    expect(await screen.findByTestId("office-viewer")).toBeTruthy();
    expect(personEvidenceFile).not.toHaveBeenCalled();
  });

  it("says so when the person has no scanned file", async () => {
    personEvidence.mockResolvedValue(page([]));
    renderModal();
    expect(await screen.findByText("No scanned file")).toBeTruthy();
  });
});
