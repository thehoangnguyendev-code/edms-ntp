import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigateWithLoading, usePortalDropdown, useTableDragScroll } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { documentList } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import type { PortalDropdownMenuProps } from "@/components/ui/dropdown/PortalDropdownMenu";
import { IconInfoCircle, IconPencilMinus, IconPlus, IconHistory, IconSparkles, IconArrowRight, IconFileUpload, IconFilePlus } from "@tabler/icons-react";
import { ChevronDown, ChevronUp, ChevronRight, Download, History, MoreVertical, Edit, FileStack } from "lucide-react";
import { formatDateTimeLong, formatDateUS } from "@/utils/format";
import { DocumentFilters } from "@/features/documents/shared/components/DocumentFilters";
import { ExpandedDocumentRow } from "@/features/documents/shared/components/ExpandedDocumentRow";
import { hasDocumentExpansion } from "@/features/documents/shared/rowExpansion";
import { useDocumentServerTable } from "@/features/documents/hooks";
import { useDocumentPermissions } from "@/features/documents/shared/useDocumentPermissions";
import { usePermissions } from "@/hooks/usePermissions";
import {
  buildControlledCopyRequestStateFromDocument,
  canRequestControlledCopyFromDocument,
  isDraftDocumentMaster,
} from "@/features/documents/shared/controlledCopyRequest";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast";
import { documentApi } from "@/services/api/documents";
import { buildDocumentDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import type { DocumentViewType, DocumentListItem } from "./types";
import type { SelectOption } from "@/components/ui/select/Select";
import { mapRevisionSummaryFromApi } from "@/features/documents/shared/statusMapping";
import { getStatusBadgeColor } from "@/utils/status";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface DocumentsViewProps {
  viewType: DocumentViewType;
  onViewDocument?: (documentId: string, tab?: string) => void;
}

const getBadgeColor = (statusCode?: string, statusLabel?: string): BadgeColor =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

const formatCellDate = (value?: string) => {
  if (!value) return "-";
  return formatDateUS(value);
};

const clearNewDocumentDraftState = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem("eqms.documents.new-document.draft");
  window.sessionStorage.removeItem("eqms.documents.new-document.resume");
};

interface RowMenuProps {
  onView: () => void;
  onEdit: () => void | Promise<void>;
  onAuditTrail: () => void;
  onRequestControlledCopy: () => void;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownMenuProps["position"];
  canEditDocument?: boolean;
  canRequestControlledCopy?: boolean;
}

const RowMenu: React.FC<RowMenuProps> = ({
  onView,
  onEdit,
  onAuditTrail,
  onRequestControlledCopy,
  isOpen,
  onClose,
  position,
  canEditDocument,
  canRequestControlledCopy,
}) => {
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position}>
      <div className="py-1">
        <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { onView(); onClose(); }}>
          View Detail
        </DropdownMenuItem>
        {canEditDocument && (
          <DropdownMenuItem icon={<IconPencilMinus className="h-4 w-4" />} onClick={() => { onEdit(); onClose(); }}>
            Edit Document
          </DropdownMenuItem>
        )}
        {canRequestControlledCopy && (
          <DropdownMenuItem icon={<FileStack className="h-4 w-4" />} onClick={() => { onRequestControlledCopy(); onClose(); }}>
            Request Controlled Copy
          </DropdownMenuItem>
        )}
        <DropdownMenuItem icon={<History className="h-4 w-4" />} onClick={() => { onAuditTrail(); onClose(); }}>
          View Audit Trail
        </DropdownMenuItem>
      </div>
    </PortalDropdownMenu>
  );
};

// "New Document" choice modal card -- a full-surface clickable option, Swiss/minimalist styling
// (soft neutral by default, single accent color revealed only on hover/focus so the two options
// read as equally weighted choices, not a pre-picked "recommended" one).
const NewDocumentChoiceCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}> = ({ icon, title, description, cta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors duration-200 group-hover:bg-emerald-50 group-hover:text-emerald-600">
      {icon}
    </span>

    <span className="mt-3 block text-sm font-semibold text-slate-900">{title}</span>
    <span className="mt-1 block flex-1 text-xs leading-5 text-slate-500">{description}</span>

    <span className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-700 transition-colors duration-200 group-hover:text-emerald-700">
      {cta}
      <IconArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
    </span>
  </button>
);

export const DocumentsView: React.FC<DocumentsViewProps> = ({ viewType, onViewDocument }) => {
  const { user } = useAuth();
  const location = useLocation();
  const { canCreateDocumentShell } = useDocumentPermissions();
  const { hasPermissionAlias } = usePermissions();
  const canLegacyImport = hasPermissionAlias("documents.legacy_import.manage");
  const { showToast } = useToast();
  const { navigateTo, navigateToPrepared, isNavigating } = useNavigateWithLoading();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [isNewDocChoiceOpen, setIsNewDocChoiceOpen] = useState(false);
  const [expandedDocumentId, setExpandedDocumentId] = React.useState<string | null>(null);
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
    documents,
    isLoading,
    isExporting,
    isLookupLoading,
    error,
    sortConfig,
    handleSort,
    clearFilters,
    statusOptions,
    typeOptions,
    businessUnitOptions,
    departmentOptions,
    authorOptions,
    searchAuthors,
    authorFilterDisabled,
    exportDocuments,
  } = useDocumentServerTable({ viewType, currentUser: user });

  const title = viewType === "owned-by-me" ? "Documents Owned By Me" : "All Documents";
  const fromOwned = viewType === "owned-by-me";
  const showNewDocButton = viewType === "all";
  const canCreateDocument = canCreateDocumentShell;
  const canCurrentUserEditDocument = (doc: DocumentListItem) => {
    // After the DCO saved "Edit Revision for Upgrade", the Author of that (Active) document gets
    // "Edit Document" to go and Upload Revision. The backend decides (author, permission, no open
    // revision, configuration saved); nothing is inferred here.
    if (doc.canEditForUpgrade) return true;
    // Edit Document only applies to a Document Master that is still Draft and has never
    // had a revision created against it yet — once any revision exists, editing moves to
    // the revision workflow itself.
    const isEditableDraft =
      isDraftDocumentMaster(doc.status, doc.statusInfo) && !doc.hasAnyRevision;
    if (!isEditableDraft) return false;

    // The backend evaluates the assigned permissions. Do not infer eligibility
    // from a profile name, role label, or client-side display values.
    return Boolean(doc.canStartInitialAuthoring);
  };
  const isInitialLoading = (isLoading || isLookupLoading) && documents.length === 0;
  const isTableLoading = isLoading && documents.length > 0;

  const navigateToDocument = async (documentId: string, tab?: string) => {
    if (onViewDocument) {
      onViewDocument(documentId, tab);
      return;
    }

    const returnTo = `${location.pathname}${location.search}`;

    try {
      await navigateToPrepared(
        tab === "audit" ? `${ROUTES.DOCUMENTS.DETAIL(documentId)}?tab=audit` : ROUTES.DOCUMENTS.DETAIL(documentId),
        async () => {
          const [detail, auditTrail] = await Promise.all([
            documentApi.getDocumentDetailSnapshot(documentId),
            tab === "audit" ? documentApi.getDocumentAuditTrail(documentId) : Promise.resolve(undefined),
          ]);

          return {
            ...buildDocumentDetailSnapshotState(detail),
            ...(auditTrail ? { preloadedDocumentAuditTrail: auditTrail } : {}),
          };
        },
        { state: { fromOwned, returnTo } },
      );
    } catch (error) {
      console.error("Failed to preload document before navigation", error);
      navigateTo(
        tab === "audit" ? `${ROUTES.DOCUMENTS.DETAIL(documentId)}?tab=audit` : ROUTES.DOCUMENTS.DETAIL(documentId),
        { state: { fromOwned, returnTo } }
      );
    }
  };

  const handleExpandDocument = (documentId: string) => {
    setExpandedDocumentId(expandedDocumentId === documentId ? null : documentId);
  };

  const onExport = async () => {
    await exportDocuments();
  };

  const mapRelationDocument = (doc: any) => ({
    id: String(doc.id || ""),
    documentNumber: String(doc.documentNumber || ""),
    created: String(doc.created || doc.createdDate || ""),
    openedBy: String(doc.openedBy || ""),
    documentName: String(doc.documentName || ""),
    status: String(doc.status || ""),
    type: String(doc.type || ""),
    revisionNumber: String(doc.revisionNumber || ""),
    department: String(doc.department || ""),
    authorCoAuthor: String(doc.author || ""),
    effectiveDate: String(doc.effectiveDate || ""),
    validUntil: String(doc.validUntil || ""),
  });

  const mapRevisionSummaryToLocal = (revision: any) => {
    const mapped = mapRevisionSummaryFromApi({
      id: String(revision.id || ""),
      revisionNumber: String(revision.revisionNumber || ""),
      created: String(revision.created || ""),
      openedBy: String(revision.openedBy || ""),
      revisionName: String(revision.revisionName || ""),
      status: String(revision.status || ""),
      statusCode: revision.statusCode,
      statusInfo: revision.statusInfo,
    });

    return {
      id: mapped.id,
      revisionNumber: mapped.revisionNumber,
      created: mapped.created,
      openedBy: mapped.openedBy,
      revisionName: mapped.revisionName,
      status: mapped.status,
    };
  };

  const handleEditDocument = async (documentId: string) => {
    clearNewDocumentDraftState();
    try {
      await navigateToPrepared(
        ROUTES.DOCUMENTS.EDIT(documentId),
        async () => {
          const detail = await documentApi.getDocumentDetailSnapshot(documentId);
          const reviewers = (detail.reviewers || []).map((item) => ({
            id: item.id,
            fullName: item.fullName || "",
            username: item.username || "",
            position: item.position || "",
            email: item.email || "",
            department: item.department || "",
            order: item.sequenceOrder || 1,
          }));
          const approvers = (detail.approvers || []).map((item) => ({
            id: item.id,
            fullName: item.fullName || "",
            username: item.username || "",
            position: item.position || "",
            email: item.email || "",
            department: item.department || "",
          }));
          const revisions = (detail.revisions || []).map(mapRevisionSummaryToLocal);

          return {
            ...buildDocumentDetailSnapshotState(detail),
            documentData: {
              id: detail.id,
              screenMode: "edit",
              documentNumber: detail.documentNumber || "",
              createdDateTime: detail.created || "",
              openedBy: detail.openedBy || "",
              isSaved: true,
              isWorkflowSaved: true,
              status: detail.status,
              formData: {
                documentName: detail.documentName || "",
                type: detail.type || "",
                author: detail.author || "",
                coAuthors: (detail.coAuthors || []).map((item) => item.id).filter(Boolean),
                businessUnit: detail.businessUnit || "",
                department: detail.department || "",
                knowledgeBase: detail.knowledgeBase || "",
                subType: detail.subType || "",
                periodicReviewCycle: detail.periodicReviewCycle || 0,
                periodicReviewNotification: detail.periodicReviewNotification || 0,
                language: detail.language || "English",
                reviewDate: detail.reviewDate || "",
                description: detail.description || "",
                isTemplate: Boolean(detail.isTemplate),
                titleLocalLanguage: detail.titleLocalLanguage || "",
              },
              reviewers,
              approvers,
              relationshipDocs: (detail.relatedDocuments || []).map(mapRelationDocument),
              correlatedDocuments: (detail.correlatedDocuments || []).map(mapRelationDocument),
              revisions,
            },
          };
        },
        { state: {} },
      );
    } catch (error) {
      console.error("Failed to load document detail before edit", error);
      navigateTo(ROUTES.DOCUMENTS.EDIT(documentId), {
        state: {
          documentData: {
            id: documentId,
            screenMode: "edit",
            status: "Draft",
            isSaved: true,
          },
        },
      });
    }
  };

  const handleRequestControlledCopy = (doc: DocumentListItem) => {
    if (!canRequestControlledCopyFromDocument(doc)) {
      showToast({
        type: "error",
        title: "Request unavailable",
        message: "Request Controlled Copy is only available when the document has an Effective revision.",
        duration: 3000,
      });
      return;
    }

    navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.REQUEST, {
      state: buildControlledCopyRequestStateFromDocument(doc),
    });
  };

  
  const tableColumns = useMemo(() => ([
    { id: "documentNumber", label: "Document Number", sortable: true },
    { id: "created", label: "Created", sortable: true },
    { id: "openedBy", label: "Opened By", sortable: true },
    { id: "title", label: "Document Name", sortable: true },
    { id: "status", label: "Status", sortable: true },
    { id: "type", label: "Document Type", sortable: true },
    { id: "relatedDocuments", label: "Related Document", sortable: false },
    { id: "correlatedDocuments", label: "Correlated Document", sortable: false },
    { id: "template", label: "Template", sortable: false },
    { id: "businessUnit", label: "Business Unit", sortable: true },
    { id: "department", label: "Department", sortable: true },
    { id: "author", label: "Author", sortable: true },
    { id: "effectiveDate", label: "Effective Date", sortable: true },
    { id: "validUntil", label: "Valid Until", sortable: true },
    { id: "action", label: "Action", sortable: false },
  ]), []);

  const visibleAuthorOptions = authorOptions as SelectOption[];
  const canRequestControlledCopyForRow = (doc: DocumentListItem) => Boolean(doc.canRequestControlledCopy);

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {(isNavigating || isInitialLoading) && <FullPageLoading text="Loading documents..." />}

      <PageHeader
        title={title}
        breadcrumbItems={documentList(navigateTo, fromOwned ? "owned" : undefined)}
        actions={
          <>
            <Button
              onClick={onExport}
              variant="outline"
              size="sm"
              className="whitespace-nowrap gap-2"
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
            {showNewDocButton && canCreateDocument && !canLegacyImport && (
              <Button
                onClick={() => {
                  clearNewDocumentDraftState();
                  navigateTo(ROUTES.DOCUMENTS.NEW);
                }}
                size="sm"
                className="whitespace-nowrap gap-2"
              >
                <IconPlus className="h-4 w-4" />
                New Document
              </Button>
            )}
            {showNewDocButton && canCreateDocument && canLegacyImport && (
              <Button onClick={() => setIsNewDocChoiceOpen(true)} size="sm" className="whitespace-nowrap gap-2">
                <IconPlus className="h-4 w-4" />
                New Document
              </Button>
            )}
          </>
        }
      />

      <FormModal
        isOpen={isNewDocChoiceOpen}
        onClose={() => setIsNewDocChoiceOpen(false)}
        title="New Document"
        description="Choose how this document should be created."
        showFooter={false}
        size="xl"
      >
        <div className={cn("grid gap-3", canLegacyImport && "sm:grid-cols-2")}>
          <NewDocumentChoiceCard
            icon={<IconFilePlus className="h-5 w-5" />}
            title="New Document"
            description="Create a brand-new document and take it through the normal Draft, Review, Approval and Publishing workflow."
            cta="Start from scratch"
            onClick={() => {
              setIsNewDocChoiceOpen(false);
              clearNewDocumentDraftState();
              navigateTo(ROUTES.DOCUMENTS.NEW);
            }}
          />

          {canLegacyImport && (
            <NewDocumentChoiceCard
              icon={<IconFileUpload className="h-5 w-5" />}
              title="Legacy Import"
              description="Bring in a document that already exists outside the system (e.g. a paper original) — one revision, or its entire historical revision chain — publishing it directly as Effective."
              cta="Import existing document"
              onClick={() => {
                setIsNewDocChoiceOpen(false);
                navigateTo(ROUTES.DOCUMENTS.LEGACY_IMPORT);
              }}
            />
          )}
        </div>
      </FormModal>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <DocumentFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter as any}
            onStatusChange={(value) => setStatusFilter(value as any)}
            typeFilter={typeFilter as any}
            onTypeChange={(value) => setTypeFilter(value as any)}
            departmentFilter={departmentFilter}
            onDepartmentChange={setDepartmentFilter}
            relatedDocumentFilter={relatedDocumentFilter}
            onRelatedDocumentFilterChange={setRelatedDocumentFilter}
            correlatedDocumentFilter={correlatedDocumentFilter}
            onCorrelatedDocumentFilterChange={setCorrelatedDocumentFilter}
            templateFilter={templateFilter}
            onTemplateFilterChange={setTemplateFilter}
            authorFilter={authorFilter}
            onAuthorChange={(value) => {
              if (!authorFilterDisabled) {
                setAuthorFilter(value);
              }
            }}
            createdFromDate={createdFromDate}
            onCreatedFromDateChange={setCreatedFromDate}
            createdToDate={createdToDate}
            onCreatedToDateChange={setCreatedToDate}
            effectiveFromDate={effectiveFromDate}
            onEffectiveFromDateChange={setEffectiveFromDate}
            effectiveToDate={effectiveToDate}
            onEffectiveToDateChange={setEffectiveToDate}
            validFromDate={validFromDate}
            onValidFromDateChange={setValidFromDate}
            validToDate={validToDate}
            onValidToDateChange={setValidToDate}
            businessUnitFilter={businessUnitFilter}
            onBusinessUnitChange={setBusinessUnitFilter}
            onClearFilters={clearFilters}
            authorFilterDisabled={authorFilterDisabled}
            statusOptions={statusOptions}
            typeOptions={typeOptions}
            businessUnitOptions={businessUnitOptions}
            departmentOptions={departmentOptions}
            authorOptions={visibleAuthorOptions}
            onAuthorSearch={searchAuthors}
            showCard={false}
          />

          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                {...dragEvents}
              >
                <TableMarkup.Root className="w-full min-w-[1600px]">
            <TableMarkup.Head className="sticky top-0 z-30">
              <TableMarkup.Row>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell36} />
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell35}>
                  No.
                </TableMarkup.HeaderCell>
                {tableColumns.map((col) => {
                  const isSorted = sortConfig.key === col.id;
                  const canSort = col.sortable;
                  return (
                    <TableMarkup.HeaderCell
                      key={col.id}
                      onClick={canSort ? () => handleSort(col.id) : undefined}
                      className={cn(
                        "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group",
                        canSort && "cursor-pointer hover:bg-slate-100 hover:text-slate-700",
                        col.id === "action" && "right-0 z-30 text-center before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]",
                        col.id === "documentNumber" && "min-w-[170px]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">{col.label}</span>
                        {canSort && (
                          <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                            <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600" : "")} />
                            <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600" : "")} />
                          </div>
                        )}
                      </div>
                    </TableMarkup.HeaderCell>
                  );
                })}
              </TableMarkup.Row>
            </TableMarkup.Head>
            <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
              {!isLoading && documents.length === 0 ? (
                <TableMarkup.Row>
                  <TableMarkup.Cell colSpan={tableColumns.length + 2} className="p-0">
                    <TableEmptyState
                      title={error ? "Unable to load documents" : "No Documents Found"}
                      description={error || "We couldn't find any documents matching your filters. Try adjusting your search criteria."}
                    />
                  </TableMarkup.Cell>
                </TableMarkup.Row>
              ) : (
                documents.map((doc, index) => (
                  <React.Fragment key={doc.id}>
                  <TableMarkup.Row className="hover:bg-slate-50/80 transition-colors group">
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-center border-b border-slate-200">
                      {hasDocumentExpansion(doc) && <button
                        type="button"
                        onClick={() => handleExpandDocument(doc.id)}
                        aria-label={`${expandedDocumentId === doc.id ? "Collapse" : "Expand"} document ${doc.documentNumber}`}
                        aria-expanded={expandedDocumentId === doc.id}
                        className="inline-flex items-center justify-center h-5 w-5 rounded-lg transition-colors hover:bg-slate-200"
                      >
                        <ChevronRight className={cn("h-3.5 w-3.5 text-slate-500 transition-transform", expandedDocumentId === doc.id ? "rotate-90" : "rotate-0")} />
                      </button>}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell30}>
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell27}
                      onClick={() => {
                        void navigateToDocument(doc.id);
                      }}
                    >
                      {doc.documentNumber}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                      {formatDateTimeLong(doc.created)}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                      {doc.openedBy || "-"}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell28}>
                      {doc.documentName || "-"}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <Badge color={getBadgeColor(doc.statusCode, doc.status)} size="sm">
                        {doc.status}
                      </Badge>
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                      {doc.type || "-"}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                      {doc.hasRelatedDocuments ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-slate-400">No</span>}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                      {doc.hasCorrelatedDocuments ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-slate-400">No</span>}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                      {doc.isTemplate ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-slate-400">No</span>}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                      {doc.businessUnit || "-"}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                      {doc.department || "-"}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                      {doc.author || "-"}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                      {formatCellDate(doc.effectiveDate)}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                      {formatCellDate(doc.validUntil)}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell
                      onClick={(e) => e.stopPropagation()}
                      className={TABLE_STYLES.emptyCell3}
                    >
                      <button
                        ref={getRef(doc.id)}
                        onClick={(e) => toggle(doc.id, e)}
                        className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="More actions"
                      >
                        <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                      </button>
                      <RowMenu
                        onView={() => {
                          void navigateToDocument(doc.id);
                        }}
                        onEdit={() => {
                          // An Active document being upgraded is not an initial draft: the Author goes to its
                          // detail page, where Upload Revision is offered once the DCO saved the configuration.
                          if (doc.canEditForUpgrade) {
                            void navigateToDocument(doc.id);
                            return;
                          }
                          void handleEditDocument(doc.id);
                        }}
                        onRequestControlledCopy={() => {
                          handleRequestControlledCopy(doc);
                        }}
                        onAuditTrail={() => {
                          void navigateToDocument(doc.id, "audit");
                        }}
                        isOpen={openId === doc.id}
                        onClose={close}
                        position={position}
                        canEditDocument={canCurrentUserEditDocument(doc)}
                        canRequestControlledCopy={canRequestControlledCopyForRow(doc)}
                      />
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                  <ExpandedDocumentRow
                    revision={doc}
                    isExpanded={expandedDocumentId === doc.id}
                    visibleColumnsLength={tableColumns.length + 2}
                    hasDocs={hasDocumentExpansion(doc)}
                    documentId={doc.id}
                  />
                  </React.Fragment>
                ))
              )}
            </TableMarkup.Body>
                </TableMarkup.Root>
              </div>

              {totalItems > 0 && (
                <div className="border-t border-slate-200">
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    isLoading={isTableLoading}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(value) => {
                      setItemsPerPage(value);
                    }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
