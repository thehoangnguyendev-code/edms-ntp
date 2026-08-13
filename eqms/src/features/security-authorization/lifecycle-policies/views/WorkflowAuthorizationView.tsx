import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronUp, Copy, GitBranch, MoreVertical, Plus, RefreshCw,
  Search, Shield, X,
} from "lucide-react";
import {
  IconFilter2, IconInfoCircle, IconPencilMinus,
  IconToggleLeft, IconToggleRight,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown, useTableDragScroll } from "@/hooks";
import type { PortalDropdownPosition } from "@/hooks/usePortalDropdown";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useToast } from "@/components/ui/toast/Toast";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { cn } from "@/components/ui/utils";
import { workflowAuthorization as workflowAuthorizationBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks";
import { formatDateTime } from "@/utils/format";
import { ROUTES } from "@/app/routes.constants";
import { workflowActionPolicyApi } from "@/services/api/workflowActionPolicy";
import { WorkflowPolicyEffectiveLookup } from "../components/WorkflowPolicyEffectiveLookup";
import { extractApiError } from "../workflowPolicyUtils";
import type {
  WorkflowActionPolicy,
  WorkflowActionPolicyOptions,
} from "../types";

const VIEW_PERM = "security.workflow_authorization.view";
const MANAGE_PERM = "security.workflow_authorization.manage";

type SortKey = "workflowKey" | "actionCode" | "fromStatus" | "documentTypeName" | "requiredPermissionCode" | "priority" | "active" | "system" | "createdAt" | "updatedAt";

// ── Main view ──────────────────────────────────────────────────────────────
export interface WorkflowAuthorizationViewHandle {
  openEffectiveLookup: () => void;
  refresh: () => void;
}

export const WorkflowAuthorizationView = React.forwardRef<WorkflowAuthorizationViewHandle, { embedded?: boolean }>(
  ({ embedded = false }, ref) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canView = hasPermissionAlias(VIEW_PERM);
  const canManage = hasPermissionAlias(MANAGE_PERM);

  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();

  const [policies, setPolicies] = useState<WorkflowActionPolicy[]>([]);
  const [facetPolicies, setFacetPolicies] = useState<WorkflowActionPolicy[]>([]);
  const [options, setOptions] = useState<WorkflowActionPolicyOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [workflowFilter, setWorkflowFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [docTypeFilter, setDocTypeFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [systemFilter, setSystemFilter] = useState("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["active"]));
  const [sortKey, setSortKey] = useState<SortKey>("actionCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);


  // Alert modals
  const [activateTarget, setActivateTarget] = useState<WorkflowActionPolicy | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<WorkflowActionPolicy | null>(null);
  const [resetTarget, setResetTarget] = useState<WorkflowActionPolicy | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Effective lookup
  const [showEffectiveLookup, setShowEffectiveLookup] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!canView) return;
    try {
      const [optionsRes, facetsRes] = await Promise.allSettled([
        workflowActionPolicyApi.getOptions(),
        workflowActionPolicyApi.listPolicies(),
      ]);
      if (optionsRes.status === "fulfilled") {
        setOptions(optionsRes.value);
        setOptionsError(false);
      } else {
        setOptionsError(true);
      }
      if (facetsRes.status === "fulfilled") setFacetPolicies(facetsRes.value);
    } catch {
      setOptionsError(true);
    }
  }, [canView]);

  const loadData = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await workflowActionPolicyApi.listPoliciesPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        workflow: workflowFilter !== "ALL" ? workflowFilter : undefined,
        action: actionFilter !== "ALL" ? actionFilter : undefined,
        fromStatus: statusFilter !== "ALL" ? statusFilter : undefined,
        documentType: docTypeFilter !== "ALL" ? docTypeFilter : undefined,
        active: activeFilter !== "ALL" ? activeFilter : undefined,
        type: systemFilter !== "ALL" ? systemFilter : undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        sortBy: sortKey,
        sortDir,
      });
      setPolicies(res.data ?? []);
      setTotalItems(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      showToast({ type: "error", title: "Load Failed", message: "Failed to load policies." });
    } finally {
      setLoading(false);
    }
  }, [canView, currentPage, itemsPerPage, debouncedSearch, workflowFilter, actionFilter, statusFilter, docTypeFilter, activeFilter, systemFilter, createdFrom, createdTo, updatedFrom, updatedTo, sortKey, sortDir, showToast]);

  useEffect(() => { void loadOptions(); }, [loadOptions]);
  useEffect(() => { void loadData(); }, [loadData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const workflowFilterOptions: SelectOption[] = useMemo(() => [
    { label: "All Workflows", value: "ALL" },
    ...[...new Set(facetPolicies.map((p) => p.workflowKey))].sort().map((w) => ({
      label: facetPolicies.find((p) => p.workflowKey === w)?.workflowLabel ?? w,
      value: w,
    })),
  ], [facetPolicies]);

  const actionOptions: SelectOption[] = useMemo(() => [
    { label: "All Actions", value: "ALL" },
    ...[...new Set(facetPolicies.map((p) => p.actionCode))].sort().map((a) => ({
      label: facetPolicies.find((p) => p.actionCode === a)?.actionLabel ?? a,
      value: a,
    })),
  ], [facetPolicies]);

  const fromStatusOptions: SelectOption[] = useMemo(() => [
    { label: "All Statuses", value: "ALL" },
    ...[...new Set(facetPolicies.map((p) => p.fromStatus))].sort().map((s) => ({
      label: facetPolicies.find((p) => p.fromStatus === s)?.fromStatusLabel ?? s,
      value: s,
    })),
  ], [facetPolicies]);

  const docTypeOptions: SelectOption[] = useMemo(() => [
    { label: "All Doc Types", value: "ALL" },
    { label: "Global only", value: "GLOBAL" },
    ...(options?.documentTypes ?? []).map((d) => ({ label: d.name, value: d.id })),
  ], [options]);

  const paginated = policies;

  const hasFilters = !!search || workflowFilter !== "ALL" || actionFilter !== "ALL" || statusFilter !== "ALL" || docTypeFilter !== "ALL" || activeFilter !== "ALL" || systemFilter !== "ALL" || !!createdFrom || !!createdTo || !!updatedFrom || !!updatedTo;
  const clearFilters = () => {
    setSearch(""); setWorkflowFilter("ALL"); setActionFilter("ALL"); setStatusFilter("ALL");
    setDocTypeFilter("ALL"); setActiveFilter("ALL"); setSystemFilter("ALL");
    setCreatedFrom(""); setCreatedTo(""); setUpdatedFrom(""); setUpdatedTo("");
    setCurrentPage(1);
  };

  // Handlers
  const handleActivate = async () => {
    if (!activateTarget) return;
    const sig = await requestSignature("Activate Workflow Policy", "Workflow Authorization Change");
    if (!sig) return;
    setActionLoading(true);
    try {
      await workflowActionPolicyApi.activatePolicy(activateTarget.id, sig);
      showToast({ type: "success", title: "Activated", message: "Policy activated." });
      void loadData();
    } catch (err) {
      showToast({ type: "error", title: "Failed", message: extractApiError(err).message });
    } finally {
      setActionLoading(false);
      setActivateTarget(null);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    const sig = await requestSignature("Deactivate Workflow Policy", "Workflow Authorization Change");
    if (!sig) return;
    setActionLoading(true);
    try {
      await workflowActionPolicyApi.deactivatePolicy(deactivateTarget.id, sig);
      showToast({ type: "success", title: "Deactivated", message: "Policy deactivated." });
      void loadData();
    } catch (err) {
      showToast({ type: "error", title: "Failed", message: extractApiError(err).message });
    } finally {
      setActionLoading(false);
      setDeactivateTarget(null);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    const sig = await requestSignature("Reset Policy to System Default", "Workflow Authorization Change");
    if (!sig) return;
    setActionLoading(true);
    try {
      await workflowActionPolicyApi.resetToDefault(resetTarget.id, sig);
      showToast({ type: "success", title: "Reset", message: "Policy reset to system default." });
      void loadData();
    } catch (err) {
      showToast({ type: "error", title: "Failed", message: extractApiError(err).message });
    } finally {
      setActionLoading(false);
      setResetTarget(null);
    }
  };

  // ── Forbidden state ────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to view Workflow Authorization policies.</p>
      </div>
    );
  }

  const isInitialLoading = loading && policies.length === 0;
  const isTableLoading = loading && policies.length > 0;
  useImperativeHandle(
    ref,
    () => ({
      openEffectiveLookup: () => setShowEffectiveLookup(true),
      refresh: () => void loadData(),
    }),
    [loadData],
  );
  const pageActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(ROUTES.SECURITY.WORKFLOW_ROLE_CATALOG)}
        className="whitespace-nowrap gap-2"
      >
        <GitBranch className="h-4 w-4" />
        Workflow Roles
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowEffectiveLookup(true)}
        className="whitespace-nowrap gap-2"
      >
        <Shield className="h-4 w-4" />
        Effective Lookup
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void loadData()}
        className="whitespace-nowrap gap-2"
        disabled={loading}
      >
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </Button>
      {canManage && (
        <Button
          size="sm"
          onClick={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/new`)}
          className="whitespace-nowrap gap-2"
        >
          <Plus className="h-4 w-4" />
          New Policy
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {isInitialLoading && <FullPageLoading text="Loading workflow authorization policies..." />}

      {!embedded && (
        <PageHeader
          title="Transitions"
          breadcrumbItems={workflowAuthorizationBreadcrumb(navigate, "Transitions")}
          actions={pageActions}
        />
      )}

      {optionsError && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Unable to load workflow authorization options. Some dropdowns may be empty. Please refresh or contact system administrator.
        </div>
      )}

      <div className="w-full overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col">

          {/* Mobile filters */}
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search policies..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                <IconFilter2 className="h-4 w-4" />Filters
              </Button>
            </div>
          </div>

          {/* Desktop filters */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search policies..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="block w-full pl-10 pr-3 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400"
                />
              </div>
            </div>
            <Select label="Workflow" value={workflowFilter} onChange={(v) => { setWorkflowFilter(String(v)); setCurrentPage(1); }} options={workflowFilterOptions} />
            <Select label="Action" value={actionFilter} onChange={(v) => { setActionFilter(String(v)); setCurrentPage(1); }} options={actionOptions} />
            <Select label="From Status" value={statusFilter} onChange={(v) => { setStatusFilter(String(v)); setCurrentPage(1); }} options={fromStatusOptions} />
            <Select label="Document Type" value={docTypeFilter} onChange={(v) => { setDocTypeFilter(String(v)); setCurrentPage(1); }} options={docTypeOptions} />
            <Select
              label="Active"
              value={activeFilter}
              onChange={(v) => { setActiveFilter(String(v)); setCurrentPage(1); }}
              options={[
                { label: "All", value: "ALL" },
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" },
              ]}
            />
            <Select
              label="Type"
              value={systemFilter}
              onChange={(v) => { setSystemFilter(String(v)); setCurrentPage(1); }}
              options={[
                { label: "All", value: "ALL" },
                { label: "System", value: "SYSTEM" },
                { label: "Custom", value: "CUSTOM" },
              ]}
            />
            <DateRangePicker
              label="Created Date Range"
              startDate={createdFrom}
              endDate={createdTo}
              onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }}
              onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }}
              placeholder="Select created date range"
              autoApply
            />
            <DateRangePicker
              label="Last Updated Range"
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }}
              onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }}
              placeholder="Select last updated range"
              autoApply
            />
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

          {/* Table */}
          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center rounded-xl">
                <SectionLoading text="Loading..." minHeight="150px" />
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                {...dragEvents}
              >
                <table className="w-full min-w-[1300px]">
                  <thead className="sticky top-0 z-30">
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 w-10">
                        No.
                      </th>
                      {(
                        [
                          { key: "workflowKey", label: "Workflow" },
                          { key: "actionCode", label: "Action" },
                          { key: "fromStatus", label: "From Status" },
                          { key: "documentTypeName", label: "Doc Type" },
                          { key: "requiredPermissionCode", label: "Permission" },
                          { key: "priority", label: "Priority" },
                          { key: "active", label: "Active" },
                          { key: "system", label: "Type" },
                          { key: "createdAt", label: "Created Date" },
                          { key: "updatedAt", label: "Last Updated" },
                        ] as { key: SortKey; label: string }[]
                      ).map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{col.label}</span>
                            <div className="flex flex-col text-slate-400 group-hover:text-slate-500">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === col.key && sortDir === "asc" ? "text-emerald-600" : "")} />
                              <ChevronDown className={cn("h-3 w-3", sortKey === col.key && sortDir === "desc" ? "text-emerald-600" : "")} />
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Actors
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Relations (New)
                      </th>
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {policies.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-12 text-center">
                          <TableEmptyState
                            title="No Workflow Authorization Policies Found"
                            description={
                              hasFilters
                                ? "No policies match your filters. Try adjusting your search criteria."
                                : "No policies found. Use 'New Policy' to create a custom policy, or check backend seed data."
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      paginated.map((policy, index) => (
                        <PolicyRow
                          key={policy.id}
                          policy={policy}
                          index={(currentPage - 1) * itemsPerPage + index + 1}
                          openId={openId}
                          getRef={getRef}
                          toggle={toggle}
                          close={close}
                          position={position}
                          canManage={canManage}
                          onEdit={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/${policy.id}/edit`)}
                          onCreateOverride={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/${policy.id}/edit?mode=override`)}
                          onDuplicate={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/${policy.id}/duplicate`)}
                          onActivate={() => setActivateTarget(policy)}
                          onDeactivate={() => setDeactivateTarget(policy)}
                          onReset={() => setResetTarget(policy)}
                        />
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
                    isLoading={loading}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Drawer (mobile) */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Created Date Range" isExpanded={expandedSections.has("createdDate")} onToggle={() => toggleSection("createdDate")}>
          <div className="pt-1 pb-4">
            <DateRangePicker label="Created Date Range" startDate={createdFrom} endDate={createdTo} onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }} placeholder="Select created date range" autoApply />
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Last Updated Range" isExpanded={expandedSections.has("updatedDate")} onToggle={() => toggleSection("updatedDate")}>
          <div className="pt-1 pb-4">
            <DateRangePicker label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo} onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }} placeholder="Select last updated range" autoApply />
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Workflow" isExpanded={expandedSections.has("workflow")} onToggle={() => toggleSection("workflow")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {workflowFilterOptions.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setWorkflowFilter(String(opt.value)); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                  workflowFilter === opt.value
                    ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {workflowFilter === opt.value && <span className="text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Action" isExpanded={expandedSections.has("action")} onToggle={() => toggleSection("action")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {actionOptions.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setActionFilter(String(opt.value)); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                  actionFilter === opt.value
                    ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {actionFilter === opt.value && <span className="text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="From Status" isExpanded={expandedSections.has("fromStatus")} onToggle={() => toggleSection("fromStatus")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {fromStatusOptions.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setStatusFilter(String(opt.value)); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                  statusFilter === opt.value
                    ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <span className="text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Document Type" isExpanded={expandedSections.has("docType")} onToggle={() => toggleSection("docType")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {docTypeOptions.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setDocTypeFilter(String(opt.value)); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                  docTypeFilter === opt.value
                    ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {docTypeFilter === opt.value && <span className="text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Active" isExpanded={expandedSections.has("active")} onToggle={() => toggleSection("active")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All", value: "ALL" }, { label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setActiveFilter(opt.value); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                  activeFilter === opt.value
                    ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {activeFilter === opt.value && <span className="text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Type" isExpanded={expandedSections.has("type")} onToggle={() => toggleSection("type")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All", value: "ALL" }, { label: "System", value: "SYSTEM" }, { label: "Custom", value: "CUSTOM" }].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSystemFilter(opt.value); setCurrentPage(1); }}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                  systemFilter === opt.value
                    ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
                )}
              >
                <span className="text-xs">{opt.label}</span>
                {systemFilter === opt.value && <span className="text-emerald-500">✓</span>}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>


      {/* Effective Lookup */}
      <WorkflowPolicyEffectiveLookup
        isOpen={showEffectiveLookup}
        onClose={() => setShowEffectiveLookup(false)}
        options={options}
      />

      {/* Activate confirm */}
      <AlertModal
        isOpen={Boolean(activateTarget)}
        onClose={() => setActivateTarget(null)}
        onConfirm={() => void handleActivate()}
        type="info"
        title="Activate Policy"
        description={`Activate policy for "${activateTarget?.actionLabel ?? activateTarget?.actionCode}"?`}
        confirmText="Activate"
        cancelText="Cancel"
        showCancel
        isLoading={actionLoading}
      />

      {/* Deactivate confirm */}
      <AlertModal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => void handleDeactivate()}
        type="warning"
        title="Deactivate Policy"
        description={`Deactivating this policy may cause the action to be denied when no other active policy matches.\n\nAre you sure you want to deactivate "${deactivateTarget?.actionLabel ?? deactivateTarget?.actionCode}"?`}
        confirmText="Deactivate"
        cancelText="Cancel"
        showCancel
        isLoading={actionLoading}
      />

      {/* Reset confirm */}
      <AlertModal
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={() => void handleReset()}
        type="warning"
        title="Reset to System Default"
        description={`This will restore the system default permission, actors, priority, active flag, description, and global document type scope for "${resetTarget?.actionLabel ?? resetTarget?.actionCode}".`}
        confirmText="Reset"
        cancelText="Cancel"
        showCancel
        isLoading={actionLoading}
      />
      {signatureModal}
    </div>
  );
  },
);

// ── Row component ──────────────────────────────────────────────────────────

interface PolicyRowProps {
  policy: WorkflowActionPolicy;
  index: number;
  openId: string | null;
  getRef: (id: string) => React.RefObject<HTMLButtonElement | null>;
  toggle: (id: string, e: React.MouseEvent<HTMLButtonElement>, opts?: { menuHeight?: number; menuWidth?: number }) => void;
  close: () => void;
  position: PortalDropdownPosition;
  canManage: boolean;
  onEdit: () => void;
  onCreateOverride: () => void;
  onDuplicate: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onReset: () => void;
}

const PolicyRow: React.FC<PolicyRowProps> = ({
  policy, index, openId, getRef, toggle, close, position,
  canManage, onEdit, onCreateOverride, onDuplicate, onActivate, onDeactivate, onReset,
}) => {
  const hasWarnings = (policy.warnings?.length ?? 0) > 0;

  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 text-center">{index}</td>

      {/* Workflow */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
        <Badge
          color={policy.workflowKey === "CONTROLLED_COPY" ? "purple" : "blue"}
          size="xs"
        >
          {policy.workflowLabel ?? policy.workflowKey}
        </Badge>
      </td>

      {/* Action */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div>
            <div className="font-semibold text-slate-900">{policy.actionLabel ?? policy.actionCode}</div>
            <div className="text-[10px] text-slate-400">{policy.actionCode}</div>
          </div>
          {policy.system && <Badge color="blue" size="xs">System</Badge>}
          {hasWarnings && <Badge color="amber" size="xs">Warning</Badge>}
        </div>
      </td>

      {/* From Status */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
        {policy.fromStatusLabel ?? policy.fromStatus}
      </td>

      {/* Doc Type */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
        {policy.documentTypeName ? (
          <Badge color="purple" size="xs">{policy.documentTypeName}</Badge>
        ) : (
          <span className="text-slate-400 italic">Global</span>
        )}
      </td>

      {/* Permission */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
        {policy.requiredPermissionCode}
      </td>

      {/* Priority */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 text-center">
        {policy.priority}
      </td>

      {/* Active */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
        <Badge color={policy.active ? "emerald" : "slate"} size="sm" showDot pill>
          {policy.active ? "Active" : "Inactive"}
        </Badge>
      </td>

      {/* System/Custom */}
      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
        <Badge color={policy.system ? "blue" : "slate"} size="xs">
          {policy.system ? "System" : "Custom"}
        </Badge>
      </td>

      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
        {formatDateTime(policy.createdAt)}
      </td>

      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
        {formatDateTime(policy.updatedAt)}
      </td>

      {/* Actors */}
      <td className="py-3 px-4 text-xs sm:text-sm">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {policy.actors.slice(0, 3).map((a, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium whitespace-nowrap"
            >
              {a.actorTypeLabel ?? a.actorType}
              {a.actorCode ? ` (${a.actorCode})` : ""}
            </span>
          ))}
          {policy.actors.length > 3 && (
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[10px]">
              +{policy.actors.length - 3}
            </span>
          )}
        </div>
      </td>

      {/* Relations (new hybrid engine) */}
      <td className="py-3 px-4 text-xs sm:text-sm">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {(policy.relations ?? []).length === 0 ? (
            <span className="text-[10px] text-amber-600 italic">none</span>
          ) : (
            (policy.relations ?? []).map((r) => (
              <Badge key={r.id} color="emerald" size="xs">{r.relationCode}</Badge>
            ))
          )}
        </div>
      </td>

      {/* Row actions */}
      <td
        className="sticky right-0 bg-white py-3 px-4 text-center z-30 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={getRef(policy.id)}
          onClick={(e) => toggle(policy.id, e)}
          className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical className="h-3.5 w-3.5 text-slate-600" />
        </button>
        <PortalDropdownMenu isOpen={openId === policy.id} onClose={close} position={position}>
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconInfoCircle className="h-4 w-4" />}
              onClick={() => { onEdit(); close(); }}
            >
              View / Edit Transition
            </DropdownMenuItem>
            {canManage && (
              <>
                <DropdownMenuItem
                  icon={<IconPencilMinus className="h-4 w-4" />}
                  onClick={() => { onCreateOverride(); close(); }}
                >
                  Create Override
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => { onDuplicate(); close(); }}
                >
                  Duplicate
                </DropdownMenuItem>
                {!policy.active ? (
                  <DropdownMenuItem
                    icon={<IconToggleLeft className="h-4 w-4 text-slate-400" />}
                    onClick={() => { onActivate(); close(); }}
                  >
                    Activate
                  </DropdownMenuItem>
                ) : (
                  policy.deactivatable !== false && (
                    <DropdownMenuItem
                      icon={<IconToggleRight className="h-4 w-4 text-slate-400" />}
                      onClick={() => { onDeactivate(); close(); }}
                    >
                      Deactivate
                    </DropdownMenuItem>
                  )
                )}
                {policy.system && policy.resettable && (
                  <DropdownMenuItem
                    icon={<RefreshCw className="h-4 w-4" />}
                    onClick={() => { onReset(); close(); }}
                  >
                    Reset Default
                  </DropdownMenuItem>
                )}
              </>
            )}
          </div>
        </PortalDropdownMenu>
      </td>
    </tr>
  );
};
