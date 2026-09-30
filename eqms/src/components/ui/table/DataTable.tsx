import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../utils";
import { TableEmptyState } from "./TableEmptyState";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";

export type DataTableSortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  /** Stable column key; used for React reconciliation and the empty-state colspan. */
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string | ((row: T, index: number) => string);
  sort?: {
    direction?: DataTableSortDirection;
    onSort: () => void;
  };
}

export interface DataTableSelection<T> {
  /** Hide the selection column without changing the table's remaining layout. */
  visible: boolean;
  header?: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  cellClassName?: string;
}

export interface DataTableAction<T> {
  header?: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowKey: (row: T, index: number) => React.Key;
  selection?: DataTableSelection<T>;
  action?: DataTableAction<T>;
  isLoading?: boolean;
  loadingContent?: React.ReactNode;
  emptyState?: React.ReactNode;
  pagination?: React.ReactNode;
  scrollerRef?: React.Ref<HTMLDivElement>;
  scrollProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  className?: string;
  tableClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  onRowClick?: (row: T, index: number) => void;
  onRowKeyDown?: (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    row: T,
    index: number,
  ) => void;
  rowTabIndex?: number;
}

const HEADER_CELL_CLASS =
  "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap";
const CELL_CLASS =
  "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";
const ACTION_HEADER_CLASS =
  "sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap border-b-2 border-slate-200 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]";
const ACTION_CELL_CLASS =
  "sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors";

/**
 * Canonical flat-data table for eQMS registers.
 *
 * It centralizes the visual shell, sticky headers/action column, horizontal drag scrolling,
 * loading/empty states and pagination. Complex editing grids and expandable/matrix tables should
 * keep their own row composition rather than being forced into this flat-row contract.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  selection,
  action,
  isLoading = false,
  loadingContent,
  emptyState,
  pagination,
  scrollerRef,
  scrollProps,
  isDragging = false,
  className,
  tableClassName,
  rowClassName,
  onRowClick,
  onRowKeyDown,
  rowTabIndex,
}: DataTableProps<T>) {
  const visibleSelection = selection?.visible === true;
  const colSpan =
    columns.length + (visibleSelection ? 1 : 0) + (action ? 1 : 0);

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300",
        className,
      )}
    >
      {isLoading ? (
        loadingContent
      ) : (
        <div
          ref={scrollerRef}
          className={cn(
            "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
            isDragging ? "cursor-grabbing select-none" : "cursor-grab",
          )}
          {...scrollProps}
        >
          <TableMarkup.Root
            className={cn(
              "w-full min-w-max border-spacing-0 text-left",
              tableClassName,
            )}
          >
            <TableMarkup.Head>
              <TableMarkup.Row>
                {visibleSelection && (
                  <TableMarkup.HeaderCell className={cn(HEADER_CELL_CLASS, "w-9")}>
                    {selection?.header}
                  </TableMarkup.HeaderCell>
                )}
                {columns.map((column) => (
                  <TableMarkup.HeaderCell
                    key={column.id}
                    onClick={column.sort?.onSort}
                    className={cn(
                      HEADER_CELL_CLASS,
                      column.sort &&
                        "cursor-pointer hover:bg-slate-100 transition-colors group",
                      column.headerClassName,
                    )}
                  >
                    {column.sort ? (
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">{column.header}</span>
                        <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                          <ChevronUp
                            className={cn(
                              "h-3 w-3 -mb-1",
                              column.sort.direction === "asc" &&
                                "text-emerald-600",
                            )}
                          />
                          <ChevronDown
                            className={cn(
                              "h-3 w-3",
                              column.sort.direction === "desc" &&
                                "text-emerald-600",
                            )}
                          />
                        </div>
                      </div>
                    ) : (
                      column.header
                    )}
                  </TableMarkup.HeaderCell>
                ))}
                {action && (
                  <TableMarkup.HeaderCell
                    className={cn(ACTION_HEADER_CLASS, action.headerClassName)}
                  >
                    {action.header ?? "Action"}
                  </TableMarkup.HeaderCell>
                )}
              </TableMarkup.Row>
            </TableMarkup.Head>
            <TableMarkup.Body className="bg-white">
              {rows.length === 0 ? (
                <TableMarkup.Row>
                  <TableMarkup.Cell
                    colSpan={colSpan}
                    className="py-12 text-center border-b border-slate-200"
                  >
                    {emptyState ?? <TableEmptyState />}
                  </TableMarkup.Cell>
                </TableMarkup.Row>
              ) : (
                rows.map((row, index) => (
                  <TableMarkup.Row
                    key={getRowKey(row, index)}
                    onClick={() => onRowClick?.(row, index)}
                    onKeyDown={(event) => onRowKeyDown?.(event, row, index)}
                    tabIndex={onRowClick ? rowTabIndex : undefined}
                    className={cn(
                      "transition-colors group hover:bg-slate-50/80",
                      typeof rowClassName === "function"
                        ? rowClassName(row, index)
                        : rowClassName,
                    )}
                  >
                    {visibleSelection && (
                      <TableMarkup.Cell className={cn(CELL_CLASS, selection?.cellClassName)}>
                        {selection?.cell(row, index)}
                      </TableMarkup.Cell>
                    )}
                    {columns.map((column) => (
                      <TableMarkup.Cell
                        key={column.id}
                        className={cn(
                          CELL_CLASS,
                          typeof column.cellClassName === "function"
                            ? column.cellClassName(row, index)
                            : column.cellClassName,
                        )}
                      >
                        {column.cell(row, index)}
                      </TableMarkup.Cell>
                    ))}
                    {action && (
                      <TableMarkup.Cell
                        onClick={(event) => event.stopPropagation()}
                        className={cn(ACTION_CELL_CLASS, action.cellClassName)}
                      >
                        {action.cell(row, index)}
                      </TableMarkup.Cell>
                    )}
                  </TableMarkup.Row>
                ))
              )}
            </TableMarkup.Body>
          </TableMarkup.Root>
        </div>
      )}
      {!isLoading && rows.length > 0 && pagination}
    </div>
  );
}
