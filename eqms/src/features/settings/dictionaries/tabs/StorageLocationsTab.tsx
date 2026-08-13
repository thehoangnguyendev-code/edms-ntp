import React, { useEffect, useState } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  MoreVertical,
  Power,
  PowerOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { cn } from "@/components/ui/utils";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";
import { dictionaryApi } from "@/services/api";
import { usePortalDropdown } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";
import { extractApiMessage } from "../utils";
import type { StorageLocationItem } from "../types";
import { useDictionaryServerTable } from "../hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";

type ResultModalState = {
  isOpen: boolean;
  type: "success" | "error";
  title: string;
  description: string;
};

type StorageLocationFormData = {
  name: string;
  description: string;
  isActive: boolean;
};

export const StorageLocationsTab = React.forwardRef<{ openAddModal: () => void }, {}>((_, ref) => {
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.dictionary.manage");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StorageLocationItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [modifiedFromDate, setModifiedFromDate] = useState("");
  const [modifiedToDate, setModifiedToDate] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "date"]));
  const [resultModal, setResultModal] = useState<ResultModalState>({
    isOpen: false,
    type: "success",
    title: "",
    description: "",
  });
  const { showToast } = useToast();
  const { t } = useTranslation();

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    totalItems,
    items,
    isLoading,
    sortConfig,
    handleSort,
    reload,
  } = useDictionaryServerTable<StorageLocationItem>({
    fetcher: dictionaryApi.getStorageLocationsPage,
    defaultSortBy: "name",
    extraParams: {
      status: statusFilter,
      modifiedFrom: modifiedFromDate || undefined,
      modifiedTo: modifiedToDate || undefined,
    },
  });

  React.useImperativeHandle(ref, () => ({
    openAddModal: () => setShowAddModal(true),
  }));

  const openResultModal = (type: ResultModalState["type"], title: string, description: string) => {
    setResultModal({ isOpen: true, type, title, description });
  };
  const closeResultModal = () => setResultModal((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, modifiedFromDate, modifiedToDate, setCurrentPage]);

  const handleSave = async (payload: StorageLocationFormData) => {
      try {
        let saved;
        if (showEditModal && selectedItem) {
        saved = await dictionaryApi.updateStorageLocation(selectedItem.id, payload);
      } else {
        saved = await dictionaryApi.createStorageLocation(payload);
      }

      openResultModal(
        "success",
        showEditModal ? "Storage Location Updated" : "Storage Location Created",
        `Storage location "${saved.name}" has been ${showEditModal ? "updated" : "created"} successfully.`
      );
      reload();
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedItem(null);
    } catch (error) {
      openResultModal(
        "error",
        showEditModal ? "Storage Location Update Failed" : "Storage Location Create Failed",
        extractApiMessage(error, showEditModal ? "Unable to update storage location." : "Unable to create storage location.")
      );
      throw error;
    }
  };

  const handleRequestToggleStatus = (item: StorageLocationItem) => {
    setSelectedItem(item);
    setShowToggleModal(true);
    closeDropdown();
  };

  const handleConfirmToggleStatus = async () => {
    const item = selectedItem;
    if (!item) return;
    setIsSubmitting(true);
    try {
      const updated = await dictionaryApi.updateStorageLocation(item.id, {
        name: item.name,
        description: item.description,
        isActive: !item.isActive,
      });
      setShowToggleModal(false);
      reload();
      showToast({
        type: "success",
        title: updated.isActive ? t("storageLocations.activated.title") : t("storageLocations.deactivated.title"),
        message: updated.isActive ? t("storageLocations.activated.message", { name: updated.name }) : t("storageLocations.deactivated.message", { name: updated.name }),
      });
    } catch (error) {
      setShowToggleModal(false);
      showToast({
        type: "error",
        title: t("storageLocations.statusFailed.title"),
        message: extractApiMessage(error, t("storageLocations.statusFailed.message")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (item: StorageLocationItem) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
    closeDropdown();
  };

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await dictionaryApi.deleteStorageLocation(selectedItem.id);
      setShowDeleteModal(false);
      reload();
      showToast({
        type: "success",
        title: t("storageLocations.deleted.title"),
        message: t("storageLocations.deleted.message", { name: selectedItem.name }),
      });
      setSelectedItem(null);
    } catch (error) {
      setShowDeleteModal(false);
      showToast({
        type: "error",
        title: t("storageLocations.deleteFailed.title"),
        message: extractApiMessage(error, t("storageLocations.deleteFailed.message")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setModifiedFromDate("");
    setModifiedToDate("");
    setCurrentPage(1);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
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
                placeholder="Search storage locations..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                >
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

        <div className="hidden md:flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="w-full">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search storage locations..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="w-full">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value as "All" | "Active" | "Inactive");
                  setCurrentPage(1);
                }}
                options={[
                  { label: "All Status", value: "All" },
                  { label: "Active", value: "Active" },
                  { label: "Inactive", value: "Inactive" },
                ]}
                placeholder="All Status"
              />
            </div>
            <div className="w-full">
              <DateRangePicker
                label="Modified Date Range"
                startDate={modifiedFromDate}
                endDate={modifiedToDate}
                onStartDateChange={(v) => {
                  setModifiedFromDate(v);
                  setCurrentPage(1);
                }}
                onEndDateChange={(v) => {
                  setModifiedToDate(v);
                  setCurrentPage(1);
                }}
                placeholder="Select range"
              />
            </div>
          </div>
          <div className="flex justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">No.</th>
                {[
                  { label: "Storage Location Name", id: "name" },
                  { label: "Description", id: "description" },
                  { label: "Status", id: "isActive" },
                  { label: "Modified Date", id: "modifiedDate" },
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
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">Loading storage locations...</td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 text-center">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <span className="font-medium text-slate-900">{item.name}</span>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-slate-600 max-w-md truncate">{item.description || "-"}</td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      {item.isActive ? (
                        <Badge color="emerald" size="sm" showDot pill>Active</Badge>
                      ) : (
                        <Badge color="slate" size="sm" showDot pill>Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{item.modifiedDate}</td>
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
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <div className="bg-slate-50 p-4 rounded-full mb-3">
                        <MapPin className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-900">No storage locations found</p>
                      <p className="text-sm mt-1">Try adjusting your search</p>
                    </div>
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
              const item = items.find((current) => current.id === openDropdownId);
              if (item) setSelectedItem(item);
              setShowEditModal(true);
              closeDropdown();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconPencilMinus className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((current) => current.id === openDropdownId);
              if (item) handleRequestToggleStatus(item);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {items.find((current) => current.id === openDropdownId)?.isActive ? (
              <>
                <PowerOff className="h-3.5 w-3.5" />
                <span>Disable</span>
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5" />
                <span>Enable</span>
              </>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((current) => current.id === openDropdownId);
              if (item) handleDelete(item);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </PortalDropdownMenu>

      <StorageLocationModal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        isEdit={showEditModal}
        onSave={handleSave}
      />

      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleConfirmDelete}
        type="warning"
        title="Delete Storage Location?"
        description={
          <div className="space-y-3">
            <p>Are you sure you want to delete <strong>{selectedItem?.name}</strong>?</p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">Warning:</span> This action cannot be undone.
              </p>
            </div>
          </div>
        }
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel
      />

      <AlertModal
        isOpen={showToggleModal}
        onClose={() => {
          setShowToggleModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleConfirmToggleStatus}
        type="warning"
        title={`${selectedItem?.isActive ? "Deactivate" : "Activate"} Storage Location?`}
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to {selectedItem?.isActive ? "deactivate" : "activate"}{" "}
              <strong>{selectedItem?.name}</strong>?
            </p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">Warning:</span> This change will take effect immediately.
              </p>
            </div>
          </div>
        }
        confirmText={selectedItem?.isActive ? "Deactivate" : "Activate"}
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel
      />

      <AlertModal
        isOpen={resultModal.isOpen}
        onClose={closeResultModal}
        title={resultModal.title}
        description={resultModal.description}
        type={resultModal.type}
        confirmText="OK"
        showCancel={false}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Status", value: "All" },
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(opt.value as "All" | "Active" | "Inactive");
                  setCurrentPage(1);
                }}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Modified Date Range" isExpanded={expandedSections.has("date")} onToggle={() => toggleSection("date")}>
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={modifiedFromDate}
              endDate={modifiedToDate}
              onStartDateChange={(v) => {
                setModifiedFromDate(v);
                setCurrentPage(1);
              }}
              onEndDateChange={(v) => {
                setModifiedToDate(v);
                setCurrentPage(1);
              }}
              placeholder="Select range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
});

interface StorageLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: StorageLocationItem | null;
  isEdit: boolean;
  onSave: (data: StorageLocationFormData) => Promise<void>;
}

const StorageLocationModal: React.FC<StorageLocationModalProps> = ({ isOpen, onClose, item, isEdit, onSave }) => {
  const [formData, setFormData] = useState<StorageLocationFormData>({
    name: item?.name || "",
    description: item?.description || "",
    isActive: item?.isActive ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || "",
        isActive: item.isActive,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        isActive: true,
      });
    }
  }, [item, isOpen]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onConfirm={handleSubmit} title={`${isEdit ? "Edit" : "Add New"} Storage Location`} isLoading={isSaving} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Storage Location Name<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter storage location name"
            required
            disabled={isSaving}
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter description (optional)"
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="isActive storage-loc"
            checked={formData.isActive}
            onChange={(checked) => setFormData({ ...formData, isActive: checked })}
            label="Active"
            disabled={isSaving}
          />
        </div>
      </div>
    </FormModal>
  );
};
