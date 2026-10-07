import React from "react";
import { Search, X } from "lucide-react";

interface FilterSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
  /** Delay before `onChange` fires for typed text. Clear and external value changes apply immediately. */
  debounceMs?: number;
  disabled?: boolean;
  /** Fills the parent width (desktop filter bars). Defaults to true. */
  fullWidth?: boolean;
}

/**
 * Shared search field for filter bars and Advanced-filter option lists. Markup and classes mirror
 * DocumentFilters' search input so every filter search looks and behaves the same, including the
 * clear (X) button. Typed text is debounced before it reaches the parent, which owns server queries.
 */
export const FilterSearchInput: React.FC<FilterSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  debounceMs = 300,
  disabled = false,
  fullWidth = true,
  ...rest
}) => {
  const [draft, setDraft] = React.useState(value);
  const timer = React.useRef<number | undefined>(undefined);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const cancelPending = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  // Keep the field in step when the parent clears or restores the value (e.g. Clear Filters, Back navigation).
  // Only user typing schedules a callback, so an external value never gets echoed back to the parent.
  React.useEffect(() => {
    cancelPending();
    setDraft(value);
  }, [value]);

  React.useEffect(() => cancelPending, []);

  const commit = (next: string) => {
    cancelPending();
    if (debounceMs <= 0) {
      onChangeRef.current(next);
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      onChangeRef.current(next);
    }, debounceMs);
  };

  const handleInput = (next: string) => {
    setDraft(next);
    commit(next);
  };

  const clear = () => {
    cancelPending();
    setDraft("");
    onChangeRef.current("");
  };

  return (
    <div className={fullWidth ? "relative w-full" : "relative"}>
      <div
        data-advanced-search-icon
        className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
      >
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <input
        type="text"
        aria-label={rest["aria-label"]}
        placeholder={placeholder}
        value={draft}
        disabled={disabled}
        onChange={(event) => handleInput(event.target.value)}
        className="block w-full pl-10 pr-9 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
      />
      {draft && !disabled && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
