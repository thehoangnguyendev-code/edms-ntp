import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { SectionLoading } from "@/components/ui/loading/Loading";

type Side = "available" | "selected";

interface Props<T> {
  /** What is picked, in the plural and in lower case ("trainings"): it names the lists, the search boxes and the buttons. */
  noun: string;
  available: T[];
  selected: T[];
  getKey: (item: T) => string;
  getTitle: (item: T) => string;
  /** The text that is searched in the selected list (the title when it is not given). */
  getSearchText?: (item: T) => string;
  getTooltip?: (item: T) => string | undefined;
  renderBadge?: (item: T) => ReactNode;
  onAdd: (items: T[]) => void;
  onRemove: (keys: string[]) => void;
  /** The search of the available list belongs to the caller: it may ask the server, or add what was typed. */
  query: string;
  onQueryChange: (query: string) => void;
  availableSearchPlaceholder?: string;
  loading?: boolean;
  emptyAvailable?: (query: string) => string;
  emptySelected?: string;
  /** Only the selected list is shown, without moving anything. */
  readOnly?: boolean;
}

const capital = (text: string) => text.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Two lists to move items between, as the related documents of a document are chosen: what can be added on the left, what is selected on the right. One item moves with a double click
 * (or Enter), or by dragging it to the other list; several move with the arrows. On the left one item is marked at a time, on the right several.
 */
export function TransferPicker<T>({
  noun, available, selected, getKey, getTitle, getSearchText, getTooltip, renderBadge, onAdd, onRemove, query, onQueryChange,
  availableSearchPlaceholder, loading, emptyAvailable, emptySelected, readOnly,
}: Props<T>) {
  const [selectedQuery, setSelectedQuery] = useState("");
  const [markedAvailable, setMarkedAvailable] = useState<string[]>([]);
  const [markedSelected, setMarkedSelected] = useState<string[]>([]);

  const shownSelected = useMemo(() => {
    const q = selectedQuery.trim().toLowerCase();
    return q ? selected.filter((item) => (getSearchText?.(item) ?? getTitle(item)).toLowerCase().includes(q)) : selected;
  }, [selected, selectedQuery, getSearchText, getTitle]);

  const toggleAvailable = (key: string) => setMarkedAvailable((old) => (old.includes(key) ? [] : [key]));
  const toggleSelected = (key: string) => setMarkedSelected((old) => (old.includes(key) ? old.filter((k) => k !== key) : [...old, key]));
  const add = (items: T[]) => {
    if (items.length === 0) return;
    onAdd(items);
    setMarkedAvailable([]);
  };
  const remove = (keys: string[]) => {
    if (keys.length === 0) return;
    onRemove(keys);
    setMarkedSelected([]);
  };

  const handleDragStart = (e: DragEvent, key: string, source: Side) => {
    e.dataTransfer.setData("itemKey", key);
    e.dataTransfer.setData("source", source);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };
  const handleDragEnd = (e: DragEvent) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1"; };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDropToSelected = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.getData("source") !== "available") return;
    const key = e.dataTransfer.getData("itemKey");
    const item = available.find((x) => getKey(x) === key);
    if (item) add([item]);
  };
  const handleDropToAvailable = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.getData("source") !== "selected") return;
    remove([e.dataTransfer.getData("itemKey")]);
  };

  const row = (item: T, side: Side) => {
    const key = getKey(item);
    const active = (side === "available" ? markedAvailable : markedSelected).includes(key);
    const activate = side === "available" ? () => add([item]) : () => remove([key]);
    return (
      <div
        key={key}
        role="option"
        aria-selected={active}
        tabIndex={0}
        draggable={!readOnly}
        onDragStart={readOnly ? undefined : (e) => handleDragStart(e, key, side)}
        onDragEnd={handleDragEnd}
        onClick={() => !readOnly && (side === "available" ? toggleAvailable(key) : toggleSelected(key))}
        onDoubleClick={() => !readOnly && activate()}
        onKeyDown={(e) => {
          if (readOnly) return;
          if (e.key === "Enter") activate();
          else if (e.key === " ") { e.preventDefault(); if (side === "available") toggleAvailable(key); else toggleSelected(key); }
        }}
        title={getTooltip?.(item)}
        className={cn(
          "flex cursor-pointer items-start justify-between gap-3 border-l-2 border-transparent px-3 py-2.5 text-[11px] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500",
          side === "available" ? "hover:bg-emerald-50/50" : "hover:bg-white/80",
          active && (side === "available" ? "inset-0 border-emerald-500 bg-emerald-50 font-medium shadow-sm ring-1 ring-emerald-100/50" : "border-blue-500 bg-blue-50/80 font-medium shadow-inner"),
        )}
      >
        <span className="min-w-0 flex-1 break-words font-medium leading-relaxed text-slate-900">{getTitle(item)}</span>
        {renderBadge?.(item)}
      </div>
    );
  };

  const listClass = "custom-scrollbar max-h-[160px] min-h-[100px] flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 sm:max-h-[240px] sm:min-h-[180px]";
  const searchClass = "h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const selectedList = (
    <div role="listbox" aria-label={`Selected ${noun}`} aria-multiselectable onDragOver={handleDragOver} onDrop={handleDropToSelected} className={listClass}>
      {shownSelected.length > 0 ? (
        <div className="divide-y divide-slate-100">{shownSelected.map((item) => row(item, "selected"))}</div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-3 py-10 text-center text-slate-400 opacity-60">
          <Check className="mb-2 h-8 w-8 opacity-10" />
          <span className="text-xs">{selected.length === 0 ? (emptySelected ?? `No ${noun} selected`) : `No selected ${noun} match the search.`}</span>
        </div>
      )}
    </div>
  );

  if (readOnly) return selectedList;

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
      <div className="flex min-w-0 flex-col">
        <h3 className="mb-2 text-xs font-semibold text-slate-900 sm:mb-3 sm:text-sm">Available {capital(noun)}</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" aria-label={`Search available ${noun}`} value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder={availableSearchPlaceholder ?? "Search..."} className={searchClass} />
        </div>
        <div role="listbox" aria-label={`Available ${noun}`} aria-busy={loading} onDragOver={handleDragOver} onDrop={handleDropToAvailable} className={listClass}>
          {loading && available.length === 0 ? (
            <SectionLoading text="Loading…" />
          ) : available.length > 0 ? (
            <div className="divide-y divide-slate-100">{available.map((item) => row(item, "available"))}</div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-slate-400">
              <FileText className="mb-2 h-8 w-8 opacity-10" />
              {emptyAvailable ? emptyAvailable(query) : query ? `No matching ${noun}` : `No ${noun} available`}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 py-2 lg:flex-col lg:pt-12">
        <button
          type="button"
          onClick={() => add(available.filter((item) => markedAvailable.includes(getKey(item))))}
          disabled={markedAvailable.length === 0}
          className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 sm:p-2.5"
          title="Move to selected"
          aria-label="Move to selected"
        >
          <ChevronRight className="h-5 w-5 rotate-90 lg:rotate-0" />
        </button>
        <button
          type="button"
          onClick={() => remove(markedSelected)}
          disabled={markedSelected.length === 0}
          className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 sm:p-2.5"
          title="Move to available"
          aria-label="Move to available"
        >
          <ChevronLeft className="h-5 w-5 rotate-90 lg:rotate-0" />
        </button>
      </div>

      <div className="flex min-w-0 flex-col">
        <h3 className="mb-2 text-xs font-semibold text-slate-900 sm:mb-3 sm:text-sm">Selected {capital(noun)} ({selected.length})</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" aria-label={`Search selected ${noun}`} value={selectedQuery} onChange={(e) => setSelectedQuery(e.target.value)} placeholder="Search in selected..." className={searchClass} />
        </div>
        {selectedList}
      </div>
    </div>
  );
}
