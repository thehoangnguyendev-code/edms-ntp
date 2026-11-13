import React from 'react';
import { MoreVertical } from 'lucide-react';
import { PortalDropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown';
import { usePortalDropdown } from '@/hooks';
import type { DataTableAction } from '@/components/ui/table';

export interface RowMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Left out of the menu when true. */
  hidden?: boolean;
}

/**
 * The Action column the other screens have: a MoreVertical button per row and one menu for the open row. Returns the column and the menu to render
 * once next to the table.
 */
export function useRowMenu<T>(rows: readonly T[], getId: (row: T) => string, items: (row: T) => RowMenuItem[]) {
  const menu = usePortalDropdown();
  const openRow = rows.find((row) => getId(row) === menu.openId);
  const shown = openRow ? items(openRow).filter((item) => !item.hidden) : [];

  const action: DataTableAction<T> = {
    cell: (row) => (
      <button
        type="button"
        ref={menu.getRef(getId(row))}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => menu.toggle(getId(row), event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };

  const menuNode = (
    <PortalDropdownMenu isOpen={shown.length > 0} onClose={menu.close} position={menu.position} minWidth={200}>
      <div className="py-1">
        {shown.map((item) => (
          <DropdownMenuItem
            key={item.label}
            icon={item.icon}
            onClick={() => {
              item.onClick();
              menu.close();
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </div>
    </PortalDropdownMenu>
  );
  return { action, menuNode };
}
