import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Copy, MoreVertical, Plus, Search, ToggleLeft, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast";
import { useDebounce, usePortalDropdown, useTableDragScroll } from "@/hooks";
import { publishingTemplatesApi } from "@/services/api/publishingTemplates";
import { metadataApi } from "@/services/api/metadata";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTimeLong } from "@/utils/format";
import type { PublishingTemplateResponse } from "@/features/documents/publishing/types";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { IconBrandTelegram, IconFilter2, IconPencilMinus, IconShare2, IconShare3 } from "@tabler/icons-react";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { publishingTemplates as publishingTemplatesBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

const DEFAULT_PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "All" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

const PUBLISHING_MODE_OPTIONS = [
  { label: "All Modes", value: "All" },
  { label: "Cover only", value: "COVER_ONLY" },
  { label: "Cover + Header/Footer", value: "COVER_HEADER_FOOTER" },
  { label: "Header/Footer only", value: "HEADER_FOOTER_ONLY" },
];

const tableColumns = [
  { id: "templateName", label: "Template Name", sortable: true, className: "min-w-[240px]" },
  { id: "publishingMode", label: "Publishing Mode", sortable: true, className: "min-w-[190px]" },
  { id: "versionNumber", label: "Version", sortable: true, className: "min-w-[110px]" },
  { id: "status", label: "Status", sortable: true, className: "min-w-[130px]" },
  { id: "components", label: "Configured Files", sortable: false, className: "min-w-[220px]" },
  { id: "createdBy", label: "Created By", sortable: true, className: "min-w-[160px]" },
  { id: "updatedAt", label: "Updated", sortable: true, className: "min-w-[180px]" },
  { id: "publishedAt", label: "Published", sortable: true, className: "min-w-[180px]" },
  { id: "action", label: "Action", sortable: false, className: "w-20 text-center" },
];

const getStatusColor = (status?: string | null): BadgeColor => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "PUBLISHED") return "emerald";
  return "slate";
};

const formatPublishingMode = (value?: string | null) => {
  const normalized = normalizePublishingMode(value);
  const match = PUBLISHING_MODE_OPTIONS.find((item) => item.value === normalized);
  return match?.label || value || "-";
};

const normalizePublishingMode = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "COVER_AND_HEADER_FOOTER") return "COVER_HEADER_FOOTER";
  if (normalized === "BODY_HEADER_FOOTER_ONLY") return "HEADER_FOOTER_ONLY";
  if (normalized === "COVER_HEADER_FOOTER" || normalized === "HEADER_FOOTER_ONLY") {
    return normalized;
  }
  return "COVER_ONLY";
};

const formatStatus = (value?: string | null) => {
  const match = STATUS_OPTIONS.find((item) => item.value === String(value || "").toUpperCase());
  return match?.label || (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "-");
};

const configuredFileCount = (template: PublishingTemplateResponse) =>
  (template.components || []).filter((component) => Boolean(component.fileName || component.objectKey)).length;

export const PublishingTemplatesView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManageTemplates = hasPermissionAlias('settings.publishing_template.manage')
    || hasPermissionAlias('settings.configuration.edit')
    || hasPermissionAlias('settings.configuration.manage');
  const { showToast } = useToast();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const requestSeqRef = useRef(0);
  const navigateTimerRef = useRef<number | null>(null);

  const [templates, setTemplates] = useState<PublishingTemplateResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PublishingTemplateResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [publishingModeFilter, setPublishingModeFilter] = useState("All");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "updatedAt", direction: "desc" });
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "publishingMode", "createdBy"]));

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current !== null) {
        window.clearTimeout(navigateTimerRef.current);
      }
    };
  }, []);

  const navigateTo = useCallback((path: string) => {
    setIsSaving(true);
    if (navigateTimerRef.current !== null) {
      window.clearTimeout(navigateTimerRef.current);
    }
    navigateTimerRef.current = window.setTimeout(() => {
      navigate(path);
    }, 150);
  }, [navigate]);

  const loadTemplates = useCallback(async () => {
    const requestId = ++requestSeqRef.current;
    setIsLoading(true);
    try {
      const response = await publishingTemplatesApi.getTemplates({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        publishingMode: publishingModeFilter === "All" ? undefined : publishingModeFilter,
        createdBy: createdByFilter || undefined,
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
        page: currentPage,
        limit: itemsPerPage,
      });

      if (requestId !== requestSeqRef.current) return;

      if (response.pagination.totalPages > 0 && currentPage > response.pagination.totalPages) {
        setCurrentPage(response.pagination.totalPages);
        return;
      }

      setTemplates(response.data || []);
      setTotalItems(response.pagination.total || 0);
      setTotalPages(Math.max(response.pagination.totalPages || 0, 1));
    } catch (error) {
      if (requestId !== requestSeqRef.current) return;
      console.error("Failed to load publishing templates", error);
      setTemplates([]);
      setTotalItems(0);
      setTotalPages(1);
      const message = extractApiMessage(error, "Unable to load publishing templates from server.");
      showToast({ type: "error", title: "Load failed", message });
    } finally {
      if (requestId === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, createdByFilter, debouncedSearch, itemsPerPage, publishingModeFilter, showToast, sortConfig, statusFilter]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const refreshAfterMutation = async () => {
    await loadTemplates();
  };

  const handleDuplicate = async (id: string) => {
    setIsSaving(true);
    try {
      await publishingTemplatesApi.duplicateTemplate(id);
      await refreshAfterMutation();
      showToast({ type: "success", title: "Duplicated", message: "Publishing template duplicated." });
    } catch (error) {
      console.error("Failed to duplicate publishing template", error);
      showToast({ type: "error", title: "Duplicate failed", message: "Unable to duplicate publishing template." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    setIsSaving(true);
    try {
      await publishingTemplatesApi.toggleStatus(id);
      await refreshAfterMutation();
      showToast({ type: "success", title: "Status updated", message: "Publishing template status updated." });
    } catch (error) {
      console.error("Failed to toggle publishing template status", error);
      showToast({ type: "error", title: "Update failed", message: "Unable to update publishing template status." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      await publishingTemplatesApi.deleteTemplate(id);
      await refreshAfterMutation();
      showToast({ type: "success", title: "Deleted", message: "Publishing template deleted." });
    } catch (error) {
      console.error("Failed to delete publishing template", error);
      showToast({ type: "error", title: "Delete failed", message: "Unable to delete publishing template." });
    } finally {
      setIsSaving(false);
      setDeleteTarget(null);
    }
  };

  const handlePublish = async (id: string) => {
    setIsSaving(true);
    try {
      await publishingTemplatesApi.publishTemplate(id, "Publishing template published from admin screen");
      await refreshAfterMutation();
      showToast({ type: "success", title: "Published", message: "Publishing template published." });
    } catch (error) {
      console.error("Failed to publish publishing template", error);
      showToast({ type: "error", title: "Publish failed", message: "Unable to publish publishing template." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setPublishingModeFilter("All");
    setCreatedByFilter("");
    setCurrentPage(1);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  const isInitialLoading = isLoading && templates.length === 0;
  const isTableLoading = isLoading && templates.length > 0;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const tableSummary = useMemo(() => {
    if (isLoading && templates.length === 0) return "Loading templates...";
    return `${totalItems} publishing template${totalItems === 1 ? "" : "s"}`;
  }, [isLoading, templates.length, totalItems]);

  return (
    <div className="flex h-full flex-col gap-4 md:gap-6">
      {(isInitialLoading || isSaving) && (
        <FullPageLoading text={isSaving ? "Saving publishing template..." : "Loading publishing templates..."} />
      )}

      <AlertModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && void handleDelete(deleteTarget.id || "")}
        title="Delete Publishing Template"
        description={`Are you sure you want to delete "${deleteTarget?.templateName || "this template"}"? This action cannot be undone.`}
        confirmText="Delete"
        type="warning"
      />

      <PageHeader
        title="Publishing Templates"
        breadcrumbItems={publishingTemplatesBreadcrumbs()}
        actions={
          canManageTemplates ? (
            <Button size="sm" onClick={() => navigateTo(ROUTES.SETTINGS.PUBLISHING_TEMPLATES_NEW)} className="gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              New Publishing Template
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <div className="mb-4">
            {/* Mobile: search + filter button */}
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-0">
              <label className="text-xs font-medium text-slate-700 block sm:text-sm">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                    placeholder="Search name, description, type..."
                    className="block h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="whitespace-nowrap gap-2 h-10"
                >
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            {/* Desktop: full filter grid */}
            <div className="hidden md:grid grid-cols-1 gap-4 items-end md:grid-cols-2 xl:grid-cols-3">
              {/* Search */}
              <div className="w-full">
                <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Search</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                    placeholder="Search name, description, type..."
                    className="block h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="w-full">
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(value) => { setStatusFilter(String(value)); setCurrentPage(1); }}
                  options={STATUS_OPTIONS}
                />
              </div>

              {/* Publishing Mode */}
              <div className="w-full">
                <Select
                  label="Publishing Mode"
                  value={publishingModeFilter}
                  onChange={(value) => { setPublishingModeFilter(String(value)); setCurrentPage(1); }}
                  options={PUBLISHING_MODE_OPTIONS}
                />
              </div>

              {/* Created By */}
              <div className="w-full">
                <Select
                  label="Created By"
                  value={createdByFilter}
                  onChange={(value) => { setCreatedByFilter(String(value)); setCurrentPage(1); }}
                  options={createdByFilter ? [{ label: createdByFilter, value: createdByFilter }] : []}
                  placeholder="Search by creator..."
                  onSearch={async (query) => {
                    const users = await metadataApi.getUsersLookup({ search: query });
                    return users.map((u): SelectOption => ({ label: u.fullName, value: u.fullName }));
                  }}
                  debounceMs={300}
                  minSearchLength={0}
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 gap-2 px-4 font-medium transition-all duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Mobile FilterDrawer */}
            <FilterDrawer
              isOpen={isFilterDrawerOpen}
              onClose={() => setIsFilterDrawerOpen(false)}
              onClear={clearFilters}
              onApply={() => setIsFilterDrawerOpen(false)}
            >
              <FilterAccordionItem
                label="Status"
                isExpanded={expandedSections.has("status")}
                onToggle={() => toggleSection("status")}
              >
                <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-left w-full",
                        statusFilter === opt.value
                          ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
                          : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300"
                      )}
                    >
                      <span className="text-xs">{opt.label}</span>
                      {statusFilter === opt.value && <ChevronDown className="h-4 w-4 text-emerald-500 rotate-[-90deg]" />}
                    </button>
                  ))}
                </div>
              </FilterAccordionItem>

              <FilterAccordionItem
                label="Publishing Mode"
                isExpanded={expandedSections.has("publishingMode")}
                onToggle={() => toggleSection("publishingMode")}
              >
                <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                  {PUBLISHING_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setPublishingModeFilter(opt.value); setCurrentPage(1); }}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-left w-full",
                        publishingModeFilter === opt.value
                          ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
                          : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300"
                      )}
                    >
                      <span className="text-xs">{opt.label}</span>
                      {publishingModeFilter === opt.value && <ChevronDown className="h-4 w-4 text-emerald-500 rotate-[-90deg]" />}
                    </button>
                  ))}
                </div>
              </FilterAccordionItem>
            </FilterDrawer>
          </div>

        <div className="flex-1 flex flex-col relative">
          {isTableLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative">
          <div
            ref={scrollerRef as React.RefObject<HTMLDivElement>}
            className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
            {...dragEvents}
          >
            <table className="w-full min-w-[1500px]">
              <thead className="sticky top-0 z-30">
                <tr>
                  <th className="sticky top-0 z-20 w-16 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-500">
                    No.
                  </th>
                  {tableColumns.map((column) => {
                    const isSorted = sortConfig.key === column.id;
                    return (
                      <th
                        key={column.id}
                        onClick={column.sortable ? () => handleSort(column.id) : undefined}
                        className={cn(
                          "sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors",
                          column.sortable && "cursor-pointer hover:bg-slate-100 hover:text-slate-700",
                          column.id === "action" && "right-0 z-30 text-center shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200",
                          column.className,
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{column.label}</span>
                          {column.sortable && (
                            <div className="flex shrink-0 flex-col text-slate-400">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" && "text-emerald-600")} />
                              <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" && "text-emerald-600")} />
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {!isLoading && templates.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="py-12 text-center">
                      <TableEmptyState
                        title="No Publishing Templates Found"
                        description="No templates match the current filters. Adjust filters or create a new publishing template."
                      />
                    </td>
                  </tr>
                ) : (
                  templates.map((template, index) => (
                    <tr key={template.id} className="group transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-slate-700 sm:text-sm">
                        {startIndex + index + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs sm:text-sm">
                        <button
                          type="button"
                          onClick={() => navigateTo(ROUTES.SETTINGS.PUBLISHING_TEMPLATES_EDIT(template.id || ""))}
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          {template.templateName || "-"}
                        </button>
                        {template.description && (
                          <p className="mt-0.5 max-w-[320px] truncate text-2xs text-slate-500">{template.description}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                        {formatPublishingMode(template.publishingMode)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                        {template.versionNumber ?? 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs sm:text-sm">
                        <Badge color={getStatusColor(template.status)}>{formatStatus(template.status)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                        <span className="font-medium text-slate-900">{configuredFileCount(template)}</span>
                        <span className="ml-1 text-slate-500">files</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700 sm:text-sm">
                        {template.createdBy || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                        {template.updatedAt ? formatDateTimeLong(template.updatedAt) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:text-sm">
                        {template.publishedAt ? formatDateTimeLong(template.publishedAt) : "-"}
                      </td>
                      <td
                        onClick={(event) => event.stopPropagation()}
                        className="sticky right-0 z-30 whitespace-nowrap bg-white px-4 py-3 text-center text-xs shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-slate-200 group-hover:bg-slate-50 sm:text-sm"
                      >
                        {canManageTemplates && (
                          <button
                            ref={getRef(template.id || "")}
                            onClick={(event) => toggle(template.id || "", event)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
                            aria-label="More actions"
                          >
                            <MoreVertical className="h-4 w-4 text-slate-600" />
                          </button>
                        )}
                        <PortalDropdownMenu isOpen={openId === template.id} onClose={close} position={position}>
                          <div className="py-1">
                            <DropdownMenuItem
                              icon={<IconPencilMinus className="h-4 w-4" />}
                              onClick={() => {
                                navigateTo(ROUTES.SETTINGS.PUBLISHING_TEMPLATES_EDIT(template.id || ""));
                                close();
                              }}
                            >
                              Edit Template
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              icon={<Copy className="h-4 w-4" />}
                              onClick={() => {
                                void handleDuplicate(template.id || "");
                                close();
                              }}
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              icon={<ToggleLeft className="h-4 w-4" />}
                              onClick={() => {
                                void handleToggle(template.id || "");
                                close();
                              }}
                            >
                              Change Status
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              icon={<IconBrandTelegram className="h-4 w-4" />}
                              onClick={() => {
                                void handlePublish(template.id || "");
                                close();
                              }}
                            >
                              Publish Template
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => {
                                setDeleteTarget(template);
                                close();
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
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
                isLoading={isLoading}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
          )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
