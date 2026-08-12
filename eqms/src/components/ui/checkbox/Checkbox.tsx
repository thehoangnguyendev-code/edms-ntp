import React, { useId as useReactId, useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';
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
}

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  checked = false,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
  className,
  labelClassName,
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
            disabled && 'cursor-not-allowed pointer-events-none hover:border-slate-200',
            disabled && !(checked || showDash) && 'bg-slate-100 border-slate-200'
          )}
        >
          {checked ? (
            <Check className="h-3.5 w-3.5 stroke-[3] text-white" />
          ) : showDash ? (
            <Minus className="h-3.5 w-3.5 stroke-[3] text-white" />
          ) : null}
        </label>
      </div>
      {label && (
        <label
          htmlFor={checkboxId}
          className={cn(
            'text-xs sm:text-sm font-medium text-slate-700 cursor-pointer',
            labelClassName,
            disabled && 'cursor-not-allowed text-slate-600'
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
};
