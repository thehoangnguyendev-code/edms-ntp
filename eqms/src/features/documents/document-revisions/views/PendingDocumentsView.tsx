import React, { useMemo, useState } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { ROUTES } from "@/app/routes.constants";
import {
  History,
  Download,
  Check,
  CircleCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { DocumentFilters } from "@/features/documents/shared/components";
import { cn } from "@/components/ui/utils";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { pendingDocuments } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { SectionLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { usePortalDropdown, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { useRevisionServerTable } from "@/features/documents/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { RevisionTableView, TableColumn } from "@/features/documents/shared/components";
import { buildRevisionDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import type { Revision } from "./types";
import { documentApi } from "@/services/api/documents";
import { formatRevisionDocumentDisplayLabel } from "@/features/documents/shared/documentDisplay";
import { getStatusBadgeColor } from "@/utils/status";
import { IconChecks } from "@tabler/icons-react";

const getBadgeColor = (statusCode?: string, statusLabel?: string): BadgeColor =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

type ViewType = "review" | "approval";

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

const DropdownMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  onAction: (action: string) => void;
  viewType: ViewType;
  canReview?: boolean;
  canApprove?: boolean;
}> = ({ isOpen, onClose, position, onAction, viewType, canReview, canApprove }) => (
  <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={200}>
    <div className="py-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAction("view");
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <Info className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">View Details</span>
      </button>
      {viewType === "review" && canReview && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction("review");
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <Check className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">Review Revision</span>
        </button>
      )}
      {viewType === "approval" && canApprove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction("approve");
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <IconChecks className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">Approve Revision</span>
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAction("audit");
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <History className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">View Audit Trail</span>
      </button>
    </div>
  </PortalDropdownMenu>
);

interface PendingDocumentsViewProps {
  viewType: ViewType;
  onViewDocument?: (documentId: string) => void;
}

export const PendingDocumentsView: React.FC<PendingDocumentsViewProps> = ({ viewType, onViewDocument }) => {
  const { user } = useAuth();
  const { navigateTo, navigateToPrepared, isNavigating } = useNavigateWithLoading();
  const [columns] = useState<TableColumn[]>(() => [...DEFAULT_COLUMNS]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

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
  } = useRevisionServerTable({
    viewType: viewType === "review" ? "pending-review" : "pending-approval",
    currentUser: user,
  });

  const openRevision = useMemo(
    () => (openId ? revisions.find((revision) => revision.id === openId) || null : null),
    [openId, revisions],
  );
  const canOpenReviewAction = openRevision ? Boolean(openRevision.canReviewRevision) : false;
  const canOpenApproveAction = openRevision ? Boolean(openRevision.canApproveRevision) : false;

  const startIndex = (currentPage - 1) * itemsPerPage;

  const title = viewType === "review" ? "Pending My Review" : "Pending My Approval";
  const breadcrumbKey = viewType === "review" ? "pending-review" : "pending-approval";
  const fixedStatusLabel = viewType === "review" ? "Pending My Review" : "Pending My Approval";
  const fixedStatusValue = viewType === "review" ? "PENDING_REVIEW" : "PENDING_APPROVAL";
  const fixedStatusOptions = [{ label: fixedStatusLabel, value: fixedStatusValue }];

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

  const handleAction = (action: string) => {
    if (!openId) return;

    close();

    switch (action) {
      case "view":
        if (onViewDocument) {
          onViewDocument(openId);
        } else {
          void preloadRevisionAndNavigate(
            ROUTES.DOCUMENTS.REVISIONS.DETAIL(openId),
            openId,
            viewType === "review" ? ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW : ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL,
          );
        }
        break;
      case "review":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.REVIEW(openId),
          openId,
          ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW,
        );
        break;
      case "approve":
        void preloadRevisionAndNavigate(
          ROUTES.DOCUMENTS.REVISIONS.APPROVAL(openId),
          openId,
          ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL,
        );
        break;
      case "audit":
        void preloadRevisionAndNavigate(
          `${ROUTES.DOCUMENTS.REVISIONS.DETAIL(openId)}?tab=audit`,
          openId,
          viewType === "review" ? ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW : ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL,
        );
        break;
    }
  };

  const handleTableDropdownToggle = React.useCallback(
    (id: string, e: React.MouseEvent<Element>) => {
      toggle(id, e as React.MouseEvent<HTMLButtonElement>);
    },
    [toggle],
  );

  const renderCell = (column: TableColumn, revision: Revision, index: number) => {
    switch (column.id) {
      case "no":
        return startIndex + index + 1;
      case "documentNumber":
        return <span className="font-medium text-emerald-600">{revision.documentNumber}</span>;
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
        return revision.hasRelatedDocuments ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-slate-600 font-medium">No</span>;
      case "correlatedDocuments":
        return revision.hasCorrelatedDocuments ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-slate-600 font-medium">No</span>;
      case "template":
        return revision.isTemplate ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-slate-600 font-medium">No</span>;
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
        title={title}
        breadcrumbItems={pendingDocuments(navigateTo, breadcrumbKey)}
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
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
            onCreatedFromDateChange={(value) => {
              setCreatedFromDate(value);
              setCurrentPage(1);
            }}
            createdToDate={createdToDate}
            onCreatedToDateChange={(value) => {
              setCreatedToDate(value);
              setCurrentPage(1);
            }}
            effectiveFromDate={effectiveFromDate}
            onEffectiveFromDateChange={(value) => {
              setEffectiveFromDate(value);
              setCurrentPage(1);
            }}
            effectiveToDate={effectiveToDate}
            onEffectiveToDateChange={(value) => {
              setEffectiveToDate(value);
              setCurrentPage(1);
            }}
            validFromDate={validFromDate}
            onValidFromDateChange={(value) => {
              setValidFromDate(value);
              setCurrentPage(1);
            }}
            validToDate={validToDate}
            onValidToDateChange={(value) => {
              setValidToDate(value);
              setCurrentPage(1);
            }}
            disableStatusFilter={true}
            authorFilterDisabled={false}
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
            showTypeFilter={true}
            showDepartmentFilter={true}
            onClearFilters={handleClearFilters}
            statusOptions={fixedStatusOptions}
            typeOptions={typeOptions}
            businessUnitOptions={businessUnitOptions}
            departmentOptions={departmentOptions}
            authorOptions={authorOptions}
            onAuthorSearch={searchAuthors}
          />

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
                onMenuAction={handleAction}
                renderCell={renderCell}
                getMenuActions={(revision: Revision) => {
                  const actions = [{ icon: <Info className="h-4 w-4" />, label: "View Details", action: "view" }];
                  const canReview = Boolean(revision.canReviewRevision);
                  const canApprove = Boolean(revision.canApproveRevision);
                  if (viewType === "review" && canReview) {
                    actions.push({ icon: <Check className="h-4 w-4" />, label: "Review Revision", action: "review" });
                  } else if (viewType === "approval" && canApprove) {
                    actions.push({ icon: <CircleCheck className="h-4 w-4" />, label: "Approve Revision", action: "approve" });
                  }
                  actions.push({ icon: <History className="h-4 w-4" />, label: "View Audit Trail", action: "audit" });
                  return actions;
                }}
              onViewItem={(id) => {
                void preloadRevisionAndNavigate(
                  ROUTES.DOCUMENTS.REVISIONS.DETAIL(id),
                  id,
                  viewType === "review" ? ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW : ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL,
                );
              }}
                scrollerRef={scrollerRef as React.RefObject<HTMLDivElement>}
                dragEvents={dragEvents}
                isDragging={isDragging}
                dropdownRef={getRef}
                dropdownToggle={handleTableDropdownToggle}
                emptyStateTitle="No Pending Documents Found"
                emptyStateMessage="We couldn't find any pending documents matching your filters."
              />
            </div>
          </div>
        </div>
      </div>

      <DropdownMenu
        isOpen={!!openId}
        onClose={close}
        position={position}
        onAction={handleAction}
        viewType={viewType}
        canReview={canOpenReviewAction}
        canApprove={canOpenApproveAction}
      />
    </div>
  );
};
