import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { UploadRevisionModal } from "./UploadRevisionModal";
import { formatDocumentTypeLookupLabel, matchesDocumentTypeLabel } from "@/features/documents/shared/documentTypeDisplay";
import { useToast } from "@/components/ui/toast";
import { useNavigateWithLoading } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentPermissions } from "@/features/documents/shared/useDocumentPermissions";
import { documentApi } from "@/services/api/documents";
import { dictionaryApi } from "@/services/api/dictionary";
import { settingsApi } from "@/services/api/settings";
import { securityApi } from "@/services/api/security";
import { auditTrailApi } from "@/services/api/auditTrail";
import { secureStorage } from "@/utils/security";
import { collectExcludedWorkflowParticipantIds } from "@/features/documents/shared/workflowParticipantFilters";
import {
  GeneralTab,
  TrainingTab,
  type TrainingConfig,
  SignaturesTab,
  AuditTab,
  DocumentTab,
  type UploadedFile,
  DocumentRevisionsTab,
  ReviewersTab,
  ApproversTab,
  ControlledCopiesTab,
  RelatedDocumentsTab,
  CorrelatedDocumentsTab,
  DocumentRelationships,
  type ParentDocument,
  type RelatedDocument,
  type Revision,
} from "@/features/documents/document-list/document-creation/new-tabs";
import type {
  DocumentDetailResponse,
} from "@/features/documents/document-list/types";
import type { DocumentType, DocumentStatus } from "@/features/documents/types";
import {
  documentWorkflowStepIndex,
  DOCUMENT_WORKFLOW_STEPS,
  mapRevisionSummaryFromApi,
  normalizeDocumentStatusForStepper,
} from "@/features/documents/shared/statusMapping";
import { canObsoleteDocumentWithRevisionHistory } from "@/features/documents/shared/documentLifecycleActions";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { newDocument } from "@/components/ui/breadcrumb/breadcrumbs.config";
import {
  buildPreviewVersionCacheBuster,
  loadPdfPreviewFile,
  resolveRevisionPreviewVersionToken,
} from "@/features/documents/shared/previewHelpers";

const extractApiMessage = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const candidate = error as {
    response?: {
      data?: {
        error?: { message?: string };
        message?: string;
      };
    };
    message?: string;
  };

  return (
    candidate.response?.data?.error?.message ||
    candidate.response?.data?.message ||
    candidate.message ||
    fallback
  );
};

// --- Types ---
type TabType = "general" | "training" | "document" | "signatures" | "audit";
type SaveAction = "save" | "next-step";
type SubTabId =
  | "revisions"
  | "reviewers"
  | "approvers"
  | "copies"
  | "related"
  | "correlated";

import type { Reviewer, Approver } from "@/features/documents/types";

type WorkflowUserOption = {
  id: string;
  employeeCode: string;
  fullName: string;
  username: string;
  position: string;
  department: string;
  email: string;
};

type LookupOption = {
  label: string;
  value: string;
};

type DocumentTypeLookupOption = LookupOption & {
  shortCode: string;
};

type SubTypeLookupOption = LookupOption & {
  documentTypeId: string;
  documentType: string;
  reviewRequirement: "NONE" | "SINGLE" | "MULTIPLE";
};

type DepartmentLookupOption = LookupOption & {
  businessUnit?: string;
};

type NewDocumentDraftSnapshot = {
  activeTab?: TabType;
  activeSubtab?: SubTabId;
  screenMode?: "create" | "edit";
  id?: string | null;
  documentNumber?: string;
  createdDateTime?: string;
  owner?: string;
  openedBy?: string;
  isSaved?: boolean;
  isWorkflowSaved?: boolean;
  isRevisionUploaded?: boolean;
  revisionFile?: File | null;
  status?: DocumentStatus;
  formData?: typeof defaultFormData;
  trainingConfig?: TrainingConfig;
  reviewers?: Reviewer[];
  approvers?: Approver[];
  relationshipDocs?: RelatedDocument[];
  correlatedDocuments?: ParentDocument[];
  revisions?: Revision[];
};

const NEW_DOCUMENT_DRAFT_STORAGE_KEY = "eqms.documents.new-document.draft";
const NEW_DOCUMENT_DRAFT_RESUME_KEY = "eqms.documents.new-document.resume";
const REVISION_LIST_REFRESH_KEY = "eqms.documents.revisions.refresh";
const SESSION_SAVE_REQUEST_EVENT = "eqms:session-timeout-save-request";

const readPersistedNewDocumentDraft = (): NewDocumentDraftSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(NEW_DOCUMENT_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as NewDocumentDraftSnapshot;
  } catch {
    return null;
  }
};

const persistNewDocumentDraft = (snapshot: NewDocumentDraftSnapshot) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(NEW_DOCUMENT_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  window.sessionStorage.setItem(NEW_DOCUMENT_DRAFT_RESUME_KEY, "true");
};

const clearNewDocumentDraft = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(NEW_DOCUMENT_DRAFT_STORAGE_KEY);
  window.sessionStorage.removeItem(NEW_DOCUMENT_DRAFT_RESUME_KEY);
};

const markRevisionListForRefresh = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(REVISION_LIST_REFRESH_KEY, String(Date.now()));
};

const shouldResumePersistedNewDocumentDraft = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(NEW_DOCUMENT_DRAFT_RESUME_KEY) === "true";
};

const isRestorableNewDocumentDraft = (snapshot?: NewDocumentDraftSnapshot | null) => {
  if (!snapshot) {
    return false;
  }

  const status = mapDocumentStatusToLocal(snapshot.status);
  return status === "Draft" || status === "Active";
};

const defaultFormData = {
  documentName: "",
  type: "" as DocumentType,
  author: "",
  coAuthors: [] as (string | number)[],
  businessUnit: "",
  department: "",
  knowledgeBase: "",
  subType: "",
  periodicReviewCycle: 0,
  periodicReviewNotification: 0,
  language: "English",
  reviewDate: "",
  description: "",
  isTemplate: false,
  titleLocalLanguage: "",
};

const defaultTrainingConfig: TrainingConfig = {
  isRequired: false,
  trainingPeriodDays: null,
  reasonForSkippingTraining: "",
};

const toWorkflowUserOption = (user: { id: string; employeeCode?: string | null; fullName?: string | null; username?: string | null; position?: string | null; department?: string | null; email?: string | null; }) => ({
  id: user.id,
  employeeCode: user.employeeCode || user.username || user.id,
  fullName: user.fullName || user.username || user.id,
  username: user.username || "",
  position: user.position || "",
  department: user.department || "",
  email: user.email || "",
});

const toSelectOption = (user: WorkflowUserOption) => ({
  label: user.employeeCode ? `${user.employeeCode} - ${user.fullName}` : user.fullName,
  value: user.id,
});

const resolveLookupValue = (
  candidate: string,
  options: { label: string; value: string }[],
) => options.find((option) => option.value === candidate || matchesDocumentTypeLabel(candidate, option.label) || option.label === candidate)?.value || candidate;

const resolveLookupLabel = (
  candidate: string,
  options: { label: string; value: string }[],
) => options.find((option) => option.value === candidate || option.label === candidate)?.label || candidate;

const resolveWorkflowUser = (value: string, users: WorkflowUserOption[]) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return null;
  }

  return (
    users.find(
      (user) =>
        user.id === normalizedValue ||
        user.fullName === normalizedValue ||
        user.username === normalizedValue ||
        user.employeeCode === normalizedValue,
    ) || null
  );
};

const normalizeCoAuthorValues = (values: (string | number)[], users: WorkflowUserOption[]) =>
  (values || [])
    .map((value) => {
      const matchedUser = resolveWorkflowUser(String(value), users);
      return matchedUser?.id || String(value);
    })
    .filter(Boolean);

const readStoredUser = () => {
  try {
    const raw = secureStorage.getItem("user", true);
    if (!raw) return null;
    return JSON.parse(raw) as {
      id?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      username?: string;
    };
  } catch {
    return null;
  }
};

const mapDocumentStatusToLocal = (status?: string | null, statusInfo?: { id?: string; name?: string } | null): DocumentStatus =>
  normalizeDocumentStatusForStepper(status, statusInfo);

const mapRelationDocument = (doc: {
  id: string;
  documentNumber: string;
  documentName: string;
  revisionNumber: string;
  status: string;
  type: string;
  businessUnit: string;
  department: string;
  author: string;
  openedBy: string;
  created?: string;
  createdDate?: string;
  effectiveDate: string;
  validUntil: string;
}): RelatedDocument => ({
  id: doc.id,
  documentNumber: doc.documentNumber,
  created: doc.created || doc.createdDate || "",
  openedBy: doc.openedBy || "",
  documentName: doc.documentName,
  status: doc.status as DocumentStatus,
  type: doc.type,
  revisionNumber: doc.revisionNumber,
  department: doc.department,
  authorCoAuthor: doc.author,
  effectiveDate: doc.effectiveDate || "",
  validUntil: doc.validUntil || "",
});

const mapRevisionSummaryToLocal = (revision: DocumentDetailResponse["revisions"][number]): Revision => {
  const mapped = mapRevisionSummaryFromApi(revision);
  return {
    id: mapped.id,
    revisionNumber: mapped.revisionNumber,
    created: mapped.created,
    openedBy: mapped.openedBy,
    revisionName: mapped.revisionName,
    status: mapped.status as Revision["status"],
    statusLabel: mapped.statusLabel,
    canOpenAuthoringWorkspace: Boolean(revision.canOpenAuthoringWorkspace),
  };
};

const mapWorkspaceRevisionSummaryToLocal = (revision: {
  id: string;
  revisionNumber: string;
  created: string;
  openedBy: string;
  revisionName: string;
  state?: string;
  status?: string;
  statusCode?: string;
  statusInfo?: { id?: string; name?: string };
  canOpenAuthoringWorkspace?: boolean;
}): Revision => {
  const mapped = mapRevisionSummaryFromApi(revision);
  return {
    id: mapped.id,
    revisionNumber: mapped.revisionNumber,
    created: mapped.created,
    openedBy: mapped.openedBy,
    revisionName: mapped.revisionName,
    status: mapped.status as Revision["status"],
    statusLabel: mapped.statusLabel,
    canOpenAuthoringWorkspace: Boolean(revision.canOpenAuthoringWorkspace),
  };
};

export const NewDocumentView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeDocumentId } = useParams<{ id?: string }>();
  const { showToast } = useToast();
  const { user } = useAuth();
  const {
    canAdministerDocumentWorkspace,
    canConfigureInitialDocumentWorkflow,
    canManageDocumentTemplate: canManageTemplates,
    canUseDocumentTemplate: canUseTemplate,
  } = useDocumentPermissions();
  const storedUser = readStoredUser();
  const locationState = location.state as any;
  const preloadedDocumentDetail = locationState?.preloadedDocumentDetail as DocumentDetailResponse | undefined;
  const revisionWorkspaceState = locationState?.workspaceState ?? null;
  const revisionWorkspaceReturnPath = locationState?.workspaceReturnPath as string | undefined;
  const revisionWorkspaceFallbackRevisions: Revision[] = Array.isArray(revisionWorkspaceState?.documentRevisions)
    ? revisionWorkspaceState.documentRevisions.map(mapWorkspaceRevisionSummaryToLocal)
    : [];

  // Helper to read initial state from navigation
  const getInitialData = () => {
    const locState = location.state as any;
    const navigationDraft = locState?.documentData as NewDocumentDraftSnapshot | undefined;
    const explicitDocumentId = String(
      routeDocumentId || navigationDraft?.id || preloadedDocumentDetail?.id || "",
    ).trim();
    const mergeWorkspaceRevisions = (snapshot?: NewDocumentDraftSnapshot | null): NewDocumentDraftSnapshot | null => {
      if (!snapshot) {
        return null;
      }

      return {
        ...snapshot,
        isSaved: snapshot.isSaved ?? Boolean(revisionWorkspaceFallbackRevisions.length),
        isWorkflowSaved: snapshot.isWorkflowSaved ?? Boolean(revisionWorkspaceFallbackRevisions.length),
        revisions:
          snapshot.revisions?.length
            ? snapshot.revisions
            : revisionWorkspaceFallbackRevisions,
        reviewers:
          snapshot.reviewers?.length
            ? snapshot.reviewers
            : revisionWorkspaceState?.revisionReviewers || snapshot.reviewers || [],
        approvers:
          snapshot.approvers?.length
            ? snapshot.approvers
            : revisionWorkspaceState?.revisionApprovers || snapshot.approvers || [],
        relationshipDocs:
          snapshot.relationshipDocs?.length
            ? snapshot.relationshipDocs
            : revisionWorkspaceState?.relationshipDocs || snapshot.relationshipDocs || [],
        correlatedDocuments:
          snapshot.correlatedDocuments?.length
            ? snapshot.correlatedDocuments
            : revisionWorkspaceState?.correlatedDocuments || snapshot.correlatedDocuments || [],
      };
    };

    // An explicit document ID means this is an Edit/Resume flow. It must take
    // precedence over any old session draft and always be hydrated from the API.
    if (explicitDocumentId) {
      return mergeWorkspaceRevisions({
        ...navigationDraft,
        id: explicitDocumentId,
        screenMode: "edit",
        isSaved: true,
      });
    }

    if (isRestorableNewDocumentDraft(navigationDraft)) {
      return mergeWorkspaceRevisions(navigationDraft);
    }

    if (shouldResumePersistedNewDocumentDraft()) {
      const persistedDraft = readPersistedNewDocumentDraft();
      if (isRestorableNewDocumentDraft(persistedDraft)) {
        return mergeWorkspaceRevisions(persistedDraft);
      }
    }

    const persistedDraft = readPersistedNewDocumentDraft();
    if (persistedDraft) {
      clearNewDocumentDraft();
    }

    if (revisionWorkspaceFallbackRevisions.length > 0) {
      return {
        activeTab: "general",
        screenMode: locState?.documentData?.screenMode === "edit" ? "edit" : "create",
        revisions: revisionWorkspaceFallbackRevisions,
        reviewers: revisionWorkspaceState?.revisionReviewers || [],
        approvers: revisionWorkspaceState?.revisionApprovers || [],
        relationshipDocs: revisionWorkspaceState?.relationshipDocs || [],
        correlatedDocuments: revisionWorkspaceState?.correlatedDocuments || [],
        isSaved: true,
        isWorkflowSaved: true,
      } as NewDocumentDraftSnapshot;
    }

    return null;
  };
  const initialData = getInitialData();
  const screenMode = initialData?.screenMode === "edit" ? "edit" : "create";

  const [activeTab, setActiveTab] = useState<TabType>(initialData?.activeTab || "general");
  const [isSaving, setIsSaving] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [validationModalMessage, setValidationModalMessage] =
    useState<React.ReactNode>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelActivitySummary, setCancelActivitySummary] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showBackSaveModal, setShowBackSaveModal] = useState(false);
  const [saveAction, setSaveAction] = useState<SaveAction>("save");
  const [isObsoleteModalOpen, setIsObsoleteModalOpen] = useState(false);
  const [isUploadRevisionModalOpen, setIsUploadRevisionModalOpen] =
    useState(false);
  const [canStartInitialAuthoring, setCanStartInitialAuthoring] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isLookupLoading, setIsLookupLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(initialData?.isSaved ?? false);
  const [isWorkflowSaved, setIsWorkflowSaved] = useState(
    initialData?.isWorkflowSaved ?? false,
  );
  const [isRevisionUploaded, setIsRevisionUploaded] = useState(initialData?.isRevisionUploaded ?? false);
  const [uploadedRevisionFile, setUploadedRevisionFile] = useState<File | null>(
    initialData?.revisionFile || null,
  );
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>(initialData?.status || "Draft");
  const [documentId, setDocumentId] = useState<string | null>(initialData?.id || null);
  const [canCancelDocument, setCanCancelDocument] = useState(false);
  const [canObsoleteDocument, setCanObsoleteDocument] = useState(false);
  const [maxRevisionFileSizeMB, setMaxRevisionFileSizeMB] = useState(25);
  const [workflowUsers, setWorkflowUsers] = useState<WorkflowUserOption[]>([]);
  // Co-author display names as returned by the backend (already resolved server-side,
  // via DocumentDetailResponse.coAuthors[].fullName) — used directly for the read-only
  // display instead of re-resolving formData.coAuthors (raw user IDs) against the
  // workflowUsers lookup, which can be empty/stale right after hydration and would
  // otherwise fall back to showing the raw UUID.
  const [coAuthorDisplayItems, setCoAuthorDisplayItems] = useState<{ id: string; fullName: string }[]>([]);
  const searchWorkflowUsers = useCallback(async (query: string) => {
    const results = await securityApi.getEligibleUsers("documents.document.view", query);
    return (results || []).map(toWorkflowUserOption).map(toSelectOption);
  }, []);
  const [businessUnitOptions, setBusinessUnitOptions] = useState<LookupOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentLookupOption[]>([]);
  const [documentTypeOptions, setDocumentTypeOptions] = useState<LookupOption[]>([]);
  const [documentTypeLookupOptions, setDocumentTypeLookupOptions] = useState<DocumentTypeLookupOption[]>([]);
  const [subTypeLookupOptions, setSubTypeLookupOptions] = useState<SubTypeLookupOption[]>([]);
  // Subtab states
  const [activeSubtab, setActiveSubtab] = useState<SubTabId>("revisions");
  const [isReviewerModalOpen, setIsReviewerModalOpen] = useState(false);
  const [isApproverModalOpen, setIsApproverModalOpen] = useState(false);
  const [isRelatedModalOpen, setIsRelatedModalOpen] = useState(false);
  const [isCorrelatedModalOpen, setIsCorrelatedModalOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>(initialData?.revisions || revisionWorkspaceFallbackRevisions || []);
  const [relationshipDocs, setRelationshipDocs] = useState<RelatedDocument[]>(
    initialData?.relationshipDocs || revisionWorkspaceState?.relationshipDocs || [],
  );
  const hasUploadedRevision =
    isRevisionUploaded || Boolean(uploadedRevisionFile) || revisions.length > 0;

  // Auto-generated fields
  const [documentNumber, setDocumentNumber] = useState<string>(initialData?.documentNumber || "");
  const [createdDateTime, setCreatedDateTime] = useState<string>(initialData?.createdDateTime || "");
  const [documentOwner, setDocumentOwner] = useState<string>(
    initialData?.owner ||
      storedUser?.fullName ||
      user?.fullName ||
      storedUser?.username ||
      user?.username ||
      "",
  );

  // Set openedBy immediately with current user fullname
  const [openedBy, setOpenedBy] = useState<string>(
    storedUser?.fullName?.trim() ||
      [storedUser?.firstName, storedUser?.lastName].filter(Boolean).join(" ").trim() ||
      storedUser?.username ||
      "Current User",
  );

  // Reviewers and Approvers state
  const [reviewers, setReviewers] = useState<Reviewer[]>(initialData?.reviewers || revisionWorkspaceState?.revisionReviewers || []);
  const [approvers, setApprovers] = useState<Approver[]>(initialData?.approvers || revisionWorkspaceState?.revisionApprovers || []);
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>(initialData?.trainingConfig || defaultTrainingConfig);

  // File state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadDocumentSettings = async () => {
      try {
        const config = await settingsApi.getSystemConfiguration();
        const maxSize = Number(config?.documents?.maxFileSizeMB);
        if (mounted && Number.isFinite(maxSize) && maxSize > 0) {
          setMaxRevisionFileSizeMB(maxSize);
        }
      } catch (error) {
        console.warn("Failed to load document settings, falling back to default max file size:", error);
      } finally {
        if (mounted) {
          setIsSettingsLoading(false);
        }
      }
    };

    void loadDocumentSettings();
    return () => {
      mounted = false;
    };
  }, []);

  // Document Relationships state
  const [correlatedDocuments, setCorrelatedDocuments] = useState<ParentDocument[]>(initialData?.correlatedDocuments || revisionWorkspaceState?.correlatedDocuments || []);
  const [suggestedDocumentCode, setSuggestedDocumentCode] =
    useState<string>("");

  const [formData, setFormData] = useState({
    ...defaultFormData,
    ...(initialData?.formData || {}),
  });

  // A controlled document template follows the normal lifecycle, but it can never
  // create a training obligation. Keep the client state aligned with the server rule.
  useEffect(() => {
    if (!formData.isTemplate) return;
    setTrainingConfig((current) => current.isRequired || current.trainingPeriodDays || current.reasonForSkippingTraining
      ? defaultTrainingConfig
      : current);
    if (activeTab === "training") setActiveTab("general");
  }, [activeTab, formData.isTemplate]);

  const selectedAuthor = resolveWorkflowUser(String(formData.author || ""), workflowUsers);
  // Author-only source upload is assignment-based. Compare persistent user IDs
  // only: display names and configurable role labels are not authorization data.
  const normalizedCurrentUserIds = [
    user?.id,
    storedUser?.id,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const normalizedSelectedAuthorIds = [
    selectedAuthor?.id,
    formData.author,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const canCurrentUserUploadRevision =
    canStartInitialAuthoring ||
    normalizedCurrentUserIds.some((value) => normalizedSelectedAuthorIds.includes(value));
  const canManageDocumentSetup =
    canConfigureInitialDocumentWorkflow && !isWorkflowSaved;
  const normalizedSelectedCoAuthors = Array.from(
    new Set(
      (formData.coAuthors || [])
        .flatMap((value) => {
          const matchedUser = resolveWorkflowUser(String(value), workflowUsers);
          return [
            matchedUser?.id,
            matchedUser?.username,
            matchedUser?.fullName,
            value,
          ];
        })
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  const excludedWorkflowUserIds = useMemo(
    () => collectExcludedWorkflowParticipantIds(workflowUsers, [formData.author, ...(formData.coAuthors || [])]),
    [workflowUsers, formData.author, formData.coAuthors],
  );
  const isWorkflowContributor = normalizedCurrentUserIds.some((value) =>
    normalizedSelectedAuthorIds.includes(value) || normalizedSelectedCoAuthors.includes(value),
  );
  const isContributorReadOnly = !canAdministerDocumentWorkspace && isWorkflowContributor;
  const [lastSavedPayload, setLastSavedPayload] = useState<any>(null);
  const [auditTrailRows, setAuditTrailRows] = useState<any[]>([]);

  const getPayload = () => {
    const normalizedDocumentType = resolveLookupValue(formData.type, documentTypeLookupOptions);
    const normalizedBusinessUnit = resolveLookupValue(formData.businessUnit, businessUnitOptions);
    const normalizedDepartment = resolveLookupValue(formData.department, departmentOptions);
    const normalizedAuthor = resolveWorkflowUser(formData.author, workflowUsers)?.id || formData.author;
    const normalizedCoAuthorIds = Array.from(
      new Set(
        formData.coAuthors
          .map((value) => resolveWorkflowUser(String(value), workflowUsers)?.id || String(value))
          .filter(Boolean),
      ),
    );
    const selectedDepartmentLabel = resolveLookupLabel(normalizedDepartment, departmentOptions);
    const selectedKnowledgeBase =
      resolveLookupLabel(String(formData.knowledgeBase || ""), departmentOptions) ||
      selectedDepartmentLabel ||
      String(formData.knowledgeBase || "").trim();
    return {
      documentName: formData.documentName.trim(),
      titleLocalLanguage: formData.titleLocalLanguage.trim() || undefined,
      documentType: normalizedDocumentType || formData.type,
      author: normalizedAuthor,
      businessUnit: normalizedBusinessUnit || formData.businessUnit,
      department: normalizedDepartment || formData.department,
      knowledgeBase: selectedKnowledgeBase || undefined,
      subType: formData.subType.trim() || undefined,
      periodicReviewCycle: formData.periodicReviewCycle || undefined,
      periodicReviewNotification: formData.periodicReviewNotification || undefined,
      language: formData.language || undefined,
      reviewDate: formData.reviewDate.trim() || undefined,
      requiresTraining: formData.isTemplate ? false : trainingConfig.isRequired,
      trainingPeriodDays: !formData.isTemplate && trainingConfig.isRequired
        ? Number(trainingConfig.trainingPeriodDays)
        : undefined,
      reasonForSkippingTraining: formData.isTemplate || trainingConfig.isRequired
        ? undefined
        : trainingConfig.reasonForSkippingTraining.trim() || undefined,
      description: formData.description.trim() || undefined,
      isTemplate: formData.isTemplate,
      coAuthorIds: normalizedCoAuthorIds,
      reviewerUserIds: reviewRequirement === "NONE" ? [] : reviewers.map((reviewer) => String(reviewer.id)).filter(Boolean),
      approverUserIds: approvers.map((approver) => String(approver.id)).filter(Boolean),
      relatedDocumentIds: relationshipDocs.map((doc) => String(doc.id)).filter(Boolean),
      correlatedDocumentIds: correlatedDocuments.map((doc) => String(doc.id)).filter(Boolean),
    };
  };

  const isPayloadEqual = (p1: any, p2: any) => {
    if (!p1 || !p2) return false;
    
    const arrayEqual = (a1: any[], a2: any[]) => {
      if (a1.length !== a2.length) return false;
      const sorted1 = [...a1].sort();
      const sorted2 = [...a2].sort();
      return sorted1.every((val, index) => val === sorted2[index]);
    };

    return (
      (p1.documentName || "") === (p2.documentName || "") &&
      (p1.titleLocalLanguage || "") === (p2.titleLocalLanguage || "") &&
      (p1.documentType || "") === (p2.documentType || "") &&
      (p1.author || "") === (p2.author || "") &&
      (p1.businessUnit || "") === (p2.businessUnit || "") &&
      (p1.department || "") === (p2.department || "") &&
      (p1.knowledgeBase || "") === (p2.knowledgeBase || "") &&
      (p1.subType || "") === (p2.subType || "") &&
      Number(p1.periodicReviewCycle || 0) === Number(p2.periodicReviewCycle || 0) &&
      Number(p1.periodicReviewNotification || 0) === Number(p2.periodicReviewNotification || 0) &&
      (p1.language || "") === (p2.language || "") &&
      (p1.reviewDate || "") === (p2.reviewDate || "") &&
      Boolean(p1.requiresTraining) === Boolean(p2.requiresTraining) &&
      Number(p1.trainingPeriodDays || 0) === Number(p2.trainingPeriodDays || 0) &&
      (p1.reasonForSkippingTraining || "") === (p2.reasonForSkippingTraining || "") &&
      (p1.description || "") === (p2.description || "") &&
      Boolean(p1.isTemplate) === Boolean(p2.isTemplate) &&
      arrayEqual(p1.coAuthorIds || [], p2.coAuthorIds || []) &&
      arrayEqual(p1.reviewerUserIds || [], p2.reviewerUserIds || []) &&
      arrayEqual(p1.approverUserIds || [], p2.approverUserIds || []) &&
      arrayEqual(p1.relatedDocumentIds || [], p2.relatedDocumentIds || []) &&
      arrayEqual(p1.correlatedDocumentIds || [], p2.correlatedDocumentIds || [])
    );
  };

  const getDisplayLabel = (options: LookupOption[], value?: string) =>
    options.find((option) => option.value === value || option.label === value)?.label ||
    (value ? value : "—");

  const getUserDisplayName = (id?: string) => {
    const matched = resolveWorkflowUser(String(id || ""), workflowUsers);
    return matched?.fullName || (id ? id : "—");
  };

  // Diff between the last-saved General/Training values and the current in-progress edits,
  // shown to the user for before/after confirmation when they click Save after Next Step.
  const buildSaveChangeSummary = (): { label: string; before: string; after: string }[] => {
    if (!lastSavedPayload) return [];
    const current = getPayload();
    const rows: { label: string; before: string; after: string }[] = [];
    const push = (
      label: string,
      beforeRaw: unknown,
      afterRaw: unknown,
      formatter: (value: unknown) => string = (value) =>
        value === undefined || value === null || value === "" ? "—" : String(value),
    ) => {
      const beforeStr = formatter(beforeRaw);
      const afterStr = formatter(afterRaw);
      if (beforeStr !== afterStr) {
        rows.push({ label, before: beforeStr, after: afterStr });
      }
    };

    push("Document Name", lastSavedPayload.documentName, current.documentName);
    push("Title in Local Language", lastSavedPayload.titleLocalLanguage, current.titleLocalLanguage);
    push("Document Type", lastSavedPayload.documentType, current.documentType, (v) =>
      // Must resolve through resolveLookupValue first (same fuzzy "SOP - Standard Operating
      // Procedure" vs "Standard Operating Procedure" matching getPayload() uses via
      // matchesDocumentTypeLabel), or a value captured before/after a hydration round-trip can
      // end up compared in two different raw representations of the exact same type -- showing
      // a false "changed" diff for a field the user never touched.
      getDisplayLabel(documentTypeOptions, resolveLookupValue(String(v ?? ""), documentTypeLookupOptions)),
    );
    push("Author", lastSavedPayload.author, current.author, (v) => getUserDisplayName(v as string));
    push("Business Unit", lastSavedPayload.businessUnit, current.businessUnit, (v) =>
      getDisplayLabel(businessUnitOptions, resolveLookupValue(String(v ?? ""), businessUnitOptions)),
    );
    push("Department", lastSavedPayload.department, current.department, (v) =>
      getDisplayLabel(departmentOptions, resolveLookupValue(String(v ?? ""), departmentOptions)),
    );
    push("Sub-Type", lastSavedPayload.subType, current.subType);
    push("Periodic Review Cycle (Months)", lastSavedPayload.periodicReviewCycle, current.periodicReviewCycle);
    push(
      "Periodic Review Notification (Days)",
      lastSavedPayload.periodicReviewNotification,
      current.periodicReviewNotification,
    );
    push("Language", lastSavedPayload.language, current.language);
    push("Description", lastSavedPayload.description, current.description);
    push("Is Template?", lastSavedPayload.isTemplate, current.isTemplate, (v) => (v ? "Yes" : "No"));
    push("Requires Training", lastSavedPayload.requiresTraining, current.requiresTraining, (v) =>
      v ? "Yes" : "No",
    );
    push("Training Period (Days)", lastSavedPayload.trainingPeriodDays, current.trainingPeriodDays);
    push(
      "Reason for Skipping Training",
      lastSavedPayload.reasonForSkippingTraining,
      current.reasonForSkippingTraining,
    );

    return rows;
  };

  useEffect(() => {
    if (isSaved && workflowUsers.length > 0 && !lastSavedPayload && formData.documentName) {
      setLastSavedPayload(getPayload());
    }
  }, [isSaved, workflowUsers, formData, lastSavedPayload]);

  useEffect(() => {
    const excludedIds = new Set(excludedWorkflowUserIds);
    if (excludedIds.size === 0) {
      return;
    }

    const normalizeId = (value: string | number | null | undefined) => String(value || "").trim().toLowerCase();
    const removeExcludedReviewers = (items: Reviewer[]) => {
      const filtered = items.filter((item) => !excludedIds.has(normalizeId(item.id)));
      if (filtered.length === items.length) {
        return items;
      }
      return filtered.map((item, index) => ({ ...item, order: index + 1 }));
    };
    const removeExcludedApprovers = (items: Approver[]) => {
      const filtered = items.filter((item) => !excludedIds.has(normalizeId(item.id)));
      return filtered.length === items.length ? items : filtered;
    };

    setFormData((prev) => {
      const authorMatch = resolveWorkflowUser(String(prev.author || ""), workflowUsers);
      const authorId = normalizeId(authorMatch?.id || prev.author);
      const coAuthorValues = (prev.coAuthors || []).filter((value) => normalizeId(value) !== authorId);
      if (coAuthorValues.length === prev.coAuthors.length) {
        return prev;
      }
      return {
        ...prev,
        coAuthors: coAuthorValues,
      };
    });

    setReviewers((prev) => removeExcludedReviewers(prev));
    setApprovers((prev) => removeExcludedApprovers(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludedWorkflowUserIds, workflowUsers]);

  useEffect(() => {
    const handleSessionSaveRequest = () => {
      persistNewDocumentDraft({
        activeTab,
        activeSubtab,
        screenMode,
        id: documentId,
        documentNumber,
        createdDateTime,
        owner: documentOwner,
        openedBy,
        isSaved,
        isWorkflowSaved,
        isRevisionUploaded,
        status: documentStatus,
        formData,
        trainingConfig,
        reviewers,
        approvers,
        relationshipDocs,
        correlatedDocuments,
        revisions,
      });
    };

    window.addEventListener(SESSION_SAVE_REQUEST_EVENT, handleSessionSaveRequest);

    if (!documentId || !isSaved) {
      // Keep listening for session save requests even before first save.
    }

    persistNewDocumentDraft({
      activeTab,
      activeSubtab,
      screenMode,
      id: documentId,
      documentNumber,
      createdDateTime,
      owner: documentOwner,
      openedBy,
      isSaved,
      isWorkflowSaved,
      isRevisionUploaded,
      status: documentStatus,
      formData,
      trainingConfig,
      reviewers,
      approvers,
      relationshipDocs,
      correlatedDocuments,
      revisions,
    });
    return () => {
      window.removeEventListener(SESSION_SAVE_REQUEST_EVENT, handleSessionSaveRequest);
    };
  }, [
    activeTab,
    activeSubtab,
    approvers,
    correlatedDocuments,
    createdDateTime,
    documentId,
    documentNumber,
    documentOwner,
    documentStatus,
    formData,
    isRevisionUploaded,
    isWorkflowSaved,
    isSaved,
    openedBy,
    relationshipDocs,
    reviewers,
    revisions,
    trainingConfig,
  ]);

  useEffect(() => {
    let mounted = true;

    const loadAuditTrail = async () => {
      if (!documentId || !isSaved) {
        setAuditTrailRows([]);
        return;
      }

      try {
        const response = await auditTrailApi.getByEntity("Document", documentId);
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
  }, [documentId, isSaved]);

  const applyDocumentDetail = async (detail: DocumentDetailResponse, fallbackId?: string) => {
    const resolvedAuthor = resolveWorkflowUser(detail.author || "", workflowUsers);
    const resolvedBusinessUnit = resolveLookupValue(detail.businessUnit || "", businessUnitOptions);
    const resolvedDepartment = resolveLookupValue(detail.department || "", departmentOptions);
    const resolvedDocumentType = documentTypeLookupOptions.find(
      (item) =>
        item.value === detail.type ||
        item.label === detail.type ||
        item.shortCode === detail.type,
    )?.value || resolveLookupValue(detail.type || "", documentTypeOptions);

    setDocumentId(detail.id);
    setDocumentNumber(detail.documentNumber || "");
    setCreatedDateTime(detail.created || "");
    setDocumentOwner(detail.owner || "");
    setDocumentStatus(mapDocumentStatusToLocal(detail.status, detail.statusInfo));
    setOpenedBy(detail.openedBy || "");
    setCanCancelDocument(Boolean(detail.canCancel));
    setCanObsoleteDocument(Boolean(detail.canObsolete));
    // This capability is calculated by the API from the Author assignment.
    // It avoids deriving authorization from a mutable profile/role display name.
    setCanStartInitialAuthoring(Boolean(detail.canStartInitialAuthoring));
    setIsSaved(true);
    setIsWorkflowSaved(
      (reviewRequirement === "NONE" || Boolean(detail.reviewers?.length)) && Boolean(detail.approvers?.length),
    );
    setFormData((prev) => ({
      ...prev,
      documentName: detail.documentName || "",
      titleLocalLanguage: detail.titleLocalLanguage || "",
      type: (resolvedDocumentType || detail.type || "") as DocumentType,
      author: resolvedAuthor?.id || detail.author || "",
      coAuthors: detail.coAuthors?.map((item) => item.id).filter(Boolean) || [],
      businessUnit: resolvedBusinessUnit || detail.businessUnit || "",
      department: resolvedDepartment || detail.department || "",
      knowledgeBase:
        resolveLookupLabel(detail.knowledgeBase || "", departmentOptions) ||
        resolveLookupLabel(resolvedDepartment || detail.department || "", departmentOptions) ||
        detail.knowledgeBase ||
        "",
      subType: detail.subType || "",
      periodicReviewCycle:
        detail.periodicReviewCycle ?? prev.periodicReviewCycle,
      periodicReviewNotification:
        detail.periodicReviewNotification ?? prev.periodicReviewNotification,
      language: detail.language || "English",
      reviewDate: detail.reviewDate || "",
      description: detail.description || "",
      isTemplate: Boolean(detail.isTemplate),
    }));
    setCoAuthorDisplayItems(
      (detail.coAuthors || [])
        .filter((item) => item.id)
        .map((item) => ({ id: item.id as string, fullName: item.fullName || item.username || (item.id as string) })),
    );
    setReviewers(
      (detail.reviewers || []).map((item, index) => ({
        id: item.id,
        fullName: item.fullName,
        username: item.username,
        position: item.position,
        email: item.email,
        department: item.department,
        order: item.sequenceOrder ?? index + 1,
      })),
    );
    setApprovers(
      (detail.approvers || []).map((item) => ({
        id: item.id,
        fullName: item.fullName,
        username: item.username,
        position: item.position,
        email: item.email,
        department: item.department,
      })),
    );
    setRelationshipDocs((detail.relatedDocuments || []).map(mapRelationDocument));
    setCorrelatedDocuments((detail.correlatedDocuments || []).map(mapRelationDocument));
    let revisionSummaries = detail.revisions || [];
    if (revisionSummaries.length === 0) {
      try {
        const directRevisions = await documentApi.getDocumentVersions(detail.id || fallbackId || "");
        if (Array.isArray(directRevisions) && directRevisions.length > 0) {
          revisionSummaries = directRevisions;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to load document revisions directly", error);
        }
      }
    }

    const hydratedRevisions = revisionSummaries.map(mapRevisionSummaryToLocal);
    setRevisions((current) => {
      if (hydratedRevisions.length > 0) {
        return hydratedRevisions;
      }
      if (current.length > 0) {
        return current;
      }
      return revisionWorkspaceFallbackRevisions;
    });
    const detailPayload = {
      documentName: detail.documentName || "",
      titleLocalLanguage: detail.titleLocalLanguage || undefined,
      documentType: resolvedDocumentType || detail.type || "",
      author: resolvedAuthor?.id || detail.author || "",
      businessUnit: resolvedBusinessUnit || detail.businessUnit || "",
      department: resolvedDepartment || detail.department || "",
      knowledgeBase: detail.knowledgeBase || undefined,
      subType: detail.subType || undefined,
      periodicReviewCycle: detail.periodicReviewCycle || undefined,
      periodicReviewNotification: detail.periodicReviewNotification || undefined,
      language: detail.language || undefined,
      requiresTraining: Boolean(detail.requiresTraining),
      trainingPeriodDays: detail.trainingPeriodDays ?? undefined,
      reasonForSkippingTraining: detail.reasonForSkippingTraining || undefined,
      reviewDate: detail.reviewDate || undefined,
      description: detail.description || "",
      isTemplate: Boolean(detail.isTemplate),
      coAuthorIds: detail.coAuthors?.map((item) => item.id).filter(Boolean) || [],
      reviewerUserIds: detail.reviewers?.map((item) => String(item.id)).filter(Boolean) || [],
      approverUserIds: detail.approvers?.map((item) => String(item.id)).filter(Boolean) || [],
      relatedDocumentIds: detail.relatedDocuments?.map((doc) => String(doc.id)).filter(Boolean) || [],
      correlatedDocumentIds: detail.correlatedDocuments?.map((doc) => String(doc.id)).filter(Boolean) || [],
    };
    setTrainingConfig((prev) => ({
      ...prev,
      isRequired: Boolean(detail.requiresTraining),
      trainingPeriodDays: detail.trainingPeriodDays ?? prev.trainingPeriodDays,
      reasonForSkippingTraining: detail.reasonForSkippingTraining ?? prev.reasonForSkippingTraining,
    }));
    setLastSavedPayload(detailPayload);
  };

  // logView=true (the default, used on genuine page-open) hits the endpoint that records a
  // VIEW audit entry and marks the document opened; refreshes after an action (save, upload,
  // obsolete, ...) should pass false to avoid flooding the audit trail with non-view events.
  const hydrateDocumentFromBackend = async (id: string, logView: boolean = true) => {
    const detail = logView
      ? await documentApi.getDocumentById(id)
      : await documentApi.getDocumentDetailSnapshot(id);
    await applyDocumentDetail(detail, id);
  };

  useEffect(() => {
    let mounted = true;

    const loadLookups = async () => {
      setIsLookupLoading(true);
      try {
        const [eligibleUsers, businessUnits, departments, documentTypes, subTypes] = await Promise.all([
          securityApi.getEligibleUsers("documents.document.view"),
          dictionaryApi.getBusinessUnits(),
          dictionaryApi.getDepartments(),
          dictionaryApi.getDocumentTypes(),
          dictionaryApi.getSubTypes(),
        ]);

        if (!mounted) return;

        const businessUnitIdByName = new Map(
          (businessUnits || [])
            .filter((item) => item.isActive)
            .map((item) => [String(item.name).trim(), item.id]),
        );

        setWorkflowUsers((eligibleUsers || []).map(toWorkflowUserOption));
        setBusinessUnitOptions(
          (businessUnits || [])
            .filter((item) => item.isActive)
            .map((item) => ({ label: item.name, value: item.id }))
        );
        setDepartmentOptions(
          (departments || [])
            .filter((item) => item.isActive)
            .map((item) => ({
              label: item.name,
              value: item.id,
              businessUnit: businessUnitIdByName.get(String(item.businessUnit).trim()) || String(item.businessUnit || ""),
            }))
        );
        setDocumentTypeOptions(
          (documentTypes || [])
            .filter((item) => item.isActive)
            .map((item) => ({ label: formatDocumentTypeLookupLabel(item.shortCode, item.name), value: item.id }))
        );
        setDocumentTypeLookupOptions(
          (documentTypes || [])
            .filter((item) => item.isActive)
            .map((item) => ({ label: formatDocumentTypeLookupLabel(item.shortCode, item.name), value: item.id, shortCode: item.shortCode }))
        );
        setSubTypeLookupOptions(
          (subTypes || [])
            .filter((item) => item.isActive)
            .map((item) => ({
              label: item.name,
              value: item.name,
              documentTypeId: item.documentTypeId,
              documentType: item.documentType,
              reviewRequirement: item.reviewRequirement,
            }))
        );

        const initialId = routeDocumentId || initialData?.id || locationState?.documentData?.id || preloadedDocumentDetail?.id || documentId;
        const canUsePreloadedDetail =
          Boolean(preloadedDocumentDetail) &&
          String(preloadedDocumentDetail?.id || "") === String(initialId || "");

        if (canUsePreloadedDetail && preloadedDocumentDetail) {
          await applyDocumentDetail(preloadedDocumentDetail, initialId || undefined);
        } else if (initialId) {
          await hydrateDocumentFromBackend(initialId);
        }
      } catch (error) {
        console.error("Failed to load document creation data", error);
      } finally {
        if (mounted) {
          setIsLookupLoading(false);
        }
      }
    };

    void loadLookups();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (workflowUsers.length === 0) {
      return;
    }

    setFormData((prev) => {
      const authorUser = resolveWorkflowUser(String(prev.author || ""), workflowUsers);
      const normalizedAuthor = authorUser?.id || String(prev.author || "");
      const normalizedCoAuthors = normalizeCoAuthorValues(prev.coAuthors || [], workflowUsers);
      const normalizedDocumentType = resolveLookupValue(String(prev.type || ""), documentTypeLookupOptions);
      const normalizedBusinessUnit = resolveLookupValue(String(prev.businessUnit || ""), businessUnitOptions);
      const normalizedDepartment = resolveLookupValue(String(prev.department || ""), departmentOptions);
      const filteredCoAuthors = normalizedCoAuthors.filter((value) => String(value) !== normalizedAuthor);
      const normalizedKnowledgeBase =
        resolveLookupLabel(String(prev.knowledgeBase || ""), departmentOptions) ||
        resolveLookupLabel(normalizedDepartment, departmentOptions) ||
        "";

      const sameLength = filteredCoAuthors.length === (prev.coAuthors || []).length;
      const sameValues =
        sameLength &&
        filteredCoAuthors.every((value, index) => String(value) === String(prev.coAuthors?.[index] ?? ""));

      const normalizedFieldsUnchanged =
        String(prev.author || "") === normalizedAuthor &&
        String(prev.type || "") === normalizedDocumentType &&
        String(prev.businessUnit || "") === normalizedBusinessUnit &&
        String(prev.department || "") === normalizedDepartment &&
        String(prev.knowledgeBase || "") === normalizedKnowledgeBase;

      if (sameValues && normalizedFieldsUnchanged) {
        return prev;
      }

      return {
        ...prev,
        author: normalizedAuthor,
        type: normalizedDocumentType as DocumentType,
        businessUnit: normalizedBusinessUnit,
        department: normalizedDepartment,
        knowledgeBase: normalizedKnowledgeBase,
        coAuthors: filteredCoAuthors,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowUsers, businessUnitOptions, departmentOptions, documentTypeLookupOptions, formData.author]);

  const subTypeOptionsForSelectedDocumentType = useMemo(() => {
    const normalizedDocumentType = resolveLookupValue(String(formData.type || ""), documentTypeLookupOptions);
    const allowedOptions = subTypeLookupOptions.filter((item) => {
      if (!normalizedDocumentType) return true;
      return String(item.documentTypeId) === normalizedDocumentType;
    });
    const mapped = allowedOptions.map((item) => ({ label: item.label, value: item.value }));
    const currentValue = String(formData.subType || "").trim();
    if (!currentValue || mapped.some((option) => option.value === currentValue || option.label === currentValue)) {
      return [{ label: "-- None --", value: "" }, ...mapped];
    }
    return [{ label: "-- None --", value: "" }, ...mapped, { label: currentValue, value: currentValue }];
  }, [documentTypeLookupOptions, formData.subType, formData.type, subTypeLookupOptions]);

  const reviewRequirement = useMemo<"NONE" | "SINGLE" | "MULTIPLE">(() => {
    const selected = subTypeLookupOptions.find((item) => item.value === formData.subType || item.label === formData.subType);
    return selected?.reviewRequirement ?? "SINGLE";
  }, [formData.subType, subTypeLookupOptions]);

  useEffect(() => {
    if (reviewRequirement === "NONE" && reviewers.length > 0) {
      setReviewers([]);
    }
  }, [reviewRequirement, reviewers.length]);

  useEffect(() => {
    if (!formData.subType) return;
    const normalizedDocumentType = resolveLookupValue(String(formData.type || ""), documentTypeLookupOptions);
    const isValid = subTypeLookupOptions.some((item) => {
      if (normalizedDocumentType && String(item.documentTypeId) !== normalizedDocumentType) return false;
      return item.value === formData.subType || item.label === formData.subType;
    });
    if (!isValid) {
      setFormData((prev) => ({
        ...prev,
        subType: "",
      }));
    }
  }, [documentTypeLookupOptions, formData.subType, formData.type, subTypeLookupOptions]);

  // Calculate current step index based on document status
  // Document starts in Draft and requires workflow completion to move to Active
  const currentStepIndex = useMemo(
    () => documentWorkflowStepIndex(documentStatus),
    [documentStatus],
  );

  const missingRequiredFields = useMemo(() => {
    const missing: string[] = [];
    if (!String(formData.documentName || "").trim()) missing.push("Document Name");
    if (!String(formData.type || "").trim()) missing.push("Document Type");
    if (!formData.author || formData.author.length === 0)
      missing.push("Authors");
    if (!String(formData.businessUnit || "").trim()) missing.push("Business Unit");
    if (!String(formData.department || "").trim()) missing.push("Department");
    if (!String(formData.description || "").trim()) missing.push("Description");
    if (
      !Number.isFinite(formData.periodicReviewCycle) ||
      formData.periodicReviewCycle <= 0
    ) {
      missing.push("Periodic Review Cycle (Months)");
    }
    if (
      !Number.isFinite(formData.periodicReviewNotification) ||
      formData.periodicReviewNotification <= 0
    ) {
      missing.push("Periodic Review Notification (Days)");
    }
    if (
      !formData.isTemplate && trainingConfig.isRequired &&
      (!Number.isFinite(trainingConfig.trainingPeriodDays) || (trainingConfig.trainingPeriodDays as number) < 1)
    ) {
      missing.push("Training Period (Days)");
    }
    if (!formData.isTemplate && !trainingConfig.isRequired && !trainingConfig.reasonForSkippingTraining.trim()) {
      missing.push("Reason for skipping training");
    }
    return missing;
  }, [
    formData.documentName,
    formData.type,
    formData.author,
    formData.businessUnit,
    formData.department,
    formData.description,
    formData.periodicReviewCycle,
    formData.periodicReviewNotification,
    formData.isTemplate,
    trainingConfig.isRequired,
    trainingConfig.trainingPeriodDays,
    trainingConfig.reasonForSkippingTraining,
  ]);

  const canProceedNextStep =
    documentStatus !== "Obsoleted" &&
    !isSaving &&
    missingRequiredFields.length === 0;

  // Once the document exists, Save just persists edits to General/Training info (and any
  // other field already on this form) — it isn't a workflow-submission action, so it must
  // not require Reviewers/Approvers to already be assigned (those have their own dedicated
  // buttons/flow and are independent of editing the document's own metadata).
  const canSaveDocument = canProceedNextStep;

  const isDirty = useMemo(() => {
    // An assigned Author may enter this workspace solely to upload the first
    // revision source. The document metadata is read-only for that user, so a
    // hydration/display normalization must never be treated as an editable
    // draft change (or cause Back to call the metadata-update endpoint).
    if (isContributorReadOnly) return false;
    if (!isSaved) return true;
    if (!lastSavedPayload) return false;
    const currentPayload = getPayload();
    return !isPayloadEqual(currentPayload, lastSavedPayload);
  }, [
    isSaved,
    lastSavedPayload,
    formData,
    reviewers,
    approvers,
    relationshipDocs,
    correlatedDocuments,
    isContributorReadOnly,
  ]);

  const revisionsForDisplay = useMemo(() => revisions, [revisions]);
  const canObsoleteCurrentDocument =
    canObsoleteDocument && canObsoleteDocumentWithRevisionHistory(documentStatus, revisionsForDisplay);
  const selectedDocumentTypeShortCode = useMemo(() => {
    const matched = documentTypeLookupOptions.find(
      (item) => item.value === formData.type || item.label === formData.type,
    );
    return matched?.shortCode || "";
  }, [documentTypeLookupOptions, formData.type]);

  const handleCancel = () => {
    if (!isSaved) {
      clearNewDocumentDraft();
      navigateTo(ROUTES.DOCUMENTS.ALL);
      return;
    }

    setIsCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!documentId) {
      return;
    }

    setIsSaving(true);
    try {
      try {
        await documentApi.cancelDocument(documentId, cancelActivitySummary.trim());
      } catch (error) {
        const status = typeof error === "object" && error !== null
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
        if (status !== 404) {
          throw error;
        }
        await documentApi.cancelDocumentCompat(documentId, cancelActivitySummary.trim());
      }
      clearNewDocumentDraft();
      setIsCancelModalOpen(false);
      setDocumentStatus("Closed - Cancelled");
      setIsSaved(true);
      setCancelActivitySummary("");
      showToast({
        type: "success",
        title: "Document Cancelled",
        message: "The document has been moved to Closed - Cancelled status.",
        duration: 3000,
      });
      navigateTo(ROUTES.DOCUMENTS.ALL);
    } catch (error) {
      console.error("Error cancelling document:", error);
      const message = extractApiMessage(error, "Unable to cancel the document.");
      showToast({
        type: "error",
        title: "Cancel failed",
        message,
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = (action: SaveAction) => {
    setSaveAction(action);
    setShowSaveModal(true);
  };

  const markWorkflowDirty = () => {
    if (isWorkflowSaved) {
      setIsWorkflowSaved(false);
    }
  };

  const performSaveDraft = async (action: SaveAction): Promise<boolean> => {
    // Uploading an initial revision is an Author assignment action. Updating
    // Document Master metadata remains a workspace-management action. Guard
    // this client path as well as the server so navigation can never surface
    // a misleading workflow-authorization error to an assigned Author.
    if (documentId && !canAdministerDocumentWorkspace) {
      showToast({
        type: "warning",
        title: "Document metadata is read-only",
        message: "Only a user with document workspace management permission can save Document Master metadata.",
        duration: 3500,
      });
      return false;
    }
    if (action === "save") {
      setShowSaveModal(false);
    }
    setIsSaving(true);
    try {
      const normalizedDocumentType = resolveLookupValue(formData.type, documentTypeLookupOptions);
      const normalizedBusinessUnit = resolveLookupValue(formData.businessUnit, businessUnitOptions);
      const normalizedDepartment = resolveLookupValue(formData.department, departmentOptions);
      const normalizedAuthor = resolveWorkflowUser(formData.author, workflowUsers)?.id || formData.author;
      const normalizedCoAuthorIds = Array.from(
        new Set(
          formData.coAuthors
            .map((value) => resolveWorkflowUser(String(value), workflowUsers)?.id || String(value))
            .filter(Boolean),
        ),
      );
      const selectedDepartmentLabel = resolveLookupLabel(normalizedDepartment, departmentOptions);
      const selectedKnowledgeBase =
        resolveLookupLabel(String(formData.knowledgeBase || ""), departmentOptions) ||
        selectedDepartmentLabel ||
        String(formData.knowledgeBase || "").trim();
      const includeWorkflowAssignments = action !== "next-step";
      const payload = {
        documentName: formData.documentName.trim(),
        titleLocalLanguage: formData.titleLocalLanguage.trim() || undefined,
        documentType: normalizedDocumentType || formData.type,
        author: normalizedAuthor,
        businessUnit: normalizedBusinessUnit || formData.businessUnit,
        department: normalizedDepartment || formData.department,
        knowledgeBase: selectedKnowledgeBase || undefined,
        subType: formData.subType.trim() || undefined,
        periodicReviewCycle: formData.periodicReviewCycle || undefined,
        periodicReviewNotification: formData.periodicReviewNotification || undefined,
        language: formData.language || undefined,
        description: formData.description.trim() || undefined,
        isTemplate: formData.isTemplate,
        requiresTraining: formData.isTemplate ? false : trainingConfig.isRequired,
        trainingPeriodDays: !formData.isTemplate && trainingConfig.isRequired
          ? Number(trainingConfig.trainingPeriodDays)
          : undefined,
        reasonForSkippingTraining: formData.isTemplate || trainingConfig.isRequired
          ? undefined
          : trainingConfig.reasonForSkippingTraining.trim() || undefined,
        coAuthorIds: normalizedCoAuthorIds,
        ...(includeWorkflowAssignments
          ? {
              reviewerUserIds: reviewRequirement === "NONE" ? [] : reviewers.map((reviewer) => String(reviewer.id)).filter(Boolean),
              approverUserIds: approvers.map((approver) => String(approver.id)).filter(Boolean),
            }
          : {}),
        relatedDocumentIds: relationshipDocs.map((doc) => String(doc.id)).filter(Boolean),
        correlatedDocumentIds: correlatedDocuments.map((doc) => String(doc.id)).filter(Boolean),
      };

      if (documentId && lastSavedPayload && isPayloadEqual(payload, lastSavedPayload)) {
        setIsSaving(false);
        showToast({
          type: "success",
          title: "Document Saved",
          message: "No changes detected. Document is already up-to-date.",
          duration: 3000,
        });
        if (action === "next-step") {
          setIsWorkflowSaved(false);
        } else {
          setIsWorkflowSaved((reviewRequirement === "NONE" || reviewers.length > 0) && approvers.length > 0);
        }
        return true;
      }

      const requestPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined),
      ) as typeof payload;

      const isInitialCreate = !documentId;
      let response;
      if (documentId) {
        const deltaPayload: Record<string, any> = {};
        if (lastSavedPayload) {
          const arrayEqual = (a1: any[], a2: any[]) => {
            if (a1.length !== a2.length) return false;
            const sorted1 = [...a1].sort();
            const sorted2 = [...a2].sort();
            return sorted1.every((val, index) => val === sorted2[index]);
          };

          Object.keys(requestPayload).forEach((key) => {
            const k = key as keyof typeof payload;
            const currentVal = requestPayload[k];
            const lastVal = lastSavedPayload[k];
            if (Array.isArray(currentVal) && Array.isArray(lastVal)) {
              if (!arrayEqual(currentVal, lastVal)) {
                deltaPayload[k] = currentVal;
              }
            } else if (currentVal !== lastVal) {
              deltaPayload[k] = currentVal;
            }
          });
        } else {
          Object.assign(deltaPayload, requestPayload);
        }
        response = await documentApi.updateDocument(documentId, deltaPayload as any);
      } else {
        response = await documentApi.createDocument(requestPayload);
      }

      if (isInitialCreate) {
        // The URL stayed on .../all/new the whole time (this view never navigates on create),
        // so a hard refresh (or bookmark/back button) after this point would land back on a
        // blank "new document" form with no way to know which document to reload -- Reviewer/
        // Approver assignments saved moments ago would appear to have vanished even though
        // they're safely persisted (confirmed via Audit Trail). Sync the URL to the real
        // document's edit route now, silently (replace, no loading transition), so the page's
        // identity in the URL always matches what's actually been persisted.
        navigate(ROUTES.DOCUMENTS.EDIT(response.id), { replace: true });
      }
      setDocumentId(response.id);
      setDocumentNumber(response.documentNumber || documentNumber);
      setCreatedDateTime(response.created || response.createdDate || createdDateTime);
      setDocumentOwner(response.owner || documentOwner);
      setDocumentStatus(mapDocumentStatusToLocal(response.status, response.statusInfo));
      setIsSaved(true);

      // hydrateDocumentFromBackend (via applyDocumentDetail) already sets isWorkflowSaved from
      // the backend's actual Reviewer/Approver assignments — trust that instead of forcing it
      // true here, otherwise a plain field-only Save would wrongly mark the workflow as "saved"
      // (hiding Reviewers/Approvers/Related/Correlated buttons and showing Upload Revision)
      // even when no reviewers/approvers were ever assigned.
      try {
        await hydrateDocumentFromBackend(response.id, false);
      } catch (hydrateError) {
        console.error("Document saved, but its detail could not be refreshed", hydrateError);
        setIsWorkflowSaved(action !== "next-step" && (reviewRequirement === "NONE" || reviewers.length > 0) && approvers.length > 0);
      }
      setLastSavedPayload(requestPayload);
      setFormData((prev) => ({
        ...prev,
        knowledgeBase:
          resolveLookupLabel(String(prev.department || ""), departmentOptions) ||
          String(prev.knowledgeBase || "").trim(),
      }));
      setIsSaving(false);
      showToast({
        type: "success",
        title: isSaved ? "Document Updated" : "Document Saved",
        message: isSaved
          ? "Draft information has been updated."
          : "Document draft has been created successfully.",
        duration: 3000,
      });
      return true;
    } catch (error) {
      console.error("Error saving document:", error);
      showToast({
        type: "error",
        title: "Save failed",
        message: extractApiMessage(error, "Unable to save the document draft."),
        duration: 3000,
      });
      setIsSaving(false);
      return false;
    }
  };

  const handleConfirmSave = async () => {
    const saved = await performSaveDraft(saveAction);
    if (saved) {
      setShowSaveModal(false);
    }
  };

  const handleObsolete = async (signature: {
    username: string;
    password: string;
    signatureToken?: string;
    reason: string;
  }) => {
    if (!canObsoleteCurrentDocument) {
      showToast({
        type: "warning",
        title: "Obsolete unavailable",
        message: "Obsolete is only available when the document is Active, has a current Effective Revision, and has no revision in progress.",
        duration: 3000,
      });
      return;
    }

    if (!documentId) {
      showToast({
        type: "warning",
        title: "Document not saved",
        message: "Save the document before marking it obsolete.",
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await documentApi.obsoleteDocument(documentId, {
        reason: signature.reason,
        obsoleteDate: new Date().toISOString(),
        signatureToken: signature.signatureToken as string,
      });
      await hydrateDocumentFromBackend(response.id || documentId, false);
      setDocumentStatus("Obsoleted");
      setIsObsoleteModalOpen(false);
      showToast({
        type: "success",
        title: "Document obsoleted",
        message: "The document has been marked as obsolete.",
        duration: 3000,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Unable to obsolete document",
        message: extractApiMessage(error, "The document could not be marked as obsolete."),
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToList = () => {
    // Authors who only have the initial-authoring assignment must be able to
    // leave the workspace without attempting a Document Master UPDATE.
    if (isContributorReadOnly) {
      clearNewDocumentDraft();
      navigateTo(ROUTES.DOCUMENTS.ALL);
      return;
    }
    if (isDirty) {
      setShowBackSaveModal(true);
      return;
    }
    clearNewDocumentDraft();
    if (revisionWorkspaceState) {
      navigateTo(revisionWorkspaceReturnPath || ROUTES.DOCUMENTS.REVISIONS.CREATE, {
        state: revisionWorkspaceState,
      });
      return;
    }
    navigateTo(ROUTES.DOCUMENTS.ALL);
  };

  const handleBackSaveConfirm = async () => {
    setShowBackSaveModal(false);
    const saved = await performSaveDraft("save");
    if (saved) {
      clearNewDocumentDraft();
      if (revisionWorkspaceState) {
        navigateTo(revisionWorkspaceReturnPath || ROUTES.DOCUMENTS.REVISIONS.CREATE, {
          state: revisionWorkspaceState,
        });
        return;
      }
      navigateTo(ROUTES.DOCUMENTS.ALL);
    }
  };

  const handleBackSaveDecline = () => {
    setShowBackSaveModal(false);
    clearNewDocumentDraft();
    if (revisionWorkspaceState) {
      navigateTo(revisionWorkspaceReturnPath || ROUTES.DOCUMENTS.REVISIONS.CREATE, {
        state: revisionWorkspaceState,
      });
      return;
    }
    navigateTo(ROUTES.DOCUMENTS.ALL);
  };

  const handleUploadRevision = async (
    file: File | null,
    note: string,
    useTemplate: boolean,
    templateRevisionId?: string,
  ) => {
    if (!documentId) {
      showToast({
        type: "error",
        title: "Upload failed",
        message: "Please save the document draft before uploading a revision.",
        duration: 3000,
      });
      return;
    }

    if (file && file.size > maxRevisionFileSizeMB * 1024 * 1024) {
      showToast({
        type: "error",
        title: "Upload failed",
        message: `Selected file exceeds the maximum allowed size of ${maxRevisionFileSizeMB} MB.`,
        duration: 3000,
      });
      return;
    }

    if (!canCurrentUserUploadRevision) {
      showToast({
        type: "error",
        title: "Unauthorized",
        message: "Only the assigned document author can upload the revision file.",
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      const revisionResponse = await documentApi.createRevisionWithUpload(documentId, file, {
        changeDescription: note?.trim() || undefined,
        revisionType: "Minor",
        templateRevisionId: useTemplate ? templateRevisionId : undefined,
      });
      try {
        const cacheBuster = buildPreviewVersionCacheBuster(resolveRevisionPreviewVersionToken(revisionResponse));
        const previewFile = await loadPdfPreviewFile(
          () => documentApi.previewRevisionFile(revisionResponse.id, cacheBuster),
          `${revisionResponse.documentNumber || documentNumber || "revision"}_${revisionResponse.revisionNumber || "0.0.1"}.pdf`,
        );
        setUploadedRevisionFile(previewFile);
      } catch {
        setUploadedRevisionFile(null);
      }

      setIsWorkflowSaved(true);
      setIsRevisionUploaded(true);
      setDocumentStatus("Active");
      markRevisionListForRefresh();
      await hydrateDocumentFromBackend(documentId, false);
      persistNewDocumentDraft({
        activeTab,
        activeSubtab,
        screenMode,
        id: documentId,
        documentNumber,
        createdDateTime,
        owner: documentOwner,
        openedBy,
        isSaved: true,
        isWorkflowSaved: true,
        isRevisionUploaded: true,
        status: "Active",
        formData,
        reviewers,
        approvers,
        relationshipDocs,
        correlatedDocuments,
        revisions,
      });
      setIsUploadRevisionModalOpen(false);

      showToast({
        type: "success",
        title: "Revision created",
        message: "The first revision has been created for this document.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error creating revision:", error);
      const message = extractApiMessage(error, "Unable to create the revision.");
      showToast({
        type: "error",
        title: "Upload failed",
        message,
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const authorDisplayName = resolveWorkflowUser(formData.author, workflowUsers)?.fullName || formData.author;
  const coAuthorDisplayNames = formData.coAuthors
    .map((value) => resolveWorkflowUser(String(value), workflowUsers)?.fullName || String(value))
    .filter(Boolean);
  const businessUnitDisplayName = resolveLookupLabel(formData.businessUnit, businessUnitOptions);
  const departmentDisplayName = resolveLookupLabel(formData.department, departmentOptions);
  const documentTypeDisplayName = resolveLookupLabel(formData.type, documentTypeOptions);
  const revisionDisplayFormData = {
    ...formData,
    author: authorDisplayName,
    coAuthors: coAuthorDisplayNames,
    businessUnit: businessUnitDisplayName,
    department: departmentDisplayName,
    type: documentTypeDisplayName,
    knowledgeBase: resolveLookupLabel(formData.knowledgeBase, departmentOptions) || formData.knowledgeBase,
  };

  const statusSteps = DOCUMENT_WORKFLOW_STEPS;

  const tabs = [
    { id: "general" as TabType, label: "General Information" },
    ...(formData.isTemplate ? [] : [{ id: "training" as TabType, label: "Training Information" }]),
    { id: "document" as TabType, label: "Document" },
    { id: "signatures" as TabType, label: "Signatures" },
    { id: "audit" as TabType, label: "Audit Trail" },
  ];

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      {(isSaving || isNavigating || isSettingsLoading || isLookupLoading) && (
        <FullPageLoading text={isSaving ? "Processing..." : "Loading..."} />
      )}
      {/* Header: Title + Breadcrumb + Actions */}
      <div className="flex flex-col gap-4">
        <PageHeader
          title="New Document"
          breadcrumbItems={newDocument(navigateTo)}
          actions={
            documentStatus === "Closed - Cancelled" ? (
              <Button
                onClick={handleBackToList}
                variant="outline-emerald"
                size="sm"
                className="whitespace-nowrap"
              >
                Back to List
              </Button>
            ) : (
              <>
                {isSaved && (
                  <Button
                    onClick={handleBackToList}
                    variant="outline-emerald"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Back
                  </Button>
                )}
                {(!isSaved || canCancelDocument) && (
                  <Button
                    onClick={handleCancel}
                    variant="outline-emerald"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    {isSaved ? "Cancel" : "Back"}
                  </Button>
                )}
                {canAdministerDocumentWorkspace && !isSaved ? (
                  <Button
                    onClick={() => handleSaveDraft("next-step")}
                    disabled={!canProceedNextStep}
                    variant="outline-emerald"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    {isSaving ? "Saving..." : "Next Step"}
                  </Button>
                ) : canAdministerDocumentWorkspace ? (
                  <Button
                    onClick={() => handleSaveDraft("save")}
                    disabled={!canSaveDocument}
                    variant="outline-emerald"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                ) : null}
                {canObsoleteCurrentDocument && (
                  <Button
                    onClick={() => setIsObsoleteModalOpen(true)}
                    variant="default"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Obsolete
                  </Button>
                )}
              </>
            )
          }
        />
      </div>

      {/* Status Stepper */}
      <WorkflowStepper steps={statusSteps} currentStepIndex={currentStepIndex} />

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} />

        {/* Tab Content */}
        <div className="p-4 md:p-5">
          {activeTab === "general" && (
            <GeneralTab
              formData={formData}
              onFormChange={setFormData}
              hideTemplateCheckbox={false}
              canManageTemplates={canManageTemplates}
              suggestedDocumentCode={suggestedDocumentCode}
              documentNumber={documentNumber}
              createdDateTime={createdDateTime}
              openedBy={openedBy}
              authorOptions={workflowUsers.map(toSelectOption)}
              coAuthorOptions={workflowUsers
                .filter((user) => user.id !== formData.author)
                .map(toSelectOption)}
              onSearchWorkflowUsers={searchWorkflowUsers}
              coAuthorDisplayItems={coAuthorDisplayItems}
              coAuthorReadOnly={isContributorReadOnly || hasUploadedRevision}
              onAuthorChange={(author) => {
                if (!author) return;
                setFormData((prev) => ({
                  ...prev,
                  author,
                }));
              }}
              businessUnitOptions={businessUnitOptions}
              departmentOptions={departmentOptions}
              documentTypeOptions={documentTypeOptions}
              subTypeOptions={subTypeOptionsForSelectedDocumentType}
              isObsoleted={
                documentStatus === "Obsoleted" ||
                documentStatus === "Closed - Cancelled"
              }
              readOnlyReviewDate={true}
              lockAllEditableFields={hasUploadedRevision || isContributorReadOnly}
            />
          )}

          {activeTab === "training" && (
            <TrainingTab
              data={trainingConfig}
              onChange={setTrainingConfig}
              isReadOnly={
                documentStatus === "Obsoleted" ||
                documentStatus === "Closed - Cancelled" ||
                hasUploadedRevision ||
                isContributorReadOnly
              }
            />
          )}

          {activeTab === "document" && (
            <DocumentTab
              uploadedFiles={uploadedFiles}
              onFilesChange={setUploadedFiles}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              maxFiles={1}
              isObsoleted={
                documentStatus === "Obsoleted" ||
                documentStatus === "Closed - Cancelled"
              }
              correlatedDocuments={correlatedDocuments}
              onCorrelatedDocumentsChange={(next) => {
                setCorrelatedDocuments(next);
                markWorkflowDirty();
              }}
              relatedDocuments={relationshipDocs}
              onRelatedDocumentsChange={(next) => {
                setRelationshipDocs(next);
                markWorkflowDirty();
              }}
              documentType={formData.type}
              onSuggestedCodeChange={setSuggestedDocumentCode}
              // Upload must wait until Reviewer/Approver assignment is saved (isWorkflowSaved),
              // not just the initial draft save (isSaved) -- otherwise Author/DCO could attach a
              // source file before the workflow participants who are meant to review/approve it
              // even exist. isWorkflowSaved already accounts for the selected Sub-Type's Review
              // Requirement (NONE/SINGLE/MULTIPLE) from Dictionaries, e.g. reviewers aren't
              // required when reviewRequirement === "NONE".
              hideUpload={!isSaved || !isWorkflowSaved || !canCurrentUserUploadRevision || hasUploadedRevision}
            />
          )}

          {activeTab === "signatures" && <SignaturesTab onlyStatusFields />}

          {activeTab === "audit" && <AuditTab documentId={documentId ?? undefined} entityType="Document" />}
        </div>
      </div>

      {/* Action Buttons - Outside tabs */}
      <div className="">
        <div className="flex flex-wrap items-center gap-3">
            {/* Back to List button - shown when obsoleted */}
            {documentStatus === "Obsoleted" && (
              <Button
                onClick={handleBackToList}
                variant="outline-emerald"
                size="sm"
                className="whitespace-nowrap"
              >
                Back to List
              </Button>
            )}

            {/* Back / Cancel button depending on save state */}
            {documentStatus !== "Obsoleted" &&
      documentStatus !== "Closed - Cancelled" && (
                <>
                  {isSaved && (
                    <Button
                      onClick={handleBackToList}
                      variant="outline-emerald"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      Back
                    </Button>
                  )}
                  {(!isSaved ||
                    (canCancelDocument && documentStatus === "Draft" && revisions.length === 0)) && (
                    <Button
                      onClick={handleCancel}
                      variant="outline-emerald"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      {isSaved ? "Cancel" : "Back"}
                    </Button>
                  )}
                </>
              )}

            {/* Back to List button - shown when cancelled */}
            {documentStatus === "Closed - Cancelled" && (
              <Button
                onClick={handleBackToList}
                variant="outline-emerald"
                size="sm"
                className="whitespace-nowrap"
              >
                Back to List
              </Button>
            )}

            {canAdministerDocumentWorkspace && documentStatus !== "Closed - Cancelled" && !isSaved && (
              <Button
                onClick={() => handleSaveDraft("next-step")}
                disabled={!canProceedNextStep}
                variant="outline-emerald"
                size="sm"
                className="whitespace-nowrap"
              >
                {isSaving ? "Saving..." : "Next Step"}
              </Button>
            )}

            {canAdministerDocumentWorkspace && documentStatus !== "Closed - Cancelled" && isSaved && (
              <Button
                onClick={() => handleSaveDraft("save")}
                disabled={!canSaveDocument}
                variant="outline-emerald"
                size="sm"
                className="whitespace-nowrap"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}

            {/* Obsolete button - only show when document is Active with an effective revision and no revision in progress */}
            {canObsoleteCurrentDocument && (
              <Button
                onClick={() => setIsObsoleteModalOpen(true)}
                variant="default"
                size="sm"
                className="whitespace-nowrap"
              >
                Obsolete
              </Button>
            )}

            {/* Divider - only show when saved and not obsoleted or cancelled */}
            {isSaved &&
              documentStatus !== "Obsoleted" &&
              documentStatus !== "Closed - Cancelled" && (
                <div className="w-px h-8 bg-slate-500 mx-1" />
              )}

            {/* Assignment-based upload and permission-based workspace management actions */}
            {isSaved &&
              documentStatus !== "Obsoleted" &&
              documentStatus !== "Closed - Cancelled" && (
                <>
                  {/* Upload is based on the persisted author assignment, never a role/display name.
                      Also requires isWorkflowSaved: Reviewer/Approver must be assigned and saved
                      first (Sub-Type Review Requirement from Dictionaries decides whether a
                      Reviewer is even required) -- otherwise Upload Revision would let a source
                      file attach before there's anyone to review/approve it. */}
                  {isWorkflowSaved && !hasUploadedRevision && canCurrentUserUploadRevision && (
                    <Button
                      onClick={() => setIsUploadRevisionModalOpen(true)}
                      variant="outline-emerald"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      Upload Revision
                    </Button>
                  )}
                  {canManageDocumentSetup && (
                    <>
                      <Button
                        onClick={() => {
                          setActiveSubtab("related");
                          setIsRelatedModalOpen(true);
                        }}
                        variant="outline-emerald"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        Select Related Documents
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveSubtab("correlated");
                          setIsCorrelatedModalOpen(true);
                        }}
                        variant="outline-emerald"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        Select Correlated Documents
                      </Button>
                      {reviewRequirement !== "NONE" && <Button
                        onClick={() => {
                          setActiveSubtab("reviewers");
                          setIsReviewerModalOpen(true);
                        }}
                        variant="outline-emerald"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        Reviewers
                      </Button>}
                      <Button
                        onClick={() => {
                          setActiveSubtab("approvers");
                          setIsApproverModalOpen(true);
                        }}
                        variant="outline-emerald"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        Approvers
                      </Button>
                    </>
                  )}
                </>
              )}
          </div>
      </div>

      {/* Subtabs Card - Only show after saved */}
      {isSaved && (
        <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Subtab Navigation */}
          <TabNav
            tabs={[
              { id: "revisions", label: "Document Revisions" },
              ...(reviewRequirement === "NONE" ? [] : [{ id: "reviewers", label: "Reviewers", count: reviewers.length }]),
              { id: "approvers", label: "Approvers", count: approvers.length },
              { id: "copies", label: "Controlled Copies" },
              { id: "related", label: "Related Documents", count: relationshipDocs.length },
              { id: "correlated", label: "Correlated Documents", count: correlatedDocuments.length },
            ]}
            activeTab={activeSubtab}
            onChange={(id) => setActiveSubtab(id as SubTabId)}
            variant="simple-underline"
          />

          {/* Subtab Content */}
          <div className="p-4 md:p-5">
            {activeSubtab === "revisions" && (
              <DocumentRevisionsTab
                revisions={revisionsForDisplay}
                navigationMode={screenMode === "edit" ? "edit" : "create"}
                documentAuthor={resolveWorkflowUser(formData.author, workflowUsers)?.fullName || formData.author}
                documentStatus={documentStatus}
                documentCreated={createdDateTime}
              revisionFile={uploadedRevisionFile}
              formData={revisionDisplayFormData}
              reviewers={reviewers}
              approvers={approvers}
              documentNumber={documentNumber}
                relationshipDocs={relationshipDocs}
                correlatedDocuments={correlatedDocuments}
              />
            )}
            {activeSubtab === "reviewers" && reviewRequirement !== "NONE" && (
              <ReviewersTab
                reviewers={reviewers}
                onReviewersChange={(next) => {
                  setReviewers(next);
                  markWorkflowDirty();
                }}
                isModalOpen={isReviewerModalOpen}
                onModalClose={() => setIsReviewerModalOpen(false)}
                isReadOnly={!canManageDocumentSetup}
                excludedUserIds={excludedWorkflowUserIds}
                isLocked={Boolean(lastSavedPayload?.reviewerUserIds?.length)}
              />
            )}
            {activeSubtab === "approvers" && (
              <ApproversTab
                approvers={approvers}
                onApproversChange={(next) => {
                  setApprovers(next);
                  markWorkflowDirty();
                }}
                isModalOpen={isApproverModalOpen}
                onModalClose={() => setIsApproverModalOpen(false)}
                isReadOnly={!canManageDocumentSetup}
                excludedUserIds={excludedWorkflowUserIds}
                isLocked={Boolean(lastSavedPayload?.approverUserIds?.length)}
              />
            )}
            {activeSubtab === "copies" && <ControlledCopiesTab documentId={documentId ?? undefined} />}
            {activeSubtab === "related" && (
              <RelatedDocumentsTab
                relatedDocuments={relationshipDocs}
                onRelatedDocumentsChange={(next) => {
                  setRelationshipDocs(next);
                  markWorkflowDirty();
                }}
              />
            )}
            {activeSubtab === "correlated" && (
              <CorrelatedDocumentsTab
                correlatedDocuments={correlatedDocuments}
                onCorrelatedDocumentsChange={(next) => {
                  setCorrelatedDocuments(next);
                  markWorkflowDirty();
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <DocumentRelationships
        currentDocumentId={documentId}
        correlatedDocuments={correlatedDocuments}
        onCorrelatedDocumentsChange={(next) => {
          setCorrelatedDocuments(next);
          markWorkflowDirty();
        }}
        relatedDocuments={relationshipDocs}
        onRelatedDocumentsChange={(next) => {
          setRelationshipDocs(next);
          markWorkflowDirty();
        }}
        documentType={formData.type}
        isRelatedModalOpen={isRelatedModalOpen}
        onRelatedModalClose={() => setIsRelatedModalOpen(false)}
        isCorrelatedModalOpen={isCorrelatedModalOpen}
        onCorrelatedModalClose={() => setIsCorrelatedModalOpen(false)}
      />

      <UploadRevisionModal
        isOpen={isUploadRevisionModalOpen}
        onClose={() => setIsUploadRevisionModalOpen(false)}
        onConfirm={handleUploadRevision}
        documentName={formData.documentName || "Untitled Document"}
        revisionNumber={`${revisions.length}.0.${revisions.length + 1}`}
        documentType={resolveLookupLabel(formData.type, documentTypeOptions)}
              documentTypeShortCode={selectedDocumentTypeShortCode}
              documentSubType={formData.subType}
              canUseTemplate={canUseTemplate}
              maxFileSizeMB={maxRevisionFileSizeMB}
              isSubmitting={isSaving}
      />

      <ESignatureModal
        isOpen={isObsoleteModalOpen}
        onClose={() => setIsObsoleteModalOpen(false)}
        onConfirm={handleObsolete}
        actionTitle="Obsolete Document"
        meaningDisplayName="Obsoleted"
        meaningCode="OBSOLETED"
      />
      <FormModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setCancelActivitySummary("");
        }}
        onConfirm={handleCancelConfirm}
        title="Cancel Document Creation"
        confirmText="Yes, Cancel"
        cancelText="No, Continue"
        confirmDisabled={!cancelActivitySummary.trim()}
        showCancel={true}
        size="lg"
      >
        <div className="space-y-4">
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-amber-800">
              <span className="font-semibold">Note:</span> The document will be
              moved to <strong>Closed - Cancelled</strong> status.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="activity-summary"
              className="text-xs sm:text-sm font-medium text-slate-700 block"
            >
              Activity Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              id="activity-summary"
              value={cancelActivitySummary}
              onChange={(e) => setCancelActivitySummary(e.target.value)}
              placeholder="Please provide a reason for cancelling this document..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 text-sm resize-none"
            />
            {!cancelActivitySummary.trim() && (
              <p className="text-xs text-slate-500">
                Activity Summary is required to cancel the document.
              </p>
            )}
          </div>
        </div>
      </FormModal>

      <FormModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={handleConfirmSave}
        title={saveAction === "next-step" ? "Save & Proceed to Next Step?" : "Save Document?"}
        description={
          saveAction === "next-step"
            ? "This will create the document and generate Document Number. You can then add Reviewers and Approvers."
            : "Are you sure you want to save this document?"
        }
        confirmText={saveAction === "next-step" ? "Save & Next" : "Save"}
        cancelText="Cancel"
        showCancel
        isLoading={isSaving}
        size={saveAction === "save" ? "xl" : "md"}
      >
        {saveAction === "save" && (() => {
          const changes = buildSaveChangeSummary();
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

      <NavigationGuardModal
        isOpen={showBackSaveModal}
        onClose={handleBackSaveDecline}
        onConfirm={handleBackSaveConfirm}
        mode="navigate"
        currentPageTitle="New Document"
        destinationLabel="Document list"
        title="Save before leaving?"
        primaryActionLabel="Save & Leave"
        secondaryActionLabel="Leave without saving"
        description={
          <div className="space-y-2 text-sm leading-relaxed text-slate-700">
            <p>Do you want to save the current draft before going back to the document list?</p>
            <p className="text-xs text-slate-500">
              If you continue without saving, the latest changes will be lost.
            </p>
          </div>
        }
      />
    </div>
  );
};
