import React from "react";
import { PermissionResourceGroup } from "./PermissionResourceGroup";
import type { PermissionGroup } from "../../access-profiles/types";

interface PermissionModuleAccordionProps {
  moduleName: string;
  groups: PermissionGroup[];
  selectedCodes: Set<string>;
  onToggle: (code: string, checked: boolean) => void;
  readOnly?: boolean;
  /** Retained for callers of the former accordion; sections are now always visible. */
  defaultOpen?: boolean;
  filteredPermissionIds?: Set<string> | null;
}

/**
 * Backward-compatible module section kept for callers outside the current routes.
 * It intentionally has no accordion state: every matching resource group and
 * permission row is rendered immediately.
 */
export const PermissionModuleAccordion: React.FC<PermissionModuleAccordionProps> = ({
  moduleName,
  groups,
  selectedCodes,
  onToggle,
  readOnly = false,
  filteredPermissionIds,
}) => {
  const visibleGroups = groups.filter((group) =>
    group.permissions.some((permission) => !filteredPermissionIds || filteredPermissionIds.has(permission.id)),
  );

  if (visibleGroups.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-3 border-b border-slate-200 px-1 pb-2 text-sm font-semibold text-slate-800">
        {moduleName}
      </h3>
      {visibleGroups.map((group) => (
        <PermissionResourceGroup
          key={group.id}
          group={group}
          selectedCodes={selectedCodes}
          onToggle={onToggle}
          readOnly={readOnly}
          filteredPermissionIds={filteredPermissionIds}
        />
      ))}
    </section>
  );
};
