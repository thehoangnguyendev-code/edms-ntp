import React, { useMemo } from "react";
import { ChevronRight, MoreVertical } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn, type DataTableColumnLayout } from "@/components/ui/table/DataTable";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { ExpandedDocumentRow, preloadExpandedDocumentDetails } from "./ExpandedDocumentRow";
import { hasRevisionExpansion } from "../rowExpansion";
import type { RelatedDocument, CorrelatedDocument } from "@/features/documents/document-revisions/views/types";

export interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  locked?: boolean;
}

interface MenuAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

type RevisionRow = {
  id: string;
  documentId?: string | null;
  relatedDocuments?: RelatedDocument[];
  correlatedDocuments?: CorrelatedDocument[];
};

export interface RevisionColumnOptions<T> {
  columns: TableColumn[];
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  renderCell: (column: TableColumn, item: T, index: number) => React.ReactNode;
  expandedRowId: string | null;
  onExpandRow: (id: string | null) => void;
  shouldShowExpandIcon?: (item: T) => boolean;
  onViewItem?: (id: string) => void;
}

const NON_SORTABLE_COLUMNS = new Set(["action", "no", "relatedDocuments", "correlatedDocuments", "template"]);

/** Data columns for a revision table: the locked expand chevron first, then the visible view columns in order. */
const buildRevisionColumns = <T extends RevisionRow>(options: RevisionColumnOptions<T>): DataTableColumn<T>[] => {
  const { columns, sortConfig, onSort, renderCell, expandedRowId, onExpandRow, shouldShowExpandIcon, onViewItem } = options;
  const expandColumn: DataTableColumn<T> = {
    id: "expand",
    header: "",
    label: "Expand",
    locked: true,
    headerClassName: TABLE_STYLES.headerCell32,
    cell: (item) => {
      const isExpanded = expandedRowId === item.id;
      const showExpand = hasRevisionExpansion(item) && (shouldShowExpandIcon ? shouldShowExpandIcon(item) : true);
      if (!showExpand) return null;
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onExpandRow(isExpanded ? null : item.id)}
            // Fetch what the row will show as soon as the pointer reaches the chevron, so the row opens with it.
            onPointerEnter={() => !isExpanded && preloadExpandedDocumentDetails({ revisionId: item.id })}
            onPointerDown={() => !isExpanded && preloadExpandedDocumentDetails({ revisionId: item.id })}
            onFocus={() => !isExpanded && preloadExpandedDocumentDetails({ revisionId: item.id })}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} revision ${item.id}`}
            aria-expanded={isExpanded}
            className="flex items-center justify-center h-5 w-5 md:h-6 md:w-6 rounded-lg hover:bg-slate-200 transition-colors mx-auto"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500 transition-transform", isExpanded ? "rotate-90" : "rotate-0")} />
          </button>
        </div>
      );
    },
  };
  const dataColumns = columns
    .filter((column) => column.visible && column.id !== "action")
    .sort((a, b) => a.order - b.order)
    .map((column): DataTableColumn<T> => ({
      id: column.id,
      header: column.label,
      label: column.label,
      locked: column.id === "no",
      headerClassName: column.id === "no" ? "text-center" : undefined,
      cellClassName: column.id === "no" ? "text-center" : undefined,
      sort: NON_SORTABLE_COLUMNS.has(column.id)
        ? undefined
        : { direction: sortConfig.key === column.id ? sortConfig.direction : undefined, onSort: () => onSort(column.id) },
      cell: (item, index) =>
        column.id === "documentNumber" && onViewItem ? (
          <span className="cursor-pointer hover:underline" onClick={() => onViewItem(item.id)}>
            {renderCell(column, item, index)}
          </span>
        ) : (
          renderCell(column, item, index)
        ),
    }));
  return [expandColumn, ...dataColumns];
};

/**
 * Shared Custom Column layout for the revision list screens. Call it in the view body (before its return)
 * and pass the returned layout to RevisionTableView; render the returned control on the filter row.
 */
export function useRevisionColumnLayout<T extends RevisionRow>(tableKey: string, options: RevisionColumnOptions<T>) {
  // The Action column is rendered by RevisionTableView; this entry only gives the drawer its fixed "Action" row.
  const hasAction = options.columns.some((column) => column.id === "action" && column.visible);
  const fixedAction: DataTableAction<T> | undefined = hasAction ? { header: "Action", cell: () => null } : undefined;
  const { layout, control } = useCustomColumnLayout(tableKey, buildRevisionColumns(options), fixedAction);
  return { layout, control };
}

interface RevisionTableViewProps<
  T extends {
    id: string;
    documentId?: string | null;
    relatedDocuments?: RelatedDocument[];
    correlatedDocuments?: CorrelatedDocument[];
  }
> {
  // Data
  revisions: T[];
  columns: TableColumn[];
  /** Layout from useRevisionColumnLayout; without it the columns are built from `columns` with no per-user layout. */
  columnLayout?: DataTableColumnLayout<T>;

  // UI State
  expandedRowId: string | null;
  sortConfig: SortConfig;
  currentPage: number;
  itemsPerPage: number;
  isTableLoading: boolean;

  totalItems?: number;
  totalPages?: number;

  // Event Handlers
  onExpandRow: (id: string | null) => void;
  onSort: (key: string) => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  onMenuAction: (action: string, id: string) => void;

  // Customization
  renderCell: (column: TableColumn, item: T, index: number) => React.ReactNode;
  getMenuActions: (item: T) => Array<{ icon: React.ReactNode; label: string; action: string; color?: string }>;
  shouldShowExpandIcon?: (item: T) => boolean;
  onViewItem?: (id: string) => void;

  // UI Config
  showCorrelationType?: boolean;
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  className?: string;

  // Refs
  scrollerRef?: React.RefObject<HTMLDivElement | null>;
  dragEvents?: Record<string, (e: any) => void>;
  isDragging?: boolean;
  dropdownRef?: (id: string) => React.RefObject<HTMLButtonElement | null>;
  dropdownToggle?: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Reusable base table component for displaying revisions
 * Handles table layout, pagination, sorting, and expandable rows
 * Used by RevisionListView, RevisionsOwnedByMeView, and PendingDocumentsView
 */
const RevisionTableViewInner = <
  T extends {
    id: string;
    documentId?: string | null;
    relatedDocuments?: RelatedDocument[];
    correlatedDocuments?: CorrelatedDocument[];
  }
>(
  {
    revisions,
    columns,
    columnLayout,
    expandedRowId,
    sortConfig,
    currentPage,
    itemsPerPage,
    isTableLoading,
    totalItems: totalItemsProp,
    totalPages: totalPagesProp,
    onExpandRow,
    onSort,
    onPageChange,
    onItemsPerPageChange,
    onMenuAction,
    renderCell,
    getMenuActions,
    shouldShowExpandIcon,
    onViewItem,
    showCorrelationType = false,
    emptyStateTitle = "No results found",
    emptyStateMessage,
    className,
    scrollerRef,
    dragEvents = {},
    isDragging = false,
    dropdownRef,
    dropdownToggle,
  }: RevisionTableViewProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  // Calculate pagination
  const isServerSide = totalItemsProp !== undefined;
  const totalRevisions = isServerSide ? totalItemsProp : (revisions?.length || 0);
  const totalPages = isServerSide ? (totalPagesProp || 1) : Math.ceil(totalRevisions / itemsPerPage);
  const startIndex = isServerSide ? 0 : ((currentPage - 1) * itemsPerPage);
  const paginatedRevisions = useMemo(() => {
    if (!revisions) return [];
    if (isServerSide) return revisions;
    return revisions.slice(startIndex, startIndex + itemsPerPage);
  }, [revisions, startIndex, itemsPerPage, isServerSide]);

  const tableColumns = columnLayout?.columns ?? buildRevisionColumns({
    columns,
    sortConfig,
    onSort,
    renderCell,
    expandedRowId,
    onExpandRow,
    shouldShowExpandIcon,
    onViewItem,
  });
  const hasActionColumn = (columns ?? []).some((column) => column.id === "action" && column.visible);
  const action: DataTableAction<T> | undefined = hasActionColumn
    ? {
        header: "Action",
        cell: (item) => {
          const menuActions = getMenuActions(item);
          if (menuActions.length === 0) return null;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <button
                ref={dropdownRef ? dropdownRef(item.id) : null}
                onClick={(e) => {
                  e.stopPropagation();
                  dropdownToggle?.(item.id, e);
                }}
                className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            </div>
          );
        },
      }
    : undefined;
  const showExpandFor = (item: T) => hasRevisionExpansion(item) && (shouldShowExpandIcon ? shouldShowExpandIcon(item) : true);

  if (!revisions || paginatedRevisions.length === 0) {
    return (
      <div className="rounded-xl bg-white p-4 md:p-5 text-center">
        <EmptyState title={emptyStateTitle} description={emptyStateMessage} />
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative flex flex-col", className)}>
      {isTableLoading && (
        <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
          <SectionLoading text="Searching..." minHeight="150px" />
        </div>
      )}

      <div
        className={cn(
          "rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300",
          isTableLoading && "blur-[2px] opacity-80 pointer-events-none"
        )}
      >
        <DataTable
          rows={paginatedRevisions}
          getRowKey={(item) => item.id}
          columns={tableColumns}
          columnLayout={columnLayout}
          action={action}
          scrollerRef={scrollerRef}
          scrollProps={dragEvents}
          isDragging={isDragging}
          expandedRow={{
            isExpanded: (item) => expandedRowId === item.id && showExpandFor(item),
            render: (item) => (
              <ExpandedDocumentRow
                revision={item}
                isExpanded={true}
                visibleColumnsLength={tableColumns.length + 1}
                hasDocs={true}
                showCorrelationType={showCorrelationType}
                revisionId={item.id}
              />
            ),
            asRow: false,
          }}
          pagination={
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalRevisions}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={onItemsPerPageChange}
              onPageChange={onPageChange}
            />
          }
        />
      </div>
    </div>
  );
};

export const RevisionTableView = React.forwardRef(RevisionTableViewInner) as <
  T extends {
    id: string;
    documentId?: string | null;
    relatedDocuments?: RelatedDocument[];
    correlatedDocuments?: CorrelatedDocument[];
  }
>(
  props: RevisionTableViewProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

(RevisionTableView as any).displayName = "RevisionTableView";
