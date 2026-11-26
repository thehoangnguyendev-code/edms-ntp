import { trFormat as __ariaTrFormat } from "@/i18n";
import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Check,
  CalendarRange,
  Flag,
  ListChecks,
  PenLine,
  UserCheck,
  MoreVertical,
  Search,
  X,
} from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import {
  FullPageLoading,
  SectionLoading,
} from "@/components/ui/loading/Loading";
import {
  FilterAccordionItem,
  FilterDrawer,
} from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { useDebounce, usePortalDropdown, useTableDragScroll } from "@/hooks";
import { DropdownMenuItem, PortalDropdownMenu } from "@/components/ui/dropdown";
import {
  auditTrailApi,
  type AuditTrailReviewCampaignSummary,
  type AuditTrailReviewItem,
} from "@/services/api/auditTrail";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { formatDateTime, formatDateUS } from "@/utils/format";
import { auditTrailReviewCampaignDetail as breadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { formatAuditActionLabel, formatAuditModuleLabel } from "../utils/actionBadge";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr, trFormat } from "@/i18n";
import { statusColor } from "@/components/ui/badge/statusColors";

const DECISION_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Flagged", value: "FLAGGED" },
];
const SIGNED_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Yes", value: "YES" },
  { label: "No", value: "NO" },
];
const ALL_OPTION = { label: "All", value: "ALL" };
/** The date pickers hold dd/MM/yyyy; the server takes yyyy-MM-dd. */
const toServerDate = (value: string) =>
  /^\d{2}\/\d{2}\/\d{4}/.test(value)
    ? `${value.slice(6, 10)}-${value.slice(3, 5)}-${value.slice(0, 2)}`
    : undefined;
const statusBadge = (status: AuditTrailReviewCampaignSummary["status"]) =>
  statusColor(status);
const decisionBadge = (decision: AuditTrailReviewItem["decision"]) =>
  decision === "CONFIRMED"
    ? "emerald"
    : decision === "FLAGGED"
      ? "red"
      : "slate";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";
const textareaClass =
  "w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
type SortKey = "timestamp" | "userFullName" | "module" | "action" | "decision";

const SortHeader: React.FC<{
  label: string;
  column: SortKey;
  current: SortKey;
  direction: "asc" | "desc";
  onSort: (column: SortKey) => void;
}> = ({ label, column, current, direction, onSort }) => {
  return (
    <TableMarkup.HeaderCell
      onClick={() => onSort(column)}
      className={TABLE_STYLES.headerCell39}
    >
      <div className="flex w-full items-center justify-between gap-2">
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
    </TableMarkup.HeaderCell>
  );
};

const DecisionModal: React.FC<{
  item: AuditTrailReviewItem | null;
  decision: AuditTrailReviewItem["decision"] | null;
  saving: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ item, decision, saving, note, onNoteChange, onClose, onConfirm }) => {
  if (!item || !decision) return null;
  const label = decision === "FLAGGED" ? "Flag" : "Confirm";
  return (
    <AlertModal
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      type={decision === "FLAGGED" ? "warning" : "confirm"}
      title={`${label} Audit Entry`}
      description={
        <div className="space-y-3">
          <p>
            {decision === "CONFIRMED"
              ? tr("Confirm that this audit trail entry has been reviewed and is appropriate.")
              : tr("Flag this audit trail entry for further investigation.")}
          </p>
          <div>
            <label className={labelClass}>
              {tr("Note")}{" "}
              {decision === "CONFIRMED" && (
                <span className="text-xs font-normal text-slate-400">
                  {tr("(optional)")}
                </span>
              )}
            </label>
            <textarea
              className={textareaClass}
              rows={2}
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={tr("Reviewer note...")}
            />
          </div>
        </div>
      }
      confirmText={saving ? "Saving..." : label}
      cancelText="Cancel"
      showCancel
      isLoading={saving}
    />
  );
};

export const AuditTrailReviewCampaignDetailView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("audit.review.manage");
  const { requestSignature, signatureModal } = useSecurityESign();
  const [campaign, setCampaign] =
    useState<AuditTrailReviewCampaignSummary | null>(null);
  const [items, setItems] = useState<AuditTrailReviewItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const searchQuery = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [decision, setDecision] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [signedFilter, setSignedFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set(["Decision"]));
  const toggleFilterSection = (label: string) => setExpandedFilters((previous) => {
    const next = new Set(previous);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
  const [filterOptions, setFilterOptions] = useState<{ modules: string[]; actions: string[] }>({ modules: [], actions: [] });
  const [sortBy, setSortBy] = useState<SortKey>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const {
    openId: openActionId,
    position: actionPosition,
    getRef: getActionRef,
    toggle: toggleActionMenu,
    close: closeActionMenu,
  } = usePortalDropdown();
  const [decisionTarget, setDecisionTarget] = useState<{
    item: AuditTrailReviewItem;
    decision: AuditTrailReviewItem["decision"];
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const handleBack = () =>
    navigateBack(navigate, location.state, ROUTES.AUDIT_TRAIL_REVIEW);

  const loadCampaign = useCallback(async () => {
    if (!id) return;
    const response = await auditTrailApi.getReviewCampaignSummary(id);
    setCampaign(response);
  }, [id]);
  const loadItems = useCallback(async () => {
    if (!id) return;
    setItemsLoading(true);
    try {
      const response = await auditTrailApi.listReviewCampaignItemsPaged(id, {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        decision: decision === "ALL" ? undefined : decision,
        module: moduleFilter === "ALL" ? undefined : moduleFilter,
        action: actionFilter === "ALL" ? undefined : actionFilter,
        signed: signedFilter === "ALL" ? undefined : signedFilter,
        from: toServerDate(dateFrom),
        to: toServerDate(dateTo),
        sortBy,
        sortDirection,
      });
      setItems(response.data ?? []);
      setTotalItems(response.pagination.total);
      setTotalPages(Math.max(1, response.pagination.totalPages));
    } catch (error: any) {
      setItems([]);
      setTotalItems(0);
      setTotalPages(1);
      showToast({
        type: "error",
        message:
          error?.response?.data?.message ?? "Failed to load review items",
      });
    } finally {
      setItemsLoading(false);
    }
  }, [
    actionFilter,
    currentPage,
    dateFrom,
    dateTo,
    decision,
    id,
    itemsPerPage,
    moduleFilter,
    searchQuery,
    showToast,
    signedFilter,
    sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    (async () => {
      try {
        await loadCampaign();
      } catch {
        showToast({ type: "error", message: tr("Failed to load campaign") });
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [loadCampaign, showToast]);
  useEffect(() => {
    void loadItems();
  }, [loadItems]);
  useEffect(() => {
    if (!id) return;
    auditTrailApi.getReviewItemFilterOptions(id).then(setFilterOptions).catch(() => undefined);
  }, [id]);

  const moduleOptions = [ALL_OPTION, ...filterOptions.modules.map((value) => ({ label: formatAuditModuleLabel(value), value }))];
  const actionOptions = [ALL_OPTION, ...filterOptions.actions.map((value) => ({ label: formatAuditActionLabel(value), value }))];

  const clearFilters = () => {
    setSearch("");
    setDecision("ALL");
    setModuleFilter("ALL");
    setActionFilter("ALL");
    setSignedFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortBy("timestamp");
    setSortDirection("asc");
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
  const openDecision = (
    item: AuditTrailReviewItem,
    nextDecision: AuditTrailReviewItem["decision"],
  ) => {
    setDecisionNote("");
    setDecisionTarget({ item, decision: nextDecision });
  };
  const confirmDecision = async () => {
    if (!decisionTarget || !campaign) return;
    setDecisionSaving(true);
    try {
      await auditTrailApi.decideReviewItem(
        campaign.id,
        decisionTarget.item.id,
        {
          decision: decisionTarget.decision,
          note: decisionNote.trim() || undefined,
        },
      );
      setDecisionTarget(null);
      await Promise.all([loadCampaign(), loadItems()]);
    } catch (error: any) {
      showToast({
        type: "error",
        message: error?.response?.data?.message ?? "Failed to record decision",
      });
    } finally {
      setDecisionSaving(false);
    }
  };
  const handleComplete = async () => {
    if (!campaign) return;
    const signature = await requestSignature(
      `Complete Audit Trail Review "${campaign.name}"`,
      "Audit Trail Review",
    );
    if (!signature) return;
    setCompleting(true);
    try {
      await auditTrailApi.completeReviewCampaign(campaign.id, {
        signatureToken: signature.signatureToken,
        reason: signature.reason,
      });
      showToast({
        type: "success",
        message: tr("Audit trail review completed and signed"),
      });
      await loadCampaign();
    } catch (error: any) {
      showToast({
        type: "error",
        message: error?.response?.data?.message ?? "Failed to complete review",
      });
    } finally {
      setCompleting(false);
    }
  };
  const handleCancel = async () => {
    if (!campaign) return;
    try {
      await auditTrailApi.cancelReviewCampaign(campaign.id);
      showToast({ type: "success", message: tr("Campaign cancelled") });
      setCancelConfirmOpen(false);
      await loadCampaign();
    } catch (error: any) {
      showToast({
        type: "error",
        message: error?.response?.data?.message ?? "Failed to cancel campaign",
      });
    }
  };

  if (initialLoading)
    return <FullPageLoading text="Loading audit trail review campaign..." />;
  if (!campaign)
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title={tr("Periodic Review Details")}
          breadcrumbItems={breadcrumb(navigate)}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {tr("Back")}
            </Button>
          }
        />
        <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            {tr("Campaign not found")}
          </p>
          <Button variant="outline" size="sm" onClick={handleBack}>
            {tr("Back to Periodic Review")}
          </Button>
        </section>
      </div>
    );

  const inProgress = campaign.status === "IN_PROGRESS";
  return (
    <div className="flex w-full flex-1 flex-col space-y-6">
      <PageHeader
        title={tr("Periodic Review Details")}
        breadcrumbItems={breadcrumb(navigate)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              {tr("Back")}
            </Button>
            {canManage && inProgress && (
              <>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  onClick={() => setCancelConfirmOpen(true)}
                >
                  {tr("Cancel Campaign")}
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
                >
                  {completing ? "Completing..." : tr("Complete & Sign")}
                </Button>
              </>
            )}
          </>
        }
      />
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 py-4 md:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {campaign.campaignNumber && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700" title={tr("Audit Trail Campaign Number")}>
                  {campaign.campaignNumber}
                </span>
              )}
              <Badge color={statusBadge(campaign.status)} size="xs">
                {campaign.statusLabel}
              </Badge>
            </div>
            <h2 className="mt-2 break-words text-lg font-semibold text-slate-800">
              {campaign.name}
            </h2>
            {campaign.description && (
              <p className="mt-1 break-words text-sm text-slate-500">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <UserCheck className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="text-xs text-slate-500">{tr("Reviewer")}</p>
              <p className="font-medium text-slate-700">{campaign.reviewerName || "—"}</p>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-1 border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <CalendarRange className="h-5 w-5" />,
              label: tr("Review period"),
              value: `${campaign.reviewPeriodStart ? formatDateUS(campaign.reviewPeriodStart) : "—"} – ${campaign.reviewPeriodEnd ? formatDateUS(campaign.reviewPeriodEnd) : "—"}`,
              tone: "text-slate-800",
            },
            {
              icon: <ListChecks className="h-5 w-5" />,
              label: "Entries",
              value: String(campaign.totalItems),
              tone: "text-slate-800",
            },
            {
              icon: <Flag className="h-5 w-5" />,
              label: "Pending",
              value: String(campaign.pendingItems),
              tone: campaign.pendingItems > 0 ? "text-amber-600" : "text-emerald-600",
            },
            {
              icon: <PenLine className="h-5 w-5" />,
              label: "Signed",
              value: campaign.signedAt ? formatDateTime(campaign.signedAt) : "—",
              tone: "text-slate-800",
            },
          ].map((tile) => (
            <div
              key={tile.label}
              className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0 lg:[&:nth-child(odd)]:border-r md:px-5"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                {tile.icon}
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">{tile.label}</dt>
                <dd className={cn("mt-0.5 truncate text-sm font-semibold", tile.tone)}>{tile.value}</dd>
              </div>
            </div>
          ))}
        </dl>
        {campaign.totalItems > 0 && (
          <div className="border-t border-slate-200 px-4 py-3 md:px-5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>{tr("Review progress")}</span>
              <span>
                    {trFormat("{decided} of {total} entries decided", { decided: campaign.totalItems - campaign.pendingItems, total: campaign.totalItems })}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={campaign.totalItems}
              aria-valuenow={campaign.totalItems - campaign.pendingItems}
              aria-label={tr("Entries decided")}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${((campaign.totalItems - campaign.pendingItems) / campaign.totalItems) * 100}%` }}
              />
            </div>
          </div>
        )}
      </section>
      <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col px-4 pt-4 md:p-5">
          <div className="-mx-1.5 mb-[-0.375rem] px-1.5 pb-1.5">
            <div className="mb-4 flex w-full flex-col gap-1.5 md:hidden">
              <label className={labelClass}>{tr("Search")}</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder={tr("Search user, employee ID, module, action, entity...")}
                    className="block h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setCurrentPage(1);
                      }}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                      aria-label={tr("Clear search")}
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
                  {tr("Filters")}
                </Button>
              </div>
            </div>
            <ConfiguredDesktopFilters
              search={
                <input
                  aria-label={tr("Search")}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={tr("Search user, employee ID, module, action, entity...")}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                />
              }
              filters={[
                { id: "decision", label: "Decision", value: decision, options: DECISION_OPTIONS, onChange: (value) => { setDecision(value); setCurrentPage(1); } },
                { id: "module", label: "Module", value: moduleFilter, options: moduleOptions, onChange: (value) => { setModuleFilter(value); setCurrentPage(1); } },
                { id: "action", label: "Action", value: actionFilter, options: actionOptions, onChange: (value) => { setActionFilter(value); setCurrentPage(1); } },
                { id: "signed", label: tr("E-Signature"), value: signedFilter, options: SIGNED_OPTIONS, onChange: (value) => { setSignedFilter(value as "ALL" | "YES" | "NO"); setCurrentPage(1); } },
              ]}
              dates={[
                {
                  id: "date",
                  label: "Timestamp",
                  from: dateFrom,
                  to: dateTo,
                  onFromChange: (value) => { setDateFrom(value); setCurrentPage(1); },
                  onToChange: (value) => { setDateTo(value); setCurrentPage(1); },
                },
              ]}
            >
              <div className="hidden grid-cols-1 items-end gap-4 md:grid md:grid-cols-3">
                <div className="w-full">
                  <label className={labelClass}>{tr("Search")}</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder={tr("Search user, employee ID, module, action, entity...")}
                      className="block h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setCurrentPage(1);
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                        aria-label={tr("Clear search")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <Select
                  label={tr("Decision")}
                  value={decision}
                  onChange={(value) => {
                    setDecision(String(value));
                    setCurrentPage(1);
                  }}
                  options={DECISION_OPTIONS}
                />
                <Select
                  label={tr("Module")}
                  value={moduleFilter}
                  onChange={(value) => {
                    setModuleFilter(String(value));
                    setCurrentPage(1);
                  }}
                  options={moduleOptions}
                />
                <Select
                  label={tr("Action")}
                  value={actionFilter}
                  onChange={(value) => {
                    setActionFilter(String(value));
                    setCurrentPage(1);
                  }}
                  options={actionOptions}
                />
                <Select
                  label={tr("E-Signature")}
                  value={signedFilter}
                  onChange={(value) => {
                    setSignedFilter(String(value) as "ALL" | "YES" | "NO");
                    setCurrentPage(1);
                  }}
                  options={SIGNED_OPTIONS}
                />
                <DateRangePicker
                  label={tr("Timestamp")}
                  startDate={dateFrom}
                  endDate={dateTo}
                  onStartDateChange={(value) => {
                    setDateFrom(value);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(value) => {
                    setDateTo(value);
                    setCurrentPage(1);
                  }}
                  placeholder={tr("Select date range")}
                />
                <div className="flex items-end">
                  <ClearFiltersButton onClearSearch={() => setSearch("")} onClear={clearFilters} />
                </div>
              </div>
            </ConfiguredDesktopFilters>
          </div>
        </div>
        <div className="relative flex flex-1 flex-col px-4 pb-4 md:px-5 md:pb-5">
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300">
            {itemsLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                <SectionLoading
                  text="Loading review items..."
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
              <TableMarkup.Root className="w-full min-w-[72rem] border-spacing-0 text-left">
                <TableMarkup.Head className="sticky top-0 z-30">
                  <TableMarkup.Row>
                    <SortHeader
                      label={tr("Timestamp")}
                      column="timestamp"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <SortHeader
                      label={tr("User")}
                      column="userFullName"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <SortHeader
                      label={tr("Module")}
                      column="module"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <SortHeader
                      label={tr("Action")}
                      column="action"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell42}>
                      {tr("Entity")}
                    </TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell42}>
                      {tr("E-Sig")}
                    </TableMarkup.HeaderCell>
                    <SortHeader
                      label={tr("Decision")}
                      column="decision"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    {canManage && inProgress && (
                      <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell21}>
                        {tr("Action")}
                      </TableMarkup.HeaderCell>
                    )}
                  </TableMarkup.Row>
                </TableMarkup.Head>
                <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                  {!itemsLoading && items.length === 0 ? (
                    <TableMarkup.Row>
                      <TableMarkup.Cell
                        colSpan={canManage && inProgress ? 8 : 7}
                        className="py-12"
                      >
                        <TableEmptyState
                          title={tr("No audit log entries found")}
                          description={tr("Try changing the search or the filters.")}
                        />
                      </TableMarkup.Cell>
                    </TableMarkup.Row>
                  ) : (
                    items.map((item) => (
                      <TableMarkup.Row
                        key={item.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <TableMarkup.Cell className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          {item.timestamp
                            ? formatDateTime(item.timestamp)
                            : "—"}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                          <div>{item.userFullName || "—"}</div>
                          {item.employeeCode && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              {item.employeeCode}
                            </div>
                          )}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          {item.module ? formatAuditModuleLabel(item.module) : "—"}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          {item.action ? formatAuditActionLabel(item.action) : "—"}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="max-w-xs px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          <div
                            className="truncate"
                            title={item.entityLabel ?? undefined}
                          >
                            {item.entityLabel || "—"}
                          </div>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="whitespace-nowrap px-4 py-3">
                          <Badge
                            color={
                              item.electronicSignatureApplied
                                ? "emerald"
                                : "slate"
                            }
                            size="sm"
                          >
                            {item.electronicSignatureApplied ? "Yes" : "No"}
                          </Badge>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="whitespace-nowrap px-4 py-3">
                          <Badge color={decisionBadge(item.decision)} size="sm">
                            {item.decisionLabel}
                          </Badge>
                        </TableMarkup.Cell>
                        {canManage && inProgress && (
                          <TableMarkup.Cell className={TABLE_STYLES.cell35}>
                            <button
                              ref={getActionRef(item.id)}
                              onClick={(event) =>
                                toggleActionMenu(item.id, event)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
                              aria-label={__ariaTrFormat("Actions for {v1}", { v1: item.action || tr("audit entry") })}
                            >
                              <MoreVertical className="h-4 w-4 text-slate-600" />
                            </button>
                            <PortalDropdownMenu
                              isOpen={openActionId === item.id}
                              onClose={closeActionMenu}
                              position={actionPosition}
                            >
                              <div className="py-1">
                                <DropdownMenuItem
                                  icon={<Check className="h-4 w-4" />}
                                  onClick={() => {
                                    closeActionMenu();
                                    openDecision(item, "CONFIRMED");
                                  }}
                                >
                                  {tr("Confirm")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  icon={<Flag className="h-4 w-4" />}
                                  onClick={() => {
                                    closeActionMenu();
                                    openDecision(item, "FLAGGED");
                                  }}
                                >
                                  {tr("Flag for investigation")}
                                </DropdownMenuItem>
                              </div>
                            </PortalDropdownMenu>
                          </TableMarkup.Cell>
                        )}
                      </TableMarkup.Row>
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
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setFilterDrawerOpen(false)}
      >
        {[
          { label: "Decision", options: DECISION_OPTIONS, current: decision, set: setDecision },
          { label: "Module", options: moduleOptions, current: moduleFilter, set: setModuleFilter },
          { label: "Action", options: actionOptions, current: actionFilter, set: setActionFilter },
          { label: tr("E-Signature"), options: SIGNED_OPTIONS, current: signedFilter, set: (value: string) => setSignedFilter(value as "ALL" | "YES" | "NO") },
        ].map((group) => (
          <FilterAccordionItem
            key={group.label}
            label={group.label}
            isExpanded={expandedFilters.has(group.label)}
            onToggle={() => toggleFilterSection(group.label)}
          >
            <div className="grid max-h-60 gap-2 overflow-y-auto pb-4 pr-1 pt-1">
              {group.options.map((option) => (
                <FilterOptionButton
                  key={option.value}
                  label={option.label}
                  isSelected={group.current === option.value}
                  onClick={() => {
                    group.set(option.value);
                    setCurrentPage(1);
                  }}
                />
              ))}
            </div>
          </FilterAccordionItem>
        ))}
        <FilterAccordionItem label={tr("Timestamp")} isExpanded={expandedFilters.has("Timestamp")} onToggle={() => toggleFilterSection("Timestamp")}>
          <div className="pb-4 pt-2">
            <DateRangePicker
              label=""
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(value) => {
                setDateFrom(value);
                setCurrentPage(1);
              }}
              onEndDateChange={(value) => {
                setDateTo(value);
                setCurrentPage(1);
              }}
              placeholder={tr("Select date range")}
            />
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
        title={tr("Cancel Audit Trail Review Campaign")}
        description={`Are you sure you want to cancel "${campaign.name}"? This action cannot be undone.`}
        confirmText={tr("Cancel Campaign")}
        cancelText="Back"
        showCancel
      />
      {signatureModal}
    </div>
  );
};
