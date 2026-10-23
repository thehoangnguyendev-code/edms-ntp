import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { usePersistedState } from "@/hooks/usePersistedState";
import React, { useEffect, useRef, useState } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { AlertTriangle, Check, MoreVertical, Plus, Power, PowerOff, Search, X } from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { trainingAdministrationBase } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingError, trainingMatrixApi, type TrainingTopic } from "@/services/api/trainingActivities";
import { usePortalDropdown } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { useDictionaryServerTable } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";

type ResultModalState = {
  isOpen: boolean;
  type: "success" | "error";
  title: string;
  description: string;
};

type TopicFormData = {
  code: string;
  name: string;
  scope: string;
  departmentId: string;
  isActive: boolean;
};

const SCOPE_LABEL: Record<string, string> = {
  FACTORY_GENERAL: "General (whole factory)",
  DEPARTMENT_GENERAL: "General (one department)",
  OTHER: "Other",
};

type ScopeFilter = "All" | keyof typeof SCOPE_LABEL;
type StatusFilter = "All" | "Active" | "Inactive";

/**
 * Training Topics administration: standard topics that are not SOPs (for example GMP or safety), chosen as rows of the
 * training matrix. Laid out the same way as Document Types.
 */
export const TrainingTopicsView: React.FC = () => {
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.admin.manage");
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrainingTopic | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [scopeFilter, setScopeFilter] = usePersistedState<ScopeFilter>("training.admin.topics.scope", "All");
  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>("training.admin.topics.status", "All");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["scope", "status"]));
  const [resultModal, setResultModal] = useState<ResultModalState>({
    isOpen: false,
    type: "success",
    title: "",
    description: "",
  });
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
    sortConfig,
    handleSort,
    reload,
  } = useDictionaryServerTable<TrainingTopic>({
    fetcher: trainingMatrixApi.topicsPage,
    persistKey: "training.admin.topics",
    liveTypes: ["TRAINING"],
    defaultSortBy: "code",
    extraParams: {
      scope: scopeFilter === "All" ? undefined : scopeFilter,
      status: statusFilter,
    },
  });

  const openResultModal = (type: ResultModalState["type"], title: string, description: string) => {
    setResultModal({ isOpen: true, type, title, description });
  };

  const closeResultModal = () => setResultModal((prev) => ({ ...prev, isOpen: false }));

  const filtersSeen = useRef(false);
  useEffect(() => {
    // The first run is the arrival on the screen: the page that was restored stays.
    if (!filtersSeen.current) { filtersSeen.current = true; return; }
    setCurrentPage(1);
  }, [scopeFilter, statusFilter, setCurrentPage]);

  const handleSave = async (payload: TopicFormData) => {
    try {
      await trainingMatrixApi.saveTopic(showEditModal && selectedItem ? selectedItem.id : null, {
        code: payload.code,
        name: payload.name.trim(),
        scope: payload.scope,
        departmentId: payload.scope === "DEPARTMENT_GENERAL" ? payload.departmentId : null,
        active: payload.isActive,
        version: showEditModal ? selectedItem?.version : undefined,
      });

      openResultModal(
        "success",
        showEditModal ? "Training Topic Updated" : "Training Topic Created",
        `Training topic "${payload.name.trim()}" has been ${showEditModal ? "updated" : "created"} successfully.`
      );
      reload();
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedItem(null);
    } catch (error) {
      openResultModal(
        "error",
        showEditModal ? "Training Topic Update Failed" : "Training Topic Create Failed",
        trainingError(error)
      );
      throw error;
    }
  };

  const handleRequestToggleStatus = (item: TrainingTopic) => {
    setSelectedItem(item);
    setShowToggleModal(true);
    closeDropdown();
  };

  const handleConfirmToggleStatus = async () => {
    const item = selectedItem;
    if (!item) return;
    setIsSubmitting(true);
    try {
      await trainingMatrixApi.saveTopic(item.id, {
        code: item.code,
        name: item.name,
        scope: item.scope,
        departmentId: item.departmentId ?? null,
        active: !item.active,
        version: item.version,
      });
      setShowToggleModal(false);
      reload();
      showToast({
        type: "success",
        title: item.active ? "Training Topic Deactivated" : "Training Topic Activated",
        message: `Training topic "${item.name}" was ${item.active ? "deactivated" : "activated"} successfully.`,
      });
    } catch (error) {
      setShowToggleModal(false);
      showToast({
        type: "error",
        title: "Training Topic Status Update Failed",
        message: trainingError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setScopeFilter("All");
    setStatusFilter("All");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery.length > 0 || scopeFilter !== "All" || statusFilter !== "All";

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

  const scopeOptions = [{ label: "All", value: "All" }, ...Object.entries(SCOPE_LABEL).map(([value, label]) => ({ label, value }))];
  const statusOptions = [
    { label: "All", value: "All" },
    { label: "Active", value: "Active" },
    { label: "Inactive", value: "Inactive" },
  ];

  type Row = (typeof items)[number];
  const topicsColumns: DataTableColumn<Row>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, cell: (item, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { id: "code", header: "Code", label: "Code", sort: { direction: sortConfig.key === "code" ? sortConfig.direction : undefined, onSort: () => handleSort("code") }, cell: (item) => <Badge color="emerald" size="sm">{item.code}</Badge> },
    { id: "name", header: "Topic Name", label: "Topic Name", sort: { direction: sortConfig.key === "name" ? sortConfig.direction : undefined, onSort: () => handleSort("name") }, cell: (item) => <span className="font-medium text-slate-900">{item.name}</span> },
    { id: "scope", header: "Scope", label: "Scope", sort: { direction: sortConfig.key === "scope" ? sortConfig.direction : undefined, onSort: () => handleSort("scope") }, cellClassName: "text-slate-600", cell: (item) => SCOPE_LABEL[item.scope] + (item.departmentName ? ` — ${item.departmentName}` : "") },
    { id: "active", header: "Status", label: "Status", sort: { direction: sortConfig.key === "active" ? sortConfig.direction : undefined, onSort: () => handleSort("active") }, cell: (item) => (item.active ? <Badge color="emerald" size="sm">Active</Badge> : <Badge color="slate" size="sm">Inactive</Badge>) },
  ];
  const topicsAction: DataTableAction<Row> = {
    header: "Action",
    cell: (item) => (canManage ? (<button ref={getButtonRef(item.id)} onClick={(e) => handleDropdownToggle(item.id, e)} className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors" aria-label="More actions"><MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" /></button>) : null),
  };
  const { layout: topicsLayout, control: topicsControl } = useCustomColumnLayout("trainingTopics", topicsColumns, topicsAction);

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title="Training Topics"
        breadcrumbItems={[...trainingAdministrationBase(navigate), { label: "Training Topics", isActive: true }]}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              New Training Topic
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-5">
    <div className="compact-filter-stack flex-1 flex flex-col gap-4 md:gap-5 min-h-0">
      <div className="bg-white w-full">
        <div className="flex md:hidden flex-col gap-1.5 w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search training topics..."
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

<ConfiguredDesktopFilters
  trailing={<div className="hidden md:block">{topicsControl}</div>}
  search={
    <input
      aria-label="Search"
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
      }}
      placeholder={"Search training topics..."}
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
    />
  }
  filters={[
    {
      id: "scopeFilter",
      label: "Scope",
      value: String(scopeFilter),
      options: scopeOptions,
      onChange: (value) => {
        setScopeFilter(value as ScopeFilter);
        setCurrentPage(1);
      },
    },
    {
      id: "statusFilter",
      label: "Status",
      value: String(statusFilter),
      options: statusOptions,
      onChange: (value) => {
        setStatusFilter(value as StatusFilter);
        setCurrentPage(1);
      },
    },
  ]}
>
<div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
          <div className="sm:col-span-1 lg:col-span-4">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search training topics..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="sm:col-span-1 lg:col-span-4">
            <Select
              label="Scope"
              value={scopeFilter}
              onChange={(value) => {
                setScopeFilter(value as ScopeFilter);
                setCurrentPage(1);
              }}
              options={scopeOptions}
              placeholder="All"
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-4">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as StatusFilter);
                setCurrentPage(1);
              }}
              options={statusOptions}
              placeholder="All"
            />
          </div>
        </div>

        <div className="hidden md:flex justify-start gap-2 mt-3">
          <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} disabled={!hasActiveFilters} />
            {topicsControl}
        </div>
</ConfiguredDesktopFilters>
      </div>

      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <DataTable
          rows={items}
          getRowKey={(item) => item.id}
          columns={topicsLayout.columns}
          columnLayout={topicsLayout}
          action={topicsAction}
          emptyState={
            <TableEmptyState
  title="No items found" description="Try adjusting your search" />
          }
          pagination={
            totalItems > 0 ? (
              <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
            ) : undefined
          }
        />
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
            <span>Edit Training Topic</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((current) => current.id === openDropdownId);
              if (item) handleRequestToggleStatus(item);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {items.find((current) => current.id === openDropdownId)?.active ? (
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
        </div>
      </PortalDropdownMenu>

      <TrainingTopicModal
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
        isOpen={showToggleModal}
        onClose={() => {
          setShowToggleModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleConfirmToggleStatus}
        type="warning"
        title={`${selectedItem?.active ? "Deactivate" : "Activate"} Training Topic?`}
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to {selectedItem?.active ? "deactivate" : "activate"}{" "}
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
        confirmText={selectedItem?.active ? "Deactivate" : "Activate"}
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
        <FilterAccordionItem
          label="Scope"
          isExpanded={expandedSections.has("scope")}
          onToggle={() => toggleSection("scope")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {scopeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setScopeFilter(opt.value as ScopeFilter);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(scopeFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {scopeFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(opt.value as StatusFilter);
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
      </FilterDrawer>
    </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TrainingTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: TrainingTopic | null;
  isEdit: boolean;
  onSave: (data: TopicFormData) => Promise<void>;
}

const TrainingTopicModal: React.FC<TrainingTopicModalProps> = ({ isOpen, onClose, item, isEdit, onSave }) => {
  const [formData, setFormData] = useState<TopicFormData>({
    code: item?.code || "",
    name: item?.name || "",
    scope: item?.scope || "FACTORY_GENERAL",
    departmentId: item?.departmentId || "",
    isActive: item?.active ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    dictionaryApi
      .getDepartments()
      .then((list) => setDepartments(list.map((d) => ({ label: d.name, value: d.id }))))
      .catch(() => setDepartments([]));
  }, [isOpen]);

  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code,
        name: item.name,
        scope: item.scope,
        departmentId: item.departmentId || "",
        isActive: item.active,
      });
    } else {
      setFormData({ code: "", name: "", scope: "FACTORY_GENERAL", departmentId: "", isActive: true });
    }
  }, [item, isOpen]);

  const invalid =
    !formData.name.trim() ||
    (!isEdit && !formData.code.trim()) ||
    (formData.scope === "DEPARTMENT_GENERAL" && !formData.departmentId);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...formData, code: formData.code.trim().toUpperCase() });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleSubmit}
      title={`${isEdit ? "Edit" : "New"} Training Topic`}
      isLoading={isSaving}
      confirmDisabled={invalid}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Code<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => !isEdit && setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9._-]/g, "") })}
            maxLength={40}
            className={cn(
              "w-full h-9 px-3 border border-slate-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500",
              isEdit && "bg-slate-50 text-slate-500 cursor-not-allowed"
            )}
            placeholder="e.g., GMP-BASICS"
            required
            readOnly={isEdit}
            disabled={isSaving || isEdit}
          />
          <p className="mt-1 text-xs text-slate-500">
            {isEdit
              ? "Locked — the code is how the training matrix refers to this topic."
              : "Letters, digits, dot, hyphen and underscore, up to 40 characters. It cannot be changed after the topic is created."}
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Topic Name<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            maxLength={255}
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter name"
            required
            disabled={isSaving}
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Scope<span className="text-red-500 ml-1">*</span>
          </label>
          <Select
            value={formData.scope}
            onChange={(v) => setFormData({ ...formData, scope: v, departmentId: v === "DEPARTMENT_GENERAL" ? formData.departmentId : "" })}
            options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({ label, value }))}
            enableSearch={false}
            disabled={isSaving}
          />
        </div>

        {formData.scope === "DEPARTMENT_GENERAL" && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Department<span className="text-red-500 ml-1">*</span>
            </label>
            <Select
              value={formData.departmentId}
              onChange={(v) => setFormData({ ...formData, departmentId: v })}
              options={departments}
              placeholder="Select department"
              disabled={isSaving}
            />
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-3">
            <Checkbox
              id="isActive training-topic"
              checked={formData.isActive}
              onChange={(checked) => setFormData({ ...formData, isActive: checked })}
              label="Active"
              disabled={isSaving}
            />
          </div>
        )}
      </div>
    </FormModal>
  );
};
