import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import type { PortalDropdownMenuProps } from "@/components/ui/dropdown/PortalDropdownMenu";
import { IconCircleOff, IconInfoCircle, IconPlus, IconX } from "@tabler/icons-react";
import { MoreVertical } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { useToast } from "@/components/ui/toast/Toast";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingPersonnelEventsApi, trainingReviewsApi, type TrainingPersonnelReviewSummary } from "@/services/api/trainingActivities";
import { Textarea } from "../shared/TrainingFields";
import { TrainingPersonName } from "../shared/TrainingPersonName";
import { day, trainingBreadcrumbs, TRAINING_PAGES, when } from "../shared/trainingLabels";
import { resettingDates } from "../shared/useListFilters";
import { PersonnelAlertsTab } from "./PersonnelAlertsTab";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { NewPersonnelReviewModal, emptyReviewForm, type NewReviewForm } from "./NewPersonnelReviewModal";
import { REVIEW_KIND_LABEL, REVIEW_STATUS_COLOR, REVIEW_STATUS_FILTER_LABEL, REVIEW_STATUS_LABEL } from "./personnelReviewLabels";
import { usePersonnelReviewServerTable } from "./usePersonnelReviewServerTable";
import { tr, trFormat } from "@/i18n";

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
          {tr("View Details")}
        </DropdownMenuItem>
        {canCancel && (
          <DropdownMenuItem icon={<IconX className="h-4 w-4" />} onClick={() => { onCancel(); onClose(); }}>
            {tr("Cancel Review")}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const canManage = hasPermission("training.job_assignment.manage");
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [isNewReviewOpen, setIsNewReviewOpen] = useState(false);
  const [newReviewKey, setNewReviewKey] = useState(0);
  const [newReviewForm, setNewReviewForm] = useState<NewReviewForm>(emptyReviewForm);
  const [newReviewPeople, setNewReviewPeople] = useState<{ label: string; value: string }[]>([]);
  // Only an initial visit chooses Alerts automatically; Back restores the tab in the URL.
  const [alertCount, setAlertCount] = useState<number>();
  const selectedTab = searchParams.get("tab");
  const tab = selectedTab === "reviews" || selectedTab === "alerts" ? selectedTab : alertCount && alertCount > 0 ? "alerts" : "reviews";
  useEffect(() => { trainingPersonnelEventsApi.count().then(setAlertCount).catch(() => undefined); }, []);
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
    closerFilter,
    setCloserFilter,
    closerOptions,
  } = usePersonnelReviewServerTable();

  const tabs: TabItem[] = [{ id: "alerts", label: tr("Alerts"), count: alertCount }, { id: "reviews", label: tr("Reviews"), count: totalItems }];

  const openNewReview = (form: NewReviewForm, people: { label: string; value: string }[] = []) => {
    setNewReviewForm(form);
    setNewReviewPeople(people);
    setNewReviewKey((key) => key + 1);
    setIsNewReviewOpen(true);
  };
  const navigateToReview = (reviewId: string) => {
    const returnParams = new URLSearchParams(searchParams);
    returnParams.set("tab", tab);
    navigate(`/training-management/personnel-reviews/${reviewId}`, {
      state: { from: `/training-management/personnel-reviews?${returnParams}` },
    });
  };

  // Cancelling an open review needs a reason that stays on record; the server checks the permission and the person again.
  const handleCancelReview = async () => {
    if (!cancelling) return;
    setIsCancelSaving(true);
    try {
      await trainingReviewsApi.cancel(cancelling.id, cancelReason.trim());
      showToast({ type: "success", title: tr("Review cancelled"), message: cancelling.fullName });
      setCancelling(undefined);
    } catch (error) {
      showToast({ type: "error", title: tr("The review was not cancelled"), message: trainingError(error) });
    } finally {
      setIsCancelSaving(false);
    }
  };

  type Row = TrainingPersonnelReviewSummary;
  const reviewColumns: DataTableColumn<Row>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, cell: (_review, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { id: "employeeCode", header: tr("Employee ID"), label: tr("Employee ID"), sort: { direction: sortConfig.key === "employeeCode" ? sortConfig.direction : undefined, onSort: () => handleSort("employeeCode") }, cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => review.employeeCode || "-" },
    {
      id: "employee",
      header: "Full Name",
      label: "Full Name",
      sort: { direction: sortConfig.key === "employee" ? sortConfig.direction : undefined, onSort: () => handleSort("employee") },
      cell: (review) => <TrainingPersonName fullName={review.fullName} avatar={review.avatar} onClick={() => navigateToReview(review.id)} />,
    },
    { id: "kind", header: "Event", label: "Event", sort: { direction: sortConfig.key === "kind" ? sortConfig.direction : undefined, onSort: () => handleSort("kind") }, cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => REVIEW_KIND_LABEL[review.kind] ?? review.kind },
    { id: "eventDate", header: tr("Event Date"), label: tr("Event Date"), sort: { direction: sortConfig.key === "eventDate" ? sortConfig.direction : undefined, onSort: () => handleSort("eventDate") }, cellClassName: "text-slate-600 whitespace-nowrap", cell: (review) => day(review.eventDate) },
    { id: "department", header: "Department", label: "Department", sort: { direction: sortConfig.key === "department" ? sortConfig.direction : undefined, onSort: () => handleSort("department") }, cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => review.department || "-" },
    { id: "status", header: "Status", label: "Status", sort: { direction: sortConfig.key === "status" ? sortConfig.direction : undefined, onSort: () => handleSort("status") }, cell: (review) => (review.status === "OPEN" && review.openItems === 0 ? <Badge color="blue" size="sm">{tr("Ready to close")}</Badge> : <Badge color={REVIEW_STATUS_COLOR[review.status]} size="sm">{REVIEW_STATUS_LABEL[review.status]}</Badge>) },
    { id: "closer", header: "Closer", label: "Closer", cellClassName: "text-slate-700 whitespace-nowrap", cell: (review) => (review.status === "OPEN" ? review.closerName || "-" : review.status === "CLOSED" ? review.closedByName || "-" : "-") },
    { id: "openItems", header: tr("Items to do"), label: tr("Items to do"), sort: { direction: sortConfig.key === "openItems" ? sortConfig.direction : undefined, onSort: () => handleSort("openItems") }, cell: (review) => (review.status === "OPEN" ? review.openItems : "-") },
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
          aria-label={tr("More actions")}
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
    { id: "closer", label: "Closer", value: closerFilter, options: [{ label: "All", value: "" }, ...closerOptions], onChange: setCloserFilter },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.reviews.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "reviews")}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openNewReview(emptyReviewForm)} size="sm" className="whitespace-nowrap gap-2">
                <IconPlus className="h-4 w-4" />
                {tr("New Review")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={tabs} activeTab={tab} onChange={(id) => {
          const params = new URLSearchParams(searchParams);
          params.set("tab", id);
          setSearchParams(params, { replace: true });
        }} variant="underline" ariaLabel={tr("Training reviews")} tabIdPrefix="reviews-tab" panelIdPrefix="reviews-panel" />
        <div id={`reviews-panel-${tab}`} role="tabpanel" aria-labelledby={`reviews-tab-${tab}`} className="min-w-0">
          {tab === "alerts" && <PersonnelAlertsTab canManage={canManage} onOpenReview={openNewReview} onCount={setAlertCount} />}
          {tab === "reviews" && (
            <>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <ReportListToolbar
                framed={false}
                searchPlaceholder={tr("Search employee…")}
                search={searchQuery}
                onSearch={setSearchQuery}
                filters={filters}
                dates={resettingDates([eventRange.filter, openedRange.filter], () => setCurrentPage(1))}
                hasActiveFilters={hasActiveFilters}
                onClear={clearFilters}
                customControl={reviewControl}
              >
                <DataTable
                  rows={reviews}
                  getRowKey={(review) => review.id}
                  columns={reviewLayout.columns}
                  columnLayout={reviewLayout}
                  action={reviewsAction}
                  isLoading={isLoading}
                  emptyState={<TableEmptyState title={tr("No Reviews Found")} description={tr("Open a review when a new employee joins, a person returns after a long absence, or a person transfers.")} />}
                  pagination={
                    totalItems > 0 ? (
                      <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
                    ) : undefined
                  }
                />
              </ReportListToolbar>
            </>
          )}
        </div>
      </div>

      <FormModal
        isOpen={!!cancelling}
        onClose={() => setCancelling(undefined)}
        onConfirm={() => void handleCancelReview()}
        title={tr("Cancel the Review")}
        description={tr("The review stays on record with your reason.")}
        confirmText={tr("Cancel review")}
        confirmVariant="destructive"
        isLoading={isCancelSaving}
        confirmDisabled={!cancelReason.trim()}
        size="md"
      >
        <FormField label={tr("Reason")} required>
          <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </FormField>
      </FormModal>

      <NewPersonnelReviewModal key={newReviewKey} isOpen={isNewReviewOpen} onClose={() => setIsNewReviewOpen(false)} initialForm={newReviewForm} initialPeople={newReviewPeople} />
    </div>
  );
};
