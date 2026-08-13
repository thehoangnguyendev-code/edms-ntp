import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import type { PermissionSetResponse } from "@/services/api/settings";
import { PermissionSplitExplorer } from "@/features/security-authorization/shared/explorer/PermissionSplitExplorer";
import { usePermissionCatalog } from "@/features/security-authorization/shared/usePermissionCatalog";
import { useTranslation } from "@/i18n";

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
  const { t } = useTranslation();
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
      .catch(() => showToast({ type: "error", message: t("accessProfileTabs.loadPermissionsFailed") }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, reloadKey, showToast, t]);

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

  const handleToggle = (code: string, checked: boolean) => {
    if (lockedCodes.has(code)) return;
    setDirectCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      const dirty = next.size !== originalDirect.size || [...next].some((c) => !originalDirect.has(c));
      onManagedChange?.([...next], dirty);
      return next;
    });
  };

  if (loading) return <SectionLoading />;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700">
          Everything this Access Profile grants, grouped by module. <b>Direct permissions</b> are ticked/unticked here
          and applied on <b>Save</b> (one electronic signature). Permissions with a lock icon come from an
          attached <b>Shared Permission Set</b> — manage those on the Shared Sets tab.
        </p>
      </div>
      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {deniedReason || "You can review this Access Profile's permissions, but cannot change them."}
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
