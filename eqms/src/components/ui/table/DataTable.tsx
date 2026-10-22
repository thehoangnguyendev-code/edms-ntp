import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { EXPAND_CONTENT_MOTION, useExpandTransition } from "./expandMotion";
import { cn } from "../utils";
import { TableEmptyState } from "./TableEmptyState";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { useToast } from "@/components/ui/toast";
import { CustomColumnDrawer } from "./CustomColumnDrawer";
import { useStickyPinnedColumns } from "./useStickyPinnedColumns";
import {
  mergeSavedColumns,
  normalizeColumnOrder,
  useTableColumnPreferences,
  type CustomizableColumn,
} from "./useTableColumnPreferences";

export type DataTableSortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  /** Stable column key; used for React reconciliation, the empty-state colspan and saved layouts. */
  id: string;
  header: React.ReactNode;
  /** Plain-text name shown in the Custom Column drawer. Falls back to `header` when it is a string. */
  label?: string;
  /** Locked columns (for example "No.") cannot be hidden, pinned or moved by the user. */
  locked?: boolean;
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

/** Columns already ordered and filtered for the current user, plus the pinned ids from left to right. */
export interface DataTableColumnLayout<T> {
  columns: DataTableColumn<T>[];
  pinnedIds: string[];
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
  /**
   * Shorthand for a self-contained Custom Column toolbar above the table. Prefer `columnLayout` with
   * `useCustomColumnLayout` when the control must sit on the screen's own filter row.
   */
  customizable?: { tableKey: string };
  /** Layout from `useCustomColumnLayout`. When given, it replaces the order and pinning of `columns`. */
  columnLayout?: DataTableColumnLayout<T>;
  /** Controls shown above the table inside its card. */
  toolbar?: React.ReactNode;
  /**
   * Optional detail row shown directly under a data row (for example a permission breakdown).
   * `render` returns null when a row has nothing to show, which keeps that row without a detail band.
   */
  expandedRow?: {
    isExpanded: (row: T, index: number) => boolean;
    render: (row: T, index: number) => React.ReactNode;
    /** false when render() already returns a table row (for example an existing detail row component). */
    asRow?: boolean;
  };
}

const HEADER_CELL_CLASS =
  "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap";
const CELL_CLASS =
  "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";
const ACTION_HEADER_CLASS =
  "sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap border-b-2 border-slate-200 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]";
const ACTION_CELL_CLASS =
  "sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors";

/** The detail row of a table whose `expandedRow.render` returns only the content: the row, its cell and the opening motion. */
function ExpandedRowShell({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  const transition = useExpandTransition();
  return (
    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
      <TableMarkup.Cell colSpan={colSpan} className="bg-slate-50 p-0">
        <motion.div {...EXPAND_CONTENT_MOTION} transition={transition} className="overflow-hidden">
          <div className="p-4">{children}</div>
        </motion.div>
      </TableMarkup.Cell>
    </motion.tr>
  );
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref && typeof ref === "object") (ref as React.MutableRefObject<T | null>).current = value;
}

function plainLabel<T>(column: DataTableColumn<T>): string {
  if (column.label) return column.label;
  return typeof column.header === "string" ? column.header : column.id;
}

/**
 * Per-user Custom Column state for one table. Desktop applies the saved layout; mobile always uses the
 * default columns and no pinning. Returns the ordered columns, the pinned ids, and the control to place
 * anywhere on the screen (typically the filter row).
 */
export function useCustomColumnLayout<T>(
  tableKey: string,
  columns: readonly DataTableColumn<T>[],
  action?: DataTableAction<T>,
): { layout: DataTableColumnLayout<T>; control: React.ReactNode; isDesktop: boolean } {
  const { showToast } = useToast();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const defaults = useMemo<CustomizableColumn[]>(
    () =>
      columns.map((column, index) => ({
        id: column.id,
        label: plainLabel(column),
        visible: true,
        order: index,
        pinned: Boolean(column.locked),
        locked: column.locked,
      })),
    [columns],
  );

  const { columns: saved, saveColumns, resetColumns } = useTableColumnPreferences(tableKey, defaults);

  // Mobile shows the default layout only: no saved order, hiding, or pinning.
  const active = isDesktop ? saved : mergeSavedColumns(defaults, []);
  const ordered = normalizeColumnOrder(active).filter((column) => column.visible);
  const byId = new Map(columns.map((column) => [column.id, column]));
  const shown = ordered
    .map((column) => byId.get(column.id))
    .filter((column): column is DataTableColumn<T> => column !== undefined);
  const pinnedIds = isDesktop ? ordered.filter((column) => column.pinned).map((column) => column.id) : [];

  const fixedActionLabel = action ? (typeof action.header === "string" ? action.header : "Action") : null;

  const control = isDesktop ? (
    <CustomColumnDrawer
      columns={active}
      fixedColumns={fixedActionLabel ? [{ id: "action", label: fixedActionLabel }] : []}
      onApply={async (next) => {
        if (!(await saveColumns(next))) {
          showToast({ type: "error", title: "Column layout not saved", message: "The server did not accept the change. Please try again." });
        }
      }}
      onReset={async () => {
        if (!(await resetColumns())) {
          showToast({ type: "error", title: "Column layout not reset", message: "The server did not accept the change. Please try again." });
        }
      }}
      allowPin
    />
  ) : null;

  return { layout: { columns: shown, pinnedIds }, control, isDesktop };
}

/**
 * Canonical flat-data table for eQMS registers.
 *
 * It centralizes the visual shell, sticky headers/action column, horizontal drag scrolling,
 * loading/empty states and pagination. Pinned columns from `columnLayout` stay fixed while the table
 * scrolls horizontally on desktop. Complex editing grids and matrix tables should keep their own row
 * composition rather than being forced into this flat-row contract.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  if (props.customizable) {
    return <CustomizableDataTable {...props} customizable={props.customizable} />;
  }
  return <DataTableBase {...props} />;
}

function CustomizableDataTable<T>({
  columns,
  action,
  customizable,
  ...rest
}: DataTableProps<T> & { customizable: { tableKey: string } }) {
  const { layout, control } = useCustomColumnLayout(customizable.tableKey, columns, action);
  return (
    <DataTableBase<T>
      {...rest}
      action={action}
      columns={layout.columns}
      columnLayout={layout}
      toolbar={control ? <div className="flex justify-end px-4 pt-3">{control}</div> : undefined}
    />
  );
}

function DataTableBase<T>({
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
  toolbar,
  expandedRow,
  columnLayout,
}: DataTableProps<T>) {
  const visibleSelection = selection?.visible === true;
  const colSpan =
    columns.length + (visibleSelection ? 1 : 0) + (action ? 1 : 0);

  // The scroller mounts after rows load, so it is kept as state to re-run pinning when it appears.
  // Drag-to-scroll (horizontal) belongs to the table, so every screen gets it. A screen that already runs its own useTableDragScroll
  // and passes `scrollProps` keeps using that one: two sets of handlers on the same scroller would fight.
  const ownDragScroll = useTableDragScroll();
  const screenOwnsDragScroll = scrollProps !== undefined;
  const dragging = screenOwnsDragScroll ? isDragging : ownDragScroll.isDragging;
  const dragProps = screenOwnsDragScroll ? scrollProps : ownDragScroll.dragEvents;

  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const attachScroller = (node: HTMLDivElement | null) => {
    setScrollerEl(node);
    assignRef(scrollerRef, node);
    ownDragScroll.scrollerRef.current = node;
  };
  useStickyPinnedColumns(columnLayout ? scrollerEl : null, columnLayout?.pinnedIds ?? [], "data-table-col");

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300",
        className,
      )}
    >
      {!isLoading && toolbar}
      {isLoading ? (
        loadingContent
      ) : (
        <div
          ref={attachScroller}
          className={cn(
            "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
            dragging ? "cursor-grabbing select-none" : "cursor-grab",
          )}
          {...dragProps}
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
                    data-table-col={column.id}
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
            <TableMarkup.Body className="bg-white [&>tr:last-child>td]:border-b-0">
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
                  <React.Fragment key={getRowKey(row, index)}>
                    <TableMarkup.Row
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
                          data-table-col={column.id}
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
                    {/* The detail row opens and closes with a motion. It is mounted only while expanded, so the presence
                        boundary has to be HERE: a boundary inside the detail component would be unmounted with it and
                        could never play the closing motion (nor, with `initial={false}`, the opening one). */}
                    <AnimatePresence initial={false}>
                      {expandedRow?.isExpanded(row, index) &&
                        (expandedRow.asRow === false ? (
                          <React.Fragment key={`expanded-${getRowKey(row, index)}`}>
                            {expandedRow.render(row, index)}
                          </React.Fragment>
                        ) : (
                          <ExpandedRowShell key={`expanded-${getRowKey(row, index)}`} colSpan={colSpan}>
                            {expandedRow.render(row, index)}
                          </ExpandedRowShell>
                        ))}
                    </AnimatePresence>
                  </React.Fragment>
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
