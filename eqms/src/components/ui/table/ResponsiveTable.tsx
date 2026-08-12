import React from 'react';
import { cn } from '../utils';

/**
 * Responsive Table Component System
 * Sửa lỗi: Thay đổi cách truyền điều kiện vào hàm cn()
 */

/**
 * Table component props
 */
export interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<ResponsiveTableProps> = ({ children, className }) => {
  return (
    <table className={cn('w-full border-collapse text-sm md:text-base', className)}>
      {children}
    </table>
  );
};

export const TableHeader: React.FC<ResponsiveTableProps> = ({ children, className }) => {
  return (
    <thead className={cn('bg-slate-50 border-b border-slate-200 sticky top-0 z-10', className)}>
      {children}
    </thead>
  );
};

export const TableBody: React.FC<ResponsiveTableProps> = ({ children, className }) => {
  return (
    <tbody className={cn('divide-y divide-slate-200', className)}>
      {children}
    </tbody>
  );
};

interface TableCellProps {
  children?: React.ReactNode;
  className?: string;
  isHeader?: boolean;
  sticky?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className,
  isHeader = false,
  sticky,
  align = 'left',
}) => {
  const Component = isHeader ? 'th' : 'td';

  return (
    <Component
      className={cn(
        // Base styles
        'px-4 py-3',

        // Alignment
        align === 'left' && 'text-left',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',

        // Header specific (Đã sửa từ mảng [] sang chuỗi/điều kiện rời)
        isHeader && 'font-bold text-slate-500 text-2xs md:text-xs uppercase tracking-wider',

        // Cell specific
        !isHeader && 'text-slate-700 text-xs md:text-sm',

        // Sticky column (Sử dụng object hoặc chuỗi thay vì mảng)
        sticky === 'right' && 'sticky right-0 bg-white z-30 before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)]',

        sticky === 'left' && 'sticky left-0 bg-white z-30 after:content-[""] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[1px] after:bg-slate-200 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]',

        className
      )}
    >
      {children}
    </Component>
  );
};

export const TableRow: React.FC<ResponsiveTableProps> = ({ children, className }) => {
  return (
    <tr className={cn('hover:bg-slate-50 transition-colors', className)}>
      {children}
    </tr>
  );
};

// --- Các Component EmptyState và Pagination giữ nguyên logic nhưng dọn dẹp syntax cn() ---

interface TableEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  colSpan?: number;
}

export const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  icon,
  title,
  description,
  colSpan = 1,
}) => {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          {icon && <div className="text-slate-300">{icon}</div>}
          <div>
            <p className="text-sm md:text-base font-medium text-slate-700">{title}</p>
            {description && (
              <p className="text-xs md:text-sm text-slate-500 mt-1">{description}</p>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 bg-white px-4 py-4 sm:px-6', className)}>
      <div className="text-xs sm:text-sm text-slate-600">
        Showing <span className="font-medium text-slate-900">{startItem}-{endItem}</span> of <span className="font-medium text-slate-900">{totalItems}</span> results
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={cn(
            'h-9 px-4 text-sm font-medium rounded-lg transition-all border border-slate-200',
            currentPage === 1 ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-50 active:scale-95'
          )}
        >
          Previous
        </button>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={cn(
            'h-9 px-4 text-sm font-medium rounded-lg transition-all border border-slate-200',
            currentPage === totalPages ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-50 active:scale-95'
          )}
        >
          Next
        </button>
      </div>
    </div>
  );
};
