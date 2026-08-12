import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Layers, Search, MoreVertical, Shield, X, Check, ChevronUp, ChevronDown } from "lucide-react";
import { IconFilter2, IconPencilMinus, IconTrash } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown, useTableDragScroll, useDebounce } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { formatDateTime } from "@/utils/format";
import { lifecycleStatePolicyApi, type LifecycleStatePolicy, type LifecycleStatePolicyOptions } from "@/services/api/lifecycleStatePolicy";
import { workflowAuthorization as workflowAuthorizationBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ROUTES } from "@/app/routes.constants";

const BASE_PATH = `${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/state-policies`;

const TYPE_OPTIONS: SelectOption[] = [
  { label: "All Types", value: "ALL" },
  { label: "System", value: "SYSTEM" },
  { label: "Custom", value: "CUSTOM" },
];
const ACTIVE_OPTIONS: SelectOption[] = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

export const StatePoliciesView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canView = hasPermissionAlias("security.workflow_authorization.view");
  const canManage = hasPermissionAlias("security.workflow_authorization.manage");
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { requestSignature, signatureModal } = useSecurityESign();

  const [policies, setPolicies] = useState<LifecycleStatePolicy[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<LifecycleStatePolicy | null>(null);

  // Server-side query state.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [capabilityFilter, setCapabilityFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortKey, setSortKey] = useState("capability");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [options, setOptions] = useState<LifecycleStatePolicyOptions | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["capability"]));

  const load = useCallback(async () => {
    if (!canView) {
      setPolicies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await lifecycleStatePolicyApi.listPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        capability: capabilityFilter !== "ALL" ? capabilityFilter : undefined,
        actorScope: scopeFilter !== "ALL" ? scopeFilter : undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        active: activeFilter !== "ALL" ? activeFilter : undefined,
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
      showToast({ type: "error", message: "Failed to load state policies" });
    } finally {
      setLoading(false);
    }
  }, [canView, currentPage, itemsPerPage, debouncedSearch, capabilityFilter, scopeFilter, typeFilter, activeFilter, createdFrom, createdTo, updatedFrom, updatedTo, sortKey, sortDir, showToast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canView) return;
    lifecycleStatePolicyApi.getOptions().then(setOptions).catch(() => setOptions(null));
  }, [canView]);

  const capabilityOptions: SelectOption[] = [
    { label: "All Capabilities", value: "ALL" },
    ...(options?.capabilities ?? []).map((c) => ({ label: c.replace(/_/g, " "), value: c })),
  ];
  const scopeOptions: SelectOption[] = [
    { label: "All Actor Scopes", value: "ALL" },
    ...(options?.actorScopes ?? []).map((s) => ({ label: s, value: s })),
  ];

  const hasFilters = !!search || capabilityFilter !== "ALL" || scopeFilter !== "ALL" || typeFilter !== "ALL" || activeFilter !== "ALL" || !!createdFrom || !!createdTo || !!updatedFrom || !!updatedTo;
  const clearFilters = () => {
    setSearch("");
    setCapabilityFilter("ALL");
    setScopeFilter("ALL");
    setTypeFilter("ALL");
    setActiveFilter("ALL");
    setCreatedFrom(""); setCreatedTo(""); setUpdatedFrom(""); setUpdatedTo("");
    setCurrentPage(1);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const toggleSection = (id: string) => setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const sig = await requestSignature("Delete Lifecycle State Policy", "Workflow Authorization Change");
    if (!sig) return;
    try {
      await lifecycleStatePolicyApi.remove(deleteTarget.id, sig);
      showToast({ type: "success", message: "State policy deleted" });
      setDeleteTarget(null);
      void load();
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.message ?? "Delete failed" });
    }
  };

  const filterOptionClass = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
    );

  const sortableTh = (key: string, label: string) => (
    <th
      key={key}
      onClick={() => handleSort(key)}
      className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
          <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === key && sortDir === "asc" ? "text-emerald-600" : "")} />
          <ChevronDown className={cn("h-3 w-3", sortKey === key && sortDir === "desc" ? "text-emerald-600" : "")} />
        </div>
      </div>
    </th>
  );

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to view Workflow Authorization policies.</p>
      </div>
    );
  }

  const pageActions = canManage ? (
    <Button size="sm" className="whitespace-nowrap gap-2" onClick={() => navigate(`${BASE_PATH}/new`)}>
      <Plus className="h-4 w-4" />
      New State Policy
    </Button>
  ) : undefined;

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {!embedded && (
        <PageHeader
          title="Capabilities"
          breadcrumbItems={workflowAuthorizationBreadcrumb(navigate, "Capabilities")}
          actions={pageActions}
        />
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        State policies control who can <b>view, preview, or download</b> a revision at each lifecycle status —
        separate from workflow action policies which control transitions (submit/review/approve).
        System policies enforce strict participant visibility and can be deactivated but not deleted.
      </div>

      <div className="w-full overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col">

          {/* Mobile: search + filter drawer */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search state policies…"
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
                  placeholder="Search state policies…"
                  className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>
            <Select label="Capability" value={capabilityFilter} onChange={(v) => { setCapabilityFilter(String(v)); setCurrentPage(1); }} options={capabilityOptions} />
            <Select label="Actor Scope" value={scopeFilter} onChange={(v) => { setScopeFilter(String(v)); setCurrentPage(1); }} options={scopeOptions} />
            <Select label="Type" value={typeFilter} onChange={(v) => { setTypeFilter(String(v)); setCurrentPage(1); }} options={TYPE_OPTIONS} />
            <Select label="Status" value={activeFilter} onChange={(v) => { setActiveFilter(String(v)); setCurrentPage(1); }} options={ACTIVE_OPTIONS} />
            <DateRangePicker label="Created Date Range" startDate={createdFrom} endDate={createdTo} onStartDateChange={(v) => { setCreatedFrom(v); setCurrentPage(1); }} onEndDateChange={(v) => { setCreatedTo(v); setCurrentPage(1); }} placeholder="Select created date range" autoApply />
            <DateRangePicker label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo} onStartDateChange={(v) => { setUpdatedFrom(v); setCurrentPage(1); }} onEndDateChange={(v) => { setUpdatedTo(v); setCurrentPage(1); }} placeholder="Select last updated range" autoApply />
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
            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                {...dragEvents}
              >
                <table className="w-full min-w-[1120px]">
                  <thead className="sticky top-0 z-30">
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-12">No.</th>
                      {sortableTh("capability", "Capability")}
                      {sortableTh("status", "Status")}
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">Document Type</th>
                      {sortableTh("actorScope", "Actor Scope")}
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">Required Permission</th>
                      {sortableTh("priority", "Priority")}
                      {sortableTh("type", "Type")}
                      {sortableTh("createdAt", "Created Date")}
                      {sortableTh("updatedAt", "Last Updated")}
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {!loading && policies.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center">
                          <TableEmptyState
                            icon={<Layers className="h-10 w-10 text-slate-300" />}
                            title="No State Policies"
                            description={hasFilters ? "Try adjusting your search or filters." : "No lifecycle state policies have been defined yet."}
                          />
                        </td>
                      </tr>
                    ) : (
                      policies.map((p, idx) => (
                        <tr key={p.id} className={cn("hover:bg-slate-50/80 transition-colors group", !p.active && "opacity-50")}>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-500 text-center">
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <span className="font-medium text-slate-800">{p.capabilityCode.replace(/_/g, " ")}</span>
                            {!p.active && (
                              <Badge color="slate" size="xs" className="ml-2">
                                Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {p.statusCode ? (p.statusLabel ?? p.statusCode) : <span className="text-slate-400 italic">Any status</span>}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {p.documentTypeName ?? <span className="text-slate-400 italic">All types</span>}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge color={p.actorScope === "ANY" ? "blue" : "emerald"} size="sm">
                              {p.actorScope}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            {p.requiredPermissionCode ? (
                              <span className="font-mono text-slate-600">{p.requiredPermissionCode}</span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{p.priority}</td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge color={p.system ? "blue" : "slate"} size="sm">
                              {p.system ? "System" : "Custom"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{formatDateTime(p.createdAt)}</td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{formatDateTime(p.updatedAt)}</td>
                          <td
                            onClick={(e) => e.stopPropagation()}
                            className="sticky right-0 bg-white py-3 px-4 text-center z-30 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                          >
                            <button
                              ref={getRef(p.id)}
                              onClick={(e) => toggle(p.id, e)}
                              className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                            </button>
                            <PortalDropdownMenu isOpen={openId === p.id} onClose={close} position={position}>
                              <div className="py-1">
                                {canManage && (
                                  <>
                                    <DropdownMenuItem
                                      icon={<IconPencilMinus className="h-4 w-4" />}
                                      onClick={() => {
                                        navigate(`${BASE_PATH}/${p.id}/edit`);
                                        close();
                                      }}
                                    >
                                      Edit Capability
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      icon={<IconTrash className="h-4 w-4" />}
                                      onClick={() => {
                                        setDeleteTarget(p);
                                        close();
                                      }}
                                      disabled={p.system}
                                    >
                                      Delete Capability
                                    </DropdownMenuItem>
                                  </>
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

      {/* Mobile filter drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Capability" isExpanded={expandedSections.has("capability")} onToggle={() => toggleSection("capability")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {capabilityOptions.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setCapabilityFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(capabilityFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {capabilityFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Actor Scope" isExpanded={expandedSections.has("scope")} onToggle={() => toggleSection("scope")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {scopeOptions.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setScopeFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(scopeFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {scopeFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Type" isExpanded={expandedSections.has("type")} onToggle={() => toggleSection("type")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {TYPE_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setTypeFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(typeFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {typeFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {ACTIVE_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setActiveFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(activeFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {activeFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      <AlertModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        type="warning"
        title="Delete State Policy"
        description={
          deleteTarget
            ? `Are you sure you want to delete the "${deleteTarget.capabilityCode}" policy for ${deleteTarget.statusCode ?? "any status"}? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />

      {signatureModal}
    </div>
  );
};
