import React, { useMemo } from "react";
import { VisibilityBox, DetailList } from "./VisibilityBox";
import { VisibilityOptions, type VisibilityOption } from "@/components/ui/radio/VisibilityOptions";
import { classifyModuleVisibility, levelRank, levelCodesOf, type ModuleVisibilityDef } from "./moduleVisibility";
import { tr, trFormat } from "@/i18n";

/**
 * Chooses the record visibility of a module with two levels (Training Management, Reports) on an Access Profile. The choice is written as permissions
 * (see moduleVisibility.ts); a level that comes from a shared Permission Set can only be lowered by taking the set off.
 */
export const ModuleVisibilityPicker: React.FC<{
  def: ModuleVisibilityDef;
  /** Everything the profile grants: its own permissions and those of its shared sets. */
  selectedCodes: ReadonlySet<string>;
  /** The permissions that come from a shared Permission Set. */
  lockedCodes: ReadonlySet<string>;
  lockedNotes?: ReadonlyMap<string, string>;
  disabled?: boolean;
  onChoose: (choice: string) => void;
  className?: string;
}> = ({ def, selectedCodes, lockedCodes, lockedNotes, disabled = false, onChoose, className }) => {
  const current = useMemo(() => classifyModuleVisibility(def, selectedCodes), [def, selectedCodes]);
  const floor = useMemo(() => {
    // the level a shared set already grants: the default level counts as no floor
    const granted = classifyModuleVisibility({ ...def, defaultLevel: null }, lockedCodes);
    return levelRank(def, granted);
  }, [def, lockedCodes]);

  const grantedBy = useMemo(() => {
    const sets = new Set<string>();
    for (const code of levelCodesOf(def)) {
      if (!lockedCodes.has(code)) continue;
      const note = lockedNotes?.get(code);
      if (note) sets.add(note.replace(/^Granted by shared set: /, ""));
    }
    return [...sets].join(", ");
  }, [def, lockedCodes, lockedNotes]);

  const options: VisibilityOption[] = def.levels.map((level, rank) => ({
    value: level.value,
    label: level.label,
    description: level.description,
    disabled: rank < floor,
  }));

  return (
    <VisibilityBox
      title={def.title}
      description={def.description}
      testId={`record-visibility-${def.key.toLowerCase()}`}
      details={<DetailList items={def.details} />}
      className={className}
    >
      <>
        <VisibilityOptions
          name={`record-visibility-${def.key.toLowerCase()}`}
          value={current ?? ""}
          onChange={(value) => onChoose(value)}
          options={options}
          disabled={disabled}
        />
        {current === null && (
          <p className="text-xs text-slate-500">{tr("This profile grants no access to these records yet. Choose a level to grant it.")}</p>
        )}
        {floor > 0 && grantedBy && (
          <p className="text-xs text-slate-500">
            {trFormat("Part of this level is granted by the shared Permission Set {set}. To give the profile a lower level, take that set off the profile.", { set: grantedBy })}
          </p>
        )}
      </>
    </VisibilityBox>
  );
};
