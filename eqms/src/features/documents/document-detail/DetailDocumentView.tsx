import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentPermissions } from "@/features/documents/shared/useDocumentPermissions";
import { cn } from "@/components/ui/utils";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { TabNav } from "@/components/ui/tabs/TabNav";
import {
  GeneralInformationTab,
  TrainingInformationTab,
  DocumentTab,
  SignaturesTab,
  AuditTrailTab,
} from "./tabs";
import type { AuditEntry } from "./tabs/AuditTab";
import type { SignatureRecord } from "./tabs/SignaturesTab";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { documentDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useNavigateWithLoading } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ArrowRight } from "lucide-react";
import { settingsApi } from "@/services/api/settings";
import { useToast } from "@/components/ui/toast";
import {
  ReviewersTab as EditableReviewersTab,
  ApproversTab as EditableApproversTab,
  DocumentRelationships,
} from "@/features/documents/document-list/document-creation/new-tabs";
import { UploadRevisionModal } from "@/features/documents/document-list/document-creation/UploadRevisionModal";
import { documentApi } from "@/services/api/documents";
import { securityApi, type ResourceCapabilities } from "@/services/api/security";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import {
  buildControlledCopySnapshotState,
  buildRevisionDetailSnapshotState,
  isDocumentDetailSnapshotPreload,
  refreshDetailAfterSnapshot,
} from "@/features/documents/shared/detailSnapshotHelpers";

import {
  DocumentRevisionsTab,
  ControlledCopiesTab,
  RelatedDocumentsTab,
  CorrelatedDocumentsTab,
} from "./tabs/subtabs";
import { ReadOnlyReviewersTable } from "./components/ReadOnlyReviewersTable";
import { ReadOnlyApproversTable } from "./components/ReadOnlyApproversTable";
import type {
  Revision,
  Reviewer,
  Approver,
  RelatedDocument,
  ParentDocument,
} from "./tabs/subtabs";
import type { DocumentType, DocumentStatus } from "@/features/documents/types";
import type {
  DocumentDetailResponse,
  DocumentParticipantItem,
} from "@/features/documents/document-list/types";
import {
  documentWorkflowStepIndex,
  DOCUMENT_WORKFLOW_STEPS,
  mapRevisionSummaryFromApi,
  normalizeDocumentStatusForStepper,
  resolveTerminalProgressStep,
} from "@/features/documents/shared/statusMapping";
import {
  buildControlledCopyRequestStateFromDocumentDetail,
  buildControlledCopyRequestRouteStateFromRevision,
  findLatestEffectiveRevision,
} from "@/features/documents/shared/controlledCopyRequest";
import {
  buildDocumentPreviewFileName,
  buildPreviewVersionCacheBuster,
  loadPdfPreviewFile,
} from "@/features/documents/shared/previewHelpers";
import type {
  RevisionWorkspaceState,
  WorkspaceNavigationMode,
} from "@/features/documents/shared/navigationContext";

// --- Types ---
type TabType = "general" | "training" | "document" | "signatures" | "audit";
type SubTabType =
  | "revisions"
  | "reviewers"
  | "approvers"
  | "controlledCopies"
  | "relatedDocuments"
  | "correlatedDocuments";

interface DetailDocumentViewProps {
  documentId: string;
  onBack: () => void;
  initialTab?: TabType;
  initialStatus?: DocumentStatus;
  fromOwned?: boolean;
}

type DetailDocumentModel = DocumentDetailResponse & {
  coAuthorNames: string[];
  coAuthors: DocumentParticipantItem[];
};

const createEmptyDocumentDetail = (): DocumentDetailResponse => ({
  id: "",
  documentNumber: "",
  documentName: "",
  type: "" as DocumentType,
  revisionNumber: "",
  status: "Draft",
  effectiveDate: "",
  validUntil: "",
  reviewDate: "",
  author: "",
  department: "",
  created: "",
  createdDate: "",
  openedBy: "",
  description: "",
  owner: "",
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
});

const asArray = <T,>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];
const sameOrderedIds = (
  left: Array<{ id?: string | null }>,
  right: Array<{ id?: string | null }>,
) =>
  left.length === right.length &&
  left.every(
    (item, index) => String(item.id || "") === String(right[index]?.id || ""),
  );

export const DetailDocumentView: React.FC<DetailDocumentViewProps> = ({
  documentId,
  onBack,
  initialTab = "general",
  initialStatus,
  fromOwned = false,
}) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { canUseDocumentTemplate } = useDocumentPermissions();
  const { navigateTo, isNavigating: isRouteNavigating } =
    useNavigateWithLoading();
  const searchWorkflowUsers = useCallback(async (query: string) => {
    const results = await securityApi.getEligibleUsers("documents.document.view", query);
    return (results || []).map((user) => ({
      label: user.employeeCode ? `${user.employeeCode} - ${user.fullName}` : user.fullName || user.id,
      value: user.id,
    }));
  }, []);
  const state = location.state as {
    initialStatus?: DocumentStatus;
    fromOwned?: boolean;
    preloadedDocumentDetail?: DocumentDetailResponse;
    preloadedDocumentDetailSnapshot?: boolean;
    preloadedDocumentAuditTrail?: AuditEntry[];
    workspaceState?: RevisionWorkspaceState | null;
  } | null;

  const [localStatus, setLocalStatus] = useState<DocumentStatus | undefined>(
    initialStatus,
  );
  const [isDetailLoading, setIsDetailLoading] = useState(true);
  const [documentMasterCapabilities, setDocumentMasterCapabilities] =
    useState<ResourceCapabilities | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [nonEffectiveDocs, setNonEffectiveDocs] = useState<
    Array<{ field: string; message: string }>
  >([]);
  const [showObsoleteModal, setShowObsoleteModal] = useState(false);
  const [isObsoleteSubmitting, setIsObsoleteSubmitting] = useState(false);
  const [pendingPublishParams, setPendingPublishParams] = useState<{
    revisionId: string;
    reason: string;
    comment: string;
    signatureToken: string;
  } | null>(null);
  const [isBackLoading, setIsBackLoading] = useState(false);
  const { showToast } = useToast();
  const [document, setDocument] = useState<DetailDocumentModel>(() => ({
    ...createEmptyDocumentDetail(),
    coAuthorNames: [],
    coAuthors: [],
  }));
  const initialReviewDateRef = useRef("");
  const [reviewDateDraft, setReviewDateDraft] = useState("");
  type TrainingDraft = {
    isRequired: boolean;
    trainingPeriodDays: number | null;
    reasonForSkippingTraining: string | null;
  };
  const initialTrainingDraftRef = useRef<TrainingDraft>({
    isRequired: false,
    trainingPeriodDays: null,
    reasonForSkippingTraining: "",
  });
  const [trainingDraft, setTrainingDraft] = useState<TrainingDraft>(initialTrainingDraftRef.current);
  const initialAuthorIdRef = useRef("");
  const initialAuthorNameRef = useRef("");
  const [authorNameDraft, setAuthorNameDraft] = useState("");
  const initialCoAuthorIdsRef = useRef<string[]>([]);
  const initialCoAuthorNamesRef = useRef<string[]>([]);
  const initialPeriodicReviewCycleRef = useRef<number | null>(null);
  const initialPeriodicReviewNotificationRef = useRef<number | null>(null);
  const initialDescriptionRef = useRef("");
  const [showAuthorHandoffWarning, setShowAuthorHandoffWarning] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  // Off by default even when the user holds every underlying permission -- having permission only
  // decides whether "Edit Revision for Upgrade" is offered, not whether the fields are live. This is
  // local, unpersisted state: leaving the page without saving and coming back always resets it, so
  // an abandoned edit never lingers.
  const [isEditModeActive, setIsEditModeActive] = useState(false);
  const [showEditModeConfirmModal, setShowEditModeConfirmModal] = useState(false);
  const [showUploadRevisionUnsavedWarning, setShowUploadRevisionUnsavedWarning] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [coAuthors, setCoAuthors] = useState<string[]>([]);
  const [coAuthorItems, setCoAuthorItems] = useState<DocumentParticipantItem[]>(
    [],
  );
  const [coAuthorNames, setCoAuthorNames] = useState<string[]>([]);
  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>(
    [],
  );
  const [correlatedDocuments, setCorrelatedDocuments] = useState<
    ParentDocument[]
  >([]);
  const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);
  const [isApproverModalOpen, setIsApproverModalOpen] = useState(false);
  const [isRelatedDocumentsModalOpen, setIsRelatedDocumentsModalOpen] =
    useState(false);
  const [isCorrelatedDocumentsModalOpen, setIsCorrelatedDocumentsModalOpen] =
    useState(false);
  const [isSavingWorkflowConfiguration, setIsSavingWorkflowConfiguration] =
    useState(false);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const initialActiveTab =
    searchParams.get("tab") === "audit" ? "audit" : initialTab;
  const revisionWorkspaceMode: WorkspaceNavigationMode =
    state?.workspaceState?.revisionWorkspaceMode === "edit"
      ? "edit"
      : state?.workspaceState
        ? "create"
        : "detail";
  const revisionWorkspaceReturnPath =
    state?.workspaceState?.workspaceReturnPath ||
    state?.workspaceState?.returnTo ||
    state?.workspaceState?.from;

  const applyDocumentDetail = React.useCallback(
    (detail: DocumentDetailResponse, auditTrailResponse?: AuditEntry[]) => {
      const resolvedStatus = normalizeDocumentStatusForStepper(
        detail.status,
        detail.statusInfo,
      );
      const coAuthorList = asArray(detail.coAuthors);
      const reviewerList = asArray(detail.reviewers);
      const approverList = asArray(detail.approvers);
      const relatedDocumentList = asArray(detail.relatedDocuments);
      const correlatedDocumentList = asArray(detail.correlatedDocuments);
      const revisionList = asArray(detail.revisions);

      const normalizedDocument: DetailDocumentModel = {
        id: detail.id,
        documentNumber: detail.documentNumber,
        documentName: detail.documentName || "",
        type: (detail.type || "") as DocumentType,
        revisionNumber: detail.revisionNumber || "",
        status: resolvedStatus as DocumentStatus,
        statusCode: detail.statusCode || detail.statusInfo?.id,
        statusInfo: detail.statusInfo,
        effectiveDate: detail.effectiveDate || "",
        validUntil: detail.validUntil || "",
        reviewDate: detail.reviewDate || "",
        author: detail.author || "",
        department: detail.department || "",
        created: detail.created || "",
        createdDate: detail.createdDate || "",
        openedBy: detail.openedBy || "",
        description: detail.description || "",
        owner: detail.owner || "",
        reviewers: reviewerList,
        approvers: approverList,
        lastModifiedDate: detail.lastModifiedDate || "",
        lastModifiedBy: detail.lastModifiedBy || "",
        isTemplate: detail.isTemplate,
        titleLocalLanguage: detail.titleLocalLanguage || "",
        businessUnit: detail.businessUnit || "",
        knowledgeBase: detail.knowledgeBase || "",
        subType: detail.subType || "",
        periodicReviewCycle: detail.periodicReviewCycle ?? 0,
        periodicReviewNotification: detail.periodicReviewNotification ?? 0,
        language: detail.language || "English",
        requiresTraining: detail.requiresTraining ?? false,
        trainingPeriodDays: detail.trainingPeriodDays ?? null,
        reasonForSkippingTraining: detail.reasonForSkippingTraining || "",
        coAuthorNames: coAuthorList
          .map((coAuthor) => coAuthor.fullName || coAuthor.username || "")
          .filter(Boolean),
        coAuthors: coAuthorList,
        signatures: detail.signatures || [],
        hasRelatedDocuments: detail.hasRelatedDocuments || false,
        hasCorrelatedDocuments: detail.hasCorrelatedDocuments || false,
        revisions: revisionList,
        relatedDocuments: relatedDocumentList,
        correlatedDocuments: correlatedDocumentList,
        canRequestControlledCopy: Boolean(detail.canRequestControlledCopy),
        canUploadRevision: Boolean(detail.canUploadRevision),
        nextDraftRevisionNumber: detail.nextDraftRevisionNumber || "",
        authorId: detail.authorId || "",
      };

      setDocument(normalizedDocument);
      initialReviewDateRef.current = normalizedDocument.reviewDate || "";
      // Must seed from the real saved value, not force-blank -- otherwise the field shows empty
      // even when the Document already has a Review Date, and only "magically" shows the real
      // value the moment any OTHER field is edited (onDocumentChange resyncs it as a side effect).
      setReviewDateDraft(normalizedDocument.reviewDate || "");
      initialTrainingDraftRef.current = {
        isRequired: Boolean(normalizedDocument.requiresTraining),
        trainingPeriodDays: normalizedDocument.trainingPeriodDays ?? null,
        reasonForSkippingTraining: normalizedDocument.reasonForSkippingTraining ?? "",
      };
      setTrainingDraft(initialTrainingDraftRef.current);
      initialAuthorIdRef.current = normalizedDocument.authorId || "";
      initialAuthorNameRef.current = normalizedDocument.author || "";
      setAuthorNameDraft(normalizedDocument.author || "");
      initialCoAuthorIdsRef.current = coAuthorList.map((coAuthor) => coAuthor.id);
      initialCoAuthorNamesRef.current = coAuthorList.map(
        (coAuthor) => coAuthor.fullName || coAuthor.username || coAuthor.id,
      );
      initialPeriodicReviewCycleRef.current = normalizedDocument.periodicReviewCycle ?? null;
      initialPeriodicReviewNotificationRef.current = normalizedDocument.periodicReviewNotification ?? null;
      initialDescriptionRef.current = normalizedDocument.description || "";
      setReviewers(
        reviewerList.map((reviewer, index) => ({
          id: reviewer.id,
          fullName: reviewer.fullName || "",
          username: reviewer.username || "",
          position: reviewer.position || "",
          email: reviewer.email || "",
          department: reviewer.department || "",
          order: reviewer.sequenceOrder ?? index + 1,
          actionStatus: reviewer.actionStatus ?? null,
          actedAt: reviewer.actedAt ?? null,
          actionComment: reviewer.actionComment ?? null,
        })),
      );
      setApprovers(
        approverList.map((approver) => ({
          id: approver.id,
          fullName: approver.fullName || "",
          username: approver.username || "",
          position: approver.position || "",
          email: approver.email || "",
          department: approver.department || "",
          actionStatus: approver.actionStatus ?? null,
          actedAt: approver.actedAt ?? null,
          actionComment: approver.actionComment ?? null,
        })),
      );
      setCoAuthors(coAuthorList.map((coAuthor) => coAuthor.id));
      setCoAuthorItems(coAuthorList);
      setCoAuthorNames(
        coAuthorList
          .map((coAuthor) => coAuthor.fullName || coAuthor.username || "")
          .filter(Boolean),
      );
      setRelatedDocuments(
        relatedDocumentList.map((doc) => ({
          id: doc.id,
          documentNumber: doc.documentNumber,
          created: doc.created,
          openedBy: doc.openedBy,
          documentName: doc.documentName,
          status: doc.status as any,
          type: doc.type as any,
          revisionNumber: doc.revisionNumber,
          department: doc.department,
          authorCoAuthor: doc.author || "",
          effectiveDate: doc.effectiveDate,
          validUntil: doc.validUntil,
          reviewDate: doc.reviewDate,
        })),
      );
      setCorrelatedDocuments(
        correlatedDocumentList.map((doc) => ({
          id: doc.id,
          documentNumber: doc.documentNumber,
          created: doc.created,
          openedBy: doc.openedBy,
          documentName: doc.documentName,
          status: doc.status as any,
          type: doc.type as any,
          revisionNumber: doc.revisionNumber,
          department: doc.department,
          authorCoAuthor: doc.author || "",
          effectiveDate: doc.effectiveDate,
          validUntil: doc.validUntil,
          reviewDate: doc.reviewDate,
        })),
      );
      setRevisions(
        revisionList.map((revision) => {
          const mapped = mapRevisionSummaryFromApi(revision);
          return {
            id: mapped.id,
            revisionNumber: mapped.revisionNumber,
            created: mapped.created,
            openedBy: mapped.openedBy,
            revisionName: mapped.revisionName,
            status: mapped.status as any,
            statusLabel: mapped.statusLabel,
            canOpenAuthoringWorkspace: Boolean(
              revision.canOpenAuthoringWorkspace,
            ),
          };
        }),
      );
      setAuditTrail((auditTrailResponse ?? []) as unknown as AuditEntry[]);
    },
    [state?.preloadedDocumentDetail],
  );

  useEffect(() => {
    setLocalStatus(undefined);
    setDocumentMasterCapabilities(null);
  }, [documentId]);

  useEffect(() => {
    let isMounted = true;
    setIsDetailLoading(true);
    const preloadedDetail =
      state?.preloadedDocumentDetail?.id === documentId
        ? state.preloadedDocumentDetail
        : undefined;
    const isSnapshotPreload = isDocumentDetailSnapshotPreload(
      state,
      documentId,
    );

    const ensureDocumentSignatures = (detail: DocumentDetailResponse) => {
      const hasDocumentSignatures =
        Array.isArray(detail.signatures) && detail.signatures.length > 0;
      if (!hasDocumentSignatures) {
        void documentApi
          .getDocumentSignatures(documentId)
          .then((signatures) => {
            if (!isMounted) {
              return;
            }
            setDocument((prev) => ({
              ...prev,
              signatures: Array.isArray(signatures) ? signatures : [],
            }));
          })
          .catch(() => {
            if (!isMounted) {
              return;
            }
            setDocument((prev) => ({
              ...prev,
              signatures: [],
            }));
          });
      }
    };

    const loadAuditTrail = () => {
      if (state?.preloadedDocumentAuditTrail) {
        setAuditTrail(
          (state.preloadedDocumentAuditTrail ?? []) as unknown as AuditEntry[],
        );
        return;
      }
      void documentApi
        .getDocumentAuditTrail(documentId)
        .then((auditTrailResponse) => {
          if (!isMounted) {
            return;
          }
          setAuditTrail((auditTrailResponse ?? []) as unknown as AuditEntry[]);
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }
          setAuditTrail([]);
        });
    };

    const load = async () => {
      try {
        const initialDetail =
          preloadedDetail ?? (await documentApi.getDocumentDetail(documentId));
        if (!isMounted) {
          return;
        }

        applyDocumentDetail(initialDetail, state?.preloadedDocumentAuditTrail);
        void securityApi
          .getResourceCapabilities("DOCUMENT_MASTER", documentId)
          .then((capabilities) => {
            if (isMounted) {
              setDocumentMasterCapabilities(capabilities);
            }
          })
          .catch(() => {
            // The server remains authoritative. Do not restore client-side permission
            // inference when the capability request is unavailable.
            if (isMounted) {
              setDocumentMasterCapabilities(null);
            }
          });
        ensureDocumentSignatures(initialDetail);
        loadAuditTrail();
        setIsDetailLoading(false);

        void refreshDetailAfterSnapshot({
          enabled: isSnapshotPreload,
          fetchLive: () => documentApi.getDocumentDetailSnapshot(documentId),
          onSuccess: (freshDetail) => {
            if (!isMounted) {
              return;
            }
            applyDocumentDetail(
              freshDetail,
              state?.preloadedDocumentAuditTrail,
            );
            ensureDocumentSignatures(freshDetail);
          },
        });
      } catch {
        if (!isMounted) {
          return;
        }
        setDocument({
          ...createEmptyDocumentDetail(),
          coAuthorNames: [],
          coAuthors: [],
        });
        setRevisions([]);
        setReviewers([]);
        setApprovers([]);
        setCoAuthors([]);
        setCoAuthorItems([]);
        setCoAuthorNames([]);
        setRelatedDocuments([]);
        setCorrelatedDocuments([]);
        setAuditTrail([]);
        setIsDetailLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [
    applyDocumentDetail,
    documentId,
    state?.preloadedDocumentAuditTrail,
    state?.preloadedDocumentDetail,
    state?.preloadedDocumentDetailSnapshot,
  ]);

  // "Edit Revision for Upgrade" (and the fields/actions gated with it) must disappear the moment
  // the Author's in-progress Draft revision gets uploaded to Office Online -- even if a DCO already
  // has this page open and never reloads it. Poll as the reliable fallback, realtime for the snappy
  // case; same dual pattern RevisionCreateView already uses for workflow-state updates.
  useEffect(() => {
    if (!documentId) return;
    let isMounted = true;
    const refreshCapabilities = () => {
      void securityApi
        .getResourceCapabilities("DOCUMENT_MASTER", documentId)
        .then((capabilities) => {
          if (isMounted) setDocumentMasterCapabilities(capabilities);
        })
        .catch(() => {
          // Best-effort background refresh; keep whatever capabilities are already loaded.
        });
    };
    const interval = window.setInterval(refreshCapabilities, 10_000);
    const revisionIds = new Set(revisions.map((revision) => revision.id));
    const unsubscribeRealtime = subscribeNotificationRealtime((event) => {
      if (event.type !== "revision-workflow-updated") return;
      try {
        const payload = JSON.parse(event.data) as { revisionId?: string };
        if (payload.revisionId && revisionIds.has(payload.revisionId)) {
          refreshCapabilities();
        }
      } catch {
        // Ignore malformed events; the polling fallback remains active.
      }
    });
    return () => {
      isMounted = false;
      window.clearInterval(interval);
      unsubscribeRealtime();
    };
  }, [documentId, revisions]);

  const [activeTab, setActiveTab] = useState<TabType>(initialActiveTab);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isDocumentFileLoading, setIsDocumentFileLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (activeTab !== "document" || !documentId) {
      return;
    }

    let isMounted = true;
    setIsDocumentFileLoading(true);
    setDocumentFile(null);
    setDocumentPreviewError(null);

    const cacheBuster = buildPreviewVersionCacheBuster(
      document.previewVersionToken
        ? `${document.previewVersionToken}::${Date.now()}`
        : String(Date.now()),
    );

    loadPdfPreviewFile(
      () => documentApi.previewDocument(documentId, cacheBuster),
      buildDocumentPreviewFileName(document.documentName),
    )
      .then((file) => {
        if (!isMounted) return;
        setDocumentFile(file);
      })
      .catch((error) => {
        console.error("Failed to load document preview", error);
        if (isMounted) {
          setDocumentFile(null);
          setDocumentPreviewError(
            (error as any)?.response?.data?.message ||
              "The published PDF could not be loaded from the server.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsDocumentFileLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, documentId, document.previewVersionToken]);

  useEffect(() => {
    setActiveTab(searchParams.get("tab") === "audit" ? "audit" : initialTab);
  }, [searchParams, initialTab]);

  const handleBack = () => {
    setIsBackLoading(true);
    onBack();
    setIsBackLoading(false);
  };

  const handleControlledCopyRowClick = (copy: any) => {
    if (!copy?.id) {
      return;
    }

    navigateTo(
      ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(copy.id),
      {
        state: {
          from: location.pathname + location.search,
          ...buildControlledCopySnapshotState(copy),
        },
      },
      0,
    );
  };

  const handleRequestControlledCopy = () => {
    if (!canRequestControlledCopy) {
      showToast({
        type: "error",
        title: "Controlled copy request unavailable",
        message:
          "Request Controlled Copy is available only when the document is Active and the latest revision is Effective.",
        duration: 3000,
      });
      return;
    }

    navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.REQUEST, {
      state: buildControlledCopyRequestRouteStateFromRevision(
        {
          ...buildControlledCopyRequestStateFromDocumentDetail(
            document,
            latestEffectiveRevision,
          ),
        },
        {
          from: location.pathname + location.search,
          returnTo: location.pathname + location.search,
          workspaceReturnPath: location.pathname + location.search,
          preloadedRevisionDetail: latestEffectiveRevision,
        },
      ),
    });
  };

  const latestEffectiveRevision = useMemo(
    () => findLatestEffectiveRevision(revisions),
    [revisions],
  );

  const publishableRevision = useMemo(
    () =>
      revisions.find(
        (rev) =>
          String(rev.status || "")
            .toLowerCase()
            .replace(/ /g, "") === "readyforpublishing",
      ),
    [revisions],
  );

  // The capability endpoint is authoritative: it evaluates permissions, document state,
  // revision state, assignment and lifecycle policy on the server. This view only renders it.
  const canUploadRevision = Boolean(documentMasterCapabilities?.actions.uploadRevision?.allowed);
  const canRequestControlledCopy = Boolean(
    documentMasterCapabilities?.actions.requestControlledCopy?.allowed,
  );
  const canConfigureNextRevisionReviewers = Boolean(
    documentMasterCapabilities?.actions.configureNextReviewers?.allowed,
  );
  const canConfigureNextRevisionApprovers = Boolean(
    documentMasterCapabilities?.actions.configureNextApprovers?.allowed,
  );
  const canConfigureNextRevisionRelatedDocuments = Boolean(
    documentMasterCapabilities?.actions.configureNextRelatedDocuments?.allowed,
  );
  const canConfigureNextRevisionCorrelatedDocuments = Boolean(
    documentMasterCapabilities?.actions.configureNextCorrelatedDocuments?.allowed,
  );
  const canManageReviewCycle = Boolean(
    documentMasterCapabilities?.actions.manageReviewCycle?.allowed,
  );
  const canConfigureNextRevision =
    canConfigureNextRevisionReviewers ||
    canConfigureNextRevisionApprovers ||
    canConfigureNextRevisionRelatedDocuments ||
    canConfigureNextRevisionCorrelatedDocuments ||
    canManageReviewCycle;
  const canObsoleteCurrentDocument = Boolean(documentMasterCapabilities?.actions.obsolete?.allowed);

  // "Now" = permission granted AND the DCO explicitly unlocked edit mode via "Edit Revision for
  // Upgrade". Having the underlying permission alone must never make a field live -- that was the
  // accidental-click risk this gate exists to close.
  const canConfigureNextRevisionReviewersNow = isEditModeActive && canConfigureNextRevisionReviewers;
  const canConfigureNextRevisionApproversNow = isEditModeActive && canConfigureNextRevisionApprovers;
  const canConfigureNextRevisionRelatedDocumentsNow = isEditModeActive && canConfigureNextRevisionRelatedDocuments;
  const canConfigureNextRevisionCorrelatedDocumentsNow = isEditModeActive && canConfigureNextRevisionCorrelatedDocuments;
  const canManageReviewCycleNow = isEditModeActive && canManageReviewCycle;
  const canConfigureNextRevisionNow = isEditModeActive && canConfigureNextRevision;

  const [isRevisionUploadLoading, setIsRevisionUploadLoading] = useState(false);
  const [isUploadRevisionModalOpen, setIsUploadRevisionModalOpen] = useState(false);

  const handleUploadRevision = () => {
    if (!canUploadRevision || isRevisionUploadLoading) return;
    // Upload Revision snapshots straight from the last-SAVED Document state (server-side), never
    // from this page's local draft state -- so any edit-mode change the DCO hasn't clicked Save on
    // yet would otherwise be silently discarded the moment this navigates away to the new revision.
    if (isEditModeActive && !isGeneralConfigurationUnchanged()) {
      setShowUploadRevisionUnsavedWarning(true);
      return;
    }
    setIsUploadRevisionModalOpen(true);
  };

  const isGeneralConfigurationUnchanged = () => {
    const trainingUnchanged =
      Boolean(trainingDraft.isRequired) === Boolean(initialTrainingDraftRef.current.isRequired) &&
      (trainingDraft.trainingPeriodDays ?? null) === (initialTrainingDraftRef.current.trainingPeriodDays ?? null) &&
      (trainingDraft.reasonForSkippingTraining || "") === (initialTrainingDraftRef.current.reasonForSkippingTraining || "");
    const currentCoAuthorIds = (document.coAuthors || []).map((coAuthor) => coAuthor.id);
    const authorUnchanged = (document.authorId || "") === (initialAuthorIdRef.current || "");
    const coAuthorsUnchanged =
      currentCoAuthorIds.length === initialCoAuthorIdsRef.current.length &&
      currentCoAuthorIds.every((id, index) => id === initialCoAuthorIdsRef.current[index]);
    const periodicReviewCycleUnchanged =
      (document.periodicReviewCycle ?? null) === (initialPeriodicReviewCycleRef.current ?? null);
    const periodicReviewNotificationUnchanged =
      (document.periodicReviewNotification ?? null) === (initialPeriodicReviewNotificationRef.current ?? null);
    const descriptionUnchanged = (document.description || "") === (initialDescriptionRef.current || "");
    return (
      sameOrderedIds(reviewers, document.reviewers || []) &&
      sameOrderedIds(approvers, document.approvers || []) &&
      sameOrderedIds(relatedDocuments, document.relatedDocuments || []) &&
      sameOrderedIds(correlatedDocuments, document.correlatedDocuments || []) &&
      (!reviewDateDraft || initialReviewDateRef.current === reviewDateDraft) &&
      trainingUnchanged &&
      authorUnchanged &&
      coAuthorsUnchanged &&
      periodicReviewCycleUnchanged &&
      periodicReviewNotificationUnchanged &&
      descriptionUnchanged
    );
  };

  const isRemovingSelfAsAuthor = () => {
    if (!currentUser?.id) return false;
    const wasSelfAuthor = initialAuthorIdRef.current === currentUser.id;
    const stillSelfAuthor = (document.authorId || "") === currentUser.id;
    return wasSelfAuthor && !stillSelfAuthor;
  };

  const handleAuthorChange = (authorId: string) => {
    setDocument((current) => ({ ...current, authorId }));
    if (!authorId) {
      setAuthorNameDraft("");
      return;
    }
    void settingsApi
      .getUserById(authorId)
      .then((user: any) => setAuthorNameDraft(user?.fullName || user?.username || authorId))
      .catch(() => setAuthorNameDraft(authorId));
  };

  const handleCoAuthorsChange = (coAuthorIds: string[]) => {
    setDocument((current) => ({
      ...current,
      coAuthors: coAuthorIds.map((id) => {
        const existing = current.coAuthors.find((item) => item.id === id);
        return (
          existing || {
            id,
            fullName: id,
            username: "",
            position: "",
            email: "",
            department: "",
          }
        );
      }),
      coAuthorNames: coAuthorIds.map((id) => {
        const existing = current.coAuthors.find((item) => item.id === id);
        return existing?.fullName || existing?.username || id;
      }),
    }));
    // Resolve display names for any newly-selected co-author not already known locally,
    // so the change-confirmation modal shows a real name instead of a raw user id.
    const unresolvedIds = coAuthorIds.filter(
      (id) => !(document.coAuthors || []).some((item) => item.id === id),
    );
    unresolvedIds.forEach((id) => {
      void settingsApi
        .getUserById(id)
        .then((user: any) => {
          const fullName = user?.fullName || user?.username || id;
          setDocument((current) => ({
            ...current,
            coAuthors: current.coAuthors.map((item) =>
              item.id === id ? { ...item, fullName } : item,
            ),
            coAuthorNames: current.coAuthors.map((item) =>
              item.id === id ? fullName : item.fullName || item.username || item.id,
            ),
          }));
        })
        .catch(() => null);
    });
  };

  const buildWorkflowConfigChangeSummary = (): { label: string; before: string; after: string }[] => {
    const rows: { label: string; before: string; after: string }[] = [];
    const push = (label: string, before: string, after: string) => {
      if (before !== after) rows.push({ label, before: before || "—", after: after || "—" });
    };
    const namesOf = (items: Array<{ fullName?: string | null; documentNumber?: string | null; displayLabel?: string | null; id?: string | null }>) =>
      items.map((item) => item.fullName || item.displayLabel || item.documentNumber || item.id || "").join(", ");
    // Related/Correlated document items carry displayLabel only when freshly loaded from the
    // server -- an untouched item still sitting in local editable state may only have
    // documentNumber populated. Comparing/displaying by documentNumber on BOTH sides (never
    // falling back to displayLabel) avoids a false "changed" diff for a document the user never
    // touched, purely because of which of the two sources happened to carry the full label.
    const documentNumbersOf = (items: Array<{ documentNumber?: string | null; id?: string | null }>) =>
      items.map((item) => item.documentNumber || item.id || "").join(", ");

    push("Reviewers", namesOf(document.reviewers || []), namesOf(reviewers));
    push("Approvers", namesOf(document.approvers || []), namesOf(approvers));
    push("Related Documents", documentNumbersOf(document.relatedDocuments || []), documentNumbersOf(relatedDocuments));
    push("Correlated Documents", documentNumbersOf(document.correlatedDocuments || []), documentNumbersOf(correlatedDocuments));
    push("Review Date", initialReviewDateRef.current, reviewDateDraft || initialReviewDateRef.current);
    push(
      "Requires Training",
      initialTrainingDraftRef.current.isRequired ? "Yes" : "No",
      trainingDraft.isRequired ? "Yes" : "No",
    );
    push(
      "Training Period (Days)",
      String(initialTrainingDraftRef.current.trainingPeriodDays ?? ""),
      String((trainingDraft.isRequired ? trainingDraft.trainingPeriodDays : null) ?? ""),
    );
    push(
      "Reason for Skipping Training",
      initialTrainingDraftRef.current.reasonForSkippingTraining || "",
      (trainingDraft.isRequired ? "" : trainingDraft.reasonForSkippingTraining) || "",
    );
    push("Author", initialAuthorNameRef.current, authorNameDraft);
    push("Co-Author(s)", initialCoAuthorNamesRef.current.join(", "), namesOf(document.coAuthors || []));
    push(
      "Periodic Review Cycle (Months)",
      String(initialPeriodicReviewCycleRef.current ?? ""),
      String(document.periodicReviewCycle ?? ""),
    );
    push(
      "Periodic Review Notification (Days)",
      String(initialPeriodicReviewNotificationRef.current ?? ""),
      String(document.periodicReviewNotification ?? ""),
    );
    push("Description", initialDescriptionRef.current, document.description || "");

    return rows;
  };

  const handleSaveWorkflowConfiguration = () => {
    if (!canConfigureNextRevisionNow || !document.id) return;
    if (
      canManageReviewCycleNow &&
      (document.periodicReviewCycle === null ||
        document.periodicReviewCycle === undefined ||
        document.periodicReviewNotification === null ||
        document.periodicReviewNotification === undefined)
    ) {
      // The backend treats an omitted/null value as "field not touched, keep the old one" -- so
      // without this check, clearing the field and forgetting to re-enter a value would silently
      // revert to the previous saved number with no error, contradicting the required (*) marker
      // shown on both fields.
      showToast({
        type: "error",
        title: "Missing required field",
        message:
          "Periodic Review Cycle (Months) and Periodic Review Notification (Days) cannot be empty.",
        duration: 3500,
      });
      return;
    }
    if (isGeneralConfigurationUnchanged()) {
      showToast({
        type: "info",
        title: "No changes to save",
        message: "The existing next-revision configuration remains unchanged.",
        duration: 2500,
      });
      return;
    }
    setShowSaveConfirmModal(true);
  };

  const handleConfirmSaveWorkflowConfiguration = async () => {
    setShowSaveConfirmModal(false);
    if (isRemovingSelfAsAuthor()) {
      setShowAuthorHandoffWarning(true);
      return;
    }
    await persistWorkflowConfiguration();
  };

  const persistWorkflowConfiguration = async () => {
    setShowAuthorHandoffWarning(false);
    setIsSavingWorkflowConfiguration(true);
    try {
      const updated = await documentApi.updateActiveWorkflowConfiguration(
        document.id,
        {
          reviewerUserIds: reviewers.map((reviewer) => reviewer.id),
          approverUserIds: approvers.map((approver) => approver.id),
          relatedDocumentIds: relatedDocuments.map((related) => related.id),
          correlatedDocumentIds: correlatedDocuments.map(
            (correlated) => correlated.id,
          ),
          reviewDate: reviewDateDraft || null,
          requiresTraining: trainingDraft.isRequired,
          trainingPeriodDays: trainingDraft.isRequired
            ? trainingDraft.trainingPeriodDays
            : null,
          reasonForSkippingTraining: trainingDraft.isRequired
            ? null
            : trainingDraft.reasonForSkippingTraining || null,
          authorUserId: document.authorId || undefined,
          coAuthorUserIds: (document.coAuthors || []).map((coAuthor) => coAuthor.id),
          periodicReviewCycle: document.periodicReviewCycle ?? null,
          periodicReviewNotification: document.periodicReviewNotification ?? null,
          description: document.description ?? null,
        },
      );
      applyDocumentDetail(updated);
      setIsEditModeActive(false);
      showToast({
        type: "success",
        title: "Next revision configuration saved",
        message: "Your changes have been saved.",
        duration: 3000,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to save configuration",
        message: (error as any)?.response?.data?.message || "Please try again.",
        duration: 4000,
      });
    } finally {
      setIsSavingWorkflowConfiguration(false);
    }
  };

  const handleUploadRevisionConfirm = async (
    file: File | null,
    note: string,
    useTemplate: boolean,
    templateRevisionId?: string,
  ) => {
    if (!canUploadRevision) return;
    if (!file && !(useTemplate && templateRevisionId)) return;

    setIsRevisionUploadLoading(true);
    try {
      const createdRevision = await documentApi.createRevisionWithUpload(
        document.id,
        file,
        {
          changeDescription:
            note?.trim() || "New revision source uploaded from Document Master.",
          templateRevisionId: useTemplate ? templateRevisionId : undefined,
        },
      );
      setIsUploadRevisionModalOpen(false);
      if (createdRevision?.id) {
        navigateTo(ROUTES.DOCUMENTS.REVISIONS.EDIT(createdRevision.id), {
          state: {
            from: location.pathname + location.search,
            revisionId: createdRevision.id,
            editMode: true,
          },
        });
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to upload revision",
        message:
          (error as any)?.response?.data?.message ||
          "Failed to create the Draft revision from the selected file.",
        duration: 3500,
      });
    } finally {
      setIsRevisionUploadLoading(false);
    }
  };

  const handleObsoleteDocument = () => {
    if (!canObsoleteCurrentDocument) {
      showToast({
        type: "error",
        title: "Obsolete unavailable",
        message:
          "Obsolete is only available when the document is Active, has a current Effective Revision, and has no revision in progress.",
        duration: 3000,
      });
      return;
    }

    setShowObsoleteModal(true);
  };

  const handleObsoleteConfirm = async (signature: {
    username: string;
    password: string;
    reason: string;
    signatureToken?: string;
  }) => {
    if (!document.id) return;

    setIsObsoleteSubmitting(true);
    try {
      const response = await documentApi.obsoleteDocument(document.id, {
        reason: signature.reason,
        obsoleteDate: new Date().toISOString(),
        signatureToken: signature.signatureToken as string,
      });
      const refreshed = await documentApi.getDocumentDetailSnapshot(
        response.id || document.id,
      );
      const refreshedAuditTrail = await documentApi
        .getDocumentAuditTrail(document.id)
        .catch(() => []);
      applyDocumentDetail(
        refreshed,
        refreshedAuditTrail as unknown as AuditEntry[],
      );
      setLocalStatus("Obsoleted");
      setShowObsoleteModal(false);
      showToast({
        type: "success",
        title: "Document obsoleted",
        message: "The document has been marked as obsoleted.",
        duration: 3000,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to obsolete document",
        message:
          (error as any)?.response?.data?.error?.message ||
          "The document could not be marked as obsoleted.",
        duration: 3000,
      });
    } finally {
      setIsObsoleteSubmitting(false);
    }
  };

  const handlePublish = () => {
    setShowESignModal(true);
  };

  const handleESignConfirm = async (signature: {
    username: string;
    password: string;
    reason: string;
    signatureToken?: string;
  }) => {
    setIsSubmitting(true);

    try {
      const publishableRevision =
        revisions.find(
          (revision) =>
            String(revision.status).toLowerCase() === "readyforpublishing",
        ) || revisions[0];

      if (!publishableRevision?.id) {
        throw new Error("No revision available for publishing");
      }

      await executePublish(publishableRevision.id, {
        reason: signature.reason,
        comment: signature.reason,
        signatureToken: signature.signatureToken as string,
      });
    } catch (error) {
      setIsSubmitting(false);
      console.error("Failed to publish revision", error);
      showToast({
        type: "error",
        title: "Publish failed",
        message:
          (error as any)?.response?.data?.message ||
          "Failed to publish revision.",
      });
    }
  };

  const executePublish = async (
    revisionId: string,
    params: {
      reason: string;
      comment: string;
      signatureToken: string;
      forcePublish?: boolean;
    },
  ) => {
    try {
      setIsNavigating(true);
      await documentApi.publishRevision(revisionId, params);

      const [detail, auditTrailResponse] = await Promise.all([
        documentApi.getDocumentDetailSnapshot(documentId),
        documentApi.getDocumentAuditTrail(documentId).catch(() => []),
      ]);
      applyDocumentDetail(
        detail,
        auditTrailResponse as unknown as AuditEntry[],
      );
      setLocalStatus((detail.status || "Active") as DocumentStatus);
      setShowESignModal(false);
      setIsSubmitting(false);
      setIsNavigating(false);

      // Reload the Document tab PDF so it shows the published version with updated placeholders.
      setIsDocumentFileLoading(true);
      setDocumentFile(null);
      setDocumentPreviewError(null);
      const cacheBuster = buildPreviewVersionCacheBuster(
        detail.previewVersionToken,
      );
      loadPdfPreviewFile(
        () => documentApi.previewDocument(documentId, cacheBuster),
        buildDocumentPreviewFileName(detail.documentName),
      )
        .then((file) => {
          setDocumentFile(file);
        })
        .catch(() => {
          setDocumentFile(null);
          setDocumentPreviewError(
            "The published PDF could not be loaded from the server.",
          );
        })
        .finally(() => {
          setIsDocumentFileLoading(false);
        });

      showToast({
        type: "success",
        title: "Document Published",
        message: `Revision ${detail.documentNumber} ${detail.revisionNumber} has been published and is now Effective.`,
        duration: 3000,
      });
    } catch (error) {
      setIsSubmitting(false);
      const responseData = (error as any)?.response?.data;
      if (responseData?.error?.code === "RELATED_DOCUMENTS_NOT_EFFECTIVE") {
        setIsNavigating(false);
        setWarningMessage(responseData.error.message);
        setNonEffectiveDocs(responseData.error.details || []);
        setPendingPublishParams({
          revisionId,
          reason: params.reason,
          comment: params.comment,
          signatureToken: params.signatureToken,
        });
        setShowWarningModal(true);
      } else {
        console.error("Failed to publish document revision", error);
        showToast({
          type: "error",
          title: "Publish failed",
          message:
            responseData?.error?.message ||
            responseData?.message ||
            "Failed to publish revision.",
          duration: 3500,
        });
        setIsNavigating(false);
      }
    }
  };

  const handleWarningConfirm = async () => {
    if (!pendingPublishParams) return;
    setShowWarningModal(false);
    const params = pendingPublishParams;
    setPendingPublishParams(null);
    setIsSubmitting(true);
    await executePublish(params.revisionId, {
      reason: params.reason,
      comment: params.comment,
      signatureToken: params.signatureToken,
      forcePublish: true,
    });
  };

  // Sub-tab state (for active documents)
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("revisions");

  // Document status workflow steps
  const statusSteps = DOCUMENT_WORKFLOW_STEPS;

  const normalizedStatus = normalizeDocumentStatusForStepper(
    document.status,
    document.statusInfo,
  ) as DocumentStatus;

  const currentStepIndex = documentWorkflowStepIndex(
    document.status,
    document.statusInfo,
  );
  const skippedSteps = document.requiresTraining
    ? []
    : (["Pending Training"] as const);
  const terminalProgressStep = useMemo(
    () =>
      resolveTerminalProgressStep(
        localStatus ?? document.status,
        auditTrail as unknown as any[],
      ),
    [auditTrail, document.status, localStatus],
  );

  const handleShare = () => {
    const shareUrl = `${window.location.origin}${ROUTES.DOCUMENTS.DETAIL(documentId)}`;
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        showToast({
          type: "success",
          title: "Link copied",
          message: "Document detail link has been copied to the clipboard.",
          duration: 2500,
        });
      })
      .catch(() => {
        showToast({
          type: "error",
          title: "Copy failed",
          message: "Unable to copy the document link.",
          duration: 2500,
        });
      });
  };

  const handleViewHistory = () => {
    setActiveTab("audit");
  };

  const tabs = [
    { id: "general" as TabType, label: "General Information" },
    { id: "training" as TabType, label: "Training Information" },
    { id: "document" as TabType, label: "Document" },
    { id: "signatures" as TabType, label: "Signatures" },
    { id: "audit" as TabType, label: "Audit Trail" },
  ];

  const detailFormData = {
    documentName: document.documentName,
    type: document.type as DocumentType,
    author: document.author,
    coAuthors,
    coAuthorItems,
    coAuthorNames,
    businessUnit: document.businessUnit,
    department: document.department,
    knowledgeBase: document.knowledgeBase,
    subType: document.subType,
    periodicReviewCycle: document.periodicReviewCycle,
    periodicReviewNotification: document.periodicReviewNotification,
    language: document.language,
    reviewDate: document.reviewDate || "",
    description: document.description,
    isTemplate: document.isTemplate,
    titleLocalLanguage: document.titleLocalLanguage,
  };

  const signatureRecords = useMemo<SignatureRecord[]>(() => {
    const signatures = document.signatures || [];
    if (signatures.length > 0) {
      return signatures;
    }
    const normalizeLabel = (value?: string | null) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const getSignatureMatches = (labels: string[]) =>
      signatures.filter((record) => {
        const actionBy = normalizeLabel(record.actionBy);
        return labels.some((label) => {
          const normalized = normalizeLabel(label);
          return (
            actionBy === normalized || actionBy.startsWith(`${normalized} `)
          );
        });
      });
    const getSignatureMatch = (labels: string[]) =>
      getSignatureMatches(labels)[0];
    const findEntry = (...actionTypes: string[]) =>
      auditTrail.find((entry) =>
        actionTypes.includes(String(entry.actionType || "").toUpperCase()),
      );
    const formatTimestamp = (value?: string | null) => value || "";
    const hasMeaningful = (record: any) => {
      if (!record) return false;
      const byName = normalizeLabel(record.actionByName);
      const onValue = normalizeLabel(record.actionOnValue);
      return (
        (byName && byName !== "-" && byName !== "—") ||
        (onValue && onValue !== "-" && onValue !== "—")
      );
    };

    const buildDynamicRows = (
      baseLabelBy: string,
      labelOn: string,
      matches: any[],
    ) =>
      matches.map((record, index) => ({
        actionBy:
          matches.length > 1 ? `${baseLabelBy} ${index + 1}` : baseLabelBy,
        actionByName: record?.actionByName || record?.user?.fullName || "-",
        actionOn: labelOn,
        actionOnValue:
          formatTimestamp(record?.actionOnValue || record?.timestamp) || "-",
      }));

    const submittedEntry = (getSignatureMatch(["submitted by", "submitted"]) ??
      findEntry(
        "SUBMIT",
        "SUBMIT_FOR_REVIEW",
        "RESUBMIT_FOR_REVIEW",
        "SUBMITTED",
      )) as any;
    const reviewedEntries = getSignatureMatches([
      "reviewed by",
      "reviewed",
    ]).filter(hasMeaningful);
    const rejectedEntry = (getSignatureMatch(["rejected by", "rejected"]) ??
      findEntry("REVIEW_REJECT", "APPROVE_REJECT")) as any;
    const approvedEntries = getSignatureMatches([
      "approved by",
      "approved",
    ]).filter(hasMeaningful);
    const publishedEntry = (getSignatureMatch(["published by", "published"]) ??
      findEntry("PUBLISH")) as any;
    const obsoletedEntry = (getSignatureMatch(["obsoleted by", "obsoleted"]) ??
      findEntry("OBSOLETE")) as any;
    const cancelledEntry = (getSignatureMatch(["cancelled by", "cancelled"]) ??
      findEntry("CANCEL")) as any;
    const reviewedParticipantRows = reviewers
      .filter((participant) => {
        const status = normalizeLabel(participant.actionStatus);
        return (
          !!participant.actedAt &&
          (status === "reviewed" || status === "approved")
        );
      })
      .map((participant, index, arr) => ({
        actionBy: arr.length > 1 ? `Reviewed By ${index + 1}` : "Reviewed By",
        actionByName: participant.fullName || "-",
        actionOn: "Reviewed On (Date - Time)",
        actionOnValue: formatTimestamp(participant.actedAt) || "-",
      }));
    const approvedParticipantRows = approvers
      .filter((participant) => {
        const status = normalizeLabel(participant.actionStatus);
        return !!participant.actedAt && status === "approved";
      })
      .map((participant, index, arr) => ({
        actionBy: arr.length > 1 ? `Approved By ${index + 1}` : "Approved By",
        actionByName: participant.fullName || "-",
        actionOn: "Approved On (Date - Time)",
        actionOnValue: formatTimestamp(participant.actedAt) || "-",
      }));
    const reviewedRows =
      reviewedEntries.length > 0
        ? buildDynamicRows(
            "Reviewed By",
            "Reviewed On (Date - Time)",
            reviewedEntries.length > 0
              ? reviewedEntries
              : findEntry("REVIEW_COMPLETE")
                ? [findEntry("REVIEW_COMPLETE")]
                : [],
          )
        : reviewedParticipantRows;
    const approvedRows =
      approvedEntries.length > 0
        ? buildDynamicRows(
            "Approved By",
            "Approved On (Date - Time)",
            approvedEntries.length > 0
              ? approvedEntries
              : findEntry("APPROVE_COMPLETE")
                ? [findEntry("APPROVE_COMPLETE")]
                : [],
          )
        : approvedParticipantRows;

    return [
      {
        actionBy: "Submitted By",
        actionByName:
          submittedEntry?.actionByName || submittedEntry?.user?.fullName || "-",
        actionOn: "Submitted On (Date - Time)",
        actionOnValue:
          formatTimestamp(
            submittedEntry?.actionOnValue || submittedEntry?.timestamp,
          ) || "-",
      },
      ...reviewedRows,
      {
        actionBy: "Rejected By",
        actionByName:
          rejectedEntry?.actionByName || rejectedEntry?.user?.fullName || "-",
        actionOn: "Rejected On (Date - Time)",
        actionOnValue:
          formatTimestamp(
            rejectedEntry?.actionOnValue || rejectedEntry?.timestamp,
          ) || "-",
      },
      ...approvedRows,
      {
        actionBy: "Published By",
        actionByName:
          publishedEntry?.actionByName || publishedEntry?.user?.fullName || "-",
        actionOn: "Published On (Date - Time)",
        actionOnValue:
          formatTimestamp(
            publishedEntry?.actionOnValue || publishedEntry?.timestamp,
          ) || "-",
      },
      {
        actionBy: "Obsoleted By",
        actionByName:
          obsoletedEntry?.actionByName || obsoletedEntry?.user?.fullName || "-",
        actionOn: "Obsoleted On (Date - Time)",
        actionOnValue:
          formatTimestamp(
            obsoletedEntry?.actionOnValue || obsoletedEntry?.timestamp,
          ) || "-",
      },
      {
        actionBy: "Cancelled By",
        actionByName:
          cancelledEntry?.actionByName || cancelledEntry?.user?.fullName || "-",
        actionOn: "Cancelled On (Date - Time)",
        actionOnValue:
          formatTimestamp(
            cancelledEntry?.actionOnValue || cancelledEntry?.timestamp,
          ) || "-",
      },
    ];
  }, [auditTrail, approvers, document.signatures, reviewers]);

  const subTabs = [
    { id: "revisions" as SubTabType, label: "Document Revisions" },
    {
      id: "reviewers" as SubTabType,
      label: "Reviewers",
      count: reviewers.length,
    },
    {
      id: "approvers" as SubTabType,
      label: "Approvers",
      count: approvers.length,
    },
    { id: "controlledCopies" as SubTabType, label: "Controlled Copies" },
    {
      id: "relatedDocuments" as SubTabType,
      label: "Related Documents",
      count: relatedDocuments.length,
    },
    {
      id: "correlatedDocuments" as SubTabType,
      label: "Correlated Documents",
      count: correlatedDocuments.length,
    },
  ];

  if (isDetailLoading && !document.id) {
    return <FullPageLoading text="Loading..." />;
  }

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      {(isDetailLoading ||
        isRouteNavigating ||
        isNavigating ||
        isSubmitting ||
        isBackLoading ||
        isObsoleteSubmitting ||
        isRevisionUploadLoading) && <FullPageLoading text="Loading..." />}
      {/* Header: Title + Breadcrumb + Actions */}
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Document Details"
          breadcrumbItems={documentDetail(navigateTo, {
            fromOwned: state?.fromOwned ?? fromOwned,
          })}
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBack}
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
              >
                Back
              </Button>
            </div>
          }
        />
      </div>

      {/* Status Stepper */}
      <WorkflowStepper
        steps={statusSteps}
        currentStepIndex={currentStepIndex}
        skippedSteps={skippedSteps}
        terminalProgressStep={terminalProgressStep}
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
          layoutId="doc-detail-main-tab"
        />

        {/* Tab Content */}
        <div className="p-4 md:p-5">
          {activeTab === "general" && (
            <GeneralInformationTab
              document={document as any}
              isReadOnly={false}
              canEditReviewDate={canConfigureNextRevisionNow && canManageReviewCycleNow}
              canEditMetadata={canConfigureNextRevisionNow && canManageReviewCycleNow}
              reviewDateInputValue={
                canConfigureNextRevisionNow && canManageReviewCycleNow
                  ? reviewDateDraft
                  : undefined
              }
              onDocumentChange={(nextDocument) =>
                {
                  setReviewDateDraft(nextDocument.reviewDate || "");
                  setDocument((current) => ({ ...current, ...(nextDocument as any) }));
                }
              }
              onAuthorChange={handleAuthorChange}
              onCoAuthorsChange={handleCoAuthorsChange}
              authorOptions={
                document.authorId
                  ? [{ label: authorNameDraft || document.author, value: document.authorId }]
                  : []
              }
              coAuthorOptions={(document.coAuthors || []).map((coAuthor) => ({
                label: coAuthor.fullName || coAuthor.username || coAuthor.id,
                value: coAuthor.id,
              }))}
              onSearchWorkflowUsers={searchWorkflowUsers}
            />
          )}
          {activeTab === "training" && (
            <TrainingInformationTab
              data={
                canConfigureNextRevisionNow && canManageReviewCycleNow
                  ? trainingDraft
                  : {
                      isRequired: document.requiresTraining,
                      trainingPeriodDays: document.trainingPeriodDays,
                      reasonForSkippingTraining: document.reasonForSkippingTraining,
                    }
              }
              isReadOnly={!(canConfigureNextRevisionNow && canManageReviewCycleNow)}
              onChange={(next) =>
                setTrainingDraft({
                  isRequired: Boolean(next.isRequired),
                  trainingPeriodDays: next.trainingPeriodDays ?? null,
                  reasonForSkippingTraining: next.reasonForSkippingTraining ?? null,
                })
              }
            />
          )}
          {activeTab === "document" &&
            (isDocumentFileLoading ? (
              <div
                className="w-full border rounded-xl flex items-center justify-center bg-slate-50"
                style={{ height: "calc(100vh - 120px)", minHeight: "720px" }}
              >
                <div className="text-slate-500 flex flex-col items-center gap-2">
                  <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading preview...</span>
                </div>
              </div>
            ) : documentFile ? (
              <DocumentTab documentFile={documentFile} />
            ) : (
              <div
                className="w-full border rounded-xl flex items-center justify-center bg-slate-50"
                style={{ height: "calc(100vh - 120px)", minHeight: "480px" }}
              >
                <div className="text-slate-500 flex flex-col items-center gap-2 text-center px-4">
                  <span className="text-sm font-medium">
                    {documentPreviewError ||
                      "No effective published document available."}
                  </span>
                  <span className="text-xs text-slate-400">
                    {documentPreviewError
                      ? "Refresh the page after access is granted, or contact Document Control if the issue persists."
                      : "The official published PDF will appear here once the document has been published."}
                  </span>
                </div>
              </div>
            ))}
          {activeTab === "signatures" && (
            <SignaturesTab records={signatureRecords} />
          )}
          {activeTab === "audit" && (
            <AuditTrailTab
              documentId={document.id}
              documentNumber={document.documentNumber}
              entityType="Document"
            />
          )}
        </div>
      </div>
      {/* Footer Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          onClick={handleBack}
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
        >
          Back
        </Button>
        {canConfigureNextRevision && !isEditModeActive && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
            onClick={() => setShowEditModeConfirmModal(true)}
          >
            Edit Revision for Upgrade
          </Button>
        )}
        {canConfigureNextRevisionNow &&
          (canConfigureNextRevisionReviewersNow ||
            canConfigureNextRevisionApproversNow ||
            canConfigureNextRevisionRelatedDocumentsNow ||
            canConfigureNextRevisionCorrelatedDocumentsNow ||
            canManageReviewCycleNow) && (
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap"
              disabled={isSavingWorkflowConfiguration}
              onClick={handleSaveWorkflowConfiguration}
            >
              Save
            </Button>
          )}
        {canObsoleteCurrentDocument && (
          <Button
            size="sm"
            variant="default"
            className="whitespace-nowrap gap-2"
            onClick={handleObsoleteDocument}
          >
            Obsolete
          </Button>
        )}
        {canRequestControlledCopy && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            onClick={handleRequestControlledCopy}
          >
            Request Controlled Copy
          </Button>
        )}
        {canUploadRevision && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            onClick={handleUploadRevision}
            disabled={isRevisionUploadLoading}
          >
            Upload Revision
          </Button>
        )}
        {canConfigureNextRevisionNow && (
          <>
            {canConfigureNextRevisionRelatedDocumentsNow && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={() => {
                  setActiveSubTab("relatedDocuments");
                  setIsRelatedDocumentsModalOpen(true);
                }}
              >
                Select Related Documents
              </Button>
            )}
            {canConfigureNextRevisionCorrelatedDocumentsNow && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={() => {
                  setActiveSubTab("correlatedDocuments");
                  setIsCorrelatedDocumentsModalOpen(true);
                }}
              >
                Select Correlated Documents
              </Button>
            )}
            {canConfigureNextRevisionReviewersNow && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={() => {
                  setActiveSubTab("reviewers");
                  setIsReviewerModalOpen(true);
                }}
              >
                Reviewers
              </Button>
            )}
            {canConfigureNextRevisionApproversNow && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                onClick={() => {
                  setActiveSubTab("approvers");
                  setIsApproverModalOpen(true);
                }}
              >
                Approvers
              </Button>
            )}
          </>
        )}
        {publishableRevision?.id && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            onClick={() => {
              navigateTo(
                ROUTES.DOCUMENTS.REVISIONS.PUBLISHING(publishableRevision.id),
                {
                  state: {
                    from: location.pathname + location.search,
                    returnTo: location.pathname + location.search,
                  },
                },
              );
            }}
          >
            Open Publishing Template
          </Button>
        )}
      </div>

      {/* Sub-tabs (separate card, shown on General tab) */}
      {activeTab === "general" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <TabNav
            tabs={subTabs}
            activeTab={activeSubTab}
            onChange={(id) => setActiveSubTab(id as SubTabType)}
            variant="simple-underline"
          />

          <div className="p-4 md:p-5">
            {activeSubTab === "revisions" && (
              <DocumentRevisionsTab
                revisions={revisions}
                documentId={document.id}
                navigationMode={revisionWorkspaceMode}
                workspaceReturnPath={revisionWorkspaceReturnPath}
                workspaceState={state?.workspaceState ?? undefined}
                documentAuthor={document.author}
                documentStatus={document.status}
                documentCreated={document.created}
                documentNumber={document.documentNumber}
                formData={detailFormData}
                reviewers={reviewers}
                approvers={approvers}
                relationshipDocs={relatedDocuments}
                correlatedDocuments={correlatedDocuments}
              />
            )}
            {activeSubTab === "reviewers" && (
              canConfigureNextRevisionReviewersNow ? (
                <EditableReviewersTab
                  reviewers={reviewers}
                  onReviewersChange={setReviewers}
                  isModalOpen={isReviewerModalOpen}
                  onModalClose={() => setIsReviewerModalOpen(false)}
                />
              ) : (
                <ReadOnlyReviewersTable reviewers={reviewers} />
              )
            )}
            {activeSubTab === "approvers" && (
              canConfigureNextRevisionApproversNow ? (
                <EditableApproversTab
                  approvers={approvers}
                  onApproversChange={setApprovers}
                  isModalOpen={isApproverModalOpen}
                  onModalClose={() => setIsApproverModalOpen(false)}
                />
              ) : (
                <ReadOnlyApproversTable approvers={approvers} />
              )
            )}
            {activeSubTab === "controlledCopies" && (
              <ControlledCopiesTab
                documentId={document.id}
                onRowClick={handleControlledCopyRowClick}
              />
            )}
            {activeSubTab === "relatedDocuments" && (
              <RelatedDocumentsTab
                relatedDocuments={relatedDocuments}
                onRelatedDocumentsChange={setRelatedDocuments}
              />
            )}
            {activeSubTab === "correlatedDocuments" && (
              <CorrelatedDocumentsTab
                correlatedDocuments={correlatedDocuments}
                onCorrelatedDocumentsChange={setCorrelatedDocuments}
              />
            )}
          </div>
        </div>
      )}

      {(isRelatedDocumentsModalOpen || isCorrelatedDocumentsModalOpen) && (
        <DocumentRelationships
          currentDocumentId={document.id}
          relatedDocuments={relatedDocuments}
          onRelatedDocumentsChange={setRelatedDocuments}
          correlatedDocuments={correlatedDocuments}
          onCorrelatedDocumentsChange={setCorrelatedDocuments}
          isRelatedModalOpen={isRelatedDocumentsModalOpen}
          onRelatedModalClose={() => setIsRelatedDocumentsModalOpen(false)}
          isCorrelatedModalOpen={isCorrelatedDocumentsModalOpen}
          onCorrelatedModalClose={() =>
            setIsCorrelatedDocumentsModalOpen(false)
          }
        />
      )}

      <FormModal
        isOpen={showSaveConfirmModal}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirm={() => void handleConfirmSaveWorkflowConfiguration()}
        title="Save Next-Revision Configuration?"
        description="Review the changes below before saving. This only affects the next Draft revision — the current Effective revision is not changed."
        confirmText="Save"
        cancelText="Cancel"
        showCancel
        isLoading={isSavingWorkflowConfiguration}
        size="xl"
      >
        {(() => {
          const changes = buildWorkflowConfigChangeSummary();
          if (changes.length === 0) return null;
          return (
            <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden">
              <div className="max-h-72 overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="w-1/4 px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        Field
                      </th>
                      <th className="w-1/3 px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        Before
                      </th>
                      <th className="px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        <span className="flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-emerald-500" />
                          After
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {changes.map((change) => (
                      <tr key={change.label} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-900 md:text-sm">
                          {change.label}
                        </td>
                        <td className="px-4 py-3 text-xs md:text-sm">
                          <span className="text-slate-400 line-through">{change.before}</span>
                        </td>
                        <td className="px-4 py-3 text-xs md:text-sm">
                          <span className="font-medium text-emerald-700">{change.after}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </FormModal>

      <AlertModal
        isOpen={showAuthorHandoffWarning}
        onClose={() => setShowAuthorHandoffWarning(false)}
        onConfirm={() => void persistWorkflowConfiguration()}
        type="warning"
        title="Reassign Author?"
        description="You are currently the Author of this document. After saving, only the newly assigned Author will be able to Upload Revision — you will lose that ability on this document. Continue?"
      />

      <AlertModal
        isOpen={showUploadRevisionUnsavedWarning}
        onClose={() => setShowUploadRevisionUnsavedWarning(false)}
        onConfirm={() => {
          setShowUploadRevisionUnsavedWarning(false);
          setIsUploadRevisionModalOpen(true);
        }}
        type="warning"
        title="Unsaved changes will be discarded"
        description="You have unsaved changes to Author, Co-Author, Reviewers, Approvers, Related/Correlated Documents, Periodic Review Cycle/Notification or Training. Upload Revision uses the last-saved configuration, not these unsaved edits — continuing will discard them. Click Cancel and Save first if you want them applied to the new revision."
        confirmText="Upload Anyway (Discard Unsaved Changes)"
      />

      <AlertModal
        isOpen={showEditModeConfirmModal}
        onClose={() => setShowEditModeConfirmModal(false)}
        onConfirm={() => {
          setIsEditModeActive(true);
          setShowEditModeConfirmModal(false);
        }}
        type="warning"
        title="Edit Revision for Upgrade?"
        description="You are about to configure the next revision (Author, Co-Author, Reviewers, Approvers, Related/Correlated Documents, Periodic Review Cycle/Notification, Training). Nothing is saved until you explicitly click Save. Continue?"
      />

      <UploadRevisionModal
        isOpen={isUploadRevisionModalOpen}
        onClose={() => setIsUploadRevisionModalOpen(false)}
        onConfirm={handleUploadRevisionConfirm}
        documentName={document.documentName}
        revisionNumber={document.nextDraftRevisionNumber || ""}
        documentType={document.type}
        documentSubType={document.subType ?? undefined}
        canUseTemplate={canUseDocumentTemplate}
      />

      <ESignatureModal
        isOpen={showObsoleteModal}
        onClose={() => {
          setShowObsoleteModal(false);
          setIsObsoleteSubmitting(false);
        }}
        onConfirm={handleObsoleteConfirm}
        actionTitle="Obsolete Document"
        targetDetails={{
          code: document.documentNumber,
          title: document.documentName,
          revision: document.revisionNumber,
        }}
        changes={[
          {
            action: "Update Status",
            oldValue: "Active",
            newValue: "Obsoleted",
            category: "status",
          },
        ]}
      />
    </div>
  );
};
