import React, { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, Import, Plus, Search, Trash2, X, Check, MoreVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { IconFilter2, IconInfoCircle, IconPencilMinus, IconToggleLeft, IconToggleRight } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { useTableDragScroll, usePortalDropdown, useDebounce } from "@/hooks";
import { useToast } from "@/components/ui/toast/Toast";
import { useTranslation } from "@/i18n";
import { getApiErrorMessage } from "@/utils/apiError";
import { SectionLoading, FullPageLoading } from "@/components/ui/loading/Loading";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { cn } from "@/components/ui/utils";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { settingsApi } from "@/services/api";
import type { PermissionSetCapabilitiesResponse, PermissionSetPayload, PermissionSetResponse } from "@/services/api/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionSetCloneModal } from "./PermissionSetCloneModal";
import { PermissionCatalogTab } from "./PermissionCatalogTab";
import { ROUTES } from "@/app/routes.constants";
import { permissionSets as permissionSetsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { formatDateTime } from "@/utils/format";

const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const STATUS_OPTIONS: SelectOption[] = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

const TYPE_OPTIONS: SelectOption[] = [
  { label: "All Types", value: "ALL" },
  { label: "System", value: "SYSTEM" },
  { label: "Custom", value: "CUSTOM" },
];

export const PermissionSetsView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"sets" | "catalog">("sets");
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canViewPermissionSets = hasPermissionAlias("security.permission_sets.view");
  const canManagePermissionSets = hasPermissionAlias("security.permission_sets.update");
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();

  const [sets, setSets] = useState<PermissionSetResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<PermissionSetResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionSetResponse | null>(null);

  // Server-side query state — every change triggers a refetch.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Dropdown values come from the server.
  const [listOptions, setListOptions] = useState<Record<string, string[]>>({});

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status"]));
  const [capabilityBySetId, setCapabilityBySetId] = useState<Record<string, PermissionSetCapabilitiesResponse>>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const load = useCallback(async () => {
    if (!canViewPermissionSets) {
      setSets([]);
      setLoading(false);
      setInitialLoaded(true);
      return;
    }
    setLoading(true);
    try {
      const res = await settingsApi.listPermissionSetsPaged({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        module: moduleFilter !== "ALL" ? moduleFilter : undefined,
        category: categoryFilter !== "ALL" ? categoryFilter : undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        updatedFrom: updatedFrom || undefined,
        updatedTo: updatedTo || undefined,
        sortBy: sortKey,
        sortDir,
      });
      setSets(res.data ?? []);
      setTotalItems(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: t("permissionSets.loadFailed") });
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [canViewPermissionSets, currentPage, itemsPerPage, debouncedSearch, statusFilter, typeFilter, moduleFilter, categoryFilter, createdFrom, createdTo, updatedFrom, updatedTo, sortKey, sortDir, showToast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canViewPermissionSets) return;
    settingsApi.getPermissionSetListOptions()
      .then(setListOptions)
      .catch(() => setListOptions({}));
  }, [canViewPermissionSets]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moduleOptions: SelectOption[] = [
    { label: "All Modules", value: "ALL" },
    ...(listOptions.modules ?? []).map((m) => ({ label: m, value: m })),
  ];
  const categoryOptions: SelectOption[] = [
    { label: "All Categories", value: "ALL" },
    ...(listOptions.categories ?? []).map((c) => ({ label: c, value: c })),
  ];

  const hasFilters = !!search || statusFilter !== "ALL" || typeFilter !== "ALL" || moduleFilter !== "ALL" || categoryFilter !== "ALL"
    || !!createdFrom || !!createdTo || !!updatedFrom || !!updatedTo;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setModuleFilter("ALL");
    setCategoryFilter("ALL");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setCurrentPage(1);
  };

  const handleDelete = async (ps: PermissionSetResponse) => {
    if (ps.system) {
      showToast({ type: "error", message: t("permissionSets.systemCannotDelete") });
      return;
    }
    const sig = await requestSignature(`Delete Permission Set "${ps.name}"`, "Permission Set Change");
    if (!sig) return;
    try {
      await settingsApi.deletePermissionSet(ps.id, sig);
      showToast({ type: "success", message: t("permissionSets.deleted") });
      setDeleteTarget(null);
      void load();
    } catch (error: any) {
      showToast({ type: "error", message: error?.response?.data?.message ?? t("permissionSets.deleteFailed") });
    }
  };

  const handleDeactivate = async (ps: PermissionSetResponse) => {
    const sig = await requestSignature(`${ps.active ? "Deactivate" : "Activate"} Permission Set "${ps.name}"`, "Permission Set Change");
    if (!sig) return;
    try {
      await settingsApi.updatePermissionSet(ps.id, {
        name: ps.name,
        description: ps.description ?? undefined,
        active: !ps.active,
        permissionCodes: ps.permissionCodes,
      }, sig);
      const caps = await settingsApi.getPermissionSetCapabilities(ps.id);
      setCapabilityBySetId((prev) => ({ ...prev, [ps.id]: caps }));
      showToast({ type: "success", message: t(ps.active ? "permissionSets.deactivated" : "permissionSets.activated") });
      void load();
    } catch {
      showToast({ type: "error", message: t("permissionSets.statusUpdateFailed") });
    }
  };

  const handleExport = async () => {
    try {
      const all = await settingsApi.listPermissionSets();
      downloadJson(`permission-sets-${new Date().toISOString().split("T")[0]}.json`, all);
    } catch {
      showToast({ type: "error", message: t("permissionSets.exportFailed") });
    }
  };

  const handleImportClick = () => importInputRef.current?.click();

  const loadPermissionSetCapabilities = async (id: string) => {
    if (capabilityBySetId[id]) return;
    try {
      const caps = await settingsApi.getPermissionSetCapabilities(id);
      setCapabilityBySetId((prev) => ({ ...prev, [id]: caps }));
    } catch {
      setCapabilityBySetId((prev) => ({
        ...prev,
        [id]: { permissionSetId: id, actions: {} },
      }));
    }
  };

  const handleActionMenuToggle = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    void loadPermissionSetCapabilities(id);
    toggle(id, event);
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Array<Partial<PermissionSetPayload> & { active?: boolean }>;
      if (!Array.isArray(parsed)) throw new Error("Import file must contain an array");
      for (const item of parsed) {
        if (!item?.name) continue;
        await settingsApi.createPermissionSet({
          name: String(item.name),
          code: item.code || undefined,
          description: item.description || undefined,
          active: item.active ?? true,
          permissionCodes: Array.isArray(item.permissionCodes) ? item.permissionCodes : [],
        });
      }
      showToast({ type: "success", message: t("permissionSets.imported") });
      void load();
    } catch (error: unknown) {
      showToast({ type: "error", message: getApiErrorMessage(error, t("permissionSets.importFailed")) });
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-200"
    );

  const isInitialLoading = loading && !initialLoaded;
  const isTableLoading = loading && initialLoaded;

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {isInitialLoading && <FullPageLoading text="Loading permission sets..." />}

      <PageHeader
        title="Shared Permission Sets"
        breadcrumbItems={permissionSetsBreadcrumb()}
        actions={
          activeTab === "sets" ? (
            <>
              {canManagePermissionSets && (
                <Button variant="outline" size="sm" onClick={handleImportClick} className="whitespace-nowrap gap-2">
                  <Import className="h-4 w-4" />
                  Import
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport} className="whitespace-nowrap gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              {canManagePermissionSets && (
                <Button size="sm" onClick={() => navigate(`${ROUTES.SECURITY.PERMISSION_SETS}/new`)} className="whitespace-nowrap gap-2">
                  <Plus className="h-4 w-4" />
                  New Shared Permission Set
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => void handleImport(e.target.files?.[0] ?? null)}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden">
        <TabNav
          tabs={[{ id: "sets", label: "Permission Sets" }, { id: "catalog", label: "Browse Catalog" }] satisfies TabItem[]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as "sets" | "catalog")}
          variant="underline"
        />
        <div className="p-4 md:p-5 flex flex-col">
          {activeTab === "catalog" && <PermissionCatalogTab />}
          {activeTab === "sets" && (
            <>
      {!canViewPermissionSets ? (
        <TableEmptyState title="Permission denied" description="You do not have permission to view permission sets." />
      ) : (
        <div className="flex-1 flex flex-col">

          {/* Mobile: search + filter button */}
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search permission sets..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                <IconFilter2 className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          {/* Desktop: labeled filter grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
            <div className="w-full">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name, description or code..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="block w-full pl-10 pr-3 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="w-full">
              <Select label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(String(v)); setCurrentPage(1); }} options={STATUS_OPTIONS} placeholder="Select status" />
            </div>
            <div className="w-full">
              <Select label="Type" value={typeFilter} onChange={(v) => { setTypeFilter(String(v)); setCurrentPage(1); }} options={TYPE_OPTIONS} placeholder="Select type" />
            </div>
            <div className="w-full">
              <Select label="Module" value={moduleFilter} onChange={(v) => { setModuleFilter(String(v)); setCurrentPage(1); }} options={moduleOptions} placeholder="Select module" searchPlaceholder="Search module..." />
            </div>
            <div className="w-full">
              <Select label="Category" value={categoryFilter} onChange={(v) => { setCategoryFilter(String(v)); setCurrentPage(1); }} options={categoryOptions} placeholder="Select category" />
            </div>
            <div className="w-full">
              <DateRangePicker
                label="Created Date Range"
                startDate={createdFrom}
                endDate={createdTo}
                onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }}
                onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }}
                placeholder="Select created date range"
                autoApply
              />
            </div>
            <div className="w-full">
              <DateRangePicker
                label="Last Updated Range"
                startDate={updatedFrom}
                endDate={updatedTo}
                onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }}
                onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }}
                placeholder="Select last updated range"
                autoApply
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

          {/* Table */}
          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white transition-all duration-300 relative">
              <div
                ref={scrollerRef as React.RefObject<HTMLDivElement>}
                className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                {...dragEvents}
              >
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="sticky top-0 z-30">
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-12">No.</th>
                      {([
                        { key: "name",            label: "Name",        sortable: true  },
                        { key: "description",     label: "Description", sortable: false },
                        { key: "moduleCount",     label: "Modules",     sortable: true  },
                        { key: "permissionCount", label: "Permissions", sortable: true  },
                        { key: "category",        label: "Category",    sortable: false },
                        { key: "status",          label: "Status",      sortable: true  },
                        { key: "type",            label: "Type",        sortable: true  },
                        { key: "createdAt",        label: "Created Date", sortable: true },
                        { key: "updatedAt",        label: "Last Updated", sortable: true },
                      ] as const).map((col) => (
                        <th
                          key={col.key}
                          onClick={col.sortable ? () => handleSort(col.key) : undefined}
                          className={cn(
                            "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group",
                            col.sortable && "cursor-pointer hover:bg-slate-100 hover:text-slate-700"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span>{col.label}</span>
                            {col.sortable && (
                              <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                                <ChevronUp className={cn("h-3 w-3 -mb-1", sortKey === col.key && sortDir === "asc" ? "text-emerald-600" : "")} />
                                <ChevronDown className={cn("h-3 w-3", sortKey === col.key && sortDir === "desc" ? "text-emerald-600" : "")} />
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {!loading && sets.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center">
                          <TableEmptyState
                            title="No Shared Permission Sets Found"
                            description="We couldn't find any shared permission sets matching your filters. Try adjusting your search criteria."
                          />
                        </td>
                      </tr>
                    ) : sets.map((ps, index) => {
                      const capabilities = capabilityBySetId[ps.id];
                      const can = (action: string) => Boolean(capabilities?.actions?.[action]?.allowed);
                      const reason = (action: string) => capabilities?.actions?.[action]?.reason || "Action is not currently allowed";
                      const loaded = Boolean(capabilities);
                      return (
                        <tr
                          key={ps.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => navigate(`${ROUTES.SECURITY.PERMISSION_SETS}/${ps.id}`)}
                        >
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 text-center">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{ps.name}</div>
                            <div className="mt-0.5 text-xs text-slate-400">{ps.code}</div>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm text-slate-600 max-w-[280px]">
                            <p className="line-clamp-2">{ps.description || "—"}</p>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                            {ps.modules?.length ?? 0}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">
                            {ps.permissionCount}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {ps.category ?? "—"}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge color={ps.active ? "emerald" : "slate"} size="sm" showDot pill>
                              {ps.active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <Badge color={ps.system ? "blue" : "slate"} size="sm">
                              {ps.system ? "System" : "Custom"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {formatDateTime(ps.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                            {formatDateTime(ps.updatedAt)}
                          </td>
                          <td
                            className="sticky right-0 bg-white py-3 px-4 text-center z-10 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50/80 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              ref={getRef(ps.id)}
                              onClick={(e) => handleActionMenuToggle(ps.id, e)}
                              className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                            </button>
                            <PortalDropdownMenu isOpen={openId === ps.id} onClose={close} position={position}>
                              <div className="py-1">
                                <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { navigate(`${ROUTES.SECURITY.PERMISSION_SETS}/${ps.id}`); close(); }}>
                                  View Detail
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  icon={<IconPencilMinus className="h-4 w-4" />}
                                  disabled={!loaded || !can("edit")}
                                  title={loaded && !can("edit") ? reason("edit") : undefined}
                                  onClick={() => { navigate(`${ROUTES.SECURITY.PERMISSION_SETS}/${ps.id}/edit`); close(); }}
                                >
                                  Edit Shared Permission
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  icon={<Copy className="h-4 w-4" />}
                                  disabled={!loaded || !can("clone")}
                                  title={loaded && !can("clone") ? reason("clone") : undefined}
                                  onClick={() => { setCloneTarget(ps); close(); }}
                                >
                                  Clone
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  icon={
                                    ps.active
                                      ? <IconToggleRight className="h-4 w-4" />
                                      : <IconToggleLeft className="h-4 w-4" />
                                  }
                                  disabled={!loaded || !can("toggleStatus")}
                                  title={loaded && !can("toggleStatus") ? reason("toggleStatus") : undefined}
                                  onClick={() => { void handleDeactivate(ps); close(); }}
                                >
                                  {ps.active ? "Deactivate" : "Activate"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  icon={<Trash2 className="h-4 w-4" />}
                                  disabled={!loaded || !can("delete")}
                                  title={loaded && !can("delete") ? reason("delete") : undefined}
                                  onClick={() => { setDeleteTarget(ps); close(); }}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </div>
                            </PortalDropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
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
                    isLoading={isTableLoading}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
                    itemsPerPageOptions={[10, 20, 50]}
                  />
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
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setStatusFilter(String(opt.value)); setCurrentPage(1); }} className={getOptionClassName(statusFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Type" isExpanded={expandedSections.has("type")} onToggle={() => toggleSection("type")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {TYPE_OPTIONS.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setTypeFilter(String(opt.value)); setCurrentPage(1); }} className={getOptionClassName(typeFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {typeFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Module" isExpanded={expandedSections.has("module")} onToggle={() => toggleSection("module")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {moduleOptions.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setModuleFilter(String(opt.value)); setCurrentPage(1); }} className={getOptionClassName(moduleFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {moduleFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Category" isExpanded={expandedSections.has("category")} onToggle={() => toggleSection("category")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {categoryOptions.map((opt) => (
              <button key={String(opt.value)} onClick={() => { setCategoryFilter(String(opt.value)); setCurrentPage(1); }} className={getOptionClassName(categoryFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {categoryFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Created Date Range" isExpanded={expandedSections.has("created")} onToggle={() => toggleSection("created")}>
          <div className="pt-2 pb-4">
            <DateRangePicker
              label="Created Date Range"
              startDate={createdFrom}
              endDate={createdTo}
              onStartDateChange={(value) => { setCreatedFrom(value); setCurrentPage(1); }}
              onEndDateChange={(value) => { setCreatedTo(value); setCurrentPage(1); }}
              placeholder="Select created date range"
              autoApply
            />
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Last Updated Range" isExpanded={expandedSections.has("updated")} onToggle={() => toggleSection("updated")}>
          <div className="pt-2 pb-4">
            <DateRangePicker
              label="Last Updated Range"
              startDate={updatedFrom}
              endDate={updatedTo}
              onStartDateChange={(value) => { setUpdatedFrom(value); setCurrentPage(1); }}
              onEndDateChange={(value) => { setUpdatedTo(value); setCurrentPage(1); }}
              placeholder="Select last updated range"
              autoApply
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      {cloneTarget && (
        <PermissionSetCloneModal
          isOpen
          source={cloneTarget}
          onClose={() => setCloneTarget(null)}
          onCloned={() => { setCloneTarget(null); void load(); }}
        />
      )}

      <AlertModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && void handleDelete(deleteTarget)}
        type="warning"
        title="Delete Permission Set"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />
      {signatureModal}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
