import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, MoreVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { knowledgeComponents } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast";
import { useDebounce, usePortalDropdown, useTableDragScroll } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { knowledgeApi, type KnowledgeComponent } from "@/services/api/knowledge";
import { formatDateTime } from "@/utils/format";

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "sourceField", label: "Source Field" },
  { key: "usedByHierarchies", label: "Used By" },
  { key: "active", label: "Status" },
  { key: "updatedAt", label: "Last Updated" },
  { key: "updatedBy", label: "Updated By" },
] as const;

const STATUS_OPTIONS = [
  { label: "All Status", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

const menuItemClass = "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors";
const menuItemDisabledClass = "opacity-50 cursor-not-allowed hover:bg-transparent";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ??
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  fallback;

export const KnowledgeComponentsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.knowledge_categories.manage");
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const [rows, setRows] = useState<KnowledgeComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("ALL");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeComponent | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "updated"]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await knowledgeApi.listComponents({
        page, limit: pageSize, search: debouncedSearch || undefined, status: status === "ALL" ? undefined : status,
        updatedFrom: updatedFrom || undefined, updatedTo: updatedTo || undefined, sortBy: sortKey, sortDir,
      });
      setRows(result.data);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to load the components.") });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, status, updatedFrom, updatedTo, sortKey, sortDir, showToast]);

  useEffect(() => { void load(); }, [load]);

  const hasFilters = Boolean(search) || status !== "ALL" || Boolean(updatedFrom) || Boolean(updatedTo);
  const clearFilters = () => { setSearch(""); setStatus("ALL"); setUpdatedFrom(""); setUpdatedTo(""); setPage(1); };
  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };
  const toggleSection = (section: string) =>
    setExpandedSections((prev) => { const next = new Set(prev); if (next.has(section)) next.delete(section); else next.add(section); return next; });
  const optionClass = (active: boolean) =>
    cn("w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50");

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await knowledgeApi.deleteComponent(deleteTarget.id);
      showToast({ type: "success", title: "Component deleted", message: `"${deleteTarget.name}" was deleted.` });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      setDeleteTarget(null);
      showToast({ type: "error", title: "Could not delete", message: errorMessage(error, "Unable to delete the component.") });
    }
  };

  const menuRow = useMemo(() => rows.find((row) => row.id === openId), [rows, openId]);
  const deleteBlockedReason = (row: KnowledgeComponent) =>
    row.systemDefined ? "A system-defined component cannot be deleted" : row.usedByHierarchies > 0 ? "This component is used by a hierarchy" : undefined;

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Knowledge Category Components"
        breadcrumbItems={knowledgeComponents(navigate)}
        actions={canManage ? (
          <Button size="sm" className="flex items-center gap-2 whitespace-nowrap" onClick={() => navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_COMPONENTS_NEW)}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        ) : undefined}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                  <input
                    type="text" placeholder="Search by name, source or description..." value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {search && (
                    <button onClick={() => { setSearch(""); setPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"><X className="h-4 w-4" /></button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors">Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-400" /></div>
                  <input
                    type="text" placeholder="Search by name, source or description..." value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {search && (
                    <button onClick={() => { setSearch(""); setPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"><X className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
              <Select label="Status" value={status} onChange={(value) => { setStatus(String(value)); setPage(1); }} options={STATUS_OPTIONS} />
              <DateRangePicker
                label="Last Updated Range" startDate={updatedFrom} endDate={updatedTo}
                onStartDateChange={(value) => { setUpdatedFrom(value); setPage(1); }}
                onEndDateChange={(value) => { setUpdatedTo(value); setPage(1); }}
                placeholder="Select date range" autoApply
              />
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap disabled:opacity-40">
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}
          <div className={cn("border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300", loading && "blur-[2px] opacity-80")}>
            {rows.length > 0 ? (
              <>
                <div ref={scrollerRef}
                  className={cn("flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                  {...dragEvents}>
                  <table className="w-full min-w-max border-spacing-0 text-left">
                    <thead className="sticky top-0 z-30">
                      <tr>
                        <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-center">No.</th>
                        {COLUMNS.map((col) => {
                          const isSorted = sortKey === col.key;
                          return (
                            <th key={col.key} onClick={() => handleSort(col.key)}
                              className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors cursor-pointer hover:bg-slate-100 hover:text-slate-700 group">
                              <div className="flex items-center justify-between gap-2 w-full">
                                <span className="truncate">{col.label}</span>
                                <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                  <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortDir === "asc" ? "text-emerald-600" : "")} />
                                  <ChevronDown className={cn("h-3 w-3", isSorted && sortDir === "desc" ? "text-emerald-600" : "")} />
                                </div>
                              </div>
                            </th>
                          );
                        })}
                        <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap text-center before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {rows.map((row, index) => {
                        const tdClass = "py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap";
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className={cn(tdClass, "text-center")}><span className="text-slate-500 font-medium">{(page - 1) * pageSize + index + 1}</span></td>
                            <td className={tdClass}>
                              <span className="font-medium text-emerald-600 cursor-pointer hover:underline" onClick={() => navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_COMPONENTS_EDIT(row.id))}>{row.name}</span>
                              {row.systemDefined && <Badge size="sm" color="blue" className="ml-2">System</Badge>}
                              {row.description && <div className="text-xs text-slate-500 max-w-md truncate" title={row.description}>{row.description}</div>}
                            </td>
                            <td className={tdClass}>{row.sourceLabel}</td>
                            <td className={tdClass}>{row.usedByHierarchies} {row.usedByHierarchies === 1 ? "hierarchy" : "hierarchies"}</td>
                            <td className={tdClass}><Badge size="sm" color={row.active ? "emerald" : "slate"} pill>{row.active ? "Active" : "Inactive"}</Badge></td>
                            <td className={tdClass}>{row.updatedAt ? formatDateTime(row.updatedAt) : "-"}</td>
                            <td className={tdClass}>{row.updatedByName || "-"}</td>
                            <td onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-white py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors">
                              <button ref={getRef(row.id)} onClick={(e) => toggle(row.id, e, { menuWidth: 220, menuHeight: 120 })}
                                className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
                                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination currentPage={page} totalPages={totalPages} totalItems={total} itemsPerPage={pageSize}
                  onPageChange={setPage} onItemsPerPageChange={(value) => { setPageSize(value); setPage(1); }} showItemCount />
              </>
            ) : (
              <TableEmptyState title="No Components Found" description="We couldn't find any components matching your filters. Try adjusting your search criteria." />
            )}
          </div>
        </div>
      </div>

      {menuRow && (
        <PortalDropdownMenu isOpen onClose={close} position={position} minWidth={220}>
          <div className="py-1 whitespace-nowrap">
            <button onClick={() => { close(); navigate(ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_COMPONENTS_EDIT(menuRow.id)); }} className={menuItemClass}>
              <Pencil className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium text-slate-500">{canManage ? "Edit Component" : "View Component"}</span>
            </button>
            {canManage && (
              <button
                onClick={() => { if (deleteBlockedReason(menuRow)) return; close(); setDeleteTarget(menuRow); }}
                disabled={Boolean(deleteBlockedReason(menuRow))}
                title={deleteBlockedReason(menuRow)}
                className={cn(menuItemClass, deleteBlockedReason(menuRow) && menuItemDisabledClass)}>
                <Trash2 className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-slate-500">Delete Component</span>
              </button>
            )}
          </div>
        </PortalDropdownMenu>
      )}

      <AlertModal
        isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} type="warning"
        title="Delete Component"
        description={`Delete "${deleteTarget?.name ?? ""}"? This is recorded in the Audit Trail and cannot be undone.`}
        confirmText="Yes, Delete" cancelText="Cancel" showCancel
      />

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => { setStatus(opt.value); setPage(1); }} className={optionClass(status === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {status === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Last Updated Range" isExpanded={expandedSections.has("updated")} onToggle={() => toggleSection("updated")}>
          <div className="pt-2 pb-4">
            <DateRangePicker label="" startDate={updatedFrom} endDate={updatedTo}
              onStartDateChange={(value) => { setUpdatedFrom(value); setPage(1); }}
              onEndDateChange={(value) => { setUpdatedTo(value); setPage(1); }}
              placeholder="Select date range" autoApply />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
