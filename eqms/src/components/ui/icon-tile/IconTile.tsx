import React from 'react';
import { cn } from '../utils';
import type { BadgeColor } from '../badge/Badge';

/**
 * Standard icon-in-a-box used for stat cards, list-row leading icons, etc.
 * Consolidates the h-7/h-9/w-10 variants found scattered across features
 * (see STYLE_REFACTOR_PLAN.md section 1.3) into one sized, colored primitive.
 */

export type IconTileSize = 'sm' | 'md';

const SIZE_STYLES: Record<IconTileSize, { box: string; icon: string }> = {
  sm: { box: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
  md: { box: 'h-9 w-9', icon: 'h-4 w-4' },
};

const COLOR_STYLES: Record<BadgeColor, string> = {
  slate: 'bg-slate-50 text-slate-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  sky: 'bg-sky-50 text-sky-600',
  rose: 'bg-rose-50 text-rose-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  teal: 'bg-teal-50 text-teal-600',
  gray: 'bg-gray-50 text-gray-600',
};

export interface IconTileProps {
  icon: React.ReactNode;
  color?: BadgeColor;
  size?: IconTileSize;
  className?: string;
}

export const IconTile: React.FC<IconTileProps> = ({ icon, color = 'slate', size = 'md', className }) => {
  const { box, icon: iconSize } = SIZE_STYLES[size];
  return (
    <span className={cn('inline-flex items-center justify-center rounded-lg shrink-0', box, COLOR_STYLES[color], className)}>
      <span className={cn('inline-flex', iconSize)}>{icon}</span>
    </span>
  );
};
