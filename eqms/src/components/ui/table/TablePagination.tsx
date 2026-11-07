import React, { useMemo, useCallback, useRef } from 'react';
import { Button } from '../button/Button';
import { Select } from '../select/Select';
import { cn } from '../utils';
import { useFitLevel } from '../useFitLevel';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  className?: string;
  showItemCount?: boolean;
  /** Clickable page numbers between Previous/Next (shown only while there is room; otherwise "3/113"). Default true. */
  showPageNumbers?: boolean;
  showItemsPerPageSelector?: boolean;
  itemsPerPageOptions?: number[];
}

// Height of the Previous/Next buttons (h-7 = 28px at every size), with a wider padding and min-width so 3-digit page numbers (e.g. 137) sit comfortably.
const PAGE_BTN_BASE = 'h-9 min-w-[2.25rem] px-3 text-sm font-medium rounded-lg border transition-all flex items-center justify-center';
const PAGE_BTN_ACTIVE = 'bg-emerald-600 text-white border-emerald-600';
const PAGE_BTN_INACTIVE = 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300';
const ELLIPSIS = <span className="px-1 text-slate-400">...</span>;

const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 50];

const BOUNDARY_COUNT = 3; // always-visible page numbers kept at each end (e.g. 1 2 3 ... 8 9 10)
const SIBLING_COUNT = 1; // pages kept immediately around the current page

/**
 * Builds the page-button sequence: the first/last BOUNDARY_COUNT pages are always shown, plus
 * SIBLING_COUNT pages on either side of the current page, with a single "..." wherever there's a
 * gap. Falls back to every page when the total is small enough that nothing needs collapsing.
 */
function getVisiblePages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= BOUNDARY_COUNT * 2 + SIBLING_COUNT * 2 + 1) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const shown = new Set<number>();
  for (let p = 1; p <= Math.min(BOUNDARY_COUNT, total); p++) shown.add(p);
  for (let p = Math.max(1, total - BOUNDARY_COUNT + 1); p <= total; p++) shown.add(p);
  for (let p = Math.max(1, current - SIBLING_COUNT); p <= Math.min(total, current + SIBLING_COUNT); p++) shown.add(p);

  const sorted = Array.from(shown).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('ellipsis');
    result.push(page);
  });
  return result;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  isLoading = false,
  onPageChange,
  onItemsPerPageChange,
  className,
  showItemCount = true,
  showPageNumbers = true,
  showItemsPerPageSelector = true,
  itemsPerPageOptions = DEFAULT_PER_PAGE_OPTIONS,
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pageNumbers = useMemo(
    () => getVisiblePages(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const goPrev = useCallback(() => onPageChange(Math.max(1, currentPage - 1)), [onPageChange, currentPage]);
  const goNext = useCallback(() => onPageChange(Math.min(totalPages, currentPage + 1)), [onPageChange, currentPage, totalPages]);

  const handleItemsPerPageChange = useCallback(
    (value: string | number) => {
      onItemsPerPageChange?.(Number(value));
      onPageChange(1);
    },
    [onItemsPerPageChange, onPageChange]
  );

  const perPageOptions = useMemo(
    () => itemsPerPageOptions.map((n) => ({ label: n.toString(), value: n })),
    [itemsPerPageOptions]
  );

  const rootRef = useRef<HTMLDivElement>(null);
  // Nothing here ever wraps: when the room is short the pagination gives up detail, in this order, and never by the width of the screen
  // (the sidebar and a modal take a different share of the same screen). 0 = everything; 1 = the page numbers become "3/113"; 2 = Previous
  // and Next become arrows; 3 = "results" is dropped; 4 = the word "Show:" is dropped too.
  const level = useFitLevel(rootRef, 5, `${totalItems}|${currentPage}|${totalPages}|${itemsPerPage}|${showPageNumbers}|${showItemCount}|${showItemsPerPageSelector}`);

  if (totalPages === 0) return null;

  const numbered = showPageNumbers && level === 0;
  const arrows = level >= 2;

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 border-t border-slate-200 bg-white overflow-hidden whitespace-nowrap',
        className
      )}
    >
      {/* Left: Item count + per-page selector */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4">
        {showItemCount && (
          <div className="text-xs md:text-sm text-slate-600">
            <span className="font-medium text-slate-900">{startItem}</span> -{' '}
            <span className="font-medium text-slate-900">{endItem}</span> of{' '}
            <span className="font-medium text-slate-900">{totalItems}</span>
            {level < 3 && <span> results</span>}
          </div>
        )}

        {showItemsPerPageSelector && onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {level < 4 && <span className="text-xs md:text-sm text-slate-600 whitespace-nowrap">Show:</span>}
            <Select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              options={perPageOptions}
              className="w-16 sm:w-20"
              triggerClassName="min-h-0 py-0 px-2 h-7 md:h-8 text-xs md:text-sm"
              enableSearch={false}
              disabled={isLoading}
              aria-label="Rows per page"
            />
          </div>
        )}
      </div>

      {/* Right: Navigation */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
        {arrows ? (
          <Button variant="outline" size="icon-sm" className="h-7 w-7" onClick={goPrev} disabled={currentPage === 1 || isLoading} aria-label="Previous page">
            <IconChevronLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex h-7 px-2.5" onClick={goPrev} disabled={currentPage === 1 || isLoading}>
            Previous
          </Button>
        )}

        {numbered && (
          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) =>
              page === 'ellipsis' ? (
                <React.Fragment key={`ellipsis-${index}`}>{ELLIPSIS}</React.Fragment>
              ) : (
                <PageButton
                  key={page}
                  page={page}
                  isActive={page === currentPage}
                  onClick={onPageChange}
                  disabled={isLoading}
                />
              )
            )}
          </div>
        )}

        {showPageNumbers && !numbered && (
          <span className="text-xs text-slate-500 px-1.5" aria-label={`Page ${currentPage} of ${totalPages}`}>
            {currentPage}/{totalPages}
          </span>
        )}

        {arrows ? (
          <Button variant="outline" size="icon-sm" className="h-7 w-7" onClick={goNext} disabled={currentPage === totalPages || isLoading} aria-label="Next page">
            <IconChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex h-7 px-2.5" onClick={goNext} disabled={currentPage === totalPages || isLoading}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
};

/* ── Page number button ── */
const PageButton: React.FC<{ page: number; isActive: boolean; onClick: (p: number) => void; disabled?: boolean }> = React.memo(
  ({ page, isActive, onClick, disabled }) => (
    <button
      onClick={() => onClick(page)}
      disabled={disabled || isActive}
      className={cn(PAGE_BTN_BASE, isActive ? PAGE_BTN_ACTIVE : PAGE_BTN_INACTIVE, disabled && !isActive && 'opacity-50 cursor-not-allowed')}
    >
      {page}
    </button>
  )
);
