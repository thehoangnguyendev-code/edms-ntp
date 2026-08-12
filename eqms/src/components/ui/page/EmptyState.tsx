import React from 'react';
import { cn } from '@/components/ui/utils';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'dashed';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center py-12 px-4',
      variant === 'dashed' && 'rounded-xl border border-dashed border-slate-200 bg-slate-50/50',
      className,
    )}
  >
    {Icon && (
      <div className="h-12 w-12 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-6 w-6 text-slate-300" />
      </div>
    )}
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
