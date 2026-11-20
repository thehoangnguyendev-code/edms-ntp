import React from "react";
import { cn } from "@/components/ui/utils";

export interface VisibilityOption {
  value: string;
  label: string;
  description: string;
  disabled?: boolean;
}

/**
 * The levels of a record-visibility choice side by side, one compact card each (the name and one line under it), so that three levels take one row
 * instead of three tall cards. A real radio input sits inside each card, so the keyboard and screen readers work as for any radio group.
 */
export const VisibilityOptions: React.FC<{
  name: string;
  value: string;
  options: readonly VisibilityOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ name, value, options, onChange, disabled = false }) => (
  <div role="radiogroup" className={cn("grid grid-cols-1 gap-2", options.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
    {options.map((option) => {
      const checked = value === option.value;
      const off = disabled || option.disabled;
      return (
        <label
          key={option.value}
          className={cn(
            "relative flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 pr-10 transition-colors",
            checked ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20" : "border-slate-200 bg-white hover:border-emerald-400",
            off && "cursor-default opacity-70 hover:border-slate-200",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={checked}
            aria-disabled={off || undefined}
            tabIndex={off ? -1 : undefined}
            onChange={() => { if (!off) onChange(option.value); }}
            className="peer sr-only"
          />
          <span className="text-sm font-medium text-slate-900">{option.label}</span>
          <span className="text-xs leading-snug text-slate-500">{option.description}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("absolute right-3 top-3 block h-5 w-5 shrink-0", checked ? "text-emerald-600" : "text-slate-300")}>
            <circle cx="10" cy="10" r="9" fill="white" stroke="currentColor" strokeWidth="2" />
            {checked && <circle cx="10" cy="10" r="5" fill="currentColor" />}
          </svg>
        </label>
      );
    })}
  </div>
);
