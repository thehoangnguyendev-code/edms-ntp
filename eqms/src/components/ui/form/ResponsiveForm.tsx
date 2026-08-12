import React, { useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../utils';

/**
 * Responsive Form Components
 * Optimized for Desktop and Tablet (iPad portrait & landscape)
 */

/**
 * Form field wrapper component
 * 
 * @example
 * ```tsx
 * <FormField label="Document Title" required>
 *   <input type="text" className="..." />
 * </FormField>
 * ```
 */
export interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  layout?: 'vertical' | 'horizontal';
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  htmlFor,
  error,
  required,
  className,
  layout = 'vertical',
  hint,
}) => {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const hintId = hint && !error ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  let hasBoundControl = false;
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child) || hasBoundControl) {
      return child;
    }

    hasBoundControl = true;

    const childProps = (child.props ?? {}) as Record<string, unknown>;
    const existingDescribedBy =
      typeof childProps['aria-describedby'] === 'string' ? childProps['aria-describedby'] : undefined;
    const describedBy = [existingDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

    return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
      id: (childProps.id as string | undefined) ?? controlId,
      'aria-describedby': describedBy,
      ...(error ? { 'aria-invalid': true } : {}),
    });
  });

  return (
    <div
      className={cn(
        'w-full',
        layout === 'horizontal' && 'md:flex md:items-start md:gap-4',
        className
      )}
    >
      <label
        htmlFor={controlId}
        className={cn(
          'block text-slate-700 font-medium mb-2',
          // Responsive font size
          'text-sm md:text-base',
          // Horizontal layout
          layout === 'horizontal' && 'md:w-1/3 md:pt-3 md:mb-0 md:text-right',
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className={cn('flex-1', layout === 'horizontal' && 'md:w-2/3')}>
        {enhancedChildren}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-xs md:text-sm text-slate-500">{hint}</p>
        )}
        {error && (
          <p id={errorId} className="mt-1.5 text-xs md:text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}
      </div>
    </div>
  );
};

// Responsive Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({ 
  className, 
  error, 
  fullWidth = true,
  ...props 
}) => {
  return (
    <input
      className={cn(
        'h-9 rounded-lg border transition-all',
        // Responsive padding and font
        'px-3 md:px-4',
        'text-sm md:text-base',
        // Width
        fullWidth ? 'w-full' : 'w-auto',
        // States
        error
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
          : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500',
        'focus:outline-none focus:ring-1',
        'placeholder:text-slate-400 placeholder:text-sm',
        'disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-600 disabled:border-slate-200',
        'read-only:bg-slate-100 read-only:cursor-default read-only:text-slate-600 read-only:border-slate-200',
        className
      )}
      {...props}
    />
  );
};

// Responsive Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({ 
  className, 
  error,
  fullWidth = true,
  ...props 
}) => {
  return (
    <textarea
      className={cn(
        'rounded-lg border transition-all resize-none',
        // Responsive padding and font
        'px-3 py-2 md:px-4 md:py-3',
        'text-sm md:text-base',
        // Width
        fullWidth ? 'w-full' : 'w-auto',
        // States
        error
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
          : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500',
        'focus:outline-none focus:ring-1',
        'placeholder:text-slate-400 placeholder:text-sm',
        'disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-600 disabled:border-slate-200',
        'read-only:bg-slate-100 read-only:cursor-default read-only:text-slate-600 read-only:border-slate-200',
        className
      )}
      {...props}
    />
  );
};

// Form Grid Layout
interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export const FormGrid: React.FC<FormGridProps> = ({
  children,
  columns = 2,
  className,
}) => {
  return (
    <div
      className={cn(
        'grid gap-4 md:gap-6',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  );
};

// Form Actions (Submit/Cancel buttons)
interface FormActionsProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  align = 'right',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 md:gap-3 pt-4 md:pt-6 border-t border-slate-200',
        // Responsive layout
        'flex-col sm:flex-row',
        align === 'left' && 'sm:justify-start',
        align === 'center' && 'sm:justify-center',
        align === 'right' && 'sm:justify-end',
        className
      )}
    >
      {children}
    </div>
  );
};
