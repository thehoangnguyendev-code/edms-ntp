import { useViewState } from "@/hooks/useViewState";
import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from '@/components/ui/filter/ConfiguredDesktopFilters';
import React, { useState, useMemo } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { Trash2, MoreVertical, Search, AlertTriangle, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { cn } from "@/components/ui/utils";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import type { DepartmentItem, BusinessUnit } from "../types";
import { usePortalDropdown } from "@/hooks";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useOpenedFormDirty } from "@/hooks/useFormDirty";
import { Button } from "@/components/ui/button/Button";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { IconFilter2, IconPencilMinus, IconToggleLeft, IconToggleRight } from "@tabler/icons-react";
import { dictionaryApi } from "@/services/api";
import { settingsApi } from "@/services/api/settings";
import type { SelectOption } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast";
import { extractApiMessage } from "../utils";
import { useDictionaryServerTable } from "../hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { FolderIcon } from "@/features/self-service/knowledge/explorer/ExplorerIcons";
import { folderColor } from "@/features/self-service/knowledge/explorer/explorerModel";
import { FolderColorField } from "../FolderColorField";
import { userOptionLabel } from "../userOptionLabel";
import { useResetPageOnChange } from "@/hooks/useResetPageOnChange";
import { tr } from "@/i18n";
import { statusColor } from "@/components/ui/badge/statusColors";

export const DepartmentsTab = React.forwardRef<
  { openAddModal: () => void },
  {}
>((_, ref) => {
  const [resultModal, setResultModal] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    description: "",
  });
  const [businessUnitFilter, setBusinessUnitFilter] = useViewState<
    "All" | BusinessUnit
  >("DepartmentsTab.businessUnitFilter", "All");
  const [statusFilter, setStatusFilter] = useViewState<
    "All" | "Active" | "Inactive"
  >("DepartmentsTab.statusFilter", "All");
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
  const canManage = hasPermissionAlias("settings.department.manage");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["businessUnit", "status", "date"]),
  );
  const [selectedItem, setSelectedItem] = useState<DepartmentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessUnits, setBusinessUnits] = useState<
    { label: string; value: string }[]
  >([]);
  const { showToast } = useToast();

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
  } = useDictionaryServerTable<DepartmentItem>({
    fetcher: dictionaryApi.getDepartmentsPage,
    defaultSortBy: "name",
    extraParams: {
      businessUnit:
        businessUnitFilter === "All" ? undefined : businessUnitFilter,
      status: statusFilter,
      modifiedFrom: modifiedFromDate || undefined,
      modifiedTo: modifiedToDate || undefined,
    },
  });

  const openResultModal = (
    type: "success" | "error",
    title: string,
    description: string,
  ) => {
    setResultModal({ isOpen: true, type, title, description });
  };

  const closeResultModal = () =>
    setResultModal((prev) => ({ ...prev, isOpen: false }));

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    openAddModal: () => setShowAddModal(true),
  }));

  useResetPageOnChange(setCurrentPage, [businessUnitFilter, statusFilter, modifiedFromDate, modifiedToDate]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const businessUnitRows = await dictionaryApi.getBusinessUnits();
        setBusinessUnits(
          businessUnitRows.map((unit) => ({
            label: unit.name,
            value: unit.name,
          })),
        );
      } catch (error) {}
    };

    load();
  }, []);

  const handleEdit = (item: DepartmentItem) => {
    setSelectedItem(item);
    setShowEditModal(true);
    closeDropdown();
  };

  const handleDelete = (item: DepartmentItem) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
    closeDropdown();
  };

  const handleRequestToggleStatus = (item: DepartmentItem) => {
    setSelectedItem(item);
    setShowToggleModal(true);
    closeDropdown();
  };

  const handleConfirmToggleStatus = () => {
    const item = selectedItem;
    if (!item) return;
    dictionaryApi
      .updateDepartment(item.id, {
        name: item.name,
        abbreviation: item.abbreviation,
        businessUnit: item.businessUnit,
        description: item.description,
        isActive: !item.isActive,
        departmentHeadId: item.departmentHeadId || null,
        primaryContactPhone: item.primaryContactPhone || null,
        iconColor: item.iconColor || null,
      })
      .then((updated) => {
        setShowToggleModal(false);
        reload();
        showToast({
          type: "success",
          title: updated.isActive
            ? "Department Activated"
            : "Department Deactivated",
          message: `Department "${updated.name}" was ${updated.isActive ? "activated" : "deactivated"} successfully.`,
        });
      })
      .catch((error) => {
        if (import.meta.env.DEV)
          console.error("Failed to toggle department", error);
        setShowToggleModal(false);
        showToast({
          type: "error",
          title: tr("Department Status Update Failed"),
          message: extractApiMessage(
            error,
            "Unable to update department status.",
          ),
        });
      });
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      if (selectedItem) {
        await dictionaryApi.deleteDepartment(selectedItem.id);
        reload();
        showToast({
          type: "success",
          title: tr("Department Deleted"),
          message: `Department "${selectedItem.name}" has been deleted successfully.`,
        });
      }
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (error) {
      if (import.meta.env.DEV)
        console.error("Failed to delete department", error);
      showToast({
        type: "error",
        title: tr("Department Delete Failed"),
        message: extractApiMessage(error, "Unable to delete department."),
      });
      setShowDeleteModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setBusinessUnitFilter("All");
    setStatusFilter("All");
    setModifiedFromDate("");
    setModifiedToDate("");
    setCurrentPage(1);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  type DeptRow = (typeof items)[number];
  const deptColumns: DataTableColumn<DeptRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_item, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { id: "name", header: tr("Department Name"), label: tr("Department Name"), sort: { direction: sortConfig.key === "name" ? sortConfig.direction : undefined, onSort: () => handleSort("name") }, cellClassName: "font-medium text-slate-900", cell: (item) => item.name },
    { id: "abbreviation", header: "Abbreviation", label: "Abbreviation", sort: { direction: sortConfig.key === "abbreviation" ? sortConfig.direction : undefined, onSort: () => handleSort("abbreviation") }, cell: (item) => <Badge color="blue" size="sm">{item.abbreviation}</Badge> },
    { id: "businessUnit", header: tr("Business Unit"), label: tr("Business Unit"), sort: { direction: sortConfig.key === "businessUnit" ? sortConfig.direction : undefined, onSort: () => handleSort("businessUnit") }, cell: (item) => item.businessUnit },
    { id: "icon", header: "Folder", label: "Folder", cell: (item) => <FolderIcon color={item.iconColor || folderColor(item.name)} className="h-6 w-7" /> },
    { id: "primaryContactPhone", header: tr("Primary Contact"), label: tr("Primary Contact"), sort: { direction: sortConfig.key === "primaryContactPhone" ? sortConfig.direction : undefined, onSort: () => handleSort("primaryContactPhone") }, cellClassName: "text-slate-700", cell: (item) => item.primaryContactPhone || "-" },
    { id: "departmentHeadName", header: tr("Department Head"), label: tr("Department Head"), cellClassName: "text-slate-700", cell: (item) => item.departmentHeadName || "-" },
    { id: "employeeCount", header: "Employees", label: "Employees", cellClassName: "text-slate-700", cell: (item) => new Intl.NumberFormat("en-US").format(item.employeeCount ?? 0) },
    { id: "description", header: "Description", label: "Description", sort: { direction: sortConfig.key === "description" ? sortConfig.direction : undefined, onSort: () => handleSort("description") }, cellClassName: "text-slate-600 max-w-md truncate", cell: (item) => item.description || "-" },
    {
      id: "isActive",
      header: "Status",
      label: "Status",
      sort: { direction: sortConfig.key === "isActive" ? sortConfig.direction : undefined, onSort: () => handleSort("isActive") },
      cell: (item) => (item.isActive ? <Badge color="emerald" size="sm">{tr("Active")}</Badge> : <Badge color={statusColor("INACTIVE")} size="sm">{tr("Inactive")}</Badge>),
    },
    { id: "modifiedDate", header: tr("Modified Date"), label: tr("Modified Date"), sort: { direction: sortConfig.key === "modifiedDate" ? sortConfig.direction : undefined, onSort: () => handleSort("modifiedDate") }, cellClassName: "text-slate-600", cell: (item) => item.modifiedDate },
  ];
  const deptAction: DataTableAction<DeptRow> = {
    header: "Action",
    cell: (item) =>
      canManage ? (
        <button
          ref={getButtonRef(item.id)}
          onClick={(e) => handleDropdownToggle(item.id, e)}
          className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label={tr("More actions")}
        >
          <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
        </button>
      ) : null,
  };
  const { layout: deptLayout, control: deptControl } = useCustomColumnLayout("settings.departments", deptColumns, deptAction);

  return (
    <div className="compact-filter-stack flex-1 flex flex-col gap-4 md:gap-5 min-h-0">
      {/* Filter Card */}
      <div className="bg-white w-full">
        <div className="flex md:hidden flex-col gap-1.5 w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block capitalize">
            {tr("Search")}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={tr("Search departments...")}
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
            <Button
              variant="outline"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="whitespace-nowrap gap-2"
            >
              <IconFilter2 className="h-4 w-4" />
              {tr("Filters")}
            </Button>
          </div>
        </div>

<ConfiguredDesktopFilters
  trailing={<div className="hidden md:block">{deptControl}</div>}
  search={
    <input
      aria-label={tr("Search")}
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
      }}
      placeholder={tr("Search departments...")}
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
    />
  }
  filters={[
    {
      id: "businessUnitFilter",
      label: tr("Business Unit"),
      value: String(businessUnitFilter),
      options: [{ label: "All", value: "All" }, ...businessUnits],
      onChange: (value) => {
        setBusinessUnitFilter(value as "All" | BusinessUnit);
        setCurrentPage(1);
      },
    },
    {
      id: "statusFilter",
      label: "Status",
      value: String(statusFilter),
      options: [
        { label: "All", value: "All" },
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
      ],
      onChange: (value) => {
        setStatusFilter(value as "All" | "Active" | "Inactive");
        setCurrentPage(1);
      },
    },
  ]}
  dates={[
    {
      id: "modifiedFromDate",
      label: tr("Modified Date Range"),
      from: modifiedFromDate,
      to: modifiedToDate,
      onFromChange: (v) => {
        setModifiedFromDate(v);
        setCurrentPage(1);
      },
      onToChange: (v) => {
        setModifiedToDate(v);
        setCurrentPage(1);
      },
    },
  ]}
>
<div className="hidden md:grid grid-cols-3 gap-4 items-end">
          <div className="w-full">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
              {tr("Search")}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={tr("Search departments...")}
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
              label={tr("Business Unit")}
              value={businessUnitFilter}
              onChange={(value) => {
                setBusinessUnitFilter(value as "All" | BusinessUnit);
                setCurrentPage(1);
              }}
              options={[{ label: "All", value: "All" }, ...businessUnits]}
              placeholder={tr("All")}
            />
          </div>

          <div className="w-full">
            <Select
              label={tr("Status")}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as "All" | "Active" | "Inactive");
                setCurrentPage(1);
              }}
              options={[
                { label: "All", value: "All" },
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
              placeholder={tr("All")}
            />
          </div>

          <div className="w-full">
            <DateRangePicker
              label={tr("Modified Date Range")}
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
              placeholder={tr("Select range")}
            />
          </div>

          <div className="filter-actions flex items-end gap-2">
            <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} />
            {deptControl}
          </div>
        </div>
</ConfiguredDesktopFilters>
      </div>

      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <DataTable
          rows={items}
          getRowKey={(item) => item.id}
          columns={deptLayout.columns}
          columnLayout={deptLayout}
          action={deptAction}
          pagination={
            totalItems > 0 ? (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            ) : undefined
          }
        />
      </div>

      {/* Portal Dropdown */}
      <PortalDropdownMenu
        isOpen={openDropdownId !== null}
        onClose={closeDropdown}
        position={dropdownPosition}
        minWidth={180}
      >
        <div className="py-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((i) => i.id === openDropdownId)!;
              handleEdit(item);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconPencilMinus className="h-3.5 w-3.5" />
            <span>{tr("Edit Department")}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((i) => i.id === openDropdownId)!;
              handleRequestToggleStatus(item);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {items.find((i) => i.id === openDropdownId)?.isActive ? (
              <>
                <IconToggleLeft className="h-3.5 w-3.5" />
                <span>{tr("Disable")}</span>
              </>
            ) : (
              <>
                <IconToggleRight className="h-3.5 w-3.5" />
                <span>{tr("Enable")}</span>
              </>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((i) => i.id === openDropdownId)!;
              handleDelete(item);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{tr("Delete")}</span>
          </button>
        </div>
      </PortalDropdownMenu>

      <DepartmentModal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        isEdit={showEditModal}
        businessUnitOptions={businessUnits}
        onSave={async (data) => {
          const payload = {
            name: data.name,
            abbreviation: data.abbreviation,
            businessUnit: data.businessUnit,
            description: data.description,
            isActive: data.isActive,
            departmentHeadId: data.departmentHeadId || null,
            primaryContactPhone: data.primaryContactPhone || null,
            iconColor: data.iconColor || null,
          };
          try {
            const saved =
              showEditModal && selectedItem
                ? await dictionaryApi.updateDepartment(selectedItem.id, payload)
                : await dictionaryApi.createDepartment(payload);
            reload();
            openResultModal(
              "success",
              showEditModal ? "Department Updated" : "Department Created",
              `Department "${saved.name}" has been ${showEditModal ? "updated" : "created"} successfully.`,
            );
          } catch (error) {
            openResultModal(
              "error",
              showEditModal
                ? "Department Update Failed"
                : "Department Creation Failed",
              extractApiMessage(
                error,
                showEditModal
                  ? tr("Unable to update department.")
                  : tr("Unable to create department."),
              ),
            );
            throw error;
          }
        }}
      />

      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        type="warning"
        title={tr("Delete Department?")}
        description={
          <div className="space-y-3">
            <p>
              {tr("Are you sure you want to delete")}{" "}
              <strong>{selectedItem?.name}</strong>?
            </p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">{tr("Warning:")}</span> {tr("This action cannot be undone.")}
              </p>
            </div>
          </div>
        }
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel={true}
      />

      <AlertModal
        isOpen={showToggleModal}
        onClose={() => {
          setShowToggleModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleConfirmToggleStatus}
        type="warning"
        title={`${selectedItem?.isActive ? tr("Deactivate") : tr("Activate")} ${tr("Department?")}`}
        description={
          <div className="space-y-3">
            <p>
              {tr("Are you sure you want to")}{" "}
              {selectedItem?.isActive ? tr("deactivate") : tr("activate")}{" "}
              <strong>{selectedItem?.name}</strong>?
            </p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">{tr("Warning:")}</span> {tr("This change will take effect immediately.")}
              </p>
            </div>
          </div>
        }
        confirmText={selectedItem?.isActive ? tr("Deactivate") : "Activate"}
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel={true}
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

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label={tr("Business Unit")}
          isExpanded={expandedSections.has("businessUnit")}
          onToggle={() => toggleSection("businessUnit")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All", value: "All" }, ...businessUnits].map(
              (opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setBusinessUnitFilter(opt.value as "All" | BusinessUnit);
                    setCurrentPage(1);
                  }}
                  className={getOptionClassName(
                    businessUnitFilter === opt.value,
                  )}
                >
                  <span className="text-xs">{opt.label}</span>
                  {businessUnitFilter === opt.value && (
                    <Check size={16} className="text-emerald-500" />
                  )}
                </button>
              ),
            )}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label={tr("Status")}
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All", value: "All" },
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
                {statusFilter === opt.value && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label={tr("Modified Date Range")}
          isExpanded={expandedSections.has("date")}
          onToggle={() => toggleSection("date")}
        >
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
              placeholder={tr("Select range")}
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
});

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DepartmentItem | null;
  isEdit: boolean;
  businessUnitOptions: { label: string; value: string }[];
  onSave: (data: any) => Promise<void>;
}

const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  item,
  isEdit,
  businessUnitOptions,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    abbreviation: item?.abbreviation || "",
    description: item?.description || "",
    businessUnit: (item?.businessUnit || "Corporate") as BusinessUnit,
    isActive: item?.isActive ?? true,
    departmentHeadId: item?.departmentHeadId || "",
    departmentHeadLabel: item?.departmentHeadName ? userOptionLabel(item.departmentHeadEmployeeCode, item.departmentHeadName) : "",
    primaryContactPhone: item?.primaryContactPhone || "",
    iconColor: item?.iconColor || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  // Populated as the admin searches for a Department Head -- keyed by user id, so selecting a
  // result can auto-fill Primary Contact from that user's own phone number (already on file from
  // when the user account was created) instead of making the admin retype it.
  const phoneByUserIdRef = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        abbreviation: item.abbreviation,
        description: item.description || "",
        businessUnit: item.businessUnit,
        isActive: item.isActive,
        departmentHeadId: item.departmentHeadId || "",
        departmentHeadLabel: item.departmentHeadName ? userOptionLabel(item.departmentHeadEmployeeCode, item.departmentHeadName) : "",
        primaryContactPhone: item.primaryContactPhone || "",
        iconColor: item.iconColor || "",
      });
    } else {
      setFormData({
        name: "",
        abbreviation: "",
        description: "",
        businessUnit: "Corporate",
        isActive: true,
        departmentHeadId: "",
        departmentHeadLabel: "",
        primaryContactPhone: "",
        iconColor: "",
      });
    }
  }, [item, isOpen]);

  const searchDepartmentHeadOptions = React.useCallback(
    async (query: string): Promise<SelectOption[]> => {
      const response = await settingsApi.getUsers({
        search: query,
        limit: 20,
        page: 1,
      } as any);
      return response.data
        .filter((u: any) => u.fullName && u.id)
        .map((u: any) => {
          phoneByUserIdRef.current.set(u.id, u.phone || "");
          return { label: userOptionLabel(u.employeeCode, u.fullName, u.username), value: u.id };
        });
    },
    [],
  );

  const handleSelectDepartmentHead = (value: string | number) => {
    const userId = String(value);
    const knownPhone = phoneByUserIdRef.current.get(userId);
    setFormData((prev) => ({
      ...prev,
      departmentHeadId: userId,
      // Auto-fills Primary Contact from the newly-selected head's own phone number (already on
      // file since that user account was created) -- Primary Contact stays a normal editable
      // field afterward, so the admin can still override it to a different number if needed.
      primaryContactPhone: knownPhone || prev.primaryContactPhone,
    }));
  };

  const dirty = useOpenedFormDirty(formData, isOpen);
  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      if (import.meta.env.DEV)
        console.error("Failed to save department", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      dirty={dirty}
      onClose={onClose}
      onConfirm={handleSubmit}
        title={`${isEdit ? tr("Edit") : tr("New")} ${tr("Department")}`}
      isLoading={isSaving}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
            {tr("Department Name")}<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder={tr("Enter department name")}
            required
            disabled={isSaving}
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
            {tr("Abbreviation")}<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.abbreviation}
            onChange={(e) =>
              setFormData({
                ...formData,
                abbreviation: e.target.value.toUpperCase(),
              })
            }
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder={tr("e.g., QA, R&D")}
            required
            disabled={isSaving}
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
            {tr("Business Unit")}<span className="text-red-500 ml-1">*</span>
          </label>
          <Select
            value={formData.businessUnit}
            onChange={(value) =>
              setFormData({ ...formData, businessUnit: value as BusinessUnit })
            }
            options={businessUnitOptions}
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
              {tr("Department Head")}
            </label>
            <Select
              value={formData.departmentHeadId}
              onChange={handleSelectDepartmentHead}
              options={
                formData.departmentHeadId
                  ? [
                      {
                        label:
                          formData.departmentHeadLabel ||
                          formData.departmentHeadId,
                        value: formData.departmentHeadId,
                      },
                    ]
                  : []
              }
              onSearch={searchDepartmentHeadOptions}
              enableSearch
              placeholder={tr("Search and select a user...")}
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
              {tr("Primary Contact")}
            </label>
            <input
              type="tel"
              value={formData.primaryContactPhone}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  primaryContactPhone: e.target.value,
                })
              }
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder={tr("Auto-filled from Department Head, or enter manually")}
              disabled={isSaving}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
            {tr("Description")}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder={tr("Enter description (optional)")}
            disabled={isSaving}
          />
        </div>

        <FolderColorField name={formData.name} value={formData.iconColor} onChange={(iconColor) => setFormData({ ...formData, iconColor })} disabled={isSaving} />

        <div className="flex items-center gap-3">
          <Checkbox
            id="isActive department"
            checked={formData.isActive}
            onChange={(checked) =>
              setFormData({ ...formData, isActive: checked })
            }
            label={tr("Active")}
            disabled={isSaving}
          />
        </div>
      </div>
    </FormModal>
  );
};
