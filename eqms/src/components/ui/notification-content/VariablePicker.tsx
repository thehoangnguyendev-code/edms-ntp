import React from 'react';
import { Variable } from 'lucide-react';

interface VariablePickerProps {
  /** Comma-separated list of variable names valid for the current event, e.g.
   * "documentNumber,recipientName,dueDate" */
  availableVariables: string;
  onInsert: (token: string) => void;
  disabled?: boolean;
}

/** Chips for every {{variable}} declared on the current event — clicking one inserts the token.
 * Only variables declared on the event are offered, so authors can't reference one that will
 * never be substituted; TemplateEditor/backend still validate on Save as a second layer. */
export const VariablePicker: React.FC<VariablePickerProps> = ({ availableVariables, onInsert, disabled }) => {
  const variables = availableVariables
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (variables.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-slate-400">
        <Variable className="h-3 w-3" />
        Insert:
      </span>
      {variables.map((variable) => (
        <button
          key={variable}
          type="button"
          disabled={disabled}
          onClick={() => onInsert(`{{${variable}}}`)}
          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {`{{${variable}}}`}
        </button>
      ))}
    </div>
  );
};
