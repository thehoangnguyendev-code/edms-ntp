import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { DropdownMenuItem, PortalDropdownMenu } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";

export interface RowAction {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

/**
 * The three-dots menu of a table row, the same as the other screens (a portal menu under the button). It draws nothing when the row has no action, so there is never a dead button.
 */
export function RowActionsMenu({ id, label, actions }: { id: string; label: string; actions: RowAction[] }) {
  const menu = usePortalDropdown();
  if (actions.length === 0) return null;
  return (
    <>
      <button
        type="button"
        ref={menu.getRef(id)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menu.openId === id}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <PortalDropdownMenu isOpen={menu.openId === id} onClose={menu.close} position={menu.position} minWidth={180}>
        <div className="py-1">
          {actions.map((a) => (
            <DropdownMenuItem
              key={a.key}
              variant={a.danger ? "danger" : "default"}
              icon={a.icon}
              disabled={a.disabled}
              onClick={() => { menu.close(); a.run(); }}
            >
              {a.label}
            </DropdownMenuItem>
          ))}
        </div>
      </PortalDropdownMenu>
    </>
  );
}
