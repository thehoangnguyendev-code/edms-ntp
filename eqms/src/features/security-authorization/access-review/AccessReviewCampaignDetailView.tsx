import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, ChevronUp, MoreVertical, Search, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { Avatar } from "@/components/ui/avatar";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { settingsApi } from "@/services/api";
import type {
  AccessReviewCampaignDetail,
  AccessReviewCampaignSummary,
  AccessReviewItem,
  AccessReviewListOption,
} from "@/services/api/settings";
import { accessReview as accessReviewBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { useDebounce, useLocalizationPreferences, usePortalDropdown, useTableDragScroll } from "@/hooks";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { formatDateTime, formatDateUS } from "@/utils/format";
import {
  IconCheck,
  IconCircleMinus,
  IconPencilMinus,
} from "@tabler/icons-react";

const DECISIONS: {
  value: AccessReviewItem["decision"];
  label: string;
  color: string;
}[] = [
  { value: "CONFIRMED", label: "Confirm", color: "emerald" },
  { value: "MODIFY_REQUESTED", label: "Modify", color: "amber" },
  { value: "REVOKE_REQUESTED", label: "Revoke", color: "red" },
];

const ITEM_COLUMNS: { key: string; label: string; sortable: boolean }[] = [
  { key: "employeeCode", label: "Employee ID", sortable: true },
  { key: "fullName", label: "User", sortable: true },
  { key: "username", label: "User Name", sortable: true },
  { key: "userStatus", label: "Status", sortable: true },
  { key: "accessProfiles", label: "Access Profiles", sortable: true },
  { key: "permissionCount", label: "Permissions", sortable: true },
  { key: "flags", label: "Flags", sortable: false },
  { key: "decision", label: "Decision", sortable: true },
  { key: "decidedAt", label: "Decided", sortable: true },
];

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

const statusBadge = (status: AccessReviewCampaignSummary["status"]) =>
  status === "COMPLETED"
    ? "emerald"
    : status === "CANCELLED"
      ? "slate"
      : "blue";

const userStatusBadge = (status?: string | null) => {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "emerald";
    case "SUSPENDED":
      return "amber";
    case "INACTIVE":
    case "TERMINATED":
      return "red";
    default:
      return "slate";
  }
};

const DecisionModal: React.FC<{
  item: AccessReviewItem | null;
  decision: AccessReviewItem["decision"] | null;
  saving: boolean;
  note: string;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ item, decision, saving, note, onNoteChange, onClose, onConfirm }) => {
  if (!item || !decision) return null;
  const label =
    decision === "REVOKE_REQUESTED"
      ? "Revoke"
      : decision === "MODIFY_REQUESTED"
        ? "Modify"
        : "Confirm";
  return (
    <FormModal
      isOpen={Boolean(item && decision)}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`${label} Access for ${item.fullName ?? item.username}`}
      description={
        decision === "CONFIRMED"
          ? "Confirm that this user's current access is appropriate."
          : decision === "MODIFY_REQUESTED"
            ? "Flag this user's access for modification."
            : "Flag this user's access for revocation."
      }
      confirmText={label}
      cancelText="Cancel"
      showCancel
      isLoading={saving}
      confirmVariant={
        decision === "REVOKE_REQUESTED" ? "destructive" : "default"
      }
      size="lg"
    >
      <div>
        <label className={labelClass}>
          Note{" "}
          {decision !== "CONFIRMED" && (
            <span className="font-normal text-slate-400 text-xs">
              (optional)
            </span>
          )}
        </label>
        <textarea
          className={textareaClass}
          rows={2}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Reviewer note…"
        />
      </div>
    </FormModal>
  );
};

export const AccessReviewCampaignDetailView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useLocalizationPreferences();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("security.access_review.manage");
  const { requestSignature, signatureModal } = useSecurityESign();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();

  const [detail, setDetail] = useState<AccessReviewCampaignDetail | null>(null);
  const [items, setItems] = useState<AccessReviewItem[]>([]);
  const [itemTotal, setItemTotal] = useState(0);
  const [itemTotalPages, setItemTotalPages] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [userStatusFilter, setUserStatusFilter] = useState("ALL");
  const [decisionFilter, setDecisionFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("username");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [listOptions, setListOptions] = useState<Record<string, AccessReviewListOption[]>>({});
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedFilterSections, setExpandedFilterSections] = useState<Set<string>>(new Set(["userStatus", "decision"]));
  const [loading, setLoading] = useState(true);
  const [decisionTarget, setDecisionTarget] = useState<{
    item: AccessReviewItem;
    decision: AccessReviewItem["decision"];
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [campaign, page] = await Promise.all([
        settingsApi.getAccessReviewSummary(id),
        settingsApi.listAccessReviewItemsPaged(id, {
          page: itemPage,
          limit: itemPageSize,
          search: debouncedSearch || undefined,
          userStatus: userStatusFilter === "ALL" ? undefined : userStatusFilter,
          decision: decisionFilter === "ALL" ? undefined : decisionFilter,
          sortBy: sortKey,
          sortDir,
        }),
      ]);
      setDetail({ campaign, items: [] });
      setItems(page.data ?? []);
      setItemTotal(page.pagination?.total ?? 0);
      setItemTotalPages(page.pagination?.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: "Failed to load campaign" });
    } finally {
      setLoading(false);
    }
  }, [id, itemPage, itemPageSize, debouncedSearch, userStatusFilter, decisionFilter, sortKey, sortDir, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    settingsApi.getAccessReviewListOptions().then(setListOptions).catch(() => undefined);
  }, []);

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setItemPage(1);
  };

  const hasFilters = Boolean(search) || userStatusFilter !== "ALL" || decisionFilter !== "ALL";
  const clearFilters = () => {
    setSearch("");
    setUserStatusFilter("ALL");
    setDecisionFilter("ALL");
    setItemPage(1);
  };
  const toggleFilterSection = (section: string) =>
    setExpandedFilterSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  const filterOptionClass = (active: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      active
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );
  const toOptions = (key: string, allLabel: string): SelectOption[] => [
    { label: allLabel, value: "ALL" },
    ...(listOptions[key] ?? []).map((option) => ({ label: option.label, value: option.value })),
  ];

  const handleBack = () =>
    navigateBack(navigate, location.state, ROUTES.SECURITY.ACCESS_REVIEW);

  const openDecision = (
    item: AccessReviewItem,
    decision: AccessReviewItem["decision"],
  ) => {
    setDecisionNote("");
    setDecisionTarget({ item, decision });
  };

  const confirmDecision = async () => {
    if (!decisionTarget || !detail) return;
    const { item, decision } = decisionTarget;
    setDecisionSaving(true);
    try {
      await settingsApi.decideAccessReviewItem(detail.campaign.id, item.id, {
        decision,
        note: decisionNote.trim() || undefined,
      });
      setDecisionTarget(null);
      await load();
    } catch (e: any) {
      showToast({
        type: "error",
        message: e?.response?.data?.message ?? "Failed to record decision",
      });
    } finally {
      setDecisionSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!detail) return;
    const sig = await requestSignature(
      `Complete Access Review "${detail.campaign.name}"`,
      "Security Configuration Change",
    );
    if (!sig) return;
    setCompleting(true);
    try {
      const updated = await settingsApi.completeAccessReview(
        detail.campaign.id,
        sig,
      );
      showToast({
        type: "success",
        message: "Access review completed and signed",
      });
      setDetail(updated);
      await load();
    } catch (e: any) {
      showToast({
        type: "error",
        message: e?.response?.data?.message ?? "Failed to complete review",
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!detail) return;
    try {
      setDetail(await settingsApi.cancelAccessReview(detail.campaign.id));
      await load();
      showToast({ type: "success", message: "Campaign cancelled" });
      setCancelConfirmOpen(false);
    } catch (e: any) {
      showToast({
        type: "error",
        message: e?.response?.data?.message ?? "Failed to cancel",
      });
    }
  };

  if (loading && !detail) {
    return <FullPageLoading text="Loading access review campaign..." />;
  }

  if (!detail) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Access Review"
          breadcrumbItems={accessReviewBreadcrumb(navigate)}
          actions={
            <Button variant="outline-emerald" size="sm" onClick={handleBack}>
              Back
            </Button>
          }
        />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center gap-3">
          <p className="text-sm font-medium text-slate-700">
            Campaign not found
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleBack}
          >
            Back to Access Review
          </Button>
        </div>
      </div>
    );
  }

  const { campaign } = detail;
  const inProgress = campaign.status === "IN_PROGRESS";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Access Review Campaign Detail"
        breadcrumbItems={accessReviewBreadcrumb(
          navigate,
          "Access Review Campaign Detail",
        )}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="whitespace-nowrap"
            >
              Back
            </Button>
            {canManage && inProgress && (
              <>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  onClick={() => setCancelConfirmOpen(true)}
                  className="whitespace-nowrap"
                >
                  Cancel Campaign
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleComplete()}
                  disabled={completing || campaign.pendingItems > 0}
                  title={
                    campaign.pendingItems > 0
                      ? `${campaign.pendingItems} item(s) still pending`
                      : undefined
                  }
                  className="whitespace-nowrap"
                >
                  {completing ? "Completing…" : "Complete & Sign"}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base md:text-lg font-semibold text-slate-800">{campaign.name}</h2>
            <Badge color={statusBadge(campaign.status)} size="sm">{campaign.statusLabel}</Badge>
          </div>
          {campaign.description && (
            <p className="mt-1 text-xs sm:text-sm text-slate-500">{campaign.description}</p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
            {[
              { label: "Total Users", value: campaign.totalItems },
              {
                label: "Pending",
                value: (
                  <span className={campaign.pendingItems > 0 ? "text-amber-600" : "text-emerald-600"}>
                    {campaign.pendingItems}
                  </span>
                ),
              },
              { label: "Review Period Start", value: campaign.reviewPeriodStart ? formatDateUS(campaign.reviewPeriodStart) : "—" },
              { label: "Review Period End", value: campaign.reviewPeriodEnd ? formatDateUS(campaign.reviewPeriodEnd) : "—" },
              { label: "Reviewer", value: campaign.reviewerName ?? "—" },
              { label: "Created", value: campaign.createdAt ? formatDateTime(campaign.createdAt) : "—" },
              { label: "Last Updated", value: campaign.updatedAt ? formatDateTime(campaign.updatedAt) : "—" },
              { label: "Signed", value: campaign.signedAt ? formatDateTime(campaign.signedAt) : "—" },
            ].map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-xs sm:text-sm font-medium text-slate-500 w-36 shrink-0">{field.label}</dt>
                <dd className="text-xs sm:text-sm font-semibold text-slate-900 break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {/* Mobile: search + filter drawer */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setItemPage(1); }}
                placeholder="Search users…"
                className="w-full pl-9 pr-9 h-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setItemPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Desktop / tablet filters: three equal fields on one row, Clear Filters on its own line */}
          <div className="hidden md:block pb-4 md:pb-5">
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="w-full min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setItemPage(1); }}
                  placeholder="Search name, username, employee ID, profile…"
                  className="w-full pl-9 pr-9 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setItemPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <Select
              label="User Status"
              value={userStatusFilter}
              onChange={(v) => { setUserStatusFilter(String(v)); setItemPage(1); }}
              options={toOptions("userStatuses", "All Status")}
            />
            <Select
              label="Decision"
              value={decisionFilter}
              onChange={(v) => { setDecisionFilter(String(v)); setItemPage(1); }}
              options={toOptions("decisions", "All Decisions")}
            />
          </div>
          <div className="mt-4">
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
            {!loading && items.length === 0 ? (
              <div className="border border-slate-200 rounded-xl py-12 bg-white">
                <TableEmptyState
                 
                  title="No Users Found"
                  description="No reviewed users match the current filters."
                />
              </div>
            ) : (
              <div className={cn("border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300", loading && "blur-[2px] opacity-80")}>
                <div
                  ref={scrollerRef}
                  className={cn(
                    "overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                    isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                  )}
                  {...dragEvents}
                >
                  <table className="w-full min-w-max border-spacing-0 text-left">
                    <thead className="sticky top-0 z-30">
                      <tr>
                        <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-14">
                          No.
                        </th>
                        {ITEM_COLUMNS.map((col) => (
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
                                <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                  <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === col.key && sortDir === "asc" ? "text-emerald-600" : "")} />
                                  <ChevronDown className={cn("h-3 w-3", sortKey === col.key && sortDir === "desc" ? "text-emerald-600" : "")} />
                                </div>
                              )}
                            </div>
                          </th>
                        ))}
                        {inProgress && canManage && (
                          <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-center text-slate-500 font-medium">
                            {(itemPage - 1) * itemPageSize + idx + 1}
                          </td>
                          <td
                            className={cn(
                              "py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium",
                              item.userId ? "text-emerald-600 cursor-pointer hover:underline" : "text-slate-400",
                            )}
                            onClick={(event) => {
                              if (!item.userId) return;
                              event.stopPropagation();
                              navigate(ROUTES.SETTINGS.USERS_PROFILE(item.userId), {
                                state: { returnTo: location.pathname },
                              });
                            }}
                          >
                            {item.employeeCode ?? "—"}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={item.fullName || item.username || "User"} tone="brand" className="h-8 w-8" />
                              <span className="font-medium text-slate-900">{item.fullName ?? item.username}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.username}</td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge color={userStatusBadge(item.userStatus)} size="sm">{item.userStatusLabel ?? "—"}</Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap" title={item.accessProfiles ?? undefined}>
                            {item.accessProfiles || <span className="italic text-slate-400">None</span>}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                            {item.superAdmin ? "All (super admin)" : item.permissionCount}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="flex gap-1">
                              {item.superAdmin && <Badge color="purple" size="sm">Super Admin</Badge>}
                              {!item.superAdmin && item.permissionCount === 0 && <Badge color="slate" size="sm">No Permissions</Badge>}
                              {!item.superAdmin && item.permissionCount !== 0 && <span className="text-slate-400">—</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge
                              size="sm"
                              color={
                                item.decision === "CONFIRMED"
                                  ? "emerald"
                                  : item.decision === "PENDING"
                                    ? "slate"
                                    : item.decision === "REVOKE_REQUESTED"
                                      ? "red"
                                      : "amber"
                              }
                            >
                              {item.decisionLabel}
                            </Badge>
                            {item.decisionNote && (
                              <div className="mt-0.5 max-w-[200px] truncate text-xs text-slate-500" title={item.decisionNote}>
                                {item.decisionNote}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                            {item.decidedAt ? (
                              <>
                                <div>{formatDateTime(item.decidedAt)}</div>
                                {item.decidedByName && <div className="text-xs text-slate-500">{item.decidedByName}</div>}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          {inProgress && canManage && (
                            <td
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 bg-white py-3 px-4 text-center z-10 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                            >
                              <button
                                ref={getRef(item.id)}
                                onClick={(e) => toggle(item.id, e)}
                                className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 transition-colors"
                                aria-label="More actions"
                              >
                                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" />
                              </button>
                              <PortalDropdownMenu isOpen={openId === item.id} onClose={close} position={position}>
                                <div className="py-1">
                                  {DECISIONS.map((d) => (
                                    <DropdownMenuItem
                                      key={d.value}
                                      icon={
                                        d.value === "CONFIRMED" ? (
                                          <IconCheck className="h-4 w-4" />
                                        ) : d.value === "MODIFY_REQUESTED" ? (
                                          <IconPencilMinus className="h-4 w-4" />
                                        ) : (
                                          <IconCircleMinus className="h-4 w-4" />
                                        )
                                      }
                                      disabled={item.decision === d.value}
                                      onClick={() => {
                                        close();
                                        openDecision(item, d.value);
                                      }}
                                    >
                                      {d.label}
                                    </DropdownMenuItem>
                                  ))}
                                </div>
                              </PortalDropdownMenu>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {itemTotal > 0 && (
                  <TablePagination
                    currentPage={itemPage}
                    totalPages={itemTotalPages}
                    totalItems={itemTotal}
                    itemsPerPage={itemPageSize}
                    isLoading={loading}
                    onPageChange={setItemPage}
                    onItemsPerPageChange={(value) => {
                      setItemPageSize(value);
                      setItemPage(1);
                    }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="User Status"
          isExpanded={expandedFilterSections.has("userStatus")}
          onToggle={() => toggleFilterSection("userStatus")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {toOptions("userStatuses", "All Status").map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setUserStatusFilter(String(opt.value)); setItemPage(1); }}
                className={filterOptionClass(userStatusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {userStatusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem
          label="Decision"
          isExpanded={expandedFilterSections.has("decision")}
          onToggle={() => toggleFilterSection("decision")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {toOptions("decisions", "All Decisions").map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setDecisionFilter(String(opt.value)); setItemPage(1); }}
                className={filterOptionClass(decisionFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {decisionFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      <DecisionModal
        item={decisionTarget?.item ?? null}
        decision={decisionTarget?.decision ?? null}
        saving={decisionSaving}
        note={decisionNote}
        onNoteChange={setDecisionNote}
        onClose={() => setDecisionTarget(null)}
        onConfirm={() => void confirmDecision()}
      />

      <AlertModal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => void handleCancel()}
        type="warning"
        title="Cancel Access Review Campaign"
        description={`Are you sure you want to cancel "${campaign.name}"? This action cannot be undone.`}
        confirmText="Cancel Campaign"
        cancelText="Back"
        showCancel
      />

      {signatureModal}
    </div>
  );
};
