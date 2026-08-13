import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { IconCalendarWeek } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../utils';
import { Button } from '../button/Button';

export interface DateRangePickerProps {
  /** Label displayed above picker */
  label?: React.ReactNode;
  /** Start date value (dd/MM/yyyy HH:mm:ss or dd/MM/yyyy) */
  startDate: string;
  /** End date value (dd/MM/yyyy HH:mm:ss or dd/MM/yyyy) */
  endDate: string;
  /** Callback when start date changes */
  onStartDateChange: (value: string) => void;
  /** Callback when end date changes */
  onEndDateChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Whether to include time selection */
  includeTime?: boolean;
  /** Called once when user confirms the range */
  onApply?: (value: { startDate: string; endDate: string }) => void;
  /** Auto-apply after selection changes without waiting for the Apply button */
  autoApply?: boolean;
  /** Show loading state on the Apply button */
  applyLoading?: boolean;
}

type PresetKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

// Helper to parse dd/MM/yyyy HH:mm:ss or dd/MM/yyyy or ISO strings
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  // Try dd/MM/yyyy HH:mm:ss format
  const dateTimeMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (dateTimeMatch) {
    const [, day, month, year, hours, minutes, seconds] = dateTimeMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
    return isNaN(date.getTime()) ? null : date;
  }

  // Try dd/MM/yyyy format
  const ddmmyyyyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const formatDateDisplay = (dateStr: string, includeTime: boolean = false): string => {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (!d) return '';
  const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  if (!includeTime) return datePart;
  const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return `${datePart} ${timePart}`;
};

const formatDateValue = (d: Date, includeTime: boolean = false): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const datePart = `${day}/${month}/${year}`;
  if (!includeTime) return datePart;
  const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return `${datePart} ${timePart}`;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const isInRange = (date: Date, start: Date | null, end: Date | null): boolean => {
  if (!start || !end) return false;
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return t > s && t < e;
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  placeholder = "Select date range",
  disabled = false,
  includeTime = false,
  onApply,
  autoApply = false,
  applyLoading = false,
}) => {
  const pickerIdRef = useRef(`date-range-picker-${Math.random().toString(36).slice(2, 11)}`);
  const pickerId = pickerIdRef.current;
  const dialogId = `${pickerId}-dialog`;
  const dialogTitleId = `${pickerId}-dialog-title`;
  const startFieldId = `${pickerId}-start-field`;
  const endFieldId = `${pickerId}-end-field`;

  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'month' | 'year'>('calendar');
  const [activeField, setActiveField] = useState<'start' | 'end'>('start');

  const [localStart, setLocalStart] = useState<Date | null>(() => parseDate(startDate));
  const [localEnd, setLocalEnd] = useState<Date | null>(() => parseDate(endDate));
  const [viewDate, setViewDate] = useState<Date>(() => parseDate(startDate) || new Date());

  // Time states
  const [startTime, setStartTime] = useState({ h: '00', m: '00', s: '00' });
  const [endTime, setEndTime] = useState({ h: '23', m: '59', s: '59' });
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState('');

  // Update time states when local dates change
  useEffect(() => {
    if (localStart) {
      setStartTime({
        h: String(localStart.getHours()).padStart(2, '0'),
        m: String(localStart.getMinutes()).padStart(2, '0'),
        s: String(localStart.getSeconds()).padStart(2, '0'),
      });
    }
  }, [localStart]);

  useEffect(() => {
    if (localEnd) {
      setEndTime({
        h: String(localEnd.getHours()).padStart(2, '0'),
        m: String(localEnd.getMinutes()).padStart(2, '0'),
        s: String(localEnd.getSeconds()).padStart(2, '0'),
      });
    }
  }, [localEnd]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const closePopover = useCallback((returnFocus: boolean = true) => {
    setIsOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  // Close other dropdowns
  useEffect(() => {
    const handler = (event: CustomEvent<{ openId: string }>) => {
      if (event.detail.openId !== pickerId && isOpen) setIsOpen(false);
    };
    window.addEventListener('select-dropdown-open' as any, handler);
    return () => window.removeEventListener('select-dropdown-open' as any, handler);
  }, [pickerId, isOpen]);

  // Position
  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const update = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const sw = window.innerWidth;
        const sh = window.innerHeight;
        const isMobile = sw < 1024;
        const pw = isMobile ? Math.min(sw - 32, includeTime ? 360 : 340) : (includeTime ? 520 : 480);
        const ph = popoverRef.current?.offsetHeight || (includeTime ? 560 : 460);

        const style: React.CSSProperties = { position: 'fixed', zIndex: 9999, opacity: 1 };

        if (isMobile) {
          // On mobile, show picker centered to avoid clipping at screen edges.
          style.left = Math.max(16, Math.round((sw - pw) / 2));
          style.top = Math.max(16, Math.round((sh - ph) / 2));
          style.right = 'auto';
          style.bottom = 'auto';
          setPopoverStyle(style);
          return;
        }

        let left = rect.left;

        if (left + pw > sw - 20) left = sw - pw - 20;
        if (left < 20) left = 20;
        style.left = left;

        const spaceBelow = sh - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        if (spaceBelow < ph && spaceAbove > spaceBelow) {
          style.bottom = sh - rect.top + 8;
          style.top = 'auto';
        } else {
          style.top = rect.bottom + 8;
          style.bottom = 'auto';
        }
        setPopoverStyle(style);
      };
      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);
      return () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
      };
    }
  }, [isOpen, viewMode, viewDate, includeTime]);

  // Click outside + Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        closePopover(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopover();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, closePopover]);

  // Focus management + focus trap
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    requestAnimationFrame(() => {
      popoverRef.current?.focus();
    });

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !popoverRef.current) return;
      const focusableEls = popoverRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length === 0) return;
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Sync external values
  useEffect(() => {
    const d = parseDate(startDate);
    setLocalStart(d);
    if (d) {
      setStartTime({
        h: String(d.getHours()).padStart(2, '0'),
        m: String(d.getMinutes()).padStart(2, '0'),
        s: String(d.getSeconds()).padStart(2, '0'),
      });
    }
  }, [startDate]);

  useEffect(() => {
    const d = parseDate(endDate);
    setLocalEnd(d);
    if (d) {
      setEndTime({
        h: String(d.getHours()).padStart(2, '0'),
        m: String(d.getMinutes()).padStart(2, '0'),
        s: String(d.getSeconds()).padStart(2, '0'),
      });
    }
  }, [endDate]);

  useEffect(() => {
    if (isOpen) setViewMode('calendar');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const base = activeField === 'start' ? localStart : localEnd;
    if (base && base.getMonth() === currentMonth && base.getFullYear() === currentYear) {
      setFocusedDay(base.getDate());
      return;
    }
    setFocusedDay(1);
  }, [isOpen, viewDate, activeField, localStart, localEnd]);

  useEffect(() => {
    setLiveMessage(`${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`);
  }, [viewDate]);

  const navigateMonth = (dir: 'prev' | 'next') => {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
    setViewDate(d);
  };

  const handleDateClick = (day: number) => {
    const clicked = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (activeField === 'start') {
      const newStart = new Date(clicked);
      newStart.setHours(parseInt(startTime.h), parseInt(startTime.m), parseInt(startTime.s));
      setLocalStart(newStart);
      // If end is before start, clear it
      if (localEnd && newStart > localEnd) setLocalEnd(null);
      if (!includeTime) setActiveField('end');

      if (autoApply && localEnd && newStart <= localEnd) {
        const nextStart = formatDateValue(newStart, includeTime);
        const nextEnd = formatDateValue(localEnd, includeTime);
        if (onApply) {
          onApply({ startDate: nextStart, endDate: nextEnd });
        } else {
          onStartDateChange(nextStart);
          onEndDateChange(nextEnd);
        }
        closePopover();
      }
    } else {
      const newEnd = new Date(clicked);
      newEnd.setHours(parseInt(endTime.h), parseInt(endTime.m), parseInt(endTime.s));
      // If clicked before start, swap
      if (localStart && newEnd < localStart) {
        setLocalEnd(localStart);
        setLocalStart(newEnd);
        if (autoApply) {
          const nextStart = formatDateValue(newEnd, includeTime);
          const nextEnd = formatDateValue(localStart, includeTime);
          if (onApply) {
            onApply({ startDate: nextStart, endDate: nextEnd });
          } else {
            onStartDateChange(nextStart);
            onEndDateChange(nextEnd);
          }
          closePopover();
        }
      } else {
        setLocalEnd(newEnd);
        if (autoApply && localStart) {
          const nextStart = formatDateValue(localStart, includeTime);
          const nextEnd = formatDateValue(newEnd, includeTime);
          if (onApply) {
            onApply({ startDate: nextStart, endDate: nextEnd });
          } else {
            onStartDateChange(nextStart);
            onEndDateChange(nextEnd);
          }
          closePopover();
        }
      }
    }
  };

  const handleMonthSelect = (idx: number) => {
    const d = new Date(viewDate);
    d.setMonth(idx);
    setViewDate(d);
    setViewMode('calendar');
  };

  const handleYearSelect = (y: number) => {
    const d = new Date(viewDate);
    d.setFullYear(y);
    setViewDate(d);
    setViewMode('calendar');
  };

  const applyPreset = (preset: PresetKey) => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    const getStartOfWeek = (date: Date) => {
      const result = new Date(date);
      const day = result.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Monday as first day
      result.setDate(result.getDate() + diff);
      result.setHours(0, 0, 0, 0);
      return result;
    };

    const getEndOfWeek = (date: Date) => {
      const result = getStartOfWeek(date);
      result.setDate(result.getDate() + 6);
      result.setHours(23, 59, 59, 0);
      return result;
    };

    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59);
        break;
      case 'thisWeek':
        start = getStartOfWeek(now);
        end.setHours(23, 59, 59, 0);
        break;
      case 'lastWeek': {
        const previousWeekDate = new Date(now);
        previousWeekDate.setDate(previousWeekDate.getDate() - 7);
        start = getStartOfWeek(previousWeekDate);
        end = getEndOfWeek(previousWeekDate);
        break;
      }
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 0);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 0);
        break;
    }

    setLocalStart(start);
    setLocalEnd(end);
    setStartTime({
      h: String(start.getHours()).padStart(2, '0'),
      m: String(start.getMinutes()).padStart(2, '0'),
      s: String(start.getSeconds()).padStart(2, '0'),
    });
    setEndTime({
      h: String(end.getHours()).padStart(2, '0'),
      m: String(end.getMinutes()).padStart(2, '0'),
      s: String(end.getSeconds()).padStart(2, '0'),
    });
    setViewDate(start);

    if (autoApply) {
      const nextStart = formatDateValue(start, includeTime);
      const nextEnd = formatDateValue(end, includeTime);
      if (onApply) {
        onApply({ startDate: nextStart, endDate: nextEnd });
      } else {
        onStartDateChange(nextStart);
        onEndDateChange(nextEnd);
      }
      closePopover();
    }
  };

  const handleApply = () => {
    const nextStart = localStart
      ? formatDateValue(
          new Date(localStart.getFullYear(), localStart.getMonth(), localStart.getDate(), parseInt(startTime.h), parseInt(startTime.m), parseInt(startTime.s)),
          includeTime
        )
      : "";
    const nextEnd = localEnd
      ? formatDateValue(
          new Date(localEnd.getFullYear(), localEnd.getMonth(), localEnd.getDate(), parseInt(endTime.h), parseInt(endTime.m), parseInt(endTime.s)),
          includeTime
        )
      : "";

    if (onApply) {
      onApply({ startDate: nextStart, endDate: nextEnd });
    } else {
      if (localStart) {
        onStartDateChange(nextStart);
      } else {
        onStartDateChange("");
      }

      if (localEnd) {
        onEndDateChange(nextEnd);
      } else {
        onEndDateChange("");
      }
    }
    closePopover();
  };

  const handleReset = () => {
    setLocalStart(null);
    setLocalEnd(null);
    setStartTime({ h: '00', m: '00', s: '00' });
    setEndTime({ h: '23', m: '59', s: '59' });
    setActiveField('start');
    if (onApply) {
      onApply({ startDate: '', endDate: '' });
    } else {
      onStartDateChange('');
      onEndDateChange('');
    }
  };

  const focusDay = (day: number) => {
    setFocusedDay(day);
    requestAnimationFrame(() => {
      const btn = popoverRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${day}"]`);
      btn?.focus();
    });
  };

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (viewMode !== 'calendar') return;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const currentDay = focusedDay ?? 1;
    let nextDay = currentDay;

    if (e.key === 'ArrowRight') nextDay = Math.min(daysInMonth, currentDay + 1);
    if (e.key === 'ArrowLeft') nextDay = Math.max(1, currentDay - 1);
    if (e.key === 'ArrowDown') nextDay = Math.min(daysInMonth, currentDay + 7);
    if (e.key === 'ArrowUp') nextDay = Math.max(1, currentDay - 7);
    if (e.key === 'Home') nextDay = 1;
    if (e.key === 'End') nextDay = daysInMonth;

    if (nextDay !== currentDay) {
      e.preventDefault();
      focusDay(nextDay);
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDateClick(currentDay);
    }
  };

  // Display value for trigger
  const displayValue = useMemo(() => {
    const s = formatDateDisplay(startDate, includeTime);
    const e = formatDateDisplay(endDate, includeTime);
    if (s && e) return `${s}  →  ${e}`;
    if (s) return `From ${s}`;
    if (e) return `To ${e}`;
    return placeholder;
  }, [startDate, endDate, placeholder, includeTime]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const renderMonthView = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <button type="button" onClick={() => setViewMode('calendar')} className="min-w-[36px] min-h-[36px] p-1.5 hover:bg-slate-100 rounded-full text-slate-500 flex items-center justify-center" aria-label="Back to calendar view">
            <ChevronLeft className="h-4 w-4 block shrink-0" />
          </button>
          <span className="font-semibold text-slate-900 text-sm">Select Month</span>
          <div className="w-6" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {months.map((m, idx) => (
            <button
              key={m}
              onClick={() => handleMonthSelect(idx)}
              className={cn(
                "h-9 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors",
                viewDate.getMonth() === idx ? "bg-emerald-50 text-emerald-600" : "text-slate-700"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const currentYear = viewDate.getFullYear();
    const startYear = Math.floor(currentYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <button type="button" onClick={() => { const d = new Date(viewDate); d.setFullYear(d.getFullYear() - 12); setViewDate(d); }} className="min-w-[36px] min-h-[36px] p-1.5 hover:bg-slate-100 rounded-full text-slate-500 flex items-center justify-center" aria-label="Previous year range">
            <ChevronLeft className="h-4 w-4 block shrink-0" />
          </button>
          <span className="font-semibold text-slate-900 text-sm">{startYear} - {startYear + 11}</span>
          <button type="button" onClick={() => { const d = new Date(viewDate); d.setFullYear(d.getFullYear() + 12); setViewDate(d); }} className="min-w-[36px] min-h-[36px] p-1.5 hover:bg-slate-100 rounded-full text-slate-500 flex items-center justify-center" aria-label="Next year range">
            <ChevronRight className="h-4 w-4 block shrink-0" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => handleYearSelect(y)}
              className={cn(
                "h-9 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors",
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
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDay = firstDay.getDay();
    const today = new Date();

    const days: React.ReactNode[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`e-${i}`} className="h-9 w-9" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, month, day);
      const isStart = !!localStart && isSameDay(current, localStart);
      const isEnd = !!localEnd && isSameDay(current, localEnd);
      const isSelected = isStart || isEnd;
      const inRange = isInRange(current, localStart, localEnd);
      const isToday = isSameDay(current, today);

      // Range highlight background
      const isRangeStart = isStart && localEnd;
      const isRangeEnd = isEnd && localStart;

      days.push(
        <div
          key={day}
          className={cn(
            "relative flex items-center justify-center h-8",
            // Range background spans full cell width
            inRange && "bg-emerald-50",
            isRangeStart && "bg-gradient-to-r from-transparent via-emerald-50 to-emerald-50 rounded-l-full",
            isRangeEnd && "bg-gradient-to-l from-transparent via-emerald-50 to-emerald-50 rounded-r-full",
          )}
        >
          <button
            type="button"
            onClick={() => handleDateClick(day)}
            data-day={day}
            tabIndex={focusedDay === day ? 0 : -1}
            aria-selected={isSelected}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`${day} ${monthNames[month]} ${year}`}
            className={cn(
              "h-9 w-9 rounded-full text-xs flex items-center justify-center transition-colors relative z-10",
              isSelected
                ? 'bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700'
                : isToday
                  ? 'text-emerald-600 font-bold border border-emerald-300 hover:bg-emerald-50'
                  : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            {day}
          </button>
        </div>
      );
    }

    return (
      <div className="px-4 pt-1.5 pb-2">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-2 px-1">
          <button
            type="button"
            onClick={() => navigateMonth('prev')}
            className="min-w-[36px] min-h-[36px] p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors flex items-center justify-center"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 block shrink-0" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className="font-semibold text-slate-900 text-sm hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors"
              aria-label="Select month"
            >
              {monthNames[month]}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('year')}
              className="font-semibold text-slate-900 text-sm hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors"
              aria-label="Select year"
            >
              {year}
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigateMonth('next')}
            className="min-w-[36px] min-h-[36px] p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors flex items-center justify-center"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 block shrink-0" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0 mb-0.5">
          {dayNames.map((d, i) => (
            <div key={i} className="h-6 flex items-center justify-center text-xs font-semibold text-slate-400">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div
          role="grid"
          aria-label="Calendar days"
          aria-multiselectable="false"
          onKeyDown={handleGridKeyDown}
          className="grid grid-cols-7 gap-y-0.5"
        >
          {days}
        </div>
      </div>
    );
  };

  const renderTimePicker = (type: 'start' | 'end') => {
    const time = type === 'start' ? startTime : endTime;
    const setTime = type === 'start' ? setStartTime : setEndTime;

    const handleTimeChange = (field: 'h' | 'm' | 's', value: string) => {
      let val = value.replace(/\D/g, '');
      if (field === 'h') {
        if (parseInt(val) > 23) val = '23';
      } else {
        if (parseInt(val) > 59) val = '59';
      }
      setTime(prev => ({ ...prev, [field]: val.padStart(2, '0') }));
    };

    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={time.h}
          onChange={(e) => handleTimeChange('h', e.target.value)}
          aria-label={`${type === 'start' ? 'Start' : 'End'} hour`}
          inputMode="numeric"
          className="w-10 h-9 text-center text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          maxLength={2}
        />
        <span className="text-slate-400">:</span>
        <input
          type="text"
          value={time.m}
          onChange={(e) => handleTimeChange('m', e.target.value)}
          aria-label={`${type === 'start' ? 'Start' : 'End'} minute`}
          inputMode="numeric"
          className="w-10 h-9 text-center text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          maxLength={2}
        />
        <span className="text-slate-400">:</span>
        <input
          type="text"
          value={time.s}
          onChange={(e) => handleTimeChange('s', e.target.value)}
          aria-label={`${type === 'start' ? 'Start' : 'End'} second`}
          inputMode="numeric"
          className="w-10 h-9 text-center text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          maxLength={2}
        />
      </div>
    );
  };

  const renderPresets = () => (
    <div className="w-full lg:w-[140px] border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col p-2 bg-slate-50/20 shrink-0">
      <div className="grid grid-cols-4 lg:flex lg:flex-col gap-1">
        {[
          { label: 'Today', key: 'today' },
          { label: 'Yesterday', key: 'yesterday' },
          { label: 'This week', key: 'thisWeek' },
          { label: 'Last week', key: 'lastWeek' },
          { label: 'This month', key: 'thisMonth' },
          { label: 'Last month', key: 'lastMonth' },
          { label: 'This year', key: 'thisYear' },
          { label: 'Last year', key: 'lastYear' },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key as PresetKey)}
            className="inline-flex items-center justify-center lg:justify-start px-1.5 py-1 lg:px-2 lg:py-2 text-[10px] lg:text-sm text-slate-600 bg-white border border-slate-200 lg:border-transparent hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 rounded-full lg:rounded-lg transition-all font-medium whitespace-nowrap"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      {label && (
        <label htmlFor={`${pickerId}-trigger`} className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
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
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-2 w-full px-3 py-2 h-9 rounded-lg text-sm transition-colors focus:outline-none',
          'border bg-white',
          disabled
            ? 'bg-slate-100 cursor-default border-slate-200'
            : isOpen
              ? 'ring-1 ring-emerald-500 border-emerald-500'
              : 'border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500'
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <IconCalendarWeek className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className={cn("truncate", !(startDate || endDate) ? "text-slate-400" : (disabled ? "text-slate-600" : "text-slate-700"))}>
            {displayValue}
          </span>
        </div>
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id={dialogId}
              ref={popoverRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              tabIndex={-1}
              initial={{ opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
              style={popoverStyle}
              className={cn(
                "bg-white rounded-xl shadow-[0_20px_60px_rgba(15,23,42,0.14)] border border-slate-200 overflow-hidden flex flex-col lg:flex-row max-w-[calc(100vw-2rem)]",
                includeTime ? "w-[min(360px,calc(100vw-2rem))] lg:w-[520px]" : "w-[min(340px,calc(100vw-2rem))] lg:w-[480px]"
              )}
            >
              <div className="sr-only" id={dialogTitleId}>Choose date range</div>
              <div className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>
              <div className="flex-1 flex flex-col">
                {/* Start / Due date inputs */}
                <div className="px-4 pt-4 pb-2">
                  <div className={cn("flex gap-3", includeTime ? "flex-col" : "flex-row")}> 
                    {/* Start */}
                    <div className={cn("flex items-center justify-between gap-4", !includeTime && "flex-1")}> 
                      <div className="flex-1 min-w-0">
                        <label htmlFor={startFieldId} className="text-xs font-medium text-slate-500 mb-1 block">Start Date</label>
                        <button
                          id={startFieldId}
                          type="button"
                          onClick={() => setActiveField('start')}
                          aria-pressed={activeField === 'start'}
                          className={cn(
                            "flex items-center gap-1.5 w-full px-2.5 py-1.5 h-9 rounded-lg text-sm border transition-colors",
                            activeField === 'start'
                              ? "border-emerald-500 ring-1 ring-emerald-500"
                              : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <IconCalendarWeek className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className={cn("truncate text-xs", localStart ? "text-slate-900" : "text-slate-400")}>
                            {localStart ? formatDateDisplay(formatDateValue(localStart), false) : 'dd/mm/yyyy'}
                          </span>
                        </button>
                      </div>
                      {includeTime && (
                        <div className="shrink-0 pt-5">
                          {renderTimePicker('start')}
                        </div>
                      )}
                    </div>

                    {/* Due/End */}
                    <div className={cn("flex items-center justify-between gap-4", !includeTime && "flex-1")}> 
                      <div className="flex-1 min-w-0">
                        <label htmlFor={endFieldId} className="text-xs font-medium text-slate-500 mb-1 block">End Date</label>
                        <button
                          id={endFieldId}
                          type="button"
                          onClick={() => setActiveField('end')}
                          aria-pressed={activeField === 'end'}
                          className={cn(
                            "flex items-center gap-1.5 w-full px-2.5 py-1.5 h-9 rounded-lg text-sm border transition-colors",
                            activeField === 'end'
                              ? "border-emerald-500 ring-1 ring-emerald-500"
                              : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <IconCalendarWeek className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className={cn("truncate text-xs", localEnd ? "text-slate-900" : "text-slate-400")}>
                            {localEnd ? formatDateDisplay(formatDateValue(localEnd), false) : 'dd/mm/yyyy'}
                          </span>
                        </button>
                      </div>
                      {includeTime && (
                        <div className="shrink-0 pt-5">
                          {renderTimePicker('end')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-200" />

                {/* Calendar */}
                {renderCalendar()}

                {/* Footer */}
                <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    >
                      Reset range
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => closePopover()}
                        className="h-8 text-xs px-3"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApply}
                        disabled={applyLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-500 disabled:cursor-wait text-white h-8 text-xs px-4 inline-flex items-center gap-2"
                      >
                        {applyLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {applyLoading ? 'Applying...' : 'Apply'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              {renderPresets()}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
