import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ShieldCheck,
  X,
  Check,
  ChevronUp,
  ChevronDown,
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  IconFilter2,
  IconInfoCircle,
  IconPencilMinus,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { AlertModal } from "@/components/ui/modal";
import { DropdownMenuItem } from "@/components/ui/dropdown/DropdownMenuItem";
import { PortalDropdownMenu } from "@/components/ui/dropdown/PortalDropdownMenu";
import { useToast } from "@/components/ui/toast/Toast";
import { useTranslation } from "@/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { useTableDragScroll, usePortalDropdown, useDebounce } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { PolicyStatusBadge } from "@/components/ui/notification-content";
import {
  notificationPolicyApi,
  type NotificationPolicySummary,
} from "@/services/api/notificationPolicy";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/utils/format";
import { notificationPolicy as notificationPolicyBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";

const ALL_OPTION: SelectOption = { label: "All", value: "All" };

const MODULE_OPTIONS: SelectOption[] = [
  ALL_OPTION,
  { label: "Document Control", value: "DOCUMENT_CONTROL" },
  { label: "Controlled Copies", value: "CONTROLLED_COPIES" },
  { label: "Audit Trail", value: "AUDIT_TRAIL" },
  { label: "Security", value: "SECURITY" },
  { label: "System", value: "SYSTEM" },
];

const COMPLIANCE_OPTIONS: SelectOption[] = [
  ALL_OPTION,
  { label: "GMP Mandatory", value: "GMP_MANDATORY" },
  { label: "Compliance", value: "COMPLIANCE" },
  { label: "Optional", value: "OPTIONAL" },
];

const STATUS_OPTIONS: SelectOption[] = [
  ALL_OPTION,
  { label: "Active", value: "ACTIVE" },
  { label: "Draft", value: "DRAFT" },
  { label: "Disabled", value: "DISABLED" },
];

const PRIORITY_COLOR: Record<string, BadgeColor> = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
  CRITICAL: "red",
};

const COMPLIANCE_COLOR: Record<string, BadgeColor> = {
  GMP_MANDATORY: "amber",
  COMPLIANCE: "purple",
  OPTIONAL: "slate",
};

const COMPLIANCE_LABEL: Record<string, string> = {
  GMP_MANDATORY: "GMP Mandatory",
  COMPLIANCE: "Compliance",
  OPTIONAL: "Optional",
};

const moduleLabel = (module: string) =>
  MODULE_OPTIONS.find((o) => o.value === module)?.label ?? module;

type SortKey = "name" | "module" | "priority" | "updatedAt";

const getOptionClassName = (isActive: boolean) =>
  cn(
    "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
    isActive
      ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
      : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-200",
  );

export const NotificationPolicyView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.notification_policy.manage");
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [deleteTarget, setDeleteTarget] =
    useState<NotificationPolicySummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [policies, setPolicies] = useState<NotificationPolicySummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [moduleFilter, setModuleFilter] = useState("All");
  const [complianceFilter, setComplianceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("module");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["module"]),
  );
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(
    () => setCurrentPage(1),
    [debouncedSearch, moduleFilter, complianceFilter, statusFilter],
  );

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    notificationPolicyApi
      .list({
        search: debouncedSearch || undefined,
        module: moduleFilter !== "All" ? moduleFilter : undefined,
        complianceGroup:
          complianceFilter !== "All" ? complianceFilter : undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        sortBy: sortKey,
        sortDirection: sortDir,
        page: currentPage,
        limit: itemsPerPage,
      })
      .then((data) => {
        if (!active) return;
        setPolicies(data.data);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      })
      .catch(() => {
        if (active)
          showToast({
            type: "error",
            title: t("notificationPolicy.loadFailedTitle"),
            message: t("notificationPolicy.loadFailedMessage"),
          });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    moduleFilter,
    complianceFilter,
    statusFilter,
    sortKey,
    sortDir,
    currentPage,
    itemsPerPage,
    refreshToken,
  ]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await notificationPolicyApi.remove(deleteTarget.eventCode);
      showToast({
        type: "success",
        title: t("notificationPolicy.deletedTitle"),
        message: t("notificationPolicy.deletedMessage", { name: deleteTarget.name }),
      });
      setDeleteTarget(null);
      setRefreshToken((t) => t + 1);
    } catch (error: any) {
      showToast({
        type: "error",
        title: t("notificationPolicy.deleteFailedTitle"),
        message:
          error?.response?.data?.message ||
          error?.response?.data?.error?.message ||
          t("notificationPolicy.deleteFailedMessage"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasFilters =
    !!search ||
    moduleFilter !== "All" ||
    complianceFilter !== "All" ||
    statusFilter !== "All";
  const clearFilters = () => {
    setSearch("");
    setModuleFilter("All");
    setComplianceFilter("All");
    setStatusFilter("All");
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sortableTh = (key: SortKey, label: string, extraClass?: string) => (
    <th
      key={key}
      onClick={() => handleSort(key)}
      className={cn(
        "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group",
        extraClass,
      )}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
          <ChevronUp
            className={cn(
              "h-3 w-3 -mb-1",
              sortKey === key && sortDir === "asc" ? "text-emerald-600" : "",
            )}
          />
          <ChevronDown
            className={cn(
              "h-3 w-3",
              sortKey === key && sortDir === "desc" ? "text-emerald-600" : "",
            )}
          />
        </div>
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      <PageHeader
        title="Notification In-app"
        breadcrumbItems={notificationPolicyBreadcrumb(navigate)}
        actions={
          canManage && (
            <Button
              size="sm"
              onClick={() =>
                navigate(`${ROUTES.SETTINGS.NOTIFICATION_POLICY}/new`)
              }
              className="gap-2 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          )
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {/* Mobile: search + filter drawer */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events…"
                className="w-full pl-9 pr-8 h-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="whitespace-nowrap gap-2"
            >
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Desktop filters */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
            <div className="w-full">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, code, description…"
                  className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="w-full">
              <Select
                label="Module"
                value={moduleFilter}
                onChange={(v) => setModuleFilter(String(v))}
                options={MODULE_OPTIONS}
              />
            </div>
            <div className="w-full">
              <Select
                label="Compliance"
                value={complianceFilter}
                onChange={(v) => setComplianceFilter(String(v))}
                options={COMPLIANCE_OPTIONS}
              />
            </div>
            <div className="w-full">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(String(v))}
                options={STATUS_OPTIONS}
              />
            </div>
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
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center rounded-xl">
                <SectionLoading minHeight="150px" />
              </div>
            )}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn(
                  "overflow-x-auto",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                )}
                {...dragEvents}
              >
                <table className="w-full min-w-[900px]">
                  <thead className="sticky top-0 z-30">
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-12">
                        No.
                      </th>
                      {sortableTh("name", "Event")}
                      {sortableTh("module", "Module")}
                      {sortableTh("priority", "Priority")}
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Compliance
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Status
                      </th>
                      {sortableTh(
                        "updatedAt",
                        "Updated",
                        "hidden lg:table-cell",
                      )}
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {!isLoading && policies.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <TableEmptyState
                            icon={
                              <ShieldCheck className="h-10 w-10 text-slate-300" />
                            }
                            title="No events found"
                            description={
                              hasFilters
                                ? "Try adjusting your search or filters."
                                : "No notification events are configured yet."
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      policies.map((policy, idx) => (
                        <tr
                          key={policy.eventCode}
                          onClick={() =>
                            navigate(
                              `${ROUTES.SETTINGS.NOTIFICATION_POLICY}/${policy.eventCode}`,
                            )
                          }
                          className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-500 text-center">
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm max-w-[320px]">
                            <div className="font-medium text-slate-800">
                              {policy.name}
                            </div>
                            {policy.description && (
                              <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                {policy.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {moduleLabel(policy.module)}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge
                              color={PRIORITY_COLOR[policy.priority] ?? "slate"}
                              size="sm"
                            >
                              {policy.priority}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge
                              color={
                                COMPLIANCE_COLOR[policy.complianceGroup] ??
                                "slate"
                              }
                              size="sm"
                            >
                              {COMPLIANCE_LABEL[policy.complianceGroup] ??
                                policy.complianceGroup}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <PolicyStatusBadge
                              status={policy.policyStatus}
                              mandatory={policy.mandatory}
                              size="sm"
                            />
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-500 hidden lg:table-cell">
                            {formatDateTime(policy.updatedAt) || "—"}
                          </td>
                          <td
                            onClick={(e) => e.stopPropagation()}
                            className="sticky right-0 bg-white py-3 px-4 text-xs sm:text-sm text-center z-30 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                          >
                            <button
                              ref={getRef(policy.eventCode)}
                              type="button"
                              onClick={(e) => toggle(policy.eventCode, e)}
                              className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                            </button>
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
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    isLoading={isLoading}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(v) => {
                      setItemsPerPage(v);
                      setCurrentPage(1);
                    }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </div>
              )}
            </div>
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
          label="Module"
          isExpanded={expandedSections.has("module")}
          onToggle={() => toggleSection("module")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {MODULE_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setModuleFilter(String(opt.value))}
                className={getOptionClassName(moduleFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {moduleFilter === opt.value && (
                  <Check className="h-4 w-4 text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem
          label="Compliance"
          isExpanded={expandedSections.has("compliance")}
          onToggle={() => toggleSection("compliance")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {COMPLIANCE_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setComplianceFilter(String(opt.value))}
                className={getOptionClassName(complianceFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {complianceFilter === opt.value && (
                  <Check className="h-4 w-4 text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setStatusFilter(String(opt.value))}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && (
                  <Check className="h-4 w-4 text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      <PortalDropdownMenu
        isOpen={!!openId}
        onClose={close}
        position={position}
        minWidth={160}
      >
        {(() => {
          const policy = policies.find((p) => p.eventCode === openId);
          if (!policy) return null;
          return (
            <div className="py-1">
              <DropdownMenuItem
                icon={<IconInfoCircle className="h-4 w-4" />}
                onClick={() => {
                  close();
                  navigate(
                    `${ROUTES.SETTINGS.NOTIFICATION_POLICY}/${policy.eventCode}`,
                  );
                }}
              >
                View Detail
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuItem
                  icon={<IconPencilMinus className="h-4 w-4" />}
                  onClick={() => {
                    close();
                    navigate(
                      `${ROUTES.SETTINGS.NOTIFICATION_POLICY}/${policy.eventCode}/edit`,
                    );
                  }}
                >
                  Edit Notification
                </DropdownMenuItem>
              )}
              {canManage && !policy.mandatory && (
                <DropdownMenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    close();
                    setDeleteTarget(policy);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </div>
          );
        })()}
      </PortalDropdownMenu>

      <AlertModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        type="error"
        title="Delete Notification Event"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will permanently remove its policy and content configuration.`}
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </div>
  );
};
