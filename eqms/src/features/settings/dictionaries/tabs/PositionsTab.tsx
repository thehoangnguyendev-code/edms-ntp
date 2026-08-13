import React, { useState, useMemo } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import {
    Trash2,
    MoreVertical,
    Briefcase,
    Power,
    PowerOff,
    Search,
    AlertTriangle,
    ChevronUp,
    ChevronDown,
    Check,
    X,
} from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { cn } from "@/components/ui/utils";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { TablePagination } from "@/components/ui/table/TablePagination";
import type { PositionItem, BusinessUnit, DepartmentItem } from "../types";
import { usePortalDropdown } from "@/hooks";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import {IconFilter2, IconPencilMinus} from "@tabler/icons-react";
import { dictionaryApi } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";
import { extractApiMessage } from "../utils";
import { useDictionaryServerTable } from "../hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";

const generatePositionAbbreviation = (name: string): string => {
  const letters = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return letters.slice(0, 10) || "POS";
};

export const PositionsTab = React.forwardRef<
  { openAddModal: () => void },
  {}
>((_, ref) => {
  const [resultModal, setResultModal] = useState<{ isOpen: boolean; type: "success" | "error"; title: string; description: string }>({
    isOpen: false,
    type: "success",
    title: "",
    description: "",
  });
  const [businessUnitFilter, setBusinessUnitFilter] = useState<"All" | BusinessUnit>("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [modifiedFromDate, setModifiedFromDate] = useState("");
  const [modifiedToDate, setModifiedToDate] = useState("");
  const {
    openId: openDropdownId,
    position: dropdownPosition,
    getRef: getButtonRef,
    toggle: handleDropdownToggle,
    close: closeDropdown,
  } = usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.dictionary.manage");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["businessUnit", "department", "status", "date"])
  );
  const [selectedItem, setSelectedItem] = useState<PositionItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessUnits, setBusinessUnits] = useState<{ label: string; value: string }[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
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
  } = useDictionaryServerTable<PositionItem>({
    fetcher: dictionaryApi.getPositionsPage,
    defaultSortBy: "name",
    extraParams: {
      businessUnit: businessUnitFilter === "All" ? undefined : businessUnitFilter,
      department: departmentFilter === "All" ? undefined : departmentFilter,
      status: statusFilter,
      modifiedFrom: modifiedFromDate || undefined,
      modifiedTo: modifiedToDate || undefined,
    },
  });

  const openResultModal = (type: "success" | "error", title: string, description: string) => {
    setResultModal({ isOpen: true, type, title, description });
  };

  const closeResultModal = () => setResultModal((prev) => ({ ...prev, isOpen: false }));

  React.useImperativeHandle(ref, () => ({
    openAddModal: () => setShowAddModal(true),
  }));

  const availableDepartments = useMemo(() => {
    const filtered = departments
      .filter((dept) => businessUnitFilter === "All" || dept.businessUnit === businessUnitFilter)
      .map((dept) => dept.name);
    return ["All", ...filtered];
  }, [businessUnitFilter, departments]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [businessUnitFilter, departmentFilter, statusFilter, modifiedFromDate, modifiedToDate, setCurrentPage]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [businessUnitRows, departmentRows] = await Promise.all([
          dictionaryApi.getBusinessUnits(),
          dictionaryApi.getDepartments(),
        ]);
        setBusinessUnits(businessUnitRows.map((unit) => ({ label: unit.name, value: unit.name })));
        setDepartments(departmentRows);
      } catch (error) {
      }
    };

    load();
  }, []);

  // Reset department filter when BU changes
  React.useEffect(() => {
    setDepartmentFilter("All");
  }, [businessUnitFilter]);

  const handleEdit = (item: PositionItem) => {
    setSelectedItem(item);
    setShowEditModal(true);
    closeDropdown();
  };

  const handleDelete = (item: PositionItem) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
    closeDropdown();
  };

  const handleRequestToggleStatus = (item: PositionItem) => {
    setSelectedItem(item);
    setShowToggleModal(true);
    closeDropdown();
  };

  const handleConfirmToggleStatus = () => {
    const item = selectedItem;
    if (!item) return;
    dictionaryApi.updatePosition(item.id, {
      name: item.name,
      abbreviation: item.abbreviation || generatePositionAbbreviation(item.name),
      businessUnit: item.businessUnit,
      department: item.department,
      description: item.description,
      isActive: !item.isActive,
    })
      .then((updated) => {
        setShowToggleModal(false);
        reload();
        showToast({
          type: "success",
        title: updated.isActive ? t("positions.activated.title") : t("positions.deactivated.title"),
        message: updated.isActive ? t("positions.activated.message", { name: updated.name }) : t("positions.deactivated.message", { name: updated.name }),
        });
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.error("Failed to toggle position", error);
        setShowToggleModal(false);
        showToast({
          type: "error",
        title: t("positions.statusFailed.title"),
        message: extractApiMessage(error, t("positions.statusFailed.message")),
        });
      });
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      if (selectedItem) {
        await dictionaryApi.deletePosition(selectedItem.id);
        reload();
        showToast({
          type: "success",
        title: t("positions.deleted.title"),
        message: t("positions.deleted.message", { name: selectedItem.name }),
        });
      }
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to delete position", error);
      showToast({
        type: "error",
        title: t("positions.deleteFailed.title"),
        message: extractApiMessage(error, t("positions.deleteFailed.message")),
      });
      setShowDeleteModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setBusinessUnitFilter("All");
    setDepartmentFilter("All");
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
      {/* Filter Section */}
      <div className="bg-white w-full">
        {/* Mobile */}
        <div className="flex md:hidden flex-col gap-1.5 w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search positions..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
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

        {/* Desktop */}
        <div className="hidden md:grid grid-cols-3 gap-4 items-end">
          <div className="w-full">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search positions..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="w-full">
            <Select
              label="Business Unit"
              value={businessUnitFilter}
              onChange={(value) => { setBusinessUnitFilter(value as "All" | BusinessUnit); setCurrentPage(1); }}
              options={[
                { label: "All Units", value: "All" },
                ...businessUnits,
              ]}
              placeholder="All Business Units"
            />
          </div>

          <div className="w-full">
            <Select
              label="Department"
              value={departmentFilter}
              onChange={(value) => { setDepartmentFilter(value); setCurrentPage(1); }}
              options={availableDepartments.map((d) => ({ label: d === "All" ? "All Departments" : d, value: d }))}
              placeholder="All Departments"
              disabled={businessUnitFilter === "All"}
            />
          </div>

          <div className="w-full">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value as "All" | "Active" | "Inactive"); setCurrentPage(1); }}
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
              onStartDateChange={(v) => { setModifiedFromDate(v); setCurrentPage(1); }}
              onEndDateChange={(v) => { setModifiedToDate(v); setCurrentPage(1); }}
              placeholder="Select range"
            />
          </div>

          <div className="flex items-end">
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

      {/* Table */}
      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">
                  No.
                </th>
                {[
                  { label: "Position Name", id: "name" },
                  { label: "Business Unit", id: "businessUnit" },
                  { label: "Department", id: "department" },
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
                          <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600" : "")} />
                          <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600" : "")} />
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
                  <td colSpan={8} className="py-14 text-center text-slate-500">Loading positions...</td>
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
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <Badge
                        color={
                          item.businessUnit === "Corporate"
                            ? "slate"
                            : item.businessUnit === "Operations"
                            ? "blue"
                            : item.businessUnit === "Quality"
                            ? "emerald"
                            : "cyan"
                        }
                        size="sm"
                      >
                        {item.businessUnit}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <Badge color="blue" size="sm">{item.department}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm text-slate-600 max-w-md truncate">
                      {item.description || "-"}
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      {item.isActive ? (
                        <Badge color="emerald" size="sm" showDot pill>Active</Badge>
                      ) : (
                        <Badge color="slate" size="sm" showDot pill>Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                      {item.modifiedDate}
                    </td>
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
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <div className="bg-slate-50 p-4 rounded-full mb-3">
                        <Briefcase className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-900">No positions found</p>
                      <p className="text-sm mt-1">Try adjusting your search or filters</p>
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

      {/* Portal Dropdown */}
      <PortalDropdownMenu isOpen={openDropdownId !== null} onClose={closeDropdown} position={dropdownPosition} minWidth={180}>
        <div className="py-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(items.find((i) => i.id === openDropdownId)!); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconPencilMinus className="h-3.5 w-3.5" />
            <span>Edit Position</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleRequestToggleStatus(items.find((i) => i.id === openDropdownId)!); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {items.find((i) => i.id === openDropdownId)?.isActive ? (
              <><PowerOff className="h-3.5 w-3.5" /><span>Disable</span></>
            ) : (
              <><Power className="h-3.5 w-3.5" /><span>Enable</span></>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(items.find((i) => i.id === openDropdownId)!); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </PortalDropdownMenu>

      {/* Add / Edit Modal */}
      <PositionModal
        isOpen={showAddModal || showEditModal}
        onClose={() => { setShowAddModal(false); setShowEditModal(false); setSelectedItem(null); }}
        item={selectedItem}
        isEdit={showEditModal}
        businessUnitOptions={businessUnits}
        allDepartments={departments}
        onSave={async (data) => {
          const abbreviation = data.abbreviation || generatePositionAbbreviation(data.name);
          const payload = {
            name: data.name,
            abbreviation,
            businessUnit: data.businessUnit,
            department: data.department,
            description: data.description,
            isActive: data.isActive,
          };
          try {
            const saved = showEditModal && selectedItem
              ? await dictionaryApi.updatePosition(selectedItem.id, payload)
              : await dictionaryApi.createPosition(payload);
            openResultModal(
              "success",
              showEditModal ? "Position Updated" : "Position Created",
              `Position "${saved.name}" has been ${showEditModal ? "updated" : "created"} successfully.`
            );
            reload();
          } catch (error) {
            openResultModal(
              "error",
              showEditModal ? "Position Update Failed" : "Position Creation Failed",
              extractApiMessage(error, showEditModal ? "Unable to update position." : "Unable to create position.")
            );
            throw error;
          }
        }}
      />

      {/* Delete Confirm */}
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        type="warning"
        title="Delete Position?"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to delete{" "}
              <strong>{selectedItem?.name}</strong>?
            </p>
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
        title={`${selectedItem?.isActive ? "Deactivate" : "Activate"} Position?`}
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
        onConfirm={closeResultModal}
        type={resultModal.type}
        title={resultModal.title}
        description={resultModal.description}
        confirmText="OK"
        showCancel={false}
      />

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem label="Business Unit" isExpanded={expandedSections.has("businessUnit")} onToggle={() => toggleSection("businessUnit")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Units", value: "All" },
              ...businessUnits,
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setBusinessUnitFilter(opt.value as "All" | BusinessUnit); setCurrentPage(1); }}
                className={getOptionClassName(businessUnitFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {businessUnitFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Department" isExpanded={expandedSections.has("department")} onToggle={() => toggleSection("department")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {availableDepartments.map((dept) => (
              <button
                key={dept}
                onClick={() => { setDepartmentFilter(dept); setCurrentPage(1); }}
                className={getOptionClassName(departmentFilter === dept)}
              >
                <span className="text-xs">{dept === "All" ? "All Departments" : dept}</span>
                {departmentFilter === dept && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Status", value: "All" },
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
            ].map((opt) => (
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

        <FilterAccordionItem label="Modified Date Range" isExpanded={expandedSections.has("date")} onToggle={() => toggleSection("date")}>
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={modifiedFromDate}
              endDate={modifiedToDate}
              onStartDateChange={(v) => { setModifiedFromDate(v); setCurrentPage(1); }}
              onEndDateChange={(v) => { setModifiedToDate(v); setCurrentPage(1); }}
              placeholder="Select range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
});

// ─── Position Modal ───────────────────────────────────────────────────────────

interface PositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PositionItem | null;
  isEdit: boolean;
  businessUnitOptions: { label: string; value: string }[];
  allDepartments: DepartmentItem[];
  onSave: (data: Omit<PositionItem, "id" | "createdDate" | "modifiedDate">) => Promise<void>;
}

const PositionModal: React.FC<PositionModalProps> = ({ isOpen, onClose, item, isEdit, businessUnitOptions, allDepartments, onSave }) => {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    abbreviation: item?.abbreviation || "",
    businessUnit: (item?.businessUnit || "Corporate") as BusinessUnit,
    department: item?.department || "",
    description: item?.description || "",
    isActive: item?.isActive ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  React.useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        abbreviation: item.abbreviation || "",
        businessUnit: item.businessUnit,
        department: item.department,
        description: item.description || "",
        isActive: item.isActive,
      });
    } else {
      setFormData({ name: "", abbreviation: "", businessUnit: "Corporate", department: "", description: "", isActive: true });
    }
    setErrors({});
  }, [item, isOpen]);

  // Reset department when BU changes in modal
  React.useEffect(() => {
    if (!item) setFormData((prev) => ({ ...prev, department: "" }));
  }, [formData.businessUnit, item]);

  const validate = () => {
    const e: { [k: string]: string } = {};
    if (!formData.name.trim()) e.name = "Position name is required";
    if (!formData.department) e.department = "Department is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to save position", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleSubmit}
      title={`${isEdit ? "Edit" : "Add New"} Position`}
      isLoading={isSaving}
      size="lg"
    >
      <div className="space-y-4">
        {/* Business Unit */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Business Unit <span className="text-red-500 ml-1">*</span>
          </label>
          <Select
            value={formData.businessUnit}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, businessUnit: value as BusinessUnit, department: "" }))
            }
            options={businessUnitOptions}
            disabled={isSaving}
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Department <span className="text-red-500 ml-1">*</span>
          </label>
          <Select
            value={formData.department}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, department: value }));
              setErrors((prev) => ({ ...prev, department: "" }));
            }}
            options={[
              { label: "Select Department", value: "" },
              ...allDepartments
                .filter((d) => d.businessUnit === formData.businessUnit)
                .map((d) => ({ label: d.name, value: d.name })),
            ]}
            placeholder="Select Department"
            disabled={isSaving}
          />
          {errors.department && <p className="text-xs text-red-600 mt-1.5">{errors.department}</p>}
        </div>

        {/* Position Name */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Position Name <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => { setFormData((prev) => ({ ...prev, name: e.target.value })); setErrors((prev) => ({ ...prev, name: "" })); }}
            className={cn(
              "w-full h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500",
              errors.name ? "border-red-300 bg-red-50" : "border-slate-200"
            )}
            placeholder="e.g. QA Specialist"
            disabled={isSaving}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1.5">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Abbreviation
          </label>
          <input
            type="text"
            value={formData.abbreviation}
            onChange={(e) => setFormData((prev) => ({ ...prev, abbreviation: e.target.value.toUpperCase() }))}
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Auto-generated if blank"
            disabled={isSaving}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter position description (optional)"
            disabled={isSaving}
          />
        </div>

        {/* Active */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="isActive-position"
            checked={formData.isActive}
            onChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            label="Active"
            disabled={isSaving}
          />
        </div>
      </div>
    </FormModal>
  );
};
