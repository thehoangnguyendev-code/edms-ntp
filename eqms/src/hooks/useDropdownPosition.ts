import { useState, useEffect, RefObject } from 'react';

export interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  right?: number;
  maxHeight?: number;
  openUpward: boolean;
}

interface UseDropdownPositionOptions {
  /** Reference to trigger element */
  triggerRef: RefObject<HTMLElement>;
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Estimated dropdown height in pixels */
  estimatedHeight?: number;
  /** Offset from trigger (default: 4px) */
  offset?: number;
  /** Minimum space from viewport edges (default: 8px) */
  minSpacing?: number;
}

/**
 * Hook to calculate smart positioning for dropdown menus
 * Automatically flips dropdown upward when near bottom of viewport
 * 
 * @example
 * ```tsx
 * const { position } = useDropdownPosition({
 *   triggerRef: buttonRef,
 *   isOpen: isDropdownOpen,
 *   estimatedHeight: 200
 * });
 * 
 * <div style={position}>...</div>
 * ```
 */
export const useDropdownPosition = ({
  triggerRef,
  isOpen,
  estimatedHeight = 300,
  offset = 4,
  minSpacing = 8,
}: UseDropdownPositionOptions) => {
  const [position, setPosition] = useState<DropdownPosition>({
    top: 0,
    left: 0,
    openUpward: false,
  });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const calculatePosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate available space
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const spaceRight = viewportWidth - rect.left;
      const spaceLeft = rect.right;

      // Determine if should open upward
      const shouldOpenUpward = 
        spaceBelow < estimatedHeight + minSpacing && 
        spaceAbove > spaceBelow;

      // Calculate left position (handle overflow)
      let left = rect.left;
      const estimatedWidth = rect.width; // Use trigger width as base

      // If dropdown would overflow right edge
      if (left + estimatedWidth > viewportWidth - minSpacing) {
        left = viewportWidth - estimatedWidth - minSpacing;
      }

      // If still overflows left edge, clamp to left
      if (left < minSpacing) {
        left = minSpacing;
      }

      // Calculate max height based on available space
      const maxHeight = shouldOpenUpward
        ? Math.min(spaceAbove - offset - minSpacing, estimatedHeight)
        : Math.min(spaceBelow - offset - minSpacing, estimatedHeight);

      setPosition({
        top: shouldOpenUpward ? undefined : rect.bottom + offset,
        bottom: shouldOpenUpward ? viewportHeight - rect.top + offset : undefined,
        left,
        maxHeight,
        openUpward: shouldOpenUpward,
      });
    };

    calculatePosition();

    // Recalculate on scroll/resize
    const handleUpdate = () => {
      if (isOpen) calculatePosition();
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, estimatedHeight, offset, minSpacing, triggerRef]);

  return { position };
};
