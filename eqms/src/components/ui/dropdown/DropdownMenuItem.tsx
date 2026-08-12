import React from 'react';
import { cn } from '../utils';

interface DropdownMenuItemProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  title?: string;
  className?: string;
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  icon,
  children,
  onClick,
  variant = 'default',
  disabled = false,
  title,
  className,
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors',
        variant === 'default' && 'text-slate-500 hover:bg-slate-50 active:bg-slate-100',
        variant === 'danger' && 'text-red-500 hover:bg-red-50 active:bg-red-100',
        disabled && 'cursor-not-allowed opacity-40 pointer-events-none',
        className,
      )}
    >
      {icon && <span className="h-4 w-4 flex-shrink-0 flex items-center">{icon}</span>}
      <span className="font-medium">{children}</span>
    </button>
  );
};
