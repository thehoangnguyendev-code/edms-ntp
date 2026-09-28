import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/components/ui/utils';

export interface CollapsibleFormSectionProps {
  title: string;
  /** Icon displayed in the header (wrapped in emerald color) */
  icon?: React.ReactNode;
  /** Optional subtitle below the title */
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Extra content rendered on the right side of the header (e.g. badge, counter) --
   *  stays visible even when the card is collapsed, so counts/status remain scannable. */
  headerRight?: React.ReactNode;
  /** Replaces the default `p-4 md:p-5` class on the content wrapper when provided */
  contentClassName?: string;
  /** Whether the card starts expanded. Uncontrolled after mount -- each card manages its own
   *  open/closed state locally, independent of any other card on the page. */
  defaultOpen?: boolean;
}

/**
 * CollapsibleFormSection — same visual card as FormSection (same header/content styling), but
 * click-to-expand/collapse with the smooth spring animation already used for the revision
 * accordions in LegacyImportView.tsx / ExpandControlledCopiesRow.tsx. Used to stack many field
 * groups on one page (Personal Information, Work Profile, Account, Qualifications, Access
 * Profiles...) without needing tabs to switch between them.
 */
export const CollapsibleFormSection: React.FC<CollapsibleFormSectionProps> = ({
  title,
  icon,
  description,
  children,
  className,
  headerRight,
  contentClassName,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 90, damping: 16 };

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 md:px-5 py-3 min-h-[52px] border-b border-slate-200 bg-white text-left transition-colors hover:bg-slate-50"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <motion.span
            className="flex-shrink-0 text-slate-400"
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={transition}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
          {icon && <span className="text-emerald-600 flex-shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight truncate">{title}</h3>
            {description && (
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">{description}</p>
            )}
          </div>
        </div>
        {headerRight && (
          <div
            className="flex-shrink-0 flex items-center justify-start flex-wrap gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            {headerRight}
          </div>
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            className="overflow-hidden"
          >
            <div className={contentClassName ?? 'p-4 md:p-5'}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
