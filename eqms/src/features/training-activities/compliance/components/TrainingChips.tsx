export interface TrainingChip { id: string; name: string; count: number; tone: "bad" | "warn" }

/** One chip per required training that has a gap (and "All" first); choosing one narrows the table below to that training. The server filters, the chips only send the choice. */
export function TrainingChips({ items, allLabel, allCount, selectedId, onSelect, ariaLabel }: {
  items: TrainingChip[]; allLabel: string; allCount: number; selectedId: string; onSelect: (id: string) => void; ariaLabel: string;
}) {
  const chip = (id: string, name: string, count: number, tone: "bad" | "warn" | "plain") => {
    const selected = id === selectedId;
    const countTone = selected ? "text-emerald-800" : tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
    return (
      <li key={id}>
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(id)}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selected ? "border-emerald-600 bg-emerald-50 font-semibold text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          <span className="min-w-0 truncate">{name}</span>
          <b className={`shrink-0 tabular-nums ${countTone}`}>{count}</b>
        </button>
      </li>
    );
  };
  return (
    <ul aria-label={ariaLabel} className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
      {chip("", allLabel, allCount, "plain")}
      {items.map((t) => chip(t.id, t.name, t.count, t.tone))}
    </ul>
  );
}
