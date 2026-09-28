import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { revisionReview } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { OriginalDocumentTab } from "@/features/documents/document-revisions/workspace-tabs";
import {
  DocumentWorkflowLayout,
  DEFAULT_WORKFLOW_TABS,
} from "@/features/documents/shared/layouts";
import {
  GeneralInformationTab,
  DocumentTab,
  SignaturesTab,
  AuditTrailTab,
  WorkingNotesTab,
  InfoFromDocumentTab,
  RevisionWorkspaceReviewersTab,
  RevisionWorkspaceApproversTab,
  TrainingInformationTab,
} from "@/features/documents/document-revisions/workspace-tabs";

import type { DocumentStatus } from "@/features/documents/types";
import { documentApi } from "@/services/api/documents";
import { auditTrailApi } from "@/services/api/auditTrail";
import type { RevisionDetailResponse, RevisionReviewCommentItem } from "@/features/documents/document-revisions/detail-revision/types";
import { buildRevisionSignatureRecords, type SignatureTabRecord } from "@/features/documents/document-revisions/shared/signatureRecords";
import { useToast } from "@/components/ui/toast";
import { hasWorkingNotesEditAccess } from "@/features/documents/document-revisions/shared/workingNotesPermissions";
import { useRevisionActionCapabilities } from "@/hooks/useRevisionActionCapabilities";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useOfficeOnlineReviewLink } from "@/features/documents/hooks/useOfficeOnlineReviewLink";
import { buildRevisionDetailSnapshotState, isRevisionDetailSnapshotPreload, refreshDetailAfterSnapshot, isSnapshotGenerating, pollSnapshotInBackground } from "@/features/documents/shared/detailSnapshotHelpers";
import { buildRevisionDetailNavigationState } from "@/features/documents/shared/navigationContext";
import { ROUTES } from "@/app/routes.constants";
import { isLiveViewStage } from "@/features/documents/shared/liveDocumentView";
import { resolveTerminalProgressStep } from "@/features/documents/shared/statusMapping";
import type { RevisionWorkspaceState } from "@/features/documents/shared/navigationContext";
import {
  buildRevisionPreviewFileName,
  buildPreviewVersionCacheBuster,
  describeRevisionPreviewUnavailable,
  isRevisionPdfPreviewType,
  loadPdfPreviewFile,
  resolveRevisionPreviewVersionToken,
} from "@/features/documents/shared/previewHelpers";

// --- Types ---
type TabType =
  | "document"
  | "general"
  | "workingNotes"
  | "documentInfo"
  | "infoFromDocument"
  | "training"
  | "reviewers"
  | "approvers"
  | "signatures"
  | "audit";

interface RevisionReviewViewProps {
  revisionId: string;
  onBack: () => void;
  currentUserId: string;
}

export const RevisionReviewView: React.FC<RevisionReviewViewProps> = ({
  revisionId,
  onBack,
  currentUserId = "1",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as {
    preloadedRevisionDetail?: RevisionDetailResponse;
    preloadedRevisionDetailSnapshot?: boolean;
    workspaceState?: RevisionWorkspaceState | null;
  } | undefined;
  const { showToast } = useToast();
  const [document, setDocument] = useState<any>(null);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [commentHistoryOpen, setCommentHistoryOpen] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);
  const [showRejectWarning, setShowRejectWarning] = useState(false);
  const [eSignAction, setESignAction] = useState<"approve" | "reject">("approve");
  const [isNavigating, setIsNavigating] = useState(false);
  const [auditTrailRows, setAuditTrailRows] = useState<any[]>([]);
  const [isWorkingNotesSubmitting, setIsWorkingNotesSubmitting] = useState(false);
  const [reviewComments, setReviewComments] = useState<RevisionReviewCommentItem[]>([]);
  const [currentReviewRound, setCurrentReviewRound] = useState(1);
  const currentRevision = document;
  const revisionActionCapabilities = useRevisionActionCapabilities(currentRevision?.id ?? revisionId ?? null);
  // Someone else (Reviewer, Approver, DCO ...) moved this revision on: refresh the page in place so the status,
  // stepper and available actions are current without a manual reload.
  useEntityChanged(["REVISION"], () => {
    void documentApi.getRevisionByIdSnapshot(revisionId, { force: true }).then((live) => {
      if (!live) return;
      setDocument({ ...live, reviewers: live.reviewers || [], approvers: live.approvers || [], reviewFlowType: "parallel", currentReviewerIndex: 0 });
    }).catch(() => undefined);
  }, { ids: [revisionId] });
  const { isOpeningWordReview, handleOpenWordReview } = useOfficeOnlineReviewLink(revisionId);
  const canEditWorkingNotes = useMemo(
    () =>
      hasWorkingNotesEditAccess(
        currentUserId,
        currentRevision?.reviewers,
        currentRevision?.approvers,
        currentRevision?.author,
        currentRevision?.coAuthors,
        currentRevision?.workingNotesEditable,
      ),
    [
      currentUserId,
      currentRevision?.reviewers,
      currentRevision?.approvers,
      currentRevision?.author,
      currentRevision?.coAuthors,
      currentRevision?.workingNotesEditable,
    ],
  );
  const skippedSteps = currentRevision?.requiresTraining ? [] : (["Pending Training"] as const);
  const terminalProgressStep = useMemo(
    () => resolveTerminalProgressStep(document?.status, document?.history ?? []),
    [document?.history, document?.status],
  );
  const signatureRecords = useMemo<SignatureTabRecord[]>(
    () => buildRevisionSignatureRecords(document),
    [document]
  );
  const loadRevisionPreview = React.useCallback(
    async (detail: RevisionDetailResponse | null | undefined) => {
      if (!detail) {
        setRevisionFile(null);
        setPreviewStatus("idle");
        setPreviewMessage("PDF preview is not available yet.");
        return;
      }

      const serverPreviewStatus = String(detail.previewStatus || "").toUpperCase();
      const snapshotIsGenerating = isSnapshotGenerating(detail.snapshotStatus, detail.previewStatus);
      const snapshotFailed = String(detail.snapshotStatus || "").toUpperCase() === "FAILED"
        || serverPreviewStatus === "FAILED";
      // Bug fix: previewType alone flips to REVIEW_PDF as soon as a PRIOR round's
      // previewFilePath exists on the revision -- requestReviewSnapshotGeneration (backend)
      // deliberately never clears it while a newer round is GENERATING, so relying on
      // previewType/previewStatus alone here would serve the stale prior round's PDF while a
      // resubmission's snapshot is still being regenerated. Must also gate on snapshotStatus.
      const canRequestPreview = isRevisionPdfPreviewType(detail.previewType)
        && (serverPreviewStatus === "READY" || !serverPreviewStatus)
        && !snapshotIsGenerating
        && !snapshotFailed;
      if (!canRequestPreview) {
        setRevisionFile(null);
        setPreviewStatus(snapshotIsGenerating ? "loading" : snapshotFailed ? "error" : "idle");
        setPreviewMessage(describeRevisionPreviewUnavailable(detail));
        return;
      }

      setPreviewStatus("loading");
      setPreviewMessage(null);
      const cacheBuster = buildPreviewVersionCacheBuster(resolveRevisionPreviewVersionToken(detail));
      try {
        const file = await loadPdfPreviewFile(
          () => documentApi.previewRevisionFile(revisionId, cacheBuster),
          buildRevisionPreviewFileName(detail?.documentNumber),
        );
        setRevisionFile(file);
        setPreviewStatus("ready");
        setPreviewMessage(null);
      } catch {
        setRevisionFile(null);
        setPreviewStatus("error");
        setPreviewMessage("Unable to load PDF preview from server.");
      }
    },
    [revisionId],
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!revisionId) {
        setIsLoadingDetail(false);
        return;
      }
      try {
        setIsLoadingDetail(true);
        const preloadedDetail = locationState?.preloadedRevisionDetail;
        const isSnapshotPreload = isRevisionDetailSnapshotPreload(locationState, revisionId);
        const detail =
          preloadedDetail?.id === revisionId &&
          typeof preloadedDetail.workingNotesEditable === "boolean"
            ? preloadedDetail
            : await documentApi.getRevisionById(revisionId);
        if (!mounted) return;
        setDocument({
          ...detail,
          reviewers: detail.reviewers || [],
          approvers: detail.approvers || [],
          reviewFlowType: "parallel",
          currentReviewerIndex: 0,
        });

        await loadRevisionPreview(detail);

        // Don't block the page render on the PDF regeneration round-trip (can take 15-20s) —
        // show the page immediately with the Document tab's own "generating" state, and patch
        // in the finished snapshot in the background once ready.
        pollSnapshotInBackground({
          detail,
          fetchLive: () => documentApi.getRevisionById(revisionId),
          onUpdate: (resolvedDetail) => {
            if (!mounted) return;
            setDocument({
              ...resolvedDetail,
              reviewers: resolvedDetail.reviewers || [],
              approvers: resolvedDetail.approvers || [],
              reviewFlowType: "parallel",
              currentReviewerIndex: 0,
            });
            void loadRevisionPreview(resolvedDetail);
          },
        });

        void refreshDetailAfterSnapshot({
          enabled: isSnapshotPreload,
          fetchLive: () => documentApi.getRevisionById(revisionId),
          onSuccess: (freshDetail) => {
            if (!mounted) {
              return;
            }
            setDocument({
              ...freshDetail,
              reviewers: freshDetail.reviewers || [],
              approvers: freshDetail.approvers || [],
              reviewFlowType: "parallel",
              currentReviewerIndex: 0,
            });
            void loadRevisionPreview(freshDetail);
          },
        });
      } catch (error) {
        console.error("Failed to load revision for review", error);
        if (mounted) {
          setPreviewStatus("error");
          setPreviewMessage("Failed to load revision preview metadata.");
        }
      } finally {
        if (mounted) {
          setIsLoadingDetail(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [revisionId, locationState?.preloadedRevisionDetail, locationState?.preloadedRevisionDetailSnapshot, loadRevisionPreview]);

  // Keep the Document-tab PDF preview in step with edits saved from OnlyOffice: the backend
  // regenerates the snapshot after each reviewer/approver save, so poll the revision while the
  // tab is open and reload the preview whenever its version token or snapshot state changes.
  const lastPreviewSignatureRef = React.useRef<string>("");
  useEffect(() => {
    if (activeTab !== "document") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const live = await documentApi.getRevisionById(revisionId);
        if (cancelled || !live) return;
        const signature = `${resolveRevisionPreviewVersionToken(live)}|${live.snapshotStatus ?? ""}|${live.previewStatus ?? ""}`;
        if (lastPreviewSignatureRef.current && lastPreviewSignatureRef.current !== signature) {
          void loadRevisionPreview(live);
        }
        lastPreviewSignatureRef.current = signature;
      } catch {
        // transient poll failure -- next tick retries
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTab, revisionId, loadRevisionPreview]);

  useEffect(() => {
    let mounted = true;

    const loadAuditTrail = async () => {
      if (!document?.id) {
        setAuditTrailRows([]);
        return;
      }

      try {
        const response = await auditTrailApi.getByEntity("Revision", document.id);
        if (!mounted) return;
        const rows = Array.isArray(response) ? response : (response as any)?.data || [];
        setAuditTrailRows(rows);
      } catch {
        if (!mounted) return;
        setAuditTrailRows([]);
      }
    };

    void loadAuditTrail();

    return () => {
      mounted = false;
    };
  }, [document?.id]);

  const loadReviewComments = React.useCallback(async () => {
    // PDF-anchored comments are retired. Review evidence is now maintained in the
    // controlled Word Online collaboration file, not in a second internal layer.
    setReviewComments([]);
    setCurrentReviewRound(1);
  }, []);

  useEffect(() => {
    void loadReviewComments();
  }, [loadReviewComments]);

  const handleAddReviewComment = async (pageNumber: number, positionX: number, positionY: number, width: number, height: number, content: string, attachments: File[]) => {
    if (!revisionId) return;
    try {
      const comment = await documentApi.addRevisionReviewComment(revisionId, { pageNumber, positionX, positionY, width, height, content });
      for (const file of attachments) {
        await documentApi.uploadRevisionReviewCommentAttachment(revisionId, comment.id, file);
      }
      await loadReviewComments();
    } catch (error) {
      showToast({ type: "error", title: "Unable to add comment", message: (error as any)?.response?.data?.message || "Please try again.", duration: 3000 });
    }
  };

  const handleResolveReviewComment = async (commentId: string, resolutionNote?: string) => {
    if (!revisionId) return;
    try {
      await documentApi.resolveRevisionReviewComment(revisionId, commentId, resolutionNote);
      await loadReviewComments();
    } catch (error) {
      showToast({ type: "error", title: "Unable to resolve comment", message: (error as any)?.response?.data?.message || "Please try again.", duration: 3000 });
    }
  };

  const handleReplyToReviewComment = async (commentId: string, content: string, attachments: File[]) => {
    if (!revisionId) return;
    try {
      const updatedComment = await documentApi.replyToRevisionReviewComment(revisionId, commentId, content);
      const newReplyId = updatedComment.replies[updatedComment.replies.length - 1]?.id;
      if (newReplyId) {
        for (const file of attachments) {
          await documentApi.uploadRevisionReviewCommentReplyAttachment(revisionId, commentId, newReplyId, file);
        }
      }
      await loadReviewComments();
    } catch (error) {
      showToast({ type: "error", title: "Unable to send reply", message: (error as any)?.response?.data?.message || "Please try again.", duration: 3000 });
    }
  };

  const handleDeleteReviewComment = async (commentId: string, reason: string) => {
    if (!revisionId) return;
    try {
      await documentApi.deleteRevisionReviewComment(revisionId, commentId, reason);
      await loadReviewComments();
    } catch (error) {
      showToast({ type: "error", title: "Unable to delete comment", message: (error as any)?.response?.data?.message || "Please try again.", duration: 3000 });
    }
  };
  const handleEditReviewComment = async (commentId: string, content: string) => { if (revisionId) { await documentApi.updateRevisionReviewComment(revisionId, commentId, content); await loadReviewComments(); } };
  const handleEditReviewReply = async (commentId: string, replyId: string, content: string) => { if (revisionId) { await documentApi.updateRevisionReviewCommentReply(revisionId, commentId, replyId, content); await loadReviewComments(); } };
  const handleDeleteReviewReply = async (commentId: string, replyId: string, reason: string) => { if (revisionId) { await documentApi.deleteRevisionReviewCommentReply(revisionId, commentId, replyId, reason); await loadReviewComments(); } };

  const handleBack = () => {
    setIsNavigating(true);
    onBack();
  };

  // The server capability is the workflow authority. Do not add a stale detail-payload
  // flag as a second gate after navigation/preloading.
  const canReview = !revisionActionCapabilities.loading
    && revisionActionCapabilities.can("completeReview");
  const canRejectReview = !revisionActionCapabilities.loading
    && revisionActionCapabilities.can("rejectReview");
  const canActOnReview = canReview || canRejectReview;


  const handleApprove = () => {
    setESignAction("approve");
    setShowESignModal(true);
  };

  const handleReject = () => {
    setESignAction("reject");
    setShowRejectWarning(true);
  };

  const handleRejectWarningConfirm = () => {
    setShowRejectWarning(false);
    setShowESignModal(true);
  };

  const handleESignConfirm = async (signature: {
    username: string;
    password: string;
    reason: string;
    signatureToken?: string;
  }) => {
    if (!revisionId) return;

    setIsSubmitting(true);
    setShowESignModal(false);

    try {
      const reason = signature.reason;
      const payload = {
        comment: reason,
        reason,
        signatureToken: signature.signatureToken,
      };

      const refreshed =
        eSignAction === "approve"
          ? await documentApi.completeRevisionReview(revisionId, payload)
          : await documentApi.rejectRevisionReview(revisionId, payload);

      const latest = await documentApi.getRevisionByIdSnapshot(revisionId, { force: true }).catch(() => refreshed);
      const nextRevision = {
        ...latest,
        reviewers: latest.reviewers || [],
        approvers: latest.approvers || [],
        reviewFlowType: "parallel",
        currentReviewerIndex: 0,
      };
      setDocument(nextRevision);
      setShowESignModal(false);
      void loadReviewComments();
      const revisionLabel =
        [refreshed.documentNumber, refreshed.revisionNumber].filter(Boolean).join(" ") ||
        "the revision";
      showToast({
        type: eSignAction === "approve" ? "success" : "warning",
        title: eSignAction === "approve" ? "Review Completed" : "Review Rejected",
        message:
          eSignAction === "approve"
            ? `Revision ${revisionLabel} has been reviewed successfully.`
            : `Revision ${revisionLabel} has been rejected and returned to Draft.`,
        duration: 3000,
      });
      window.sessionStorage.setItem("eqms.documents.revisions.refresh", String(Date.now()));
      setIsNavigating(true);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      navigate(`/documents/revisions/${revisionId}`, {
        state: buildRevisionDetailNavigationState({
          from: ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW,
          returnTo: ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW,
          parentDocumentId: latest.documentId || undefined,
          sourceRevisionId: latest.id,
          detail: latest,
        }),
      });
    } catch (error) {
      console.error("Failed to complete review action", error);
      showToast({
        type: "error",
        title: eSignAction === "approve" ? "Review failed" : "Reject failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          (error as Error)?.message ||
          "Failed to complete review action.",
        duration: 3000,
      });
      setPreviewStatus("error");
      setPreviewMessage(
        (error as any)?.response?.data?.error?.message ||
        (error as any)?.response?.data?.message ||
        (error as Error)?.message ||
        "Failed to complete review action."
      );
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddWorkingNote = async (content: string) => {
    if (!revisionId) return;
    setIsWorkingNotesSubmitting(true);
    try {
      const note = await documentApi.addRevisionWorkingNote(revisionId, content);
      setDocument((prev: any) =>
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
        message: (error as any)?.response?.data?.message || "Working note could not be saved.",
        duration: 3000,
      });
    } finally {
      setIsWorkingNotesSubmitting(false);
    }
  };

  const handleDeleteWorkingNote = async (noteId: string) => {
    if (!revisionId) return;
    setIsWorkingNotesSubmitting(true);
    try {
      await documentApi.deleteRevisionWorkingNote(revisionId, noteId);
      setDocument((prev: any) =>
        prev
          ? {
              ...prev,
              workingNotes: (prev.workingNotes ?? []).filter((note: any) => note.id !== noteId),
            }
          : prev,
      );
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to delete note",
        message: (error as any)?.response?.data?.message || "Working note could not be deleted.",
        duration: 3000,
      });
    } finally {
      setIsWorkingNotesSubmitting(false);
    }
  };

  // Review-snapshot generation/retry is now fully server-side (RevisionSnapshotAsyncService +
  // RevisionSnapshotRetryScheduler) -- there is no manual "Retry Snapshot" action any more. The
  // Approve/Reject actions still wait for a ready snapshot; "Open File to Comment" (Word Online)
  // stays available regardless, so reviewers are never blocked from viewing the source content.

  // Status workflow steps
  const statusSteps: DocumentStatus[] = [
    "Draft",
    "Pending Review",
    "Pending Approval",
    "Pending Training",
    "Ready for Publishing",
    "Effective",
    "Obsoleted",
    "Closed - Cancelled",
  ];

  // Breadcrumbs
  const breadcrumbs = revisionReview(
    navigate,
    locationState?.workspaceState?.from ||
      locationState?.workspaceState?.returnTo ||
      locationState?.workspaceState?.workspaceReturnPath,
  );
  const toggleCommentHistory = () => {
    if (commentHistoryOpen) {
      setCommentHistoryOpen(false);
      return;
    }
    setActiveTab("document");
    setCommentHistoryOpen(true);
  };

  if (isLoadingDetail && !document) {
    return <FullPageLoading text="Loading..." />;
  }

  return (
    <>
      {(isNavigating || isLoadingDetail) && <FullPageLoading text="Loading..." />}
      <DocumentWorkflowLayout
        title="Review Revision"
        breadcrumbs={breadcrumbs}
        onBack={handleBack}
        statusSteps={statusSteps}
        currentStatus={document?.status || "Draft"}
        skippedSteps={skippedSteps}
        terminalProgressStep={terminalProgressStep}
        tabs={DEFAULT_WORKFLOW_TABS}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
        headerActions={
          canActOnReview ? (
            <>
              {canRejectReview && <Button onClick={handleReject} variant="outline-emerald" size="sm" disabled={isSubmitting} className="whitespace-nowrap">Reject</Button>}
              {canReview && <Button onClick={handleApprove} variant="outline-emerald" size="sm" disabled={isSubmitting} className="whitespace-nowrap">Complete Review</Button>}
            </>
          ) : undefined
        }
        footerActions={
          <>
            <Button onClick={handleBack} variant="outline-emerald" size="sm" className="whitespace-nowrap">
              Back
            </Button>
            {canActOnReview && (
              <>
          <Button onClick={handleOpenWordReview} variant="outline-emerald" size="sm" loading={isOpeningWordReview} loadingText="Opening Word Online…" className="whitespace-nowrap">
                  Open File to Comment
                </Button>
                {canRejectReview && <Button onClick={handleReject} variant="outline-emerald" size="sm" disabled={isSubmitting} className="whitespace-nowrap">Reject</Button>}
                {canReview && <Button onClick={handleApprove} variant="outline-emerald" size="sm" disabled={isSubmitting} className="whitespace-nowrap">Complete Review</Button>}
              </>
            )}
          </>
        }
        afterTabContent={
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
            <TabNav tabs={[{ id: "originalDocument", label: "Document Master" }]} activeTab="originalDocument" onChange={() => { }} />
            <div className="p-4 md:p-5 min-h-0">
              <OriginalDocumentTab
                document={currentRevision?.originalDocument ?? null}
                returnTo={`${location.pathname}${location.search}`}
              />
            </div>
          </div>
        }
      >
        {activeTab === "document" && (
          <div className="space-y-4 md:space-y-6">
            <div className="min-h-0 overflow-hidden px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
              <DocumentTab
                documentFile={revisionFile}
                liveViewRevisionId={isLiveViewStage(document) ? revisionId : null}
                previewStatus={previewStatus}
                previewMessage={previewMessage}
                revisionId={revisionId}
          workspaceAction={null}
              />
            </div>
          </div>
        )}
        {activeTab === "general" && (
          currentRevision ? (
            <GeneralInformationTab
                document={{
                  documentNumber: currentRevision.documentNumber || "",
                  documentName: currentRevision.documentName || "",
                  revisionNumber: currentRevision.revisionNumber || "",
                  revisionName: currentRevision.revisionName || "",
                created: currentRevision.created || "",
                openedBy: currentRevision.openedBy || "",
                author: currentRevision.author || "",
                coAuthors: (currentRevision.coAuthors || []).map((item: any) => item.fullName),
                isTemplate: currentRevision.isTemplate || false,
                type: currentRevision.type || "",
                subType: currentRevision.subType || "",
                effectiveDate: currentRevision.effectiveDate,
                validUntil: currentRevision.validUntil,
                businessUnit: currentRevision.businessUnit || "",
                department: currentRevision.department || "",
                knowledgeBase: currentRevision.knowledgeBase || "",
                periodicReviewCycle: currentRevision.periodicReviewCycle || 0,
                periodicReviewNotification: currentRevision.periodicReviewNotification || 0,
                language: currentRevision.language || "",
                description: currentRevision.description || "",
                titleLocalLanguage: currentRevision.titleLocalLanguage || "",
              }}
              isReadOnly={true}
            />
          ) : null
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
        {activeTab === "documentInfo" && currentRevision && (
          <InfoFromDocumentTab
              documentCode={currentRevision.originalDocument?.documentNumber || currentRevision.documentNumber || ""}
              documentName={currentRevision.originalDocument?.documentName || currentRevision.documentName || ""}
              displayName={currentRevision.displayName || ""}
              documentCreated={currentRevision.originalDocument?.created || currentRevision.created || ""}
            />
        )}
        {activeTab === "training" && (
          <TrainingInformationTab
            isReadOnly
            isTemplate={Boolean(currentRevision?.isTemplate)}
            data={{
              trainingPlannedDate: currentRevision?.trainingPlannedDate,
              trainingPeriodEndDate: currentRevision?.trainingPeriodEndDate,
              trainingCompletionDate: currentRevision?.trainingCompletionDate,
            }}
          />
        )}
        {activeTab === "reviewers" && <RevisionWorkspaceReviewersTab reviewers={document?.reviewers || []} />}
        {activeTab === "approvers" && <RevisionWorkspaceApproversTab approvers={document?.approvers || []} />}
        {activeTab === "signatures" && <SignaturesTab records={signatureRecords} />}
        {activeTab === "audit" && <AuditTrailTab entityId={document?.id} entityType="Revision" />}

        {/* Reject Warning Modal */}
        <AlertModal
          isOpen={showRejectWarning}
          onClose={() => setShowRejectWarning(false)}
          onConfirm={handleRejectWarningConfirm}
          type="warning"
          title="Reject Revision?"
          description="When rejecting this revision at Pending Review stage, the document will return to Draft status. Are you sure you want to continue?"
        />

        {/* E-Signature Modal */}
        <ESignatureModal
          isOpen={showESignModal}
          onClose={() => setShowESignModal(false)}
          onConfirm={handleESignConfirm}
          actionTitle={
            eSignAction === "approve"
              ? "Complete Review"
              : "Reject"
          }
          meaningDisplayName={eSignAction === "approve" ? "Reviewed" : "Rejected"}
          meaningCode={eSignAction === "approve" ? "REVIEWED" : "REJECTED"}
          changes={[{
            action: "Update Status",
            oldValue: "Pending Review",
            newValue: eSignAction === "approve"
              ? ((currentRevision?.approvers?.length ?? 0) > 0
                  ? "Pending Approval"
                  : (currentRevision?.requiresTraining ? "Pending Training" : "Ready for Publishing"))
              : "Draft",
            category: "status",
          }]}
          targetDetails={{
            code: currentRevision?.documentNumber || "",
            title: currentRevision?.documentName || "",
            revision: currentRevision?.revisionNumber || "",
          }}
        />
      </DocumentWorkflowLayout>
    </>
  );
};
