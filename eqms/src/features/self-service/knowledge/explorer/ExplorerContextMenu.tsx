import React from "react";
import { DropdownMenuItem, PortalDropdownMenu } from "@/components/ui/dropdown";

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  separatorBefore?: boolean;
}

interface ExplorerContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

const MENU_WIDTH = 224;
const ROW_HEIGHT = 36;
const MARGIN = 8;

/** Right-click menu built on the same dropdown the tables' action menus use. */
export const ExplorerContextMenu: React.FC<ExplorerContextMenuProps> = ({ x, y, actions, onClose }) => {
  const height = actions.length * ROW_HEIGHT + MARGIN;
  const left = Math.max(MARGIN, Math.min(x, window.innerWidth - MENU_WIDTH - MARGIN));
  const top = Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN));

  return (
    <PortalDropdownMenu isOpen onClose={onClose} position={{ top: top + window.scrollY, left: left + window.scrollX }} minWidth={MENU_WIDTH}>
      <div className="py-1" role="menu" aria-label="Actions">
        {actions.map((action) => (
          <React.Fragment key={action.id}>
            {action.separatorBefore && <div role="separator" className="my-1 border-t border-slate-100" />}
            <DropdownMenuItem icon={action.icon} onClick={() => { onClose(); action.onSelect(); }}>
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </div>
    </PortalDropdownMenu>
  );
};
