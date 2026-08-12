import React from "react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { PermissionActionRow } from "./PermissionActionRow";
import type { Permission, PermissionGroup } from "../../access-profiles/types";

interface PermissionResourceGroupProps {
  group: PermissionGroup;
  selectedCodes: Set<string>;
  onToggle: (code: string, checked: boolean) => void;
  readOnly?: boolean;
  /** Single-choice pickers must not expose a group-level bulk selection action. */
  showSelectAll?: boolean;
  /** Master-detail pickers display the module in their left navigation, not a repeated resource heading. */
  hideHeader?: boolean;
  filteredPermissionIds?: Set<string> | null;
  /** Codes that render checked but cannot be changed here (granted via a shared set). */
  lockedCodes?: Set<string>;
  /** Tooltip explaining the shared set that grants a locked permission. */
  lockedNotes?: Map<string, string>;
}

/**
 * A permanently expanded resource section. Permission assignment must never require
 * opening an accordion: every matching permission is visible to the administrator.
 */
export const PermissionResourceGroup: React.FC<
  PermissionResourceGroupProps
> = ({
  group,
  selectedCodes,
  onToggle,
  readOnly = false,
  showSelectAll = true,
  hideHeader = false,
  filteredPermissionIds,
  lockedCodes,
  lockedNotes,
}) => {
  const uniquePermissions = React.useMemo(() => {
    const seen = new Map<string, Permission>();
    for (const permission of group.permissions) {
      if (!seen.has(permission.id)) seen.set(permission.id, permission);
    }
    return [...seen.values()];
  }, [group.permissions]);

  const visiblePermissions = filteredPermissionIds
    ? uniquePermissions.filter((permission) =>
        filteredPermissionIds.has(permission.id),
      )
    : uniquePermissions;

  if (visiblePermissions.length === 0) return null;

  const selectedCount = visiblePermissions.filter((permission) =>
    selectedCodes.has(permission.id),
  ).length;
  const allSelected = selectedCount === visiblePermissions.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const handleSelectAll = () => {
    const nextChecked = !allSelected;
    visiblePermissions.forEach((permission) => {
      if (lockedCodes?.has(permission.id)) return;
      onToggle(permission.id, nextChecked);
    });
  };

  return (
    <section
      className={
        hideHeader
          ? "mb-1 last:mb-0"
          : "mb-4 border-b border-slate-100 pb-3 last:mb-0 last:border-b-0 last:pb-0"
      }
    >
      {!hideHeader && (
        <div className="flex w-full items-center gap-2 px-3 py-1.5">
          {!readOnly && showSelectAll && (
            <span
              title={
                allSelected ? "Deselect all in group" : "Select all in group"
              }
            >
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                className="min-h-0"
              />
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group.name}
          </span>
          <span className="text-xs text-slate-400">
            ({selectedCount}/{visiblePermissions.length})
          </span>
        </div>
      )}

      <div className="space-y-0.5 pl-1">
        {visiblePermissions.map((permission) => (
          <PermissionActionRow
            key={permission.id}
            permission={permission}
            checked={selectedCodes.has(permission.id)}
            onChange={onToggle}
            disabled={readOnly}
            locked={lockedCodes?.has(permission.id) ?? false}
            lockedNote={lockedNotes?.get(permission.id)}
          />
        ))}
      </div>
    </section>
  );
};
