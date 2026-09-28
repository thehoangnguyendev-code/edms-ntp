import React, { useMemo, useCallback } from 'react';
import { Button } from '../button/Button';
import { Select } from '../select/Select';
import { cn } from '../utils';
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
  /** Clickable page numbers between Previous/Next (hidden on narrow/mobile layouts). Default true. */
  showPageNumbers?: boolean;
  showItemsPerPageSelector?: boolean;
  itemsPerPageOptions?: number[];
}

// Page numbers only ever render at lg+ (desktop) -- see the `hidden lg:flex` wrapper below -- so
// this can target the Previous/Next buttons' actual lg+ rendered height directly: Button's own
// `size="sm"` class list is `h-9 md:h-9 ...`, and since lg is always >= md, `md:h-9` (36px) is
// always the winning height whenever these are visible. Wider padding/min-width so 3-digit page
// numbers (e.g. 137) sit comfortably.
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

  if (totalPages === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 border-t border-slate-200 bg-white',
        className
      )}
    >
      {/* Left: Item count + per-page selector */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        {showItemCount && (
          <div className="text-[10px] sm:text-xs md:text-sm text-slate-600">
            <span className="font-medium text-slate-900">{startItem}</span> -{' '}
            <span className="font-medium text-slate-900">{endItem}</span> of{' '}
            <span className="font-medium text-slate-900">{totalItems}</span>
            <span className="hidden sm:inline"> results</span>
          </div>
        )}

        {showItemsPerPageSelector && onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs md:text-sm text-slate-600 whitespace-nowrap">Show:</span>
            <Select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              options={perPageOptions}
              className="w-16 sm:w-20"
              triggerClassName="h-6 sm:h-7 text-[10px] sm:text-xs md:text-sm"
              enableSearch={false}
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {/* Right: Navigation */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
        <Button variant="outline" size="icon-sm" className="sm:hidden h-7 w-7" onClick={goPrev} disabled={currentPage === 1 || isLoading}>
          <IconChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:flex h-7 px-2.5" onClick={goPrev} disabled={currentPage === 1 || isLoading}>
          Previous
        </Button>

        {/* Desktop only -- collapses to the "current/total" text below on tablet and mobile. */}
        {showPageNumbers && (
          <div className="hidden lg:flex items-center gap-1">
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

        {showPageNumbers && (
          <span className="lg:hidden text-[10px] text-slate-500 px-1.5">
            {currentPage}/{totalPages}
          </span>
        )}

        <Button variant="outline" size="icon-sm" className="sm:hidden h-7 w-7" onClick={goNext} disabled={currentPage === totalPages || isLoading}>
          <IconChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:flex h-7 px-2.5" onClick={goNext} disabled={currentPage === totalPages || isLoading}>
          Next
        </Button>
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
