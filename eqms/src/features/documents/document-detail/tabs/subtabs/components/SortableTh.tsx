import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";

export type SortDirection = "asc" | "desc";

interface SortableThProps {
    label: string;
    sortKey: string;
    activeKey: string;
    direction: SortDirection;
    onSort: (key: string) => void;
    /** Responsive visibility classes, e.g. "hidden md:table-cell". */
    className?: string;
}

/** Column header of a server-sorted table: clicking asks the parent to re-query the server with this key. */
export const SortableTh: React.FC<SortableThProps> = ({ label, sortKey, activeKey, direction, onSort, className }) => {
    const active = activeKey === sortKey;
    return (
        <TableMarkup.HeaderCell
            onClick={() => onSort(sortKey)}
            aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
            className={cn(
                "py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 hover:text-slate-700 transition-colors group",
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <span>{label}</span>
                <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                    <ChevronUp className={cn("h-3 w-3 -mb-1", active && direction === "asc" ? "text-emerald-600" : "")} />
                    <ChevronDown className={cn("h-3 w-3", active && direction === "desc" ? "text-emerald-600" : "")} />
                </div>
            </div>
        </TableMarkup.HeaderCell>
    );
};

/** Toggle helper: same key flips the direction, a new key starts ascending. */
export const nextSort = (
    prev: { key: string; direction: SortDirection },
    key: string,
): { key: string; direction: SortDirection } => ({
    key,
    direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
});
