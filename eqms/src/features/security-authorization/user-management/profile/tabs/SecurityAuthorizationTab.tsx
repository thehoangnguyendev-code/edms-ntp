import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  ShieldAlert,
  Eye,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
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
  <div className="flex items-start gap-3">
    {editable ? (
      <Checkbox
        checked={mfaRequiredByAdmin}
        onChange={onMfaRequiredByAdminChange}
        className="mt-0.5 shrink-0"
      />
    ) : mfaRequiredByAdmin ? (
      <Badge color="emerald" size="sm" className="mt-0.5 shrink-0">
        Required
      </Badge>
    ) : (
      <Checkbox checked={false} onChange={() => {}} disabled className="mt-0.5 shrink-0" />
    )}
    <span>
      <span className="block text-sm font-medium text-slate-700">
        Require Multifactor Authentication
      </span>
      <span className="mt-1 block text-xs text-slate-500 max-w-2xl">
        Forces this user to set up MFA (authenticator app or email) before they can use
        the system, even if "Enforce Two-Factor Authentication" is off globally in
        Settings &gt; Security. This only adds a requirement -- it never exempts the user
        from the global setting.
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
  searchQuery: string;
  onSearchChange: (value: string) => void;
  headerAction?: React.ReactNode;
  rows: AccessProfileRow[];
  totalCount: number;
  emptyStateTitle: string;
  emptyStateDescription: string;
  noSearchMatchDescription: string;
}

const AccessProfilesSection: React.FC<AccessProfilesSectionProps> = ({
  eyebrow,
  statLine,
  searchQuery,
  onSearchChange,
  headerAction,
  rows,
  totalCount,
  emptyStateTitle,
  emptyStateDescription,
  noSearchMatchDescription,
}) => (
  <div className="mt-5 pt-5 border-t border-slate-100">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
      <h3 className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-slate-500">{eyebrow}</h3>
      <p className="text-xs text-slate-500">{statLine}</p>
    </div>

    {(totalCount > 0 || headerAction) && (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-3">
        {totalCount > 0 ? (
          <div className="w-full sm:max-w-md">
            <label htmlFor="access-profile-search" className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
              Search
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 transition-colors">
                <Search className="h-4 w-4 text-slate-400 transition-colors" />
              </div>
              <input
                id="access-profile-search"
                type="text"
                placeholder="Search access profiles..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="block h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 md:h-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ) : <div />}
        {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
      </div>
    )}

    {totalCount === 0 ? (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-slate-800 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-900">{emptyStateTitle}</h4>
          <p className="mt-1 text-xs text-amber-800 leading-relaxed">{emptyStateDescription}</p>
        </div>
      </div>
    ) : (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-center text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap w-10 sm:w-12">No.</th>
                <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Access Profile</th>
                <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-center text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <TableEmptyState title="No access profiles match your search" description={noSearchMatchDescription} />
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm text-center text-slate-500 font-medium">
                      {index + 1}
                    </td>
                    <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                          <IconUserKey className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{row.name}</p>
                          <p className="text-2xs text-slate-400 truncate">{row.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                      <Badge color={row.active ? "emerald" : "slate"} size="sm" showDot>
                        {row.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-center whitespace-nowrap">
                      {row.actionSlot}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);

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
        title="View Access Profile Details"
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
        statLine={`${selectedProfileIds.length} profile${selectedProfileIds.length === 1 ? "" : "s"} selected`}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        headerAction={
          <Button variant={selectedProfileIds.length === 0 ? "default" : "default"} size="sm" className="gap-1.5 flex-shrink-0" onClick={() => setIsPickerOpen(true)}>
            {selectedProfileIds.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <IconPencilMinus className="h-3.5 w-3.5" />}
            {selectedProfileIds.length === 0 ? "New Access Profile" : "Edit Access Profile"}
          </Button>
        }
        rows={rows}
        totalCount={selectedProfiles.length}
        emptyStateTitle="No Access Profile Selected"
        emptyStateDescription="Use the button above to choose the Access Profile(s) this user will need."
        noSearchMatchDescription="Try a different search term."
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
  const [summary, setSummary] = useState<UserAuthorizationSummary | null>(null);
  const [workflowRoleLabels, setWorkflowRoleLabels] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isSelf = currentUser?.id === user.id;
  const canEditAccessProfiles = hasPermission("security.access_profiles.assign") && !isSelf;
  const canEditMfaRequirement = canEdit && !isSelf;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [authorizationSummary, workflowRoleCatalog] = await Promise.all([
        settingsApi.getUserAuthorizationSummary(user.id),
        settingsApi.listWorkflowRoleCatalog(),
      ]);
      setSummary(authorizationSummary);
      setWorkflowRoleLabels(
        Object.fromEntries(
          workflowRoleCatalog.map((role: WorkflowRoleCatalogSummary) => [role.code, role.label])
        )
      );
    } catch (error: any) {
      showToast({
        type: "error",
        message:
          error?.response?.status === 403
            ? "You do not have permission to view this user's authorization."
            : "Failed to load authorization summary.",
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProfiles = useMemo(() => {
    if (!summary?.accessProfiles) return [];
    if (!searchQuery.trim()) return summary.accessProfiles;

    const query = searchQuery.toLowerCase().trim();
    return summary.accessProfiles.filter((profile) => {
      const nameMatch = profile.name.toLowerCase().includes(query);
      const codeMatch = profile.code.toLowerCase().includes(query);
      const setMatch = profile.permissionSets.some(
        (set) => set.name.toLowerCase().includes(query)
      );
      const roleMatch = profile.workflowRoles.some((role) =>
        (workflowRoleLabels[role] || role).toLowerCase().includes(query)
      );
      return nameMatch || codeMatch || setMatch || roleMatch;
    });
  }, [summary?.accessProfiles, searchQuery, workflowRoleLabels]);

  if (loading) return <SectionLoading text="Loading security authorization matrix..." minHeight="240px" />;
  if (!summary) return null;

  const rows: AccessProfileRow[] = filteredProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    code: profile.code,
    active: profile.active,
    actionSlot: (
      <button
        onClick={() => navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`)}
        className="h-7 w-7 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
        title="View Access Profile Details"
      >
        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    ),
  }));

  return (
    <div>
      {isSelf && hasPermission("security.access_profiles.assign") && (
        <p className="text-2xs text-slate-400 mb-4">
          Edit disabled for your own account.
        </p>
      )}
      <MfaSection
        mfaRequiredByAdmin={mfaRequiredByAdmin}
        onMfaRequiredByAdminChange={onMfaRequiredByAdminChange}
        editable={isEditingProfile && canEditMfaRequirement}
        disabledReason={isSelf ? "You cannot change your own MFA requirement here -- use Preferences > Security." : undefined}
      />
      <AccessProfilesSection
        eyebrow="Access Profiles"
        statLine={`${summary.effectivePermissionCount} effective permission${summary.effectivePermissionCount === 1 ? "" : "s"}`}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        headerAction={
          canEditAccessProfiles && isEditingProfile ? (
            <Button variant={summary.accessProfiles.length === 0 ? "default" : "default"} size="sm" className="gap-1.5 flex-shrink-0" onClick={() => setIsEditModalOpen(true)}>
              {summary.accessProfiles.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <IconPencilMinus className="h-3.5 w-3.5" />}
              {summary.accessProfiles.length === 0 ? "New Access Profile" : "Edit Access Profile"}
            </Button>
          ) : undefined
        }
        rows={rows}
        totalCount={summary.accessProfiles.length}
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
          currentProfileIds={summary.accessProfiles.map((p) => p.id)}
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
