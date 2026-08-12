import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
}) => {
  const pickerIdRef = useRef(`time-picker-${Math.random().toString(36).slice(2, 11)}`);
  const pickerId = pickerIdRef.current;
  const [isOpen, setIsOpen] = useState(false);
  
  // Internal state for hours and minutes
  const [hours, setHours] = useState<number>(() => {
    if (!value) return 0;
    const [h] = value.split(':');
    return parseInt(h) || 0;
  });
  const [minutes, setMinutes] = useState<number>(() => {
    if (!value) return 0;
    const [, m] = value.split(':');
    return parseInt(m) || 0;
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0 });

  // Sync internal state with external value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHours(parseInt(h) || 0);
      setMinutes(parseInt(m) || 0);
    }
  }, [value]);

  // Close sibling dropdowns
  useEffect(() => {
    const handleCloseOthers = (event: CustomEvent<{ openId: string }>) => {
      if (event.detail.openId !== pickerId && isOpen) setIsOpen(false);
    };
    window.addEventListener('select-dropdown-open' as any, handleCloseOthers);
    return () => window.removeEventListener('select-dropdown-open' as any, handleCloseOthers);
  }, [pickerId, isOpen]);

  // Popover positioning
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const { innerWidth: sw, innerHeight: sh } = window;
      const popoverWidth = 200;
      const popoverHeight = 160;
      
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
  }, [isOpen]);

  // Click-outside + Escape
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

  const handleApply = () => {
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    onChange(`${hh}:${mm}`);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = () => {
    onChange('');
    setHours(0);
    setMinutes(0);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (val === '') { setHours(0); return; }
    let h = parseInt(val);
    if (h > 23) h = 23;
    setHours(h);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (val === '') { setMinutes(0); return; }
    let m = parseInt(val);
    if (m > 59) m = 59;
    setMinutes(m);
  };

  return (
    <div className="relative w-full">
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
            ? 'bg-slate-100 cursor-default border-slate-200 text-slate-600'
            : isOpen
              ? 'ring-1 ring-emerald-500 border-emerald-500'
              : 'border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className={cn("truncate", !value ? "text-slate-400" : (disabled ? "text-slate-600" : "text-slate-700"))}>
            {value || placeholder}
          </span>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              role="dialog"
              initial={{ opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: popoverStyle.top === 'auto' ? 10 : -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
              style={popoverStyle}
              className="bg-white rounded-xl shadow-[0_20px_60px_rgba(15,23,42,0.14)] border border-slate-200 overflow-hidden flex flex-col w-[200px] focus:outline-none"
            >
              <div className="p-4 bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative group">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={String(hours).padStart(2, '0')}
                      onChange={handleHourChange}
                      onFocus={(e) => e.target.select()}
                      className="w-full h-10 text-center border border-slate-200 rounded-lg text-base font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                    />
                    <span className="absolute right-1.5 top-1 -translate-y-0 text-[8px] text-slate-400 font-bold pointer-events-none uppercase">H</span>
                  </div>

                  <span className="text-slate-400 font-bold">:</span>

                  <div className="flex-1 relative group">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={String(minutes).padStart(2, '0')}
                      onChange={handleMinuteChange}
                      onFocus={(e) => e.target.select()}
                      className="w-full h-10 text-center border border-slate-200 rounded-lg text-base font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                    />
                    <span className="absolute right-1.5 top-1 -translate-y-0 text-[8px] text-slate-400 font-bold pointer-events-none uppercase">M</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-2 px-3 flex items-center justify-between gap-2 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-8"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-4 text-xs"
                >
                  Set Time
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
