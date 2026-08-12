import React from 'react';
import { cn } from '../utils';

/**
 * Badge Component - Standardized badge for status, category, or label display.
 * Uses a unified design language across the entire application.
 */

export type BadgeColor =
  | 'slate'
  | 'emerald'
  | 'amber'
  | 'red'
  | 'blue'
  | 'purple'
  | 'orange'
  | 'cyan'
  | 'sky'
  | 'rose'
  | 'indigo'
  | 'teal'
  | 'gray';

export type BadgeVariant = 'soft' | 'outline' | 'solid';
export type BadgeSize = 'xs' | 'sm' | 'default' | 'lg';

/** Semantic meaning → color, so features don't need to hand-roll their own getXColor() maps. */
export type BadgeSemantic = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const SEMANTIC_COLOR: Record<BadgeSemantic, BadgeColor> = {
  success: 'emerald',
  warning: 'amber',
  danger: 'red',
  info: 'blue',
  neutral: 'slate',
};

const COLOR_STYLES: Record<BadgeColor, string> = {
  slate: 'bg-slate-50 text-slate-600 border-slate-200/70',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/70',
  red: 'bg-red-50 text-red-700 border-red-200/70',
  blue: 'bg-blue-50 text-blue-700 border-blue-200/70',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/70',
  orange: 'bg-orange-50 text-orange-700 border-orange-200/70',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200/70',
  sky: 'bg-sky-50 text-sky-700 border-sky-200/70',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/70',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
  teal: 'bg-teal-50 text-teal-700 border-teal-200/70',
  gray: 'bg-gray-50 text-gray-600 border-gray-200/70',
};

const DOT_COLOR: Record<BadgeColor, string> = {
  slate: 'bg-slate-400',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-500',
  gray: 'bg-gray-400',
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-2xs',
  sm: 'px-2 py-0.5 text-2xs sm:text-xs',
  default: 'px-2.5 py-0.5 sm:py-1 text-2xs sm:text-xs',
  lg: 'px-3 py-1 text-xs sm:text-sm',
};

export interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  /** Preferred over `color` when the badge represents a status meaning rather than a specific hue. */
  semantic?: BadgeSemantic;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  showDot?: boolean;
  pill?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  color,
  semantic,
  variant = 'soft',
  size = 'default',
  icon,
  showDot = false,
  pill = true,
  className,
  onClick,
  title,
}) => {
  const resolvedColor = semantic ? SEMANTIC_COLOR[semantic] : (color ?? 'slate');
  const isSolid = variant === 'solid';
  const isOutline = variant === 'outline';

  return (
    <span
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border select-none whitespace-nowrap transition-colors',
        pill ? 'rounded-full' : 'rounded-lg',
        isSolid ? 'text-white border-transparent' : '',
        isOutline ? 'bg-transparent border-current' : '',
        !isSolid && !isOutline ? COLOR_STYLES[resolvedColor] : '',
        isSolid ? `bg-${resolvedColor}-600` : '',
        SIZE_STYLES[size],
        onClick && 'cursor-pointer hover:opacity-80 active:scale-95',
        className
      )}
    >
      {showDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', isSolid ? 'bg-white' : DOT_COLOR[resolvedColor])} />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

// --- Standardized Status Helpers ---

export type StatusType =
  | 'draft'
  | 'pendingReview'
  | 'pendingApproval'
  | 'approved'
  | 'rejected'
  | 'pendingTraining'
  | 'readyForPublishing'
  | 'published'
  | 'effective'
  | 'active'
  | 'archived'
  | 'obsolete'
  | 'current'
  | 'blocked'
  | 'inProgress'
  | 'completed'
  | 'cancelled'
  | 'closedCancelled'
  // --- Normalization & Raw Mapping Aliases ---
  | 'closed-cancelled'
  | 'closedcancelled'
  | 'closed - cancelled'
  | 'readyfordistribution'
  | 'ready-for-distribution'
  | 'ready for distribution'
  | 'distributed'
  | 'obsoleted'
  | 'pendingreview'
  | 'pendingapproval'
  | 'pendingtraining'
  | 'readyforpublishing'
  | 'pending review'
  | 'pending approval'
  | 'pending training'
  | 'ready for publishing';

const DOC_STATUS_MAP: Record<StatusType, { label: string; color: BadgeColor }> = {
  draft: { label: 'Draft', color: 'slate' },
  pendingReview: { label: 'Pending Review', color: 'amber' },
  pendingApproval: { label: 'Pending Approval', color: 'blue' },
  approved: { label: 'Approved', color: 'emerald' },
  rejected: { label: 'Rejected', color: 'red' },
  current: { label: 'Current', color: 'blue' },
  blocked: { label: 'Blocked', color: 'red' },
  inProgress: { label: 'In Progress', color: 'amber' },
  pendingTraining: { label: 'Pending Training', color: 'purple' },
  readyForPublishing: { label: 'Ready for Publishing', color: 'indigo' },
  published: { label: 'Published', color: 'emerald' },
  effective: { label: 'Effective', color: 'emerald' },
  active: { label: 'Active', color: 'emerald' },
  archived: { label: 'Archived', color: 'slate' },
  obsolete: { label: 'Obsoleted', color: 'amber' },
  completed: { label: 'Completed', color: 'emerald' },
  cancelled: { label: 'Cancelled', color: 'red' },
  closedCancelled: { label: 'Closed - Cancelled', color: 'red' },

  // --- Normalization & Raw Mapping Aliases ---
  'closed-cancelled': { label: 'Closed - Cancelled', color: 'red' },
  closedcancelled: { label: 'Closed - Cancelled', color: 'red' },
  'closed - cancelled': { label: 'Closed - Cancelled', color: 'red' },
  'readyfordistribution': { label: 'Ready for Distribution', color: 'blue' },
  'ready-for-distribution': { label: 'Ready for Distribution', color: 'blue' },
  'ready for distribution': { label: 'Ready for Distribution', color: 'blue' },
  'distributed': { label: 'Distributed', color: 'emerald' },
  'obsoleted': { label: 'Obsoleted', color: 'amber' },
  'pendingreview': { label: 'Pending Review', color: 'amber' },
  'pendingapproval': { label: 'Pending Approval', color: 'blue' },
  'pendingtraining': { label: 'Pending Training', color: 'purple' },
  'readyforpublishing': { label: 'Ready for Publishing', color: 'indigo' },
  'pending review': { label: 'Pending Review', color: 'amber' },
  'pending approval': { label: 'Pending Approval', color: 'blue' },
  'pending training': { label: 'Pending Training', color: 'purple' },
  'ready for publishing': { label: 'Ready for Publishing', color: 'indigo' },
};

export interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  size?: BadgeSize;
  icon?: React.ReactNode;
  showDot?: boolean;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  size = 'default',
  icon,
  showDot = false,
  label
}) => {
  const config = DOC_STATUS_MAP[status] || DOC_STATUS_MAP.draft;
  return (
    <Badge
      color={config.color}
      size={size}
      icon={icon}
      showDot={showDot}
      className={className}
    >
      {label || config.label}
    </Badge>
  );
};

export interface TaskStatusBadgeProps {
  status: 'Pending' | 'In-Progress' | 'Reviewing' | 'Completed' | 'Overdue';
  size?: BadgeSize;
  showDot?: boolean;
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, ...props }) => {
  const statusMap: Record<string, BadgeColor> = {
    'Pending': 'slate',
    'In-Progress': 'cyan',
    'Reviewing': 'amber',
    'Completed': 'emerald',
    'Overdue': 'red',
  };
  return <Badge color={statusMap[status]} {...props}>{status}</Badge>;
};

export interface PriorityBadgeProps {
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  size?: BadgeSize;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, ...props }) => {
  const priorityMap: Record<string, BadgeColor> = {
    'Critical': 'rose',
    'High': 'red',
    'Medium': 'amber',
    'Low': 'slate',
  };
  return <Badge color={priorityMap[priority]} {...props}>{priority}</Badge>;
};

export interface ModuleBadgeProps {
  module: 'Document' | 'Deviation' | 'CAPA' | 'Training';
  size?: BadgeSize;
}

export const ModuleBadge: React.FC<ModuleBadgeProps> = ({ module, ...props }) => {
  const moduleMap: Record<string, BadgeColor> = {
    'Document': 'sky',
    'Deviation': 'rose',
    'CAPA': 'orange',
    'Training': 'emerald',
  };
  return <Badge color={moduleMap[module]} {...props}>{module}</Badge>;
};
