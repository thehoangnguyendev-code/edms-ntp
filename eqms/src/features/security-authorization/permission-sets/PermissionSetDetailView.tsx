import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Grid3X3, KeyRound, ShieldCheck, Users, Clock,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { FormSection } from "@/components/ui/form/FormSection";
import { useToast } from "@/components/ui/toast";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useTableDragScroll } from "@/hooks";
import { cn } from "@/components/ui/utils";
import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { permissionSetDetail as permissionSetDetailBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { PermissionSetCloneModal } from "./PermissionSetCloneModal";
import { settingsApi } from "@/services/api";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import type { PermissionSetAssignedAccessProfile, PermissionSetResponse } from "@/services/api/settings";
import type { PermissionGroup } from "@/features/security-authorization/shared/permission-types";
import { formatDateUS } from "@/utils/format";
import { IconChartColumn } from "@tabler/icons-react";

type TabId = "general" | "permissions" | "access-profiles" | "audit";

const TABS: TabItem[] = [
  { id: "general",         label: "General" },
  { id: "permissions",     label: "Permissions" },
  { id: "access-profiles", label: "Assigned Access Profiles" },
  { id: "audit",           label: "Audit Trail" },
];

const getModuleLabels = (permissionSet: PermissionSetResponse, groups: PermissionGroup[]) => {
  const lookup = new Map<string, string>();
  groups.forEach((group) => {
    group.permissions.forEach((p) => lookup.set(p.id, p.module));
  });
  return [...new Set(
    permissionSet.permissionCodes.map((code) => lookup.get(code)).filter((v): v is string => Boolean(v))
  )];
};

const inferCategory = (mods: string[]) => {
  if (mods.length === 0) return "Uncategorized";
  if (mods.length > 1) return "Multi-Module";
  const m = mods[0].toLowerCase();
  if (m.includes("document")) return "Document Management";
  if (m.includes("training")) return "Training";
  if (m.includes("deviation") || m.includes("capa") || m.includes("change")) return "Quality";
  if (m.includes("report")) return "Reporting";
  if (m.includes("admin") || m.includes("security")) return "Administration";
  return mods[0];
};

const safeDate = (val?: string | null) => {
  if (!val) return "—";
  try { return formatDateUS(val); } catch { return val; }
};

// ── Main View ──────────────────────────────────────────────────────────────────

export const PermissionSetDetailView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const { permissionGroups, isLoading: catalogLoading } = usePermissionCatalog();

  const [permissionSet, setPermissionSet] = React.useState<PermissionSetResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [cloneModal, setCloneModal] = useState(false);
  const [assignedProfiles, setAssignedProfiles] = React.useState<PermissionSetAssignedAccessProfile[]>([]);
  const [assignedProfilesLoading, setAssignedProfilesLoading] = React.useState(true);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    settingsApi.getPermissionSet(id)
      .then(setPermissionSet)
      .catch(() => showToast({ type: "error", message: "Failed to load permission set" }))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  React.useEffect(() => {
    if (!id) return;
    setAssignedProfilesLoading(true);
    settingsApi.getPermissionSetAssignedAccessProfiles(id)
      .then(setAssignedProfiles)
      .catch(() => setAssignedProfiles([]))
      .finally(() => setAssignedProfilesLoading(false));
  }, [id]);

  const assignedUserCount = useMemo(
    () => assignedProfiles.reduce((sum, p) => sum + p.userCount, 0),
    [assignedProfiles]
  );

  const modules = useMemo(() => {
    if (!permissionSet) return [];
    return getModuleLabels(permissionSet, permissionGroups);
  }, [permissionSet, permissionGroups]);

  const category = useMemo(() => inferCategory(modules), [modules]);

  const selectedCodes = useMemo(
    () => new Set(permissionSet?.permissionCodes ?? []),
    [permissionSet]
  );

  const handleBack = () => navigateBack(navigate, location.state, ROUTES.SECURITY.PERMISSION_SETS);

  // ── Loading / Not Found ───────────────────────────────────────────────────

  if (loading || catalogLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Shared Permission Set Details"
          breadcrumbItems={permissionSetDetailBreadcrumb(navigate)}
          actions={<Button size="sm" variant="outline-emerald" onClick={handleBack}>Back</Button>}
        />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!permissionSet) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Shared Permission Set Details"
          breadcrumbItems={permissionSetDetailBreadcrumb(navigate)}
          actions={<Button size="sm" variant="outline-emerald" onClick={handleBack}>Back</Button>}
        />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center gap-3">
          <KeyRound className="h-12 w-12 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Shared permission set not found</p>
          <p className="text-xs text-slate-400">The requested shared permission set does not exist or has been deleted.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleBack}>Back to Shared Permission Sets</Button>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Shared Permission Set Details"
        breadcrumbItems={permissionSetDetailBreadcrumb(navigate)}
        actions={
          <>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={handleBack}>
              Back
            </Button>
            {!permissionSet.system && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap gap-2"
                onClick={() => navigate(`${ROUTES.SECURITY.PERMISSION_SETS}/${id}/edit`)}
              >
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap gap-2"
              onClick={() => setCloneModal(true)}
            >
              Clone
            </Button>
          </>
        }
      />

      {/* Match the Access Profile detail summary: identity on the left, statistics on the right. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-50 via-white to-slate-50 px-4 py-5 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100/70">
                <KeyRound className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{permissionSet.name}</h2>
              <Badge color={permissionSet.system ? "blue" : "slate"} size="xs">
                {permissionSet.system ? "System" : "Custom"}
              </Badge>
              <Badge color={permissionSet.active ? "emerald" : "slate"} size="xs" showDot pill>
                {permissionSet.active ? "Active" : "Inactive"}
              </Badge>
              <Badge color="slate" size="xs">{permissionSet.code}</Badge>
            </div>
            {permissionSet.description && (
              <p className="mt-1 text-sm text-slate-500 max-w-2xl">{permissionSet.description}</p>
            )}
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
              {[
                { icon: <Grid3X3 className="h-4 w-4 text-sky-600" />, label: "Modules", value: modules.length },
                { icon: <KeyRound className="h-4 w-4 text-emerald-600" />, label: "Permissions", value: permissionSet.permissionCount },
                { icon: <ShieldCheck className="h-4 w-4 text-blue-500" />, label: "Access Profiles", value: assignedProfiles.length },
                { icon: <Users className="h-4 w-4 text-purple-500" />, label: "Users", value: assignedUserCount },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex min-w-[112px] flex-col items-center rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    {icon}
                    <span className="text-base font-bold text-slate-800">{value}</span>
                  </div>
                  <span className="mt-0.5 whitespace-nowrap text-2xs text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />

        <div className="p-4 sm:p-5">

          {/* ── General ─────────────────────────────────────────────────── */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <FormSection title="Basic Information" icon={<Info className="h-4 w-4" />} contentClassName="p-4 md:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Name</p>
                    <p className="text-sm font-semibold text-slate-900">{permissionSet.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Code</p>
                    <p className="text-sm text-slate-700">{permissionSet.code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Type</p>
                    <Badge color={permissionSet.system ? "blue" : "slate"} size="sm">
                      {permissionSet.system ? "System" : "Custom"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Status</p>
                    <Badge color={permissionSet.active ? "emerald" : "slate"} size="sm" showDot pill>
                      {permissionSet.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Category</p>
                    <p className="text-sm text-slate-700">{category}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Description</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line">
                      {permissionSet.description || <span className="text-slate-400">No description provided.</span>}
                    </p>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Metadata" icon={<IconChartColumn className="h-4 w-4" />} contentClassName="p-4 md:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Created By</p>
                    <p className="text-sm text-slate-700">—</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Created Date</p>
                    <p className="text-sm text-slate-700">{safeDate(permissionSet.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Updated By</p>
                    <p className="text-sm text-slate-700">—</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Updated Date</p>
                    <p className="text-sm text-slate-700">{safeDate(permissionSet.updatedAt)}</p>
                  </div>
                </div>
              </FormSection>
            </div>
          )}

          {/* ── Modules ─────────────────────────────────────────────────── */}

          {/* ── Permissions ──────────────────────────────────────────────── */}
          {activeTab === "permissions" && (
            <PermissionSplitExplorer
              groups={permissionGroups}
              selectedCodes={selectedCodes}
              onToggle={() => {}}
              readOnly
              isLoading={catalogLoading}
            />
          )}

          {/* ── Access Profiles ───────────────────────────────────────────── */}
          {activeTab === "access-profiles" && (
            <div className="space-y-4">
              <FormSection
                title="Assigned Access Profiles"
                icon={<Users className="h-4 w-4" />}
                description="Access Profiles are managed from the Access Profiles module."
                contentClassName="p-4 md:p-5"
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {assignedProfilesLoading ? "Loading…" : `${assignedProfiles.length} Assigned Access Profile${assignedProfiles.length === 1 ? "" : "s"}`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {assignedProfilesLoading
                        ? "Fetching assignments…"
                        : assignedProfiles.length === 0
                          ? "This permission set is not linked to any Access Profile."
                          : `Linked to ${assignedUserCount} user${assignedUserCount === 1 ? "" : "s"} across ${assignedProfiles.length} profile${assignedProfiles.length === 1 ? "" : "s"}.`}
                    </p>
                  </div>
                  <Button
                    variant="outline-emerald"
                    size="sm"
                    onClick={() => navigate(ROUTES.SECURITY.ACCESS_PROFILES)}
                    className="shrink-0 gap-1.5"
                  >
                    Manage
                  </Button>
                </div>
              </FormSection>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div
                  ref={scrollerRef as React.RefObject<HTMLDivElement>}
                  className={cn("overflow-x-auto", isDragging ? "cursor-grabbing select-none" : "cursor-grab")}
                  {...dragEvents}
                >
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="sticky top-0 z-10 border-b-2 border-slate-200 bg-slate-50">
                    <tr>
                      {["No.", "Access Profile", "Business Unit", "Department", "Users", "Status"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {assignedProfilesLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Loading…</td>
                      </tr>
                    ) : assignedProfiles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10">
                          <TableEmptyState
                            icon={<Users className="h-8 w-8 text-slate-300" />}
                            title="No Access Profiles assigned"
                            description="Assign this permission set to an Access Profile from the Access Profiles module."
                          />
                        </td>
                      </tr>
                    ) : assignedProfiles.map((profile, idx) => (
                      <tr key={profile.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${profile.id}`)}
                            className="text-sm font-medium text-emerald-700 hover:underline"
                          >
                            {profile.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{profile.businessUnitScope || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{profile.departmentScope || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{profile.userCount}</td>
                        <td className="px-4 py-3">
                          <Badge color={profile.active ? "emerald" : "slate"} size="xs" showDot pill>
                            {profile.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Audit Trail ───────────────────────────────────────────────── */}
          {activeTab === "audit" && (
            <AuditTrailTab entityId={permissionSet.id} entityType="PERMISSION_SET" />
          )}

        </div>
      </div>

      {/* Clone modal */}
      {cloneModal && (
        <PermissionSetCloneModal
          isOpen
          source={permissionSet}
          onClose={() => setCloneModal(false)}
          onCloned={() => { setCloneModal(false); }}
        />
      )}
    </div>
  );
};
