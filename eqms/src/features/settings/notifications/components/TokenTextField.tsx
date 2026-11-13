import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { cn } from '@/components/ui/utils';
import { tokensIn } from './tokenHighlight';

export interface TokenTextFieldHandle {
  /** Puts text (a placeholder) where the cursor is, or in place of the selection. */
  insertText: (text: string) => void;
  focus: () => void;
}

interface TokenTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The placeholders the event offers; a token with another name is flagged. Null: any. */
  allowedTokens?: string[] | null;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: () => void;
  ariaLabel: string;
  id?: string;
}

/** A plain text field (a title, a subject, a short message) that can receive a placeholder at the cursor and says when a placeholder is not offered. */
export const TokenTextField = forwardRef<TokenTextFieldHandle, TokenTextFieldProps>(function TokenTextField(
  { value, onChange, allowedTokens = null, multiline, rows = 3, maxLength, placeholder, disabled, onFocus, ariaLabel, id },
  ref,
) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        const el = inputRef.current;
        if (!el) return;
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + text + value.slice(end);
        onChange(maxLength ? next.slice(0, maxLength) : next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + text.length, start + text.length);
        });
      },
      focus: () => inputRef.current?.focus(),
    }),
    [value, onChange, maxLength],
  );

  const unknown = allowedTokens ? tokensIn(value).filter((name) => !allowedTokens.includes(name)) : [];
  const shared = {
    id,
    ref: inputRef,
    value,
    disabled,
    placeholder,
    maxLength,
    'aria-label': ariaLabel,
    'aria-invalid': unknown.length > 0 || undefined,
    onFocus,
    className: cn(
      'w-full rounded-lg border bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-500',
      unknown.length > 0 ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500',
    ),
  };
  return (
    <div>
      {multiline ? (
        <textarea {...shared} rows={rows} className={cn(shared.className, 'resize-none py-2 leading-relaxed')} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...shared} type="text" className={cn(shared.className, 'h-9')} onChange={(e) => onChange(e.target.value)} />
      )}
      <div className="mt-1 flex items-start justify-between gap-3 text-xs">
        <span className={cn('min-w-0', unknown.length > 0 ? 'text-red-600' : 'text-transparent')} role={unknown.length > 0 ? 'alert' : undefined}>
          {unknown.length > 0 ? `Not offered by this notification: ${unknown.map((n) => `{{${n}}}`).join(', ')}. It will be refused when you save.` : '.'}
        </span>
        {maxLength ? <span className="shrink-0 text-slate-400">{value.length}/{maxLength}</span> : null}
      </div>
    </div>
  );
});
