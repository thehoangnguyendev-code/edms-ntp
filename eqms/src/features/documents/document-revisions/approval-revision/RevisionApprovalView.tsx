import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from '@/app/routes.constants';
import { Button } from '@/components/ui/button/Button';
import { TabNav } from "@/components/ui/tabs/TabNav";
import { ESignatureModal } from '@/components/ui/esign-modal/ESignatureModal';
import { AlertModal } from '@/components/ui/modal/AlertModal';
import { FullPageLoading } from '@/components/ui/loading/Loading';
import { useToast } from '@/components/ui/toast';
import { revisionApproval } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { OriginalDocumentTab } from "@/features/documents/document-revisions/workspace-tabs";
import { isLiveViewStage } from "@/features/documents/shared/liveDocumentView";
import { DocumentWorkflowLayout, DEFAULT_WORKFLOW_TABS } from "@/features/documents/shared/layouts";
import {
    GeneralInformationTab,
    DocumentTab,
    TrainingInformationTab,
    SignaturesTab,
    AuditTrailTab,
    WorkingNotesTab,
    InfoFromDocumentTab,
    RevisionWorkspaceReviewersTab,
    RevisionWorkspaceApproversTab,
} from "@/features/documents/document-revisions/workspace-tabs";
import type { DocumentType, DocumentStatus } from "@/features/documents/types";
import { documentApi } from "@/services/api/documents";
import { auditTrailApi } from "@/services/api/auditTrail";
import type { RevisionDetailResponse, RevisionReviewCommentItem } from "@/features/documents/document-revisions/detail-revision/types";
import { buildRevisionSignatureRecords, type SignatureTabRecord } from "@/features/documents/document-revisions/shared/signatureRecords";
import { hasWorkingNotesEditAccess } from "@/features/documents/document-revisions/shared/workingNotesPermissions";
import { buildRevisionDetailSnapshotState, isRevisionDetailSnapshotPreload, refreshDetailAfterSnapshot, isSnapshotGenerating, pollSnapshotInBackground } from "@/features/documents/shared/detailSnapshotHelpers";
import { buildRevisionDetailNavigationState } from "@/features/documents/shared/navigationContext";
import { resolveTerminalProgressStep } from "@/features/documents/shared/statusMapping";
import type { RevisionWorkspaceState } from "@/features/documents/shared/navigationContext";
import { useRevisionActionCapabilities } from "@/hooks/useRevisionActionCapabilities";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useOfficeOnlineReviewLink } from "@/features/documents/hooks/useOfficeOnlineReviewLink";
import {
  buildRevisionPreviewFileName,
  buildPreviewVersionCacheBuster,
  describeRevisionPreviewUnavailable,
  isRevisionPdfPreviewType,
  loadPdfPreviewFile,
  resolveRevisionPreviewVersionToken,
} from "@/features/documents/shared/previewHelpers";

// --- Types ---
type TabType = "document" | "general" | "workingNotes" | "documentInfo" | "infoFromDocument" | "training" | "reviewers" | "approvers" | "signatures" | "audit";

interface RevisionApprovalViewProps {
    revisionId: string;
    onBack: () => void;
    currentUserId: string;
}

// --- Main Component ---
export const RevisionApprovalView: React.FC<RevisionApprovalViewProps> = ({
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
    const [revision, setRevision] = useState<any>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(true);
    const [signatureRows, setSignatureRows] = useState<SignatureTabRecord[]>([]);
    const [auditTrailRows, setAuditTrailRows] = useState<any[]>([]);
    const [revisionFile, setRevisionFile] = useState<File | null>(null);
    const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [previewMessage, setPreviewMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isWorkingNotesSubmitting, setIsWorkingNotesSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("general");
    const [commentHistoryOpen, setCommentHistoryOpen] = useState(false);
    const [showesignModal, setshowesignModal] = useState(false);
    const [showRejectWarning, setShowRejectWarning] = useState(false);
    const [eSignAction, setESignAction] = useState<'approve' | 'reject'>('approve');
    const [isNavigating, setIsNavigating] = useState(false);
    const [reviewComments, setReviewComments] = useState<RevisionReviewCommentItem[]>([]);
    const [currentReviewRound, setCurrentReviewRound] = useState(1);
    const revisionActionCapabilities = useRevisionActionCapabilities(revision?.id ?? revisionId ?? null);
    // Refresh in place when anyone changes this revision, so status and actions are never stale.
    useEntityChanged(["REVISION"], () => {
        void documentApi.getRevisionByIdSnapshot(revisionId, { force: true }).then((live) => {
            if (!live) return;
            setRevision({ ...live, reviewers: live.reviewers || [], approvers: live.approvers || [] });
            setSignatureRows(buildRevisionSignatureRecords(live));
        }).catch(() => undefined);
    }, { ids: [revisionId] });
    const { isOpeningWordReview, handleOpenWordReview } = useOfficeOnlineReviewLink(revisionId);
    const canEditWorkingNotes = React.useMemo(
        () =>
            hasWorkingNotesEditAccess(
                currentUserId,
                revision?.reviewers,
                revision?.approvers,
                revision?.author,
                revision?.coAuthors,
                revision?.workingNotesEditable,
            ),
        [
            currentUserId,
            revision?.reviewers,
            revision?.approvers,
            revision?.author,
            revision?.coAuthors,
            revision?.workingNotesEditable,
        ],
    );
    const skippedSteps = revision?.requiresTraining ? [] : (["Pending Training"] as const);
    const terminalProgressStep = resolveTerminalProgressStep(revision?.status, revision?.history ?? []);
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
            // previewType/previewStatus alone here would serve the stale prior round's PDF while
            // a resubmission's snapshot is still being regenerated. Must also gate on snapshotStatus.
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
                    buildRevisionPreviewFileName(detail.documentNumber),
                );
                setRevisionFile(file);
                setPreviewStatus("ready");
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
                setRevision({
                    ...detail,
                    reviewers: detail.reviewers || [],
                    approvers: detail.approvers || [],
                });
                setSignatureRows(buildRevisionSignatureRecords(detail));
                await loadRevisionPreview(detail);

                // Don't block the page render on the PDF regeneration round-trip (can take
                // 15-20s) — render immediately with the Document tab's own "generating" state,
                // and patch in the finished snapshot in the background once ready.
                pollSnapshotInBackground({
                    detail,
                    fetchLive: () => documentApi.getRevisionById(revisionId),
                    onUpdate: (resolvedDetail) => {
                        if (!mounted) return;
                        setRevision({
                            ...resolvedDetail,
                            reviewers: resolvedDetail.reviewers || [],
                            approvers: resolvedDetail.approvers || [],
                        });
                        setSignatureRows(buildRevisionSignatureRecords(resolvedDetail));
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
                        setRevision({
                            ...freshDetail,
                            reviewers: freshDetail.reviewers || [],
                            approvers: freshDetail.approvers || [],
                        });
                        setSignatureRows(buildRevisionSignatureRecords(freshDetail));
                        void loadRevisionPreview(freshDetail);
                    },
                });
            } catch (error) {
                console.error("Failed to load revision for approval", error);
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

    useEffect(() => {
        let mounted = true;

        const loadAuditTrail = async () => {
            if (!revision?.id) {
                setAuditTrailRows([]);
                return;
            }

            try {
                const response = await auditTrailApi.getByEntity("Revision", revision.id);
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
    }, [revision?.id]);

    const loadReviewComments = React.useCallback(async () => {
        // The separate PDF comment layer is retired. Controlled review evidence is
        // maintained in the Word Online source collaboration record.
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

    // Server action capabilities are the single workflow authority for this workspace.
    const canApprove = !revisionActionCapabilities.loading
        && revisionActionCapabilities.can("completeApproval");
    const canRejectApproval = !revisionActionCapabilities.loading
        && revisionActionCapabilities.can("rejectApproval");
    const canActOnApproval = canApprove || canRejectApproval;


    const handleApprove = () => {
        setESignAction('approve');
        setshowesignModal(true);
    };

    const handleReject = () => {
        setESignAction('reject');
        setShowRejectWarning(true);
    };

    const handleRejectWarningConfirm = () => {
        setShowRejectWarning(false);
        setshowesignModal(true);
    };

    const handleESignConfirm = async (signature: {
        username: string;
        password: string;
        reason: string;
        signatureToken?: string;
    }) => {
        setIsSubmitting(true);
        setshowesignModal(false);
        try {
            const payload = {
                comment: signature.reason,
                reason: signature.reason,
                signatureToken: signature.signatureToken,
            };
            const refreshed =
                eSignAction === 'approve'
                    ? await documentApi.completeRevisionApproval(revisionId, payload)
                    : await documentApi.rejectRevisionApproval(revisionId, payload);
            const latest = await documentApi.getRevisionByIdSnapshot(revisionId, { force: true }).catch(() => refreshed);
            setRevision({
                ...latest,
                reviewers: latest.reviewers || [],
                approvers: latest.approvers || [],
            });
            void loadReviewComments();

            showToast({
                type: eSignAction === 'approve' ? 'success' : 'warning',
                title: eSignAction === 'approve' ? 'Approved' : 'Rejected',
                message: eSignAction === 'approve'
                    ? `Revision ${refreshed.documentNumber} ${refreshed.revisionNumber} has been approved successfully.`
                    : `Revision ${refreshed.documentNumber} ${refreshed.revisionNumber} has been rejected.`,
                duration: 3000
            });

            window.sessionStorage.setItem("eqms.documents.revisions.refresh", String(Date.now()));
            setIsNavigating(true);
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
            navigate(ROUTES.DOCUMENTS.REVISIONS.DETAIL(revisionId), {
                state: buildRevisionDetailNavigationState({
                    from: ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL,
                    returnTo: ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL,
                    parentDocumentId: latest.documentId || undefined,
                    sourceRevisionId: latest.id,
                    detail: latest,
                }),
            });
        } catch (error) {
            console.error("Failed to complete approval action", error);
            showToast({
                type: "error",
                title: eSignAction === "approve" ? "Approve failed" : "Reject failed",
                message:
                    (error as any)?.response?.data?.error?.message ||
                    (error as any)?.response?.data?.message ||
                    (error as Error)?.message ||
                    "Failed to complete approval action.",
                duration: 3000,
            });
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
            setRevision((prev: any) =>
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
            setRevision((prev: any) =>
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
    // stays available regardless, so approvers are never blocked from viewing the source content.
    const snapshotStatus = revision?.snapshotStatus as string | null | undefined;
    const isSnapshotBlocking = snapshotStatus === "GENERATING" || snapshotStatus === "FAILED";

    // Status workflow steps
    const statusSteps: DocumentStatus[] = ["Draft", "Pending Review", "Pending Approval", "Pending Training", "Ready for Publishing", "Effective", "Obsoleted", "Closed - Cancelled"];

    // Breadcrumbs
    const breadcrumbs = revisionApproval(
        navigate,
        locationState?.workspaceState?.from ||
            locationState?.workspaceState?.returnTo ||
            locationState?.workspaceState?.workspaceReturnPath,
    );

    if (isLoadingDetail && !revision) {
        return <FullPageLoading text="Loading..." />;
    }
    const toggleCommentHistory = () => {
        if (commentHistoryOpen) {
            setCommentHistoryOpen(false);
            return;
        }
        setActiveTab("document");
        setCommentHistoryOpen(true);
    };

    return (
        <>
            {(isNavigating || isLoadingDetail) && <FullPageLoading text="Loading..." />}
            <DocumentWorkflowLayout
                title="Approve Revision"
                breadcrumbs={breadcrumbs}
                onBack={handleBack}
                statusSteps={statusSteps}
                currentStatus={revision?.status || "Draft"}
                skippedSteps={skippedSteps}
                terminalProgressStep={terminalProgressStep}
                tabs={DEFAULT_WORKFLOW_TABS}
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab as TabType)}
                headerActions={
                    canActOnApproval ? (
                        <>
                            {isSnapshotBlocking && (
                                <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${snapshotStatus === "GENERATING" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                    {snapshotStatus === "GENERATING" ? "⏳ Snapshot generating…" : "⚠ Snapshot generation retrying automatically…"}
                                </span>
                            )}
                            {canRejectApproval && <Button onClick={handleReject} variant="outline-emerald" size="sm" disabled={isSubmitting || isSnapshotBlocking} className="whitespace-nowrap">Reject</Button>}
                            {canApprove && <Button onClick={handleApprove} variant="outline-emerald" size="sm" disabled={isSubmitting || isSnapshotBlocking} className="whitespace-nowrap">Complete Approval</Button>}
                        </>
                    ) : undefined
                }
                footerActions={
                    <>
                        <Button onClick={handleBack} variant="outline-emerald" size="sm" className="whitespace-nowrap">
                            Back
                        </Button>
                        {isSnapshotBlocking && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${snapshotStatus === "GENERATING" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                {snapshotStatus === "GENERATING" ? "⏳ Generating PDF snapshot…" : "⚠ Snapshot generation retrying automatically…"}
                            </span>
                        )}
                        {canActOnApproval && (
                            <>
                    <Button onClick={handleOpenWordReview} variant="outline-emerald" size="sm" loading={isOpeningWordReview} loadingText="Opening Word Online…" className="whitespace-nowrap">
                                    Open File to Comment
                                </Button>
                                {canRejectApproval && <Button onClick={handleReject} variant="outline-emerald" size="sm" disabled={isSubmitting || isSnapshotBlocking} className="whitespace-nowrap">Reject</Button>}
                                {canApprove && <Button onClick={handleApprove} variant="outline-emerald" size="sm" disabled={isSubmitting || isSnapshotBlocking} className="whitespace-nowrap">Complete Approval</Button>}
                            </>
                        )}
                    </>
                }
                afterTabContent={
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                        <TabNav tabs={[{ id: "originalDocument", label: "Document Master" }]} activeTab="originalDocument" onChange={() => { }} />
                        <div className="p-4 md:p-5 min-h-0">
                            <OriginalDocumentTab
                                document={revision?.originalDocument ?? null}
                                returnTo={`${location.pathname}${location.search}`}
                            />
                        </div>
                    </div>
                }
            >
                {activeTab === "document" && (
                    <div className="space-y-4 md:space-y-6">
                        <div className="min-h-0 overflow-hidden">
                            <DocumentTab
                                documentFile={revisionFile}
                                liveViewRevisionId={isLiveViewStage(revision) ? revisionId : null}
                                previewStatus={previewStatus}
                                previewMessage={previewMessage}
                                revisionId={revisionId}
          workspaceAction={null}
                            />
                        </div>
                    </div>
                )}
                {activeTab === "general" && (
                    <GeneralInformationTab
                        document={{
                              documentNumber: revision?.documentNumber || "",
                              documentName: revision?.documentName || "",
                              revisionNumber: revision?.revisionNumber || "",
                              revisionName: revision?.revisionName || "",
                            created: revision?.created || "",
                            openedBy: revision?.openedBy || "",
                            author: revision?.author || "",
                            coAuthors: (revision?.coAuthors || []).map((item: any) => item.fullName),
                            businessUnit: revision?.businessUnit || "",
                            department: revision?.department || "",
                            knowledgeBase: revision?.knowledgeBase || "",
                            subType: revision?.subType || "",
                            periodicReviewCycle: revision?.periodicReviewCycle || 0,
                            periodicReviewNotification: revision?.periodicReviewNotification || 0,
                            language: revision?.language || "",
                            description: revision?.description || "",
                            titleLocalLanguage: revision?.titleLocalLanguage || "",
                            isTemplate: Boolean(revision?.isTemplate),
                            // No made-up default: showing "SOP" for a revision whose type is unknown would misstate the record.
                            type: (revision?.type || "") as DocumentType,
                            effectiveDate: revision?.effectiveDate,
                            validUntil: revision?.validUntil,
                        }}
                        isReadOnly
                    />
                )}
                {activeTab === "workingNotes" && (
                    <WorkingNotesTab
                        notes={revision?.workingNotes ?? []}
                        onAddNote={handleAddWorkingNote}
                        onDeleteNote={handleDeleteWorkingNote}
                        isSubmitting={isWorkingNotesSubmitting}
                        isReadOnly={!canEditWorkingNotes}
                    />
                )}
        {activeTab === "documentInfo" && (
            <InfoFromDocumentTab
                  documentCode={revision?.originalDocument?.documentNumber || revision?.documentNumber || ""}
                  documentName={revision?.originalDocument?.documentName || revision?.documentName || ""}
                  displayName={revision?.displayName || ""}
                  documentCreated={revision?.originalDocument?.created || revision?.created || ""}
              />
        )}
                {activeTab === "training" && (
                    <TrainingInformationTab
                        isReadOnly
                        isTemplate={Boolean(revision?.isTemplate)}
                        data={{
                            trainingPlannedDate: revision?.trainingPlannedDate,
                            trainingPeriodEndDate: revision?.trainingPeriodEndDate,
                            trainingCompletionDate: revision?.trainingCompletionDate,
                        }}
                    />
                )}
        {activeTab === "reviewers" && <RevisionWorkspaceReviewersTab reviewers={revision?.reviewers || []} />}
        {activeTab === "approvers" && <RevisionWorkspaceApproversTab approvers={revision?.approvers || []} />}
        {activeTab === "signatures" && <SignaturesTab records={signatureRows as any} />}
        {activeTab === "audit" && <AuditTrailTab entityId={revision?.id} entityType="Revision" />}

                {/* Reject Warning Modal */}
                <AlertModal
                    isOpen={showRejectWarning}
                    onClose={() => setShowRejectWarning(false)}
                    onConfirm={handleRejectWarningConfirm}
                    type="warning"
                    title="Reject Revision"
                    description="When rejecting this revision at Pending Approval stage, the document will return to Draft status. Are you sure you want to continue?"
                />

                {/* E-Signature Modal */}
                <ESignatureModal
                    isOpen={showesignModal}
                    onClose={() => setshowesignModal(false)}
                    onConfirm={handleESignConfirm}
                    actionTitle={eSignAction === 'approve' ? 'Complete Approve' : 'Reject'}
                    meaningDisplayName={eSignAction === 'approve' ? 'Approved' : 'Rejected'}
                    meaningCode={eSignAction === 'approve' ? 'APPROVED' : 'REJECTED'}
                    changes={[{
                        action: "Update Status",
                        oldValue: "Pending Approval",
                        newValue: eSignAction === 'approve'
                            ? (revision?.requiresTraining ? "Pending Training" : "Ready for Publishing")
                            : "Draft",
                        category: "status",
                    }]}
                    targetDetails={{
                        code: revision?.documentNumber || "",
                        title: revision?.documentName || "",
                        revision: revision?.revisionNumber || "",
                    }}
                />
            </DocumentWorkflowLayout>
        </>
    );
};
