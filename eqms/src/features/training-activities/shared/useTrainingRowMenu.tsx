import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import type { DataTableAction } from "@/components/ui/table/DataTable";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";

export interface TrainingRowMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

/**
 * The menu of the last column of a list: a button with three dots that opens a dropdown of the places the row leads to. `build` gives the items of one row; an empty list
 * hides the button for that row.
 */
export function useTrainingRowMenu<T extends { id: string }>(rows: T[], build: (row: T) => TrainingRowMenuItem[]) {
  const menu = usePortalDropdown();
  const action: DataTableAction<T> = {
    cell: (row) => (build(row).length === 0 ? null : (
      <button type="button" ref={menu.getRef(row.id)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(event) => menu.toggle(row.id, event)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    )),
  };
  const open = rows.find((row) => row.id === menu.openId);
  const node = (
    <PortalDropdownMenu isOpen={!!open} onClose={menu.close} position={menu.position} minWidth={230}>
      {open && (
        <div className="py-1">
          {build(open).map((item) => (
            <DropdownMenuItem key={item.label} icon={item.icon} onClick={() => { menu.close(); item.onClick(); }}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </div>
      )}
    </PortalDropdownMenu>
  );
  return { action, node };
}
