import React from 'react';
import { cn } from '../utils';

/**
 * Radio button component with custom styling
 * 
 * @example
 * ```tsx
 * // Single Radio
 * <Radio 
 *   id="option1"
 *   name="choice"
 *   value="option1"
 *   checked={selected === "option1"} 
 *   onChange={() => setSelected("option1")}
 *   label="Option 1" 
 * />
 * 
 * // Radio Group
 * <RadioGroup
 *   label="Select an option"
 *   value={selected}
 *   onChange={setSelected}
 *   options={[
 *     { label: "Option 1", value: "option1" },
 *     { label: "Option 2", value: "option2" }
 *   ]}
 * />
 * ```
 */
export interface RadioProps {
  /** Input element ID */
  id?: string;
  /** Input name attribute (required for grouping) */
  name: string;
  /** Radio value */
  value: string | number;
  /** Checked state */
  checked?: boolean;
  /** Callback when checked state changes */
  onChange?: (value: string | number) => void;
  /** Label text */
  label?: string;
  /** Description text below label */
  description?: string;
  /** Disable the radio */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Card variant styling */
  variant?: 'default' | 'card';
  /** Icon element (for card variant) */
  icon?: React.ReactNode;
}

export const Radio: React.FC<RadioProps> = ({
  id,
  name,
  value,
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  className,
  variant = 'default',
  icon,
}) => {
  const handleChange = () => {
    if (onChange && !disabled) {
      onChange(value);
    }
  };

  const radioId = id || `radio-${name}-${value}`;

  // Card variant
  if (variant === 'card') {
    return (
      <label
        htmlFor={radioId}
          className={cn(
            'relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all',
            checked
              ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/20'
              : 'border-slate-200 bg-white hover:border-emerald-400',
          disabled && 'cursor-not-allowed hover:border-slate-200 bg-slate-100 text-slate-600',
          className
        )}
      >
        <input
          id={radioId}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="flex-1">
          {label && (
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1">
              {icon}
              <span>{label}</span>
            </div>
          )}
          {description && (
            <p className="text-[10px] sm:text-xs text-slate-600">
              {description}
            </p>
          )}
        </div>
        <div
          className={cn(
            'relative ml-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
            checked
              ? 'bg-white border-emerald-600'
              : 'bg-white border-slate-200 hover:border-emerald-400',
            disabled && 'bg-slate-100 border-slate-200 hover:border-slate-200'
          )}
        >
          {checked && (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-in fade-in zoom-in-75 duration-200" />
          )}
        </div>
      </label>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center', className)}>
      <input
        id={radioId}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
          className={cn(
          'h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 transition-all shrink-0',
          disabled && 'cursor-not-allowed opacity-60 accent-slate-400'
        )}
      />
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <label
              htmlFor={radioId}
              className={cn(
                'block text-xs sm:text-sm font-medium text-slate-700 cursor-pointer',
                disabled && 'cursor-not-allowed text-slate-600'
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={cn(
              'text-xs sm:text-sm text-slate-500 mt-0.5'
            )}>
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Radio Group component for managing multiple radio buttons
 */
export interface RadioOption {
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Group label */
  label?: string;
  /** Group name (for input name attribute) */
  name?: string;
  /** Currently selected value */
  value: string | number;
  /** Callback when value changes */
  onChange: (value: string | number) => void;
  /** Array of radio options */
  options: RadioOption[];
  /** Layout direction */
  layout?: 'vertical' | 'horizontal';
  /** Disable all radios */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Error message */
  error?: string;
  /** Required field indicator */
  required?: boolean;
  /** Card variant styling */
  variant?: 'default' | 'card';
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  name = 'radio-group',
  value,
  onChange,
  options,
  layout = 'vertical',
  disabled = false,
  className,
  error,
  required = false,
  variant = 'default',
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-xs sm:text-sm font-medium text-slate-700 block">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className={cn(
        variant === 'card' && layout === 'horizontal'
          ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
          : variant === 'card'
            ? 'space-y-3'
            : layout === 'horizontal'
              ? 'flex flex-wrap gap-6 space-y-0'
              : 'space-y-3'
      )}>
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            label={option.label}
            description={option.description}
            disabled={disabled || option.disabled}
            icon={option.icon}
            variant={variant}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1.5">{error}</p>
      )}
    </div>
  );
};
