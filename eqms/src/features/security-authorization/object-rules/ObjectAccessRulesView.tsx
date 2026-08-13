import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Database, Search, ShieldCheck, ShieldX, MoreVertical, X, Check, ChevronUp, ChevronDown } from "lucide-react";
import { IconFilter2, IconPencilMinus, IconTrash } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown, useTableDragScroll, useDebounce } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { settingsApi } from "@/services/api";
import type { ObjectAccessRuleResponse } from "@/services/api/settings";
import { objectAccessRules as objectAccessRulesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/utils/format";
import { useTranslation } from "@/i18n";

const EFFECT_OPTIONS: SelectOption[] = [
  { label: "All Effects", value: "ALL" },
  { label: "Allow", value: "ALLOW" },
  { label: "Deny", value: "DENY" },
];
const STATUS_OPTIONS: SelectOption[] = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

export const ObjectAccessRulesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { hasPermissionAlias } = usePermissions();
  const canViewRules = hasPermissionAlias("security.object_rules.view");
  const canManageRules = hasPermissionAlias("security.object_rules.manage");
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { requestSignature, signatureModal } = useSecurityESign();

  const [rules, setRules] = useState<ObjectAccessRuleResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ObjectAccessRuleResponse | null>(null);

  // Server-side query state.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [resourceTypeFilter, setResourceTypeFilter] = useState("ALL");
  const [effectFilter, setEffectFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortKey, setSortKey] = useState("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Dropdown values from the server options endpoint.
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["resourceType"]));

  const load = useCallback(async () => {
    if (!canViewRules) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await settingsApi.listObjectAccessRulesPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        resourceType: resourceTypeFilter !== "ALL" ? resourceTypeFilter : undefined,
        effect: effectFilter !== "ALL" ? effectFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        sortBy: sortKey,
        sortDir,
      });
      setRules(res.data ?? []);
      setTotalItems(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: t("objectAccessRules.loadListFailed") });
    } finally {
      setLoading(false);
    }
  }, [canViewRules, currentPage, itemsPerPage, debouncedSearch, resourceTypeFilter, effectFilter, statusFilter, createdFrom, createdTo, updatedFrom, updatedTo, sortKey, sortDir, showToast, t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canViewRules) return;
    settingsApi.getObjectAccessRuleOptions()
      .then((o) => setResourceTypes(o.resourceTypes ?? []))
      .catch(() => setResourceTypes([]));
  }, [canViewRules]);

  const resourceTypeOptions: SelectOption[] = [
    { label: "All Resource Types", value: "ALL" },
    ...resourceTypes.map((t) => ({ label: t.replace(/_/g, " "), value: t })),
  ];

  const hasFilters = !!search || resourceTypeFilter !== "ALL" || effectFilter !== "ALL" || statusFilter !== "ALL" || !!createdFrom || !!createdTo || !!updatedFrom || !!updatedTo;
  const clearFilters = () => {
    setSearch("");
    setResourceTypeFilter("ALL");
    setEffectFilter("ALL");
    setStatusFilter("ALL");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
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
    const sig = await requestSignature(`Delete Object Access Rule "${deleteTarget.name}"`, "Security Configuration Change");
    if (!sig) return;
    try {
      await settingsApi.deleteObjectAccessRule(deleteTarget.id, sig);
      showToast({ type: "success", message: t("objectAccessRules.deleted") });
      setDeleteTarget(null);
      void load();
    } catch (e: any) {
      showToast({ type: "error", message: e?.response?.data?.error?.message ?? e?.response?.data?.message ?? t("objectAccessRules.deleteFailed") });
    }
  };

  const filterOptionClass = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300",
    );

  const SORTABLE_COLS = [
    { key: "name", label: "Rule" },
    { key: "resourceType", label: "Resource" },
    { key: "createdAt", label: "Created Date" },
    { key: "updatedAt", label: "Last Updated" },
  ] as const;

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      <PageHeader
        title="Object Access Rules"
        breadcrumbItems={objectAccessRulesBreadcrumb(navigate)}
        actions={
          canManageRules ? (
            <Button size="sm" className="whitespace-nowrap gap-2" onClick={() => navigate(`${ROUTES.SECURITY.OBJECT_RULES}/new`)}>
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          ) : undefined
        }
      />

      {!canViewRules ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <TableEmptyState title="Permission denied" description="You do not have permission to view object access rules." />
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
                  placeholder="Search rules…"
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
                    placeholder="Search rules…"
                    className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                  />
                </div>
              </div>
              <Select label="Resource Type" value={resourceTypeFilter} onChange={(v) => { setResourceTypeFilter(String(v)); setCurrentPage(1); }} options={resourceTypeOptions} />
              <Select label="Effect" value={effectFilter} onChange={(v) => { setEffectFilter(String(v)); setCurrentPage(1); }} options={EFFECT_OPTIONS} />
              <Select label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(String(v)); setCurrentPage(1); }} options={STATUS_OPTIONS} />
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
              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                {...dragEvents}
              >
                <table className="w-full min-w-[1100px]">
                  <thead className="sticky top-0 z-30">
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-12">No.</th>
                      {SORTABLE_COLS.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group"
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="truncate">{col.label}</span>
                            <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === col.key && sortDir === "asc" ? "text-emerald-600" : "")} />
                              <ChevronDown className={cn("h-3 w-3", sortKey === col.key && sortDir === "desc" ? "text-emerald-600" : "")} />
                            </div>
                          </div>
                        </th>
                      ))}
                      {["Access Profile Scope", "Actions"].map((label) => (
                        <th key={label} className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                          {label}
                        </th>
                      ))}
                      {([{ key: "effect", label: "Effect" }, { key: "priority", label: "Priority" }] as const).map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group"
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="truncate">{col.label}</span>
                            <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === col.key && sortDir === "asc" ? "text-emerald-600" : "")} />
                              <ChevronDown className={cn("h-3 w-3", sortKey === col.key && sortDir === "desc" ? "text-emerald-600" : "")} />
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {!loading && rules.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center">
                          <TableEmptyState
                            icon={<Database className="h-10 w-10 text-slate-300" />}
                            title="No Object Access Rules"
                            description={hasFilters ? "Try adjusting your search or filters." : "No object access rules have been defined yet."}
                          />
                        </td>
                      </tr>
                    ) : (
                      rules.map((r, idx) => (
                        <tr key={r.id} className={cn("hover:bg-slate-50/80 transition-colors group", !r.active && "opacity-50")}>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-500 text-center">
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="font-medium text-slate-800">{r.name}</div>
                            {!r.active && (
                              <Badge color="slate" size="xs" className="mt-0.5">
                                Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <span className="font-mono text-slate-500">{r.resourceType.replace(/_/g, " ")}</span>
                            {r.resourceName && <div className="text-xs text-slate-600 mt-0.5">{r.resourceName}</div>}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{formatDateTime(r.createdAt)}</td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{formatDateTime(r.updatedAt)}</td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {r.accessProfileName ?? <span className="text-slate-400 italic">All Access Profiles</span>}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              {r.actions.map((a) => (
                                <Badge key={a} color="slate" size="xs">{a}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge color={r.effect === "ALLOW" ? "emerald" : "red"} size="sm" pill className="gap-1">
                              {r.effect === "ALLOW" ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                              {r.effect}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{r.priority}</td>
                          <td
                            onClick={(e) => e.stopPropagation()}
                            className="sticky right-0 bg-white py-3 px-4 text-center z-10 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                          >
                            <button
                              ref={getRef(r.id)}
                              onClick={(e) => toggle(r.id, e)}
                              className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                            </button>
                            <PortalDropdownMenu isOpen={openId === r.id} onClose={close} position={position}>
                              <div className="py-1">
                                {canManageRules && (
                                  <>
                                    <DropdownMenuItem
                                      icon={<IconPencilMinus className="h-4 w-4" />}
                                      onClick={() => {
                                        navigate(`${ROUTES.SECURITY.OBJECT_RULES}/${r.id}/edit`);
                                        close();
                                      }}
                                    >
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      icon={<IconTrash className="h-4 w-4" />}
                                      onClick={() => {
                                        setDeleteTarget(r);
                                        close();
                                      }}
                                    >
                                      Delete
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
      )}

      {/* Mobile filter drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Created Date Range" isExpanded={expandedSections.has("createdDate")} onToggle={() => toggleSection("createdDate")}>
          <div className="pt-1 pb-4"><DateRangePicker label="Created Date Range" startDate={createdFrom} endDate={createdTo} onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }} placeholder="Select created date range" autoApply /></div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Last Updated Range" isExpanded={expandedSections.has("updatedDate")} onToggle={() => toggleSection("updatedDate")}>
          <div className="pt-1 pb-4"><DateRangePicker label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo} onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }} onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }} placeholder="Select last updated range" autoApply /></div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Resource Type" isExpanded={expandedSections.has("resourceType")} onToggle={() => toggleSection("resourceType")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {resourceTypeOptions.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setResourceTypeFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(resourceTypeFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {resourceTypeFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Effect" isExpanded={expandedSections.has("effect")} onToggle={() => toggleSection("effect")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {EFFECT_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setEffectFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(effectFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {effectFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setStatusFilter(String(opt.value)); setCurrentPage(1); }} className={filterOptionClass(statusFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
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
        title="Delete Object Access Rule"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />

      {signatureModal}
    </div>
  );
};
