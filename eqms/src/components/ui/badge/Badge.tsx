import React from 'react';
import { useLanguage } from "@/i18n";
import { cn } from '../utils';
import { displayNode } from '@/utils/machineText';
import { statusColor } from './statusColors';

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
  | 'gray'
  | 'violet'
  | 'lime'
  | 'pink'
  | 'fuchsia'
  | 'yellow'
  | 'green';

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
  violet: 'bg-violet-50 text-violet-700 border-violet-200/70',
  lime: 'bg-lime-50 text-lime-700 border-lime-200/70',
  pink: 'bg-pink-50 text-pink-700 border-pink-200/70',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/70',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200/70',
  green: 'bg-green-50 text-green-700 border-green-200/70',
};

// One responsive scale for every badge: `sm` dimensions on desktop (xl, 1280px and up) and `xs`
// dimensions on tablet/mobile. The size prop is kept so existing call sites keep compiling, but
// every value resolves to this scale so the app's badges stay visually consistent.
const RESPONSIVE_BADGE_SIZE = 'px-1.5 py-0.5 text-2xs xl:px-2 xl:text-xs';

const SIZE_STYLES: Record<BadgeSize, string> = {
  xs: RESPONSIVE_BADGE_SIZE,
  sm: RESPONSIVE_BADGE_SIZE,
  default: RESPONSIVE_BADGE_SIZE,
  lg: RESPONSIVE_BADGE_SIZE,
};

export interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  /** Preferred over `color` when the badge represents a status meaning rather than a specific hue. */
  semantic?: BadgeSemantic;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
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
  pill = true,
  className,
  onClick,
  title,
}) => {
  const { tLabel } = useLanguage();
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
      {icon && <span className="shrink-0">{icon}</span>}
      {displayNode(typeof children === 'string' ? tLabel(children) : children)}
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

const DOC_STATUS_MAP: Record<StatusType, { label: string }> = {
  draft: { label: 'Draft' },
  pendingReview: { label: 'Pending Review' },
  pendingApproval: { label: 'Pending Approval' },
  approved: { label: 'Approved' },
  rejected: { label: 'Rejected' },
  current: { label: 'Current' },
  blocked: { label: 'Blocked' },
  inProgress: { label: 'In Progress' },
  pendingTraining: { label: 'Pending Training' },
  readyForPublishing: { label: 'Ready for Publishing' },
  published: { label: 'Published' },
  effective: { label: 'Effective' },
  active: { label: 'Active' },
  archived: { label: 'Archived' },
  obsolete: { label: 'Obsoleted' },
  completed: { label: 'Completed' },
  cancelled: { label: 'Cancelled' },
  closedCancelled: { label: 'Closed - Cancelled' },

  // --- Normalization & Raw Mapping Aliases ---
  'closed-cancelled': { label: 'Closed - Cancelled' },
  closedcancelled: { label: 'Closed - Cancelled' },
  'closed - cancelled': { label: 'Closed - Cancelled' },
  'readyfordistribution': { label: 'Ready for Distribution' },
  'ready-for-distribution': { label: 'Ready for Distribution' },
  'ready for distribution': { label: 'Ready for Distribution' },
  'distributed': { label: 'Distributed' },
  'obsoleted': { label: 'Obsoleted' },
  'pendingreview': { label: 'Pending Review' },
  'pendingapproval': { label: 'Pending Approval' },
  'pendingtraining': { label: 'Pending Training' },
  'readyforpublishing': { label: 'Ready for Publishing' },
  'pending review': { label: 'Pending Review' },
  'pending approval': { label: 'Pending Approval' },
  'pending training': { label: 'Pending Training' },
  'ready for publishing': { label: 'Ready for Publishing' },
};

export interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  size?: BadgeSize;
  icon?: React.ReactNode;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  size = 'default',
  icon,
  label
}) => {
  const { tLabel } = useLanguage();
  const config = DOC_STATUS_MAP[status] || DOC_STATUS_MAP.draft;
  return (
    <Badge
      color={statusColor(config.label)}
      size={size}
      icon={icon}
      className={className}
    >
      {label ? tLabel(label) : tLabel(config.label)}
    </Badge>
  );
};

export interface TaskStatusBadgeProps {
  status: 'Pending' | 'In-Progress' | 'Reviewing' | 'Completed' | 'Overdue';
  size?: BadgeSize;
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, ...props }) => {
  const { tLabel } = useLanguage();
  return <Badge color={statusColor(status)} {...props}>{tLabel(status)}</Badge>;
};

export interface PriorityBadgeProps {
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  size?: BadgeSize;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, ...props }) => {
  const { tLabel } = useLanguage();
  const priorityMap: Record<string, BadgeColor> = {
    'Critical': 'rose',
    'High': 'red',
    'Medium': 'amber',
    'Low': 'slate',
  };
  return <Badge color={priorityMap[priority]} {...props}>{tLabel(priority)}</Badge>;
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
