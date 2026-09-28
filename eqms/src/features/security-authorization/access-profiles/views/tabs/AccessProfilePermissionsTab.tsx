import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import type { PermissionSetResponse } from "@/services/api/settings";
import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";

/**
 * Module-accurate permission matrix for a role. Shows the UNION of everything the
 * role grants: direct permissions (auto-managed ROLE_<code> set — editable here)
 * plus permissions inherited from attached shared sets (checked + locked, with the
 * granting set named in the tooltip). Edits mutate only the direct permissions and
 * are saved by the parent view's single-signature aggregate Save.
 */
export const AccessProfilePermissionsTab: React.FC<{
  profileId: string;
  profileCode: string;
  reloadKey?: number;
  canEdit?: boolean;
  deniedReason?: string;
  onManagedChange?: (codes: string[], dirty: boolean) => void;
}> = ({ profileId, profileCode, reloadKey = 0, canEdit = true, deniedReason, onManagedChange }) => {
  const { showToast } = useToast();
  const { permissionGroups, isLoading: catalogLoading } = usePermissionCatalog();
  const [allSets, setAllSets] = useState<PermissionSetResponse[]>([]);
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [originalDirect, setOriginalDirect] = useState<Set<string>>(new Set());
  const [directCodes, setDirectCodes] = useState<Set<string>>(new Set());

  const managedSetCode = `ROLE_${profileCode}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      settingsApi.listPermissionSets(true), // include the auto-managed ROLE_ set
      settingsApi.getAccessProfile(profileId),
    ])
      .then(([sets, detail]) => {
        if (!active) return;
        setAllSets(sets);
        setAttachedIds(new Set(detail.permissionSets.map((ps) => ps.id)));
        const managed = sets.find((s) => s.code === managedSetCode);
        const direct = new Set(managed?.permissionCodes ?? []);
        setOriginalDirect(direct);
        setDirectCodes(new Set(direct));
        onManagedChange?.([...direct], false);
      })
      .catch(() => showToast({ type: "error", message: "Failed to load Access Profile permissions" }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, reloadKey, showToast]);

  // Codes granted through attached shared sets: shown checked but locked here.
  const { lockedCodes, lockedNotes } = useMemo(() => {
    const locked = new Set<string>();
    const notes = new Map<string, string>();
    for (const set of allSets) {
      if (!attachedIds.has(set.id) || set.code === managedSetCode) continue;
      for (const code of set.permissionCodes) {
        locked.add(code);
        notes.set(code, notes.has(code) ? `${notes.get(code)}, ${set.name}` : `Granted by shared set: ${set.name}`);
      }
    }
    return { lockedCodes: locked, lockedNotes: notes };
  }, [allSets, attachedIds, managedSetCode]);

  const selectedCodes = useMemo(() => {
    const union = new Set(lockedCodes);
    directCodes.forEach((c) => union.add(c));
    return union;
  }, [lockedCodes, directCodes]);

  // Generic across every module AND every resource within it, not hardcoded to Documents or to
  // "module.view" specifically. The app's own convention is that a ".view" permission gates the
  // list/detail PAGE, and the page is where a sibling create/edit/manage/... action's entry point
  // (button) actually lives -- e.g. "+ Add User" lives inside UserManagementView, which requires
  // settings.user.view to even open. Granting settings.user.create without settings.user.view
  // leaves it just as unreachable as documents.document.create without documents.module.view did.
  // Derive every "<prefix>.view" permission from the loaded catalog (27 today, at every
  // granularity: module-level like documents.module.view AND resource-level like
  // settings.user.view) -- reused both to auto-tick the dependency when its sibling is checked
  // (handleToggle below) and, as a safety net, to still warn if a gap exists anyway (e.g. the
  // view permission was unticked afterwards while the sibling stayed checked).
  const viewCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const group of permissionGroups) {
      for (const permission of group.permissions) {
        if (permission.id.endsWith(".view")) codes.add(permission.id);
      }
    }
    return codes;
  }, [permissionGroups]);

  const modulesMissingViewPermission = useMemo(() => {
    const missing: { prefix: string; viewCode: string }[] = [];
    for (const viewCode of viewCodes) {
      const prefix = viewCode.slice(0, -"view".length); // keep trailing "."
      const hasAnyOtherPermissionUnderPrefix = [...selectedCodes].some(
        (code) => code.startsWith(prefix) && code !== viewCode,
      );
      if (hasAnyOtherPermissionUnderPrefix && !selectedCodes.has(viewCode)) {
        missing.push({ prefix, viewCode });
      }
    }
    return missing;
  }, [viewCodes, selectedCodes]);

  const handleToggle = (code: string, checked: boolean) => {
    if (lockedCodes.has(code)) return;
    setDirectCodes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(code);
        // Auto-tick every dependent "<prefix>.view" this code lives behind (e.g. checking
        // settings.user.create also checks settings.user.view) -- like Salesforce's permission
        // dependencies, so the profile can never end up with an action permission whose page is
        // unreachable. Skips codes locked by an attached shared set; those are managed there.
        for (const viewCode of viewCodes) {
          if (viewCode === code || lockedCodes.has(viewCode)) continue;
          const prefix = viewCode.slice(0, -"view".length);
          if (code.startsWith(prefix)) next.add(viewCode);
        }
      } else {
        next.delete(code);
      }
      const dirty = next.size !== originalDirect.size || [...next].some((c) => !originalDirect.has(c));
      onManagedChange?.([...next], dirty);
      return next;
    });
  };

  if (loading) return <SectionLoading />;

  return (
    <div className="space-y-4">
      <WarningBanner
        variant="info"
        description={
          <>
          Everything this Access Profile grants, grouped by module. <b>Direct permissions</b> are ticked/unticked here
          and applied on <b>Save</b> (one electronic signature). Permissions with a lock icon come from an
          attached <b>Shared Permission Set</b> — manage those on the Shared Sets tab. Ticking a permission also
          auto-ticks the "view" permission its page lives behind, so it's never granted unreachable.
          </>
        }
      />
      {!canEdit && (
        <WarningBanner
          variant="warning"
          description={deniedReason || "You can review this Access Profile's permissions, but cannot change them."}
        />
      )}
      {modulesMissingViewPermission.length > 0 && (
        <div className="space-y-2">
          {modulesMissingViewPermission.map(({ prefix, viewCode }) => {
            const label = permissionGroups
              .flatMap((g) => g.permissions)
              .find((p) => p.id === viewCode)?.label ?? viewCode;
            return (
              <WarningBanner
                key={viewCode}
                variant="warning"
                description={
                  <>
                    This profile grants "{prefix}*" permissions but not <b>"{label}" ({viewCode})</b> —
                    likely because {viewCode} was unticked separately after being auto-added (ticking a
                    permission here always auto-adds its required view permission). Without it, the
                    page/menu those permissions live behind is unreachable. Tick {viewCode} back on if
                    this profile should actually be able to use them.
                  </>
                }
              />
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="emerald" size="sm">{directCodes.size} direct</Badge>
        <Badge color="slate" size="sm">{lockedCodes.size} from shared sets</Badge>
        <Badge color="blue" size="sm">{selectedCodes.size} total</Badge>
      </div>
      <PermissionSplitExplorer
        groups={permissionGroups}
        selectedCodes={selectedCodes}
        onToggle={handleToggle}
        readOnly={!canEdit}
        isLoading={catalogLoading}
        lockedCodes={lockedCodes}
        lockedNotes={lockedNotes}
      />
    </div>
  );
};
