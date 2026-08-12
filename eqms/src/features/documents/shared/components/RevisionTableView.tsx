import React, { useMemo } from "react";
import { ChevronRight, ChevronUp, ChevronDown, MoreVertical } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/components/ui/utils";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { ExpandedDocumentRow } from "./ExpandedDocumentRow";
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

interface RevisionTableViewProps<
  T extends {
    id: string;
    relatedDocuments?: RelatedDocument[];
    correlatedDocuments?: CorrelatedDocument[];
  }
> {
  // Data
  revisions: T[];
  columns: TableColumn[];

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
    relatedDocuments?: RelatedDocument[];
    correlatedDocuments?: CorrelatedDocument[];
  }
>(
  {
    revisions,
    columns,
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
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(() => shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }, [shouldReduceMotion]);

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

  const visibleColumns = useMemo(() => {
    if (!columns) return [];
    return columns.filter((col) => col.visible).sort((a, b) => a.order - b.order);
  }, [columns]);

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
        {/* Horizontal scroll container */}
        <div
          ref={scrollerRef}
          className={cn(
            "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
            isDragging ? "cursor-grabbing select-none" : "cursor-grab"
          )}
          {...dragEvents}
        >
          <table className="w-full min-w-max border-spacing-0 text-left">
            {/* Table Header */}
            <thead>
              <tr>
                {/* Expand/collapse column */}
                <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-9" />

                {/* Data columns */}
                {visibleColumns.map((column) => {
                  const isSorted = sortConfig.key === column.id;
                  const canSort =
                    column.id !== "action" &&
                    column.id !== "no" &&
                    column.id !== "relatedDocuments" &&
                    column.id !== "correlatedDocuments" &&
                    column.id !== "template";

                  return (
                    <th
                      key={column.id}
                      onClick={canSort ? () => onSort(column.id) : undefined}
                      className={cn(
                        "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors",
                        canSort && "cursor-pointer hover:bg-slate-100 hover:text-slate-700",
                        column.id === "action"
                          ? "right-0 z-30 text-center before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]"
                          : (column.id === "no" ? "text-center" : "text-left")
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">{column.label}</span>
                        {canSort && (
                          <div className="flex flex-col text-slate-400 flex-shrink-0">
                            <ChevronUp
                              className={cn(
                                "h-3 w-3 -mb-1",
                                isSorted && sortConfig.direction === "asc" ? "text-emerald-600 font-bold" : ""
                              )}
                            />
                            <ChevronDown
                              className={cn(
                                "h-3 w-3",
                                isSorted && sortConfig.direction === "desc" ? "text-emerald-600 font-bold" : ""
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="bg-white">
              {paginatedRevisions.map((item, index) => {
                const itemId = item.id;
                const isExpanded = expandedRowId === itemId;
                const showExpand = shouldShowExpandIcon ? shouldShowExpandIcon(item) : true;
                const relatedCount = item.relatedDocuments?.length ?? 0;
                const correlatedCount = item.correlatedDocuments?.length ?? 0;
                const hasDocs = showExpand;

                const tdClass =
                  "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";

                return (
                  <React.Fragment key={itemId}>
                    {/* Main Row */}
                    <tr className="hover:bg-slate-50/80 transition-colors group">
                      {/* Expand/collapse button */}
                      <td
                        className="py-3 px-4 border-b border-slate-200 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasDocs) onExpandRow(isExpanded ? null : itemId);
                        }}
                      >
                        {hasDocs ? (
                          <button className="flex items-center justify-center h-5 w-5 md:h-6 md:w-6 rounded-lg hover:bg-slate-200 transition-colors">
                            <motion.span
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={transitionConfig}
                              className="inline-flex items-center justify-center"
                            >
                              <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500" />
                            </motion.span>
                          </button>
                        ) : null}
                      </td>

                      {/* Data cells */}
                      {visibleColumns.map((column) => {
                        const menuActions = getMenuActions(item);

                        if (column.id === "action") {
                          return (
                            <td
                              key={column.id}
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                            >
                              {menuActions.length > 0 && (
                                <button
                                  ref={dropdownRef ? dropdownRef(itemId) : null}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dropdownToggle?.(itemId, e);
                                  }}
                                  className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                </button>
                              )}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={column.id}
                            className={cn(
                              tdClass,
                              column.id === "documentNumber" && onViewItem && "cursor-pointer hover:underline",
                              column.id === "no" && "text-center"
                            )}
                            onClick={
                              column.id === "documentNumber" && onViewItem
                                ? () => onViewItem(itemId)
                                : undefined
                            }
                          >
                            {renderCell(column, item, index)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Expanded Row */}
                    <ExpandedDocumentRow
                      revision={item}
                      isExpanded={isExpanded}
                      visibleColumnsLength={visibleColumns.length + 1} // +1 for expand column
                      hasDocs={true}
                      showCorrelationType={showCorrelationType}
                      revisionId={itemId}
                    />
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalRevisions}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={onItemsPerPageChange}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
};

export const RevisionTableView = React.forwardRef(RevisionTableViewInner) as <
  T extends {
    id: string;
    relatedDocuments?: RelatedDocument[];
    correlatedDocuments?: CorrelatedDocument[];
  }
>(
  props: RevisionTableViewProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

(RevisionTableView as any).displayName = "RevisionTableView";
