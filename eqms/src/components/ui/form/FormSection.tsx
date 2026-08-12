import React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/components/ui/utils';

export interface FormSectionProps {
  title: string;
  /** Icon displayed in the header (wrapped in emerald color) */
  icon?: React.ReactNode;
  /** Optional subtitle below the title */
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Extra content rendered on the right side of the header (e.g. badge, counter) */
  headerRight?: React.ReactNode;
  /** Replaces the default `p-4 md:p-5` class on the content wrapper when provided */
  contentClassName?: string;
}

/**
 * FormSection — standardized card section used across all detail/form views.
 *
 * Features:
 * - Standardized emerald styling
 * - Optional icon with emerald styling
 * - Optional description subtitle
 * - Optional headerRight slot for badges, counters, etc.
 */
export const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  description,
  children,
  className,
  headerRight,
  contentClassName,
}) => {
  // Content is the only repeated generic section title in Notification Policy.
  // Supply a consistent document icon when callers do not provide one explicitly.
  const resolvedIcon = icon ?? (title === 'Content' ? <FileText className="h-4 w-4" /> : undefined);
  return (
    <div
      className={cn("bg-white rounded-xl border border-slate-200 overflow-hidden", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 md:px-5 py-3 min-h-[52px] border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          {resolvedIcon && (
            <span className="text-emerald-600 flex-shrink-0">
              {resolvedIcon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight truncate">{title}</h3>
            {description && (
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">{description}</p>
            )}
          </div>
        </div>
        {headerRight && (
          <div className="flex-shrink-0 flex items-center justify-start flex-wrap gap-2">
            {headerRight}
          </div>
        )}
      </div>
      <div className={contentClassName ?? "p-4 md:p-5"}>{children}</div>
    </div>
  );
};

