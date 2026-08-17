import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/components/ui/utils";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { TabNav } from "@/components/ui/tabs/TabNav";
import {
  GeneralInformationTab,
  WorkingNotesTab,
  InfoFromDocumentTab,
  TrainingInformationTab,
  ReviewersTab,
  ApproversTab,
  DocumentTab,
  SignaturesTab,
  AuditTrailTab,
} from "./tabs";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { revisionDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { ROUTES } from "@/app/routes.constants";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useNavigateWithLoading } from "@/hooks";
import { useRevisionActionCapabilities } from "@/hooks/useRevisionActionCapabilities";
import { OriginalDocumentTab } from "@/features/documents/document-revisions/workspace-tabs";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { auditTrailApi } from "@/services/api/auditTrail";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/usePermissions";
import { hasWorkingNotesEditAccess } from "@/features/documents/document-revisions/shared/workingNotesPermissions";

import type { DocumentStatus } from "@/features/documents/types";
import { documentApi } from "@/services/api/documents";
import {
  refreshDetailAfterSnapshot,
  isRevisionDetailSnapshotPreload,
  isSnapshotGenerating,
  pollSnapshotInBackground,
} from "@/features/documents/shared/detailSnapshotHelpers";
import {
  normalizeRevisionStatusForStepper,
  resolveRevisionSkippedSteps,
  resolveTerminalProgressStep,
  revisionWorkflowStepIndex,
  REVISION_WORKFLOW_STEPS,
} from "@/features/documents/shared/statusMapping";
import {
  buildControlledCopyRequestStateFromRevision,
  buildControlledCopyRequestRouteStateFromRevision,
} from "@/features/documents/shared/controlledCopyRequest";
import type { RevisionDetailResponse, RevisionReviewCommentItem } from "./types";
import type { RevisionWorkspaceState } from "@/features/documents/shared/navigationContext";
import {
  buildRevisionSignatureRecords,
  type SignatureTabRecord,
} from "@/features/documents/document-revisions/shared/signatureRecords";
import {
  buildRevisionPreviewFileName,
  buildPreviewVersionCacheBuster,
  describeRevisionPreviewUnavailable,
  isRevisionPdfPreviewType,
  loadPdfPreviewFile,
  resolveRevisionPreviewVersionToken,
} from "@/features/documents/shared/previewHelpers";
import { Badge } from "@/components/ui/badge";
import { FormSection } from "@/components/ui";
import { formatDateTime } from "@/utils";
import { Shield } from "lucide-react";

// --- Types ---
type TabType =
  | "general"
  | "workingNotes"
  | "infoFromDocument"
  | "training"
  | "reviewers"
  | "approvers"
  | "document"
  | "signatures"
  | "audit";

interface DetailRevisionViewProps {
  revisionId: string;
  onBack: () => void;
  initialTab?: TabType;
}

// Revision status workflow steps imported from shared statusMapping

const formatSignatureAction = (actionType?: string | null) => {
  const normalized = (actionType || "")
    .replace(/[_\s-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return "Action";
  if (normalized.includes("create")) return "Created";
  if (normalized.includes("upload")) return "Uploaded";
  if (normalized.includes("submit")) return "Submitted";
  if (normalized.includes("review")) return "Reviewed";
  if (normalized.includes("approve")) return "Approved";
  if (normalized.includes("publish")) return "Published";
  if (normalized.includes("reject")) return "Rejected";
  if (normalized.includes("obsolete")) return "Obsoleted";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("train")) return "Completed Training";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatAuditActionLabel = (actionType?: string | null) => {
  const normalized = (actionType || "")
    .replace(/[_\s-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return "Action";
  if (normalized.includes("create")) return "Created Draft";
  if (normalized.includes("update")) return "Updated Draft";
  if (normalized.includes("submit")) return "Submitted for Review";
  if (normalized.includes("upload") && normalized.includes("office online"))
    return "Uploaded to Office Online";
  if (normalized.includes("upload")) return "Uploaded Revision File";
  if (normalized.includes("open edit online"))
    return "Opened Office Online Editor";
  if (
    normalized.includes("publishing workspace opened") ||
    normalized.includes("open publishing workspace")
  )
    return "Opened Publishing Workspace";
  if (normalized.includes("generate publishing preview"))
    return "Generated Publishing Preview";
  if (normalized.includes("review package generated"))
    return "Generated Review Snapshot";
  if (normalized.includes("review snapshot regenerated"))
    return "Regenerated Review Snapshot";
  if (normalized.includes("sync") && normalized.includes("office"))
    return "Synced Back From Office Online";
  if (normalized.includes("sharepoint link revoked"))
    return "SharePoint Link Revoked";
  if (normalized.includes("editing locked"))
    return "Editing Locked";
  if (normalized.includes("sharepoint link recreated"))
    return "SharePoint Link Recreated";
  if (normalized.includes("source unlocked"))
    return "Source Unlocked";
  if (normalized.includes("upgrade")) return "Upgraded Revision";
  if (normalized.includes("review complete")) return "Reviewed Document";
  if (normalized.includes("review reject")) return "Rejected Review";
  if (normalized.includes("approve complete")) return "Approved Document";
  if (normalized.includes("approve reject")) return "Rejected Document";
  if (normalized.includes("publish completed")) return "Publish Completed";
  if (normalized.includes("publish")) return "Published Document";
  if (normalized.includes("obsolete")) return "Obsoleted Document";
  if (normalized.includes("cancel")) return "Cancelled Document";
  if (normalized.includes("train")) return "Completed Training";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeAuditActionType = (actionType?: string | null) => {
  const normalized = (actionType || "")
    .replace(/[_\s-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return "view";
  if (normalized.includes("create")) return "create";
  if (normalized.includes("upload")) return "upload";
  if (normalized.includes("submit")) return "review";
  if (normalized.includes("review")) return "review";
  if (normalized.includes("approve")) return "approve";
  if (normalized.includes("publish")) return "approve";
  if (normalized.includes("reject")) return "reject";
  if (normalized.includes("obsolete")) return "obsolete";
  if (normalized.includes("cancel")) return "cancel";
  if (normalized.includes("train")) return "request";
  if (normalized.includes("open edit online")) return "open";
  if (normalized.includes("sync") && normalized.includes("office"))
    return "update";
  if (normalized.includes("publishing workspace opened")) return "open";
  if (normalized.includes("review package generated")) return "generate";
  if (normalized.includes("review snapshot regenerated")) return "generate";
  if (normalized.includes("sharepoint link revoked")) return "close";
  if (normalized.includes("editing locked")) return "close";
  if (normalized.includes("sharepoint link recreated")) return "open";
  if (normalized.includes("source unlocked")) return "close";
  if (normalized.includes("session") && normalized.includes("closed"))
    return "close";
  if (normalized.includes("publish completed")) return "approve";
  return "view";
};

export const DetailRevisionView: React.FC<DetailRevisionViewProps> = ({
  revisionId,
  onBack,
  initialTab = "general",
}) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { navigateTo, isNavigating: isRouteNavigating } =
    useNavigateWithLoading();
  const state = location.state as {
    preloadedRevisionDetail?: RevisionDetailResponse;
    preloadedRevisionDetailSnapshot?: boolean;
    workspaceState?: RevisionWorkspaceState | null;
  };
  // A route may carry a just-completed workflow snapshot. Keep the fast refresh
  // only for that explicit case; ordinary detail loads already force a live read.
  const isSnapshotPreload = isRevisionDetailSnapshotPreload(state, revisionId);
  const urlTab = searchParams.get("tab") as TabType;
  const [revision, setRevision] = useState<RevisionDetailResponse | null>(null);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [auditTrailRows, setAuditTrailRows] = useState<any[]>([]);
  const [reviewComments, setReviewComments] = useState<RevisionReviewCommentItem[]>([]);
  const [currentReviewRound, setCurrentReviewRound] = useState(1);
  const [openCommentCount, setOpenCommentCount] = useState(0);
  const [commentHistoryOpen, setCommentHistoryOpen] = useState(false);
  const activeFetchIdRef = useRef<string | null>(null);
  const fetchPromiseRef = useRef<Promise<RevisionDetailResponse> | null>(null);
  const filePromiseRef = useRef<Promise<Blob> | null>(null);
  // A workflow transition can update the server-side preview more than once (for
  // example: Review snapshot -> Published PDF). Keep only the newest request
  // authoritative so an older in-flight preview cannot clear or overwrite it.
  const previewRequestSequenceRef = useRef(0);

  const [activeTab, setActiveTab] = useState<TabType>(
    urlTab || initialTab || "general",
  );

  // Comments and edit history are tied to the PDF review workspace.  Keep its
  // action and panel out of non-document tabs so header and footer actions do
  // not present a document-only control in an unrelated context.
  useEffect(() => {
    if (activeTab !== "document") {
      setCommentHistoryOpen(false);
    }
  }, [activeTab]);

  // Published state controls the success banner while refreshed server data is loading.
  const [isPublished, setIsPublished] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);
  const [isWorkingNotesSubmitting, setIsWorkingNotesSubmitting] =
    useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [nonEffectiveDocs, setNonEffectiveDocs] = useState<
    Array<{ field: string; message: string }>
  >([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelESignModal, setShowCancelESignModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
  const [pendingPublishParams, setPendingPublishParams] = useState<{
    reason: string;
    comment: string;
    signatureToken: string;
  } | null>(null);
  const { showToast } = useToast();
  const { user } = usePermissions();
  const [isRegeneratingPdf, setIsRegeneratingPdf] = useState(false);
  const currentRevision = revision;
  const currentStatus = normalizeRevisionStatusForStepper(
    currentRevision?.status,
    currentRevision?.statusInfo,
  ) as DocumentStatus;
  const isReadyForPublishing = currentStatus === "Ready for Publishing";

  const revisionActionCapabilities = useRevisionActionCapabilities(currentRevision?.id ?? null);
  const canCancelCurrentRevision =
    !revisionActionCapabilities.loading &&
    revisionActionCapabilities.can("cancel");
  const canPublishCurrentRevision =
    !revisionActionCapabilities.loading &&
    revisionActionCapabilities.can("publish");
  const canOpenPublishingWorkspace =
    isReadyForPublishing &&
    !revisionActionCapabilities.loading &&
    (revisionActionCapabilities.can("openPublishingWorkspace") || revisionActionCapabilities.can("publish"));

  const handleOpenPublishingWorkspace = () => {
    if (!currentRevision?.id) return;
    navigateTo(ROUTES.DOCUMENTS.REVISIONS.PUBLISHING(currentRevision.id), {
      state: {
        from: location.pathname + location.search,
        returnTo: location.pathname + location.search,
        workspaceReturnPath: location.pathname + location.search,
        preloadedRevisionDetail: currentRevision,
      },
    });
  };

  const terminalProgressStep = useMemo(
    () =>
      resolveTerminalProgressStep(
        currentRevision?.status,
        currentRevision?.history || [],
      ),
    [currentRevision?.status, currentRevision?.history],
  );
  const revisionStatus = String(currentRevision?.status ?? "").toUpperCase();
  const showHistoricalReviewComparison = ["PENDING_REVIEW", "PENDING_APPROVAL"].includes(revisionStatus)
    || (revisionStatus === "DRAFT" && Boolean((currentRevision as any)?.rejectedAt));
  const canOpenCommentHistory = activeTab === "document" && showHistoricalReviewComparison;
  const canEditWorkingNotes = useMemo(
    () =>
      hasWorkingNotesEditAccess(
        user,
        currentRevision?.reviewers,
        currentRevision?.approvers,
        currentRevision?.author,
        currentRevision?.coAuthors,
        currentRevision?.workingNotesEditable,
      ),
    [
      user,
      currentRevision?.reviewers,
      currentRevision?.approvers,
      currentRevision?.author,
      currentRevision?.coAuthors,
      currentRevision?.workingNotesEditable,
    ],
  );
  const reloadRevisionPreview = React.useCallback(
    async (detail: RevisionDetailResponse | null | undefined) => {
      const requestSequence = ++previewRequestSequenceRef.current;
      if (!detail) {
        if (requestSequence === previewRequestSequenceRef.current) {
          setRevisionFile(null);
          setPreviewStatus("idle");
          setPreviewMessage("PDF preview is not available yet.");
        }
        return;
      }

      const serverPreviewStatus = String(detail?.previewStatus || "").trim().toUpperCase();
      const snapshotIsGenerating = isSnapshotGenerating(detail?.snapshotStatus)
        || serverPreviewStatus === "GENERATING";
      const snapshotFailed = String(detail?.snapshotStatus || "").trim().toUpperCase() === "FAILED"
        || serverPreviewStatus === "FAILED";
      const canRequestPreview = isRevisionPdfPreviewType(detail?.previewType)
        && (serverPreviewStatus === "READY" || !serverPreviewStatus);

      if (!canRequestPreview) {
        if (requestSequence !== previewRequestSequenceRef.current) return;
        setRevisionFile(null);
        setPreviewStatus(snapshotIsGenerating ? "loading" : snapshotFailed ? "error" : "idle");
        setPreviewMessage(describeRevisionPreviewUnavailable(detail));
        return;
      }

      if (requestSequence !== previewRequestSequenceRef.current) return;
      setPreviewStatus("loading");
      setPreviewMessage(null);
      try {
        const token = resolveRevisionPreviewVersionToken(detail);
        const cacheBuster = buildPreviewVersionCacheBuster(token ? `${token}::${Date.now()}` : String(Date.now()));
        const previewPromise = documentApi.previewRevisionFile(revisionId, cacheBuster);
        filePromiseRef.current = previewPromise;
        const file = await loadPdfPreviewFile(
          () => previewPromise,
          buildRevisionPreviewFileName(detail.documentNumber),
        );
        if (requestSequence !== previewRequestSequenceRef.current) return;
        setRevisionFile(file);
        setPreviewStatus("ready");
        setPreviewMessage(null);
      } catch {
        if (requestSequence !== previewRequestSequenceRef.current) return;
        setRevisionFile(null);
        setPreviewStatus("error");
        setPreviewMessage("Unable to load PDF preview from server.");
      } finally {
        if (requestSequence === previewRequestSequenceRef.current) {
          filePromiseRef.current = null;
        }
      }
    },
    [revisionId],
  );

  const originalDocument = currentRevision?.originalDocument ?? null;

  const loadReviewComments = React.useCallback(async () => {
    setReviewComments([]);
    setCurrentReviewRound(1);
    setOpenCommentCount(0);
  }, []);

  const reviewerRows = useMemo(
    () =>
      (currentRevision?.reviewers ?? []).map((item, index) => ({
        id: item.id || String(index),
        name: item.fullName || item.username || item.id,
        signedOn: item.actedAt || undefined,
      })),
    [currentRevision?.reviewers],
  );

  const approverRows = useMemo(
    () =>
      (currentRevision?.approvers ?? []).map((item, index) => ({
        id: item.id || String(index),
        name: item.fullName || item.username || item.id,
        signedOn: item.actedAt || undefined,
      })),
    [currentRevision?.approvers],
  );

  const signatureRecords = useMemo<SignatureTabRecord[]>(
    () => buildRevisionSignatureRecords(currentRevision),
    [currentRevision],
  );

  const auditEntries = useMemo(() => {
    const history = currentRevision?.history ?? [];
    return history.map((entry) => ({
      id: entry.id,
      timestamp: entry.created || "—",
      user: {
        id: entry.actedBy || entry.id,
        fullName: entry.actedBy || "Unknown User",
        employeeCode: "—",
        role: "—",
        position: "—",
        department: currentRevision?.department || "—",
      },
      action: formatAuditActionLabel(entry.actionType),
      actionType: normalizeAuditActionType(entry.actionType),
      changes:
        entry.fromStatus || entry.toStatus
          ? [
              {
                field: "Status",
                oldValue: entry.fromStatus || "—",
                newValue: entry.toStatus || "—",
              },
            ]
          : undefined,
      reason: entry.comment || undefined,
      ipAddress: "—",
      device: "—",
    }));
  }, [currentRevision?.department, currentRevision?.history]);

  const officeOnlineSessionEvents = useMemo(() => {
    const source = auditTrailRows.length > 0 ? auditTrailRows : auditEntries;
    return source
      .filter((entry: any) => {
        const action = (entry.actionType || entry.action || "")
          .toString()
          .trim()
          .toUpperCase();
        return [
          "OPEN_EDIT_ONLINE",
          "EDIT_ONLINE_SYNCED_BACK_TO_MINIO",
          "EDIT_ONLINE_SESSION_CLOSED",
          "PUBLISHING_WORKSPACE_OPENED",
          "OPEN_PUBLISHING_WORKSPACE",
          "GENERATE_PUBLISHING_PREVIEW",
          "REVIEW_PACKAGE_GENERATED",
          "REVIEW_SNAPSHOT_REGENERATED",
          "SHAREPOINT_LINK_REVOKED",
          "EDITING_LOCKED",
          "SHAREPOINT_LINK_RECREATED",
          "SOURCE_UNLOCKED",
        ].includes(action);
      })
      .map((entry: any) => ({
        id: entry.id,
        label: formatAuditActionLabel(entry.actionType || entry.action),
        timestamp: entry.timestamp || entry.created || "â€”",
        comment: entry.reason || entry.comment || "-",
      }));
  }, [auditTrailRows, auditEntries]);

  useEffect(() => {
    let mounted = true;
    if (!revision?.id) {
      setAuditTrailRows([]);
      return;
    }

    const loadRevisionAuditTrail = async () => {
      try {
        const response = await auditTrailApi.getByEntity(
          "Revision",
          revision.id,
        );
        if (!mounted) return;
        const rows = Array.isArray(response)
          ? response
          : (response as any)?.data || [];
        setAuditTrailRows(rows);
      } catch {
        if (!mounted) return;
        setAuditTrailRows(auditEntries as any[]);
      }
    };

    void loadRevisionAuditTrail();

    return () => {
      mounted = false;
    };
  }, [revision?.id, auditEntries]);

  // Delegate entirely to the onBack prop (wired to the shared navigateBack() helper by the
  // route wrapper) — do not reimplement return-target lookup here, it drifts out of sync with
  // the shared helper's fallback chain (window.history.back() / fixed route).
  const handleBack = () => {
    onBack();
  };

  const handleRequestControlledCopy = () => {
    if (!currentRevision || !canRequestControlledCopy) {
      showToast({
        type: "error",
        title: "Controlled copy request unavailable",
        message:
          "Request Controlled Copy is available only when the revision is Effective and the document master is Active.",
        duration: 3000,
      });
      return;
    }

    navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.REQUEST, {
      state: buildControlledCopyRequestRouteStateFromRevision(
        {
          ...buildControlledCopyRequestStateFromRevision(currentRevision),
        },
        {
          from: location.pathname + location.search,
          returnTo: location.pathname + location.search,
          workspaceReturnPath: location.pathname + location.search,
          preloadedRevisionDetail: currentRevision,
        },
      ),
    });
  };

  const handleCancelRevision = () => {
    if (!currentRevision || !canCancelCurrentRevision) {
      showToast({
        type: "error",
        title: "Cancel unavailable",
        message:
          "Cancel Revision is only available while the revision is in Draft.",
        duration: 3000,
      });
      return;
    }

    setCancelReason("");
    setCancelReasonError("");
    setShowCancelModal(true);
  };

  const handleCancelConfirm = () => {
    if (!currentRevision) return;
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setCancelReasonError("Activity summary is required");
      return;
    }
    setShowCancelModal(false);
    setShowCancelESignModal(true);
  };

  const handleCancelESignConfirm = async (signature: {
    username: string;
    password: string;
    reason: string;
    signatureToken?: string;
  }) => {
    if (!currentRevision) return;
    const trimmedReason = cancelReason.trim();
    setShowCancelESignModal(false);

    try {
      setIsCancelSubmitting(true);
      const updated = await documentApi.cancelRevision(currentRevision.id, {
        reason: trimmedReason,
        comment: trimmedReason,
        signatureToken: signature.signatureToken as string,
      });
      const latest = await documentApi.getRevisionByIdSnapshot(currentRevision.id, { force: true }).catch(() => updated);
      setRevision({ ...latest, signatures: latest.signatures || [] });
      await reloadRevisionPreview(latest);
      const refreshedAuditTrail = await auditTrailApi
        .getByEntity("Revision", currentRevision.id)
        .catch(() => []);
      setAuditTrailRows(
        Array.isArray(refreshedAuditTrail) ? refreshedAuditTrail : [],
      );
      setShowCancelModal(false);
      setCancelReason("");
      setCancelReasonError("");
      showToast({
        type: "success",
        title: "Revision cancelled",
        message:
          updated.message ||
          "The revision has been moved to Closed - Cancelled.",
        duration: 3000,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Cancel failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          "Unable to cancel revision.",
        duration: 3000,
      });
    } finally {
      setIsCancelSubmitting(false);
    }
  };

  const handlePublishConfirm = async (signature: {
    username: string;
    password: string;
    reason: string;
    signatureToken?: string;
  }) => {
    if (!currentRevision) return;

    setShowESignModal(false);
    await executePublish({
      reason: signature.reason,
      comment: signature.reason,
      signatureToken: signature.signatureToken as string,
    });
  };

  const handleRegeneratePdf = async () => {
    if (!currentRevision?.id) return;
    setIsRegeneratingPdf(true);
    try {
      const queued = await documentApi.regenerateRevisionSnapshot(currentRevision.id);
      setRevision({ ...queued, signatures: queued.signatures || [] });
      await reloadRevisionPreview(queued);
      showToast({ type: "success", title: "Regeneration Started", message: "The PDF is being regenerated and will update automatically." });
      pollSnapshotInBackground({
        detail: queued,
        fetchLive: () => documentApi.getRevisionByIdSnapshot(currentRevision.id, { force: true }),
        onUpdate: (resolvedDetail) => {
          setRevision({ ...resolvedDetail, signatures: resolvedDetail.signatures || [] });
          void reloadRevisionPreview(resolvedDetail);
        },
      });
    } catch {
      showToast({ type: "error", title: "Regenerate Failed", message: "Failed to regenerate the PDF." });
    } finally {
      setIsRegeneratingPdf(false);
    }
  };

  const executePublish = async (params: {
    reason: string;
    comment: string;
    signatureToken: string;
    forcePublish?: boolean;
  }) => {
    if (!currentRevision) return;
    try {
      setIsNavigating(true);
      setIsPublished(true);
      await documentApi.publishRevision(currentRevision.id, params);
      const rawDetail = await documentApi.getRevisionByIdSnapshot(currentRevision.id, { force: true });
      setRevision({ ...rawDetail, signatures: rawDetail.signatures || [] });
      await reloadRevisionPreview(rawDetail);
      showToast({
        type: "success",
        title: "Publish successful",
        message: "Revision has been published successfully.",
      });

      // The published PDF regeneration round-trip can take 15-20s (two Microsoft Graph
      // conversions) — don't hold the full-page loading overlay up for it. The Document tab
      // already shows its own "generating" state; patch in the finished snapshot once ready.
      pollSnapshotInBackground({
        detail: rawDetail,
        fetchLive: () => documentApi.getRevisionByIdSnapshot(currentRevision.id, { force: true }),
        onUpdate: (resolvedDetail) => {
          setRevision({ ...resolvedDetail, signatures: resolvedDetail.signatures || [] });
          void reloadRevisionPreview(resolvedDetail);
        },
      });
    } catch (error) {
      setIsPublished(false);
      const responseData = (error as any)?.response?.data;
      if (responseData?.error?.code === "RELATED_DOCUMENTS_NOT_EFFECTIVE") {
        setWarningMessage(responseData.error.message);
        setNonEffectiveDocs(responseData.error.details || []);
        setPendingPublishParams({
          reason: params.reason,
          comment: params.comment,
          signatureToken: params.signatureToken,
        });
        setShowWarningModal(true);
      } else {
        console.error("Failed to publish revision", error);
        showToast({
          type: "error",
          title: "Publish failed",
          message:
            responseData?.error?.message ||
            responseData?.message ||
            "Failed to publish revision.",
        });
      }
    } finally {
      setIsNavigating(false);
    }
  };

  const handleWarningConfirm = async () => {
    if (!pendingPublishParams) return;
    setShowWarningModal(false);
    const params = pendingPublishParams;
    setPendingPublishParams(null);
    await executePublish({
      reason: params.reason,
      comment: params.comment,
      signatureToken: params.signatureToken,
      forcePublish: true,
    });
  };

  const handleAddWorkingNote = async (content: string) => {
    if (!currentRevision?.id) return;
    setIsWorkingNotesSubmitting(true);
    try {
      const note = await documentApi.addRevisionWorkingNote(
        currentRevision.id,
        content,
      );
      setRevision((prev) =>
        prev
          ? {
              ...prev,
              workingNotes: [note, ...(prev.workingNotes ?? [])],
            }
          : prev,
      );
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to add note",
        message:
          (error as any)?.response?.data?.message ||
          "Working note could not be saved.",
        duration: 3000,
      });
    } finally {
      setIsWorkingNotesSubmitting(false);
    }
  };

  const handleDeleteWorkingNote = async (noteId: string) => {
    if (!currentRevision?.id) return;
    setIsWorkingNotesSubmitting(true);
    try {
      await documentApi.deleteRevisionWorkingNote(currentRevision.id, noteId);
      setRevision((prev) =>
        prev
          ? {
              ...prev,
              workingNotes: (prev.workingNotes ?? []).filter(
                (note) => note.id !== noteId,
              ),
            }
          : prev,
      );
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to delete note",
        message:
          (error as any)?.response?.data?.message ||
          "Working note could not be deleted.",
        duration: 3000,
      });
    } finally {
      setIsWorkingNotesSubmitting(false);
    }
  };

  const canRequestControlledCopy = Boolean(currentRevision?.canRequestControlledCopy);
  const skippedSteps = useMemo(
    () => resolveRevisionSkippedSteps(
      currentRevision?.status,
      currentRevision?.history,
      currentRevision?.requiresTraining,
    ),
    [currentRevision?.status, currentRevision?.history, currentRevision?.requiresTraining],
  );
  const currentStepIndex = revisionWorkflowStepIndex(
    currentRevision?.status,
    currentRevision?.statusInfo,
  );

  useEffect(() => {
    let mounted = true;
    const loadRevisionDetail = async () => {
      if (!revisionId) {
        setIsLoadingDetail(false);
        setDetailError("Revision not found");
        return;
      }

      try {
        setIsLoadingDetail(true);
        setDetailError(null);

        // Workflow status and its PDF snapshot can change immediately after an electronic
        // signature. Detail must therefore bypass the short client-side snapshot cache, rather
        // than trusting route state or a response from a few seconds earlier.
        const detail = await documentApi.getRevisionByIdSnapshot(revisionId, { force: true });
        if (!mounted) {
          return;
        }

        activeFetchIdRef.current = revisionId;
        filePromiseRef.current = null;
        fetchPromiseRef.current = Promise.resolve(detail);
        setRevision({
          ...detail,
          signatures: detail.signatures || [],
        });
        setDetailError(null);

        await loadReviewComments();

        await reloadRevisionPreview(detail);

        // Don't block the page render on the PDF regeneration round-trip (can take 15-20s) —
        // render immediately with the Document tab's own "generating" state, and patch in the
        // finished snapshot in the background once ready.
        pollSnapshotInBackground({
          detail,
          fetchLive: () => documentApi.getRevisionByIdSnapshot(revisionId, { force: true }),
          onUpdate: (resolvedDetail) => {
            if (!mounted) return;
            fetchPromiseRef.current = Promise.resolve(resolvedDetail);
            setRevision({
              ...resolvedDetail,
              signatures: resolvedDetail.signatures || [],
            });
            void reloadRevisionPreview(resolvedDetail);
          },
        });

        void refreshDetailAfterSnapshot({
          enabled: isSnapshotPreload,
          fetchLive: () => documentApi.getRevisionByIdSnapshot(revisionId, { force: true }),
          onSuccess: (freshDetail) => {
            if (!mounted) {
              return;
            }
            setRevision({
              ...freshDetail,
              signatures: freshDetail.signatures || [],
            });
            void reloadRevisionPreview(freshDetail);
          },
        });
      } catch (error) {
        // Clear cached promise on error to allow retry
        activeFetchIdRef.current = null;
        fetchPromiseRef.current = null;
        filePromiseRef.current = null;

        if (!mounted) return;
        setPreviewStatus("error");
        setPreviewMessage("Failed to load revision preview metadata.");
        const message =
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          (error as Error)?.message ||
          "Failed to load revision detail";
        setDetailError(message);
        setRevision(null);
      } finally {
        if (mounted) {
          setIsLoadingDetail(false);
        }
      }
    };

    void loadRevisionDetail();

    return () => {
      mounted = false;
    };
  }, [revisionId, reloadRevisionPreview, loadReviewComments]);

  const tabs = [
    { id: "general" as TabType, label: "General Information" },
    { id: "workingNotes" as TabType, label: "Working Notes" },
    { id: "infoFromDocument" as TabType, label: "Information from Document" },
    { id: "training" as TabType, label: "Training Information" },
    { id: "reviewers" as TabType, label: "Reviewers" },
    { id: "approvers" as TabType, label: "Approvers" },
    { id: "document" as TabType, label: "Document" },
    { id: "signatures" as TabType, label: "Signatures" },
    { id: "audit" as TabType, label: "Audit Trail" },
  ];

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      {(isRouteNavigating ||
        isNavigating ||
        isLoadingDetail ||
        isCancelSubmitting) && <FullPageLoading text="Loading..." />}
      {detailError && !isLoadingDetail && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {detailError}
        </div>
      )}

      {/* E-Signature Modal for Publish action */}
      <ESignatureModal
        isOpen={showESignModal}
        onClose={() => setShowESignModal(false)}
        onConfirm={handlePublishConfirm}
        actionTitle="Publish Document"
        meaningDisplayName="Published"
        meaningCode="PUBLISHED"
        changes={[
          {
            action: "Update Status",
            oldValue: "Ready for Publishing",
            newValue: "Effective",
            category: "status",
          },
        ]}
        targetDetails={{
          code: currentRevision?.documentNumber || "Document",
          title: currentRevision?.documentName || "",
          revision: currentRevision?.revisionNumber || "",
        }}
      />

      {/* E-Signature Modal for Cancel Revision action */}
      <ESignatureModal
        isOpen={showCancelESignModal}
        onClose={() => setShowCancelESignModal(false)}
        onConfirm={handleCancelESignConfirm}
        actionTitle="Cancel Revision"
        meaningDisplayName="Cancelled"
        meaningCode="CANCELLED"
        changes={[
          {
            action: "Update Status",
            oldValue: currentRevision?.status || "",
            newValue: "Closed - Cancelled",
            category: "status",
          },
        ]}
        targetDetails={{
          code: currentRevision?.documentNumber || "Document",
          title: currentRevision?.documentName || "",
          revision: currentRevision?.revisionNumber || "",
        }}
      />

      {/* Warning Override Modal */}
      <AlertModal
        isOpen={showWarningModal}
        onClose={() => {
          setShowWarningModal(false);
          setPendingPublishParams(null);
        }}
        onConfirm={handleWarningConfirm}
        title="Publish Warning"
        type="warning"
        confirmText="Publish Anyway"
        cancelText="Cancel"
        description={
          <div className="space-y-3">
            <p className="font-semibold text-slate-900">
              One or more Related Documents are not currently Effective:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1 text-xs text-slate-700">
              {nonEffectiveDocs.map((doc, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{doc.field}</span>
                  <span className="font-semibold text-amber-600">
                    {doc.message}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Please verify the document package before publishing. Do you want
              to publish anyway?
            </p>
          </div>
        }
      />

      {/* Header: Title + Breadcrumb + Actions */}
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Revision Details"
          breadcrumbItems={revisionDetail(
            navigateTo,
            state?.workspaceState?.from ||
              state?.workspaceState?.returnTo ||
              state?.workspaceState?.workspaceReturnPath,
          )}
          actions={
            <>
              <Button
                onClick={handleBack}
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap gap-2"
              >
                Back
              </Button>
              {canCancelCurrentRevision && (
                <Button
                  size="sm"
                  variant="outline-emerald"
                  className="whitespace-nowrap gap-2"
                  onClick={handleCancelRevision}
                >
                  Cancel
                </Button>
              )}
              {(canOpenPublishingWorkspace || (isReadyForPublishing && canPublishCurrentRevision)) && (
                <Button
                  size="sm"
                  variant="outline-emerald"
                  className="whitespace-nowrap gap-2"
                  onClick={handleOpenPublishingWorkspace}
                >
                  Open Publishing Template
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
            </>
          }
        />
      </div>

      {/* Status Stepper */}
      {currentRevision && (
        <WorkflowStepper
          steps={REVISION_WORKFLOW_STEPS}
          currentStepIndex={currentStepIndex}
          skippedSteps={skippedSteps}
          terminalProgressStep={terminalProgressStep}
        />
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
          layoutId="revision-detail-main-tab"
        />

        {/* Tab Content */}
        <div className="p-4 md:p-5">
          {activeTab === "general" && (
            <GeneralInformationTab
              isReadOnly
              document={{
                documentNumber: currentRevision?.documentNumber || "",
                documentName: currentRevision?.documentName || "",
                revisionNumber: currentRevision?.revisionNumber || "",
                revisionName: currentRevision?.revisionName || "",
                created: currentRevision?.created || "",
                openedBy: currentRevision?.openedBy || "",
                author: currentRevision?.author || "",
                coAuthors: (currentRevision?.coAuthors || []).map(
                  (item) => item.id,
                ),
                coAuthorDisplayNames: (currentRevision?.coAuthors || []).map(
                  (item) => item.fullName || item.username || item.id,
                ),
                isTemplate: Boolean(currentRevision?.isTemplate ?? false),
                businessUnit: currentRevision?.businessUnit || "",
                department: currentRevision?.department || "",
                subType: currentRevision?.subType || "",
                knowledgeBase: currentRevision?.knowledgeBase || "",
                periodicReviewCycle: currentRevision?.periodicReviewCycle ?? 0,
                periodicReviewNotification:
                  currentRevision?.periodicReviewNotification ?? 0,
                language: currentRevision?.language || "",
                description: currentRevision?.description || "",
                titleLocalLanguage: currentRevision?.titleLocalLanguage || "",
              }}
            />
          )}
          {activeTab === "workingNotes" && (
            <WorkingNotesTab
              notes={currentRevision?.workingNotes ?? []}
              onAddNote={handleAddWorkingNote}
              onDeleteNote={handleDeleteWorkingNote}
              isSubmitting={isWorkingNotesSubmitting}
              isReadOnly={!canEditWorkingNotes}
            />
          )}
          {activeTab === "infoFromDocument" && (
            <InfoFromDocumentTab
              documentCode={
                currentRevision?.originalDocument?.documentNumber ?? undefined
              }
              documentName={
                currentRevision?.originalDocument?.documentName ||
                currentRevision?.documentName ||
                ""
              }
              documentCreated={
                currentRevision?.originalDocument?.created ?? undefined
              }
            />
          )}
          {activeTab === "training" && (
            <TrainingInformationTab
              isReadOnly
              data={{
                trainingPlannedDate: currentRevision?.trainingPlannedDate,
                trainingPeriodEndDate: currentRevision?.trainingPeriodEndDate,
                trainingCompletionDate: currentRevision?.trainingCompletionDate,
              }}
            />
          )}
          {activeTab === "reviewers" && (
            <ReviewersTab reviewers={reviewerRows} reviewRequirement={currentRevision?.reviewRequirement} />
          )}
          {activeTab === "approvers" && (
            <ApproversTab approvers={approverRows} />
          )}
          {activeTab === "document" && (
            <>
              {canPublishCurrentRevision && ["EFFECTIVE", "PUBLISHED", "OBSOLETED", "OBSOLETE"].includes(
                String(currentRevision?.status ?? "").toUpperCase()
              ) && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleRegeneratePdf}
                    disabled={isRegeneratingPdf}
                    className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isRegeneratingPdf ? (
                      <span className="h-3 w-3 border border-emerald-600 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <span>↺</span>
                    )}
                    {isRegeneratingPdf ? "Regenerating…" : "Refresh Published PDF"}
                  </button>
                </div>
              )}
              <DocumentTab
                documentFile={revisionFile}
                previewStatus={previewStatus}
                previewMessage={previewMessage}
                revisionId={revisionId}
              />
            </>
          )}
          {activeTab === "signatures" && (
            <SignaturesTab records={signatureRecords} revisionId={currentRevision?.id || revision?.id} />
          )}
          {activeTab === "audit" && (
            <AuditTrailTab
              records={auditTrailRows.length > 0 ? auditTrailRows : undefined}
              entityId={currentRevision?.id || ""}
              entityType="Revision"
              emptyMessage="No audit trail records available for this revision"
            />
          )}
        </div>
      </div>

      {/* Button below the card — standalone */}
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <Button
          onClick={handleBack}
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap gap-2"
        >
          Back
        </Button>
        {canCancelCurrentRevision && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            onClick={handleCancelRevision}
          >
            Cancel
          </Button>
        )}
        {(canOpenPublishingWorkspace || (isReadyForPublishing && canPublishCurrentRevision)) && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            onClick={handleOpenPublishingWorkspace}
          >
            Open Publishing Template
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
      </div>

      {/* Sub-tab: Document Master */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={[{ id: "originalDocument", label: "Document Master" }]}
          activeTab="originalDocument"
          onChange={() => {}}
          layoutId="revision-detail-original-tab"
        />
        <div className="p-4 md:p-5">
          <OriginalDocumentTab
            document={originalDocument}
            returnTo={`${location.pathname}${location.search}`}
          />
        </div>
      </div>

      <FormModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason("");
          setCancelReasonError("");
        }}
        onConfirm={handleCancelConfirm}
        title="Cancel Revision"
        description="Cancelling is available only for a Draft revision. It moves this revision to Closed - Cancelled and does not change the Document Master."
        confirmText="Cancel Revision"
        cancelText="Keep Working"
        confirmVariant="destructive"
        isLoading={isCancelSubmitting}
        confirmDisabled={!cancelReason.trim()}
        size="lg"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Activity Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelReasonError("");
              }}
              placeholder="Enter the reason for cancelling this revision..."
              rows={4}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors resize-none",
                cancelReasonError
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
              )}
            />
            {cancelReasonError && (
              <p className="mt-1 text-xs text-red-600">{cancelReasonError}</p>
            )}
          </div>
        </div>
      </FormModal>
    </div>
  );
};
