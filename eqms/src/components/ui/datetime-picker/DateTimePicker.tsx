import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { IconCalendarWeek } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../utils';
import { Button } from '../button/Button';

/**
 * DateTimePicker component with calendar interface
 *
 * @example
 * ```tsx
 * <DateTimePicker
 *   label="Effective Date"
 *   value={effectiveDate}
 *   onChange={setEffectiveDate}
 * />
 * ```
 */
export interface DateTimePickerProps {
  /** Label displayed above picker */
  label?: React.ReactNode;
  /** Current date value (dd/MM/yyyy format; also accepts ISO strings) */
  value: string;
  /** Callback when date changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Show time picker (hours and minutes) */
  showTime?: boolean;
  /** Validation error message shown below the picker */
  error?: string;
}

// Pure helper — no component dependencies, stable across renders
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Match DD/MM/YYYY HH:mm or just DD/MM/YYYY
  const dateTimeMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (dateTimeMatch) {
    const [, day, month, year, hours, minutes] = dateTimeMatch;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hours ? parseInt(hours) : 0,
      minutes ? parseInt(minutes) : 0
    );
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  showTime = false,
  error,
}) => {
  const pickerIdRef = useRef(`date-time-picker-${Math.random().toString(36).slice(2, 11)}`);
  const pickerId = pickerIdRef.current;
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'month' | 'year'>('calendar');

  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    value ? parseDate(value) : null
  );
  const [viewDate, setViewDate] = useState<Date>(() =>
    value ? parseDate(value) || new Date() : new Date()
  );

  const [hours, setHours] = useState<number>(() => {
    const d = value ? parseDate(value) : null;
    return d ? d.getHours() : 0;
  });
  const [minutes, setMinutes] = useState<number>(() => {
    const d = value ? parseDate(value) : null;
    return d ? d.getMinutes() : 0;
  });

  // Roving tabIndex: which day number has tabIndex=0 in the grid
  const [focusedDay, setFocusedDay] = useState<number>(1);
  // Set to true by arrow-key handler so the next effect imperatively focuses the button
  const shouldFocusDayRef = useRef(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0 });

  // Live region text for screen reader month/year announcements
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Refs so the "on open" effect can read current state without stale closure issues
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const viewDateRef = useRef(viewDate);
  viewDateRef.current = viewDate;

  // ── Close sibling dropdowns ──────────────────────────────────────────────────
  useEffect(() => {
    const handleCloseOthers = (event: CustomEvent<{ openId: string }>) => {
      if (event.detail.openId !== pickerId && isOpen) setIsOpen(false);
    };
    window.addEventListener('select-dropdown-open' as any, handleCloseOthers);
    return () => window.removeEventListener('select-dropdown-open' as any, handleCloseOthers);
  }, [pickerId, isOpen]);

  // ── Popover positioning (no rAF — useLayoutEffect runs before paint) ─────────
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const { innerWidth: sw, innerHeight: sh } = window;
      const popoverWidth = 280;
      const popoverHeight = popoverRef.current?.offsetHeight || 370;
      let left = rect.left;
      if (left + popoverWidth > sw - 20) left = sw - popoverWidth - 20;
      if (left < 20) left = 20;
      const spaceBelow = sh - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const style: React.CSSProperties = { position: 'fixed', zIndex: 9999, opacity: 1, left };
      if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
        style.bottom = sh - rect.top + 8;
        style.top = 'auto';
      } else {
        style.top = rect.bottom + 8;
        style.bottom = 'auto';
      }
      setPopoverStyle(style);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, viewMode, viewDate]);

  // ── Focus management: move focus INTO dialog when it opens ───────────────────
  useEffect(() => {
    if (isOpen) {
      // setTimeout so positioning has been applied before focus (avoids scroll jump)
      const id = setTimeout(() => popoverRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // ── Click-outside + Escape ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // ── Sync external value ──────────────────────────────────────────────────────
  useEffect(() => {
    if (value) {
      const d = parseDate(value);
      if (d) {
        setSelectedDate(d);
        setViewDate(d);
        setHours(d.getHours());
        setMinutes(d.getMinutes());
      }
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // ── Reset state on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setViewMode('calendar');
      const sd = selectedDateRef.current;
      const vd = viewDateRef.current;
      const sameMY = sd &&
        sd.getMonth() === vd.getMonth() &&
        sd.getFullYear() === vd.getFullYear();
      setFocusedDay(sameMY ? sd!.getDate() : 1);
    }
  }, [isOpen]);

  // ── Screen reader: announce month/year on calendar navigation ────────────────
  useEffect(() => {
    if (isOpen && viewMode === 'calendar') {
      setLiveAnnouncement(`${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`);
    }
  }, [viewDate, isOpen, viewMode]);

  // ── Imperatively focus a day button after arrow-key navigation ───────────────
  useEffect(() => {
    if (!shouldFocusDayRef.current) return;
    shouldFocusDayRef.current = false;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusedDay}"]`);
    btn?.focus();
  }, [focusedDay, viewDate]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const closeAndReturn = () => { setIsOpen(false); triggerRef.current?.focus(); };

  const navigateMonth = (dir: 'prev' | 'next') => {
    setViewDate(d => { const nd = new Date(d); nd.setMonth(nd.getMonth() + (dir === 'next' ? 1 : -1)); return nd; });
    setFocusedDay(1);
  };

  const navigateYearRange = (dir: 'prev' | 'next') => {
    setViewDate(d => { const nd = new Date(d); nd.setFullYear(nd.getFullYear() + (dir === 'next' ? 12 : -12)); return nd; });
  };

  const handleDateClick = (day: number) => {
    const nd = new Date(viewDate); nd.setDate(day);
    setSelectedDate(nd);
    setFocusedDay(day);
  };

  const handleMonthSelect = (monthIndex: number) => {
    setViewDate(d => { const nd = new Date(d); nd.setMonth(monthIndex); return nd; });
    setViewMode('calendar');
  };

  const handleYearSelect = (year: number) => {
    setViewDate(d => { const nd = new Date(d); nd.setFullYear(year); return nd; });
    setViewMode('calendar');
  };

  const handleApply = () => {
    if (selectedDate) {
      const finalDate = new Date(selectedDate);
      if (showTime) {
        finalDate.setHours(hours);
        finalDate.setMinutes(minutes);
      } else {
        finalDate.setHours(0, 0, 0, 0);
      }

      const day = String(finalDate.getDate()).padStart(2, '0');
      const month = String(finalDate.getMonth() + 1).padStart(2, '0');
      const year = finalDate.getFullYear();

      let formatted = `${day}/${month}/${year}`;
      if (showTime) {
        const hh = String(finalDate.getHours()).padStart(2, '0');
        const mm = String(finalDate.getMinutes()).padStart(2, '0');
        formatted += ` ${hh}:${mm}`;
      }
      onChange(formatted);
    }
    closeAndReturn();
  };

  const handleClear = () => { onChange(''); setSelectedDate(null); closeAndReturn(); };

  // ── Keyboard navigation within the day grid ──────────────────────────────────
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let newDay = focusedDay;
    let newViewDate: Date | null = null;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newDay = Math.min(focusedDay + 1, daysInMonth);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newDay = Math.max(focusedDay - 1, 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newDay = Math.min(focusedDay + 7, daysInMonth);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newDay = Math.max(focusedDay - 7, 1);
        break;
      case 'Home':
        e.preventDefault();
        newDay = 1;
        break;
      case 'End':
        e.preventDefault();
        newDay = daysInMonth;
        break;
      case 'PageUp':
        e.preventDefault();
        newViewDate = new Date(year, month - 1, 1);
        newDay = Math.min(focusedDay, new Date(year, month, 0).getDate());
        break;
      case 'PageDown':
        e.preventDefault();
        newViewDate = new Date(year, month + 1, 1);
        newDay = Math.min(focusedDay, new Date(year, month + 2, 0).getDate());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleDateClick(focusedDay);
        return;
      default:
        return;
    }
    shouldFocusDayRef.current = true;
    if (newViewDate) setViewDate(newViewDate);
    setFocusedDay(newDay);
  };

  // ── Sub-views ────────────────────────────────────────────────────────────────
  const renderMonthView = () => (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          onClick={() => setViewMode('calendar')}
          aria-label="Back to calendar"
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <ChevronLeft className="h-4 w-4 block shrink-0" />
        </button>
        <span className="font-semibold text-slate-900 text-sm" id={`${pickerId}-month-heading`}>
          Select Month
        </span>
        <div className="w-9" />
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-labelledby={`${pickerId}-month-heading`}>
        {MONTH_ABBR.map((m, idx) => (
          <button
            key={m}
            type="button"
            onClick={() => handleMonthSelect(idx)}
            aria-label={MONTH_NAMES[idx]}
            aria-pressed={viewDate.getMonth() === idx}
            className={cn(
              "h-10 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              viewDate.getMonth() === idx ? "bg-emerald-50 text-emerald-600" : "text-slate-700"
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );

  const renderYearView = () => {
    const currentYear = viewDate.getFullYear();
    const startYear = Math.floor(currentYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <button
            type="button"
            onClick={() => navigateYearRange('prev')}
            aria-label="Previous 12 years"
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4 block shrink-0" />
          </button>
          <span className="font-semibold text-slate-900 text-sm" id={`${pickerId}-year-heading`}>
            {startYear} – {startYear + 11}
          </span>
          <button
            type="button"
            onClick={() => navigateYearRange('next')}
            aria-label="Next 12 years"
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4 block shrink-0" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-labelledby={`${pickerId}-year-heading`}>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => handleYearSelect(y)}
              aria-pressed={viewDate.getFullYear() === y}
              className={cn(
                "h-10 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                viewDate.getFullYear() === y ? "bg-emerald-50 text-emerald-600" : "text-slate-700"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    if (viewMode === 'month') return renderMonthView();
    if (viewMode === 'year') return renderYearView();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay();

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(<div key={`e${i}`} aria-hidden="true" />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = !!(
        selectedDate &&
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year
      );
      const isToday =
        today.getDate() === day &&
        today.getMonth() === month &&
        today.getFullYear() === year;
      const isFocusTarget = focusedDay === day;
      const fullLabel = new Intl.DateTimeFormat('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      }).format(new Date(year, month, day));

      cells.push(
        <button
          key={day}
          type="button"
          data-day={day}
          onClick={() => handleDateClick(day)}
          tabIndex={isFocusTarget ? 0 : -1}
          aria-selected={isSelected}
          aria-label={fullLabel}
          aria-current={isToday ? 'date' : undefined}
          className={cn(
            "h-9 w-9 rounded-full text-xs flex items-center justify-center transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1",
            isSelected
              ? 'bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700'
              : isToday
                ? 'text-emerald-600 font-bold bg-emerald-50 hover:bg-emerald-100'
                : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <button
            type="button"
            onClick={() => navigateMonth('prev')}
            aria-label="Previous month"
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4 block shrink-0" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              aria-label={`Select month, currently ${MONTH_NAMES[month]}`}
              className="font-semibold text-slate-900 text-sm hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors"
            >
              {MONTH_NAMES[month]}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('year')}
              aria-label={`Select year, currently ${year}`}
              className="font-semibold text-slate-900 text-sm hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors"
            >
              {year}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigateMonth('next')}
            aria-label="Next month"
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4 block shrink-0" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d, i) => (
            <div
              key={i}
              role="columnheader"
              aria-label={DAY_FULL[i]}
              className="h-6 flex items-center justify-center text-xs font-medium text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid — roving tabIndex + arrow-key navigation */}
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${MONTH_NAMES[month]} ${year}`}
          aria-multiselectable="false"
          className="grid grid-cols-7 gap-y-0.5"
          onKeyDown={handleGridKeyDown}
        >
          {cells}
        </div>
      </div>
    );
  };

  const renderTimePicker = () => {
    if (!showTime || viewMode !== 'calendar') return null;

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '').slice(0, 2);
      if (val === '') {
        setHours(0);
        return;
      }
      let h = parseInt(val);
      if (h > 23) h = 23;
      setHours(h);
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '').slice(0, 2);
      if (val === '') {
        setMinutes(0);
        return;
      }
      let m = parseInt(val);
      if (m > 59) m = 59;
      setMinutes(m);
    };

    return (
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/30">
        <div className="flex items-center gap-2">
          {/* Hours Input */}
          <div className="flex-1 relative group">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={String(hours).padStart(2, '0')}
              onChange={handleHourChange}
              onFocus={(e) => e.target.select()}
              className="w-full h-9 text-center border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm group-hover:border-slate-300"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none uppercase">H</span>
          </div>

          <span className="text-slate-500 font-bold">:</span>

          {/* Minutes Input */}
          <div className="flex-1 relative group">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={String(minutes).padStart(2, '0')}
              onChange={handleMinuteChange}
              onFocus={(e) => e.target.select()}
              className="w-full h-9 text-center border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm group-hover:border-slate-300"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none uppercase">M</span>
          </div>
        </div>
      </div>
    );
  };

  const formatDisplayValue = () => {
    if (!value) return placeholder;
    const d = parseDate(value);
    if (!d) return placeholder;

    let formatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    if (showTime) {
      formatted += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return formatted;
  };

  return (
    <div className="relative w-full">
      {/* Visually hidden live region — announces month/year changes to screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {label && (
        <label
          htmlFor={`${pickerId}-trigger`}
          className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block"
        >
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        id={`${pickerId}-trigger`}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          if (disabled) return;
          if (!isOpen) {
            window.dispatchEvent(new CustomEvent('select-dropdown-open', { detail: { openId: pickerId } }));
          }
          setIsOpen(prev => !prev);
        }}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-2 w-full px-3 py-2 h-9 rounded-lg text-sm transition-colors focus:outline-none',
          'border bg-white',
          disabled
            ? 'bg-slate-100 cursor-default border-slate-200'
            : isOpen
              ? 'ring-1 ring-emerald-500 border-emerald-500'
              : error
                ? 'border-red-400 hover:border-red-400 focus-visible:ring-1 focus-visible:ring-red-400'
                : 'border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <IconCalendarWeek className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className={cn("truncate", !value ? "text-slate-400" : (disabled ? "text-slate-600" : "text-slate-700"))}>
            {formatDisplayValue()}
          </span>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-slate-400 shrink-0 motion-safe:transition-transform motion-safe:duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              role="dialog"
              aria-modal="true"
              aria-label="Choose date"
              tabIndex={-1}
              initial={{ opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
              style={popoverStyle}
              className="bg-white rounded-xl shadow-[0_20px_60px_rgba(15,23,42,0.14)] border border-slate-200 overflow-hidden flex flex-col w-[280px] max-w-[calc(100vw-2rem)] focus:outline-none"
            >
              {renderCalendar()}
              {renderTimePicker()}

              <div className="border-t border-slate-200 p-2 px-3 bg-slate-50/50">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  >
                    Clear
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={closeAndReturn}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApply}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={!selectedDate}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
