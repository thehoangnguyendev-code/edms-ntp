import React from 'react';
import { Check, Search } from 'lucide-react';
import type { SelectOption } from '@/components/ui/select/Select';

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
  return <div className="space-y-3">
    <label className="relative block">
      <span className="sr-only">Search {label}</span>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input aria-label={`Search ${label}`} value={query} disabled={disabled}
        onChange={event => setQuery(event.target.value)} placeholder={`Search ${label.toLocaleLowerCase()}...`}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50" />
    </label>
    {disabled && <p className="text-xs text-slate-500">This filter is fixed for the current view.</p>}
    {loading && <p role="status" className="text-sm text-slate-500">Loading options...</p>}
    {failed && <div role="alert" className="text-sm text-red-600">Unable to load options. <button type="button" className="underline" onClick={() => setRetry(previous => previous + 1)}>Retry</button></div>}
    <div role="radiogroup" aria-label={label} aria-disabled={disabled} aria-busy={loading} className="divide-y divide-slate-100">
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
