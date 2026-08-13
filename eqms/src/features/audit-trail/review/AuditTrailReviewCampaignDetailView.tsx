import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Check,
  Flag,
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

const DECISION_OPTIONS = [
  { label: "All Decisions", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Flagged", value: "FLAGGED" },
];
const statusBadge = (status: AuditTrailReviewCampaignSummary["status"]) =>
  status === "COMPLETED"
    ? "emerald"
    : status === "CANCELLED"
      ? "slate"
      : "blue";
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
    <th
      onClick={() => onSort(column)}
      className="sticky top-0 z-20 cursor-pointer whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 group md:text-xs"
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
    </th>
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
              ? "Confirm that this audit trail entry has been reviewed and is appropriate."
              : "Flag this audit trail entry for further investigation."}
          </p>
          <div>
            <label className={labelClass}>
              Note{" "}
              {decision === "CONFIRMED" && (
                <span className="text-xs font-normal text-slate-400">
                  (optional)
                </span>
              )}
            </label>
            <textarea
              className={textareaClass}
              rows={2}
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Reviewer note..."
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
  const searchQuery = useDebounce(search, 350);
  const [decision, setDecision] = useState("ALL");
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
    currentPage,
    decision,
    id,
    itemsPerPage,
    searchQuery,
    showToast,
    sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    (async () => {
      try {
        await loadCampaign();
      } catch {
        showToast({ type: "error", message: "Failed to load campaign" });
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [loadCampaign, showToast]);
  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const clearFilters = () => {
    setSearch("");
    setDecision("ALL");
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
        message: "Audit trail review completed and signed",
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
      showToast({ type: "success", message: "Campaign cancelled" });
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
          title="Audit Trail Review Campaign"
          breadcrumbItems={breadcrumb(navigate)}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          }
        />
        <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            Campaign not found
          </p>
          <Button variant="outline" size="sm" onClick={handleBack}>
            Back to Audit Trail Review
          </Button>
        </section>
      </div>
    );

  const inProgress = campaign.status === "IN_PROGRESS";
  return (
    <div className="flex w-full flex-1 flex-col space-y-6">
      <PageHeader
        title={campaign.name}
        breadcrumbItems={breadcrumb(navigate, campaign.name)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              Back
            </Button>
            {canManage && inProgress && (
              <>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  onClick={() => setCancelConfirmOpen(true)}
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
                >
                  {completing ? "Completing..." : "Complete & Sign"}
                </Button>
              </>
            )}
          </>
        }
      />
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">
            {campaign.name}
          </h2>
          <Badge color={statusBadge(campaign.status)} size="xs">
            {campaign.statusLabel}
          </Badge>
        </div>
        {campaign.description && (
          <p className="mt-1 text-sm text-slate-500">{campaign.description}</p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Review period</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {campaign.reviewPeriodStart
                ? formatDateUS(campaign.reviewPeriodStart)
                : "—"}{" "}
              –{" "}
              {campaign.reviewPeriodEnd
                ? formatDateUS(campaign.reviewPeriodEnd)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Entries</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {campaign.totalItems}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Pending</dt>
            <dd
              className={cn(
                "mt-0.5 font-medium",
                campaign.pendingItems > 0
                  ? "text-amber-600"
                  : "text-emerald-600",
              )}
            >
              {campaign.pendingItems}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Signed</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {campaign.signedAt ? formatDateTime(campaign.signedAt) : "—"}
            </dd>
          </div>
        </dl>
      </section>
      <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col px-4 pt-4 md:p-5">
          <div className="-mx-1.5 mb-[-0.375rem] px-1.5 pb-1.5">
            <div className="mb-4 flex w-full flex-col gap-1.5 md:hidden">
              <label className={labelClass}>Search audit entries</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search user, employee ID, module, action, entity..."
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
                      aria-label="Clear search"
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
                <label className={labelClass}>Search audit entries</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search user, employee ID, module, action, entity..."
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
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <Select
                label="Decision"
                value={decision}
                onChange={(value) => {
                  setDecision(String(value));
                  setCurrentPage(1);
                }}
                options={DECISION_OPTIONS}
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
              <table className="w-full min-w-[72rem] border-spacing-0 text-left">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <SortHeader
                      label="Timestamp"
                      column="timestamp"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <SortHeader
                      label="User"
                      column="userFullName"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <SortHeader
                      label="Module"
                      column="module"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <SortHeader
                      label="Action"
                      column="action"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                      Entity
                    </th>
                    <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                      E-Sig
                    </th>
                    <SortHeader
                      label="Decision"
                      column="decision"
                      current={sortBy}
                      direction={sortDirection}
                      onSort={changeSort}
                    />
                    {canManage && inProgress && (
                      <th className="sticky right-0 top-0 z-30 w-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs font-bold uppercase tracking-wider text-slate-500 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 md:text-xs">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {!itemsLoading && items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManage && inProgress ? 8 : 7}
                        className="py-12"
                      >
                        <TableEmptyState
                          title="No audit log entries found"
                          description="Try changing the search or decision filter."
                        />
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          {item.timestamp
                            ? formatDateTime(item.timestamp)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                          <div>{item.userFullName || "—"}</div>
                          {item.employeeCode && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              {item.employeeCode}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          {item.module || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          {item.action || "—"}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-xs text-slate-600 sm:text-sm">
                          <div
                            className="truncate"
                            title={item.entityLabel ?? undefined}
                          >
                            {item.entityLabel || "—"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
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
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge color={decisionBadge(item.decision)} size="sm">
                            {item.decisionLabel}
                          </Badge>
                        </td>
                        {canManage && inProgress && (
                          <td className="sticky right-0 z-30 whitespace-nowrap bg-white px-4 py-3 text-center shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 group-hover:bg-slate-50">
                            <button
                              ref={getActionRef(item.id)}
                              onClick={(event) =>
                                toggleActionMenu(item.id, event)
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
                              aria-label={`Actions for ${item.action || "audit entry"}`}
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
                                  Confirm
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  icon={<Flag className="h-4 w-4" />}
                                  onClick={() => {
                                    closeActionMenu();
                                    openDecision(item, "FLAGGED");
                                  }}
                                >
                                  Flag for investigation
                                </DropdownMenuItem>
                              </div>
                            </PortalDropdownMenu>
                          </td>
                        )}
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
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Decision"
          isExpanded
          onToggle={() => undefined}
        >
          <div className="grid gap-2 pb-4 pt-1">
            {DECISION_OPTIONS.map((option) => (
              <FilterOptionButton
                key={option.value}
                label={option.label}
                isSelected={decision === option.value}
                onClick={() => {
                  setDecision(option.value);
                  setCurrentPage(1);
                }}
              />
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
        title="Cancel Audit Trail Review Campaign"
        description={`Are you sure you want to cancel "${campaign.name}"? This action cannot be undone.`}
        confirmText="Cancel Campaign"
        cancelText="Back"
        showCancel
      />
      {signatureModal}
    </div>
  );
};
