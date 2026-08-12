import { useState, useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

export interface PortalDropdownPosition {
  top: number;
  left: number;
  showAbove: boolean;
  /** CSS transform property to handle showAbove cases (translateY(-100%)) */
  transform: string;
  /** Ready-to-use style object for the dropdown */
  style: React.CSSProperties;
  /** Bounding rect of the trigger button for precise custom alignment */
  rect?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
}

export interface UsePortalDropdownReturn {
  /** ID of currently open dropdown, or null */
  openId: string | null;
  /** Pixel position to pass to the portal-rendered dropdown */
  position: PortalDropdownPosition;
  /** Get (or lazily create) a stable ref for a trigger button by ID */
  getRef: (id: string) => RefObject<HTMLButtonElement | null>;
  /**
   * Toggle a dropdown open/closed, computing position from the click event.
   * @param id     Unique identifier for this row's dropdown
   * @param event  The button click event used to measure position
   * @param opts   Optional overrides for menu dimensions
   */
  toggle: (
    id: string,
    event: React.MouseEvent<HTMLButtonElement>,
    opts?: { menuHeight?: number; menuWidth?: number }
  ) => void;
  /** Close any open dropdown */
  close: () => void;
}

/**
 * Manages portal-based dropdown menus (action menus in tables).
 *
 * Replaces the copy-pasted handleDropdownToggle + state + ref-map pattern
 * that appeared in 24+ feature files.
 *
 * @example
 * ```tsx
 * const { openId, position, getRef, toggle, close } = usePortalDropdown();
 *
 * // In the table row:
 * <button ref={getRef(item.id)} onClick={(e) => toggle(item.id, e)}>
 *   <MoreVertical />
 * </button>
 *
 * // Portal-rendered menu:
 * {openId && createPortal(
 *   <>
 *     <div className="fixed inset-0 z-40" onClick={close} />
 *     <div className="fixed z-50 ..." style={{ top: position.top, left: position.left }}>
 *       {/* menu items * /}
 *     </div>
 *   </>,
 *   document.body
 * )}
 * ```
 */
export function usePortalDropdown(): UsePortalDropdownReturn {
  const [openId, setOpenId] = useState<string | null>(null);
  const [position, setPosition] = useState<PortalDropdownPosition>({
    top: 0,
    left: 0,
    showAbove: false,
    transform: 'none',
    style: { top: 0, left: 0, transform: 'none' },
  });

  // Stable map of button refs keyed by item ID.
  // Using useRef for the map itself avoids re-renders when refs are added.
  const buttonRefsMap = useRef<Record<string, RefObject<HTMLButtonElement | null>>>({});
  // Menu dimensions from the most recent toggle() call, retained so scroll/resize
  // repositioning (below) can recompute with the same size without the caller
  // having to pass them again.
  const lastOptsRef = useRef<{ menuHeight: number; menuWidth: number }>({ menuHeight: 160, menuWidth: 200 });

  const getRef = useCallback((id: string): RefObject<HTMLButtonElement | null> => {
    if (!buttonRefsMap.current[id]) {
      // createRef is intentional here: we cache it in the map so it stays
      // stable across renders without needing useRef per item.
      buttonRefsMap.current[id] = { current: null };
    }
    return buttonRefsMap.current[id];
  }, []);

  const computePosition = useCallback((rect: DOMRect, menuHeight: number, menuWidth: number) => {
    const safeMargin = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldShowAbove = spaceBelow < menuHeight && rect.top > menuHeight;

    const top = shouldShowAbove
      ? rect.top + window.scrollY - 4
      : rect.bottom + window.scrollY + 4;

    let left = rect.right + window.scrollX - menuWidth;
    left = Math.max(safeMargin, Math.min(left, window.innerWidth - menuWidth - safeMargin));

    const transform = shouldShowAbove ? 'translateY(-100%)' : 'none';

    const style: React.CSSProperties = {
      top: `${top}px`,
      left: `${left}px`,
      transform,
    };

    const rectData = {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    };

    return {
      top,
      left,
      showAbove: shouldShowAbove,
      transform,
      style,
      rect: rectData,
    };
  }, []);

  const toggle = useCallback(
    (
      id: string,
      event: React.MouseEvent<HTMLButtonElement>,
      opts: { menuHeight?: number; menuWidth?: number } = {}
    ) => {
      event.stopPropagation();

      // Toggle closed if already open
      if (openId === id) {
        setOpenId(null);
        return;
      }

      const { menuHeight = 160, menuWidth = 200 } = opts;
      lastOptsRef.current = { menuHeight, menuWidth };
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition(computePosition(rect, menuHeight, menuWidth));
      setOpenId(id);
    },
    [openId, computePosition]
  );

  const close = useCallback(() => {
    setOpenId(null);
  }, []);

  // The position above is a one-time snapshot from the click event. If the page (or any
  // scrollable ancestor, e.g. a horizontally-scrolling table) scrolls or the window resizes
  // while the menu stays open, the trigger button moves but the portal-rendered menu — appended
  // to document.body — does not follow it. Recompute from the live button rect on every such
  // event so the menu tracks its trigger. `capture: true` is required to observe scroll events
  // on inner scroll containers, which do not bubble.
  useEffect(() => {
    if (!openId) return;
    const buttonRef = buttonRefsMap.current[openId];

    const reposition = () => {
      const button = buttonRef?.current;
      if (!button) return;
      const { menuHeight, menuWidth } = lastOptsRef.current;
      setPosition(computePosition(button.getBoundingClientRect(), menuHeight, menuWidth));
    };

    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true });
      window.removeEventListener('resize', reposition);
    };
  }, [openId, computePosition]);

  return { openId, position, getRef, toggle, close };
}
