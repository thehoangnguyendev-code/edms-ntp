import React, { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { cn } from "@/components/ui/utils";
import { useDebounce } from "@/hooks";
import { knowledgeApi, type DocumentSuggestion } from "@/services/api/knowledge";
import { typeBadgeColor } from "./explorerModel";

/** Characters before the server is asked for suggestions, and the pause after the last key press. */
export const MIN_SUGGEST_LENGTH = 2;
export const SUGGEST_DEBOUNCE_MS = 250;

interface ExplorerSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.Ref<HTMLInputElement>;
  /** Enter with no suggestion chosen, or the last row: search all documents for the text. */
  onSubmit: () => void;
  /** A suggestion was chosen: open that document. */
  onOpenSuggestion: (suggestion: DocumentSuggestion) => void;
}

/** The text of `text` that matches `query`, in bold. */
const Highlight: React.FC<{ text: string | null; query: string }> = ({ text, query }) => {
  const value = text ?? "";
  const at = query ? value.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at)}
      <strong className="font-semibold text-emerald-700">{value.slice(at, at + query.length)}</strong>
      {value.slice(at + query.length)}
    </>
  );
};

/**
 * The search box of the Knowledge explorer, with auto-complete: after a short pause in typing the server is asked for the documents that
 * match, and they appear in a drop-down. The server answers only with documents the signed-in user may see in the Knowledge Base, so the
 * drop-down never names one they cannot open. Arrow keys move, Enter opens the highlighted document (or searches everything when none is
 * highlighted), Escape closes the list.
 */
export const ExplorerSearchBox: React.FC<ExplorerSearchBoxProps> = ({ value, onChange, inputRef, onSubmit, onOpenSuggestion }) => {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const query = value.trim();
  const settled = useDebounce(query, SUGGEST_DEBOUNCE_MS);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DocumentSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  /** The text the list on screen was answered for: the list is shown only while it still matches what is typed. */
  const [answered, setAnswered] = useState<string | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (settled.length < MIN_SUGGEST_LENGTH) {
      setItems([]);
      setStatus("idle");
      setAnswered(null);
      setActive(-1);
      return undefined;
    }
    const controller = new AbortController();
    knowledgeApi.suggest(settled, controller.signal)
      .then((result) => { setItems(result); setStatus("ready"); setAnswered(settled); setActive(-1); })
      .catch(() => { if (!controller.signal.aborted) { setItems([]); setStatus("error"); setAnswered(settled); } });
    // a newer request makes the older answer worthless
    return () => controller.abort();
  }, [settled]);

  const typedEnough = query.length >= MIN_SUGGEST_LENGTH;
  const showList = open && typedEnough;
  // until the server has answered for the text that is typed now, the list on screen belongs to older text
  const waiting = answered !== query;
  const rowCount = items.length + 1; // the last row searches everything

  const close = () => { setOpen(false); setActive(-1); };
  const choose = (index: number) => {
    if (index >= 0 && index < items.length) onOpenSuggestion(items[index]);
    else onSubmit();
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!typedEnough) return;
      event.preventDefault();
      if (!showList) { setOpen(true); return; }
      if (waiting || items.length === 0) return;
      setActive((current) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        return current < 0 ? (step === 1 ? 0 : rowCount - 1) : (current + step + rowCount) % rowCount;
      });
    } else if (event.key === "Enter") {
      if (showList && active >= 0 && !waiting) { event.preventDefault(); choose(active); }
      else if (typedEnough) { onSubmit(); close(); }
    } else if (event.key === "Escape" && showList) {
      // the first Escape only closes the list; the page clears the search on the next one
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative min-w-0 flex-1"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}
    >
      <SearchInput
        value={value}
        onChange={(next) => { onChange(next); setOpen(true); }}
        placeholder="Search all documents"
        ariaLabel="Search all documents"
        inputRef={inputRef}
        inputProps={{
          role: "combobox",
          "aria-autocomplete": "list",
          "aria-expanded": showList,
          "aria-controls": listId,
          "aria-activedescendant": showList && active >= 0 ? `${listId}-${active}` : undefined,
          autoComplete: "off",
          onKeyDown,
          onFocus: () => { if (typedEnough) setOpen(true); },
        }}
      />

      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Suggested documents"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {waiting && <p role="status" className="px-3 py-2 text-xs text-slate-500">Searching...</p>}
          {!waiting && status === "error" && <p role="status" className="px-3 py-2 text-xs text-red-600">Suggestions are not available right now. Press Enter to search.</p>}
          {!waiting && status === "ready" && items.length === 0 && (
            <p role="status" className="px-3 py-2 text-xs text-slate-500">No document you can open matches "{query}".</p>
          )}
          {!waiting && items.map((item, index) => (
            <div
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={active === index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm", active === index ? "bg-emerald-50" : "hover:bg-slate-50")}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-slate-900"><Highlight text={item.documentName} query={query} /></p>
                <p className="truncate text-xs tabular-nums text-slate-500">
                  <Highlight text={item.documentNumber} query={query} />
                  {item.revisionNumber ? ` · ${item.revisionNumber}` : ""}
                  {item.department ? ` · ${item.department}` : ""}
                </p>
              </div>
              {item.documentType && <Badge color={typeBadgeColor(item.documentType)} size="xs" className="mt-0.5 shrink-0">{item.documentType}</Badge>}
            </div>
          ))}
          {!waiting && (
            <div
              id={`${listId}-${items.length}`}
              role="option"
              aria-selected={active === items.length}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(items.length)}
              onClick={() => choose(items.length)}
              className={cn("flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs font-medium text-emerald-700", active === items.length ? "bg-emerald-50" : "hover:bg-slate-50")}
            >
              <Search className="h-3.5 w-3.5" /> Search all documents for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
