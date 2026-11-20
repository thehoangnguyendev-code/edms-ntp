import React from "react";
import { DocumentControlVisibilityPicker } from "./DocumentControlVisibilityPicker";
import { ModuleVisibilityPicker } from "./ModuleVisibilityPicker";
import { MODULE_VISIBILITY, type ModuleVisibilityDef } from "./moduleVisibility";
import type { DocumentControlVisibilityChoice } from "./documentControlVisibility";

/** The module whose record visibility has three levels (the menu name, as the permission picker shows it). */
export const DOCUMENT_CONTROL_MODULE = "Document Control";

/** True when the module (by its menu name) has a record-visibility choice: Document Control, Training Management and Reports. */
export const hasRecordVisibility = (moduleName: string): boolean =>
  moduleName === DOCUMENT_CONTROL_MODULE || MODULE_VISIBILITY.some((def) => def.moduleName === moduleName);

/**
 * The record-visibility choice that belongs to one module, or nothing for a module that has none (Notifications, Backup & Restore, Audit Trail ...: whoever
 * holds the permission enters). The caller shows it at the top of the permissions of that module, and only once the profile holds a permission of the module.
 */
export const RecordVisibilityForModule: React.FC<{
  moduleName: string;
  /** Everything the profile grants: its own permissions and those of its shared sets. */
  selectedCodes: ReadonlySet<string>;
  /** The permissions that come from a shared Permission Set. */
  lockedCodes: ReadonlySet<string>;
  lockedNotes?: ReadonlyMap<string, string>;
  disabled?: boolean;
  onChooseDocumentControl: (choice: DocumentControlVisibilityChoice) => void;
  onChooseModule: (def: ModuleVisibilityDef, choice: string) => void;
}> = ({ moduleName, selectedCodes, lockedCodes, lockedNotes, disabled, onChooseDocumentControl, onChooseModule }) => {
  if (moduleName === DOCUMENT_CONTROL_MODULE) {
    return <DocumentControlVisibilityPicker selectedCodes={selectedCodes} lockedCodes={lockedCodes} lockedNotes={lockedNotes} disabled={disabled} onChoose={onChooseDocumentControl} />;
  }
  const def = MODULE_VISIBILITY.find((candidate) => candidate.moduleName === moduleName);
  if (!def) return null;
  return (
    <ModuleVisibilityPicker
      def={def}
      selectedCodes={selectedCodes}
      lockedCodes={lockedCodes}
      lockedNotes={lockedNotes}
      disabled={disabled}
      onChoose={(choice) => onChooseModule(def, choice)}
    />
  );
};
