import React from "react";
import { FileStack } from "lucide-react";
import { IconArrowUpRight, IconCheck, IconChecklist, IconChecks, IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";
import { PortalDropdownMenu, type PortalDropdownMenuProps } from "@/components/ui/dropdown";
import type { Revision } from "./types";
import { revisionRowActions, type RevisionRowAction, type RevisionRowActionOptions } from "./revisionRowActions";

const ROW_ACTION_ITEMS: Record<RevisionRowAction, { icon: React.ReactNode; label: string }> = {
  edit: { icon: <IconPencilMinus className="h-4 w-4" />, label: "Edit Revision" },
  view: { icon: <IconInfoCircle className="h-4 w-4" />, label: "View Details" },
  review: { icon: <IconCheck className="h-4 w-4" />, label: "Review Revision" },
  approve: { icon: <IconChecks className="h-4 w-4" />, label: "Approve Revision" },
  training: { icon: <IconChecklist className="h-4 w-4" />, label: "Training Revision" },
  controlledCopy: { icon: <FileStack className="h-4 w-4" />, label: "Request Controlled Copy" },
  publish: { icon: <IconArrowUpRight className="h-4 w-4" />, label: "Publish Revision" },
};

/** The row's entries for RevisionTableView, which shows the menu button only when there is at least one. */
export const revisionMenuActions = (revision: Revision, options?: RevisionRowActionOptions) =>
  revisionRowActions(revision, options).map((action) => ({ ...ROW_ACTION_ITEMS[action], action }));

interface RevisionRowMenuProps extends RevisionRowActionOptions {
  /** The revision whose menu is open; nothing is drawn without one. */
  revision: Revision | null | undefined;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownMenuProps["position"];
  onAction: (action: RevisionRowAction, revision: Revision) => void;
}

/** The row menu shared by every revision list: what it offers follows the server's answers for this person and this revision. */
export const RevisionRowMenu: React.FC<RevisionRowMenuProps> = ({ revision, isOpen, onClose, position, onAction, publish }) => {
  if (!revision) return null;
  const items = revisionMenuActions(revision, { publish });
  if (items.length === 0) return null;
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={200}>
      <div className="py-1">
        {items.map(({ action, icon, label }) => (
          <button
            key={action}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onAction(action, revision);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </PortalDropdownMenu>
  );
};
