import React, { useId as useReactId, useEffect, useRef } from 'react';
import { cn } from '../utils';

/**
 * Checkbox component with custom styling
 * 
 * @example
 * ```tsx
 * <Checkbox 
 *   checked={isChecked} 
 *   onChange={setIsChecked}
 *   label="Accept terms" 
 * />
 * ```
 */
export interface CheckboxProps {
  /** Input element ID */
  id?: string;
  /** Checked state */
  checked?: boolean;
  /** Callback when checked state changes */
  onChange?: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Disable the checkbox */
  disabled?: boolean;
  /** Visually shows a "partially selected" dash state (does not affect the checked value) */
  indeterminate?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the label */
  labelClassName?: string;
  /** The name a screen reader reads when the checkbox has no visible label (a box in a table row or in a table header). */
  'aria-label'?: string;
}

/**
 * The mark is drawn like the Animate UI checkbox: the stroke grows along its path (0.3 s) after the box has filled (0.2 s delay) and is erased at once when the box is cleared.
 * With reduced motion the mark only fades.
 */
const drawClass = (on: boolean, delayed = true) => cn(
  '[stroke-dasharray:1] transition-[stroke-dashoffset,opacity] duration-300 ease-[cubic-bezier(0,0,0.58,1)] motion-reduce:[stroke-dashoffset:0]',
  on ? cn('[stroke-dashoffset:0] opacity-100 motion-reduce:delay-0', delayed && 'delay-200') : '[stroke-dashoffset:1] opacity-0',
);

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  checked = false,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
  className,
  labelClassName,
  'aria-label': ariaLabel,
}) => {
  const generatedId = useReactId();
  const checkboxId = id || generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.checked);
    }
  };

  const showDash = indeterminate && !checked;

  return (
    <div className={cn('flex items-center gap-2 min-h-[40px] sm:min-h-0', className)}>
      <div className="relative flex items-center justify-start">
        <input
          ref={inputRef}
          id={checkboxId}
          type="checkbox"
          aria-label={ariaLabel}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <label
          htmlFor={checkboxId}
          className={cn(
            'flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all',
            'peer-focus-visible:ring-1 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2',
            checked || showDash
              ? 'bg-emerald-600 border-emerald-600'
              : 'bg-white border-slate-200 hover:border-emerald-400',
            disabled && 'cursor-default pointer-events-none hover:border-slate-200',
            disabled && !(checked || showDash) && 'bg-white border-slate-300'
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5 text-white">
            <path d="M4 12.5l5 5L20 6.5" pathLength={1} className={drawClass(checked)} />
            <path d="M5 12h14" pathLength={1} className={drawClass(showDash && !checked, false)} />
          </svg>
        </label>
      </div>
      {label && (
        <label
          htmlFor={checkboxId}
          className={cn(
            'capitalize',
            'text-xs sm:text-sm font-medium text-slate-700 cursor-pointer',
            labelClassName,
            disabled && 'cursor-default'
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
};
