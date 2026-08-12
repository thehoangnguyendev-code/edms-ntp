import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

export interface PortalDropdownMenuProps {
  /** Whether the dropdown menu is open */
  isOpen: boolean;
  /** Callback function to close the dropdown menu */
  onClose: () => void;
  /** Position styles from usePortalDropdown hook */
  position: {
    top: number;
    left: number;
    showAbove?: boolean;
    style?: React.CSSProperties;
    rect?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
      width: number;
      height: number;
    };
  };
  /** Menu items and content */
  children: React.ReactNode;
  /** Custom minimum width (defaults to 200px) */
  minWidth?: string | number;
}

/**
 * Reusable animated dropdown menu component rendered via portal.
 * Animates both open and close states cleanly and handles boundaries responsibly.
 * Leverages trigger button bounding rect for exact edge-alignment to prevent offset gaps.
 */
export const PortalDropdownMenu: React.FC<PortalDropdownMenuProps> = ({
  isOpen,
  onClose,
  position,
  children,
  minWidth = 240,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // The menu is rendered in a portal and positioned using the trigger's
    // document coordinates. Closing it on every captured scroll made action
    // menus unusable inside scrollable tables. Document-positioned menus can
    // safely remain open while scrolling; close only when the viewport size
    // changes and the calculated bounds may no longer be valid.
    const handleResize = () => onClose();

    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, onClose]);

  // Determine if it should show above (support both showAbove boolean and parsing transform style)
  const isShowAbove =
    position.showAbove ||
    (position.style?.transform && position.style.transform !== 'none');

  // Determine if we should align to the left side of the trigger button (e.g. if close to left edge of screen)
  const alignLeft = position.rect ? position.rect.right < 240 : false;

  // Fallback styling if rect is not available
  const fallbackStyle: React.CSSProperties = position.style || {
    top: `${position.top}px`,
    left: `${position.left}px`,
    transform: isShowAbove ? 'translateY(-100%)' : 'none',
  };
  const { transform, ...outerFallbackStyle } = fallbackStyle;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (Transparent, clicks outside close the dropdown) */}
          <motion.div
            key="dropdown-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-hidden="true"
          />

          {position.rect ? (
            /* Precise Alignment using Button Rect */
            <motion.div
              key="dropdown-portal-aligned"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute z-50 pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{
                top: `${position.rect.top + window.scrollY}px`,
                left: `${position.rect.left + window.scrollX}px`,
                width: `${position.rect.width}px`,
                height: `${position.rect.height}px`,
              }}
            >
              {/* Absolute aligner matching button bounds */}
              <div
                className={cn(
                  'absolute',
                  isShowAbove ? 'bottom-full mb-1' : 'top-full mt-1',
                  alignLeft ? 'left-0' : 'right-0'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {/* Animated Menu Card */}
                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.95,
                    y: isShowAbove ? 6 : -6,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    y: isShowAbove ? 6 : -6,
                  }}
                  transition={{
                    duration: 0.18,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="max-w-[90vw] max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl cursor-default text-slate-500"
                  style={{
                    minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
                    transformOrigin: isShowAbove
                      ? alignLeft
                        ? 'bottom left'
                        : 'bottom right'
                      : alignLeft
                      ? 'top left'
                      : 'top right',
                  }}
                >
                  {children}
                </motion.div>
              </div>
            </motion.div>
          ) : (
            /* Fallback positioning if rect is not populated */
            <motion.div
              key="dropdown-portal-fallback"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute z-50 pointer-events-auto"
              style={outerFallbackStyle}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.95,
                  y: isShowAbove ? 6 : -6,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  y: isShowAbove ? 6 : -6,
                }}
                transition={{
                  duration: 0.18,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="max-w-[90vw] max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl text-slate-500"
                style={{
                  minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
                  transform: transform,
                  transformOrigin: isShowAbove ? 'bottom right' : 'top right',
                }}
              >
                {children}
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
