import React from 'react';
import { Check } from 'lucide-react';
import type { SelectOption } from '@/components/ui/select/Select';
import { FilterSearchInput } from './FilterSearchInput';

/** Single-value filter list. Values and server search remain identical to the existing Select contract. */
export function FilterOptionList({ label, value, options, onChange, onSearch, disabled = false, active = true }: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onSearch?: (query: string) => Promise<SelectOption[]>;
  disabled?: boolean;
  active?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SelectOption[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const search = React.useRef(onSearch);
  search.current = onSearch;
  const hasSearch = Boolean(onSearch);
  React.useEffect(() => {
    if (!active || disabled || !hasSearch) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const timer = window.setTimeout(async () => {
      try {
        const next = await search.current!(query.trim());
        if (!cancelled) setResults(next);
      } catch {
        if (!cancelled) { setResults([]); setFailed(true); }
      } finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [active, disabled, hasSearch, query, retry]);

  const candidates = hasSearch && results !== null
    ? [...options.filter(option => String(option.value) === 'All' || String(option.value) === ''), ...results]
    : options;
  const seen = new Set<string>();
  const visible = candidates.filter(option => {
    const key = String(option.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return hasSearch || option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  // Search stays pinned at the top; only the option values scroll underneath it.
  // p-1: the scrolling pane clips box-shadow/focus rings at its edge; the padding keeps the search border whole.
  return <div className="flex flex-col gap-3 p-1">
    <div className="shrink-0">
      <FilterSearchInput aria-label={`Search ${label}`} value={query} disabled={disabled} debounceMs={0}
        onChange={setQuery} placeholder={`Search ${label.toLocaleLowerCase()}...`} />
    </div>
    {disabled && <p className="shrink-0 text-xs text-slate-500">This filter is fixed for the current view.</p>}
    {loading && <p role="status" className="shrink-0 text-sm text-slate-500">Loading options...</p>}
    {failed && <div role="alert" className="shrink-0 text-sm text-red-600">Unable to load options. <button type="button" className="underline" onClick={() => setRetry(previous => previous + 1)}>Retry</button></div>}
    <div role="radiogroup" aria-label={label} aria-disabled={disabled} aria-busy={loading} className="max-h-72 overflow-y-auto divide-y divide-slate-100">
      {visible.map(option => <button key={String(option.value)} type="button" role="radio"
        aria-checked={String(option.value) === value} disabled={disabled || loading}
        onClick={() => onChange(String(option.value))}
        className="flex w-full items-center gap-3 rounded px-2 py-3 text-left text-sm text-slate-700 hover:bg-emerald-50 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
        <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${String(option.value) === value ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
          {String(option.value) === value && <Check className="h-3 w-3" />}
        </span>
        {option.icon}<span className="min-w-0 break-words">{option.label}</span>
      </button>)}
    </div>
    {!loading && !failed && visible.length === 0 && <p className="text-sm text-slate-500">No matching options.</p>}
  </div>;
}
