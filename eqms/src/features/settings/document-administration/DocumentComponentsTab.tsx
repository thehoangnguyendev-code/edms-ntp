import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  MoreVertical,
  Power,
  PowerOff,
  Puzzle,
  Search,
  X,
} from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";
import { documentNameFormatApi } from "@/services/api";
import { usePortalDropdown } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { useDictionaryServerTable } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import type { DocumentComponentItem } from "./documentNameFormatTypes";

export const DocumentComponentsTab: React.FC = () => {
  const navigate = useNavigate();
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.name_formats.manage");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DocumentComponentItem | null>(null);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status"]));
  const { showToast } = useToast();

  const {
    searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload,
  } = useDictionaryServerTable<DocumentComponentItem>({
    fetcher: documentNameFormatApi.getComponentsPage,
    defaultSortBy: "displayOrder",
    extraParams: { status: statusFilter },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, setCurrentPage]);

  const goToEdit = (id: string) => navigate(ROUTES.DOCUMENTS.ADMIN.DOCUMENT_COMPONENTS_EDIT(id));

  const handleConfirmToggleStatus = async () => {
    const item = selectedItem;
    if (!item) return;
    setIsSubmitting(true);
    try {
      const updated = await documentNameFormatApi.updateComponent(item.id, {
        name: item.name,
        shortDescription: item.shortDescription || "",
        freeText: item.freeText || "",
        isActive: !item.isActive,
        displayOrder: item.displayOrder,
      });
      setShowToggleModal(false);
      reload();
      showToast({
        type: "success",
        title: updated.isActive ? "Component Activated" : "Component Deactivated",
        message: `"${updated.name}" was ${updated.isActive ? "activated" : "deactivated"} successfully.`,
      });
    } catch (error) {
      setShowToggleModal(false);
      showToast({ type: "error", title: "Status Update Failed", message: extractApiMessage(error, "Unable to update component status.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setCurrentPage(1);
  };
  const hasActiveFilters = searchQuery.length > 0 || statusFilter !== "All";

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
    );

  return (
    <div className="flex-1 flex flex-col gap-4 md:gap-5 min-h-0">
      <div className="bg-white w-full">
        <div className="flex md:hidden flex-col gap-1.5 w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
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

        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
          <div className="sm:col-span-1 lg:col-span-6">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="sm:col-span-1 lg:col-span-6">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value as "All" | "Active" | "Inactive"); setCurrentPage(1); }}
              options={[{ label: "All Status", value: "All" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]}
              placeholder="All Status"
            />
          </div>
        </div>

        <div className="hidden md:flex justify-start mt-3">
          <Button size="sm" variant="outline" onClick={clearFilters} disabled={!hasActiveFilters} className="gap-2">
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">No.</th>
                {[
                  { label: "Name", id: "name" },
                  { label: "Value (Token)", id: "value" },
                  { label: "Short Description", id: "shortDescription" },
                  { label: "Source", id: "sourceTable" },
                  { label: "Status", id: "isActive" },
                  { label: "Order", id: "displayOrder" },
                ].map((col) => {
                  const isSorted = sortConfig.key === col.id;
                  return (
                    <th
                      key={col.id}
                      onClick={() => handleSort(col.id)}
                      className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">{col.label}</span>
                        <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                          <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600 font-bold" : "")} />
                          <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600 font-bold" : "")} />
                        </div>
                      </div>
                    </th>
                  );
                })}
                <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <tr><td colSpan={8} className="py-14 text-center text-slate-500">Loading document components...</td></tr>
              ) : items.length > 0 ? (
                items.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => goToEdit(item.id)}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 text-center">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-900">{item.name}</span>
                        {item.systemDefined && (
                          <span title="System-defined — Table/Field mapping is fixed by the backend, cannot be edited">
                            <Lock className="h-3 w-3 text-slate-400" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <code className="text-2xs sm:text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{"{{" + item.value + "}}"}</code>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-slate-600 max-w-xs truncate">{item.shortDescription || "-"}</td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <Badge color={item.sourceTable === "FREE_TEXT" ? "sky" : "emerald"} size="sm">
                        {item.sourceTable === "FREE_TEXT" ? "Free Text" : item.sourceTable}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      {item.isActive ? <Badge color="emerald" size="sm">Active</Badge> : <Badge color="slate" size="sm">Inactive</Badge>}
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{item.displayOrder}</td>
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="sticky right-0 bg-white py-3 px-4 text-xs sm:text-sm text-center z-30 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                    >
                      {canManage && (
                        <button
                          ref={getButtonRef(item.id)}
                          onClick={(e) => handleDropdownToggle(item.id, e)}
                          className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-0">
                    <TableEmptyState title="No items found" description="Try adjusting your search" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalItems > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      <PortalDropdownMenu isOpen={!!openDropdownId} onClose={closeDropdown} position={dropdownPosition}>
        <div className="py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (openDropdownId) goToEdit(openDropdownId);
              closeDropdown();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconPencilMinus className="h-3.5 w-3.5" />
            <span>Edit Component</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((current) => current.id === openDropdownId);
              if (item) { setSelectedItem(item); setShowToggleModal(true); }
              closeDropdown();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {items.find((current) => current.id === openDropdownId)?.isActive
              ? (<><PowerOff className="h-3.5 w-3.5" /><span>Disable</span></>)
              : (<><Power className="h-3.5 w-3.5" /><span>Enable</span></>)}
          </button>
        </div>
      </PortalDropdownMenu>

      <AlertModal
        isOpen={showToggleModal}
        onClose={() => { setShowToggleModal(false); setSelectedItem(null); }}
        onConfirm={handleConfirmToggleStatus}
        type="warning"
        title={`${selectedItem?.isActive ? "Deactivate" : "Activate"} Document Component?`}
        description={
          <div className="space-y-3">
            <p>Are you sure you want to {selectedItem?.isActive ? "deactivate" : "activate"} <strong>{selectedItem?.name}</strong>?</p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">Warning:</span> Deactivating a component removes it from any Document Name Format that still references it the next time that format is edited.
              </p>
            </div>
          </div>
        }
        confirmText={selectedItem?.isActive ? "Deactivate" : "Activate"}
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel
      />

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Status", value: "All" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value as "All" | "Active" | "Inactive"); setCurrentPage(1); }}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
