import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from '@/components/ui/filter/ConfiguredDesktopFilters';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { Plus, Download, Search, Copy, MoreVertical, Users, ChevronUp, ChevronDown, Check, X, Trash2, Settings2 } from "lucide-react";
import { IconPencilMinus, IconToggleLeft, IconToggleRight, IconFilter2, IconInfoCircle, IconSparkles } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import type { PortalDropdownPosition } from "@/hooks/usePortalDropdown";
import { usePortalDropdown, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { useDebounce } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { settingsApi, type AccessProfileCapabilitiesResponse, type AccessProfileMigrationReport, type AccessProfileResponse } from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { accessProfiles as accessProfilesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { formatDateTime } from "@/utils/format";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

// ── Action Dropdown ────────────────────────────────────────────────────────────

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  profile: AccessProfileResponse;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  capabilities?: AccessProfileCapabilitiesResponse;
}

const ActionDropdown: React.FC<DropdownProps> = ({
  isOpen, onClose, position, profile, onView, onEdit, onDuplicate, onToggle, onDelete, capabilities,
}) => {
  const can = (action: string) => Boolean(capabilities?.actions?.[action]?.allowed);
  const reason = (action: string) => capabilities?.actions?.[action]?.reason || "Action is not currently allowed";
  const loaded = Boolean(capabilities);
  const run = (action: () => void) => () => {
    action();
    onClose();
  };
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={180}>
      <div className="py-1">
        <DropdownMenuItem
          icon={<IconInfoCircle className="h-4 w-4" />}
          disabled={loaded && !can("view")}
          title={loaded && !can("view") ? reason("view") : undefined}
          onClick={run(onView)}
        >
          View Access
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<IconPencilMinus className="h-4 w-4" />}
          disabled={!loaded || !can("edit")}
          title={loaded && !can("edit") ? reason("edit") : undefined}
          onClick={run(onEdit)}
        >
          Edit Access
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<Copy className="h-4 w-4" />}
          disabled={!loaded || !can("duplicate")}
          title={loaded && !can("duplicate") ? reason("duplicate") : undefined}
          onClick={run(onDuplicate)}
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={profile.active ? <IconToggleRight className="h-4 w-4" /> : <IconToggleLeft className="h-4 w-4" />}
          disabled={!loaded || !can("toggleStatus")}
          title={loaded && !can("toggleStatus") ? reason("toggleStatus") : undefined}
          onClick={run(onToggle)}
        >
          {profile.active ? "Disable" : "Enable"}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<Trash2 className="h-4 w-4" />}
          disabled={!loaded || !can("delete")}
          title={loaded && !can("delete") ? reason("delete") : undefined}
          onClick={run(onDelete)}
        >
          Delete
        </DropdownMenuItem>
      </div>
    </PortalDropdownMenu>
  );
};

// ── Duplicate Modal ────────────────────────────────────────────────────────────

const DuplicateModal: React.FC<{
  isOpen: boolean;
  sourceName: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}> = ({ isOpen, sourceName, onClose, onConfirm }) => {
  const [name, setName] = useState("");
  useEffect(() => { if (isOpen) setName(`${sourceName} (Copy)`); }, [isOpen, sourceName]);
  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => name.trim() && onConfirm(name.trim())}
      title="Duplicate Access Profile"
      description="Enter a name for the new access profile."
      confirmText="Duplicate"
      cancelText="Cancel"
      showCancel
      confirmDisabled={!name.trim()}
      size="md"
    >
      <div>
        <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onConfirm(name.trim())}
          className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
          placeholder="New profile name"
        />
      </div>
    </FormModal>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────────

type SortKey = "name" | "type" | "permissionSetCount" | "assignedUserCount" | "createdAt" | "updatedAt";

const TABLE_COLS: { id: SortKey | "no" | "workflowRoles" | "status" | "action"; label: string; sortable: boolean }[] = [
  { id: "no",               label: "No.",              sortable: false },
  { id: "name",             label: "Access Profile",   sortable: true  },
  { id: "type",             label: "Type",             sortable: true  },
  { id: "status",           label: "Status",           sortable: false },
  { id: "permissionSetCount", label: "Permission Sets", sortable: true },
  { id: "workflowRoles",   label: "Workflow Eligibility",   sortable: false },
  { id: "assignedUserCount", label: "Assigned Users", sortable: true  },
  { id: "createdAt",       label: "Created Date",     sortable: true  },
  { id: "updatedAt",       label: "Last Updated",     sortable: true  },
  { id: "action",          label: "Action",           sortable: false },
];

export const AccessProfileListView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManageRoles = hasPermissionAlias('security.access_profiles.update');

  const [profiles, setProfiles] = useState<AccessProfileResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleCreationModalOpen, setIsRoleCreationModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createdFromDate, setCreatedFromDate] = useState("");
  const [createdToDate, setCreatedToDate] = useState("");
  const [updatedFromDate, setUpdatedFromDate] = useState("");
  const [updatedToDate, setUpdatedToDate] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["type", "status"]));

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });

  React.useLayoutEffect(() => {
    setSearchQuery(searchParams.get("search") ?? "");
    setTypeFilter(searchParams.get("type") ?? "ALL");
    setStatusFilter(searchParams.get("status") ?? "all");
    setCreatedFromDate(searchParams.get("createdFrom") ?? "");
    setCreatedToDate(searchParams.get("createdTo") ?? "");
    setUpdatedFromDate(searchParams.get("updatedFrom") ?? "");
    setUpdatedToDate(searchParams.get("updatedTo") ?? "");
    setCurrentPage(Math.max(1, Number(searchParams.get("page")) || 1));
    setItemsPerPage(Math.max(1, Number(searchParams.get("limit")) || 10));
    const sortKey = searchParams.get("sortBy");
    const allowedSortKeys: SortKey[] = ["name", "type", "permissionSetCount", "assignedUserCount", "createdAt", "updatedAt"];
    setSortConfig({
      key: allowedSortKeys.includes(sortKey as SortKey) ? sortKey as SortKey : "name",
      direction: searchParams.get("sortDir") === "desc" ? "desc" : "asc",
    });
  }, [searchParams]);

  useEffect(() => {
    if (searchQuery !== debouncedSearch) return;
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (createdFromDate) params.set("createdFrom", createdFromDate);
    if (createdToDate) params.set("createdTo", createdToDate);
    if (updatedFromDate) params.set("updatedFrom", updatedFromDate);
    if (updatedToDate) params.set("updatedTo", updatedToDate);
    if (sortConfig.key !== "name") params.set("sortBy", sortConfig.key);
    if (sortConfig.direction !== "asc") params.set("sortDir", sortConfig.direction);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (itemsPerPage !== 10) params.set("limit", String(itemsPerPage));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [searchQuery, debouncedSearch, typeFilter, statusFilter, createdFromDate, createdToDate, updatedFromDate, updatedToDate, sortConfig, currentPage, itemsPerPage, searchParams, setSearchParams]);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; profile: AccessProfileResponse | null }>({ open: false, profile: null });
  const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; profile: AccessProfileResponse | null }>({ open: false, profile: null });
  const [capabilityByProfileId, setCapabilityByProfileId] = useState<Record<string, AccessProfileCapabilitiesResponse>>({});
  const [migrationHealth, setMigrationHealth] = useState<AccessProfileMigrationReport | null>(null);
  const [workflowRoleLabels, setWorkflowRoleLabels] = useState<Record<string, string>>({});

  const hasFilters = !!searchQuery || typeFilter !== "ALL" || statusFilter !== "all" || !!createdFromDate || !!createdToDate || !!updatedFromDate || !!updatedToDate;

  const clearFilters = () => {
    setSearchQuery(""); setTypeFilter("ALL"); setStatusFilter("all");
    setCreatedFromDate(""); setCreatedToDate(""); setUpdatedFromDate(""); setUpdatedToDate(""); setCurrentPage(1);
  };

  const toggleSection = (id: string) => setExpandedSections(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await settingsApi.listAccessProfiles({
        page: currentPage - 1,
        size: itemsPerPage,
        search: debouncedSearch || undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        createdFrom: createdFromDate || undefined,
        createdTo: createdToDate || undefined,
        updatedFrom: updatedFromDate || undefined,
        updatedTo: updatedToDate || undefined,
      });
      setProfiles(res.content ?? []);
      setTotalItems(res.totalElements ?? 0);
      setTotalPages(res.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: "Failed to load access profiles" });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, typeFilter, statusFilter, createdFromDate, createdToDate, updatedFromDate, updatedToDate, showToast]);

  useEffect(() => { void fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => {
    settingsApi.getAccessProfileMigrationReport().then(setMigrationHealth).catch(() => setMigrationHealth(null));
    settingsApi.listWorkflowRoleCatalog()
      .then((roles) => setWorkflowRoleLabels(Object.fromEntries(roles.map((role) => [role.code, role.label]))))
      .catch(() => setWorkflowRoleLabels({}));
  }, []);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedProfiles = [...profiles].sort((a, b) => {
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    switch (sortConfig.key) {
      case "name":               return a.name.localeCompare(b.name) * dir;
      case "type":               return a.type.localeCompare(b.type) * dir;
      case "permissionSetCount": return (a.permissionSetCount - b.permissionSetCount) * dir;
      case "assignedUserCount":  return (a.assignedUserCount - b.assignedUserCount) * dir;
      case "createdAt":          return (a.createdAt ?? "").localeCompare(b.createdAt ?? "") * dir;
      case "updatedAt":          return (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "") * dir;
      default: return 0;
    }
  });

  const handleDelete = async () => {
    if (!deleteModal.profile) return;
    const sig = await requestSignature(`Delete Access Profile "${deleteModal.profile.name}"`, "Access Profile Change");
    if (!sig) return;
    try {
      await settingsApi.deleteAccessProfile(deleteModal.profile.id, sig);
      showToast({ type: "success", message: "Access profile deleted" });
      setDeleteModal({ open: false, profile: null });
      void fetchProfiles();
    } catch {
      showToast({ type: "error", message: "Failed to delete access profile" });
    }
  };

  const handleDuplicate = async (name: string) => {
    if (!duplicateModal.profile) return;
    const sig = await requestSignature(`Duplicate Access Profile "${duplicateModal.profile.name}"`, "Access Profile Change");
    if (!sig) return;
    try {
      await settingsApi.duplicateAccessProfile(duplicateModal.profile.id, name, sig);
      showToast({ type: "success", message: "Access profile duplicated" });
      setDuplicateModal({ open: false, profile: null });
      void fetchProfiles();
    } catch {
      showToast({ type: "error", message: "Failed to duplicate access profile" });
    }
  };

  const handleToggle = async (profile: AccessProfileResponse) => {
    const sig = await requestSignature(`${profile.active ? "Deactivate" : "Activate"} Access Profile "${profile.name}"`, "Access Profile Change");
    if (!sig) return;
    try {
      await settingsApi.toggleAccessProfileStatus(profile.id, sig);
      const caps = await settingsApi.getAccessProfileCapabilities(profile.id);
      setCapabilityByProfileId((prev) => ({ ...prev, [profile.id]: caps }));
      showToast({ type: "success", message: `Access profile ${profile.active ? "disabled" : "enabled"}` });
      void fetchProfiles();
    } catch {
      showToast({ type: "error", message: "Failed to update status" });
    }
  };

  const loadProfileCapabilities = async (profileId: string) => {
    if (capabilityByProfileId[profileId]) return;
    try {
      const caps = await settingsApi.getAccessProfileCapabilities(profileId);
      setCapabilityByProfileId((prev) => ({ ...prev, [profileId]: caps }));
    } catch {
      setCapabilityByProfileId((prev) => ({
        ...prev,
        [profileId]: {
          accessProfileId: profileId,
          actions: {},
        },
      }));
    }
  };

  const handleActionMenuToggle = (profileId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    void loadProfileCapabilities(profileId);
    toggle(profileId, event);
  };

  const isInitialLoading = isLoading && profiles.length === 0;
  const isTableLoading   = isLoading && profiles.length > 0;

  const thBase =
    "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group";

  type ProfileRow = (typeof sortedProfiles)[number];
  const profileColumns: DataTableColumn<ProfileRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: "w-14 text-center", cellClassName: "text-center", cell: (_profile, idx) => (currentPage - 1) * itemsPerPage + idx + 1 },
    {
      id: "name",
      header: "Access Profile",
      label: "Access Profile",
      sort: { direction: sortConfig.key === "name" ? sortConfig.direction : undefined, onSort: () => handleSort("name") },
      cell: (profile) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{profile.name}</p>
          {profile.description && <p className="text-xs text-slate-400 truncate max-w-[220px]">{profile.description}</p>}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      label: "Type",
      sort: { direction: sortConfig.key === "type" ? sortConfig.direction : undefined, onSort: () => handleSort("type") },
      cell: (profile) => (
        <Badge color={profile.type === "SYSTEM" ? "purple" : "slate"} size="sm">
          {profile.type === "SYSTEM" ? "System" : "Custom"}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      label: "Status",
      cell: (profile) => (
        <Badge color={profile.active ? "emerald" : "slate"} size="sm" showDot>
          {profile.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "permissionSetCount",
      header: "Permission Sets",
      label: "Permission Sets",
      sort: { direction: sortConfig.key === "permissionSetCount" ? sortConfig.direction : undefined, onSort: () => handleSort("permissionSetCount") },
      cell: (profile) => (
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="font-medium">{profile.permissionSetCount}</span>
          <span className="text-slate-400 text-xs">sets</span>
        </div>
      ),
    },
    {
      id: "workflowRoles",
      header: "Workflow Eligibility",
      label: "Workflow Eligibility",
      cell: (profile) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {profile.workflowRoles.slice(0, 2).map((r) => (
            <Badge key={r} color="blue" size="sm">{workflowRoleLabels[r] ?? r}</Badge>
          ))}
          {profile.workflowRoles.length > 2 && <Badge color="slate" size="sm">+{profile.workflowRoles.length - 2}</Badge>}
          {profile.workflowRoles.length === 0 && <span className="text-slate-400">—</span>}
        </div>
      ),
    },
    {
      id: "assignedUserCount",
      header: "Assigned Users",
      label: "Assigned Users",
      sort: { direction: sortConfig.key === "assignedUserCount" ? sortConfig.direction : undefined, onSort: () => handleSort("assignedUserCount") },
      cell: (profile) => (
        <div className="flex items-center gap-1.5 text-slate-700">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium">{profile.assignedUserCount}</span>
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Created Date",
      label: "Created Date",
      sort: { direction: sortConfig.key === "createdAt" ? sortConfig.direction : undefined, onSort: () => handleSort("createdAt") },
      cellClassName: "text-slate-600",
      cell: (profile) => (profile.createdAt ? formatDateTime(profile.createdAt) : "—"),
    },
    {
      id: "updatedAt",
      header: "Last Updated",
      label: "Last Updated",
      sort: { direction: sortConfig.key === "updatedAt" ? sortConfig.direction : undefined, onSort: () => handleSort("updatedAt") },
      cellClassName: "text-slate-600",
      cell: (profile) => (profile.updatedAt ? formatDateTime(profile.updatedAt) : "—"),
    },
  ];
  const profileAction: DataTableAction<ProfileRow> = {
    header: "Action",
    cell: (profile) => (
      <>
        <button
          ref={getRef(profile.id)}
          onClick={(e) => handleActionMenuToggle(profile.id, e)}
          className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
        </button>
        <ActionDropdown
          isOpen={openId === profile.id}
          onClose={close}
          position={position}
          profile={profile}
          capabilities={capabilityByProfileId[profile.id]}
          onView={() => navigateTo(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`)}
          onEdit={() => navigateTo(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}/edit`)}
          onDuplicate={() => setDuplicateModal({ open: true, profile })}
          onToggle={() => handleToggle(profile)}
          onDelete={() => setDeleteModal({ open: true, profile })}
        />
      </>
    ),
  };
  const { layout: profileLayout, control: profileControl } = useCustomColumnLayout("access-profiles.list", profileColumns, profileAction);

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {(isNavigating || isInitialLoading) && <FullPageLoading text="Loading…" />}

      <PageHeader
        title="Access Profiles"
        breadcrumbItems={accessProfilesBreadcrumb()}
        actions={
          <>
            <Button variant="outline" size="sm" className="whitespace-nowrap gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            {canManageRoles && (
              <Button size="sm" className="whitespace-nowrap gap-2" onClick={() => setIsRoleCreationModalOpen(true)}>
                <Plus className="h-4 w-4" />
                New Access Profile
              </Button>
            )}
          </>
        }
      />

      <FormModal
        isOpen={isRoleCreationModalOpen}
        onClose={() => setIsRoleCreationModalOpen(false)}
        title="Create Access Profile"
        description="Choose the setup experience that best fits this Access Profile. Both options create a custom Access Profile."
        confirmText="Close"
        onConfirm={() => setIsRoleCreationModalOpen(false)}
        showCancel={false}
        size="xl"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setIsRoleCreationModalOpen(false);
              navigateTo(`${ROUTES.SECURITY.ACCESS_PROFILES}/wizard`);
            }}
            className="group rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 text-left transition-all hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <IconSparkles className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  Guided setup
                  <Badge color="emerald" size="xs">Recommended</Badge>
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  Configure permissions, workflow eligibility, scope and optional user assignments in one guided flow.
                </span>
                <span className="mt-3 inline-flex text-xs font-semibold text-emerald-700 group-hover:underline">Continue with guided setup</span>
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRoleCreationModalOpen(false);
              navigateTo(`${ROUTES.SECURITY.ACCESS_PROFILES}/new`);
            }}
            className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                <Settings2 className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Advanced setup</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  Create the Access Profile identity first, then configure permissions and assignments in separate steps.
                </span>
                <span className="mt-3 inline-flex text-xs font-semibold text-slate-700 group-hover:underline">Continue with advanced setup</span>
              </span>
            </div>
          </button>
        </div>
      </FormModal>

      {migrationHealth && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${migrationHealth.usersWithoutAccessProfile > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-800">Authorization Migration Health</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {migrationHealth.usersWithoutAccessProfile > 0
                  ? `${migrationHealth.usersWithoutAccessProfile} user(s) have no Access Profile and cannot access protected functions until one is assigned.`
                  : "All users have at least one Access Profile. Access Profiles are enforced for protected functions."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge color={migrationHealth.accessProfilesEnforced ? "emerald" : "amber"} size="sm">Access Profiles {migrationHealth.accessProfilesEnforced ? "enforced" : "pending"}</Badge>
              <Badge color="slate" size="sm">{migrationHealth.usersWithProfile}/{migrationHealth.totalUsers} mapped</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Single card: filters + table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">

          {/* Filters — mobile: search + drawer button */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search access profiles…"
                className="w-full pl-9 pr-8 h-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Filters — desktop: 3 columns per row */}
<ConfiguredDesktopFilters
  trailing={<div className="hidden md:block">{profileControl}</div>}
  search={
    <input
      aria-label="Search"
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
      }}
      placeholder={"Search access profiles…"}
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
    />
  }
  filters={[
    {
      id: "typeFilter",
      label: "Type",
      value: String(typeFilter),
      options: [
        { label: "All", value: "ALL" },
        { label: "System", value: "SYSTEM" },
        { label: "Custom", value: "CUSTOM" },
      ],
      onChange: (v) => {
        setTypeFilter(String(v));
        setCurrentPage(1);
      },
    },
    {
      id: "statusFilter",
      label: "Status",
      value: String(statusFilter),
      options: [
        { label: "All", value: "all" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      onChange: (v) => {
        setStatusFilter(String(v));
        setCurrentPage(1);
      },
    },
  ]}
  dates={[
    {
      id: "createdFromDate",
      label: "Created Date Range",
      from: createdFromDate,
      to: createdToDate,
      onFromChange: (v) => {
        setCreatedFromDate(v);
        setCurrentPage(1);
      },
      onToChange: (v) => {
        setCreatedToDate(v);
        setCurrentPage(1);
      },
    },
    {
      id: "updatedFromDate",
      label: "Last Updated Range",
      from: updatedFromDate,
      to: updatedToDate,
      onFromChange: (v) => {
        setUpdatedFromDate(v);
        setCurrentPage(1);
      },
      onToChange: (v) => {
        setUpdatedToDate(v);
        setCurrentPage(1);
      },
    },
  ]}
>
<div className="hidden md:grid md:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
            <div className="w-full">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search access profiles…"
                  className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="w-full">
              <Select
                label="Type"
                value={typeFilter}
                onChange={v => { setTypeFilter(String(v)); setCurrentPage(1); }}
                options={[
                  { label: "All", value: "ALL" },
                  { label: "System",    value: "SYSTEM" },
                  { label: "Custom",    value: "CUSTOM" },
                ]}
              />
            </div>
            <div className="w-full">
              <Select
                label="Status"
                value={statusFilter}
                onChange={v => { setStatusFilter(String(v)); setCurrentPage(1); }}
                options={[
                  { label: "All", value: "all"      },
                  { label: "Active",     value: "active"   },
                  { label: "Inactive",   value: "inactive" },
                ]}
              />
            </div>
            <div className="w-full">
              <DateRangePicker
                label="Created Date Range"
                startDate={createdFromDate}
                endDate={createdToDate}
                onStartDateChange={v => { setCreatedFromDate(v); setCurrentPage(1); }}
                onEndDateChange={v => { setCreatedToDate(v); setCurrentPage(1); }}
                placeholder="Select date range"
              />
            </div>
            <div className="w-full">
              <DateRangePicker
                label="Last Updated Range"
                startDate={updatedFromDate}
                endDate={updatedToDate}
                onStartDateChange={v => { setUpdatedFromDate(v); setCurrentPage(1); }}
                onEndDateChange={v => { setUpdatedToDate(v); setCurrentPage(1); }}
                placeholder="Select last updated range"
              />
            </div>
            <div className="flex items-end gap-2">
              <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} />
              {profileControl}
            </div>
          </div>
</ConfiguredDesktopFilters>

          {/* Mobile FilterDrawer */}
          <FilterDrawer
            isOpen={isFilterDrawerOpen}
            onClose={() => setIsFilterDrawerOpen(false)}
            onClear={clearFilters}
            onApply={() => setIsFilterDrawerOpen(false)}
          >
            <FilterAccordionItem label="Type" isExpanded={expandedSections.has("type")} onToggle={() => toggleSection("type")}>
              <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                {[
                  { label: "All", value: "ALL" },
                  { label: "System",    value: "SYSTEM" },
                  { label: "Custom",    value: "CUSTOM" },
                ].map(opt => (
                  <button key={opt.value} onClick={() => { setTypeFilter(opt.value); setCurrentPage(1); }}
                    className={cn("flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                      typeFilter === opt.value
                        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
                        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300")}>
                    <span className="text-xs">{opt.label}</span>
                    {typeFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                ))}
              </div>
            </FilterAccordionItem>
            <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
              <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                {[
                  { label: "All", value: "all"      },
                  { label: "Active",     value: "active"   },
                  { label: "Inactive",   value: "inactive" },
                ].map(opt => (
                  <button key={opt.value} onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
                    className={cn("flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all",
                      statusFilter === opt.value
                        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
                        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-300")}>
                    <span className="text-xs">{opt.label}</span>
                    {statusFilter === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                ))}
              </div>
            </FilterAccordionItem>
            <FilterAccordionItem label="Created Date Range" isExpanded={expandedSections.has("created")} onToggle={() => toggleSection("created")}>
              <div className="pt-2 pb-4">
                <DateRangePicker
                  label="Created Date Range"
                  startDate={createdFromDate}
                  endDate={createdToDate}
                  onStartDateChange={v => { setCreatedFromDate(v); setCurrentPage(1); }}
                  onEndDateChange={v => { setCreatedToDate(v); setCurrentPage(1); }}
                  placeholder="Select date range"
                />
              </div>
            </FilterAccordionItem>
            <FilterAccordionItem label="Last Updated Range" isExpanded={expandedSections.has("updated")} onToggle={() => toggleSection("updated")}>
              <div className="pt-2 pb-4">
                <DateRangePicker
                  label="Last Updated Range"
                  startDate={updatedFromDate}
                  endDate={updatedToDate}
                  onStartDateChange={v => { setUpdatedFromDate(v); setCurrentPage(1); }}
                  onEndDateChange={v => { setUpdatedToDate(v); setCurrentPage(1); }}
                  placeholder="Select last updated range"
                />
              </div>
            </FilterAccordionItem>
          </FilterDrawer>

          {/* Table area */}
          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}

            <DataTable
              rows={sortedProfiles}
              getRowKey={(profile) => profile.id}
              columns={profileLayout.columns}
              columnLayout={profileLayout}
              action={profileAction}
              scrollerRef={scrollerRef as React.RefObject<HTMLDivElement>}
              scrollProps={dragEvents}
              isDragging={isDragging}
              onRowClick={(profile) => navigateTo(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`)}
              emptyState={
                <TableEmptyState
                  title="No access profiles found"
                  description={hasFilters ? "Try adjusting your search or filters." : "Create your first access profile to get started."}
                />
              }
              pagination={
                totalItems > 0 ? (
                  <div className="border-t border-slate-200">
                    <TablePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      itemsPerPage={itemsPerPage}
                      isLoading={isTableLoading}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                      itemsPerPageOptions={[10, 20, 50]}
                    />
                  </div>
                ) : undefined
              }
            />
          </div>

        </div>
      </div>

      <AlertModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, profile: null })}
        onConfirm={handleDelete}
        type="warning"
        title="Delete Access Profile"
        description={`Are you sure you want to delete "${deleteModal.profile?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />
      <DuplicateModal
        isOpen={duplicateModal.open}
        sourceName={duplicateModal.profile?.name ?? ""}
        onClose={() => setDuplicateModal({ open: false, profile: null })}
        onConfirm={handleDuplicate}
      />
      {isNavigating && <FullPageLoading text="Loading…" />}
      {signatureModal}
    </div>
  );
};
