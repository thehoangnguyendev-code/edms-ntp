import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../utils';
import { Button } from '../button/Button';

export interface TimePickerProps {
  /** Label displayed above picker */
  label?: React.ReactNode;
  /** Current time value (HH:mm format) */
  value: string;
  /** Callback when time changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
}

interface Draft {
  hour: number | null;
  minute: number | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
/** Minutes offered as quick picks; a typed minute can still be any value. */
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const MARGIN = 12;
const GAP = 8;

const parseTime = (value: string): Draft => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return { hour: null, minute: null };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return { hour: null, minute: null };
  return { hour, minute };
};

const pad = (n: number | null) => (n === null ? '--' : String(n).padStart(2, '0'));

/** What a typed field reads as: at most two digits, capped at the largest valid value; an empty field is no value yet. */
const fromInput = (raw: string, max: number): number | null => {
  const digits = raw.replace(/\D/g, '').slice(0, 2);
  if (!digits) return null;
  return Math.min(Number(digits), max);
};

const TimeField: React.FC<{ label: string; value: number | null; max: number; onChange: (next: number | null) => void; onEnter: () => void }> = ({
  label, value, max, onChange, onEnter,
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <input
      aria-label={label}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={2}
      value={pad(value)}
      onFocus={(event) => event.target.select()}
      onChange={(event) => onChange(fromInput(event.target.value, max))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onEnter();
        }
      }}
      className="h-12 w-16 rounded-xl border border-slate-200 bg-white text-center text-2xl font-semibold tabular-nums text-slate-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

const ChoiceGrid: React.FC<{ label: string; unit: string; options: number[]; selected: number | null; columns: string; onPick: (n: number) => void }> = ({
  label, unit, options, selected, columns, onPick,
}) => (
  <div>
    <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <div role="group" aria-label={label} className={cn('grid gap-1', columns)}>
      {options.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={selected === n}
          aria-label={`${pad(n)} ${unit}`}
          onClick={() => onPick(n)}
          className={cn(
            'h-9 rounded-lg text-xs font-medium tabular-nums transition-colors md:h-8',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            selected === n ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700',
          )}
        >
          {pad(n)}
        </button>
      ))}
    </div>
  </div>
);

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select time',
  disabled = false,
}) => {
  const pickerId = useId();
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  // The choice being made. It reaches `value` only on "Set time", so Cancel, Escape or a click outside leave the value alone.
  const [draft, setDraft] = useState<Draft>(() => parseTime(value));
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const open = () => {
    if (disabled) return;
    window.dispatchEvent(new CustomEvent('select-dropdown-open', { detail: { openId: pickerId } }));
    setDraft(parseTime(value));
    setIsOpen(true);
  };

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Only one picker is open at a time.
  useEffect(() => {
    const closeIfOther = (event: Event) => {
      const { openId } = (event as CustomEvent<{ openId: string }>).detail;
      if (openId !== pickerId) setIsOpen(false);
    };
    window.addEventListener('select-dropdown-open', closeIfOther);
    return () => window.removeEventListener('select-dropdown-open', closeIfOther);
  }, [pickerId]);

  // Place the panel beside the trigger, above it when there is more room there, and never past the viewport edges.
  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const { innerWidth: screenWidth, innerHeight: screenHeight } = window;
      const width = popoverRef.current?.offsetWidth || 288;
      const height = popoverRef.current?.offsetHeight || 360;
      const left = Math.min(Math.max(rect.left, MARGIN), screenWidth - width - MARGIN);
      const spaceBelow = screenHeight - rect.bottom - GAP;
      const spaceAbove = rect.top - GAP;
      const style: React.CSSProperties = { position: 'fixed', zIndex: 9999, opacity: 1, left, width, maxHeight: `calc(100dvh - ${MARGIN * 2}px)` };
      if (spaceBelow < height && spaceAbove > spaceBelow) {
        style.bottom = screenHeight - rect.top + GAP;
        style.top = 'auto';
      } else {
        style.top = rect.bottom + GAP;
        style.bottom = 'auto';
      }
      setPopoverStyle(style);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  // Click outside and Escape close the panel.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  const { hour, minute } = draft;
  const complete = hour !== null && minute !== null;

  const apply = () => {
    if (hour === null || minute === null) return;
    onChange(`${pad(hour)}:${pad(minute)}`);
    close();
  };

  const clear = () => {
    onChange('');
    setDraft({ hour: null, minute: null });
    close();
  };

  const useNow = () => {
    const now = new Date();
    setDraft({ hour: now.getHours(), minute: now.getMinutes() });
  };

  return (
    <div className="relative w-full">
      {label && (
        <label htmlFor={`${pickerId}-trigger`} className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        id={`${pickerId}-trigger`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => (isOpen ? close(false) : open())}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm transition-colors focus:outline-none',
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
            : isOpen
              ? 'border-emerald-500 ring-1 ring-emerald-500'
              : 'border-slate-200 hover:border-slate-300 focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className={cn('truncate tabular-nums', !value ? 'text-slate-400' : disabled ? 'text-slate-500' : 'text-slate-900')}>
            {value || placeholder}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} aria-hidden="true" />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose time"
              initial={reduceMotion ? false : { opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
              style={popoverStyle}
              className="flex flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="flex items-start justify-center gap-3 px-4 pb-3 pt-4">
                <TimeField label="Hour" value={hour} max={23} onChange={(next) => setDraft((d) => ({ ...d, hour: next }))} onEnter={apply} />
                <span aria-hidden="true" className="pt-2.5 text-2xl font-semibold text-slate-300">:</span>
                <TimeField label="Minute" value={minute} max={59} onChange={(next) => setDraft((d) => ({ ...d, minute: next }))} onEnter={apply} />
              </div>

              <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                <ChoiceGrid
                  label="Hour"
                  unit="hours"
                  options={HOURS}
                  selected={hour}
                  columns="grid-cols-6"
                  onPick={(next) => setDraft((d) => ({ ...d, hour: next }))}
                />
                <ChoiceGrid
                  label="Minute"
                  unit="minutes"
                  options={MINUTES}
                  selected={minute}
                  columns="grid-cols-4"
                  onPick={(next) => setDraft((d) => ({ ...d, minute: next }))}
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <Button variant="ghost" size="sm" onClick={clear} className="text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={useNow}>
                    Now
                  </Button>
                  <Button size="sm" onClick={apply} disabled={!complete} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    Set time
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};
