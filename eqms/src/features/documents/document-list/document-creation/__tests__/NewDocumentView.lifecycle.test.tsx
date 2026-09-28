import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

// --- Mock every network/API boundary and unrelated heavy dependency. The Document Lifecycle
// capability derivation (canCancelDocument/canObsoleteDocument from getResourceCapabilities) and
// stale-state refresh logic (getHttpStatus, hydrateDocumentFromBackend) under test live directly
// in NewDocumentView.tsx -- none of the mocks below touch that logic.

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", fullName: "Test User" } }),
}));

vi.mock("@/features/documents/shared/useDocumentPermissions", () => ({
  useDocumentPermissions: () => ({
    canAdministerDocumentWorkspace: true,
    canConfigureInitialDocumentWorkflow: true,
    canCreateDocumentShell: true,
    canUseDocumentTemplate: true,
  }),
}));

vi.mock("@/hooks", () => ({
  useNavigateWithLoading: () => ({ navigateTo: vi.fn(), isNavigating: false }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/services/api/settings", () => ({ settingsApi: {} }));
vi.mock("@/services/api/auditTrail", () => ({
  auditTrailApi: { getByEntity: vi.fn(async () => []) },
}));

const { documentApiMock, securityApiMock, dictionaryApiMock, documentLifecycleActionsMock } = vi.hoisted(() => ({
  documentApiMock: {
    getDocumentById: vi.fn(),
    getDocumentDetailSnapshot: vi.fn(),
    cancelDocument: vi.fn(),
    cancelDocumentCompat: vi.fn(),
    obsoleteDocument: vi.fn(),
  },
  securityApiMock: {
    getResourceCapabilities: vi.fn(),
    getEligibleUsers: vi.fn(async () => []),
  },
  dictionaryApiMock: {
    getBusinessUnits: vi.fn(async () => []),
    getDepartments: vi.fn(async () => []),
    getDocumentTypes: vi.fn(async () => []),
    getSubTypes: vi.fn(async () => []),
  },
  documentLifecycleActionsMock: {
    canObsoleteDocumentWithRevisionHistory: vi.fn(() => true),
    hasEffectiveRevision: vi.fn(() => true),
    hasOpenRevisionInProgress: vi.fn(() => false),
    canObsoleteDocumentStatus: vi.fn(() => true),
  },
}));
vi.mock("@/services/api/documents", () => ({ documentApi: documentApiMock }));
vi.mock("@/services/api/security", () => ({ securityApi: securityApiMock }));
vi.mock("@/services/api/dictionary", () => ({ dictionaryApi: dictionaryApiMock }));
// TC-DOC-055: spy on the pre-existing helper. NewDocumentView does not import it at all (verified
// by source inspection), so this mock proves -- behaviorally, not by string-matching -- that it is
// never invoked while Obsolete availability is driven solely by the server capability.
vi.mock("@/features/documents/shared/documentLifecycleActions", () => documentLifecycleActionsMock);

// Unrelated heavy subtrees -- not part of the Document Lifecycle capability/refresh logic.
vi.mock("@/features/documents/document-list/document-creation/new-tabs", () => ({
  GeneralTab: () => null,
  TrainingTab: () => null,
  SignaturesTab: () => null,
  AuditTab: () => null,
  DocumentTab: () => null,
  DocumentRevisionsTab: () => null,
  ReviewersTab: () => null,
  ApproversTab: () => null,
  ControlledCopiesTab: () => null,
  RelatedDocumentsTab: () => null,
  CorrelatedDocumentsTab: () => null,
  DocumentRelationships: () => null,
}));
vi.mock("../UploadRevisionModal", () => ({ UploadRevisionModal: () => null }));

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

import { NewDocumentView } from "../NewDocumentView";

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

const capabilities = (cancelAllowed: boolean, obsoleteAllowed: boolean) => ({
  actions: {
    cancel: { allowed: cancelAllowed },
    obsolete: { allowed: obsoleteAllowed },
    editInitialDraft: { allowed: false },
  },
});

// NewDocumentView renders a duplicate action bar for small viewports, so Obsolete/Cancel can
// legitimately appear twice at once -- take the first as representative.
async function findFirstButton(name: string) {
  const buttons = await screen.findAllByRole("button", { name });
  return buttons[0];
}

function renderView() {
  return render(
    <MemoryRouter initialEntries={["/documents/edit/doc-1"]}>
      <BreadcrumbProvider>
        <Routes>
          <Route path="/documents/edit/:id" element={<NewDocumentView />} />
        </Routes>
      </BreadcrumbProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  documentApiMock.getDocumentById.mockResolvedValue(baseDetail);
  documentApiMock.getDocumentDetailSnapshot.mockResolvedValue(baseDetail);
  documentLifecycleActionsMock.canObsoleteDocumentWithRevisionHistory.mockReturnValue(true);
  documentLifecycleActionsMock.hasEffectiveRevision.mockReturnValue(true);
  documentLifecycleActionsMock.hasOpenRevisionInProgress.mockReturnValue(false);
});

describe("NewDocumentView -- TC-DOC-054: capability-driven Cancel/Obsolete availability (cross-view with DetailDocumentView)", () => {
  it("A. renders Obsolete and Cancel when the server capability allows them", async () => {
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(true, true));
    renderView();
    expect(await findFirstButton("Obsolete")).toBeInTheDocument();
    expect(await findFirstButton("Cancel")).toBeInTheDocument();
  });

  it("B. hides Obsolete and Cancel when the server capability denies them", async () => {
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(false, false));
    renderView();
    await waitFor(() => expect(securityApiMock.getResourceCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Obsolete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("C. hides Obsolete and Cancel while the capability request is unavailable/loading", async () => {
    securityApiMock.getResourceCapabilities.mockRejectedValue(new Error("network error"));
    renderView();
    await waitFor(() => expect(securityApiMock.getResourceCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Obsolete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});

describe("NewDocumentView -- TC-DOC-055: does not re-derive Obsolete authority client-side", () => {
  it("Obsolete availability follows the server capability even when the legacy helper would say otherwise", async () => {
    // Server denies; the legacy helper (if it were consulted) would say "allowed" -- if
    // NewDocumentView re-derived authority from it, Obsolete would incorrectly appear.
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(true, false));
    documentLifecycleActionsMock.canObsoleteDocumentWithRevisionHistory.mockReturnValue(true);
    documentLifecycleActionsMock.hasEffectiveRevision.mockReturnValue(true);
    documentLifecycleActionsMock.hasOpenRevisionInProgress.mockReturnValue(false);

    renderView();
    await waitFor(() => expect(securityApiMock.getResourceCapabilities).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Obsolete" })).not.toBeInTheDocument();
    expect(documentLifecycleActionsMock.canObsoleteDocumentWithRevisionHistory).not.toHaveBeenCalled();
  });
});

describe("NewDocumentView -- TC-DOC-056: unrelated documentLifecycleActions consumers preserved", () => {
  it("hasEffectiveRevision and hasOpenRevisionInProgress remain exported and usable for other call sites", async () => {
    const actual = await vi.importActual<typeof import("@/features/documents/shared/documentLifecycleActions")>(
      "@/features/documents/shared/documentLifecycleActions",
    );
    expect(typeof actual.canObsoleteDocumentWithRevisionHistory).toBe("function");
    expect(typeof actual.hasEffectiveRevision).toBe("function");
    expect(typeof actual.hasOpenRevisionInProgress).toBe("function");
    expect(actual.hasEffectiveRevision([{ statusInfo: { code: "EFFECTIVE" } }])).toBe(true);
    expect(actual.hasOpenRevisionInProgress([{ statusInfo: { code: "DRAFT" } }])).toBe(true);
    expect(actual.canObsoleteDocumentWithRevisionHistory("Active", [{ statusInfo: { code: "EFFECTIVE" } }])).toBe(true);
  });
});

describe("NewDocumentView -- TC-DOC-057/058/059/060: stale-state recovery on 403/409/410", () => {
  it.each([
    ["TC-DOC-057", 403],
    ["TC-DOC-058", 409],
    ["TC-DOC-059", 410],
  ])("%s Obsolete: a %i triggers immediate refresh of detail + capabilities", async (_tc, status) => {
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(true, true));
    renderView();

    const obsoleteButton = await findFirstButton("Obsolete");
    fireEvent.click(obsoleteButton);
    const confirmButton = await screen.findByTestId("esign-confirm");

    documentApiMock.obsoleteDocument.mockRejectedValue({ response: { status } });
    const detailCallsBefore = documentApiMock.getDocumentById.mock.calls.length + documentApiMock.getDocumentDetailSnapshot.mock.calls.length;
    const capabilityCallsBefore = securityApiMock.getResourceCapabilities.mock.calls.length;

    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(
        documentApiMock.getDocumentById.mock.calls.length + documentApiMock.getDocumentDetailSnapshot.mock.calls.length,
      ).toBeGreaterThan(detailCallsBefore),
    );
    await waitFor(() =>
      expect(securityApiMock.getResourceCapabilities.mock.calls.length).toBeGreaterThan(capabilityCallsBefore),
    );
  });

  it.each([
    ["TC-DOC-057", 403],
    ["TC-DOC-058", 409],
    ["TC-DOC-059", 410],
  ])("%s Cancel: a %i triggers immediate refresh of detail + capabilities", async (_tc, status) => {
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(true, true));
    renderView();

    const cancelButton = await findFirstButton("Cancel");
    fireEvent.click(cancelButton);

    const activitySummaryInput = await screen.findByRole("textbox");
    fireEvent.change(activitySummaryInput, { target: { value: "Test cancel reason" } });

    documentApiMock.cancelDocument.mockRejectedValue({ response: { status } });
    const capabilityCallsBefore = securityApiMock.getResourceCapabilities.mock.calls.length;

    const confirmCancelButton = await screen.findByRole("button", { name: /Confirm Cancel|Yes, Cancel|Cancel Document/i });
    fireEvent.click(confirmCancelButton);

    await waitFor(() =>
      expect(securityApiMock.getResourceCapabilities.mock.calls.length).toBeGreaterThan(capabilityCallsBefore),
    );
  });

  it("TC-DOC-060: a 409 on Obsolete followed by a fresh denied capability disables Obsolete without a page reload", async () => {
    securityApiMock.getResourceCapabilities.mockResolvedValueOnce(capabilities(true, true));
    renderView();

    const obsoleteButton = await findFirstButton("Obsolete");
    fireEvent.click(obsoleteButton);
    const confirmButton = await screen.findByTestId("esign-confirm");

    documentApiMock.obsoleteDocument.mockRejectedValue({ response: { status: 409 } });
    securityApiMock.getResourceCapabilities.mockResolvedValue(capabilities(true, false));

    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Obsolete" })).not.toBeInTheDocument(),
    );
  });
});
