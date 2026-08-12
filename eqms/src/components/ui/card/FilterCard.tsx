import React from 'react';
import { cn } from '../utils';

/**
 * FilterCard Component
 * Container for filter sections with consistent styling across all list views
 * 
 * @example
 * ```tsx
 * <FilterCard>
 *   <FilterCard.Row>
 *     <FilterCard.Item span={6}>
 *       <Input label="Search" ... />
 *     </FilterCard.Item>
 *     <FilterCard.Item span={3}>
 *       <Select label="Status" ... />
 *     </FilterCard.Item>
 *   </FilterCard.Row>
 * </FilterCard>
 * ```
 */
export interface FilterCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const FilterCard: React.FC<FilterCardProps> & {
  Row: typeof FilterRow;
  Item: typeof FilterItem;
} = ({ children, className }) => {
  return (
    <div
      className={cn(
        'bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm w-full',
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * FilterRow - Grid container for filter items
 */
export interface FilterRowProps {
  children: React.ReactNode;
  className?: string;
}

const FilterRow: React.FC<FilterRowProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4 items-end',
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * FilterItem - Individual filter item with responsive column span
 */
export interface FilterItemProps {
  children: React.ReactNode;
  /** Column span on xl screens (1-12) */
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** Column span on md screens (1-2) */
  mdSpan?: 1 | 2;
  className?: string;
}

const spanClasses: Record<number, string> = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12',
};

const mdSpanClasses: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
};

const FilterItem: React.FC<FilterItemProps> = ({
  children,
  span = 3,
  mdSpan,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full',
        spanClasses[span],
        mdSpan && mdSpanClasses[mdSpan],
        className
      )}
    >
      {children}
    </div>
  );
};

// Attach sub-components
FilterCard.Row = FilterRow;
FilterCard.Item = FilterItem;
