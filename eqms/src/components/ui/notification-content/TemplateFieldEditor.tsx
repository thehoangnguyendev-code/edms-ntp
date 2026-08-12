import React, { useRef } from 'react';
import { VariablePicker } from './VariablePicker';

interface TemplateFieldEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  availableVariables: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}

/** Single labeled field (input or textarea) with a VariablePicker above it that inserts a
 * {{token}} at the current cursor position — the building block TemplateEditor composes per
 * channel (title/summary for in-app, title/body for escalation). */
export const TemplateFieldEditor: React.FC<TemplateFieldEditorProps> = ({
  label,
  value,
  onChange,
  availableVariables,
  multiline = false,
  rows = 4,
  maxLength,
  placeholder,
  hint,
  disabled,
}) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const handleInsert = (token: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange(`${value}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const fieldClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700">{label}</label>
        {maxLength && (
          <span className="text-2xs text-slate-400">{value.length}/{maxLength}</span>
        )}
      </div>
      <VariablePicker availableVariables={availableVariables} onInsert={handleInsert} disabled={disabled} />
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          className={`${fieldClass} resize-y`}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          className={fieldClass}
        />
      )}
      {hint && <p className="text-2xs text-slate-500">{hint}</p>}
    </div>
  );
};
