import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils';
import { useDropdownPosition } from '@/hooks';

/**
 * Smart Dropdown Menu with auto-positioning
 * Automatically flips upward when near bottom of viewport
 * 
 * @example
 * ```tsx
 * <SmartDropdown
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   triggerRef={buttonRef}
 *   estimatedHeight={200}
 * >
 *   <DropdownItem onClick={handleEdit}>Edit</DropdownItem>
 *   <DropdownItem onClick={handleDelete}>Delete</DropdownItem>
 * </SmartDropdown>
 * ```
 */
export interface SmartDropdownProps {
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Callback when dropdown should close */
  onClose: () => void;
  /** Reference to trigger element */
  triggerRef: React.RefObject<HTMLElement>;
  /** Dropdown content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Estimated dropdown height for positioning calculation */
  estimatedHeight?: number;
  /** Minimum width */
  minWidth?: number;
  /** Close on backdrop click (default: true) */
  closeOnBackdrop?: boolean;
  /** ARIA role for dropdown container */
  role?: 'menu' | 'listbox';
}

export const SmartDropdown: React.FC<SmartDropdownProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  className,
  estimatedHeight = 300,
  minWidth = 180,
  closeOnBackdrop = true,
  role = 'menu',
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { position } = useDropdownPosition({
    triggerRef,
    isOpen,
    estimatedHeight,
  });

  // Handle click outside
  useEffect(() => {
    if (!isOpen || !closeOnBackdrop) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef, closeOnBackdrop]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop (invisible) */}
      {closeOnBackdrop && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        role={role}
        aria-orientation="vertical"
        style={{
          position: 'fixed',
          top: position.top,
          bottom: position.bottom,
          left: position.left,
          maxHeight: position.maxHeight,
          minWidth,
          zIndex: 50,
        }}
      className={cn(
          'rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden',
          'animate-in fade-in duration-200',
          position.openUpward ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2',
          className
        )}
      >
        <div className="overflow-y-auto max-h-full">
          {children}
        </div>
      </div>
    </>,
    document.body
  );
};

/**
 * Dropdown Item component
 */
export interface DropdownItemProps {
  /** Item content */
  children: React.ReactNode;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
  /** Icon before text */
  icon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Destructive action (red color) */
  destructive?: boolean;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  onClick,
  icon,
  className,
  disabled = false,
  destructive = false,
}) => {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onClick) {
          onClick(e);
        }
      }}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors text-left',
        disabled
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : destructive
            ? 'text-red-700 hover:bg-red-50'
            : 'text-slate-700 hover:bg-slate-50',
        className
      )}
    >
      {icon && <span className="h-4 w-4 shrink-0 text-slate-500">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

/**
 * Dropdown Divider
 */
export const DropdownDivider: React.FC = () => {
  return <div className="my-1 h-px bg-slate-200" role="separator" />;
};
