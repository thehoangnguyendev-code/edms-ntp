import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../button';
import { cn } from '../utils';
import styles from './Drawer.module.css';

export interface DrawerHandle { close: () => void }
export interface DrawerProps {
  open?: boolean;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  footerClassName?: string;
  /** Runs after a user-requested exit; conditional-mount consumers can then unmount safely. */
  onClose: () => void;
  /** Runs after every exit, including when the parent sets open=false. */
  onExited?: () => void;
  children: React.ReactNode;
}
const overlays: HTMLElement[] = [];
let originalOverflow = '';
const DrawerContent: React.FC<Omit<DrawerProps, 'open' | 'onExited'>> = ({ title, subtitle, icon, headerActions, description, footer, bodyClassName, footerClassName, onClose, children }) => {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose); close.current = onClose;
  const reduced = useReducedMotion();
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  const [height, setHeight] = useState(88);
  const drag = useRef<{ y: number; height: number; current: number } | null>(null);
  useEffect(() => {
    const resize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const element = panel.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (!overlays.length) originalOverflow = document.body.style.overflow;
    overlays.push(element);
    document.body.style.overflow = 'hidden'; element.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || overlays.at(-1) !== element) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const items = Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
        .filter(item => {
          if (item.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
          for (let ancestor: HTMLElement | null = item;ancestor && ancestor !== element;ancestor = ancestor.parentElement) {
            const style = window.getComputedStyle(ancestor);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
          }
          return true;
        });
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      const wasTop = overlays.at(-1) === element;
      overlays.splice(overlays.indexOf(element), 1);
      if (!overlays.length) document.body.style.overflow = originalOverflow;
      if (wasTop && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const easing = [0.32, 0.72, 0, 1] as const;
  const offset = mobile ? { y: '100%', x: 0 } : { x: 'calc(100% + 16px)', y: 0 };
  return <div className="fixed inset-0 z-[60] overflow-hidden" data-drawer-overlay>
    <motion.div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.5 } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.35 } }} />
    <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className={cn('absolute flex min-h-0 flex-col overflow-hidden bg-white shadow-2xl outline-none',
        mobile ? 'inset-x-0 bottom-0 rounded-t-2xl' : 'bottom-4 right-4 top-4 w-[500px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200',
        mobile && height >= 98 && 'rounded-none')}
      style={mobile ? { height: `${height}dvh`, paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: height >= 98 ? 'env(safe-area-inset-top, 0px)' : undefined } : undefined}
      initial={reduced ? { x: 0, y: 0 } : offset} animate={{ x: 0, y: 0, transition: { duration: reduced ? 0 : 0.5, ease: easing } }}
      exit={{ ...(reduced ? { x: 0, y: 0 } : offset), transition: { duration: reduced ? 0 : 0.35, ease: easing } }}>
      {mobile && <button type="button" aria-label="Resize drawer" className="flex h-8 shrink-0 touch-none select-none items-center justify-center bg-white active:cursor-grabbing"
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { y: event.clientY, height, current: height }; }}
        onPointerMove={event => { if (!drag.current) return; const next = Math.max(0, Math.min(100, drag.current.height + (drag.current.y - event.clientY) / window.innerHeight * 100)); drag.current.current = next; setHeight(next); }}
        onPointerUp={() => { if (!drag.current) return; const shouldClose = drag.current.current < 25; drag.current = null; if (shouldClose) onClose(); else setHeight(88); }}
        onPointerCancel={() => { drag.current = null; setHeight(88); }}
        onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setHeight(event.key === 'ArrowUp' ? 100 : 88); } }}>
        <span className="h-1 w-12 rounded-full bg-slate-300" />
      </button>}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {icon}
          <div className="min-w-0 space-y-1">
            {subtitle && <p className="text-xs font-medium text-slate-500">{subtitle}</p>}
            <h2 id={titleId} title={title} className="break-words text-sm font-semibold leading-snug text-slate-900">{title}</h2>
            {headerActions && <div className="flex flex-wrap items-center gap-2">{headerActions}</div>}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close drawer" onClick={onClose} className="shrink-0 text-slate-500"><X className="h-4 w-4" /></Button>
      </header>
      <div className={cn(styles.body, 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/30 p-4 md:p-5', bodyClassName)}>
        {description && <p className="mb-4 break-words text-sm text-slate-500">{description}</p>}
        {children}
      </div>
      {footer && <footer className={cn('flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3 md:px-5', footerClassName)}>{footer}</footer>}
    </motion.div>
  </div>;
};
/** Training-style floating desktop panel / mobile bottom sheet. Filter drawers stay separate. */
export const Drawer = forwardRef<DrawerHandle, DrawerProps>(({ open = true, onClose, onExited, ...props }, ref) => {
  const [closing, setClosing] = useState(false);
  const requested = useRef(false);
  const callbacks = useRef({ onClose, onExited }); callbacks.current = { onClose, onExited };
  const requestClose = () => { if (!open || requested.current) return; requested.current = true; setClosing(true); };
  useImperativeHandle(ref, () => ({ close: requestClose }), [open]);
  useEffect(() => { if (!open) { requested.current = false; setClosing(false); } }, [open]);
  return createPortal(<AnimatePresence onExitComplete={() => {
    const notify = requested.current; requested.current = false;
    if (notify) callbacks.current.onClose();
    callbacks.current.onExited?.();
  }}>{open && !closing && <DrawerContent key="drawer" {...props} onClose={requestClose} />}</AnimatePresence>, document.body);
});
Drawer.displayName = 'Drawer';
