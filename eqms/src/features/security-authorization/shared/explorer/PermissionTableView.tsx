import React, { useMemo } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import type { Permission } from "../permission-types";

interface PermissionTableViewProps {
  permissions: Permission[];
  selectedCodes: Set<string>;
  onToggle: (code: string, checked: boolean) => void;
  /** Whole table is read-only (a read-only profile, or the details view that lists what is granted). */
  disabled: boolean;
  /** Read-only details list only what is granted, so there is no tick column. */
  showTick: boolean;
  isLocked: (code: string) => boolean;
  lockedNotes?: Map<string, string>;
}

/** The table scrolls inside its own frame, so the header stays in view: same height as the cards. */
const SCROLLER_CLASS =
  "flex-1 overflow-x-auto overflow-y-auto max-h-[min(56vh,34rem)] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400";

/**
 * The permissions of one module as a table (the shared `DataTable`, one line each): the same list, selection and locks as the cards (`PermissionSplitExplorer` owns them),
 * drawn for scanning and checking. Each line is numbered and the permission's code is a column of its own; the contents of a line are centred between its top and bottom, and
 * the name of the permission is shown whole on one line (the description is the column that wraps).
 */
export const PermissionTableView: React.FC<PermissionTableViewProps> = ({ permissions, selectedCodes, onToggle, disabled, showTick, isLocked, lockedNotes }) => {
  const columns = useMemo<DataTableColumn<Permission>[]>(() => {
    const list: DataTableColumn<Permission>[] = [
      {
        id: "no",
        header: "No.",
        label: "No.",
        locked: true,
        headerClassName: "w-14",
        cellClassName: "w-14 text-xs tabular-nums text-slate-500",
        cell: (_permission, index) => index + 1,
      },
    ];
    if (showTick) {
      list.push({
        id: "granted",
        header: <span className="sr-only">Granted</span>,
        label: "Granted",
        locked: true,
        headerClassName: "w-12",
        cellClassName: "w-12",
        cell: (permission) => {
          const checked = selectedCodes.has(permission.id);
          const locked = isLocked(permission.id);
          return (
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={`${permission.label}${locked ? " (granted by a shared set)" : ""}`}
              disabled={disabled || locked}
              onClick={(event) => { event.stopPropagation(); onToggle(permission.id, !checked); }}
              className={cn("flex h-5 w-5 items-center justify-center rounded border focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-default", checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white")}
            >
              {checked && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        },
      });
    }
    list.push(
      {
        id: "permission",
        header: "Permission",
        label: "Permission",
        cellClassName: "min-w-[14rem]",
        cell: (permission) => (
          <span title={isLocked(permission.id) ? lockedNotes?.get(permission.id) : permission.id} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
            {permission.label}
            {isLocked(permission.id) && <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />}
          </span>
        ),
      },
      {
        id: "code",
        header: "Code",
        label: "Code",
        cellClassName: "font-mono text-2xs text-slate-600 md:text-xs",
        cell: (permission) => permission.id,
      },
      {
        id: "description",
        header: "Description",
        label: "Description",
        cellClassName: "min-w-[22rem] max-w-[36rem] !whitespace-normal text-xs text-slate-600",
        cell: (permission) => permission.description || "—",
      },
    );
    return list;
  }, [showTick, selectedCodes, disabled, isLocked, lockedNotes, onToggle]);

  return (
    <DataTable
      rows={permissions}
      columns={columns}
      getRowKey={(permission) => permission.id}
      className="rounded-none border-0"
      scrollProps={{ className: SCROLLER_CLASS }}
      rowClassName={(permission) => {
        const checked = selectedCodes.has(permission.id);
        const readOnly = disabled || isLocked(permission.id);
        return cn(checked ? "bg-emerald-50/60" : "bg-white", !readOnly && showTick && "cursor-pointer");
      }}
      onRowClick={(permission) => {
        if (!showTick || disabled || isLocked(permission.id)) return;
        onToggle(permission.id, !selectedCodes.has(permission.id));
      }}
    />
  );
};
