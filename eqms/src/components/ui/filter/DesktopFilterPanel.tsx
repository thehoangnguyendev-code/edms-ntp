import React from 'react';
import { createPortal } from 'react-dom';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { IconFilter2 } from '@tabler/icons-react';

export interface DesktopFilterField {
  id: string;
  label: string;
  render: (draft: Record<string, string>, change: (key: string, value: string) => void, active: boolean) => React.ReactNode;
}

/** Explicit draft state: no parent callback or URL change before Apply. */
export function DesktopFilterPanel({ search, fields, values, defaults, onApply }: {
  search: React.ReactNode;
  fields: DesktopFilterField[];
  values: Record<string, string>;
  defaults: Record<string, string>;
  onApply: (values: Record<string, string>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [present, setPresent] = React.useState(false);
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = React.useState(values);
  const [active, setActive] = React.useState(fields[0]?.id);
  const panelId = React.useId();
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLElement>(null);
  const internalEvents = React.useRef(new WeakSet<Event>());
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 640, height: 480 });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const field = fields.find(item => item.id === active) ?? fields[0];
  // Back/Forward or a committed scope change invalidates any unsaved filter draft.
  const committedKey = JSON.stringify(values);
  React.useEffect(() => { setOpen(false); }, [committedKey]);
  // Keep the portal mounted through its exit; reopening cancels the pending removal.
  React.useEffect(() => {
    if (open) { setPresent(true); return; }
    const timer = window.setTimeout(() => setPresent(false), reducedMotion ? 0 : 220);
    return () => window.clearTimeout(timer);
  }, [open, reducedMotion]);
  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      if (window.innerWidth < 768) { setOpen(false); return; }
      const width = Math.min(680, window.innerWidth - 32);
      const height = Math.min(480, window.innerHeight - 32);
      const below = window.innerHeight - anchor.bottom - 24;
      const above = anchor.top - 24;
      const top = below < height && above > below ? anchor.top - height - 8 : anchor.bottom + 8;
      setPosition({ width, height,
        left: Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16)),
        top: Math.max(16, Math.min(top, window.innerHeight - height - 16)) });
    };
    const outside = (event: MouseEvent) => {
      // React capture follows nested portals (including DateRangePicker); DOM containment does not.
      if (!internalEvents.current.has(event) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) place();
    };
    place();
    panel.current?.querySelector<HTMLButtonElement>('nav button')?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', scroll, true);
    document.addEventListener('mousedown', outside);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', scroll, true);
      document.removeEventListener('mousedown', outside);
    };
  }, [open]);
  return <div className="hidden md:block pb-4">
    <div className="flex items-end gap-3">
      <div className="relative min-w-0 flex-1 [&_input]:pl-9">
        {search && <Search aria-hidden="true" data-advanced-search-icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        {search}
      </div>
      <Button ref={trigger} type="button" variant="outline" size="sm"
        aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog"
        className="gap-2 text-slate-700 hover:border-emerald-500"
        onClick={() => { if (open) close(); else { setDraft({ ...values }); setActive(fields[0]?.id); setOpen(true); } }}>
        <IconFilter2 className="h-4 w-4" />Filter
      </Button>
    </div>
    {(open || present) && createPortal(<motion.section ref={panel} id={panelId} role="dialog" aria-label="Advanced filters"
      aria-hidden={!open} inert={!open}
      initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: open ? 1 : 0, y: open || reducedMotion ? 0 : -6, scale: open || reducedMotion ? 1 : 0.98 }}
      transition={{ duration: reducedMotion ? 0 : open ? 0.28 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'fixed', ...position, zIndex: 1000 }}
      className="flex origin-top-right flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.28),0_8px_24px_-8px_rgba(15,23,42,0.16)]"
      onMouseDownCapture={event => internalEvents.current.add(event.nativeEvent)}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Advanced filters</h3>
        <button type="button" aria-label="Close filters" onClick={close} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(170px,32%)_minmax(0,1fr)]">
        <nav aria-label="Filter fields" className="overflow-y-auto border-r border-slate-100 p-2">
          <LayoutGroup id={panelId}>
          {fields.map(item => <button key={item.id} type="button" aria-current={field?.id === item.id ? 'true' : undefined}
            onClick={() => setActive(item.id)}
            className={`relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200 motion-reduce:transition-none ${field?.id === item.id ? 'font-medium text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            {field?.id === item.id && <motion.span aria-hidden="true"
              layoutId={reducedMotion ? undefined : 'selected-filter'}
              className="pointer-events-none absolute inset-0 rounded-lg bg-emerald-50"
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }} />}
            <span className="relative z-10">{item.label}</span>
            <motion.span aria-hidden="true" className="relative z-10 shrink-0"
              animate={{ x: !reducedMotion && field?.id === item.id ? 2 : 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}>
              <ChevronRight className="h-4 w-4" />
            </motion.span>
          </button>)}
          </LayoutGroup>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">{fields.map(item => <motion.div key={item.id} hidden={field?.id !== item.id} className="h-full"
            initial={false}
            animate={{ opacity: field?.id === item.id ? 1 : 0, x: reducedMotion || field?.id === item.id ? 0 : 10 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}>
            {item.render(draft, (key, value) => setDraft(previous => ({ ...previous, [key]: value })), field?.id === item.id)}
          </motion.div>)}</div>
      <div data-filter-actions className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 p-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...defaults })}>Clear all</Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button>
          <Button type="button" size="sm" onClick={() => { onApply(draft); close(); }}>Apply</Button>
        </div>
      </div>
        </div>
      </div>
    </motion.section>, document.body)}
  </div>;
}
