import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const files = vi.hoisted(() => ({ personEvidenceFile: vi.fn(), personEvidenceViewConfig: vi.fn() }));
const saveBlob = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/trainingActivities", async (importOriginal) => {
  const original = await importOriginal<{ trainingFilesApi: object }>();
  return { ...original, trainingFilesApi: { ...original.trainingFilesApi, ...files } };
});
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({ DocumentPdfViewer: ({ fileUrl }: { fileUrl: string }) => <div>PDF OF {fileUrl}</div> }));
vi.mock("@/features/documents/shared/components/OnlyOfficeDocumentViewer", () => ({ OnlyOfficeDocumentViewer: () => <div>WORD VIEWER</div> }));
vi.mock("../../../shared/SpecimenSignaturePanel", () => ({ SpecimenSignaturePanel: ({ personName }: { personName: string }) => <div>SPECIMEN OF {personName}</div> }));
vi.mock("../../../shared/trainingLabels", async (importOriginal) => ({ ...(await importOriginal<object>()), saveBlob }));

import { TrainingScanReviewModal } from "../TrainingScanReviewModal";

const evidence = { id: "e1", kind: "ASSESSMENT" as const, originalName: "paper.pdf", sizeBytes: 1000, sha256: "x", uploadedAt: "2026-10-20T08:00:00Z", uploadedByName: "Admin", contentType: "application/pdf" };
const renderModal = () => render(<TrainingScanReviewModal activityId="a1" personId="u1" personName="A B" evidence={evidence} fileName="TRN-QA-26-1_E1_A B.pdf" onClose={() => undefined} />);

beforeEach(() => {
  Object.values(files).forEach((f) => f.mockReset());
  saveBlob.mockReset();
  files.personEvidenceFile.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  URL.createObjectURL = vi.fn(() => "blob:scan");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("Scan of a test with the specimen signature", () => {
  it("shows the scan under the name it is saved with, and the specimen signature of the person beside it", async () => {
    renderModal();

    expect(await screen.findByText("PDF OF blob:scan")).toBeTruthy();
    expect(screen.getByText("TRN-QA-26-1_E1_A B.pdf")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Specimen signature" })).toBeTruthy();
    expect(screen.getByText("SPECIMEN OF A B")).toBeTruthy();
    expect(files.personEvidenceFile).toHaveBeenCalledWith("u1", "a1", "e1", true);
  });

  it("downloads the scan under the same name", async () => {
    renderModal();
    await screen.findByText("PDF OF blob:scan");

    fireEvent.click(screen.getByRole("button", { name: "Download Scan" }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "TRN-QA-26-1_E1_A B.pdf"));
    expect(files.personEvidenceFile).toHaveBeenLastCalledWith("u1", "a1", "e1", false);
  });
});
