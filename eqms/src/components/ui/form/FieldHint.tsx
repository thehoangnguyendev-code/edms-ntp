import React from 'react';
import { cn } from '../utils';

export interface FieldHintProps {
  children: React.ReactNode;
  /** Line it up under a checkbox label (the box and its gap). */
  indent?: boolean;
  className?: string;
}

/**
 * Helper text under a control. From `md` up it takes half the width of its container, the same as the half-width inputs and selects
 * above it, so a hint never runs the full width of the page. On a small screen it takes the full width.
 *
 * Use it where the control sits directly in the container. A hint inside a cell of a two-column grid is already half the page: use a plain
 * paragraph there, or it would be a quarter. Keep it to one or two short sentences.
 */
export const FieldHint: React.FC<FieldHintProps> = ({ children, indent = false, className }) => (
  <p className={cn('text-xs text-slate-500 md:w-1/2', indent && 'ml-7', className)}>{children}</p>
);
