import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LockKeyhole,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Shield,
  X,
} from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import {
  FilterAccordionItem,
  FilterDrawer,
} from "@/components/ui/filter/FilterDrawer";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast/Toast";
import { api } from "@/services/api/client";
import { workflowRoleCatalog as workflowRoleCatalogBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { usePortalDropdown, useTableDragScroll } from "@/hooks";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { formatDateTime } from "@/utils/format";

interface WorkflowRoleCatalogEntry {
  id: string;
  code: string;
  label: string;
  moduleKey: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  system: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface WorkflowRoleCatalogPage {
  data: WorkflowRoleCatalogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface WorkflowRoleFormState {
  id: string | null;
  code: string;
  label: string;
  moduleKey: string;
  description: string;
  active: boolean;
  isSystem: boolean;
}

type SortField =
  "displayOrder" | "code" | "label" | "moduleKey" | "createdAt" | "updatedAt";

const emptyForm: WorkflowRoleFormState = {
  id: null,
  code: "",
  label: "",
  moduleKey: "",
  description: "",
  active: true,
  isSystem: false,
};

const typeOptions: SelectOption[] = [
  { label: "All Types", value: "ALL" },
  { label: "System", value: "SYSTEM" },
  { label: "Custom", value: "CUSTOM" },
];
const statusOptions: SelectOption[] = [
  { label: "All Statuses", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

/** Advanced, database-backed catalog of workflow participant types. */
export const WorkflowRolesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canView = hasPermissionAlias("security.workflow_authorization.view");
  const canManage = hasPermissionAlias(
    "security.workflow_authorization.manage",
  );
  const { requestSignature, signatureModal } = useSecurityESign();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  const [roles, setRoles] = useState<WorkflowRoleCatalogEntry[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<WorkflowRoleFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["module", "type", "status"]),
  );
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [sort, setSort] = useState<{
    field: SortField;
    direction: "asc" | "desc";
  }>({ field: "displayOrder", direction: "asc" });

  const moduleOptions: SelectOption[] = [
    { label: "All Modules", value: "ALL" },
    ...modules.map((module) => ({ label: module, value: module })),
  ];
  const selectedRole = openId
    ? (roles.find((role) => role.id === openId) ?? null)
    : null;

  const loadRoles = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const response = await api.get<WorkflowRoleCatalogPage>(
          "/security/workflow-roles/catalog",
          {
            params: {
              page,
              limit: pagination.limit,
              search: search.trim() || undefined,
              module: moduleFilter === "ALL" ? undefined : moduleFilter,
              type: typeFilter === "ALL" ? undefined : typeFilter,
              status: statusFilter === "ALL" ? undefined : statusFilter,
              createdFrom: createdFrom || undefined,
              createdTo: createdTo || undefined,
              updatedFrom: updatedFrom || undefined,
              updatedTo: updatedTo || undefined,
              sortBy: sort.field,
              sortDir: sort.direction,
            },
          },
        );
        setRoles(response.data.data);
        setPagination(response.data.pagination);
      } catch {
        showToast({
          type: "error",
          message: "Failed to load workflow role catalog",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      moduleFilter,
      pagination.limit,
      search,
      showToast,
      sort.direction,
      sort.field,
      statusFilter,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      typeFilter,
    ],
  );

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    api
      .get<string[]>("/security/workflow-roles/catalog/options")
      .then((response) => setModules(response.data))
      .catch(() =>
        showToast({
          type: "error",
          message: "Failed to load workflow role filter options",
        }),
      );
  }, [canView, showToast]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => loadRoles(1), 300);
    return () => window.clearTimeout(timer);
  }, [
    canView,
    search,
    moduleFilter,
    typeFilter,
    statusFilter,
    sort,
    pagination.limit,
    loadRoles,
  ]);

  const resetPage = () => setPagination((current) => ({ ...current, page: 1 }));
  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    resetPage();
  };
  const clearFilters = () => {
    setSearch("");
    setModuleFilter("ALL");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    resetPage();
  };
  const toggleSection = (id: string) =>
    setExpandedSections((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const getOptionClassName = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-lg border px-4 py-2.5 transition-all",
      active
        ? "border-emerald-500 bg-white font-semibold text-emerald-700 shadow-sm shadow-emerald-100/50"
        : "border-slate-200 bg-white font-medium text-slate-500",
    );

  const openEdit = (entry: WorkflowRoleCatalogEntry) =>
    setForm({
      id: entry.id,
      code: entry.code,
      label: entry.label,
      moduleKey: entry.moduleKey,
      description: entry.description ?? "",
      active: entry.active,
      isSystem: entry.system,
    });
  const toggleSort = (field: SortField) =>
    setSort((current) => ({
      field,
      direction:
        current.field === field && current.direction === "asc" ? "desc" : "asc",
    }));

  const handleSave = async () => {
    if (!form) return;
    if (
      !form.label.trim() ||
      !form.moduleKey.trim() ||
      (!form.id && !form.code.trim())
    ) {
      showToast({
        type: "error",
        message: "Code, Label and Module are required",
      });
      return;
    }
    const signature = await requestSignature(
      form.id
        ? `Update Workflow Role "${form.label}"`
        : `Create Workflow Role "${form.label}"`,
      "Workflow Authorization Change",
    );
    if (!signature) return;
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        label: form.label,
        moduleKey: form.moduleKey,
        description: form.description || null,
        active: form.active,
        signatureToken: signature.signatureToken,
        reason: signature.reason,
      };
      if (form.id) {
        await api.put(`/security/workflow-roles/catalog/${form.id}`, payload);
        showToast({ type: "success", message: "Workflow role updated" });
      } else {
        await api.post("/security/workflow-roles/catalog", payload);
        showToast({ type: "success", message: "Workflow role created" });
      }
      setForm(null);
      await loadRoles(1);
      const response = await api.get<string[]>(
        "/security/workflow-roles/catalog/options",
      );
      setModules(response.data);
    } catch (error: any) {
      showToast({
        type: "error",
        message:
          error?.response?.data?.message || "Failed to save workflow role",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canView)
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">
          You do not have permission to view Workflow Authorization.
        </p>
      </div>
    );

  const tdClass =
    "border-b border-slate-200 px-4 py-3 text-xs text-slate-700 md:text-sm whitespace-nowrap";

  return (
    <div className="flex w-full flex-1 flex-col space-y-6">
      <PageHeader
        title="Workflow Role Catalog"
        breadcrumbItems={workflowRoleCatalogBreadcrumb(navigate)}
        actions={
          canManage ? (
            <Button
              variant="default"
              size="sm"
              className="whitespace-nowrap gap-2"
              onClick={() => setForm({ ...emptyForm })}
            >
              <Plus className="h-4 w-4" /> New Custom Role
            </Button>
          ) : undefined
        }
      />

      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col p-4 md:p-5">
          <div className="flex w-full flex-col">
            <div className="mb-4 flex w-full flex-col gap-1.5 md:hidden">
              <label className="block text-xs font-medium text-slate-700 sm:text-sm">
                Search
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      resetPage();
                    }}
                    placeholder="Role code, label, module..."
                    className="block h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {search && (
                    <button
                      onClick={() => {
                        setSearch("");
                        resetPage();
                      }}
                      className="absolute inset-y-0 right-0 pr-3 text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="h-10 whitespace-nowrap gap-2"
                >
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      resetPage();
                    }}
                    placeholder="Role code, label, module..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <Select
                label="Module"
                value={moduleFilter}
                onChange={(value) => setFilter(setModuleFilter, String(value))}
                options={moduleOptions}
              />
              <Select
                label="Type"
                value={typeFilter}
                onChange={(value) => setFilter(setTypeFilter, String(value))}
                options={typeOptions}
              />
              <Select
                label="Status"
                value={statusFilter}
                onChange={(value) => setFilter(setStatusFilter, String(value))}
                options={statusOptions}
              />
              <DateRangePicker
                label="Created Date Range"
                startDate={createdFrom}
                endDate={createdTo}
                onStartDateChange={(value) => {
                  setCreatedFrom(value);
                  resetPage();
                }}
                onEndDateChange={(value) => {
                  setCreatedTo(value);
                  resetPage();
                }}
                placeholder="Select created date range"
                autoApply
              />
              <DateRangePicker
                label="Last Updated Range"
                startDate={updatedFrom}
                endDate={updatedTo}
                onStartDateChange={(value) => {
                  setUpdatedFrom(value);
                  resetPage();
                }}
                onEndDateChange={(value) => {
                  setUpdatedTo(value);
                  resetPage();
                }}
                placeholder="Select last updated range"
                autoApply
              />
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-4 whitespace-nowrap font-medium transition-all duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            <FilterDrawer
              isOpen={isFilterDrawerOpen}
              onClose={() => setIsFilterDrawerOpen(false)}
              onClear={clearFilters}
              onApply={() => setIsFilterDrawerOpen(false)}
            >
              <MobileFilter
                label="Module"
                id="module"
                value={moduleFilter}
                options={moduleOptions}
                isExpanded={expandedSections.has("module")}
                onToggle={toggleSection}
                onChange={(value) => setFilter(setModuleFilter, value)}
                getClassName={getOptionClassName}
              />
              <MobileFilter
                label="Type"
                id="type"
                value={typeFilter}
                options={typeOptions}
                isExpanded={expandedSections.has("type")}
                onToggle={toggleSection}
                onChange={(value) => setFilter(setTypeFilter, value)}
                getClassName={getOptionClassName}
              />
              <MobileFilter
                label="Status"
                id="status"
                value={statusFilter}
                options={statusOptions}
                isExpanded={expandedSections.has("status")}
                onToggle={toggleSection}
                onChange={(value) => setFilter(setStatusFilter, value)}
                getClassName={getOptionClassName}
              />
              <DateRangeFilter
                label="Created Date Range"
                id="created-date"
                startDate={createdFrom}
                endDate={createdTo}
                isExpanded={expandedSections.has("created-date")}
                onToggle={toggleSection}
                onStartDateChange={(value) => {
                  setCreatedFrom(value);
                  resetPage();
                }}
                onEndDateChange={(value) => {
                  setCreatedTo(value);
                  resetPage();
                }}
              />
              <DateRangeFilter
                label="Last Updated Range"
                id="updated-date"
                startDate={updatedFrom}
                endDate={updatedTo}
                isExpanded={expandedSections.has("updated-date")}
                onToggle={toggleSection}
                onStartDateChange={(value) => {
                  setUpdatedFrom(value);
                  resetPage();
                }}
                onEndDateChange={(value) => {
                  setUpdatedTo(value);
                  resetPage();
                }}
              />
            </FilterDrawer>
          </div>

          <div className="relative flex flex-1 flex-col">
            <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300">
              {loading ? (
                <SectionLoading />
              ) : (
                <>
                  <div
                    ref={scrollerRef}
                    className={cn(
                      "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                      isDragging
                        ? "cursor-grabbing select-none"
                        : "cursor-grab",
                    )}
                    {...dragEvents}
                  >
                    <table className="w-full min-w-max border-spacing-0 text-left">
                      <thead>
                        <tr>
                          <th className="sticky top-0 z-20 w-16 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                            No.
                          </th>
                          <SortHeader
                            label="Role Code"
                            field="code"
                            sort={sort}
                            onSort={toggleSort}
                          />
                          <SortHeader
                            label="Workflow Role"
                            field="label"
                            sort={sort}
                            onSort={toggleSort}
                          />
                          <SortHeader
                            label="Module"
                            field="moduleKey"
                            sort={sort}
                            onSort={toggleSort}
                          />
                          <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                            Description
                          </th>
                          <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                            Type
                          </th>
                          <th className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                            Status
                          </th>
                          <SortHeader
                            label="Created Date"
                            field="createdAt"
                            sort={sort}
                            onSort={toggleSort}
                          />
                          <SortHeader
                            label="Last Updated"
                            field="updatedAt"
                            sort={sort}
                            onSort={toggleSort}
                          />
                          <th className="sticky right-0 top-0 z-30 w-20 whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xs font-bold uppercase tracking-wider text-slate-500 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 md:text-xs">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {roles.length === 0 ? (
                          <tr>
                            <td
                              colSpan={10}
                              className="border-b border-slate-200 py-12 text-center"
                            >
                              <TableEmptyState
                                title="No Workflow Roles Found"
                                description="We couldn't find workflow roles matching your filters. Try adjusting your search criteria."
                              />
                            </td>
                          </tr>
                        ) : (
                          roles.map((role, index) => (
                            <tr
                              key={role.id}
                              className="group transition-colors hover:bg-slate-50/80"
                            >
                              <td className={tdClass}>
                                {(pagination.page - 1) * pagination.limit +
                                  index +
                                  1}
                              </td>
                              <td
                                className={`${tdClass} font-mono font-medium`}
                              >
                                {role.code}
                              </td>
                              <td
                                className={`${tdClass} font-medium text-slate-900`}
                              >
                                {role.label}
                              </td>
                              <td className={tdClass}>{role.moduleKey}</td>
                              <td className={`${tdClass} max-w-xs truncate`}>
                                {role.description || "-"}
                              </td>
                              <td className={tdClass}>
                                <Badge
                                  color={role.system ? "blue" : "slate"}
                                  size="sm"
                                >
                                  {role.system ? "System" : "Custom"}
                                </Badge>
                              </td>
                              <td className={tdClass}>
                                <Badge
                                  color={role.active ? "emerald" : "slate"}
                                  size="sm"
                                >
                                  {role.active ? "Active" : "Inactive"}
                                </Badge>
                              </td>
                              <td className={tdClass}>
                                {formatDateTime(role.createdAt)}
                              </td>
                              <td className={tdClass}>
                                {formatDateTime(role.updatedAt)}
                              </td>
                              <td className="sticky right-0 z-10 whitespace-nowrap border-b border-slate-200 bg-white px-4 py-3 text-center shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 transition-colors group-hover:bg-slate-50">
                                <button
                                  ref={getRef(role.id)}
                                  onClick={(event) => toggle(role.id, event)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
                                  aria-label="More actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {roles.length > 0 && (
                    <TablePagination
                      currentPage={pagination.page}
                      totalPages={pagination.totalPages}
                      totalItems={pagination.total}
                      itemsPerPage={pagination.limit}
                      isLoading={loading}
                      onPageChange={loadRoles}
                      onItemsPerPageChange={(limit) =>
                        setPagination((current) => ({
                          ...current,
                          page: 1,
                          limit,
                        }))
                      }
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <PortalDropdownMenu
        isOpen={Boolean(selectedRole)}
        onClose={close}
        position={position}
        minWidth={180}
      >
        <div className="py-1">
          {canManage && selectedRole && (
            <DropdownMenuItem
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => {
                openEdit(selectedRole);
                close();
              }}
            >
              Edit Workflow Role
            </DropdownMenuItem>
          )}
        </div>
      </PortalDropdownMenu>
      <FormModal
        isOpen={!!form}
        onClose={() => setForm(null)}
        onConfirm={handleSave}
        title={form?.id ? "Edit Workflow Role" : "New Custom Workflow Role"}
        confirmText={form?.id ? "Save" : "Create"}
        isLoading={saving}
        size="md"
      >
        {form && <WorkflowRoleForm form={form} setForm={setForm} />}
      </FormModal>
      {signatureModal}
    </div>
  );
};

const MobileFilter: React.FC<{
  label: string;
  id: string;
  value: string;
  options: SelectOption[];
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onChange: (value: string) => void;
  getClassName: (active: boolean) => string;
}> = ({
  label,
  id,
  value,
  options,
  isExpanded,
  onToggle,
  onChange,
  getClassName,
}) => (
  <FilterAccordionItem
    label={label}
    isExpanded={isExpanded}
    onToggle={() => onToggle(id)}
  >
    <div className="grid grid-cols-1 gap-2 pb-4 pt-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          onClick={() => onChange(String(option.value))}
          className={getClassName(value === option.value)}
        >
          <span className="text-xs">{option.label}</span>
          {value === option.value && (
            <Check className="h-4 w-4 text-emerald-500" />
          )}
        </button>
      ))}
    </div>
  </FilterAccordionItem>
);

const DateRangeFilter: React.FC<{
  label: string;
  id: string;
  startDate: string;
  endDate: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}> = ({
  label,
  id,
  startDate,
  endDate,
  isExpanded,
  onToggle,
  onStartDateChange,
  onEndDateChange,
}) => (
  <FilterAccordionItem
    label={label}
    isExpanded={isExpanded}
    onToggle={() => onToggle(id)}
  >
    <div className="pb-4 pt-2">
      <DateRangePicker
        label={label}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        placeholder={`Select ${label.toLowerCase()}`}
        autoApply
      />
    </div>
  </FilterAccordionItem>
);

const SortHeader: React.FC<{
  label: string;
  field: SortField;
  sort: { field: SortField; direction: "asc" | "desc" };
  onSort: (field: SortField) => void;
}> = ({ label, field, sort, onSort }) => {
  const active = sort.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="sticky top-0 z-20 cursor-pointer whitespace-nowrap border-b-2 border-slate-200 bg-slate-50 px-4 py-3 text-2xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 md:text-xs"
    >
      <div className="group flex w-full items-center justify-between gap-2">
        <span>{label}</span>
        <div className="flex shrink-0 flex-col">
          <ChevronUp
            className={cn(
              "-mb-1 h-3 w-3",
              active && sort.direction === "asc"
                ? "text-emerald-600"
                : "text-slate-400",
            )}
          />
          <ChevronDown
            className={cn(
              "h-3 w-3",
              active && sort.direction === "desc"
                ? "text-emerald-600"
                : "text-slate-400",
            )}
          />
        </div>
      </div>
    </th>
  );
};

const WorkflowRoleForm: React.FC<{
  form: WorkflowRoleFormState;
  setForm: React.Dispatch<React.SetStateAction<WorkflowRoleFormState | null>>;
}> = ({ form, setForm }) => (
  <div className="space-y-4">
    {!form.id && (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
        This creates a catalog entry only. It does not grant permissions or
        change a workflow policy.
      </div>
    )}
    <FormField label="Code" required>
      <input
        type="text"
        value={form.code}
        disabled={!!form.id}
        onChange={(event) => setForm({ ...form, code: event.target.value })}
        placeholder="CUSTOM_WORKFLOW_ROLE"
        className={inputClass}
      />
      {form.id && (
        <p className="mt-1 text-[11px] text-slate-400">
          Code is immutable once created. Rename the role through Label.
        </p>
      )}
    </FormField>
    <FormField label="Label" required>
      <input
        type="text"
        value={form.label}
        onChange={(event) => setForm({ ...form, label: event.target.value })}
        placeholder="Custom Workflow Role"
        className={inputClass}
      />
    </FormField>
    <FormField label="Module" required>
      <input
        type="text"
        value={form.moduleKey}
        disabled={form.isSystem}
        onChange={(event) =>
          setForm({ ...form, moduleKey: event.target.value })
        }
        placeholder="document-control"
        className={inputClass}
      />
    </FormField>
    <FormField label="Description">
      <textarea
        value={form.description}
        onChange={(event) =>
          setForm({ ...form, description: event.target.value })
        }
        rows={2}
        className={`${inputClass} h-auto resize-none py-2`}
        placeholder="Enter description (optional)"
      />
    </FormField>
    <div className="flex items-center gap-3">
      <Checkbox
        id="workflow-role-active"
        checked={form.active}
        disabled={form.isSystem}
        onChange={(checked) => setForm({ ...form, active: checked })}
        label="Active"
      />
      {form.isSystem && (
        <span className="text-[11px] text-slate-400">
          <LockKeyhole className="mr-1 inline h-3 w-3" />
          System role cannot be deactivated
        </span>
      )}
    </div>
  </div>
);

const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
    {children}
  </div>
);
const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400";
