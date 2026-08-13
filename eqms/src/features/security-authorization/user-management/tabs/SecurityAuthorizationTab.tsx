import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  Building2,
  GitBranch,
  KeyRound,
  Layers,
  ShieldCheck,
  Users,
  Search,
  ArrowRight,
  ShieldAlert,
  Pencil,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { FormSection } from "@/components/ui/form";
import { ROUTES } from "@/app/routes.constants";
import {
  settingsApi,
  type UserAuthorizationSummary,
  type WorkflowRoleCatalogSummary,
} from "@/services/api/settings";
import type { User } from "../types";
import { IconCheck, IconPencilMinus } from "@tabler/icons-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { EditAccessProfilesModal } from "../components/EditAccessProfilesModal";
import { useTranslation } from "@/i18n";

interface Props {
  user: User;
}

export const SecurityAuthorizationTab: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<UserAuthorizationSummary | null>(null);
  const [workflowRoleLabels, setWorkflowRoleLabels] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isSelf = currentUser?.id === user.id;
  const canEditAccessProfiles = hasPermission("security.access_profiles.assign") && !isSelf;

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
            ? t("userAuthorization.permissionDenied")
            : t("userAuthorization.loadFailed"),
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, t, user.id]);

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

  const activeProfilesCount = summary.accessProfiles.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      {/* Hero Header Card — Synchronized System Design */}
      <div className="bg-gradient-to-br from-emerald-50/80 via-white to-slate-50 rounded-xl border border-emerald-100/90 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Effective Security Authorization
                </h3>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Permissions are dynamically evaluated from assigned Access Profiles. Role assignment uses immutable, audited security matrices.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end flex-shrink-0">
            <div className="flex items-center gap-2">
              <Badge color="emerald" size="sm">
                {summary.effectivePermissionCount} Effective Permissions
              </Badge>
              {canEditAccessProfiles && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <IconPencilMinus className="h-3.5 w-3.5" />
                  Edit Access Profiles
                </Button>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {activeProfilesCount} Active Access {activeProfilesCount === 1 ? "Profile" : "Profiles"}
            </span>
            {isSelf && hasPermission("security.access_profiles.assign") && (
              <span className="text-2xs text-slate-400" title="You cannot edit your own access profiles.">
                Edit disabled for your own account
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      {summary.accessProfiles.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search profiles, roles, or permission sets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <span className="text-xs font-medium text-slate-500">
            Showing {filteredProfiles.length} of {summary.accessProfiles.length} Access Profiles
          </span>
        </div>
      )}

      {/* Access Profiles Grid */}
      {summary.accessProfiles.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-slate-800 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">No Access Profile Assigned</h4>
            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
              This user has no application permissions assigned. Please contact a System Administrator to assign an active Access Profile.
            </p>
          </div>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-600">No access profiles match your search &quot;{searchQuery}&quot;.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="mt-3"
          >
            Clear Search Filter
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-2">
          {filteredProfiles.map((profile) => (
            <FormSection
              key={profile.id}
              title={profile.name}
              icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
            >
              <div className="space-y-4">
                {/* Profile Code & Status Badge */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-700">
                      Code: <span className="text-slate-900">{profile.code}</span>
                    </span>
                  </div>
                  <Badge color={profile.active ? "emerald" : "slate"} size="sm" showDot pill>
                    {profile.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Workflow Roles */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Mapped Workflow Roles ({profile.workflowRoles.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {profile.workflowRoles.length ? (
                      profile.workflowRoles.map((code) => (
                        <Badge key={code} color="emerald" size="sm">
                          {workflowRoleLabels[code] ?? code}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs italic text-slate-400">No workflow roles mapped</span>
                    )}
                  </div>
                </div>

                {/* Permission Sets */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                    <span>Permission Sets ({profile.permissionSets.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {profile.permissionSets.length ? (
                      profile.permissionSets.map((set) => (
                        <Badge
                          key={set.id}
                          color={set.active ? "blue" : "amber"}
                          size="sm"
                        >
                          {set.name} ({set.permissionCount})
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs italic text-slate-400">No permission sets assigned</span>
                    )}
                  </div>
                </div>

                {/* Organizational Scopes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100/80 text-xs">
                    <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Business Unit Scope</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {profile.businessUnitScope || "All Business Units"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100/80 text-xs">
                    <Layers className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Department Scope</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {profile.departmentScope || "All Departments"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <Button
                    variant="outline-emerald"
                    size="sm"
                    className="w-full justify-center gap-2 font-semibold"
                    onClick={() => navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`)}
                  >
                    <span>View Access Profile Details</span>
                  </Button>
                </div>
              </div>
            </FormSection>
          ))}
        </div>
      )}

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
