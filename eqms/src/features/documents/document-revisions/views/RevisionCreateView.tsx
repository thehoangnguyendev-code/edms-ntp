import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useInRouterContext,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { useNavigateWithLoading } from "@/hooks";
import { useDocumentPermissions } from "@/features/documents/shared/useDocumentPermissions";
import { useRevisionActionCapabilities } from "@/hooks/useRevisionActionCapabilities";
import { createRevision } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { ROUTES } from "@/app/routes.constants";
import { documentApi } from "@/services/api/documents";
import {
  buildRevisionDetailNavigationState,
  buildRevisionWorkspaceSourceState,
} from "@/features/documents/shared/navigationContext";
import {
  normalizeRevisionStatusForStepper,
  revisionWorkflowStepIndex,
  REVISION_WORKFLOW_STEPS,
} from "@/features/documents/shared/statusMapping";
import {
  GeneralInformationTab,
  WorkingNotesTab,
  InfoFromDocumentTab,
  TrainingInformationTab,
  SignaturesTab,
  AuditTrailTab,
  DocumentTab,
  OriginalDocumentTab,
  RevisionWorkspaceReviewersTab,
  RevisionWorkspaceApproversTab,
  type GeneralInformationDocumentDetail,
  type TrainingInformationValue,
  type OriginalDocumentInfo,
} from "@/features/documents/document-revisions/workspace-tabs";
import {
  type Reviewer,
  type Approver,
} from "@/features/documents/document-list/document-creation/new-tabs";
import { UploadRevisionModal } from "@/features/documents/document-list/document-creation/UploadRevisionModal";
import type {
  RevisionDetailResponse,
  RevisionPerson,
  RevisionWorkingNoteItem,
  RevisionReviewCommentItem,
} from "@/features/documents/document-revisions/detail-revision/types";
import {
  buildRevisionSignatureRecords,
  type SignatureTabRecord,
} from "@/features/documents/document-revisions/shared/signatureRecords";
import type { RevisionWorkspaceState } from "@/features/documents/shared/navigationContext";
import {
  buildRevisionPreviewFileName,
  buildPreviewVersionCacheBuster,
  isRevisionPdfPreviewType,
  loadPdfPreviewFile,
  resolveRevisionPreviewVersionToken,
} from "@/features/documents/shared/previewHelpers";
import {
  isSnapshotGenerating,
  pollSnapshotInBackground,
} from "@/features/documents/shared/detailSnapshotHelpers";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";

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

interface RevisionCreateLocationState extends RevisionWorkspaceState {
  documentId?: string;
  parentDocumentId?: string;
  revisionId?: string;
  sourceRevisionId?: string;
  revisionNumber?: string;
  revisionCreated?: string;
  revisionOpenedBy?: string;
  documentNumber?: string;
  documentName?: string;
  documentAuthor?: string;
  documentStatus?: string;
  documentCreated?: string;
  sourceDocument?: Partial<OriginalDocumentInfo> & {
    type?: string;
    revisionNumber?: string;
    coAuthors?: any[];
    businessUnit?: string;
    department?: string;
    knowledgeBase?: string;
    subType?: string;
    periodicReviewCycle?: number;
    periodicReviewNotification?: number;
    language?: string;
    description?: string;
    isTemplate?: boolean;
    titleLocalLanguage?: string;
  };
  revisionReviewers?: Reviewer[];
  revisionApprovers?: Approver[];
  preloadedRevisionDetail?: RevisionDetailResponse;
}

interface RevisionCreateRouteState extends RevisionCreateLocationState {
  workspaceState?: RevisionWorkspaceState | null;
}

interface OfficeOnlineDebugInfo {
  configuredScope?: string | null;
  effectiveScope?: string | null;
  fetchedAt?: string | null;
}

const emptyTraining: TrainingInformationValue = {
  trainingPlannedDate: "",
  trainingPeriodEndDate: "",
  trainingCompletionDate: "",
  trainingPeriodDays: null,
};

const normalizeString = (value?: string | null) => String(value ?? "").trim();

const displayValue = (value?: string | null, fallback = "-") => {
  const normalized = normalizeString(value);
  return normalized || fallback;
};

const normalizeArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string" || typeof item === "number") {
        return String(item).trim();
      }
      if (typeof item === "object") {
        const candidate = item as {
          fullName?: string;
          name?: string;
          label?: string;
          id?: string;
        };
        return normalizeString(
          candidate.fullName ||
            candidate.name ||
            candidate.label ||
            candidate.id,
        );
      }
      return String(item).trim();
    })
    .filter(Boolean);
};

const mapReviewersFromRevision = (
  reviewers?: RevisionPerson[] | null,
): Reviewer[] =>
  (reviewers ?? []).map((reviewer, index) => ({
    id: reviewer.id,
    fullName: reviewer.fullName || reviewer.username || reviewer.id,
    username: reviewer.username || "",
    position: reviewer.position || "",
    email: reviewer.email || "",
    department: reviewer.department || "",
    order: reviewer.sequenceOrder ?? index + 1,
  }));

const mapApproversFromRevision = (
  approvers?: RevisionPerson[] | null,
): Approver[] =>
  (approvers ?? []).map((approver) => ({
    id: approver.id,
    fullName: approver.fullName || approver.username || approver.id,
    username: approver.username || "",
    position: approver.position || "",
    email: approver.email || "",
    department: approver.department || "",
  }));

const mapReviewersToRevisionPeople = (
  reviewers: Reviewer[],
): RevisionPerson[] =>
  reviewers.map((reviewer, index) => ({
    id: reviewer.id,
    fullName: reviewer.fullName,
    username: reviewer.username,
    position: reviewer.position,
    email: reviewer.email,
    department: reviewer.department,
    sequenceOrder: reviewer.order || index + 1,
    actionStatus: undefined,
    actedAt: undefined,
    actionComment: undefined,
  }));

const mapApproversToRevisionPeople = (
  approvers: Approver[],
): RevisionPerson[] =>
  approvers.map((approver) => ({
    id: approver.id,
    fullName: approver.fullName,
    username: approver.username,
    position: approver.position,
    email: approver.email,
    department: approver.department,
    sequenceOrder: 1,
    actionStatus: undefined,
    actedAt: undefined,
    actionComment: undefined,
  }));

const mapCoAuthorsToRevisionPeople = (
  coAuthors: (string | number)[],
): RevisionPerson[] =>
  coAuthors.map((value, index) => {
    const fullName = String(value).trim();
    return {
      id: fullName || `coauthor-${index + 1}`,
      fullName: fullName || `Co-Author ${index + 1}`,
      username: fullName || "",
      position: "",
      email: "",
      department: "",
      sequenceOrder: index + 1,
      actionStatus: undefined,
      actedAt: undefined,
      actionComment: undefined,
    };
  });

const mapWorkingNotes = (
  notes?: RevisionWorkingNoteItem[] | null,
): RevisionWorkingNoteItem[] =>
  (notes ?? []).map((note) => ({
    ...note,
    content: note.content ?? "",
  }));

const buildOriginalDocumentFromSource = (
  state: RevisionCreateLocationState | null,
  revision?: RevisionDetailResponse | null,
): OriginalDocumentInfo | null => {
  if (revision?.originalDocument) {
    return revision.originalDocument;
  }

  const source = state?.sourceDocument;
  const parentDocumentId =
    state?.parentDocumentId ||
    state?.documentId ||
    source?.id ||
    revision?.documentId ||
    null;
  if (!source && !state?.documentNumber && !state?.documentName) {
    return null;
  }

  return {
    id: parentDocumentId,
    documentNumber:
      source?.documentNumber ||
      state?.documentNumber ||
      revision?.documentNumber ||
      null,
    documentName:
      source?.documentName ||
      state?.documentName ||
      revision?.documentName ||
      null,
    displayName: source?.displayName || null,
    title: source?.title || source?.documentName || state?.documentName || null,
    created: source?.created || state?.documentCreated || null,
    openedBy: source?.openedBy || state?.revisionOpenedBy || null,
    status: source?.status || state?.documentStatus || null,
    statusCode: source?.statusCode || null,
    statusInfo: source?.statusInfo || null,
    author: source?.author || state?.documentAuthor || null,
    owner: source?.owner || null,
    validUntil: source?.validUntil || null,
  };
};

const buildGeneralForm = (
  state: RevisionCreateLocationState | null,
  revision?: RevisionDetailResponse | null,
  currentUserName = "",
): GeneralInformationDocumentDetail => {
  const source = state?.sourceDocument;
  const sourceRevisionId =
    state?.sourceRevisionId || state?.revisionId || revision?.id || "";
  const documentNumber =
    revision?.documentNumber ||
    source?.documentNumber ||
    state?.documentNumber ||
    "";
  const documentName =
    revision?.documentName || source?.documentName || state?.documentName || "";
  const revisionNumber =
    revision?.revisionNumber ||
    state?.revisionNumber ||
    source?.revisionNumber ||
    "0.0.1";
  const created =
    revision?.created || state?.revisionCreated || source?.created || "";
  const openedBy =
    revision?.openedBy ||
    state?.revisionOpenedBy ||
    source?.openedBy ||
    currentUserName;
  const author =
    revision?.author ||
    source?.author ||
    state?.documentAuthor ||
    currentUserName;
  const coAuthors = normalizeArray(
    revision?.coAuthors?.map((person) => person.fullName) ?? source?.coAuthors,
  );
  const coAuthorDisplayNames = normalizeArray(
    revision?.coAuthors?.map((person) => person.fullName) ?? source?.coAuthors,
  );

  return {
    documentNumber,
    documentName,
    revisionNumber,
    revisionName: revision?.revisionName || `${documentName}_${revisionNumber}`,
    created,
    openedBy,
    author,
    coAuthors,
    coAuthorDisplayNames,
    isTemplate: Boolean(revision?.isTemplate ?? source?.isTemplate ?? false),
    businessUnit: revision?.businessUnit || source?.businessUnit || "",
    department: revision?.department || source?.department || "",
    knowledgeBase: revision?.knowledgeBase || source?.knowledgeBase || "",
    subType: revision?.subType || source?.subType || "",
    periodicReviewCycle:
      revision?.periodicReviewCycle ?? source?.periodicReviewCycle ?? 0,
    periodicReviewNotification:
      revision?.periodicReviewNotification ??
      source?.periodicReviewNotification ??
      0,
    language: revision?.language || source?.language || "English",
    description: revision?.description || source?.description || "",
    titleLocalLanguage:
      revision?.titleLocalLanguage || source?.titleLocalLanguage || "",
    type: revision?.type || source?.type || "",
  };
};

const buildTrainingInfo = (
  revision?: RevisionDetailResponse | null,
): TrainingInformationValue => ({
  trainingPlannedDate: revision?.trainingPlannedDate || "",
  trainingPeriodEndDate: revision?.trainingPeriodEndDate || "",
  trainingCompletionDate: revision?.trainingCompletionDate || "",
  trainingPeriodDays: revision?.trainingPeriodDays ?? null,
});

const buildRevisionPayload = (
  form: GeneralInformationDocumentDetail,
  training: TrainingInformationValue,
  reviewers: Reviewer[],
  approvers: Approver[],
) => ({
  documentName: form.documentName,
  titleLocalLanguage: form.titleLocalLanguage || null,
  author: form.author,
  coAuthorIds: form.coAuthors.map((value) => String(value)),
  businessUnit: form.businessUnit,
  department: form.department,
  knowledgeBase: form.knowledgeBase || null,
  subType: form.subType || null,
  periodicReviewCycle: form.periodicReviewCycle || 0,
  periodicReviewNotification: form.periodicReviewNotification || 0,
  language: form.language || null,
  description: form.description || null,
  isTemplate: Boolean(form.isTemplate),
  reviewerUserIds: reviewers.map((reviewer) => reviewer.id),
  approverUserIds: approvers.map((approver) => approver.id),
  trainingPlannedDate: training.trainingPlannedDate || null,
  trainingPeriodEndDate: training.trainingPeriodEndDate || null,
  trainingCompletionDate: training.trainingCompletionDate || null,
});

const RevisionCreateViewContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { user, canUseDocumentTemplate } = useDocumentPermissions();

  const locationState = useMemo<RevisionCreateLocationState | null>(() => {
    const routeState = location.state as RevisionCreateRouteState | null;
    const workspaceState = routeState?.workspaceState ?? null;
    if (!routeState && !workspaceState) {
      return null;
    }

    const merged = {
      ...(workspaceState ?? {}),
      ...(routeState ?? {}),
    } as RevisionCreateLocationState;

    return {
      ...merged,
      sourceDocument:
        routeState?.sourceDocument ??
        (workspaceState as RevisionCreateLocationState | null | undefined)
          ?.sourceDocument,
      revisionReviewers:
        routeState?.revisionReviewers ??
        (workspaceState as RevisionCreateLocationState | null | undefined)
          ?.revisionReviewers,
      revisionApprovers:
        routeState?.revisionApprovers ??
        (workspaceState as RevisionCreateLocationState | null | undefined)
          ?.revisionApprovers,
      preloadedRevisionDetail:
        routeState?.preloadedRevisionDetail ??
        (workspaceState as RevisionCreateLocationState | null | undefined)
          ?.preloadedRevisionDetail,
    };
  }, [location.state]);
  const routeRevisionId =
    locationState?.sourceRevisionId ||
    locationState?.revisionId ||
    params.id ||
    "";
  const activeQueryTab = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(
    activeQueryTab || "general",
  );
  const [commentHistoryOpen, setCommentHistoryOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isSyncingOffice, setIsSyncingOffice] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCompleteEditingModal, setShowCompleteEditingModal] =
    useState(false);
  const [showSubmitForReviewModal, setShowSubmitForReviewModal] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [revisionRecord, setRevisionRecord] =
    useState<RevisionDetailResponse | null>(null);
  const [reviewComments, setReviewComments] = useState<RevisionReviewCommentItem[]>([]);
  const [currentReviewRound, setCurrentReviewRound] = useState(1);
  const [openCommentCount, setOpenCommentCount] = useState(0);
  const [officeOnlineDebugInfo, setOfficeOnlineDebugInfo] =
    useState<OfficeOnlineDebugInfo | null>(null);
  const [officeOnlineEditUrl, setOfficeOnlineEditUrl] = useState<string | null>(
    null,
  );
  const [isOpeningOfficeOnline, setIsOpeningOfficeOnline] = useState(false);
  const [isCompletingEditing, setIsCompletingEditing] = useState(false);
  const [isSubmittingForReview, setIsSubmittingForReview] = useState(false);
  const [isReplacingFile, setIsReplacingFile] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const officeOnlineWindowRef = useRef<Window | null>(null);
  const [workingNotes, setWorkingNotes] = useState<RevisionWorkingNoteItem[]>(
    [],
  );
  const [generalForm, setGeneralForm] =
    useState<GeneralInformationDocumentDetail>(() =>
      buildGeneralForm(
        locationState,
        null,
        user?.fullName || user?.username || "",
      ),
    );
  const [trainingInfo, setTrainingInfo] = useState<TrainingInformationValue>(
    () => buildTrainingInfo(null),
  );
  const [reviewers, setReviewers] = useState<Reviewer[]>(
    () => locationState?.revisionReviewers || [],
  );
  const [approvers, setApprovers] = useState<Approver[]>(
    () => locationState?.revisionApprovers || [],
  );
  const sourceDocumentInfo = useMemo(
    () => buildOriginalDocumentFromSource(locationState, revisionRecord),
    [locationState, revisionRecord],
  );
  const revisionBreadcrumbFrom =
    locationState?.from ??
    locationState?.returnTo ??
    locationState?.workspaceReturnPath ??
    undefined;
  const parentDocumentId =
    locationState?.parentDocumentId ||
    locationState?.documentId ||
    sourceDocumentInfo?.id ||
    revisionRecord?.documentId ||
    "";
  const sourceRevisionId =
    locationState?.sourceRevisionId ||
    locationState?.revisionId ||
    revisionRecord?.id ||
    routeRevisionId ||
    "";

  const isEditable = useMemo(() => {
    if (!revisionRecord?.status) {
      return true;
    }

    const normalized = normalizeRevisionStatusForStepper(
      revisionRecord.status,
      revisionRecord.statusInfo,
    );
    return normalized === "Draft";
  }, [revisionRecord?.status, revisionRecord?.statusInfo]);

  const revisionDisplay = useMemo<RevisionDetailResponse | null>(() => {
    if (!sourceDocumentInfo && !revisionRecord) {
      return null;
    }

    const base =
      revisionRecord ??
      ({
        id: sourceRevisionId || "",
        documentId: parentDocumentId || null,
        documentNumber: generalForm.documentNumber,
        documentName: generalForm.documentName,
        revisionName: generalForm.revisionName,
        revisionNumber: generalForm.revisionNumber,
        status: "Draft",
        statusCode: "DRAFT",
        statusInfo: { id: "DRAFT", name: "Draft" },
        created: generalForm.created || "",
        openedBy: generalForm.openedBy || "",
        author: generalForm.author || "",
        coAuthors: [],
        reviewers: [],
        approvers: [],
        signatures: [],
        workingNotes: [],
        originalDocument: sourceDocumentInfo,
        titleLocalLanguage: generalForm.titleLocalLanguage || "",
        businessUnit: generalForm.businessUnit || "",
        department: generalForm.department || "",
        knowledgeBase: generalForm.knowledgeBase || "",
        subType: generalForm.subType || "",
        periodicReviewCycle: generalForm.periodicReviewCycle,
        periodicReviewNotification: generalForm.periodicReviewNotification,
        language: generalForm.language,
        description: generalForm.description,
        isTemplate: generalForm.isTemplate,
        workingNotesEditable: true,
      } as RevisionDetailResponse);

    return {
      ...base,
      documentNumber: generalForm.documentNumber || base.documentNumber,
      documentName: generalForm.documentName || base.documentName,
      revisionNumber: generalForm.revisionNumber || base.revisionNumber,
      revisionName: generalForm.revisionName || base.revisionName,
      created: generalForm.created || base.created || "",
      openedBy: generalForm.openedBy || base.openedBy || "",
      author: generalForm.author || base.author || "",
      coAuthors:
        generalForm.coAuthors.length > 0
          ? mapCoAuthorsToRevisionPeople(generalForm.coAuthors)
          : base.coAuthors || [],
      reviewers: mapReviewersToRevisionPeople(reviewers),
      approvers: mapApproversToRevisionPeople(approvers),
      signatures: base.signatures || [],
      workingNotes: workingNotes,
      originalDocument: sourceDocumentInfo,
      titleLocalLanguage:
        generalForm.titleLocalLanguage || base.titleLocalLanguage || "",
      businessUnit: generalForm.businessUnit || base.businessUnit || "",
      department: generalForm.department || base.department || "",
      knowledgeBase: generalForm.knowledgeBase || base.knowledgeBase || "",
      subType: generalForm.subType || base.subType || "",
      periodicReviewCycle:
        generalForm.periodicReviewCycle || base.periodicReviewCycle || 0,
      periodicReviewNotification:
        generalForm.periodicReviewNotification ||
        base.periodicReviewNotification ||
        0,
      language: generalForm.language || base.language || "English",
      description: generalForm.description || base.description || "",
      isTemplate: Boolean(generalForm.isTemplate),
      requiresTraining: base.requiresTraining,
      trainingPeriodDays: base.trainingPeriodDays,
      reasonForSkippingTraining: base.reasonForSkippingTraining,
      trainingPlannedDate:
        trainingInfo.trainingPlannedDate || base.trainingPlannedDate || null,
      trainingPeriodEndDate:
        trainingInfo.trainingPeriodEndDate ||
        base.trainingPeriodEndDate ||
        null,
      trainingCompletionDate:
        trainingInfo.trainingCompletionDate ||
        base.trainingCompletionDate ||
        null,
      hasPreview: base.hasPreview,
      storagePdfUrl: base.storagePdfUrl,
      storageProvider: base.storageProvider,
      storageSiteId: base.storageSiteId,
      storageDriveId: base.storageDriveId,
      storageItemId: base.storageItemId,
      storageWebUrl: base.storageWebUrl,
      storageEditUrl: base.storageEditUrl,
      storageViewUrl: base.storageViewUrl,
      storageSyncStatus: base.storageSyncStatus,
      storageLastSyncedAt: base.storageLastSyncedAt,
      canEditFileOnline: base.canEditFileOnline,
      workingNotesEditable: base.workingNotesEditable,
      history: base.history,
    };
  }, [
    approvers,
    generalForm.author,
    generalForm.businessUnit,
    generalForm.created,
    generalForm.department,
    generalForm.description,
    generalForm.documentName,
    generalForm.documentNumber,
    generalForm.isTemplate,
    generalForm.knowledgeBase,
    generalForm.language,
    generalForm.openedBy,
    generalForm.periodicReviewCycle,
    generalForm.periodicReviewNotification,
    generalForm.revisionName,
    generalForm.revisionNumber,
    generalForm.subType,
    generalForm.titleLocalLanguage,
    locationState?.documentId,
    locationState?.revisionId,
    reviewers,
    revisionRecord,
    sourceDocumentInfo,
    trainingInfo.trainingCompletionDate,
    trainingInfo.trainingPeriodEndDate,
    trainingInfo.trainingPlannedDate,
    workingNotes,
  ]);

  const loadReviewComments = React.useCallback(async () => {
    setReviewComments([]);
    setCurrentReviewRound(1);
    setOpenCommentCount(0);
  }, []);

  useEffect(() => {
    void loadReviewComments();
  }, [loadReviewComments]);

  const handleResolveReviewComment = async (commentId: string, resolutionNote?: string) => {
    if (!revisionDisplay?.id) return;
    try {
      await documentApi.resolveRevisionReviewComment(revisionDisplay.id, commentId, resolutionNote);
      await loadReviewComments();
    } catch (error) {
      showToast({ type: "error", title: "Unable to resolve comment", message: (error as any)?.response?.data?.message || "Please try again.", duration: 3000 });
    }
  };

  const handleReplyToReviewComment = async (commentId: string, content: string, attachments: File[]) => {
    if (!revisionDisplay?.id) return;
    try {
      const updatedComment = await documentApi.replyToRevisionReviewComment(revisionDisplay.id, commentId, content);
      const newReplyId = updatedComment.replies[updatedComment.replies.length - 1]?.id;
      if (newReplyId) {
        for (const file of attachments) {
          await documentApi.uploadRevisionReviewCommentReplyAttachment(revisionDisplay.id, commentId, newReplyId, file);
        }
      }
      await loadReviewComments();
    } catch (error) {
      showToast({ type: "error", title: "Unable to send reply", message: (error as any)?.response?.data?.message || "Please try again.", duration: 3000 });
    }
  };

  const handleDeleteReviewComment = async (commentId: string, reason: string) => {
    if (!revisionDisplay?.id) return;
    try {
      await documentApi.deleteRevisionReviewComment(revisionDisplay.id, commentId, reason);
      await loadReviewComments();
    } catch (error) {
      showToast({ type: "error", title: "Unable to delete comment", message: (error as any)?.response?.data?.message || "Please try again.", duration: 3000 });
    }
  };
  const handleEditReviewComment = async (commentId: string, content: string) => { if (revisionDisplay?.id) { await documentApi.updateRevisionReviewComment(revisionDisplay.id, commentId, content); await loadReviewComments(); } };
  const handleEditReviewReply = async (commentId: string, replyId: string, content: string) => { if (revisionDisplay?.id) { await documentApi.updateRevisionReviewCommentReply(revisionDisplay.id, commentId, replyId, content); await loadReviewComments(); } };
  const handleDeleteReviewReply = async (commentId: string, replyId: string, reason: string) => { if (revisionDisplay?.id) { await documentApi.deleteRevisionReviewCommentReply(revisionDisplay.id, commentId, replyId, reason); await loadReviewComments(); } };

  const revisionActionCapabilities = useRevisionActionCapabilities(
    revisionDisplay?.id || routeRevisionId || null,
  );
  const resolveRevisionCapability = (
    action: Parameters<typeof revisionActionCapabilities.can>[0],
  ) => !revisionActionCapabilities.loading && revisionActionCapabilities.can(action);

  const signatureRecords = useMemo<SignatureTabRecord[]>(
    () => buildRevisionSignatureRecords(revisionDisplay),
    [revisionDisplay],
  );
  const hasPreparedSignature = useMemo(
    () =>
      (revisionDisplay?.signatures ?? []).some((signature) => {
        if (
          !normalizeString(signature?.actionBy)
            .toLowerCase()
            .startsWith("prepared")
        )
          return false;
        // Backend adds a placeholder "Prepared By" row (no date) even for unsigned drafts.
        // Only treat it as a real e-signature when there's an actual signed-on date.
        const onValue = normalizeString(signature?.actionOnValue).toLowerCase();
        return onValue !== "" && onValue !== "-";
      }),
    [revisionDisplay?.signatures],
  );

  useEffect(() => {
    setOfficeOnlineDebugInfo(null);
    setOfficeOnlineEditUrl(null);
    setIsOpeningOfficeOnline(false);
  }, [revisionDisplay?.id]);

  const currentStatus = useMemo(
    () =>
      normalizeRevisionStatusForStepper(
        revisionDisplay?.status,
        revisionDisplay?.statusInfo,
      ),
    [revisionDisplay?.status, revisionDisplay?.statusInfo],
  );
  const currentStepIndex = useMemo(
    () =>
      revisionWorkflowStepIndex(
        revisionDisplay?.status,
        revisionDisplay?.statusInfo,
      ),
    [revisionDisplay?.status, revisionDisplay?.statusInfo],
  );
  const skippedSteps = revisionDisplay?.requiresTraining
    ? []
    : (["Pending Training"] as const);
  const tabs: TabItem[] = [
    { id: "general", label: "General Information" },
    { id: "workingNotes", label: "Working Notes" },
    { id: "infoFromDocument", label: "Information from Document" },
    { id: "training", label: "Training Information" },
    { id: "reviewers", label: "Reviewers" },
    { id: "approvers", label: "Approvers" },
    { id: "document", label: "Document" },
    { id: "signatures", label: "Signatures" },
    { id: "audit", label: "Audit Trail" },
  ];

  const hasOfficeOnlineWorkingCopy = Boolean(
    revisionDisplay?.storageItemId ||
    revisionDisplay?.storageEditUrl ||
    revisionDisplay?.storageViewUrl ||
    revisionDisplay?.storageWebUrl ||
    normalizeString(revisionDisplay?.storageProvider).toLowerCase() ===
      "microsoft-graph",
  );
  // An Upgrade intentionally starts without a source. The Author must upload a
  // new revision file; a predecessor's source is never reused as working content.
  const hasRevisionSource = Boolean(
    revisionDisplay?.sourceFileChecksum && revisionDisplay?.sourceStorageObjectKey,
  );
  const editingCompleted =
    revisionDisplay?.editingStatus === "COMPLETED" || revisionDisplay?.sourceLocked === true;
  const canCurrentUserEditDraftFile =
    Boolean(revisionDisplay?.id) &&
    isEditable &&
    !editingCompleted &&
    resolveRevisionCapability("editOnline");
  const canCompleteEditing =
    Boolean(revisionDisplay?.id) &&
    hasRevisionSource &&
    resolveRevisionCapability("completeAuthoring");
  const canPersistRevision =
    Boolean(revisionDisplay?.id) &&
    resolveRevisionCapability("updateDraftMetadata");
  const canOpenPublishingWorkspace =
    Boolean(revisionDisplay?.id) &&
    resolveRevisionCapability("openPublishingWorkspace");
  const canSubmitForReview =
    Boolean(revisionDisplay?.id) &&
    editingCompleted &&
    resolveRevisionCapability("submitForReview");
  const canUploadToOffice =
    Boolean(revisionDisplay?.id) &&
    resolveRevisionCapability("syncToOffice");
  const canCreateOfficeOnlineCopy =
    canUploadToOffice && hasRevisionSource && !hasOfficeOnlineWorkingCopy;
  const canEditOnline =
    Boolean(revisionDisplay?.id) &&
    hasOfficeOnlineWorkingCopy &&
    canCurrentUserEditDraftFile;
  const canReplaceRevisionFile =
    Boolean(revisionDisplay?.id) &&
    isEditable &&
    !editingCompleted &&
    !hasOfficeOnlineWorkingCopy &&
    revisionDisplay?.officeOnlineEverSynced !== true &&
    resolveRevisionCapability("uploadSource");
  const isRejectedRework = isEditable && reviewComments.length > 0;
  const isPublishingReworkComparison = Boolean(
    revisionDisplay?.canOpenPublishingWorkspace &&
      revisionDisplay?.previewType === "REVIEW_SNAPSHOT",
  );

  const syncPreview = async (revisionId: string, useCurrentSource = false) => {
    try {
      setPreviewStatus("loading");
      setPreviewMessage(null);
      const cacheBuster = buildPreviewVersionCacheBuster(resolveRevisionPreviewVersionToken(revisionRecord));
      const file = await loadPdfPreviewFile(
        () => useCurrentSource
          ? documentApi.previewRevisionSourceFile(revisionId, cacheBuster)
          : documentApi.previewRevisionFile(revisionId, cacheBuster),
        buildRevisionPreviewFileName(
          generalForm.documentNumber,
          generalForm.revisionNumber || "0.0.1",
        ),
      );
      setRevisionFile(file);
      setPreviewStatus("ready");
      setPreviewMessage(null);
    } catch (error) {
      setRevisionFile(null);
      setPreviewStatus("error");
      setPreviewMessage((error as any)?.response?.data?.message || "Unable to load PDF preview from server.");
    }
  };

  const handleReplaceRevisionFile = async (file: File) => {
    if (!revisionDisplay?.id) return;
    setIsReplacingFile(true);
    try {
      await documentApi.uploadRevisionFile(revisionDisplay.id, file);
      // The upload endpoint returns a lightweight action response in some deployments.
      // Always reload the complete revision aggregate so replacing a source file never
      // drops the revision id, workflow metadata, or retained review comments from the
      // Draft-after-Reject workspace.
      await refreshRevisionFromBackend(revisionDisplay.id);
      await loadReviewComments();
      showToast({
        type: "success",
        title: "File replaced",
        message: "The revision file has been updated.",
        duration: 3000,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Upload failed",
        message: (error as any)?.response?.data?.message || "Unable to replace the revision file.",
        duration: 3000,
      });
    } finally {
      setIsReplacingFile(false);
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadRevisionDetail = async () => {
      try {
        setIsLoadingDetail(true);

        const applyLoadedRevisionDetail = async (resolvedDetail: RevisionDetailResponse) => {
          setRevisionRecord(resolvedDetail);
          setGeneralForm(
            buildGeneralForm(
              locationState,
              resolvedDetail,
              user?.fullName || user?.username || "",
            ),
          );
          setTrainingInfo(buildTrainingInfo(resolvedDetail));
          setReviewers(mapReviewersFromRevision(resolvedDetail.reviewers));
          setApprovers(mapApproversFromRevision(resolvedDetail.approvers));
          setWorkingNotes(mapWorkingNotes(resolvedDetail.workingNotes));

          if (isRevisionPdfPreviewType(resolvedDetail?.previewType)) {
            // Publishing checks compare the newly completed source with the immutable PDF that
            // Reviewer/Approver annotated. Do not replace the retained snapshot with this source.
            await syncPreview(
              resolvedDetail.id,
              Boolean(
                resolvedDetail.canOpenPublishingWorkspace &&
                  resolvedDetail.previewType === "REVIEW_SNAPSHOT",
              ),
            );
          } else {
            setRevisionFile(null);
            setPreviewStatus(
              isSnapshotGenerating(resolvedDetail?.snapshotStatus) ? "loading" : "idle",
            );
            setPreviewMessage(
              isSnapshotGenerating(resolvedDetail?.snapshotStatus)
                ? "Review snapshot is being regenerated."
                : "PDF preview is not available yet.",
            );
          }
        };

        if (routeRevisionId) {
          const preloaded = locationState?.preloadedRevisionDetail;
          const detail =
            preloaded?.id === routeRevisionId
              ? preloaded
              : await documentApi.getRevisionById(routeRevisionId);
          if (!mounted) return;

          await applyLoadedRevisionDetail(detail);

          // Don't block the page render on the PDF regeneration round-trip (can take 15-20s)
          // — render immediately with the Document tab's own "generating" state, and patch in
          // the finished snapshot in the background once ready.
          pollSnapshotInBackground({
            detail,
            fetchLive: () => documentApi.getRevisionByIdSnapshot(routeRevisionId, { force: true }),
            onUpdate: (resolvedDetail) => {
              if (!mounted) return;
              void applyLoadedRevisionDetail(resolvedDetail);
            },
          });
        } else if (locationState?.preloadedRevisionDetail?.id) {
          const detail = locationState.preloadedRevisionDetail;
          await applyLoadedRevisionDetail(detail);
          pollSnapshotInBackground({
            detail,
            fetchLive: () => documentApi.getRevisionByIdSnapshot(detail.id, { force: true }),
            onUpdate: (resolvedDetail) => {
              if (!mounted) return;
              void applyLoadedRevisionDetail(resolvedDetail);
            },
          });
        } else {
          setRevisionRecord(null);
          setGeneralForm(
            buildGeneralForm(
              locationState,
              null,
              user?.fullName || user?.username || "",
            ),
          );
          setTrainingInfo(emptyTraining);
          setReviewers(locationState?.revisionReviewers || []);
          setApprovers(locationState?.revisionApprovers || []);
          setWorkingNotes([]);
          setRevisionFile(null);
          setPreviewStatus("idle");
          setPreviewMessage("Upload a revision file to generate the preview.");
        }
      } catch (error) {
        console.error("Failed to load revision create workspace", error);
        if (mounted) {
          setPreviewStatus("error");
          setPreviewMessage(
            (error as any)?.response?.data?.error?.message ||
              (error as any)?.response?.data?.message ||
              (error as Error)?.message ||
              "Failed to load revision workspace.",
          );
        }
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
  }, [locationState, routeRevisionId, user?.fullName, user?.username]);

  useEffect(() => {
    if (!revisionRecord?.id) {
      return;
    }

    const hasPreview = isRevisionPdfPreviewType(revisionRecord.previewType);
    if (!hasPreview) {
      return;
    }

    let alive = true;
    void (async () => {
      await syncPreview(revisionRecord.id);
      if (!alive) return;
    })();

    return () => {
      alive = false;
    };
  }, [revisionRecord?.id, revisionRecord?.previewType]);

  useEffect(() => {
    if (activeQueryTab) {
      setActiveTab(activeQueryTab);
    }
  }, [activeQueryTab]);

  useEffect(() => {
    if (
      !revisionDisplay?.id ||
      !hasOfficeOnlineWorkingCopy ||
      officeOnlineEditUrl
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await documentApi.getRevisionOfficeOnlineEditLink(
          revisionDisplay.id,
        );
        if (cancelled) return;
        setOfficeOnlineDebugInfo({
          configuredScope: response?.configuredScope || null,
          effectiveScope: response?.effectiveScope || null,
          fetchedAt: response?.fetchedAt || null,
        });
        if (response?.url) {
          setOfficeOnlineEditUrl(response.url);
        }
      } catch (error) {
        if (!cancelled) {
          console.debug("Office Online edit link prefetch skipped", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasOfficeOnlineWorkingCopy, officeOnlineEditUrl, revisionDisplay?.id]);

  const handleBack = () => {
    const returnTo =
      locationState?.workspaceReturnPath ||
      locationState?.returnTo ||
      locationState?.from;
    if (returnTo) {
      navigateTo(returnTo);
      return;
    }

    navigateTo(ROUTES.DOCUMENTS.REVISIONS.ALL);
  };

  const refreshRevisionFromBackend = async (revisionId: string) => {
    // Snapshot endpoint (no VIEW audit log / no markOpened side effect) — this helper is called
    // after actions succeed to re-sync local state, not because the user opened the revision.
    const refreshed = await documentApi.getRevisionByIdSnapshot(revisionId, { force: true });
    setRevisionRecord(refreshed);
    void revisionActionCapabilities.refresh();
    setGeneralForm(
      buildGeneralForm(
        locationState,
        refreshed,
        user?.fullName || user?.username || "",
      ),
    );
    setTrainingInfo(buildTrainingInfo(refreshed));
    setReviewers(mapReviewersFromRevision(refreshed.reviewers));
    setApprovers(mapApproversFromRevision(refreshed.approvers));
    setWorkingNotes(mapWorkingNotes(refreshed.workingNotes));

    if (isRevisionPdfPreviewType(refreshed?.previewType)) {
      await syncPreview(revisionId);
    } else {
      setRevisionFile(null);
      setPreviewStatus("idle");
      setPreviewMessage("PDF preview is not available yet.");
    }

    return refreshed;
  };

  // A user with revision-workspace permission can keep this Draft open while
  // the assigned Author edits in another session. Poll only workflow
  // state/capabilities so that user does not
  // need to reload, while preserving any unsaved metadata in the form.
  useEffect(() => {
    const revisionId = revisionRecord?.id || routeRevisionId;
    if (!revisionId || !isEditable) {
      return;
    }

    let cancelled = false;
    let checking = false;
    const abortController = new AbortController();
    const refreshWorkflowState = async () => {
      if (cancelled || checking || document.visibilityState !== "visible") {
        return;
      }
      checking = true;
      try {
        const live = await documentApi.getRevisionByIdSnapshot(revisionId, {
          force: true,
          signal: abortController.signal,
        });
        if (cancelled) {
          return;
        }
        const workflowChanged =
          live.editingStatus !== revisionRecord?.editingStatus ||
          live.sourceLocked !== revisionRecord?.sourceLocked ||
          live.status !== revisionRecord?.status ||
          live.statusInfo?.id !== revisionRecord?.statusInfo?.id;
        if (!workflowChanged) {
          return;
        }

        setRevisionRecord((current) => current == null
          ? live
          : {
              ...current,
              status: live.status,
              statusInfo: live.statusInfo,
              editingStatus: live.editingStatus,
              sourceLocked: live.sourceLocked,
              snapshotStatus: live.snapshotStatus,
              lastModifiedDate: live.lastModifiedDate,
              lastModifiedBy: live.lastModifiedBy,
              signatures: live.signatures,
            });
        void revisionActionCapabilities.refresh();
        if (live.editingStatus === "COMPLETED" || live.sourceLocked) {
          showToast({
            type: "success",
            title: "Author completed editing",
            message: "The revision is ready to submit for review.",
            duration: 4000,
          });
        }
      } catch {
        // Background refresh is best-effort; normal user actions still show API errors.
      } finally {
        checking = false;
      }
    };

    const interval = window.setInterval(() => void refreshWorkflowState(), 10_000);
    const unsubscribeRealtime = subscribeNotificationRealtime((event) => {
      if (event.type !== "revision-workflow-updated") {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as { revisionId?: string };
        if (payload.revisionId === revisionId) {
          void refreshWorkflowState();
        }
      } catch {
        // Ignore malformed events; the polling fallback remains active.
      }
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshWorkflowState();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      abortController.abort();
      window.clearInterval(interval);
      unsubscribeRealtime();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    isEditable,
    revisionRecord?.editingStatus,
    revisionRecord?.id,
    revisionRecord?.sourceLocked,
    revisionRecord?.status,
    revisionRecord?.statusInfo?.id,
    routeRevisionId,
    revisionActionCapabilities,
    showToast,
  ]);

  const persistRevision = async (revisionId: string) => {
    const payload = buildRevisionPayload(
      generalForm,
      trainingInfo,
      reviewers,
      approvers,
    );
    const updated = await documentApi.updateRevision(revisionId, payload);
    const refreshed =
      (updated as RevisionDetailResponse) ||
      (await documentApi.getRevisionByIdSnapshot(revisionId, { force: true }));
    setRevisionRecord(refreshed);
    setGeneralForm(
      buildGeneralForm(
        locationState,
        refreshed,
        user?.fullName || user?.username || "",
      ),
    );
    setTrainingInfo(buildTrainingInfo(refreshed));
    setReviewers(mapReviewersFromRevision(refreshed.reviewers));
    setApprovers(mapApproversFromRevision(refreshed.approvers));
    setWorkingNotes(mapWorkingNotes(refreshed.workingNotes));
    return refreshed;
  };

  const handleAddWorkingNote = async (content: string) => {
    if (!revisionDisplay?.id) {
      showToast({
        type: "warning",
        title: "Revision not ready",
        message: "Upload the revision file first before adding working notes.",
      });
      return;
    }

    try {
      const note = await documentApi.addRevisionWorkingNote(
        revisionDisplay.id,
        content,
      );
      setWorkingNotes((prev) => [note, ...prev]);
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to add note",
        message:
          (error as any)?.response?.data?.message ||
          "Working note could not be saved.",
        duration: 3000,
      });
    }
  };

  const handleDeleteWorkingNote = async (noteId: string) => {
    if (!revisionDisplay?.id) return;

    try {
      await documentApi.deleteRevisionWorkingNote(revisionDisplay.id, noteId);
      setWorkingNotes((prev) => prev.filter((note) => note.id !== noteId));
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to delete note",
        message:
          (error as any)?.response?.data?.message ||
          "Working note could not be deleted.",
        duration: 3000,
      });
    }
  };

  const handleUploadRevisionConfirm = async (
    file: File | null,
    note: string,
    useTemplate: boolean,
    templateRevisionId?: string,
  ) => {
    if (!file) return;
    if (!parentDocumentId) {
      showToast({
        type: "error",
        title: "Upload failed",
        message:
          "The source document is missing, so the revision cannot be created.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const created = await documentApi.createRevisionWithUpload(
        parentDocumentId,
        file,
        {
          changeDescription: note?.trim() || undefined,
          revisionType: "Minor",
          templateRevisionId: useTemplate ? templateRevisionId : undefined,
        },
      );

      const uploaded = created as RevisionDetailResponse;
      setRevisionRecord(uploaded);
      setGeneralForm(
        buildGeneralForm(
          locationState,
          uploaded,
          user?.fullName || user?.username || "",
        ),
      );
      setTrainingInfo(buildTrainingInfo(uploaded));
      setReviewers((prev) =>
        prev.length > 0 ? prev : mapReviewersFromRevision(uploaded.reviewers),
      );
      setApprovers((prev) =>
        prev.length > 0 ? prev : mapApproversFromRevision(uploaded.approvers),
      );
      setWorkingNotes(mapWorkingNotes(uploaded.workingNotes));

      try {
        await persistRevision(uploaded.id);
      } catch (error) {
        console.warn("Revision uploaded but metadata save failed", error);
      }

      if (isRevisionPdfPreviewType(uploaded?.previewType)) {
        await syncPreview(uploaded.id);
      }

      showToast({
        type: "success",
        title: "Revision uploaded",
        message: "The revision file has been created successfully.",
        duration: 3000,
      });
      setShowUploadModal(false);
    } catch (error) {
      console.error("Failed to upload revision", error);
      showToast({
        type: "error",
        title: "Upload failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          "Unable to upload the revision file.",
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!revisionDisplay?.id) {
      showToast({
        type: "warning",
        title: "Revision not created",
        message: "Please upload the revision file first before saving.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await persistRevision(revisionDisplay.id);
      showToast({
        type: "success",
        title: "Draft saved",
        message: "Revision draft has been saved successfully.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to save revision draft", error);
      showToast({
        type: "error",
        title: "Save failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          "Unable to save the revision draft.",
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteEditing = async (signature?: {
    reason?: string;
    comment?: string;
    signatureToken?: string;
  }) => {
    if (!revisionDisplay?.id) {
      showToast({
        type: "warning",
        title: "Revision not created",
        message:
          "Please upload the revision file first before completing editing.",
      });
      return;
    }

    setIsCompletingEditing(true);
    try {
      const updated = await documentApi.completeRevisionEditing(
        revisionDisplay.id,
        signature,
      );
      const revId = updated?.id || revisionDisplay?.id;
      if (revId) {
        await refreshRevisionFromBackend(revId).catch(() => null);
      }
      setOfficeOnlineEditUrl(null);
      setOfficeOnlineDebugInfo(null);
      showToast({
        type: "success",
        title: "Editing completed",
        message:
          "The revision is now locked for publishing workspace preparation.",
        duration: 3000,
      });
      setShowCompleteEditingModal(false);
      // Stay on this view instead of navigating to the read-only Detail page: Complete Editing
      // only locks the source file, it does not finish the revision -- the very next expected
      // action is Submit for Review, and that button (along with everything else this page
      // already computes correctly from the just-refreshed revisionRecord/capabilities above)
      // only exists here. DetailRevisionView is a read-only summary with no workflow actions,
      // so navigating there stranded the user with no way to submit for review at all.
    } catch (error) {
      console.error("Failed to complete editing", error);
      showToast({
        type: "error",
        title: "Complete editing failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          "Unable to complete editing for this revision.",
        duration: 3000,
      });
    } finally {
      setIsCompletingEditing(false);
    }
  };

  const handleSubmitForReview = async (signature?: {
    reason?: string;
    comment?: string;
    signatureToken?: string;
  }) => {
    if (!revisionDisplay?.id) return;

    setIsSubmittingForReview(true);
    try {
      const updated = await documentApi.submitRevisionForReview(revisionDisplay.id, signature);
      setShowSubmitForReviewModal(false);
      showToast({
        type: "success",
        title: "Submitted for review",
        message: "The revision has been submitted and is now pending review.",
        duration: 3000,
      });

      const nextRevisionId = updated?.id || revisionDisplay.id;
      if (nextRevisionId) {
        navigateTo(ROUTES.DOCUMENTS.REVISIONS.DETAIL(nextRevisionId), {
          state: buildRevisionDetailNavigationState({
            from: location.pathname + location.search,
            returnTo: location.pathname + location.search,
            parentDocumentId: parentDocumentId || undefined,
            sourceRevisionId: nextRevisionId,
            revisionId: nextRevisionId,
            documentId: parentDocumentId || undefined,
            documentNumber: updated?.documentNumber || generalForm.documentNumber || "",
            documentName: updated?.documentName || generalForm.documentName || "",
            revisionNumber: updated?.revisionNumber || generalForm.revisionNumber || "",
            detail: updated,
          }),
        });
      }
    } catch (error) {
      console.error("Failed to submit revision for review", error);
      showToast({
        type: "error",
        title: "Submit for review failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          "Unable to submit the revision for review.",
        duration: 3000,
      });
    } finally {
      setIsSubmittingForReview(false);
    }
  };

  const handleUploadToOfficeOnline = async () => {
    if (!revisionDisplay?.id) return;

    setIsSyncingOffice(true);
    try {
      await documentApi.uploadRevisionToOfficeOnline(revisionDisplay.id);
      const refreshed = await refreshRevisionFromBackend(revisionDisplay.id);
      // Revision metadata contains a generic SharePoint URL. The actual
      // authoring action must obtain a recipient-bound sharing link instead.
      setOfficeOnlineEditUrl(null);
      showToast({
        type: "success",
        title: "Synced successfully",
        message: "The revision file has been uploaded to Office Online.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to sync revision to Office Online", error);
      showToast({
        type: "error",
        title: "Sync failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          "Unable to upload the revision to Office Online.",
        duration: 3000,
      });
    } finally {
      setIsSyncingOffice(false);
    }
  };

  const handleOpenEditFileOnline = async () => {
    if (!revisionDisplay?.id) return;

    try {
      setIsOpeningOfficeOnline(true);
      const popup = window.open("about:blank", "_blank");
      // Never reuse a cached storage/edit URL. It is a generic SharePoint
      // Doc.aspx URL, not a "Specific people" authorisation grant, and can
      // produce Access Denied for an Entra B2B guest.
      const response = await documentApi.getRevisionOfficeOnlineEditLink(
        revisionDisplay.id,
      );
      setOfficeOnlineDebugInfo({
        configuredScope: response?.configuredScope || null,
        effectiveScope: response?.effectiveScope || null,
        fetchedAt: response?.fetchedAt || null,
      });
      const url =
        response?.url ||
        revisionDisplay.storageEditUrl ||
        revisionDisplay.storageViewUrl;
      if (!url) {
        popup?.close();
        throw new Error("No Office Online edit link is available.");
      }
      if (popup) {
        popup.location.href = url;
        officeOnlineWindowRef.current = popup;
      } else {
        officeOnlineWindowRef.current = window.open(url, "_blank");
      }
      if (response?.url) setOfficeOnlineEditUrl(response.url);
    } catch (error) {
      console.error("Failed to open Office Online edit link", error);
      showToast({
        type: "error",
        title: "Unable to open editor",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          "The Office Online edit link is not available.",
        duration: 3000,
      });
    } finally {
      setIsOpeningOfficeOnline(false);
    }
  };

  const handleOpenPublishingWorkspace = async () => {
    if (!revisionDisplay?.id) {
      showToast({
        type: "warning",
        title: "Revision not ready",
        message:
          "Upload the revision file before opening the publishing workspace.",
      });
      return;
    }

    const revisionRouteId = revisionDisplay.id;
    setIsOpeningWorkspace(true);
    try {
      const opened = await documentApi.openPublishingWorkspace(revisionRouteId);
      const nextRevision = (opened?.revision ||
        revisionDisplay) as RevisionDetailResponse;
      setRevisionRecord(nextRevision);
      setGeneralForm(
        buildGeneralForm(
          locationState,
          nextRevision,
          user?.fullName || user?.username || "",
        ),
      );
      setTrainingInfo(buildTrainingInfo(nextRevision));
      setReviewers(mapReviewersFromRevision(nextRevision.reviewers));
      setApprovers(mapApproversFromRevision(nextRevision.approvers));
      setWorkingNotes(mapWorkingNotes(nextRevision.workingNotes));

      showToast({
        type: "success",
        title: "Publishing workspace opened",
        message: `Revision ${displayValue(nextRevision.documentNumber)} ${displayValue(nextRevision.revisionNumber)} is ready for review packaging.`,
        duration: 3000,
      });

      navigateTo(ROUTES.DOCUMENTS.REVISIONS.PUBLISHING(revisionRouteId), {
        state: buildRevisionDetailNavigationState({
          from: location.pathname + location.search,
          returnTo: location.pathname + location.search,
          workspaceReturnPath: location.pathname + location.search,
          workspaceMode: "create",
          parentDocumentId,
          sourceRevisionId: revisionRouteId,
          revisionId: revisionRouteId,
          documentId: parentDocumentId,
          documentNumber:
            nextRevision.documentNumber || generalForm.documentNumber || "",
          documentName:
            nextRevision.documentName || generalForm.documentName || "",
          revisionNumber:
            nextRevision.revisionNumber || generalForm.revisionNumber || "",
          revisionCreated: nextRevision.created || generalForm.created || "",
          revisionOpenedBy: nextRevision.openedBy || generalForm.openedBy || "",
          documentAuthor: nextRevision.author || generalForm.author || "",
          workspaceState: buildRevisionWorkspaceSourceState({
            id: parentDocumentId,
            documentNumber:
              nextRevision.documentNumber || generalForm.documentNumber || "",
            documentName:
              nextRevision.documentName || generalForm.documentName || "",
            revisionNumber:
              nextRevision.revisionNumber || generalForm.revisionNumber || "",
            created: nextRevision.created || generalForm.created || "",
            openedBy: nextRevision.openedBy || generalForm.openedBy || "",
            author: nextRevision.author || generalForm.author || "",
            businessUnit:
              nextRevision.businessUnit || generalForm.businessUnit || "",
            department: nextRevision.department || generalForm.department || "",
            coAuthors:
              nextRevision.coAuthors?.map((person) => person.fullName) ||
              generalForm.coAuthors ||
              [],
            knowledgeBase:
              nextRevision.knowledgeBase || generalForm.knowledgeBase || "",
            subType: nextRevision.subType || generalForm.subType || "",
            periodicReviewCycle:
              nextRevision.periodicReviewCycle ??
              generalForm.periodicReviewCycle,
            periodicReviewNotification:
              nextRevision.periodicReviewNotification ??
              generalForm.periodicReviewNotification,
            language: nextRevision.language || generalForm.language || "",
            description:
              nextRevision.description || generalForm.description || "",
            isTemplate: Boolean(
              nextRevision.isTemplate ?? generalForm.isTemplate,
            ),
            titleLocalLanguage:
              nextRevision.titleLocalLanguage ||
              generalForm.titleLocalLanguage ||
              "",
            type: nextRevision.type || generalForm.type || "",
            status: nextRevision.status || null,
          }),
          detail: nextRevision,
        }),
      });
    } catch (error) {
      console.error("Failed to open publishing workspace", error);
      showToast({
        type: "error",
        title: "Open workspace failed",
        message:
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          "Unable to open the publishing workspace.",
        duration: 3000,
      });
    } finally {
      setIsOpeningWorkspace(false);
    }
  };

  const handleOpenUploadModal = () => {
    if (!parentDocumentId) {
      showToast({
        type: "error",
        title: "Cannot upload",
        message: "The parent document information is missing.",
      });
      return;
    }

    setShowUploadModal(true);
  };

  const toggleCommentHistory = () => {
    if (commentHistoryOpen) {
      setCommentHistoryOpen(false);
      return;
    }
    setActiveTab("document");
    setCommentHistoryOpen(true);
  };

  const headerActions = (
    <>
      {!revisionDisplay?.id ? (
        <Button
          onClick={handleOpenUploadModal}
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap gap-2"
        >
          Upload Revision
        </Button>
      ) : (
        <>
          {canPersistRevision && (
            <Button
              onClick={handleSaveDraft}
              size="sm"
              variant="outline-emerald"
              disabled={isSaving}
              className="whitespace-nowrap gap-2"
            >
              Save
            </Button>
          )}
          {canEditOnline && (
            <div className="flex flex-col items-start gap-1">
              <Button
                onClick={handleOpenEditFileOnline}
                size="sm"
                variant="outline-emerald"
                disabled={isOpeningOfficeOnline}
                className="whitespace-nowrap gap-2"
              >
                {isOpeningOfficeOnline ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Edit File Online
              </Button>
            </div>
          )}
          {canReplaceRevisionFile && (
            <Button
              onClick={() => replaceFileInputRef.current?.click()}
              size="sm"
              variant="outline-emerald"
              disabled={isReplacingFile}
              className="whitespace-nowrap gap-2"
            >
              {isReplacingFile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {hasRevisionSource ? "Replace Source File" : "Upload Source File"}
            </Button>
          )}
          {canCreateOfficeOnlineCopy && (
            <Button
              onClick={handleUploadToOfficeOnline}
              size="sm"
              variant="outline-emerald"
              disabled={isSyncingOffice}
              className="whitespace-nowrap gap-2"
            >
              {isSyncingOffice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Upload to Office Online
            </Button>
          )}
          {canCompleteEditing && (
            <Button
              onClick={() => setShowCompleteEditingModal(true)}
              size="sm"
              variant="outline-emerald"
              disabled={isCompletingEditing}
              className="whitespace-nowrap gap-2"
            >
              {isCompletingEditing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Complete Editing
            </Button>
          )}

          {canSubmitForReview && (
            <Button
              onClick={() => setShowSubmitForReviewModal(true)}
              size="sm"
              variant="outline-emerald"
              disabled={isSubmittingForReview}
              className="whitespace-nowrap gap-2"
            >
              {isSubmittingForReview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Submit for Review
            </Button>
          )}

          {canOpenPublishingWorkspace && (
            <Button
              onClick={handleOpenPublishingWorkspace}
              size="sm"
              variant="outline-emerald"
              disabled={isOpeningWorkspace}
              className="whitespace-nowrap gap-2"
            >
              {isOpeningWorkspace ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Open Publishing Workspace
            </Button>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      {(isLoadingDetail ||
        isSaving ||
        isOpeningWorkspace ||
        isSyncingOffice ||
        isSubmittingForReview) && <FullPageLoading text="Loading..." />}

      <input
        ref={replaceFileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleReplaceRevisionFile(file);
        }}
      />

      <UploadRevisionModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
        }}
        onConfirm={(file, note, useTemplate, templateRevisionId) => {
          void handleUploadRevisionConfirm(
            file,
            note,
            useTemplate,
            templateRevisionId,
          );
        }}
        documentName={
          generalForm.documentName ||
          sourceDocumentInfo?.documentName ||
          "Revision"
        }
        revisionNumber={
          generalForm.revisionNumber || locationState?.revisionNumber || "0.0.1"
        }
        documentType={String(
          generalForm.type ||
            locationState?.sourceDocument?.type ||
            sourceDocumentInfo?.title ||
            sourceDocumentInfo?.documentName ||
            "",
        )}
        documentSubType={generalForm.subType}
        canUseTemplate={canUseDocumentTemplate}
      />
      <ESignatureModal
        isOpen={showCompleteEditingModal}
        onClose={() => setShowCompleteEditingModal(false)}
        onConfirm={(signature) => handleCompleteEditing(signature)}
        actionTitle="Complete Editing"
        meaningDisplayName="Prepared"
      />
      <ESignatureModal
        isOpen={showSubmitForReviewModal}
        onClose={() => setShowSubmitForReviewModal(false)}
        onConfirm={(signature) => handleSubmitForReview(signature)}
        actionTitle="Submit for Review"
        meaningDisplayName="Submitted for Review"
      />

      <div className="flex flex-col gap-4">
        <PageHeader
          title="Revision Create"
          breadcrumbItems={createRevision(navigate, revisionBreadcrumbFrom)}
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
              {headerActions}
            </>
          }
        />
        {isRejectedRework && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Revision returned for rework</p>
            <p className="mt-1 text-amber-800">
              Review feedback is available in the Document tab. Update the source working copy, then select Complete Editing to synchronize and lock the revised source before the next review round.
            </p>
          </div>
        )}
      </div>

      <WorkflowStepper
        steps={REVISION_WORKFLOW_STEPS}
        currentStepIndex={currentStepIndex}
        skippedSteps={skippedSteps}
      />

      {!revisionDisplay?.id && (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          Upload the revision file first to create the draft revision record.
          After that, you can save the draft and open the publishing workspace.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
          variant="underline"
          layoutId="revision-create-main-tab"
        />

        <div className="p-4 md:p-5">
          {activeTab === "general" && (
            <GeneralInformationTab
              isReadOnly={true}
              document={generalForm}
              onFormChange={setGeneralForm}
            />
          )}

          {activeTab === "workingNotes" && (
            <WorkingNotesTab
              notes={workingNotes}
              onAddNote={handleAddWorkingNote}
              onDeleteNote={handleDeleteWorkingNote}
              isSubmitting={isSaving}
              isReadOnly={true}
            />
          )}

          {activeTab === "infoFromDocument" && (
            <InfoFromDocumentTab
              documentCode={displayValue(
                sourceDocumentInfo?.documentNumber ||
                  generalForm.documentNumber,
                "",
              )}
              documentName={displayValue(
                sourceDocumentInfo?.documentName || generalForm.documentName,
                "",
              )}
              documentCreated={displayValue(
                sourceDocumentInfo?.created || locationState?.documentCreated,
                "",
              )}
            />
          )}

          {activeTab === "training" && (
            <TrainingInformationTab
              isReadOnly={true}
              data={trainingInfo}
              onChange={setTrainingInfo}
            />
          )}

          {activeTab === "reviewers" && (
            <RevisionWorkspaceReviewersTab reviewers={reviewers} />
          )}

          {activeTab === "approvers" && (
            <RevisionWorkspaceApproversTab approvers={approvers} />
          )}

          {activeTab === "document" && (
            <>
              {isEditable && reviewComments.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm mb-3 text-emerald-900">
                  <p className="font-semibold">Review feedback — Round {currentReviewRound}</p>
                  <p className="mt-1 text-emerald-800">
                    This view retains the revision PDF and all Reviewer/Approver comments while you update the source working copy.
                  </p>
                </div>
              )}
              <DocumentTab
                documentFile={revisionFile}
                previewStatus={previewStatus}
                previewMessage={previewMessage}
                revisionId={revisionDisplay?.id}
              />
            </>
          )}

          {activeTab === "signatures" && (
            <SignaturesTab
              records={signatureRecords}
              revisionId={sourceRevisionId || revisionDisplay?.id || ""}
            />
          )}

          {activeTab === "audit" && (
            <AuditTrailTab
              entityId={revisionDisplay?.id || undefined}
              entityType="Revision"
              emptyMessage="No audit trail records available for this revision."
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-2">
        <Button
          onClick={handleBack}
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
        >
          Back
        </Button>
        {!revisionDisplay?.id ? (
          <Button
            onClick={handleOpenUploadModal}
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
          >
            Upload Revision
          </Button>
        ) : (
          <>
            {canPersistRevision && (
              <Button
                onClick={handleSaveDraft}
                size="sm"
                variant="outline-emerald"
                disabled={isSaving}
                className="whitespace-nowrap gap-2"
              >
                Save
              </Button>
            )}
            {canEditOnline && (
              <div className="flex flex-col items-start gap-1">
                <Button
                  onClick={handleOpenEditFileOnline}
                  size="sm"
                  variant="outline-emerald"
                  disabled={isOpeningOfficeOnline}
                  className="whitespace-nowrap gap-2"
                >
                  {isOpeningOfficeOnline ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Edit File Online
                </Button>
              </div>
            )}
            {canReplaceRevisionFile && (
              <Button
                onClick={() => replaceFileInputRef.current?.click()}
                size="sm"
                variant="outline-emerald"
                disabled={isReplacingFile}
                className="whitespace-nowrap gap-2"
              >
                {isReplacingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {hasRevisionSource ? "Replace Source File" : "Upload Source File"}
              </Button>
            )}
            {canCreateOfficeOnlineCopy && (
              <Button
                onClick={handleUploadToOfficeOnline}
                size="sm"
                variant="outline-emerald"
                disabled={isSyncingOffice}
                className="whitespace-nowrap gap-2"
              >
                {isSyncingOffice ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Upload to Office Online
              </Button>
            )}
            {canCompleteEditing && (
              <Button
                onClick={() => setShowCompleteEditingModal(true)}
                size="sm"
                variant="outline-emerald"
                disabled={isCompletingEditing}
                className="whitespace-nowrap gap-2"
              >
                {isCompletingEditing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Complete Editing
              </Button>
            )}
            {canSubmitForReview && (
              <Button
                onClick={() => setShowSubmitForReviewModal(true)}
                size="sm"
                variant="outline-emerald"
                disabled={isSubmittingForReview}
                className="whitespace-nowrap gap-2"
              >
                {isSubmittingForReview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Submit for Review
              </Button>
            )}
            {canOpenPublishingWorkspace && (
              <Button
                onClick={handleOpenPublishingWorkspace}
                size="sm"
                variant="outline-emerald"
                disabled={isOpeningWorkspace}
                className="whitespace-nowrap gap-2"
              >
                {isOpeningWorkspace ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Open Publishing Workspace
              </Button>
            )}
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={[{ id: "originalDocument", label: "Document Master" }]}
          activeTab="originalDocument"
          onChange={() => {}}
        />
        <div className="p-4 md:p-5">
          <OriginalDocumentTab
            document={sourceDocumentInfo}
            returnTo={location.pathname + location.search}
            returnState={locationState}
          />
        </div>
      </div>
    </div>
  );
};

export const RevisionCreateView: React.FC = () => {
  const isInRouter = useInRouterContext();

  if (!isInRouter) {
    return <FullPageLoading text="Loading revision workspace..." />;
  }

  return <RevisionCreateViewContent />;
};

export default RevisionCreateView;
