import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  MoreVertical,
  Plus,
  Search,
  X,
} from "lucide-react";
import { IconFilter2, IconInfoCircle, IconX } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import {
  FilterAccordionItem,
  FilterDrawer,
} from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import { FormModal } from "@/components/ui/modal/FormModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { useDebounce, usePortalDropdown, useTableDragScroll } from "@/hooks";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import {
  auditTrailApi,
  type AuditTrailReviewCampaignSummary,
} from "@/services/api/auditTrail";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { formatDateUS } from "@/utils/format";
import { auditTrailReview as auditTrailReviewBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "ALL" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const statusBadge = (status: AuditTrailReviewCampaignSummary["status"]) =>
  status === "COMPLETED"
    ? "emerald"
    : status === "CANCELLED"
      ? "slate"
      : "blue";

const ddmmyyyyToIso = (value: string): string | undefined => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const labelClass = "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";
const textareaClass =
  "w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 px-3 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

type SortKey =
  "createdAt" | "name" | "status" | "reviewPeriodStart" | "reviewPeriodEnd";

const SortHeader: React.FC<{
  label: string;
  column: SortKey;
  current: SortKey;
  direction: "asc" | "desc";
  onSort: (column: SortKey) => void;
  align?: "left" | "center";
}> = ({ label, column, current, direction, onSort, align = "left" }) => {
  return (
    <th
      onClick={() => onSort(column)}
      className={cn(
        "sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-2xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 md:text-xs cursor-pointer group",
        align === "center" ? "text-center" : "text-left",
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-2",
          align === "center" && "justify-center",
        )}
      >
        <span className="truncate">{label}</span>
        <div className="flex flex-shrink-0 flex-col text-slate-500 transition-colors group-hover:text-slate-700">
          <ChevronUp
            className={cn(
              "-mb-1 h-3 w-3",
              current === column && direction === "asc" && "text-emerald-600",
            )}
          />
          <ChevronDown
            className={cn(
              "h-3 w-3",
              current === column && direction === "desc" && "text-emerald-600",
            )}
          />
        </div>
      </div>
    </th>
  );
};

export const AuditTrailReviewView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canView = hasPermissionAlias("audit.review.view");
  const canManage = hasPermissionAlias("audit.review.manage");
  const [campaigns, setCampaigns] = useState<AuditTrailReviewCampaignSummary[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchQuery = useDebounce(search, 350);
  const [status, setStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [reviewPeriodStart, setReviewPeriodStart] = useState("");
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [cancelTarget, setCancelTarget] =
    useState<AuditTrailReviewCampaignSummary | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await auditTrailApi.listReviewCampaignsPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        status: status === "ALL" ? undefined : status,
        sortBy,
        sortDirection,
      });
      setCampaigns(response.data ?? []);
      setTotalItems(response.pagination.total);
      setTotalPages(Math.max(1, response.pagination.totalPages));
    } catch {
      setCampaigns([]);
      setTotalItems(0);
      setTotalPages(1);
      showToast({
        type: "error",
        message: "Failed to load audit trail review campaigns",
      });
    } finally {
      setLoading(false);
    }
  }, [
    canView,
    currentPage,
    itemsPerPage,
    searchQuery,
    showToast,
    sortBy,
    sortDirection,
    status,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setSortBy("createdAt");
    setSortDirection("desc");
    setCurrentPage(1);
  };

  const changeSort = (column: SortKey) => {
    setCurrentPage(1);
    if (sortBy === column)
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const openCreateModal = () => {
    setCampaignName("");
    setCampaignDescription("");
    setReviewPeriodStart("");
    setReviewPeriodEnd("");
    setIsCreateModalOpen(true);
  };

  const createCampaign = async () => {
    const startIso = ddmmyyyyToIso(reviewPeriodStart);
    const endIso = ddmmyyyyToIso(reviewPeriodEnd);
    if (!campaignName.trim() || !startIso || !endIso) {
      showToast({
        type: "error",
        title: "Validation failed",
        message: "Name and review period are required",
      });
      return;
    }
    setCreating(true);
    try {
      const detail = await auditTrailApi.createReviewCampaign({
        name: campaignName.trim(),
        description: campaignDescription.trim() || undefined,
        reviewPeriodStart: startIso,
        reviewPeriodEnd: endIso,
      });
      setIsCreateModalOpen(false);
      showToast({
        type: "success",
        message: "Audit trail review campaign created",
      });
      navigate(`${ROUTES.AUDIT_TRAIL_REVIEW}/${detail.campaign.id}`);
    } catch (error: any) {
      showToast({
        type: "error",
        message: error?.response?.data?.message ?? "Failed to create campaign",
      });
    } finally {
      setCreating(false);
    }
  };

  const cancelCampaign = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await auditTrailApi.cancelReviewCampaign(cancelTarget.id);
      showToast({ type: "success", message: "Campaign cancelled" });
      setCancelTarget(null);
      void load();
    } catch (error: any) {
      showToast({
        type: "error",
        message: error?.response?.data?.message ?? "Failed to cancel campaign",
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col space-y-6">
      <PageHeader
        title="Audit Trail Review"
        breadcrumbItems={auditTrailReviewBreadcrumb(navigate)}
        actions={
          canManage ? (
            <Button
              size="sm"
              className="gap-2 whitespace-nowrap"
              onClick={openCreateModal}
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          ) : undefined
        }
      />

      {!canView ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <TableEmptyState
            title="Permission denied"
            description="You do not have permission to view audit trail reviews."
          />
        </section>
      ) : (
        <section className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col px-4 pt-4 md:p-5">
            <div className="-mx-1.5 mb-[-0.375rem] px-1.5 pb-1.5">
              <div className="mb-4 flex w-full flex-col gap-1.5 md:hidden">
                <label className={labelClass}>Search</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3.5 h-4 w-4 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search campaign, description, reviewer..."
                      className="block h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearch("");
                          setCurrentPage(1);
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setFilterDrawerOpen(true)}
                    className="h-10 whitespace-nowrap gap-2"
                  >
                    <IconFilter2 className="h-4 w-4" />
                    Filters
                  </Button>
                </div>
              </div>

              <div className="hidden grid-cols-1 items-end gap-4 md:grid sm:grid-cols-2 lg:grid-cols-3">
                <div className="w-full">
                  <label className={labelClass}>Search</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search campaign, description, reviewer..."
                      className="block h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearch("");
                          setCurrentPage(1);
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <Select
                  label="Status"
                  value={status}
                  onChange={(value) => {
                    setStatus(String(value));
                    setCurrentPage(1);
                  }}
                  options={STATUS_OPTIONS}
                />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="h-9 whitespace-nowrap px-4 font-medium transition-all duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 flex-col px-4 pb-4 md:px-5 md:pb-5">
            <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300">
              {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                  <SectionLoading
                    text="Loading campaigns..."
                    minHeight="180px"
                  />
                </div>
              )}
              <div
                ref={scrollerRef}
                className={cn(
                  "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                )}
                {...dragEvents}
              >
                <table className="w-full min-w-[68rem] border-spacing-0 text-left">
                  <thead className="sticky top-0 z-30">
                    <tr>
                      <th className="sticky top-0 z-20 w-16 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        No.
                      </th>
                      <SortHeader
                        label="Campaign"
                        column="name"
                        current={sortBy}
                        direction={sortDirection}
                        onSort={changeSort}
                      />
                      <SortHeader
                        label="Review Period"
                        column="reviewPeriodStart"
                        current={sortBy}
                        direction={sortDirection}
                        onSort={changeSort}
                      />
                      <SortHeader
                        label="Status"
                        column="status"
                        current={sortBy}
                        direction={sortDirection}
                        onSort={changeSort}
                      />
                      <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        Entries
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        Pending
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                        Reviewer
                      </th>
                      <SortHeader
                        label="Created"
                        column="createdAt"
                        current={sortBy}
                        direction={sortDirection}
                        onSort={changeSort}
                      />
                      <th className="sticky right-0 top-0 z-30 w-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs font-bold uppercase tracking-wider text-slate-500 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 md:text-xs">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {!loading && campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12">
                          <TableEmptyState
                            icon={
                              <ClipboardCheck className="h-10 w-10 text-slate-300" />
                            }
                            title="No Audit Trail Review Campaigns"
                            description="Create a periodic campaign to review audit trail entries."
                          />
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((campaign, index) => (
                        <tr
                          key={campaign.id}
                          className="cursor-pointer transition-colors hover:bg-slate-50/80"
                          onClick={() =>
                            navigate(
                              `${ROUTES.AUDIT_TRAIL_REVIEW}/${campaign.id}`,
                            )
                          }
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-slate-500 sm:text-sm">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="px-4 py-3 text-xs sm:text-sm">
                            <p className="font-medium text-emerald-600">
                              {campaign.name}
                            </p>
                            {campaign.description && (
                              <p
                                className="mt-0.5 max-w-md truncate text-xs text-slate-400"
                                title={campaign.description}
                              >
                                {campaign.description}
                              </p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                            {campaign.reviewPeriodStart
                              ? formatDateUS(campaign.reviewPeriodStart)
                              : "—"}{" "}
                            →{" "}
                            {campaign.reviewPeriodEnd
                              ? formatDateUS(campaign.reviewPeriodEnd)
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge
                              color={statusBadge(campaign.status)}
                              size="xs"
                            >
                              {campaign.statusLabel}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                            {campaign.totalItems}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs sm:text-sm">
                            <span
                              className={
                                campaign.pendingItems > 0
                                  ? "font-medium text-amber-600"
                                  : "text-emerald-600"
                              }
                            >
                              {campaign.pendingItems}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                            {campaign.reviewerName ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                            {campaign.createdAt
                              ? formatDateUS(campaign.createdAt)
                              : "—"}
                          </td>
                          <td
                            className="sticky right-0 z-30 whitespace-nowrap bg-white px-4 py-3 text-center shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 group-hover:bg-slate-50"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              ref={getRef(campaign.id)}
                              onClick={(event) => toggle(campaign.id, event)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
                              aria-label={`Actions for ${campaign.name}`}
                            >
                              <MoreVertical className="h-4 w-4 text-slate-600" />
                            </button>
                            <PortalDropdownMenu
                              isOpen={openId === campaign.id}
                              onClose={close}
                              position={position}
                            >
                              <div className="py-1">
                                <DropdownMenuItem
                                  icon={<IconInfoCircle className="h-4 w-4" />}
                                  onClick={() => {
                                    close();
                                    navigate(
                                      `${ROUTES.AUDIT_TRAIL_REVIEW}/${campaign.id}`,
                                    );
                                  }}
                                >
                                  View Details
                                </DropdownMenuItem>
                                {canManage &&
                                  campaign.status === "IN_PROGRESS" && (
                                    <DropdownMenuItem
                                      icon={<IconX className="h-4 w-4" />}
                                      onClick={() => {
                                        close();
                                        setCancelTarget(campaign);
                                      }}
                                    >
                                      Cancel Campaign
                                    </DropdownMenuItem>
                                  )}
                              </div>
                            </PortalDropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalItems > 0 && (
                <div className="border-t border-slate-200">
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={setItemsPerPage}
                    showItemCount
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Status"
          isExpanded
          onToggle={() => undefined}
        >
          <div className="grid gap-2 pb-4 pt-1">
            {STATUS_OPTIONS.map((option) => (
              <FilterOptionButton
                key={option.value}
                label={option.label}
                isSelected={status === option.value}
                onClick={() => {
                  setStatus(option.value);
                  setCurrentPage(1);
                }}
              />
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      <FormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!creating) setIsCreateModalOpen(false);
        }}
        onConfirm={() => void createCampaign()}
        title="New Audit Trail Review Campaign"
        description="Snapshots every audit trail entry created within the review period (EU-GMP Annex 11 §9)."
        confirmText="Create Campaign"
        isLoading={creating}
        confirmDisabled={
          !campaignName.trim() || !reviewPeriodStart || !reviewPeriodEnd
        }
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="July 2026 Monthly Audit Trail Review"
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={textareaClass}
              rows={2}
              value={campaignDescription}
              onChange={(event) => setCampaignDescription(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateTimePicker
              label={
                <>
                  Review Period Start <span className="text-red-500">*</span>
                </>
              }
              value={reviewPeriodStart}
              onChange={setReviewPeriodStart}
              placeholder="Select start date"
            />
            <DateTimePicker
              label={
                <>
                  Review Period End <span className="text-red-500">*</span>
                </>
              }
              value={reviewPeriodEnd}
              onChange={setReviewPeriodEnd}
              placeholder="Select end date"
            />
          </div>
        </div>
      </FormModal>
      <AlertModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => {
          if (!cancelling) setCancelTarget(null);
        }}
        onConfirm={() => void cancelCampaign()}
        type="warning"
        title="Cancel Audit Trail Review Campaign"
        description={
          cancelTarget
            ? `Are you sure you want to cancel "${cancelTarget.name}"? This action cannot be undone.`
            : ""
        }
        confirmText="Cancel Campaign"
        cancelText="Back"
        showCancel
        isLoading={cancelling}
      />
    </div>
  );
};
