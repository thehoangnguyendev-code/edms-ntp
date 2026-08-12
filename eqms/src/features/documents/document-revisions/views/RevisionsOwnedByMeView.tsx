import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { ROUTES } from '@/app/routes.constants';
import {
  Download,
  History,
  FilePlusCorner,
  FileStack,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { DocumentFilters } from "@/features/documents/shared/components";
import { usePortalDropdown, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { useRevisionServerTable } from "@/features/documents/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/components/ui/utils";
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { IconInfoCircle, IconChecks, IconCheck, IconHistory, IconPencilMinus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { revisionsOwnedByMe } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { SectionLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { RevisionTableView, TableColumn } from "@/features/documents/shared/components";
import { documentApi } from "@/services/api/documents";
import { buildRevisionDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import { formatRevisionDocumentDisplayLabel } from "@/features/documents/shared/documentDisplay";
import { buildRevisionWorkspaceNavigationState, buildRevisionWorkspaceSourceState } from "@/features/documents/shared/navigationContext";

import type { Revision } from "./types";
import { mapStatusToStatusType } from "@/utils/status";
import { getStatusBadgeColor } from "@/utils/status";

const getBadgeColor = (statusCode?: string, statusLabel?: string): BadgeColor =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

// --- Main Component ---
export const RevisionsOwnedByMeView: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { navigateTo, navigateToPrepared, isNavigating } = useNavigateWithLoading();

  const [columns, setColumns] = useState<TableColumn[]>(() => [
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
  ]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

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
  } = useRevisionServerTable({ viewType: "owned-by-me", currentUser: user });

  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const startIndex = (currentPage - 1) * itemsPerPage;

  const preloadRevisionAndNavigate = async (
    route: string,
    revisionId: string,
    from: string,
  ) => {
    try {
      await navigateToPrepared(
        route,
        async () => ({
          ...buildRevisionDetailSnapshotState(await documentApi.getRevisionByIdSnapshot(revisionId)),
        }),
        { state: { from } },
      );
    } catch (error) {
      console.error("Failed to preload revision before navigation", error);
      navigateTo(route, { state: { from } });
    }
  };

  const handleNewRevision = (revision: Revision) => {
    const parentDocumentId = String((revision as any).documentId || (revision as any).parentDocumentId || revision.documentNumber || revision.id);
    close();
    navigateTo(ROUTES.DOCUMENTS.REVISIONS.CREATE, {
      state: buildRevisionWorkspaceNavigationState({
        from: location.pathname + location.search,
        returnTo: ROUTES.DOCUMENTS.REVISIONS.OWNED,
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
          id: revision.id,
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
        from: ROUTES.DOCUMENTS.REVISIONS.OWNED,
        workspaceState: {
          from: ROUTES.DOCUMENTS.REVISIONS.OWNED,
          returnTo: ROUTES.DOCUMENTS.REVISIONS.OWNED,
          parentDocumentId,
          sourceRevisionId: revision.id,
        },
      },
    });
  };

  const handleMenuAction = (action: string, id: string) => {
    close();
    switch (action) {
      case "edit":
        navigateTo(ROUTES.DOCUMENTS.REVISIONS.EDIT(id), {
          state: {
            from: ROUTES.DOCUMENTS.REVISIONS.OWNED,
            revisionId: id,
            editMode: true,
          },
        });
        break;
      case "view":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.DETAIL(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.OWNED,
        );
        break;
      case "review":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.REVIEW(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.OWNED,
        );
        break;
      case "approve":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.APPROVAL(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.OWNED,
        );
        break;
      case "training":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.TRAINING(id),
          id,
          ROUTES.DOCUMENTS.REVISIONS.OWNED,
        );
        break;
      case "audit":
        void preloadRevisionAndNavigate(
          `${ROUTES.DOCUMENTS.REVISIONS.DETAIL(id)}?tab=audit`,
          id,
          ROUTES.DOCUMENTS.REVISIONS.OWNED,
        );
        break;
      default:
        break;
    }
  };
  // The list item capability is evaluated by the server against the current user,
  // revision assignment, lifecycle and explicit permissions.
  const canEditDraftRevision = (revision: Revision) => Boolean(revision.canEditRevision);

  // Render column cell
  const renderCell = (
    column: TableColumn,
    revision: Revision,
    index: number,
  ) => {
    switch (column.id) {
      case "no":
        return (currentPage - 1) * itemsPerPage + index + 1;
      case "documentNumber":
        return (
          <span className="font-medium text-emerald-600">
            {revision.documentNumber}
          </span>
        );
      case "revisionNumber":
        return revision.revisionNumber;
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
      {isNavigating && <FullPageLoading text="Loading..." />}
      <PageHeader
        title="Revisions Owned By Me"
        breadcrumbItems={revisionsOwnedByMe(navigateTo)}
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
            onAuthorChange={() => { }} // Disabled -> No-op
            authorFilterDisabled={true}
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
          />

          {/* Table Section */}
          <div className="flex-1 flex flex-col relative">
          {isTableLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
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
                if (canEditDraftRevision(revision)) {
                  actions.push({ icon: <IconCheck className="h-4 w-4" />, label: "Edit Revision", action: "edit" });
                }
                actions.push({ icon: <IconInfoCircle className="h-4 w-4" />, label: "View Details", action: "view" });
                if (revision.state === "Pending Review" && canReview) {
                  actions.push({ icon: <IconCheck className="h-4 w-4" />, label: "Review Revision", action: "review" });
                }
                if (revision.state === "Pending Approval" && canApprove) {
                  actions.push({ icon: <IconChecks className="h-4 w-4" />, label: "Approve Revision", action: "approve" });
                }
                if (revision.state === "Pending Training" && canCompleteTraining) {
                  actions.push({ icon: <IconChecks className="h-4 w-4" />, label: "Training Revision", action: "training" });
                }
                if (revision.state === "Effective" && Boolean(revision.canRequestControlledCopy)) {
                  actions.push({ icon: <FileStack className="h-4 w-4" />, label: "Request Controlled Copy", action: "print" });
                }
                actions.push({ icon: <History className="h-4 w-4" />, label: "View Audit Trail", action: "audit" });
                return actions;
              }}
              onViewItem={(id) => {
                void preloadRevisionAndNavigate(
                  ROUTES.DOCUMENTS.REVISIONS.DETAIL(id),
                  id,
                  ROUTES.DOCUMENTS.REVISIONS.OWNED,
                );
              }}
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

        const isPendingReview = currentRevision.state === "Pending Review";
        const isPendingApproval = currentRevision.state === "Pending Approval";
        const isEffective = currentRevision.state === "Effective";
        const isDraft = canEditDraftRevision(currentRevision);
        const currentUser = user ? {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
        } : null;
        const canReview = Boolean((currentRevision as any).canReviewRevision);
        const canApprove = Boolean((currentRevision as any).canApproveRevision);
        const canCompleteTraining = Boolean(currentRevision.canCompleteTraining);

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
              {isPendingReview && canReview && (
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
              {isPendingApproval && canApprove && (
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
              {currentRevision.state === "Pending Training" && canCompleteTraining && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction("training", openId);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <IconChecks className="h-4 w-4 text-slate-500" />
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuAction("audit", openId);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <IconHistory className="h-4 w-4 text-slate-500" />
                <span>View Audit Trail</span>
              </button>
            </div>
          </PortalDropdownMenu>
        );
      })()}
    </div>
  );
};
