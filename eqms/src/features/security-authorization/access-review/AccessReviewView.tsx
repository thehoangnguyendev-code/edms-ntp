import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ClipboardCheck, Search, X, Check, ChevronUp, ChevronDown, MoreVertical, Eye, Ban } from "lucide-react";
import { IconFilter2, IconInfoCircle, IconX } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { useToast } from "@/components/ui/toast/Toast";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { FormModal } from "@/components/ui/modal/FormModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { cn } from "@/components/ui/utils";
import { useDebounce, useLocalizationPreferences, usePortalDropdown } from "@/hooks";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { settingsApi } from "@/services/api";
import type { AccessReviewCampaignSummary, AccessReviewListOption } from "@/services/api/settings";
import { accessReview as accessReviewBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime, formatDateUS } from "@/utils/format";

const statusBadge = (status: AccessReviewCampaignSummary["status"]) =>
  status === "COMPLETED" ? "emerald" : status === "CANCELLED" ? "slate" : "blue";

const ddmmyyyyToIso = (value: string): string | undefined => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass = "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

export const AccessReviewView: React.FC = () => {
  const navigate = useNavigate();
  useLocalizationPreferences();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canView = hasPermissionAlias("security.access_review.view");
  const canManage = hasPermissionAlias("security.access_review.manage");
  const [campaigns, setCampaigns] = useState<AccessReviewCampaignSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Server-side query state.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusValues, setStatusValues] = useState<AccessReviewListOption[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedFilterSections, setExpandedFilterSections] = useState<Set<string>>(
    () => new Set(["status"]),
  );

  const toggleFilterSection = (section: string) => {
    setExpandedFilterSections((previous) => {
      const next = new Set(previous);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [reviewPeriodStart, setReviewPeriodStart] = useState("");
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AccessReviewCampaignSummary | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await settingsApi.listAccessReviewsPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        sortBy: sortKey,
        sortDir,
      });
      setCampaigns(res.data ?? []);
      setTotalItems(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: "Failed to load access reviews" });
    } finally {
      setLoading(false);
    }
  }, [canView, currentPage, itemsPerPage, debouncedSearch, statusFilter, createdFrom, createdTo, updatedFrom, updatedTo, sortKey, sortDir, showToast]);

  useEffect(() => {
    if (!canView) return;
    settingsApi.getAccessReviewListOptions()
      .then((o) => setStatusValues(o.statuses ?? []))
      .catch(() => setStatusValues([]));
  }, [canView]);

  const statusOptions: SelectOption[] = [
    { label: "All Status", value: "ALL" },
    ...statusValues.map((status) => ({ label: status.label, value: status.value })),
  ];
  const hasFilters = !!search || statusFilter !== "ALL" || !!createdFrom || !!createdTo || !!updatedFrom || !!updatedTo;
  const clearFilters = () => { setSearch(""); setStatusFilter("ALL"); setCreatedFrom(""); setCreatedTo(""); setUpdatedFrom(""); setUpdatedTo(""); setCurrentPage(1); };
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setIsCreateModalOpen(false);
  };

  const openCreateModal = () => {
    setCampaignName("");
    setCampaignDescription("");
    setReviewPeriodStart("");
    setReviewPeriodEnd("");
    setIsCreateModalOpen(true);
  };

  const createCampaign = async () => {
    if (!campaignName.trim()) {
      showToast({ type: "error", title: "Validation failed", message: "Campaign name is required" });
      return;
    }
    setCreating(true);
    try {
      const detail = await settingsApi.createAccessReview({
        name: campaignName.trim(),
        description: campaignDescription.trim() || undefined,
        reviewPeriodStart: ddmmyyyyToIso(reviewPeriodStart),
        reviewPeriodEnd: ddmmyyyyToIso(reviewPeriodEnd),
      });
      setIsCreateModalOpen(false);
      showToast({ type: "success", message: "Access review campaign created" });
      navigate(`${ROUTES.SECURITY.ACCESS_REVIEW}/${detail.campaign.id}`);
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.message ?? "Failed to create campaign" });
    } finally {
      setCreating(false);
    }
  };

  const cancelCampaign = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await settingsApi.cancelAccessReview(cancelTarget.id);
      showToast({ type: "success", message: "Campaign cancelled" });
      setCancelTarget(null);
      void load();
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.message ?? "Failed to cancel campaign" });
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      <PageHeader
        title="Access Review"
        breadcrumbItems={accessReviewBreadcrumb(navigate)}
        actions={
          canManage ? (
            <Button size="sm" className="whitespace-nowrap gap-2" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          ) : undefined
        }
      />

      {!canView ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <TableEmptyState title="Permission denied" description="You do not have permission to view access reviews." />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
          <div className="p-4 md:p-5 flex-1 flex flex-col">

            {/* Mobile: search + filter drawer */}
            <div className="flex md:hidden items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Search campaigns…"
                  className="w-full pl-9 pr-8 h-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>

            {/* Desktop filters */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    placeholder="Search campaigns…"
                    className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                  />
                </div>
              </div>
              <Select label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(String(v)); setCurrentPage(1); }} options={statusOptions} />
              <DateRangePicker label="Created Date Range" startDate={createdFrom} endDate={createdTo} onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }} placeholder="Select created date range" autoApply />
              <DateRangePicker label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo} onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }} placeholder="Select last updated range" autoApply />
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap disabled:opacity-40"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            <div className="flex-1 flex flex-col relative">
              {loading && (
                <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center rounded-xl">
                  <SectionLoading minHeight="150px" />
                </div>
              )}
              {!loading && campaigns.length === 0 ? (
                <div className="border border-slate-200 rounded-xl py-12 bg-white">
                  <TableEmptyState
                    icon={<ClipboardCheck className="h-10 w-10 text-slate-300" />}
                    title="No Access Review Campaigns"
                    description="Create a campaign to snapshot and review every user's current access."
                  />
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px]">
                    <thead className="sticky top-0 z-30">
                      <tr>
                        <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-14">
                          No.
                        </th>
                        {([
                          { key: "name", label: "Campaign", sortable: true },
                          { key: "period", label: "Period", sortable: false },
                          { key: "status", label: "Status", sortable: true },
                          { key: "totalItems", label: "Users", sortable: true },
                          { key: "pendingItems", label: "Pending", sortable: true },
                          { key: "reviewer", label: "Reviewer", sortable: false },
                          { key: "createdAt", label: "Created Date", sortable: true },
                          { key: "updatedAt", label: "Last Updated", sortable: true },
                        ] as const).map((col) => (
                          <th
                            key={col.key}
                            onClick={col.sortable ? () => handleSort(col.key) : undefined}
                            className={cn(
                              "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group",
                              col.sortable && "cursor-pointer hover:bg-slate-100 hover:text-slate-700",
                            )}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate">{col.label}</span>
                              {col.sortable && (
                                <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                                  <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === col.key && sortDir === "asc" ? "text-emerald-600" : "")} />
                                  <ChevronDown className={cn("h-3 w-3", sortKey === col.key && sortDir === "desc" ? "text-emerald-600" : "")} />
                                </div>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {campaigns.map((c, index) => (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          onClick={() => navigate(`${ROUTES.SECURITY.ACCESS_REVIEW}/${c.id}`)}
                        >
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-center text-slate-500">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td
                            className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-emerald-600 cursor-pointer hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`${ROUTES.SECURITY.ACCESS_REVIEW}/${c.id}`);
                            }}
                          >
                            {c.name}
                            {c.description && <div className="max-w-[280px] truncate text-xs text-slate-400">{c.description}</div>}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {c.reviewPeriodStart ? formatDateUS(c.reviewPeriodStart) : "—"} → {c.reviewPeriodEnd ? formatDateUS(c.reviewPeriodEnd) : "—"}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge color={statusBadge(c.status)} size="xs">
                              {c.statusLabel}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{c.totalItems}</td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <span className={c.pendingItems > 0 ? "text-amber-600 font-medium" : "text-emerald-600"}>{c.pendingItems}</span>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{c.reviewerName ?? "—"}</td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {formatDateTime(c.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {formatDateTime(c.updatedAt)}
                          </td>
                          <td
                            onClick={(event) => event.stopPropagation()}
                            className="sticky right-0 z-10 bg-white py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                          >
                            <button
                              ref={getRef(c.id)}
                              onClick={(event) => toggle(c.id, event)}
                              className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                              aria-label={`Actions for ${c.name}`}
                            >
                              <MoreVertical className="h-4 w-4 text-slate-600" />
                            </button>
                            <PortalDropdownMenu isOpen={openId === c.id} onClose={close} position={position}>
                              <div className="py-1">
                                <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { close(); navigate(`${ROUTES.SECURITY.ACCESS_REVIEW}/${c.id}`); }}>
                                  View Details
                                </DropdownMenuItem>
                                {canManage && c.status === "IN_PROGRESS" && (
                                  <DropdownMenuItem
                                    icon={<IconX className="h-4 w-4" />}
                                    onClick={() => { close(); setCancelTarget(c); }}
                                  >
                                    Cancel Campaign
                                  </DropdownMenuItem>
                                )}
                              </div>
                            </PortalDropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalItems > 0 && (
                  <div className="border-t border-slate-200">
                    <TablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      itemsPerPage={itemsPerPage}
                      isLoading={loading}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
                      itemsPerPageOptions={[10, 20, 50]}
                    />
                  </div>
                )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile filter drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Created Date Range" isExpanded={expandedFilterSections.has("createdDate")} onToggle={() => toggleFilterSection("createdDate")}>
          <div className="pt-1 pb-4"><DateRangePicker label="Created Date Range" startDate={createdFrom} endDate={createdTo} onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }} placeholder="Select created date range" autoApply /></div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Last Updated Range" isExpanded={expandedFilterSections.has("updatedDate")} onToggle={() => toggleFilterSection("updatedDate")}>
          <div className="pt-1 pb-4"><DateRangePicker label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo} onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }} placeholder="Select last updated range" autoApply /></div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Status" isExpanded={expandedFilterSections.has("status")} onToggle={() => toggleFilterSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {statusOptions.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setStatusFilter(String(opt.value)); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                  statusFilter === opt.value
                    ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
                    : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      <FormModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onConfirm={() => void createCampaign()}
        title="New Access Review Campaign"
        description="Snapshots every user's current access for periodic review (EU-GMP Annex 11)."
        confirmText="Create Campaign"
        isLoading={creating}
        confirmDisabled={!campaignName.trim()}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Name <span className="text-red-500">*</span></label>
            <input className={inputClass} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Q3 2026 Periodic Access Review" autoFocus />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={textareaClass} rows={2} value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateTimePicker label="Review Period Start" value={reviewPeriodStart} onChange={setReviewPeriodStart} placeholder="Select start date" />
            <DateTimePicker label="Review Period End" value={reviewPeriodEnd} onChange={setReviewPeriodEnd} placeholder="Select end date" />
          </div>
        </div>
      </FormModal>

      <AlertModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => { if (!cancelling) setCancelTarget(null); }}
        onConfirm={() => void cancelCampaign()}
        type="warning"
        title="Cancel Access Review Campaign"
        description={cancelTarget ? `Are you sure you want to cancel "${cancelTarget.name}"? This action cannot be undone.` : ""}
        confirmText="Cancel Campaign"
        cancelText="Back"
        showCancel
        isLoading={cancelling}
      />
    </div>
  );
};
