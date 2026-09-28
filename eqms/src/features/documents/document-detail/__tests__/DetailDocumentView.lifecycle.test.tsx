import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

// --- Mock every network/API boundary and unrelated heavy dependency. The Document Lifecycle
// capability derivation and stale-state refresh logic under test (documentMasterCapabilities,
// refreshLifecycleState, getHttpStatus, canObsoleteCurrentDocument) lives directly in
// DetailDocumentView.tsx itself -- none of the mocks below touch that logic.

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", fullName: "Test User" } }),
}));

vi.mock("@/features/documents/shared/useDocumentPermissions", () => ({
  useDocumentPermissions: () => ({ canUseDocumentTemplate: true }),
}));

vi.mock("@/hooks", () => ({
  useNavigateWithLoading: () => ({ navigateTo: vi.fn(), isNavigating: false }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/services/api/settings", () => ({
  settingsApi: {},
}));

vi.mock("@/features/notifications/notificationRealtime", () => ({
  subscribeNotificationRealtime: () => () => {},
}));

const { documentApiMock, securityApiMock } = vi.hoisted(() => ({
  documentApiMock: {
    getDocumentDetail: vi.fn(),
    getDocumentDetailSnapshot: vi.fn(),
    getDocumentAuditTrail: vi.fn(),
    obsoleteDocument: vi.fn(),
    getDocumentSignatures: vi.fn(async () => []),
  },
  securityApiMock: {
    getResourceCapabilities: vi.fn(),
    getEligibleUsers: vi.fn(async () => []),
  },
}));
vi.mock("@/services/api/documents", () => ({
  documentApi: documentApiMock,
}));
vi.mock("@/services/api/security", () => ({
  securityApi: securityApiMock,
}));

// Unrelated heavy subtrees (tabs, revision/controlled-copy tables, etc.) -- not part of the
// Document Lifecycle capability/refresh logic under test.
vi.mock("../tabs", () => ({
  GeneralInformationTab: ({ document }: any) => (
    <div data-testid="general-tab">{document?.id || ""}</div>
  ),
  TrainingInformationTab: () => null,
  DocumentTab: () => null,
  SignaturesTab: () => null,
  AuditTrailTab: () => null,
}));
vi.mock("../tabs/subtabs", () => ({
  DocumentRevisionsTab: () => null,
  ControlledCopiesTab: () => null,
  RelatedDocumentsTab: () => null,
  CorrelatedDocumentsTab: () => null,
}));
vi.mock("@/features/documents/document-list/document-creation/new-tabs", () => ({
  ReviewersTab: () => null,
  ApproversTab: () => null,
  DocumentRelationships: () => null,
}));
vi.mock("../components/ReadOnlyReviewersTable", () => ({
  ReadOnlyReviewersTable: () => null,
}));
vi.mock("../components/ReadOnlyApproversTable", () => ({
  ReadOnlyApproversTable: () => null,
}));
vi.mock("@/features/documents/document-list/document-creation/UploadRevisionModal", () => ({
  UploadRevisionModal: () => null,
}));

// ESignatureModal is a generic, reusable e-signature capture UI -- not Document Lifecycle logic.
// Stubbed to immediately expose a "Confirm" trigger that calls the real onConfirm callback (the
// actual DetailDocumentView.handleObsoleteConfirm under test), bypassing its own internal
// password/meaning-policy UI, which is unrelated to lifecycle stale-state recovery.
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ isOpen, onConfirm }: any) =>
    isOpen ? (
      <button
        data-testid="esign-confirm"
        onClick={() =>
          onConfirm({ username: "test", password: "x", reason: "test reason", signatureToken: "tok-1" })
        }
      >
        Confirm Signature
      </button>
    ) : null,
}));

import { DetailDocumentView } from "../DetailDocumentView";

const baseDetail = {
  id: "doc-1",
  documentNumber: "DOC.0001",
  documentName: "Test Document",
  type: "SOP",
  revisionNumber: "1.0.0",
  status: "Active",
  effectiveDate: "",
  validUntil: "",
  reviewDate: "",
  author: "Test User",
  authorId: "user-1",
  department: "QA",
  created: "",
  createdDate: "",
  openedBy: "",
  description: "",
  owner: "Test User",
  reviewers: [],
  approvers: [],
  lastModifiedBy: "",
  lastModifiedDate: "",
  isTemplate: false,
  titleLocalLanguage: "",
  businessUnit: "",
  knowledgeBase: "",
  subType: "",
  periodicReviewCycle: 0,
  periodicReviewNotification: 0,
  language: "English",
  trainingPeriodDays: null,
  reasonForSkippingTraining: "",
  coAuthors: [],
  signatures: [],
  relatedDocuments: [],
  correlatedDocuments: [],
  revisions: [],
  hasRelatedDocuments: false,
  hasCorrelatedDocuments: false,
} as any;

const capabilities = (obsoleteAllowed: boolean) => ({
  actions: {
    obsolete: { allowed: obsoleteAllowed },
  },
});

function renderView() {
  return render(
    <MemoryRouter>
      <BreadcrumbProvider>
        <DetailDocumentView documentId="doc-1" onBack={() => {}} />
      </BreadcrumbProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  documentApiMock.getDocumentDetail.mockResolvedValue(baseDetail);
  documentApiMock.getDocumentDetailSnapshot.mockResolvedValue(baseDetail);
  documentApiMock.getDocumentAuditTrail.mockResolvedValue([]);
});

describe("DetailDocumentView -- TC-DOC-054: capability-driven Obsolete availability", () => {
  it("A. renders Obsolete when the server capability allows it", async () => {
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(true));
    renderView();
    expect(await screen.findByRole("button", { name: "Obsolete" })).toBeInTheDocument();
  });

  it("B. does not render Obsolete when the server capability denies it", async () => {
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(false));
    renderView();
    await screen.findByTestId("general-tab");
    await waitFor(() => expect(securityApiMock.getResourceCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Obsolete" })).not.toBeInTheDocument();
  });

  it("C. does not render Obsolete while the capability request is unavailable/loading", async () => {
    securityApiMock.getResourceCapabilities.mockRejectedValue(new Error("network error"));
    renderView();
    await screen.findByTestId("general-tab");
    await waitFor(() => expect(securityApiMock.getResourceCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Obsolete" })).not.toBeInTheDocument();
  });
});

describe("DetailDocumentView -- TC-DOC-057/058/059/060: stale-state recovery on 403/409/410", () => {
  it.each([
    ["TC-DOC-057", 403],
    ["TC-DOC-058", 409],
    ["TC-DOC-059", 410],
  ])("%s: a %i from Obsolete triggers immediate refresh of detail + capabilities", async (_tc, status) => {
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(true));
    renderView();

    await screen.findByText("doc-1"); // document detail (not just capabilities) has loaded
    const obsoleteButton = await screen.findByRole("button", { name: "Obsolete" });
    fireEvent.click(obsoleteButton);

    const confirmButton = await screen.findByTestId("esign-confirm");
    documentApiMock.obsoleteDocument.mockRejectedValue({ response: { status } });
    // Refresh (post-failure) resolves with the SAME allowed=true detail/capabilities here --
    // this test only proves the refresh calls happen, not the resulting UI state (see TC-DOC-060).
    const callCountBefore = documentApiMock.getDocumentDetailSnapshot.mock.calls.length;
    const capabilityCallCountBefore = securityApiMock.getResourceCapabilities.mock.calls.length;

    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(documentApiMock.getDocumentDetailSnapshot.mock.calls.length).toBeGreaterThan(callCountBefore),
    );
    await waitFor(() =>
      expect(securityApiMock.getResourceCapabilities.mock.calls.length).toBeGreaterThan(capabilityCallCountBefore),
    );
  });

  it("TC-DOC-060: a 409 followed by a fresh denied capability disables Obsolete without a page reload", async () => {
    securityApiMock.getResourceCapabilities.mockResolvedValueOnce(capabilities(true));
    renderView();

    await screen.findByText("doc-1");
    const obsoleteButton = await screen.findByRole("button", { name: "Obsolete" });
    fireEvent.click(obsoleteButton);
    const confirmButton = await screen.findByTestId("esign-confirm");

    documentApiMock.obsoleteDocument.mockRejectedValue({ response: { status: 409 } });
    // The refresh triggered by the failed mutation must observe the NEW, now-denied capability.
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(false));

    fireEvent.click(confirmButton);

    // Same mounted component instance re-renders -- no reload/remount is used to observe this.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Obsolete" })).not.toBeInTheDocument(),
    );
  });
});
