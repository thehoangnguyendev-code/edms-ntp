import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import {
  Trash2, MoreVertical, GraduationCap, Power, PowerOff, Search, AlertTriangle,
  ChevronUp, ChevronDown, Check, X, Plus,
} from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { educationDegreeLevels as educationDegreeLevelsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import type { EducationDegreeLevelItem } from "./types";
import { usePortalDropdown } from "@/hooks";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";
import { educationApi } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { extractApiMessage } from "../shared/utils";
import { useServerTable } from "../shared/hooks/useServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

/** Application Settings > Education > Degree Levels -- its own page, not part of "Dictionaries". */
export const EducationDegreeLevelsView: React.FC = () => {
  const { scrollerRef, dragEvents } = useTableDragScroll();
  const navigate = useNavigate();
  const [resultModal, setResultModal] = useState<{ isOpen: boolean; type: "success" | "error"; title: string; description: string }>({
    isOpen: false, type: "success", title: "", description: "",
  });
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [modifiedFrom, setModifiedFrom] = useState("");
  const [modifiedTo, setModifiedTo] = useState("");
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.education.degree_level.manage");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "modifiedDate"]));
  const [selectedItem, setSelectedItem] = useState<EducationDegreeLevelItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const {
    searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload,
  } = useServerTable<EducationDegreeLevelItem>({
    fetcher: educationApi.degreeLevels.page,
    defaultSortBy: "displayOrder",
    extraParams: { status: statusFilter, modifiedFrom: modifiedFrom || undefined, modifiedTo: modifiedTo || undefined },
  });

  const openResultModal = (type: "success" | "error", title: string, description: string) => setResultModal({ isOpen: true, type, title, description });
  const closeResultModal = () => setResultModal((prev) => ({ ...prev, isOpen: false }));

  React.useEffect(() => { setCurrentPage(1); }, [statusFilter, modifiedFrom, modifiedTo, setCurrentPage]);

  const handleEdit = (item: EducationDegreeLevelItem) => { setSelectedItem(item); setShowEditModal(true); closeDropdown(); };
  const handleDelete = (item: EducationDegreeLevelItem) => { setSelectedItem(item); setShowDeleteModal(true); closeDropdown(); };
  const handleRequestToggleStatus = (item: EducationDegreeLevelItem) => { setSelectedItem(item); setShowToggleModal(true); closeDropdown(); };

  const handleConfirmToggleStatus = () => {
    const item = selectedItem;
    if (!item) return;
    setIsSubmitting(true);
    educationApi.degreeLevels.update(item.id, { name: item.name, displayOrder: item.displayOrder, isActive: !item.isActive })
      .then((updated) => {
        setShowToggleModal(false);
        reload();
        showToast({ type: "success", title: updated.isActive ? "Degree Level Activated" : "Degree Level Deactivated", message: `"${updated.name}" was ${updated.isActive ? "activated" : "deactivated"} successfully.` });
      })
      .catch((error) => {
        setShowToggleModal(false);
        showToast({ type: "error", title: "Status Update Failed", message: extractApiMessage(error, "Unable to update degree level status.") });
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      if (selectedItem) {
        await educationApi.degreeLevels.remove(selectedItem.id);
        reload();
        showToast({ type: "success", title: "Degree Level Deleted", message: `"${selectedItem.name}" has been deleted successfully.` });
      }
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (error) {
      showToast({ type: "error", title: "Delete Failed", message: extractApiMessage(error, "Unable to delete degree level.") });
      setShowDeleteModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => { setSearchQuery(""); setStatusFilter("All"); setModifiedFrom(""); setModifiedTo(""); setCurrentPage(1); };
  const toApiDate = (value: string) => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  };
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };
  const getOptionClassName = (isActive: boolean) =>
    cn("w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50");

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Degree Levels"
        breadcrumbItems={educationDegreeLevelsBreadcrumb(navigate)}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Add New Degree Level
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col flex-1">
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search degree levels..." value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                <IconFilter2 className="h-4 w-4" />Filters
              </Button>
            </div>
          </div>

          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="Search degree levels..." value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
              </div>
              <div className="w-full">
                <Select label="Status" value={statusFilter}
                  onChange={(value) => { setStatusFilter(value as "All" | "Active" | "Inactive"); setCurrentPage(1); }}
                  options={[{ label: "All Status", value: "All" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]}
                  placeholder="All Status" />
              </div>
              <DateRangePicker label="Modified Date Range" startDate={modifiedFrom} endDate={modifiedTo}
                onStartDateChange={(value) => setModifiedFrom(toApiDate(value))}
                onEndDateChange={(value) => setModifiedTo(toApiDate(value))}
                onApply={({ startDate, endDate }) => { setModifiedFrom(toApiDate(startDate)); setModifiedTo(toApiDate(endDate)); }}
                placeholder="Select date range" />
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap">Clear Filters</Button>
            </div>
          </div>
        </div>
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[4px]">
              <SectionLoading text={searchQuery ? "Searching..." : "Loading degree levels..."} minHeight="150px" />
            </div>
          )}
        <div className={cn("flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white flex flex-col transition-all duration-300", isLoading && "blur-[2px] opacity-80")}>
          <div ref={scrollerRef} {...dragEvents} className="flex-1 overflow-x-auto">
            <TableMarkup.Root className="w-full">
              <TableMarkup.Head className="sticky top-0 z-30">
                <TableMarkup.Row>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell35}>No.</TableMarkup.HeaderCell>
                  {[
                    { label: "Degree / Qualification Level", id: "name" },
                    { label: "Order", id: "displayOrder" },
                    { label: "Status", id: "isActive" },
                    { label: "Modified Date", id: "modifiedDate" },
                  ].map((col) => {
                    const isSorted = sortConfig.key === col.id;
                    return (
                      <TableMarkup.HeaderCell key={col.id} onClick={() => handleSort(col.id)}
                        className={TABLE_STYLES.headerCell38}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{col.label}</span>
                          <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                            <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600 font-bold" : "")} />
                            <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600 font-bold" : "")} />
                          </div>
                        </div>
                      </TableMarkup.HeaderCell>
                    );
                  })}
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell26}>Action</TableMarkup.HeaderCell>
                </TableMarkup.Row>
              </TableMarkup.Head>
              <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                {isLoading ? (
                  <TableMarkup.Row><TableMarkup.Cell colSpan={6} className="py-14 text-center text-slate-500">Loading degree levels...</TableMarkup.Cell></TableMarkup.Row>
                ) : items.length > 0 ? (
                  items.map((item, index) => (
                    <TableMarkup.Row key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      <TableMarkup.Cell className={TABLE_STYLES.cell30}>{(currentPage - 1) * itemsPerPage + index + 1}</TableMarkup.Cell>
                      <TableMarkup.Cell className={TABLE_STYLES.cell28}>{item.name}</TableMarkup.Cell>
                      <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{item.displayOrder}</TableMarkup.Cell>
                      <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                        {item.isActive ? <Badge color="emerald" size="sm">Active</Badge> : <Badge color="slate" size="sm">Inactive</Badge>}
                      </TableMarkup.Cell>
                      <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{item.modifiedDate}</TableMarkup.Cell>
                      <TableMarkup.Cell onClick={(e) => e.stopPropagation()} className={TABLE_STYLES.emptyCell3}>
                        {canManage && (
                          <button ref={getButtonRef(item.id)} onClick={(e) => handleDropdownToggle(item.id, e)} className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors" aria-label="More actions">
                            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                          </button>
                        )}
                      </TableMarkup.Cell>
                    </TableMarkup.Row>
                  ))
                ) : (
                  <TableMarkup.Row>
                    <TableMarkup.Cell colSpan={6} className="p-0">
                      <TableEmptyState
                       
                        title="No degree levels found"
                        description="Try adjusting your search"
                      />
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                )}
              </TableMarkup.Body>
            </TableMarkup.Root>
          </div>
          {!isLoading && totalItems > 0 && (
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
          )}
        </div>
      </div>
      </div>

      <PortalDropdownMenu isOpen={openDropdownId !== null} onClose={closeDropdown} position={dropdownPosition} minWidth={180}>
        <div className="py-1">
          <button onClick={(e) => { e.stopPropagation(); const item = items.find((i) => i.id === openDropdownId)!; handleEdit(item); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            <IconPencilMinus className="h-3.5 w-3.5" /><span>Edit Degree Level</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); const item = items.find((i) => i.id === openDropdownId)!; handleRequestToggleStatus(item); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            {items.find((i) => i.id === openDropdownId)?.isActive ? (<><PowerOff className="h-3.5 w-3.5" /><span>Disable</span></>) : (<><Power className="h-3.5 w-3.5" /><span>Enable</span></>)}
          </button>
          <button onClick={(e) => { e.stopPropagation(); const item = items.find((i) => i.id === openDropdownId)!; handleDelete(item); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /><span>Delete</span>
          </button>
        </div>
      </PortalDropdownMenu>

      <DegreeLevelModal
        isOpen={showAddModal || showEditModal}
        onClose={() => { setShowAddModal(false); setShowEditModal(false); setSelectedItem(null); }}
        item={selectedItem}
        isEdit={showEditModal}
        onSave={async (data) => {
          try {
            const saved = showEditModal && selectedItem ? await educationApi.degreeLevels.update(selectedItem.id, data) : await educationApi.degreeLevels.create(data);
            reload();
            openResultModal("success", showEditModal ? "Degree Level Updated" : "Degree Level Created", `"${saved.name}" has been ${showEditModal ? "updated" : "created"} successfully.`);
          } catch (error) {
            openResultModal("error", showEditModal ? "Update Failed" : "Creation Failed", extractApiMessage(error, showEditModal ? "Unable to update degree level." : "Unable to create degree level."));
            throw error;
          }
        }}
      />

      <AlertModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleConfirmDelete} type="warning"
        title="Delete Degree Level?"
        description={
          <div className="space-y-3">
            <p>Are you sure you want to delete <strong>{selectedItem?.name}</strong>?</p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-700"><AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" /> <span className="font-semibold">Warning:</span> This action cannot be undone.</p>
            </div>
          </div>
        }
        confirmText="Delete" cancelText="Cancel" isLoading={isSubmitting} showCancel />

      <AlertModal isOpen={showToggleModal} onClose={() => { setShowToggleModal(false); setSelectedItem(null); }} onConfirm={handleConfirmToggleStatus} type="warning"
        title={`${selectedItem?.isActive ? "Deactivate" : "Activate"} Degree Level?`}
        description={<p>Are you sure you want to {selectedItem?.isActive ? "deactivate" : "activate"} <strong>{selectedItem?.name}</strong>?</p>}
        confirmText={selectedItem?.isActive ? "Deactivate" : "Activate"} cancelText="Cancel" isLoading={isSubmitting} showCancel />

      <AlertModal isOpen={resultModal.isOpen} onClose={closeResultModal} onConfirm={closeResultModal} type={resultModal.type}
        title={resultModal.title} description={resultModal.description} confirmText="OK" showCancel={false} />

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Status", value: "All" }, { label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }].map((opt) => (
              <button key={opt.value} onClick={() => { setStatusFilter(opt.value as "All" | "Active" | "Inactive"); setCurrentPage(1); }} className={getOptionClassName(statusFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
        <FilterAccordionItem label="Modified Date Range" isExpanded={expandedSections.has("modifiedDate")} onToggle={() => toggleSection("modifiedDate")}>
          <div className="pt-2 pb-4">
            <DateRangePicker label="" startDate={modifiedFrom} endDate={modifiedTo}
              onStartDateChange={(value) => setModifiedFrom(toApiDate(value))}
              onEndDateChange={(value) => setModifiedTo(toApiDate(value))}
              onApply={({ startDate, endDate }) => { setModifiedFrom(toApiDate(startDate)); setModifiedTo(toApiDate(endDate)); }}
              placeholder="Select date range" />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};

interface DegreeLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: EducationDegreeLevelItem | null;
  isEdit: boolean;
  onSave: (data: { name: string; displayOrder: number; isActive: boolean }) => Promise<void>;
}

const DegreeLevelModal: React.FC<DegreeLevelModalProps> = ({ isOpen, onClose, item, isEdit, onSave }) => {
  const [formData, setFormData] = useState({ name: item?.name ?? "", displayOrder: item?.displayOrder ?? 0, isActive: item?.isActive ?? true });
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (item) setFormData({ name: item.name, displayOrder: item.displayOrder, isActive: item.isActive });
    else setFormData({ name: "", displayOrder: 0, isActive: true });
  }, [item, isOpen]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to save degree level", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onConfirm={handleSubmit} title={`${isEdit ? "Edit" : "Add New"} Degree Level`} isLoading={isSaving} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Name<span className="text-red-500 ml-1">*</span></label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="e.g., Đại học" required disabled={isSaving} />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Display Order</label>
          <input type="number" value={formData.displayOrder} onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })}
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" disabled={isSaving} />
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="isActive-degreelevel" checked={formData.isActive} onChange={(checked) => setFormData({ ...formData, isActive: checked })} label="Active" disabled={isSaving} />
        </div>
      </div>
    </FormModal>
  );
};
