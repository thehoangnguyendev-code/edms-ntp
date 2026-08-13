import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { revisionTraining } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { OriginalDocumentTab } from "@/features/documents/document-revisions/workspace-tabs";
import { ROUTES } from "@/app/routes.constants";
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
import type { RevisionDetailResponse } from "@/features/documents/document-revisions/detail-revision/types";
import { buildRevisionSignatureRecords, type SignatureTabRecord } from "@/features/documents/document-revisions/shared/signatureRecords";
import { hasWorkingNotesEditAccess } from "@/features/documents/document-revisions/shared/workingNotesPermissions";
import { buildRevisionDetailSnapshotState, isRevisionDetailSnapshotPreload, refreshDetailAfterSnapshot, isSnapshotGenerating, pollSnapshotInBackground } from "@/features/documents/shared/detailSnapshotHelpers";
import type { TrainingInformationValue } from "@/features/documents/document-revisions/shared/components/TrainingInformationTab";
import { resolveTerminalProgressStep } from "@/features/documents/shared/statusMapping";
import type { RevisionWorkspaceState } from "@/features/documents/shared/navigationContext";
import { buildRevisionDetailNavigationState } from "@/features/documents/shared/navigationContext";
import { useRevisionActionCapabilities } from "@/hooks/useRevisionActionCapabilities";
import { useAuth } from "@/contexts/AuthContext";
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
const WORKSPACE_TABS: TabType[] = [
  "document",
  "general",
  "workingNotes",
  "documentInfo",
  "infoFromDocument",
  "training",
  "reviewers",
  "approvers",
  "signatures",
  "audit",
];

const resolveInitialTab = (tab?: unknown): TabType => {
  if (typeof tab !== "string") {
    return "general";
  }
  return WORKSPACE_TABS.includes(tab as TabType) ? (tab as TabType) : "general";
};

const validateTrainingInfo = (value: TrainingInformationValue, canEditTrainingDates: boolean) => {
  const errors: { trainingPlannedDate?: string } = {};
  if (!canEditTrainingDates) {
    return errors;
  }

  if (!value.trainingPlannedDate?.trim()) {
    errors.trainingPlannedDate = "Training Planned Date is required.";
  }

  return errors;
};

interface RevisionTrainingViewProps {
  revisionId: string;
  onBack: () => void;
}

export const RevisionTrainingView: React.FC<RevisionTrainingViewProps> = ({
  revisionId,
  onBack,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as {
    preloadedRevisionDetail?: RevisionDetailResponse;
    preloadedRevisionDetailSnapshot?: boolean;
    workspaceState?: RevisionWorkspaceState | null;
  } | undefined;
  const { showToast } = useToast();
  const { user } = useAuth();
  const [document, setDocument] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [signatureRows, setSignatureRows] = useState<SignatureTabRecord[]>([]);
  const [auditTrailRows, setAuditTrailRows] = useState<any[]>([]);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWorkingNotesSubmitting, setIsWorkingNotesSubmitting] = useState(false);
  const [trainingInfo, setTrainingInfo] = useState<TrainingInformationValue>({
    trainingPlannedDate: "",
    trainingPeriodEndDate: "",
    trainingCompletionDate: "",
    trainingPeriodDays: null,
  });
  const [activeTab, setActiveTab] = useState<TabType>(
    resolveInitialTab(locationState?.workspaceState?.activeTab),
  );
  const [showESignModal, setShowESignModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [trainingSubmitValidationToken, setTrainingSubmitValidationToken] = useState(0);
  const revisionActionCapabilities = useRevisionActionCapabilities(document?.id ?? revisionId ?? null);
  const canEditWorkingNotes = React.useMemo(
    () =>
      hasWorkingNotesEditAccess(
        user,
        document?.reviewers,
        document?.approvers,
        document?.author,
        document?.coAuthors,
        document?.workingNotesEditable,
      ),
    [
      user,
      document?.reviewers,
      document?.approvers,
      document?.author,
      document?.coAuthors,
      document?.workingNotesEditable,
    ],
  );
  const skippedSteps = document?.requiresTraining ? [] : (["Pending Training"] as const);
  const terminalProgressStep = resolveTerminalProgressStep(document?.status, document?.history ?? []);

  const loadRevisionPreview = React.useCallback(
    async (detail: RevisionDetailResponse | null | undefined) => {
      if (!detail) {
        setRevisionFile(null);
        setPreviewStatus("idle");
        setPreviewMessage("PDF preview is not available yet.");
        return;
      }

      const serverPreviewStatus = String(detail.previewStatus || "").toUpperCase();
      const canRequestPreview = isRevisionPdfPreviewType(detail.previewType)
        && (serverPreviewStatus === "READY" || !serverPreviewStatus);
      if (!canRequestPreview) {
        setRevisionFile(null);
        setPreviewStatus(isSnapshotGenerating(detail.snapshotStatus) || serverPreviewStatus === "GENERATING" ? "loading" : "idle");
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
        setDocument({
          ...detail,
          reviewers: detail.reviewers || [],
          approvers: detail.approvers || [],
        });
        setTrainingInfo({
          trainingPlannedDate: detail.trainingPlannedDate || "",
          trainingPeriodEndDate: detail.trainingPeriodEndDate || "",
          trainingCompletionDate: detail.trainingCompletionDate || "",
          trainingPeriodDays: detail.trainingPeriodDays ?? null,
        });
        setSignatureRows(buildRevisionSignatureRecords(detail));
        await loadRevisionPreview(detail);

        // Don't block the page render on the PDF regeneration round-trip (can take 15-20s) —
        // render immediately with the Document tab's own "generating" state, and patch in the
        // finished snapshot in the background once ready.
        pollSnapshotInBackground({
          detail,
          fetchLive: () => documentApi.getRevisionById(revisionId),
          onUpdate: (resolvedDetail) => {
            if (!mounted) return;
            setDocument({
              ...resolvedDetail,
              reviewers: resolvedDetail.reviewers || [],
              approvers: resolvedDetail.approvers || [],
            });
            setTrainingInfo({
              trainingPlannedDate: resolvedDetail.trainingPlannedDate || "",
              trainingPeriodEndDate: resolvedDetail.trainingPeriodEndDate || "",
              trainingCompletionDate: resolvedDetail.trainingCompletionDate || "",
              trainingPeriodDays: resolvedDetail.trainingPeriodDays ?? null,
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
            setDocument({
              ...freshDetail,
              reviewers: freshDetail.reviewers || [],
              approvers: freshDetail.approvers || [],
            });
            setTrainingInfo({
              trainingPlannedDate: freshDetail.trainingPlannedDate || "",
              trainingPeriodEndDate: freshDetail.trainingPeriodEndDate || "",
              trainingCompletionDate: freshDetail.trainingCompletionDate || "",
              trainingPeriodDays: freshDetail.trainingPeriodDays ?? null,
            });
            setSignatureRows(buildRevisionSignatureRecords(freshDetail));
            void loadRevisionPreview(freshDetail);
          },
        });
      } catch (error) {
        console.error("Failed to load revision for training", error);
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
    setActiveTab(resolveInitialTab(locationState?.workspaceState?.activeTab));
  }, [locationState?.workspaceState?.activeTab]);

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

  const handleBack = () => {
    setIsNavigating(true);
    onBack();
  };

  const handleCompleteTraining = () => {
    if (!canEditTrainingDates) return;
    const errs = validateTrainingInfo(trainingInfo, canEditTrainingDates);
    if (Object.keys(errs).length > 0) {
      setTrainingSubmitValidationToken((prev) => prev + 1);
      showToast({
        type: "error",
        title: "Training information is incomplete",
        message: errs.trainingPlannedDate || "Please correct the training information before signing.",
        duration: 3000,
      });
      return;
    }
    setShowESignModal(true);
  };

  const canCompleteTraining = !revisionActionCapabilities.loading
    && Boolean(document?.status === "Pending Training")
    && revisionActionCapabilities.can("completeTraining");
  const canEditTrainingDates = document?.status === "Pending Training" && canCompleteTraining;

  const handleESignConfirm = async (signature: {
    username: string;
    password: string;
    reason: string;
    signatureToken?: string;
  }) => {
    setIsSubmitting(true);
    setShowESignModal(false);
    try {
      const refreshed = await documentApi.completeRevisionTraining(revisionId, {
        comment: signature.reason,
        reason: signature.reason,
        signatureToken: signature.signatureToken,
        trainingPlannedDate: trainingInfo.trainingPlannedDate || undefined,
        trainingPeriodEndDate: trainingInfo.trainingPeriodEndDate || undefined,
        trainingCompletionDate: trainingInfo.trainingCompletionDate || undefined,
      });
      setDocument({
        ...refreshed,
        reviewers: refreshed.reviewers || [],
        approvers: refreshed.approvers || [],
      });

      showToast({
        type: "success",
        title: "Training Completed",
        message: `Revision ${refreshed.documentNumber} ${refreshed.revisionNumber} training has been completed successfully.`,
        duration: 3000
      });

      window.sessionStorage.setItem("eqms.documents.revisions.refresh", String(Date.now()));
      setIsNavigating(true);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      // Propagate the return target the user actually arrived with (e.g. the pending-training
      // list) — do NOT point it back at this Training screen's own URL. Once training is
      // completed the revision moves past this stage, so "Back" from any later screen (the
      // detail view, then Publish, then Effective) must not loop back here.
      const incomingReturnTarget =
        locationState?.workspaceState?.from ||
        locationState?.workspaceState?.returnTo ||
        locationState?.workspaceState?.workspaceReturnPath ||
        ROUTES.DOCUMENTS.REVISIONS.ALL;
      navigate(ROUTES.DOCUMENTS.REVISIONS.DETAIL(revisionId), {
        state: buildRevisionDetailNavigationState({
          from: incomingReturnTarget,
          returnTo: incomingReturnTarget,
          parentDocumentId: refreshed.documentId || undefined,
          sourceRevisionId: refreshed.id,
          detail: refreshed,
        }),
      });
    } catch (error) {
      console.error("Failed to complete training action", error);
      showToast({
        type: "error",
        title: "Training failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          (error as Error)?.message ||
          "Failed to complete training action.",
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
  const breadcrumbs = revisionTraining(
    navigate,
    locationState?.workspaceState?.from ||
      locationState?.workspaceState?.returnTo ||
      locationState?.workspaceState?.workspaceReturnPath,
  );

  if (isLoadingDetail && !document) {
    return <FullPageLoading text="Loading..." />;
  }

  return (
    <>
      {(isNavigating || isLoadingDetail) && <FullPageLoading text="Loading..." />}
      <DocumentWorkflowLayout
        title="Training Revision"
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
          canEditTrainingDates ? (
            <Button
              onClick={handleCompleteTraining}
              variant="outline-emerald"
              size="sm"
              disabled={isSubmitting}
              className="whitespace-nowrap"
            >
              Complete Training
            </Button>
          ) : undefined
        }
        footerActions={
          <>
            <Button
              onClick={handleBack}
              variant="outline-emerald"
              size="sm"
              className="whitespace-nowrap"
            >
              Back
            </Button>
            {canEditTrainingDates && (
              <Button
                onClick={handleCompleteTraining}
                variant="outline-emerald"
                size="sm"
                disabled={isSubmitting}
                className="whitespace-nowrap"
              >
                Complete Training
              </Button>
            )}
          </>
        }
        afterTabContent={
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
            <TabNav tabs={[{ id: "originalDocument", label: "Document Master" }]} activeTab="originalDocument" onChange={() => { }} />
            <div className="p-4 md:p-5 min-h-0">
              <OriginalDocumentTab
                document={document?.originalDocument ?? null}
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
                previewStatus={previewStatus}
                previewMessage={previewMessage}
              />
            </div>
          </div>
        )}
        {activeTab === "general" && (
          <GeneralInformationTab
            document={{
              documentNumber: document.documentNumber,
              documentName: document.documentName,
              type: document.type,
              created: document.created,
              openedBy: document.openedBy,
              author: document.author,
              isTemplate: false,
              businessUnit: document.businessUnit,
              department: document.department,
              knowledgeBase: document.knowledgeBase,
              subType: document.subType,
              periodicReviewCycle: document.periodicReviewCycle,
              periodicReviewNotification: document.periodicReviewNotification,
              language: document.language,
              description: document.description,
              coAuthors: [],
            }}
            isReadOnly={true}
          />
        )}
        {activeTab === "workingNotes" && (
          <WorkingNotesTab
            notes={document?.workingNotes ?? []}
            onAddNote={handleAddWorkingNote}
            onDeleteNote={handleDeleteWorkingNote}
            isSubmitting={isWorkingNotesSubmitting}
            isReadOnly={!canEditWorkingNotes}
          />
        )}
        {activeTab === "documentInfo" && (
          <InfoFromDocumentTab
              documentCode={document?.originalDocument?.documentNumber || document?.documentNumber || ""}
              documentName={document?.originalDocument?.documentName || document?.documentName || ""}
              displayName={document?.displayName || ""}
              documentCreated={document?.originalDocument?.created || document?.created || ""}
            />
        )}
        {activeTab === "training" && (
          <TrainingInformationTab
            isReadOnly={!canEditTrainingDates}
            data={{
              trainingPlannedDate: document?.trainingPlannedDate,
              trainingPeriodEndDate: document?.trainingPeriodEndDate,
              trainingCompletionDate: document?.trainingCompletionDate,
              trainingPeriodDays: document?.trainingPeriodDays ?? null,
            }}
            onChange={(val) => {
              setTrainingInfo(val);
            }}
            canEditPlannedDate={canEditTrainingDates}
            canEditCompletionDate={canEditTrainingDates}
            submitValidationToken={trainingSubmitValidationToken}
          />
        )}
        {activeTab === "reviewers" && <RevisionWorkspaceReviewersTab reviewers={document?.reviewers || []} />}
        {activeTab === "approvers" && <RevisionWorkspaceApproversTab approvers={document?.approvers || []} />}
        {activeTab === "signatures" && <SignaturesTab records={signatureRows as any} />}
        {activeTab === "audit" && <AuditTrailTab entityId={document?.id} entityType="Revision" />}

        {/* E-Signature Modal */}
        <ESignatureModal
          isOpen={showESignModal}
          onClose={() => setShowESignModal(false)}
          onConfirm={handleESignConfirm}
          actionTitle="Sign Off Training"
          targetDetails={{
            code: document?.documentNumber || "",
            title: document?.documentName || "",
            revision: document?.revisionNumber || "",
          }}
        />
      </DocumentWorkflowLayout>
    </>
  );
};
