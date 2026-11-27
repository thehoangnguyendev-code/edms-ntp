import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CompareWithEffectiveButton } from "../CompareWithEffectiveButton";
import { UploadRevisionModal } from "@/features/documents/document-list/document-creation/UploadRevisionModal";

const api = vi.hoisted(() => ({
  getRevisionComparisonInfo: vi.fn(),
  getRevisionComparisonConfig: vi.fn(),
  getEffectiveSourceOption: vi.fn(),
  getSelectableTemplates: vi.fn(async () => []),
}));
vi.mock("@/services/api/documents", () => ({ documentApi: api }));
vi.mock("../OnlyOfficeDocumentViewer", () => ({ OnlyOfficeDocumentViewer: () => <div data-testid="viewer" /> }));

const info = (over: Record<string, unknown> = {}) => ({ comparisonAvailable: false, ...over });

beforeEach(() => vi.clearAllMocks());

describe("Compare with Effective button", () => {
  it("is offered only when the server says the comparison is available", async () => {
    api.getRevisionComparisonInfo.mockResolvedValue(info());
    render(<CompareWithEffectiveButton revisionId="r1" />);
    await waitFor(() => expect(api.getRevisionComparisonInfo).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Compare with Effective/ })).toBeNull();
  });

  it("opens the read-only comparison", async () => {
    api.getRevisionComparisonInfo.mockResolvedValue(info({ comparisonAvailable: true, baselineRevisionNumber: "1.0.0" }));
    render(<CompareWithEffectiveButton revisionId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Compare with Effective/ }));
    expect(await screen.findByTestId("viewer")).toBeTruthy();
    expect(screen.getByText(/Changes since effective revision 1\.0\.0/)).toBeTruthy();
  });
});

describe("Upload Revision: file source", () => {
  const open = (documentId: string | undefined, onConfirm = vi.fn()) => {
    render(
      <UploadRevisionModal isOpen onClose={vi.fn()} onConfirm={onConfirm} documentId={documentId}
        documentName="SOP" revisionNumber="1.0.1" documentType="SOP" />,
    );
    return onConfirm;
  };

  it("starts from the effective file when it exists, with the upload still possible", async () => {
    api.getEffectiveSourceOption.mockResolvedValue({ available: true, revisionNumber: "1.0.0" });
    const onConfirm = open("d1");
    await screen.findByText("Use the file of effective revision 1.0.0");
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onConfirm).toHaveBeenCalledWith(null, "", false, undefined, true);

    fireEvent.click(screen.getByLabelText("Upload a new file"));
    expect(screen.getByRole("button", { name: /Choose File/ })).toBeTruthy();
  });

  it("explains why the effective file cannot be used", async () => {
    api.getEffectiveSourceOption.mockResolvedValue({ available: false, unavailableReason: "EFFECTIVE_HAS_NO_DOCX", revisionNumber: "1.0.0" });
    open("d1");
    expect(await screen.findByText(/has no Word \(\.docx\) file/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose File/ })).toBeTruthy();
  });

  it("offers no choice for a new document", () => {
    open(undefined);
    expect(api.getEffectiveSourceOption).not.toHaveBeenCalled();
    expect(screen.queryByText("File source")).toBeNull();
  });
});
