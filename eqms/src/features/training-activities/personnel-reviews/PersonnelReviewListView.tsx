import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import type { PortalDropdownMenuProps } from "@/components/ui/dropdown/PortalDropdownMenu";
import { IconCircleOff, IconInfoCircle, IconPlus } from "@tabler/icons-react";
import { MoreVertical } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { useToast } from "@/components/ui/toast/Toast";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingReviewsApi, type TrainingPersonnelReviewSummary, type TrainingReviewSuggestion } from "@/services/api/trainingActivities";
import { Textarea } from "../shared/TrainingFields";
import { TrainingPersonName } from "../shared/TrainingPersonName";
import { day, trainingBreadcrumbs, TRAINING_PAGES, when } from "../shared/trainingLabels";
import { resettingDates } from "../shared/useListFilters";
import { NewPersonnelReviewModal, emptyReviewForm, type NewReviewForm } from "./NewPersonnelReviewModal";
import { REVIEW_KIND_LABEL, REVIEW_STATUS_COLOR, REVIEW_STATUS_FILTER_LABEL, REVIEW_STATUS_LABEL } from "./personnelReviewLabels";
import { usePersonnelReviewServerTable } from "./usePersonnelReviewServerTable";

interface RowMenuProps {
  onView: () => void;
  onCancel: () => void;
  canCancel?: boolean;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownMenuProps["position"];
}

const RowMenu: React.FC<RowMenuProps> = ({ onView, onCancel, canCancel, isOpen, onClose, position }) => {
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position}>
      <div className="py-1">
        <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { onView(); onClose(); }}>
          View Detail
        </DropdownMenuItem>
        {canCancel && (
          <DropdownMenuItem icon={<IconCircleOff className="h-4 w-4" />} onClick={() => { onCancel(); onClose(); }}>
            Cancel Review
          </DropdownMenuItem>
        )}
      </div>
    </PortalDropdownMenu>
  );
};

/**
 * The reviews of the training of a person after an event that people handle by hand (SOP.0003 5.1 and 5.3.11). The system keeps the checklist, the links to the training
 * that was organised and the signature that closes it; it does not detect the event.
 */
export const PersonnelReviewListView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const canManage = hasPermission("training.job_assignment.manage");
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [isNewReviewOpen, setIsNewReviewOpen] = useState(false);
  const [newReviewKey, setNewReviewKey] = useState(0);
  const [newReviewForm, setNewReviewForm] = useState<NewReviewForm>(emptyReviewForm);
  const [newReviewPeople, setNewReviewPeople] = useState<{ label: string; value: string }[]>([]);
  const [suggestions, setSuggestions] = useState<TrainingReviewSuggestion[]>([]);
  const [cancelling, setCancelling] = useState<TrainingPersonnelReviewSummary>();
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelSaving, setIsCancelSaving] = useState(false);
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    departmentFilter,
    setDepartmentFilter,
    departmentOptions,
    eventRange,
    openedRange,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalItems,
    totalPages,
    reviews,
    isLoading,
    error,
    sortConfig,
    handleSort,
    clearFilters,
    hasActiveFilters,
  } = usePersonnelReviewServerTable();

  useEffect(() => {
    if (canManage) trainingReviewsApi.suggestions().then(setSuggestions).catch(() => setSuggestions([]));
  }, [canManage]);

  const isInitialLoading = isLoading && reviews.length === 0;
  const isTableLoading = isLoading && reviews.length > 0;

  const openNewReview = (form: NewReviewForm, people: { label: string; value: string }[] = []) => {
    setNewReviewForm(form);
    setNewReviewPeople(people);
    setNewReviewKey((key) => key + 1);
    setIsNewReviewOpen(true);
  };
  // A new employee found in the user profiles opens the dialog already filled in.
  const startReviewFor = (suggestion: TrainingReviewSuggestion) =>
    openNewReview(
      { ...emptyReviewForm, kind: "NEW_HIRE", personId: suggestion.id, eventDate: suggestion.startDate.slice(0, 10) },
      [{ label: `${suggestion.fullName}${suggestion.employeeCode ? ` (${suggestion.employeeCode})` : ""}`, value: suggestion.id }],
    );

  const navigateToReview = (reviewId: string) => navigate(`/training-management/personnel-reviews/${reviewId}`);

  // Cancelling an open review needs a reason that stays on record; the server checks the permission and the person again.
  const handleCancelReview = async () => {
    if (!cancelling) return;
    setIsCancelSaving(true);
    try {
      await trainingReviewsApi.cancel(cancelling.id, cancelReason.trim());
      showToast({ type: "success", title: "Review cancelled", message: cancelling.fullName });
      setCancelling(undefined);
    } catch (error) {
      showToast({ type: "error", title: "The review was not cancelled", message: trainingError(error) });
    } finally {
      setIsCancelSaving(false);
    }
  };

  type Row = TrainingPersonnelReviewSummary;
  const reviewColumns: DataTableColumn<Row>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, cell: (_review, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { id: "employeeCode", header: "Employee ID", label: "Employee ID", sort: { direction: sortConfig.key === "employeeCode" ? sortConfig.direction : undefined, onSort: () => handleSort("employeeCode") }, cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => review.employeeCode || "-" },
    {
      id: "employee",
      header: "Full Name",
      label: "Full Name",
      sort: { direction: sortConfig.key === "employee" ? sortConfig.direction : undefined, onSort: () => handleSort("employee") },
      cell: (review) => <TrainingPersonName fullName={review.fullName} avatar={review.avatar} onClick={() => navigateToReview(review.id)} />,
    },
    { id: "kind", header: "Event", label: "Event", sort: { direction: sortConfig.key === "kind" ? sortConfig.direction : undefined, onSort: () => handleSort("kind") }, cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => REVIEW_KIND_LABEL[review.kind] ?? review.kind },
    { id: "eventDate", header: "Event Date", label: "Event Date", sort: { direction: sortConfig.key === "eventDate" ? sortConfig.direction : undefined, onSort: () => handleSort("eventDate") }, cellClassName: "text-slate-600 whitespace-nowrap", cell: (review) => day(review.eventDate) },
    { id: "department", header: "Department", label: "Department", sort: { direction: sortConfig.key === "department" ? sortConfig.direction : undefined, onSort: () => handleSort("department") }, cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => review.department || "-" },
    { id: "status", header: "Status", label: "Status", sort: { direction: sortConfig.key === "status" ? sortConfig.direction : undefined, onSort: () => handleSort("status") }, cell: (review) => (review.status === "OPEN" && review.openItems === 0 ? <Badge color="blue" size="sm">Ready to close</Badge> : <Badge color={REVIEW_STATUS_COLOR[review.status]} size="sm">{REVIEW_STATUS_LABEL[review.status]}</Badge>) },
    { id: "closer", header: "Closer", label: "Closer", cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => (review.status === "OPEN" ? review.closerName || "-" : "-") },
    { id: "openItems", header: "Items to do", label: "Items to do", sort: { direction: sortConfig.key === "openItems" ? sortConfig.direction : undefined, onSort: () => handleSort("openItems") }, cell: (review) => (review.status === "OPEN" ? review.openItems : "-") },
    { id: "openedBy", header: "Opened By", label: "Opened By", sort: { direction: sortConfig.key === "createdBy" ? sortConfig.direction : undefined, onSort: () => handleSort("createdBy") }, cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => review.createdByName || "-" },
    { id: "created", header: "Created", label: "Created", sort: { direction: sortConfig.key === "createdAt" ? sortConfig.direction : undefined, onSort: () => handleSort("createdAt") }, cellClassName: "text-slate-600 whitespace-nowrap", cell: (review) => when(review.createdAt) },
  ];
  const reviewsAction: DataTableAction<Row> = {
    header: "Action",
    cell: (review) => (
      <div onClick={(e) => e.stopPropagation()}>
        <button
          ref={getRef(review.id)}
          onClick={(e) => toggle(review.id, e)}
          className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
        </button>
        <RowMenu
          onView={() => navigateToReview(review.id)}
          onCancel={() => { setCancelReason(""); setCancelling(review); }}
          canCancel={canManage && review.status === "OPEN"}
          isOpen={openId === review.id}
          onClose={close}
          position={position}
        />
      </div>
    ),
  };
  const { layout: reviewLayout, control: reviewControl } = useCustomColumnLayout("training.personnel.reviews", reviewColumns, reviewsAction);

  const filters: ReportSelectFilter[] = [
    { id: "kind", label: "Event", value: kindFilter, options: [{ label: "All", value: "" }, ...Object.entries(REVIEW_KIND_LABEL).map(([value, label]) => ({ label, value }))], onChange: setKindFilter },
    { id: "status", label: "Status", value: statusFilter, options: [{ label: "All", value: "" }, ...Object.entries(REVIEW_STATUS_FILTER_LABEL).map(([value, label]) => ({ label, value }))], onChange: setStatusFilter },
    { id: "department", label: "Department", value: departmentFilter, options: [{ label: "All", value: "" }, ...departmentOptions], onChange: setDepartmentFilter },
  ];

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {isInitialLoading && <FullPageLoading text="Loading reviews..." />}

      <PageHeader
        title={TRAINING_PAGES.reviews.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "reviews")}
        actions={
          canManage ? (
            <Button onClick={() => openNewReview(emptyReviewForm)} size="sm" className="whitespace-nowrap gap-2">
              <IconPlus className="h-4 w-4" />
              New Review
            </Button>
          ) : undefined
        }
      />

      {suggestions.length > 0 && (
        <section aria-label="New employees without a review" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {suggestions.length} new employee{suggestions.length === 1 ? "" : "s"} started in the last 60 days and {suggestions.length === 1 ? "has" : "have"} no initial training review.
          </p>
          <p className="mt-1 text-xs text-amber-800">The start date comes from the user profile. This is a reminder, not a rule: open the review when it applies.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <Button size="sm" variant="outline" onClick={() => startReviewFor(suggestion)}>
                  {suggestion.fullName} · started {day(suggestion.startDate)} · Open review
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FormModal
        isOpen={!!cancelling}
        onClose={() => setCancelling(undefined)}
        onConfirm={() => void handleCancelReview()}
        title="Cancel the Review"
        description="The review stays on record with your reason."
        confirmText="Cancel review"
        confirmVariant="destructive"
        isLoading={isCancelSaving}
        confirmDisabled={!cancelReason.trim()}
        size="md"
      >
        <FormField label="Reason" required>
          <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </FormField>
      </FormModal>

      <NewPersonnelReviewModal key={newReviewKey} isOpen={isNewReviewOpen} onClose={() => setIsNewReviewOpen(false)} initialForm={newReviewForm} initialPeople={newReviewPeople} />

      <ReportListToolbar
        searchPlaceholder="Search employee…"
        search={searchQuery}
        onSearch={setSearchQuery}
        filters={filters}
        dates={resettingDates([eventRange.filter, openedRange.filter], () => setCurrentPage(1))}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        customControl={reviewControl}
      >
        <div className="flex-1 flex flex-col relative">
          {isTableLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}

          <DataTable
            rows={reviews}
            getRowKey={(review) => review.id}
            columns={reviewLayout.columns}
            columnLayout={reviewLayout}
            action={reviewsAction}
            isLoading={isLoading}
            emptyState={
              <TableEmptyState
                title={error ? "Unable to load reviews" : "No Reviews Found"}
                description={error || "Open a review when a new employee joins, a person returns after a long absence, or a person transfers."}
              />
            }
            pagination={
              totalItems > 0 ? (
                <div className="border-t border-slate-200">
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    isLoading={isTableLoading}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </div>
              ) : undefined
            }
          />
        </div>
      </ReportListToolbar>
    </div>
  );
};
