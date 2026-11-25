import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldAlert,
  Eye,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useToast } from "@/components/ui/toast";
import { ROUTES } from "@/app/routes.constants";
import {
  settingsApi,
  type AccessProfileResponse,
  type UserAuthorizationSummary,
  type WorkflowRoleCatalogSummary,
} from "@/services/api/settings";
import type { User } from "../../types";
import { IconPencilMinus, IconUserKey } from "@tabler/icons-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { EditAccessProfilesModal } from "../components/EditAccessProfilesModal";
import { DataTable, useCustomColumnLayout } from "@/components/ui/table";
import type { DataTableColumn } from "@/components/ui/table";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { IconTile } from "@/components/ui/icon-tile";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr, trPlural } from "@/i18n";

/** One normalized table row, shared by both modes so the Access Profiles table renders
 *  identically in the Add New User flow and the Detail/Edit screen -- only the Action column's
 *  content (and where the rows come from) actually differs between them. */
interface AccessProfileRow {
  id: string;
  name: string;
  code: string;
  active: boolean;
  actionSlot: React.ReactNode;
}

interface MfaSectionProps {
  mfaRequiredByAdmin: boolean;
  onMfaRequiredByAdminChange: (value: boolean) => void;
  /** True while the field is actually editable (page-level Edit mode in "existing" mode; always
   *  true in "create" mode since the whole page is a draft until submitted). */
  editable: boolean;
  disabledReason?: string;
}

const MfaSection: React.FC<MfaSectionProps> = ({ mfaRequiredByAdmin, onMfaRequiredByAdminChange, editable, disabledReason }) => (
  <div className="flex w-full items-start gap-3">
    {editable ? (
      <Checkbox
        checked={mfaRequiredByAdmin}
        onChange={onMfaRequiredByAdminChange}
        className="mt-0.5 shrink-0"
      />
    ) : mfaRequiredByAdmin ? (
      <Badge color="emerald" size="sm" className="mt-0.5 shrink-0">
        {tr("Required")}
      </Badge>
    ) : (
      <Checkbox checked={false} onChange={() => {}} disabled className="mt-0.5 shrink-0" />
    )}
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-slate-700">
        {tr("Require Multifactor Authentication")}
      </span>
      <span className="mt-1 block text-xs text-slate-500">
        {tr("The user must set up MFA before using the system, even if Two-Factor Authentication is off globally.")}
      </span>
      {disabledReason && (
        <span className="mt-1.5 block text-2xs text-slate-400">{disabledReason}</span>
      )}
    </span>
  </div>
);

interface AccessProfilesSectionProps {
  eyebrow: string;
  statLine: string;
  /** Names the saved Custom Column layout of this table. */
  tableKey: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  headerAction?: React.ReactNode;
  rows: AccessProfileRow[];
  totalCount: number;
  rowOffset?: number;
  isLoading?: boolean;
  /** The table's own pagination, drawn inside its frame like every other table. */
  pagination?: React.ReactNode;
  emptyStateTitle: string;
  emptyStateDescription: string;
  noSearchMatchDescription: string;
}

const AccessProfilesSection: React.FC<AccessProfilesSectionProps> = ({
  eyebrow,
  statLine,
  tableKey,
  searchQuery,
  onSearchChange,
  headerAction,
  rows,
  totalCount,
  rowOffset = 0,
  isLoading,
  pagination,
  emptyStateTitle,
  emptyStateDescription,
  noSearchMatchDescription,
}) => {
  const columns: DataTableColumn<AccessProfileRow>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_row, index) => rowOffset + index + 1 },
    {
      id: "profile",
      header: tr("Access Profile"),
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <IconTile size="sm" color="emerald" icon={<IconUserKey className="h-3.5 w-3.5" />} />
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-2xs text-slate-400">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge color={flagColor(row.active)} size="sm">
          {row.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];
  const action = { header: "Action", cell: (row: AccessProfileRow) => row.actionSlot };
  const { layout, control } = useCustomColumnLayout(tableKey, columns, action);

  return (
    <div className="mt-5 pt-5 border-t border-slate-100">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
        <h3 className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-slate-500">{eyebrow}</h3>
        <p className="text-xs text-slate-500">{statLine}</p>
      </div>

      {totalCount === 0 ? (
        <>
          {headerAction && <div className="mb-3 flex justify-end">{headerAction}</div>}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-slate-800 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">{emptyStateTitle}</h4>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">{emptyStateDescription}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">{tr("Search")}</label>
              <FilterSearchInput
                aria-label={tr("Search access profiles")}
                placeholder={tr("Search access profiles...")}
                value={searchQuery}
                onChange={onSearchChange}
                debounceMs={0}
              />
            </div>
            {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
            {control}
          </div>
          <DataTable
            rows={rows}
            columns={columns}
            columnLayout={layout}
            action={action}
            getRowKey={(row) => row.id}
            isLoading={isLoading}
            emptyState={<TableEmptyState title={tr("No access profiles found")} description={noSearchMatchDescription} />}
            pagination={pagination}
          />
        </>
      )}
    </div>
  );
};

interface ExistingModeProps {
  mode?: "existing";
  user: User;
  canEdit?: boolean;
  /** Current MFA requirement value, driven by the page-level edit draft in UserProfileView --
   *  this tab no longer owns its own save cycle for it (see useUserProfile#PAGE_EDITABLE_FIELDS). */
  mfaRequiredByAdmin: boolean;
  /** True while the page-level "Edit" mode (title bar) is active. */
  isEditingProfile: boolean;
  onMfaRequiredByAdminChange: (value: boolean) => void;
}

interface CreateModeProps {
  mode: "create";
  mfaRequiredByAdmin: boolean;
  onMfaRequiredByAdminChange: (value: boolean) => void;
  /** Full active Access Profile catalog to pick from -- already loaded page-level in
   *  AddUserView (no per-user assignment exists yet to fetch). */
  allProfiles: AccessProfileResponse[];
  selectedProfileIds: string[];
  onSelectionChange: (ids: string[]) => void;
  selectionError?: string;
}

type Props = ExistingModeProps | CreateModeProps;

const CreateModeSecurityTab: React.FC<CreateModeProps> = ({
  mfaRequiredByAdmin,
  onMfaRequiredByAdminChange,
  allProfiles,
  selectedProfileIds,
  onSelectionChange,
  selectionError,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const selectedProfiles = useMemo(
    () => selectedProfileIds
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter((p): p is AccessProfileResponse => Boolean(p)),
    [allProfiles, selectedProfileIds],
  );

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return selectedProfiles;
    return selectedProfiles.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [selectedProfiles, searchQuery]);

  const rows: AccessProfileRow[] = filteredProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    code: profile.code,
    active: profile.active,
    actionSlot: (
      <button
        onClick={() => navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`)}
        className="h-7 w-7 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
        title={tr("View Access Profile Details")}
      >
        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    ),
  }));

  return (
    <div>
      <MfaSection
        mfaRequiredByAdmin={mfaRequiredByAdmin}
        onMfaRequiredByAdminChange={onMfaRequiredByAdminChange}
        editable
      />
      <AccessProfilesSection
        eyebrow="Access Profiles"
        tableKey="security.user-access-profiles.create"
        statLine={trPlural(selectedProfileIds.length, "{count} profile selected", "{count} profiles selected")}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        headerAction={
          <Button variant={selectedProfileIds.length === 0 ? "default" : "default"} size="sm" className="gap-1.5 flex-shrink-0" onClick={() => setIsPickerOpen(true)}>
            {selectedProfileIds.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <IconPencilMinus className="h-3.5 w-3.5" />}
            {selectedProfileIds.length === 0 ? tr("New Access Profile") : tr("Edit Access Profile")}
          </Button>
        }
        rows={rows}
        totalCount={selectedProfiles.length}
emptyStateTitle={tr("No Access Profile Selected")}
          emptyStateDescription={tr("Use the button above to choose the Access Profile(s) this user will need.")}
        noSearchMatchDescription={tr("Try a different search term.")}
      />
      {selectionError && <p className="text-xs text-red-600 mt-2">{selectionError}</p>}
      <EditAccessProfilesModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        userName="this user"
        currentProfileIds={selectedProfileIds}
        allProfiles={allProfiles}
        onSaveLocal={onSelectionChange}
      />
    </div>
  );
};

const ExistingModeSecurityTab: React.FC<ExistingModeProps> = ({
  user,
  canEdit = false,
  mfaRequiredByAdmin,
  isEditingProfile,
  onMfaRequiredByAdminChange,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof settingsApi.queryUserAuthorizationSummary>> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const search = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const generation = useRef(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isSelf = currentUser?.id === user.id;
  const canEditAccessProfiles = hasPermission("security.access_profiles.assign") && !isSelf;
  const canEditMfaRequirement = canEdit && !isSelf;

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const result = await settingsApi.queryUserAuthorizationSummary(user.id, { search: search || undefined, page, limit });
      if (request !== generation.current) return;
      setSummary(result);
      const pages = Math.max(1, result.pagination.totalPages);
      if (page > pages) setPage(pages);
    } catch (error: any) {
      if (request !== generation.current) return;
      setSummary(null);
      showToast({ type: "error", message: error?.response?.status === 403
        ? tr("You do not have permission to view this user's authorization.")
        : tr("Failed to load authorization summary.") });
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [showToast, user.id, search, page, limit]);

  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load]);

  if (loading && !summary) return <SectionLoading text="Loading security authorization matrix..." minHeight="240px" />;
  if (!summary) return null;

  const rows: AccessProfileRow[] = summary.accessProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    code: profile.code,
    active: profile.active,
    actionSlot: (
      <button
        onClick={() => navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`)}
        className="h-7 w-7 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
        title={tr("View Access Profile Details")}
      >
        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    ),
  }));

  return (
    <div>
      {isSelf && hasPermission("security.access_profiles.assign") && (
        <p className="text-2xs text-slate-400 mb-4">
          {tr("Edit disabled for your own account.")}
        </p>
      )}
      <MfaSection
        mfaRequiredByAdmin={mfaRequiredByAdmin}
        onMfaRequiredByAdminChange={onMfaRequiredByAdminChange}
        editable={isEditingProfile && canEditMfaRequirement}
        disabledReason={isSelf ? tr("You cannot change your own MFA requirement here. Use Preferences > Security.") : undefined}
      />
      <AccessProfilesSection
        eyebrow="Access Profiles"
        tableKey="security.user-access-profiles"
        statLine={trPlural(summary.effectivePermissionCount, "{count} effective permission", "{count} effective permissions")}
        searchQuery={searchQuery}
        onSearchChange={(value) => { setSearchQuery(value); setPage(1); }}
        headerAction={
          canEditAccessProfiles && isEditingProfile ? (
            <Button variant={summary.assignedProfileIds.length === 0 ? "default" : "default"} size="sm" className="gap-1.5 flex-shrink-0" onClick={() => setIsEditModalOpen(true)}>
              {summary.assignedProfileIds.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <IconPencilMinus className="h-3.5 w-3.5" />}
              {summary.assignedProfileIds.length === 0 ? tr("New Access Profile") : tr("Edit Access Profile")}
            </Button>
          ) : undefined
        }
        rows={rows}
        totalCount={summary.assignedProfileIds.length}
        rowOffset={(page - 1) * limit}
        isLoading={loading}
        pagination={summary.pagination.total > 0 ? (
          <TablePagination currentPage={page} totalPages={Math.max(1, summary.pagination.totalPages)} totalItems={summary.pagination.total}
            itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(value) => { setLimit(value); setPage(1); }} />
        ) : undefined}
        emptyStateTitle="No Access Profile Assigned"
        emptyStateDescription="This user has no application permissions assigned. Please contact a System Administrator to assign an active Access Profile."
        noSearchMatchDescription={`No results for "${searchQuery}".`}
      />

      {canEditAccessProfiles && (
        <EditAccessProfilesModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          userId={user.id}
          userName={user.fullName}
          currentProfileIds={summary.assignedProfileIds}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
};

export const SecurityAuthorizationTab: React.FC<Props> = (props) => {
  if (props.mode === "create") {
    return <CreateModeSecurityTab {...props} />;
  }
  return <ExistingModeSecurityTab {...props} />;
};
