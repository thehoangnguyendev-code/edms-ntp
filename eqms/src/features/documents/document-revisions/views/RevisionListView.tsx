import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { ROUTES } from '@/app/routes.constants';
import {
  History,
  Download,
  FilePlusCorner,
  FileStack,
  Globe,
  Goal,
} from "lucide-react";
import { Button } from '@/components/ui/button/Button';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { DocumentFilters } from "@/features/documents/shared/components";
import { cn } from '@/components/ui/utils';
import { IconInfoCircle, IconChecks, IconCheck, IconChalkboardTeacher, IconPencilMinus, IconArrowBarToRight, IconBrandTelegram, IconShare2 } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { revisionList } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { SectionLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { usePortalDropdown, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { useRevisionServerTable } from "@/features/documents/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { RevisionTableView, TableColumn } from "@/features/documents/shared/components";
import { documentApi } from "@/services/api/documents";
import { buildRevisionDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast";
import { formatRevisionDocumentDisplayLabel } from "@/features/documents/shared/documentDisplay";
import { getStatusBadgeColor } from "@/utils/status";
import {
  buildRevisionWorkspaceNavigationState,
  buildRevisionWorkspaceSourceState,
} from "@/features/documents/shared/navigationContext";

import type { Revision } from "./types";
import { mapStatusToStatusType } from "@/utils/status";

const getBadgeColor = (statusCode?: string, statusLabel?: string): BadgeColor =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

// --- Types ---

// Default columns configuration
const DEFAULT_COLUMNS: TableColumn[] = [
  { id: "no", label: "No.", visible: true, order: 0, locked: true },
  { id: "documentNumber", label: "Document Number", visible: true, order: 1 },
  { id: "revisionNumber", label: "Revision Number", visible: true, order: 2 },
  { id: "created", label: "Created", visible: true, order: 3 },
  { id: "openedBy", label: "Opened By", visible: true, order: 4 },
  { id: "revisionName", label: "Revision Name", visible: true, order: 5 },
  { id: "state", label: "Status", visible: true, order: 6 },
  { id: "documentName", label: "Document Name", visible: true, order: 7 },
  { id: "type", label: "Document Type", visible: true, order: 8 },
  { id: "relatedDocuments", label: "Related Document", visible: true, order: 9 },
  { id: "correlatedDocuments", label: "Correlated Document", visible: true, order: 10 },
  { id: "template", label: "Template", visible: true, order: 11 },
  { id: "businessUnit", label: "Business Unit", visible: true, order: 12 },
  { id: "department", label: "Department", visible: true, order: 13 },
  { id: "author", label: "Author", visible: true, order: 14 },
  { id: "effectiveDate", label: "Effective Date", visible: true, order: 15 },
  { id: "validUntil", label: "Valid Until", visible: true, order: 16 },
  { id: "action", label: "Action", visible: true, order: 17, locked: true },
];

// --- Main Component ---
export const RevisionListView: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { navigateTo, navigateToPrepared, isNavigating: isRouteNavigating } = useNavigateWithLoading();
  const { showToast } = useToast();

  const [columns, setColumns] = useState<TableColumn[]>(() => [...DEFAULT_COLUMNS]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showESignModal, setShowESignModal] = useState(false);
  const [selectedRevisionForPublish, setSelectedRevisionForPublish] = useState<Revision | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [nonEffectiveDocs, setNonEffectiveDocs] = useState<Array<{ field: string; message: string }>>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingPublishParams, setPendingPublishParams] = useState<{
    revisionId: string;
    reason: string;
    signatureToken: string;
  } | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    businessUnitFilter,
    setBusinessUnitFilter,
    departmentFilter,
    setDepartmentFilter,
    relatedDocumentFilter,
    setRelatedDocumentFilter,
    correlatedDocumentFilter,
    setCorrelatedDocumentFilter,
    templateFilter,
    setTemplateFilter,
    authorFilter,
    setAuthorFilter,
    createdFromDate,
    setCreatedFromDate,
    createdToDate,
    setCreatedToDate,
    effectiveFromDate,
    setEffectiveFromDate,
    effectiveToDate,
    setEffectiveToDate,
    validFromDate,
    setValidFromDate,
    validToDate,
    setValidToDate,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalItems,
    totalPages,
    revisions,
    isLoading: isTableLoading,
    error,
    sortConfig,
    handleSort,
    clearFilters: handleClearFilters,
    isExporting,
    exportRevisions,
    statusOptions,
    typeOptions,
    businessUnitOptions,
    departmentOptions,
    authorOptions,
    searchAuthors,
    reload,
  } = useRevisionServerTable({ viewType: "all", currentUser: user });

  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const startIndex = (currentPage - 1) * itemsPerPage;

  const preloadRevisionAndNavigate = async (
    route: string,
    revisionId: string,
    from: string,
    extraState?: Record<string, unknown>,
  ) => {
    try {
      await navigateToPrepared(
        route,
        async () => ({
          ...buildRevisionDetailSnapshotState(await documentApi.getRevisionByIdSnapshot(revisionId)),
        }),
        { state: { from, ...(extraState ?? {}) } },
      );
    } catch (error) {
      console.error("Failed to preload revision before navigation", error);
      navigateTo(route, { state: { from, ...(extraState ?? {}) } });
    }
  };

  // Handlers
  const handleViewRevision = (id: string) => {
    void preloadRevisionAndNavigate(
      ROUTES.DOCUMENTS.REVISIONS.DETAIL(id),
      id,
      ROUTES.DOCUMENTS.REVISIONS.ALL,
    );
  };

  const handleNewRevision = (revision: Revision) => {
    const parentDocumentId = String((revision as any).documentId || (revision as any).parentDocumentId || revision.documentNumber || revision.id);
    close();
    navigateTo(ROUTES.DOCUMENTS.REVISIONS.CREATE, {
      state: buildRevisionWorkspaceNavigationState({
        from: location.pathname + location.search,
        returnTo: ROUTES.DOCUMENTS.REVISIONS.ALL,
        workspaceMode: "create",
        revisionId: revision.id,
        sourceRevisionId: revision.id,
        documentId: parentDocumentId,
        parentDocumentId,
        revisionNumber: revision.revisionNumber,
        revisionCreated: revision.created,
        revisionOpenedBy: revision.openedBy,
        documentNumber: revision.documentNumber,
        documentName: revision.documentName,
        documentAuthor: revision.author,
        documentStatus: revision.state,
        workspaceState: buildRevisionWorkspaceSourceState({
          id: parentDocumentId,
          documentNumber: revision.documentNumber,
          documentName: revision.documentName,
          revisionNumber: revision.revisionNumber,
          created: revision.created,
          openedBy: revision.openedBy,
          author: revision.author,
          businessUnit: revision.businessUnit,
          department: revision.department,
          coAuthors: (revision as any).coAuthors || [],
          knowledgeBase: (revision as any).knowledgeBase || "",
          subType: (revision as any).subType || "",
          periodicReviewCycle: (revision as any).periodicReviewCycle,
          periodicReviewNotification: (revision as any).periodicReviewNotification,
          language: (revision as any).language || "",
          reviewDate: (revision as any).reviewDate || "",
          description: (revision as any).description || "",
          isTemplate: Boolean((revision as any).isTemplate),
          titleLocalLanguage: (revision as any).titleLocalLanguage || "",
          type: revision.type,
        }),
      }),
    });
  };

  const handlePrintControlledCopy = (revision: Revision) => {
    const parentDocumentId = String((revision as any).documentId || (revision as any).parentDocumentId || revision.documentNumber || revision.id);
    const relatedDocuments = revision.hasRelatedDocuments
      ? [
        {
          id: revision.id,
          documentId: parentDocumentId,
          revisionName: revision.revisionName,
          revisionNumber: revision.revisionNumber,
          status: revision.state as any,
          isParent: true,
        },
      ]
      : [];

    close();
    navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.REQUEST, {
      state: {
        documentId: parentDocumentId,
        revisionName: revision.revisionName,
        documentVersion: revision.revisionNumber,
        revisionId: revision.id,
        parentDocumentId,
        sourceRevisionId: revision.id,
        relatedDocuments,
        from: ROUTES.DOCUMENTS.REVISIONS.ALL,
        workspaceState: {
          from: ROUTES.DOCUMENTS.REVISIONS.ALL,
          returnTo: ROUTES.DOCUMENTS.REVISIONS.ALL,
          parentDocumentId,
          sourceRevisionId: revision.id,
        },
      },
    });
  };

  const handlePublishConfirm = async (signature: {
    username: string;
    password: string;
    reason: string;
    signatureToken?: string;
  }) => {
    if (!selectedRevisionForPublish) return;

    try {
      setIsNavigating(true);
      setShowESignModal(false);
      await executePublish(selectedRevisionForPublish.id, {
        reason: signature.reason,
        comment: signature.reason,
        signatureToken: signature.signatureToken as string,
      });
    } catch (error) {
      console.error("Failed to publish revision", error);
      showToast({
        type: "error",
        title: "Publish failed",
        message: (error as any)?.response?.data?.message || "Failed to publish revision.",
      });
      setSelectedRevisionForPublish(null);
      setIsNavigating(false);
    }
  };

  const executePublish = async (revisionId: string, params: {
    reason: string;
    comment: string;
    signatureToken: string;
    forcePublish?: boolean;
  }) => {
    try {
      await documentApi.publishRevision(revisionId, params);
      showToast({
        type: "success",
        title: "Publish successful",
        message: "Revision has been published successfully.",
      });
      await Promise.resolve(reload());
      setSelectedRevisionForPublish(null);
    } catch (error) {
      const responseData = (error as any)?.response?.data;
      if (responseData?.error?.code === "RELATED_DOCUMENTS_NOT_EFFECTIVE") {
        setIsNavigating(false);
        setWarningMessage(responseData.error.message);
        setNonEffectiveDocs(responseData.error.details || []);
        setPendingPublishParams({
          revisionId,
          reason: params.reason,
          signatureToken: params.signatureToken,
        });
        setShowWarningModal(true);
      } else {
        console.error("Failed to publish revision", error);
        showToast({
          type: "error",
          title: "Publish failed",
          message: responseData?.error?.message || responseData?.message || "Failed to publish revision.",
        });
        setSelectedRevisionForPublish(null);
        setIsNavigating(false);
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
    setIsNavigating(true);
    await executePublish(params.revisionId, {
      reason: params.reason,
      comment: params.reason,
      signatureToken: params.signatureToken,
      forcePublish: true,
    });
  };

  const handleMenuAction = (action: string, id: string) => {
    close();

    switch (action) {
      case "edit":
        navigateTo(ROUTES.DOCUMENTS.REVISIONS.EDIT(id), {
          state: {
            from: ROUTES.DOCUMENTS.REVISIONS.ALL,
            revisionId: id,
            editMode: true,
          },
        });
        break;
      case "view":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.DETAIL(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.ALL,
        );
        break;
      case "review":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.REVIEW(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.ALL,
        );
        break;
      case "approve":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.APPROVAL(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.ALL,
        );
        break;
      case "training":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.TRAINING(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.ALL,
          {
            workspaceState: {
              activeTab: "training",
            },
          },
        );
        break;
      case "publish": {
        navigateTo(ROUTES.DOCUMENTS.REVISIONS.PUBLISHING(id), {
          state: {
            from: location.pathname + location.search,
            returnTo: location.pathname + location.search,
            workspaceReturnPath: location.pathname + location.search,
          },
        });
        break;
      }
      case "audit":
        void preloadRevisionAndNavigate(
          `${ROUTES.DOCUMENTS.REVISIONS.DETAIL(id)}?tab=audit`,
          id,
          ROUTES.DOCUMENTS.REVISIONS.ALL,
        );
        break;
      default:
        break;
    }
  };

  // The server has already evaluated permission, assignment, scope and lifecycle state.
  // Do not add a client-side permission fallback here, otherwise the list can expose an
  // action that the mutation endpoint correctly rejects.
  const canEditDraftRevision = (revision: Revision) => Boolean(revision.canEditRevision);

  // Render column cell
  const renderCell = (
    column: TableColumn,
    revision: Revision,
    index: number,
  ) => {
    switch (column.id) {
      case "no":
        return startIndex + index + 1;
      case "documentNumber":
        return (
          <span className="font-medium text-emerald-600">
            {revision.documentNumber}
          </span>
        );
      case "revisionNumber":
        return canEditDraftRevision(revision) ? (
          <button
            type="button"
            onClick={() => handleMenuAction("edit", revision.id)}
            className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2"
          >
            {revision.revisionNumber}
          </button>
        ) : revision.revisionNumber;
      case "created":
        return revision.created;
      case "openedBy":
        return revision.openedBy;
      case "revisionName":
        return <span className="font-medium text-slate-900">{revision.revisionName}</span>;
      case "state":
        return (
          <Badge color={getBadgeColor(revision.statusCode, revision.state)}>
            {revision.state}
          </Badge>
        );
      case "documentName":
        return <span className="text-slate-600">{formatRevisionDocumentDisplayLabel(revision.displayLabel, revision.documentNumber, revision.documentName)}</span>;
      case "type":
        return revision.type;
      case "relatedDocuments":
        return revision.hasRelatedDocuments ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">Yes</span>
        ) : (
          <span className="text-slate-600 font-medium">No</span>
        );
      case "correlatedDocuments":
        return revision.hasCorrelatedDocuments ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">Yes</span>
        ) : (
          <span className="text-slate-600 font-medium">No</span>
        );
      case "template":
        return revision.isTemplate ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">Yes</span>
        ) : (
          <span className="text-slate-600 font-medium">No</span>
        );
      case "businessUnit":
        return revision.businessUnit;
      case "department":
        return revision.department;
      case "author":
        return revision.author;
      case "effectiveDate":
        return revision.effectiveDate;
      case "validUntil":
        return revision.validUntil;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {(isRouteNavigating || isNavigating) && <FullPageLoading text="Loading..." />}
      {/* Header */}
      <PageHeader
        title="All Revisions"
        breadcrumbItems={revisionList(navigateTo)}
        actions={
          <Button
            onClick={exportRevisions}
            variant="outline"
            size="sm"
            className="whitespace-nowrap gap-2 self-start md:self-auto"
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export
              </>
            )}
          </Button>
        }
      />

      {/* Unified Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        {/* Main Content Area (Filters + Table) */}
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <DocumentFilters
            showCard={false}
            searchQuery={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            statusFilter={statusFilter}
            onStatusChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
            typeFilter={typeFilter}
            onTypeChange={(value) => {
              setTypeFilter(value);
              setCurrentPage(1);
            }}
            businessUnitFilter={businessUnitFilter}
            onBusinessUnitChange={(value) => {
              setBusinessUnitFilter(value);
              setCurrentPage(1);
            }}
            departmentFilter={departmentFilter}
            onDepartmentChange={(value) => {
              setDepartmentFilter(value);
              setCurrentPage(1);
            }}
            authorFilter={authorFilter}
            onAuthorChange={(value) => {
              setAuthorFilter(value);
              setCurrentPage(1);
            }}
            createdFromDate={createdFromDate}
            onCreatedFromDateChange={(dateStr) => {
              setCreatedFromDate(dateStr);
              setCurrentPage(1);
            }}
            createdToDate={createdToDate}
            onCreatedToDateChange={(dateStr) => {
              setCreatedToDate(dateStr);
              setCurrentPage(1);
            }}
            effectiveFromDate={effectiveFromDate}
            onEffectiveFromDateChange={(dateStr) => {
              setEffectiveFromDate(dateStr);
              setCurrentPage(1);
            }}
            effectiveToDate={effectiveToDate}
            onEffectiveToDateChange={(dateStr) => {
              setEffectiveToDate(dateStr);
              setCurrentPage(1);
            }}
            validFromDate={validFromDate}
            onValidFromDateChange={(dateStr) => {
              setValidFromDate(dateStr);
              setCurrentPage(1);
            }}
            validToDate={validToDate}
            onValidToDateChange={(dateStr) => {
              setValidToDate(dateStr);
              setCurrentPage(1);
            }}
            showTypeFilter={true}
            showDepartmentFilter={true}
            relatedDocumentFilter={relatedDocumentFilter}
            onRelatedDocumentFilterChange={(value) => {
              setRelatedDocumentFilter(value);
              setCurrentPage(1);
            }}
            correlatedDocumentFilter={correlatedDocumentFilter}
            onCorrelatedDocumentFilterChange={(value) => {
              setCorrelatedDocumentFilter(value);
              setCurrentPage(1);
            }}
            templateFilter={templateFilter}
            onTemplateFilterChange={(value) => {
              setTemplateFilter(value);
              setCurrentPage(1);
            }}
            onClearFilters={handleClearFilters}
            statusOptions={statusOptions}
            typeOptions={typeOptions}
            businessUnitOptions={businessUnitOptions}
            departmentOptions={departmentOptions}
            authorOptions={authorOptions}
            onAuthorSearch={searchAuthors}
          />

          {/* Table Section */}
          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}

            <div className={cn(
              "border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative",
              isTableLoading && "blur-[2px] opacity-80 pointer-events-none"
            )}>
              <RevisionTableView
                revisions={revisions}
                columns={columns}
                expandedRowId={expandedRowId}
                sortConfig={sortConfig}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                isTableLoading={isTableLoading}
                totalItems={totalItems}
                totalPages={totalPages}
                onExpandRow={setExpandedRowId}
                onSort={handleSort}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                onMenuAction={handleMenuAction}
                renderCell={renderCell}
                getMenuActions={(revision: Revision) => {
                  const actions = [];
                  const canReview = Boolean(revision.canReviewRevision);
                  const canApprove = Boolean(revision.canApproveRevision);
                  const canCompleteTraining = Boolean(revision.canCompleteTraining);
                  if (canEditDraftRevision(revision) || Boolean(revision.canSubmitForReview)) {
                    actions.push({ icon: <IconCheck className="h-4 w-4" />, label: "Edit Revision", action: "edit" });
                  }
                  if (revision.state !== "Draft") {
                    actions.push({ icon: <IconCheck className="h-4 w-4" />, label: "View", action: "view" });
                  }
                  if (revision.state === "Pending Review" && canReview) {
                    actions.push({ icon: <IconChecks className="h-4 w-4" />, label: "Review", action: "review" });
                  }
                  if (revision.state === "Pending Approval" && canApprove) {
                    actions.push({ icon: <IconChecks className="h-4 w-4" />, label: "Approve", action: "approve" });
                  }
                  if (revision.state === "Pending Training" && canCompleteTraining) {
                    actions.push({ icon: <IconChecks className="h-4 w-4" />, label: "Training", action: "training" });
                  }
                  if (Boolean(revision.canPublishRevision)) {
                    actions.push({ icon: <IconBrandTelegram className="h-4 w-4" />, label: "Publish Revision", action: "publish" });
                  }
                  actions.push({ icon: <History className="h-4 w-4" />, label: "Audit Trail", action: "audit" });
                  return actions;
                }}
                onViewItem={handleViewRevision}
                scrollerRef={scrollerRef}
                dragEvents={dragEvents}
                isDragging={isDragging}
                dropdownRef={getRef}
                dropdownToggle={toggle}
                emptyStateTitle="No Revisions Found"
                emptyStateMessage="We couldn't find any revision records matching your filters. Try adjusting your search criteria or clear filters."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown Menu (Portal) */}
      {openId && (() => {
        const currentRevision = revisions.find(r => r.id === openId);
        if (!currentRevision) return null;

        const canReview = Boolean(currentRevision.canReviewRevision);
        const canApprove = Boolean(currentRevision.canApproveRevision);
        const isPendingReview = currentRevision.state === "Pending Review" && canReview;
        const isPendingApproval = currentRevision.state === "Pending Approval" && canApprove;
        const isPendingTraining = currentRevision.state === "Pending Training" && Boolean(currentRevision.canCompleteTraining);
        const isReadyForPublishing = currentRevision.state === "Ready for Publishing";
        const isEffective = currentRevision.state === "Effective";
        // Author (still editing) and DCO (Author already completed editing, DCO needs to Submit
        // for Review) land on the exact same page (RevisionCreateView) -- same as the initial
        // document creation flow, the page itself shows only the actions the current user's
        // capability allows, so a single "Edit Revision" entry point covers both.
        const isDraft = canEditDraftRevision(currentRevision) || Boolean(currentRevision.canSubmitForReview);

        return (
          <PortalDropdownMenu isOpen={openId !== null} onClose={close} position={position} minWidth={200}>
            <div className="py-1">

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuAction("view", openId);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <IconInfoCircle className="h-4 w-4 text-slate-500" />
                <span>View Details</span>
              </button>
                            {isDraft && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction("edit", openId);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconPencilMinus className="h-4 w-4 text-slate-500" />
                  <span>Edit Revision</span>
                </button>
              )}
              {isPendingReview && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction("review", openId);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconCheck className="h-4 w-4 text-slate-500" />
                  <span>Review Revision</span>
                </button>
              )}
              {isPendingApproval && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction("approve", openId);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconChecks className="h-4 w-4 text-slate-500" />
                  <span>Approve Revision</span>
                </button>
              )}
              {isPendingTraining && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction("training", openId);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconChalkboardTeacher className="h-4 w-4 text-slate-500" />
                  <span>Training Revision</span>
                </button>
              )}
              {isEffective && currentRevision && Boolean(currentRevision.canRequestControlledCopy) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrintControlledCopy(currentRevision);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <FileStack className="h-4 w-4 text-slate-500" />
                  <span>Request Controlled Copy</span>
                </button>
              )}
              {Boolean(currentRevision.canPublishRevision) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction("publish", openId);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconShare2 className="h-4 w-4 text-slate-500" />
                  <span>Publish Revision</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuAction("audit", openId);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <History className="h-4 w-4 text-slate-500" />
                <span>View Audit Trail</span>
              </button>
            </div>
          </PortalDropdownMenu>
        );
      })()}

      {/* E-Signature Modal for Publish action */}
      <ESignatureModal
        isOpen={showESignModal}
        onClose={() => {
          setShowESignModal(false);
          setSelectedRevisionForPublish(null);
        }}
        onConfirm={handlePublishConfirm}
        actionTitle="Publish Document"
        changes={[
          {
            action: "Update Status",
            oldValue: "Ready for Publishing",
            newValue: "Effective",
            category: "status",
          },
        ]}
        targetDetails={{
          code: selectedRevisionForPublish?.documentNumber || "",
          title: selectedRevisionForPublish?.documentName || "",
          revision: selectedRevisionForPublish?.revisionNumber || "",
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
            <p className="font-semibold text-slate-900">One or more Related Documents are not currently Effective:</p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1 text-xs text-slate-700">
              {nonEffectiveDocs.map((doc, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{doc.field}</span>
                  <span className="font-semibold text-amber-600">{doc.message}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Please verify the document package before publishing. Do you want to publish anyway?</p>
          </div>
        }
      />
    </div>
  );
};
