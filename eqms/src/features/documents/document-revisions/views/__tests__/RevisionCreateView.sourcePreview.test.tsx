import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const boundary = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  upload: vi.fn(),
  snapshot: vi.fn(),
  viewConfig: vi.fn(),
  editor: vi.fn(),
  destroyed: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/services/api/documents", () => ({ documentApi: {
  getRevisionById: vi.fn(async () => boundary.current),
  getRevisionByIdSnapshot: boundary.snapshot,
  uploadRevisionFile: boundary.upload,
  getRevisionOnlyOfficeViewConfig: boundary.viewConfig,
} }));
vi.mock("@/features/documents/shared/useDocumentPermissions", () => ({
  useDocumentPermissions: () => ({ user: { id: "author-1", fullName: "Author" }, canUseDocumentTemplate: false }),
}));
vi.mock("@/hooks/useRevisionActionCapabilities", () => ({
  useRevisionActionCapabilities: () => ({ loading: false, can: (action: string) => action === "uploadSource", refresh: vi.fn(async () => null) }),
}));
vi.mock("@/hooks", () => ({ useNavigateWithLoading: () => ({ navigateTo: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: boundary.toast }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div> }));
vi.mock("@/components/ui/workflow-stepper/WorkflowStepper", () => ({ WorkflowStepper: () => null }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({ ESignatureModal: () => null }));
vi.mock("@/components/ui/breadcrumb/breadcrumbs.config", () => ({ createRevision: vi.fn() }));
vi.mock("@/features/notifications/notificationRealtime", () => ({ subscribeNotificationRealtime: () => () => {} }));
vi.mock("@/features/documents/document-list/document-creation/UploadRevisionModal", () => ({ UploadRevisionModal: () => null }));
vi.mock("@/features/documents/shared/components/OnlyOfficeCapacityNotice", () => ({ OnlyOfficeCapacityNotice: () => null }));
vi.mock("@/features/documents/shared/components/DocumentPdfViewer", () => ({ DocumentPdfViewer: () => null }));
vi.mock("@/features/documents/document-revisions/workspace-tabs", async () => {
  const { DocumentTab } = await import("@/features/documents/document-revisions/detail-revision/tabs/DocumentTab");
  return {
    DocumentTab, GeneralInformationTab: () => null, WorkingNotesTab: () => null,
    InfoFromDocumentTab: () => null, TrainingInformationTab: () => null, SignaturesTab: () => null,
    AuditTrailTab: () => null, OriginalDocumentTab: () => null,
    RevisionWorkspaceReviewersTab: () => null, RevisionWorkspaceApproversTab: () => null,
  };
});

import { RevisionCreateView } from "../RevisionCreateView";

const storedSource = (checksum: string) => ({
  sourceFileChecksum: checksum, sourceStorageObjectKey: `sources/${checksum}.docx`,
  sourceStorageVersionId: `version-${checksum}`, sourceUploadedAt: `2026-10-16T0${checksum === "old" ? 1 : 2}:00:00Z`,
});

beforeEach(() => {
  vi.clearAllMocks();
  boundary.current = {
    id: "revision-1", documentId: "document-1", documentNumber: "SOP.0001", documentName: "Test",
    revisionNumber: "1.0.0", status: "Draft", statusCode: "DRAFT", editingStatus: "IN_PROGRESS",
    reviewers: [], approvers: [], coAuthors: [], signatures: [], workingNotes: [],
    previewType: "SOURCE_DOCX", ...storedSource("old"),
  };
  boundary.snapshot.mockImplementation(async () => boundary.current);
  boundary.viewConfig.mockImplementation(async () => ({ document: { key: boundary.current.sourceFileChecksum } }));
  window.DocsAPI = { DocEditor: vi.fn(function (_id: string, config: Record<string, unknown>) {
    boundary.editor(config);
    return { destroyEditor: boundary.destroyed };
  }) };
});

afterEach(() => { delete window.DocsAPI; });

function openWorkspace() {
  return render(<MemoryRouter initialEntries={["/revisions/revision-1?tab=document"]}>
    <Routes><Route path="/revisions/:id" element={<RevisionCreateView />} /></Routes>
  </MemoryRouter>);
}

function chooseFile(container: HTMLElement) {
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [new File(["new source"], "replacement.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })] },
  });
}

describe("Revision source preview refresh", () => {
  it.each([true, false])("reloads the signed viewer config after upload (existing source: %s)", async (hasSource) => {
    if (!hasSource) boundary.current = { ...boundary.current, sourceFileChecksum: null, sourceStorageObjectKey: null };
    boundary.upload.mockImplementation(async () => {
      boundary.current = { ...boundary.current, ...storedSource("new") };
      return { success: true }; // The mutation may return only a lightweight action response.
    });
    const { container } = openWorkspace();
    await screen.findAllByRole("button", { name: hasSource ? "Replace Source File" : "Upload Source File" });
    if (hasSource) await waitFor(() => expect(boundary.editor).toHaveBeenCalledWith(expect.objectContaining({ document: { key: "old" } })));
    chooseFile(container);
    await waitFor(() => expect(boundary.editor).toHaveBeenLastCalledWith(expect.objectContaining({ document: { key: "new" } })));
    expect(boundary.snapshot).toHaveBeenCalledWith("revision-1", { force: true });
    if (hasSource) expect(boundary.destroyed).toHaveBeenCalled();
  });

  it("keeps the current viewer when upload fails", async () => {
    boundary.upload.mockRejectedValue(new Error("Upload rejected"));
    const { container } = openWorkspace();
    await waitFor(() => expect(boundary.editor).toHaveBeenCalledTimes(1));
    chooseFile(container);
    await waitFor(() => expect(boundary.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Upload failed" })));
    expect(boundary.editor).toHaveBeenCalledTimes(1);
    expect(boundary.destroyed).not.toHaveBeenCalled();
  });
});
