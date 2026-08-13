import React, { useMemo, useCallback } from 'react';
import { Button } from '../button/Button';
import { Select } from '../select/Select';
import { cn } from '../utils';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from '@/i18n';

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
  showPageNumbers?: boolean;
  maxPageButtons?: number;
  showItemsPerPageSelector?: boolean;
  itemsPerPageOptions?: number[];
}

const PAGE_BTN_BASE = 'h-7 w-7 text-xs sm:text-sm font-medium rounded-lg transition-all';
const PAGE_BTN_ACTIVE = 'bg-emerald-600 text-white';
const PAGE_BTN_INACTIVE = 'text-slate-700 hover:bg-slate-100';
const ELLIPSIS = <span className="px-1 text-slate-400">...</span>;

const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 50];

function getVisiblePages(current: number, total: number, max: number): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);

  const half = Math.floor(max / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + max - 1);

  if (end - start + 1 < max) start = Math.max(1, end - max + 1);

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
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
  showPageNumbers = false,
  maxPageButtons = 5,
  showItemsPerPageSelector = true,
  itemsPerPageOptions = DEFAULT_PER_PAGE_OPTIONS,
}) => {
  const { t } = useTranslation();
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pageNumbers = useMemo(
    () => getVisiblePages(currentPage, totalPages, maxPageButtons),
    [currentPage, totalPages, maxPageButtons]
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

  const firstPage = pageNumbers[0];
  const lastPage = pageNumbers[pageNumbers.length - 1];

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
            <span className="hidden sm:inline"> {t('pagination.results')}</span>
          </div>
        )}

        {showItemsPerPageSelector && onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs md:text-sm text-slate-600 whitespace-nowrap">{t('pagination.show')}:</span>
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
          {t('pagination.previous')}
        </Button>

        {showPageNumbers && (
          <div className="hidden sm:flex items-center gap-1">
            {firstPage > 1 && (
              <>
                <PageButton page={1} isActive={false} onClick={onPageChange} />
                {firstPage > 2 && ELLIPSIS}
              </>
            )}

            {pageNumbers.map((page) => (
              <PageButton key={page} page={page} isActive={page === currentPage} onClick={onPageChange} />
            ))}

            {lastPage < totalPages && (
              <>
                {lastPage < totalPages - 1 && ELLIPSIS}
                <PageButton page={totalPages} isActive={false} onClick={onPageChange} />
              </>
            )}
          </div>
        )}

        {showPageNumbers && (
          <span className="sm:hidden text-[10px] text-slate-500 px-1.5">
            {currentPage}/{totalPages}
          </span>
        )}

        <Button variant="outline" size="icon-sm" className="sm:hidden h-7 w-7" onClick={goNext} disabled={currentPage === totalPages || isLoading}>
          <IconChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:flex h-7 px-2.5" onClick={goNext} disabled={currentPage === totalPages || isLoading}>
          {t('pagination.next')}
        </Button>
      </div>
    </div>
  );
};

/* ── Page number button ── */
const PageButton: React.FC<{ page: number; isActive: boolean; onClick: (p: number) => void }> = React.memo(
  ({ page, isActive, onClick }) => (
    <button
      onClick={() => onClick(page)}
      className={cn(PAGE_BTN_BASE, isActive ? PAGE_BTN_ACTIVE : PAGE_BTN_INACTIVE)}
    >
      {page}
    </button>
  )
);
