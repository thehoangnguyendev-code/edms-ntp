import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '../utils';

// ─── Constants ────────────────────────────────────────────────────────────────
const GAP = 8;           // px gap between trigger and popover
const EDGE = 8;          // min distance from viewport edge (mobile safe zone)
const DURATION = 160;    // ms — animation duration (open & close)

// ─── Types ────────────────────────────────────────────────────────────────────
type DirectionY = 'down' | 'up';

interface ComputedStyle extends React.CSSProperties {
  position: 'fixed';
  zIndex: number;
  top?: number;
  bottom?: number;
  left: number;
  maxWidth: number;
}

interface ComputedPosition {
  style: ComputedStyle;
  directionY: DirectionY;
}

// ─── Position calculator ──────────────────────────────────────────────────────
/**
 * Synchronously measures available space and returns the best fixed position
 * for the popover so it never overflows any viewport edge.
 *
 * @FRS FRS-UI-POP-001: Popover must never be clipped by the viewport
 */
function computePosition(
  trigger: DOMRect,
  popover: HTMLDivElement,
  preferred: 'top' | 'bottom',
): ComputedPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const popW = popover.offsetWidth;
  const popH = popover.offsetHeight;

  // ── Vertical ────────────────────────────────────────────────────────────────
  const spaceBelow = vh - trigger.bottom - GAP;
  const spaceAbove = trigger.top - GAP;

  let directionY: DirectionY;
  if (preferred === 'bottom') {
    directionY = spaceBelow >= popH || spaceBelow >= spaceAbove ? 'down' : 'up';
  } else {
    directionY = spaceAbove >= popH || spaceAbove >= spaceBelow ? 'up' : 'down';
  }

  // ── Horizontal ──────────────────────────────────────────────────────────────
  // Cap width so it always fits within the safe viewport area
  const maxWidth = Math.min(popW, vw - EDGE * 2);

  // Try: right-aligned → left-aligned → centred, clamp to edges
  const tryRight  = trigger.right - maxWidth;
  const tryLeft   = trigger.left;
  const tryCentre = trigger.left + trigger.width / 2 - maxWidth / 2;

  let left: number;
  if (tryRight >= EDGE && tryRight + maxWidth <= vw - EDGE) {
    left = tryRight;
  } else if (tryLeft + maxWidth <= vw - EDGE) {
    left = tryLeft;
  } else {
    left = Math.max(EDGE, Math.min(tryCentre, vw - maxWidth - EDGE));
  }

  // ── Compose ─────────────────────────────────────────────────────────────────
  const style: ComputedStyle = {
    position: 'fixed',
    zIndex: 9999,
    left,
    maxWidth,
    ...(directionY === 'down'
      ? { top: trigger.bottom + GAP }
      : { bottom: vh - trigger.top + GAP }),
  };

  return { style, directionY };
}

// ─── Popover component ────────────────────────────────────────────────────────
export interface PopoverProps {
  title?: string;
  content: string | React.ReactNode;
  trigger?: React.ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  contentClassName?: string;
  /** Preferred direction — auto-flips when there is not enough space */
  placement?: 'top' | 'bottom';
}

export const Popover: React.FC<PopoverProps> = ({
  title,
  content,
  trigger,
  triggerAriaLabel,
  triggerClassName,
  contentClassName,
  placement = 'bottom',
}) => {
  const [mounted, setMounted]       = useState(false);    // DOM presence
  const [visible, setVisible]       = useState(false);    // CSS opacity / transform
  const [computed, setComputed]     = useState<ComputedPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Measure synchronously BEFORE browser paints (no flash, no jump) ──────
  useLayoutEffect(() => {
    if (!mounted || !popoverRef.current || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setComputed(computePosition(rect, popoverRef.current, placement));
  }, [mounted, placement]);

  // ── 2. Trigger open transition AFTER position is committed ──────────────────
  useEffect(() => {
    if (!mounted || !computed) return;
    // One rAF ensures the browser has applied the position before we animate
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [mounted, computed]);

  // ── 3. Reposition live on scroll / resize ───────────────────────────────────
  const reposition = useCallback(() => {
    if (!mounted || !popoverRef.current || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setComputed(computePosition(rect, popoverRef.current, placement));
  }, [mounted, placement]);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [mounted, reposition]);

  // ── 4. Close with exit animation ─────────────────────────────────────────────
  const startClose = useCallback(() => {
    setVisible(false);
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      setComputed(null);
    }, DURATION);
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // ── 5. Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        startClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [mounted, startClose]);

  // ── Toggle ───────────────────────────────────────────────────────────────────
  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (mounted) {
      startClose();
    } else {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setMounted(true);
    }
  };

  // ── Derive transform-origin from actual computed direction ───────────────────
  const dirY = computed?.directionY ?? 'down';
  const transformOrigin = dirY === 'down' ? 'top center' : 'bottom center';

  // Inline transition style — avoids dependency on Tailwind animation plugin
  const animStyle: React.CSSProperties = {
    opacity:         visible ? 1 : 0,
    transform:       visible ? 'scale(1) translateY(0)' : (
      dirY === 'down' ? 'scale(0.96) translateY(-6px)' : 'scale(0.96) translateY(6px)'
    ),
    transition:      `opacity ${DURATION}ms ease, transform ${DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    transformOrigin,
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleToggle}
        aria-label={triggerAriaLabel || title || 'Open popover'}
        aria-expanded={mounted}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-colors',
          !trigger && 'p-2 hover:bg-slate-100',
          triggerClassName,
        )}
      >
        {trigger || <Info className="h-4 w-4 text-slate-400" />}
      </button>

      {mounted && createPortal(
        <div
          ref={popoverRef}
          style={{
            // Position defaults (invisible, unmeasured) → computed position → animated
            ...(computed?.style ?? { position: 'fixed', zIndex: 9999, left: -9999, top: -9999 }),
            ...animStyle,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'rounded-xl border border-slate-200 bg-white',
            'shadow-[0_18px_40px_rgba(15,23,42,0.16)]',
            contentClassName,
          )}
        >
          <div className="p-3">
            {title && (
              <h4 className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {title}
              </h4>
            )}
            <div className="text-xs leading-relaxed text-slate-700">{content}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
