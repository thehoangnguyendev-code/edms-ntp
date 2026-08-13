import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/components/ui/utils";
import { useLocation } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { AlertCircle, X, FileText, MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { useToast } from "@/components/ui/toast/Toast";
import { useTranslation } from "@/i18n";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { requestControlledCopy } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { FormSection } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge/Badge";
import { toTitleCase } from "@/utils/format";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useNavigateWithLoading } from "@/hooks";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { documentApi } from "@/services/api/documents";
import { settingsApi } from "@/services/api/settings";
import { metadataApi } from "@/services/api/metadata";
import { usePermissions } from "@/hooks/usePermissions";
import { IconUsersGroup } from "@tabler/icons-react";
import type { ControlledCopyRequestRouteState } from "@/features/documents/shared/controlledCopyRequest";

// --- Types ---
type DistributionScope = "business-unit" | "department" | "individual";
type DistributionMode = "internal" | "external";

interface DistributionTarget {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface DistributionUser {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  businessUnit?: string;
  department?: string;
  position?: string;
}

interface RecipientRow {
  id: string;
  displayName: string;
  username?: string;
  position?: string;
  detail?: string;
  quantity: number;
}

const parseDisplayDateTime = (value?: string | null) => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const ddmmyyyyTime = text.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (ddmmyyyyTime) {
    const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] =
      ddmmyyyyTime;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
};

export interface ControlledCopyRequest {
  documentId: string;
  documentNumber?: string;
  sourceRevisionId?: string;
  distributionMode: DistributionMode;
  distributionScope?: DistributionScope;
  locationIds: string[];
  locationNames: string[];
  recipientIds?: string[];
  recipientLabels?: string[];
  externalRecipients: string[];
  reason: string;
  signature: string;
  quantity?: number;
  recipients?: Array<{
    recipientType: "USER" | "EMAIL";
    recipientUserId?: string;
    recipientEmail?: string;
    department?: string;
    location?: string;
    quantity: number;
  }>;
}

// --- Main Component ---
export const RequestControlledCopyView: React.FC = () => {
  const { navigateTo, isNavigating: isRouteNavigating } =
    useNavigateWithLoading();
  const location = useLocation();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { user: currentUser } = usePermissions();
  const navigationState: Partial<ControlledCopyRequestRouteState> =
    (location.state as Partial<ControlledCopyRequestRouteState>) || {};

  // Get document data from navigation state
  const {
    documentId = "",
    documentNumber = "",
    documentTitle = "",
    documentVersion = "",
    revisionName = "",
    documentName = "",
    revisionId = "",
    sourceRevisionId = "",
    documentType = "",
    businessUnit = "",
    effectiveDate = "",
    validUntil = "",
    status = "",
    preloadedRevisionDetail = null,
  } = navigationState;

  // Form state
  const [distributionMode, setDistributionMode] =
    useState<DistributionMode>("internal");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [distributionScope, setDistributionScope] =
    useState<DistributionScope>("business-unit");
  const [externalRecipients, setExternalRecipients] = useState<string[]>([]);
  const [externalRecipientInput, setExternalRecipientInput] = useState("");
  const [businessUnits, setBusinessUnits] = useState<DistributionTarget[]>([]);
  const [departments, setDepartments] = useState<DistributionTarget[]>([]);
  const [individualRecipients, setIndividualRecipients] = useState<
    DistributionTarget[]
  >([]);
  const [distributionUsers, setDistributionUsers] = useState<
    DistributionUser[]
  >([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [requestContext, setRequestContext] = useState<{
    documentId?: string | null;
    documentNumber?: string | null;
    documentName?: string | null;
    documentType?: string | null;
    businessUnit?: string | null;
    documentStatus?: string | null;
    currentEffectiveRevisionId?: string | null;
    revisionNumber?: string | null;
    revisionName?: string | null;
    revisionStatus?: string | null;
    effectiveDate?: string | null;
    validUntil?: string | null;
    canRequest?: boolean;
    /** Server-computed (documentAuthorizationService.canViewAllDocuments) — never
     * re-derive this from a client-side permission-code list. */
    canRequestForOthers?: boolean;
    message?: string | null;
    expiryDurationDays?: number | null;
  } | null>(null);
  // Self-service viewers only qualify via the server capability on REQUEST_COPY
  // (V233) — limited to one internal copy for themselves. Users granted the
  // workspace-management capability keep full access to batch/external distribution.
  // Undefined while context is still loading is treated as a restricted
  // self-service view (safe default: simplified UI first).
  const canRequestForOthers = requestContext?.canRequestForOthers === true;

  // Self-service viewers: force internal + individual + exactly themselves as the
  // only recipient. Backend (ControlledCopyService.requestControlledCopy) enforces
  // this independently — this is UX-side, not the security boundary.
  useEffect(() => {
    if (isLoadingContext || canRequestForOthers || !currentUser?.id) return;
    setDistributionMode("internal");
    setDistributionScope("individual");
    setSelectedLocations([currentUser.id]);
  }, [isLoadingContext, canRequestForOthers, currentUser?.id]);

  // Load business units, departments, and users dynamically
  useEffect(() => {
    let mounted = true;
    const loadMetadata = async () => {
      try {
        setIsLoadingMetadata(true);
        // Fetched independently (not Promise.all): a failure on one lookup must not
        // block the other two, which are unrelated. Also, the recipient picker uses the
        // ungated metadata lookup (id/name/role/department only) instead of the admin
        // settings.user.view-gated user-management list — any requester should be able
        // to pick a recipient without needing User Management access.
        const [buResult, deptResult, userResult] = await Promise.allSettled([
          settingsApi.getBusinessUnits(),
          settingsApi.getDepartments(),
          metadataApi.getUsersLookup(),
        ]);

        if (!mounted) return;

        if (buResult.status === "fulfilled") {
          setBusinessUnits(
            (buResult.value || []).map((bu) => ({
              id: bu.id || bu.value || "",
              code: bu.code || "",
              name: bu.name || bu.label || "",
              description: bu.label || "Business Unit",
            })),
          );
        } else {
          console.error("Failed to load business units", buResult.reason);
        }

        if (deptResult.status === "fulfilled") {
          setDepartments(
            (deptResult.value || []).map((dept) => ({
              id: dept.id,
              code: dept.code,
              name: dept.name,
              description: dept.manager
                ? `Manager: ${dept.manager}`
                : "Department-level distribution",
            })),
          );
        } else {
          console.error("Failed to load departments", deptResult.reason);
        }

        if (userResult.status === "fulfilled") {
          const users = userResult.value || [];
          setDistributionUsers(
            users.map((user) => ({
              id: user.id,
              username: user.username || "",
              fullName: user.fullName || user.username || "",
              email: user.email || "",
              businessUnit: user.businessUnit || "",
              department: user.department || "",
              position: user.position || "",
            })),
          );
          setIndividualRecipients(
            users.map((user) => ({
              id: user.id,
              code: user.employeeCode || "",
              name: user.fullName || user.username || "",
              description:
                user.position || user.department || "Individual recipient",
            })),
          );
        } else {
          console.error("Failed to load users for individual recipient list", userResult.reason);
        }
      } catch (error) {
        console.error("Failed to load distribution metadata", error);
      } finally {
        if (mounted) {
          setIsLoadingMetadata(false);
        }
      }
    };

    loadMetadata();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadRequestContext = async () => {
      if (!documentId && !revisionId) {
        setRequestContext(null);
        setIsLoadingContext(false);
        return;
      }

      try {
        const context = await documentApi.getControlledCopyRequestContext({
          documentId,
          revisionId,
        });
        if (!mounted) return;
        setRequestContext(context || null);
      } catch (error) {
        console.error("Failed to load controlled copy request context", error);
        if (mounted) {
          setRequestContext(null);
        }
      } finally {
        if (mounted) {
          setIsLoadingContext(false);
        }
      }
    };

    loadRequestContext();
    return () => {
      mounted = false;
    };
  }, [documentId, revisionId]);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const distributionModeTabs: TabItem[] = [
    { id: "internal", label: "Internal" },
    { id: "external", label: "External" },
  ];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const splitEmails = (value: string) =>
    value
      .split(/[\n,;,\s]+/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);
  const isValidEmail = (value: string) => emailPattern.test(value);
  const invalidExternalRecipients = useMemo(
    () => externalRecipients.filter((email) => !isValidEmail(email)),
    [externalRecipients],
  );
  const parsedExternalRecipients = externalRecipients;
  const formatDateOnly = (value?: string | null) => {
    const parsed = parseDisplayDateTime(value);
    if (!parsed) {
      return "-";
    }
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed);
  };
  const displayRevisionName = useMemo(() => {
    const explicit = String(
      requestContext?.revisionName ||
        revisionName ||
        preloadedRevisionDetail?.revisionName ||
        "",
    ).trim();
    if (explicit) {
      return explicit;
    }
    const fallbackName = String(
      requestContext?.documentName ||
        documentName ||
        documentTitle ||
        preloadedRevisionDetail?.documentName ||
        "",
    ).trim();
    const fallbackVersion = String(
      requestContext?.revisionNumber || documentVersion || "",
    ).trim();
    if (fallbackName && fallbackVersion) {
      return `${fallbackName}_${fallbackVersion}`;
    }
    return fallbackName || fallbackVersion || "N/A";
  }, [
    documentName,
    documentTitle,
    documentVersion,
    preloadedRevisionDetail?.documentName,
    preloadedRevisionDetail?.revisionName,
    revisionName,
    requestContext?.documentName,
    requestContext?.revisionName,
    requestContext?.revisionNumber,
  ]);
  const displayDocumentNumber =
    String(
      requestContext?.documentNumber ||
        documentNumber ||
        preloadedRevisionDetail?.documentNumber ||
        "",
    ).trim() || "N/A";
  const displayRevisionNumber =
    String(
      requestContext?.revisionNumber ||
        documentVersion ||
        preloadedRevisionDetail?.revisionNumber ||
        "",
    ).trim() || "N/A";
  const displayDocumentName =
    String(
      requestContext?.documentName ||
        documentName ||
        documentTitle ||
        preloadedRevisionDetail?.documentName ||
        "",
    ).trim() || "N/A";
  const displayDocumentType =
    String(
      requestContext?.documentType ||
        documentType ||
        preloadedRevisionDetail?.type ||
        "",
    ).trim() || "N/A";
  const displayBusinessUnit =
    String(
      requestContext?.businessUnit ||
        businessUnit ||
        preloadedRevisionDetail?.businessUnit ||
        "",
    ).trim() || "N/A";
  const displayEffectiveDate = formatDateOnly(
    requestContext?.effectiveDate ||
      effectiveDate ||
      preloadedRevisionDetail?.effectiveDate,
  );
  const displayValidUntil = formatDateOnly(
    requestContext?.validUntil ||
      validUntil ||
      preloadedRevisionDetail?.validUntil,
  );
  const displayStatus =
    String(
      requestContext?.revisionStatus ||
        status ||
        preloadedRevisionDetail?.status ||
        "-",
    ).trim() || "-";
  const selectedRecipientCount = useMemo(() => {
    if (distributionMode === "external") {
      return parsedExternalRecipients.length;
    }

    if (distributionScope === "individual") {
      return selectedLocations.length;
    }

    const selectedTargetIds = new Set(selectedLocations);
    const selectedTargets =
      distributionScope === "business-unit" ? businessUnits : departments;
    const targetNames = selectedTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => target.name.trim().toLowerCase())
      .filter(Boolean);
    const targetCodes = selectedTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => target.code.trim().toLowerCase())
      .filter(Boolean);

    return distributionUsers.filter((user) => {
      const unit =
        (distributionScope === "business-unit"
          ? user.businessUnit
          : user.department) || "";
      const normalized = unit.trim().toLowerCase();
      return (
        normalized &&
        (targetNames.includes(normalized) || targetCodes.includes(normalized))
      );
    }).length;
  }, [
    distributionMode,
    distributionScope,
    parsedExternalRecipients.length,
    selectedLocations,
    businessUnits,
    departments,
    distributionUsers,
  ]);

  const requestRecipients = useMemo<ControlledCopyRequest["recipients"]>(() => {
    if (distributionMode === "external") {
      return parsedExternalRecipients.map((email) => ({
        recipientType: "EMAIL",
        recipientEmail: email,
        quantity: 1,
      }));
    }

    const selectedTargetIds = new Set(selectedLocations);
    if (distributionScope === "individual") {
      return distributionUsers
        .filter((user) => selectedTargetIds.has(user.id))
        .map((user) => ({
          recipientType: "USER",
          recipientUserId: user.id,
          department: user.department,
          location: user.businessUnit,
          quantity: 1,
        }));
    }

    const selectedTargets =
      distributionScope === "business-unit" ? businessUnits : departments;
    const targetNames = selectedTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => target.name.trim().toLowerCase())
      .filter(Boolean);
    const targetCodes = selectedTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => target.code.trim().toLowerCase())
      .filter(Boolean);

    return distributionUsers
      .filter((user) => {
        const unit =
          (distributionScope === "business-unit"
            ? user.businessUnit
            : user.department) || "";
        const normalized = unit.trim().toLowerCase();
        return (
          normalized &&
          (targetNames.includes(normalized) || targetCodes.includes(normalized))
        );
      })
      .map((user) => ({
        recipientType: "USER",
        recipientUserId: user.id,
        department: user.department,
        location: user.businessUnit,
        quantity: 1,
      }));
  }, [
    businessUnits,
    departments,
    distributionMode,
    distributionScope,
    distributionUsers,
    parsedExternalRecipients,
    selectedLocations,
  ]);

  const addExternalRecipients = (rawValues: string[]) => {
    const nextEmails = rawValues
      .flatMap((value) => splitEmails(value))
      .filter(Boolean);

    if (!nextEmails.length) {
      return;
    }

    setExternalRecipients((current) => {
      const merged = [...current];
      nextEmails.forEach((email) => {
        if (!merged.includes(email)) {
          merged.push(email);
        }
      });
      return merged;
    });
    setExternalRecipientInput("");
    if (errors.externalRecipients) {
      setErrors((prev) => ({ ...prev, externalRecipients: "" }));
    }
  };

  const removeExternalRecipient = (email: string) => {
    setExternalRecipients((current) =>
      current.filter((item) => item !== email),
    );
  };

  const commitExternalRecipientInput = () => {
    if (!externalRecipientInput.trim()) {
      return;
    }
    addExternalRecipients([externalRecipientInput]);
  };

  // Modal states
  const [showesignModal, setShowesignModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if no document data
  useEffect(() => {
    if (!documentId) {
      navigateTo(ROUTES.DOCUMENTS.ALL);
    }
  }, [documentId, navigateTo]);

  if (!documentId) {
    return null;
  }

  const requestBlocked = requestContext?.canRequest === false;
  const canSubmitRequest = !isLoadingContext && !requestBlocked;

  // Check if form is valid (for Submit button enable/disable)
  const isFormValid =
    (distributionMode === "internal"
      ? selectedRecipientCount > 0
      : parsedExternalRecipients.length > 0) &&
    reason.trim().length >= 10 &&
    !requestBlocked;

  // Validation
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (distributionMode === "internal") {
      if (selectedLocations.length === 0) {
        newErrors.location = "Location is required";
      } else if (selectedRecipientCount === 0) {
        newErrors.location =
          "No users found in the selected distribution target(s)";
      }
    } else if (parsedExternalRecipients.length === 0) {
      newErrors.externalRecipients = "Please enter at least one email address";
    } else if (invalidExternalRecipients.length > 0) {
      newErrors.externalRecipients = "Please remove invalid email addresses";
    }

    if (!reason.trim()) {
      newErrors.reason = "Reason is required";
    } else if (reason.trim().length < 10) {
      newErrors.reason = "Reason must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle cancel button click
  const handleCancel = () => {
    // Check if form has any data
    const hasFormData =
      selectedLocations.length > 0 ||
      reason.trim() !== "" ||
      externalRecipients.length > 0;

    if (hasFormData) {
      // Show confirmation modal
      setShowCancelModal(true);
    } else {
      // No data, just go back
      navigateTo(
        navigationState.workspaceReturnPath ||
          navigationState.returnTo ||
          navigationState.from ||
          ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL,
      );
    }
  };

  // Handle cancel confirmation
  const handleCancelConfirm = () => {
    setShowCancelModal(false);
    navigateTo(
      navigationState.workspaceReturnPath ||
        navigationState.returnTo ||
        navigationState.from ||
        ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL,
    );
  };

  // Handle form submission (open e-signature modal)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (requestBlocked) {
      showToast({
        type: "error",
        title: t("controlledCopyRequest.unavailable.title"),
        message:
          requestContext?.message ||
          t("controlledCopyRequest.unavailable.message"),
        duration: 4500,
      });
      return;
    }

    if (validateForm()) {
      setShowesignModal(true);
    }
  };

  // Handle e-signature confirmation
  const handleESignConfirm = async (data: {
    username?: string;
    password?: string;
    reason: string;
  }) => {
    if (requestBlocked) {
      showToast({
        type: "error",
        title: t("controlledCopyRequest.unavailable.title"),
        message:
          requestContext?.message ||
          t("controlledCopyRequest.unavailable.message"),
        duration: 4500,
      });
      setShowesignModal(false);
      return;
    }

    const signatureReason = data.reason;
    const selectedTargets = locationOptions.filter((option) =>
      selectedLocations.includes(String(option.value)),
    );
    const targetEmails = parsedExternalRecipients;

    const request: ControlledCopyRequest = {
      documentId: requestContext?.documentId || documentId,
      documentNumber: requestContext?.documentNumber || documentNumber || "",
      sourceRevisionId:
        sourceRevisionId ||
        requestContext?.currentEffectiveRevisionId ||
        revisionId ||
        "",
      distributionMode,
      distributionScope:
        distributionMode === "internal" ? distributionScope : undefined,
      locationIds: distributionMode === "internal" ? selectedLocations : [],
      locationNames:
        distributionMode === "internal"
          ? selectedTargets.map((target) => target.label)
          : [],
      recipientIds: distributionMode === "internal" ? selectedLocations : [],
      recipientLabels:
        distributionMode === "internal"
          ? selectedTargets.map((target) => target.label)
          : targetEmails,
      externalRecipients: distributionMode === "external" ? targetEmails : [],
      reason,
      signature: signatureReason,
      recipients: requestRecipients,
      quantity: selectedRecipientCount,
    };

    try {
      setIsSubmitting(true);
      await documentApi.requestControlledCopy({
        documentId: request.documentId,
        documentNumber: request.documentNumber,
        sourceRevisionId: request.sourceRevisionId,
        requestedBy: "",
        distributionMode,
        distributionScope: request.distributionScope,
        recipientIds: distributionMode === "internal" ? selectedLocations : [],
        recipientLabels:
          distributionMode === "internal"
            ? selectedTargets.map((target) => target.label)
            : targetEmails,
        externalRecipients: request.externalRecipients,
        recipients: request.recipients,
        department:
          distributionMode === "internal"
            ? selectedTargets.map((target) => target.label).join(", ")
            : "External",
        location:
          distributionMode === "internal"
            ? selectedTargets[0]?.label || ""
            : "External Recipients",
        purpose: request.reason,
        copies: selectedRecipientCount,
        quantity: selectedRecipientCount,
      });
    } catch (error) {
      console.error("Failed to request controlled copy", error);
      showToast({
        type: "error",
        title: t("controlledCopyRequest.failed.title"),
        message: t("controlledCopyRequest.failed.message"),
        duration: 4000,
      });
      setShowesignModal(false);
      setIsSubmitting(false);
      return;
    }

    showToast({
      type: "success",
        title: t("controlledCopyRequest.success.title"),
      message:
        t("controlledCopyRequest.success.message"),
      duration: 5000,
    });

    setShowesignModal(false);
    setIsSubmitting(false);
    setIsNavigating(true);
    navigateTo(
      navigationState.workspaceReturnPath ||
        navigationState.returnTo ||
        navigationState.from ||
        ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL,
    );
  };

  // Prepare select options for distribution
  const distributionScopeOptions = [
    { value: "business-unit", label: "Business Unit" },
    { value: "department", label: "Department" },
    { value: "individual", label: "Individual" },
  ];

  const locationOptions = useMemo(() => {
    const mapToOption = (target: DistributionTarget) => ({
      value: target.id,
      label: `${target.code} - ${target.name}`,
      description: target.description,
    });

    if (distributionScope === "business-unit") {
      return businessUnits.map(mapToOption);
    }

    if (distributionScope === "department") {
      return departments.map(mapToOption);
    }

    return individualRecipients.map(mapToOption);
  }, [distributionScope, businessUnits, departments, individualRecipients]);

  const locationLabelByScope: Record<DistributionScope, string> = {
    "business-unit": "Business Unit",
    department: "Department",
    individual: "Individual",
  };

  const selectedLocationOptions = locationOptions.filter((option) =>
    selectedLocations.includes(String(option.value)),
  );

  const recipientRows = useMemo<RecipientRow[]>(() => {
    if (distributionMode === "external") {
      return parsedExternalRecipients.map((email) => ({
        id: email,
        displayName: email,
        detail: "External recipient",
        quantity: 1,
      }));
    }

    const selectedTargetIds = new Set(selectedLocations);
    if (distributionScope === "individual") {
      return distributionUsers
        .filter((user) => selectedTargetIds.has(user.id))
        .map((user) => ({
          id: user.id,
          displayName: user.fullName || user.username || user.id,
          username: user.username || "-",
          position:
            user.position ||
            user.department ||
            user.businessUnit ||
            "Individual",
          quantity: 1,
        }));
    }

    const selectedTargets =
      distributionScope === "business-unit" ? businessUnits : departments;
    const targetNames = selectedTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => target.name.trim().toLowerCase())
      .filter(Boolean);
    const targetCodes = selectedTargets
      .filter((target) => selectedTargetIds.has(target.id))
      .map((target) => target.code.trim().toLowerCase())
      .filter(Boolean);

    return distributionUsers
      .filter((user) => {
        const unit =
          (distributionScope === "business-unit"
            ? user.businessUnit
            : user.department) || "";
        const normalized = unit.trim().toLowerCase();
        return (
          normalized &&
          (targetNames.includes(normalized) || targetCodes.includes(normalized))
        );
      })
      .map((user) => ({
        id: user.id,
        displayName: user.fullName || user.username || user.id,
        username: user.username || "-",
        position:
          user.position || user.department || user.businessUnit || "Recipient",
        quantity: 1,
      }));
  }, [
    businessUnits,
    departments,
    distributionMode,
    distributionScope,
    distributionUsers,
    parsedExternalRecipients,
    selectedLocations,
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header: Title + Breadcrumb + Actions */}
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Request Controlled Copy"
          breadcrumbItems={requestControlledCopy(
            navigateTo,
            location.state?.from,
          )}
          actions={
            <>
              <Button
                type="button"
                variant="outline-emerald"
                size="sm"
                onClick={handleCancel}
                className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="outline-emerald"
                size="sm"
                disabled={!isFormValid}
                form="controlled-copy-form"
                className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                Submit Request
              </Button>
            </>
          }
        />
      </div>

      {/* Main Content */}
      <form
        id="controlled-copy-form"
        onSubmit={handleSubmit}
        className="space-y-4 lg:space-y-6"
      >
        {/* Document Info - Full Width */}
        <FormSection
          title="Document Information"
          icon={<Info className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Document Number
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-all">
                  {displayDocumentNumber}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Document Name
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-words">
                  {displayDocumentName}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Document Type
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-words">
                  {displayDocumentType}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Revision Number
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-all">
                  {displayRevisionNumber}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Revision Name
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-words">
                  {displayRevisionName}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Status
                </label>
                <div className="flex-1">
                  <Badge color="emerald">{toTitleCase(displayStatus)}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Effective Date
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-all">
                  {displayEffectiveDate}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Valid Until
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-all">
                  {displayValidUntil}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">
                  Business Unit
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 break-words">
                  {displayBusinessUnit}
                </p>
              </div>
            </div>
          </div>
          {requestBlocked && !isLoadingContext && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {requestContext?.message ||
                    "Request Controlled Copy is not available for this revision."}
                </p>
              </div>
            </div>
          )}
        </FormSection>

        {/* Distribution Details */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <FormSection
            title="Distribution Details"
            icon={<MapPin className="h-4 w-4" />}
          >
            <div className="space-y-5">
              {!canRequestForOthers && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-start gap-2">
                  <p className="text-xs sm:text-sm text-emerald-800">
                    Self-service request: you are requesting <span className="font-semibold">1 copy for yourself</span>.
                    Requesting on behalf of other recipients or external distribution requires the
                    server-granted workspace-management capability.
                  </p>
                </div>
              )}
              {canRequestForOthers && (
                <TabNav
                  tabs={distributionModeTabs}
                  activeTab={distributionMode}
                  onChange={(tabId) => {
                    setDistributionMode(tabId as DistributionMode);
                    setErrors((prev) => ({
                      ...prev,
                      location: "",
                      externalRecipients: "",
                    }));
                  }}
                  variant="pill"
                  ariaLabel="Distribution mode"
                />
              )}
              {!canRequestForOthers ? null : distributionMode === "internal" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Distribution Scope */}
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                      Recipient <span className="text-red-600">*</span>
                    </label>
                    <Select
                      value={distributionScope}
                      onChange={(value) => {
                        setDistributionScope(value as DistributionScope);
                        setSelectedLocations([]);
                        if (errors.location) {
                          setErrors({ ...errors, location: "" });
                        }
                      }}
                      options={distributionScopeOptions}
                      placeholder="Select distribution scope"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                      {locationLabelByScope[distributionScope]}{" "}
                      <span className="text-red-600">*</span>
                    </label>
                    <MultiSelect
                      value={selectedLocations}
                      onChange={(values) => {
                        setSelectedLocations(
                          values.map((value) => String(value)),
                        );
                        if (errors.location) {
                          setErrors({ ...errors, location: "" });
                        }
                      }}
                      options={locationOptions}
                      maxVisibleTags={2}
                      placeholder={`Select ${locationLabelByScope[distributionScope].toLowerCase()}`}
                    />
                    {errors.location && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.location}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                    External Recipients <span className="text-red-600">*</span>
                  </label>
                  <div
                    className={cn(
                      "min-h-[112px] rounded-xl border bg-white px-3 py-2.5 transition-colors",
                      errors.externalRecipients
                        ? "border-red-300 focus-within:ring-1 focus-within:ring-red-500"
                        : "border-slate-200 focus-within:ring-1 focus-within:ring-emerald-500",
                    )}
                  >
                    <div className="flex flex-wrap gap-2">
                      {externalRecipients.map((email) => {
                        const invalid = !isValidEmail(email);
                        return (
                          <span
                            key={email}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                              invalid
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200",
                            )}
                          >
                            <span className="max-w-[220px] truncate">
                              {email}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeExternalRecipient(email)}
                              className="rounded-full p-0.5 hover:bg-black/5"
                              aria-label={`Remove ${email}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        );
                      })}
                      <input
                        value={externalRecipientInput}
                        onChange={(e) => {
                          setExternalRecipientInput(e.target.value);
                          if (errors.externalRecipients) {
                            setErrors((prev) => ({
                              ...prev,
                              externalRecipients: "",
                            }));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (["Enter", ",", ";"].includes(e.key)) {
                            e.preventDefault();
                            commitExternalRecipientInput();
                          }
                          if (
                            e.key === "Backspace" &&
                            !externalRecipientInput &&
                            externalRecipients.length > 0
                          ) {
                            removeExternalRecipient(
                              externalRecipients[externalRecipients.length - 1],
                            );
                          }
                        }}
                        onBlur={commitExternalRecipientInput}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData("text");
                          if (pasted) {
                            e.preventDefault();
                            addExternalRecipients([pasted]);
                          }
                        }}
                        placeholder={
                          externalRecipients.length
                            ? "Add more emails..."
                            : "Enter email and press Enter"
                        }
                        className="min-w-[220px] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  {errors.externalRecipients && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.externalRecipients}
                    </p>
                  )}
                </div>
              )}

              {/* Expiry Policy */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs sm:text-sm text-slate-700">
                  {requestContext?.expiryDurationDays
                    ? <>This Controlled Copy will be valid for <span className="font-semibold text-slate-900">{requestContext.expiryDurationDays} day(s)</span> from the date it is distributed.</>
                    : "This Controlled Copy will never expire."}
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                  Reason for Request <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (errors.reason) {
                      setErrors({ ...errors, reason: "" });
                    }
                  }}
                  placeholder="Minimum 10 characters required..."
                  rows={4}
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 transition-colors resize-none",
                    errors.reason
                      ? "border-red-300 focus:ring-red-500"
                      : "border-slate-200 focus:ring-emerald-500",
                  )}
                />
                {errors.reason && (
                  <p className="text-xs text-red-600 mt-1">{errors.reason}</p>
                )}
                <p className="text-[11px] sm:text-xs font-normal text-slate-400 flex items-center gap-1">
                  Recorded in audit trail for compliance tracking.
                </p>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Distribution Recipient List"
            icon={<IconUsersGroup className="h-4 w-4" />}
            headerRight={
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                Total Quantity ={" "}
                <span className="font-semibold text-slate-900">
                  {selectedRecipientCount}
                </span>
              </span>
            }
          >
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-full">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="w-14 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                          No.
                        </th>
                        <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                          Recipient
                        </th>
                        {distributionMode === "internal" ? (
                          <>
                            <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                              Username
                            </th>
                            <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                              Position
                            </th>
                          </>
                        ) : (
                          <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                            Detail
                          </th>
                        )}
                        <th className="w-32 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                          Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {recipientRows.length > 0 ? (
                        recipientRows.map((row, index) => (
                          <tr
                            key={row.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 text-center">
                              {index + 1}
                            </td>
                            <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-slate-900">
                              {row.displayName}
                            </td>
                            {distributionMode === "internal" ? (
                              <>
                                <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                                  {row.username || "-"}
                                </td>
                                <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                                  {row.position || "-"}
                                </td>
                              </>
                            ) : (
                              <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                                {row.detail || "-"}
                              </td>
                            )}
                            <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-slate-900">
                              {row.quantity}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={distributionMode === "internal" ? 5 : 4}
                            className="py-12 text-center text-sm text-slate-500"
                          >
                            No recipients selected yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span>Number Of Copies</span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900">
                    {selectedRecipientCount}
                  </span>
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        {/* Summary Block */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 md:p-5">
          <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Submission Summary
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-emerald-800 list-disc pl-5 marker:text-emerald-600">
            <li>
              <span>
                Distribution target:{" "}
                <span className="font-semibold">
                  {distributionMode === "internal"
                    ? selectedLocationOptions.length > 0
                      ? `${locationLabelByScope[distributionScope]} - ${selectedLocationOptions.map((option) => option.label).join(", ")}`
                      : "Not selected"
                    : parsedExternalRecipients.length > 0
                      ? parsedExternalRecipients.join(", ")
                      : "Not selected"}
                </span>
              </span>
            </li>
            <li>
              <span>
                Total prints to be generated:{" "}
                <span className="font-semibold">{selectedRecipientCount}</span>.
              </span>
            </li>
            <li>
              <span>
                Each copy will be uniquely numbered and must be returned upon
                revision.
              </span>
            </li>
          </ul>
        </div>
      </form>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <Button
          type="button"
          variant="outline-emerald"
          size="sm"
          onClick={handleCancel}
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="outline-emerald"
          size="sm"
          disabled={!canSubmitRequest || !isFormValid}
          form="controlled-copy-form"
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          Submit Request
        </Button>
      </div>

      {/* E-Signature Modal */}
      <ESignatureModal
        isOpen={showesignModal}
        onClose={() => setShowesignModal(false)}
        onConfirm={handleESignConfirm}
        actionTitle="Confirm Controlled Copy Request"
      />

      {/* Cancel Confirmation Modal */}
      <NavigationGuardModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirm}
        mode="discard"
        currentPageTitle="Request Controlled Copy"
        title="Discard Changes?"
        primaryActionLabel="Discard"
        secondaryActionLabel="Keep editing"
        description="Are you sure you want to cancel? All entered data will be lost."
      />

      {(isRouteNavigating ||
        isNavigating ||
        isLoadingMetadata ||
        isLoadingContext ||
        isSubmitting) && <FullPageLoading text="Loading..." />}
    </div>
  );
};
