import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { useDebounce } from "@/hooks/useDebounce";
import { documentApi } from "@/services/api/documents";
import { Chips } from "./JobAssignmentSummary";
import { tr } from "@/i18n";

/** A training that is required: a Training Topic as it was written (kind TOPIC, the text is the title) or a SOP of Document Control (kind DOCUMENT, with its id). */
export interface PickedTraining { kind: "TOPIC" | "DOCUMENT"; id: string; code: string; title: string; status?: string | null }

/** What was ticked, split the way the server takes it: the topics as text and the documents by id. */
export const pickedIds = (list: PickedTraining[]) => ({
  topics: list.filter((p) => p.kind === "TOPIC").map((p) => p.title),
  documentIds: list.filter((p) => p.kind === "DOCUMENT").map((p) => p.id),
});

export const trainingKey = (p: PickedTraining) => `${p.kind}:${p.id}`;
export const trainingLabel = (p: PickedTraining) => (p.kind === "DOCUMENT" && p.code ? `${p.code} — ${p.title}` : p.title);

const PAGE_SIZE = 10;

/**
 * Other trainings that the person must have completed before the Work Position is given (SOP.0003 5.3.8), besides the ones the matrix requires for it, as a list that is ticked:
 * SOPs in effect, searched and paged by the server, and Training Topics typed into the search box. Only SOPs in effect can be chosen; the server checks what is chosen against
 * the training records of the person at once and again when the assignment is signed.
 */
export function RequiredTrainingsField({ value, onChange, disabled, showChosen }: {
  value: PickedTraining[];
  onChange: (next: PickedTraining[]) => void;
  disabled?: boolean;
  /** The chosen ones above the list, for a screen that has no summary beside it: a chosen SOP may not be on the page of the list that is shown. */
  showChosen?: boolean;
}) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [documents, setDocuments] = useState<PickedTraining[]>([]);
  const [total, setTotal] = useState({ items: 0, pages: 0 });
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  const debounced = useDebounce(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => setPage(1), [debounced]);
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    setState("loading");
    documentApi
      .getDocumentsPage({ search: debounced, status: "EFFECTIVE", page, limit: PAGE_SIZE } as never)
      .then((result) => {
        if (cancelled) return;
        const rows = result.data as unknown as { id: string; documentNumber: string; documentName: string; status?: string }[];
        setDocuments(rows.map((d) => ({ kind: "DOCUMENT", id: d.id, code: d.documentNumber, title: d.documentName, status: d.status })));
        setTotal({ items: result.pagination?.total ?? rows.length, pages: result.pagination?.totalPages ?? 1 });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, page, attempt, disabled]);

  const chosen = new Set(value.map(trainingKey));
  const chips = value.map((p) => ({ id: trainingKey(p), label: trainingLabel(p) }));
  const none = tr("No trainings selected: only the training that the matrix requires for the Work Position is checked.");
  if (disabled) return <Chips items={chips} empty={none} />;

  const typed = query.trim().replace(/\s+/g, " ");
  const topics = value.filter((v) => v.kind === "TOPIC");
  const newTopic: PickedTraining | undefined =
    typed && !topics.some((t) => t.title.toLowerCase() === typed.toLowerCase()) ? { kind: "TOPIC", id: typed, code: "", title: typed } : undefined;
  // With the chosen ones shown above, a chosen topic is not listed a second time.
  const listedTopics = showChosen ? [] : topics;
  const toggle = (item: PickedTraining) =>
    onChange(chosen.has(trainingKey(item)) ? value.filter((v) => trainingKey(v) !== trainingKey(item)) : [...value, item]);

  const row = (item: PickedTraining) => {
    const checked = chosen.has(trainingKey(item));
    const id = `${baseId}-${trainingKey(item)}`;
    return (
      <li key={trainingKey(item)} className={`flex min-h-11 items-center gap-3 border-b border-slate-100 px-3 ${checked ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}>
        <Checkbox id={id} checked={checked} onChange={() => toggle(item)} />
        <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm text-slate-800">
          <span className="min-w-0 break-words">{item.title}</span>
          {item.kind === "TOPIC" ? <Badge color="slate">{tr("Training Topic")}</Badge> : <span className="shrink-0 text-xs text-slate-400">{item.code}</span>}
        </label>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      {showChosen && <Chips items={chips} empty={none} onRemove={(key) => onChange(value.filter((v) => trainingKey(v) !== key))} />}
      <SearchInput value={query} onChange={setQuery} placeholder="Search a SOP, or type a Training Topic..." ariaLabel="Search a SOP, or type a Training Topic..." />
      <div className="overflow-hidden rounded-lg border border-slate-200">
        {(listedTopics.length > 0 || newTopic) && (
          <ul aria-label={tr("Training Topic")}>
            {listedTopics.map(row)}
            {newTopic && row(newTopic)}
          </ul>
        )}
        <h4 className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("SOPs in effect")}</h4>
        {state === "loading" && (
          <div className="space-y-3 p-3" role="status" aria-label={tr("Loading...")}>
            {[0, 1, 2].map((n) => <div key={n} className="h-5 animate-pulse rounded bg-slate-100" />)}
          </div>
        )}
        {state === "error" && (
          <p role="alert" className="px-3 py-8 text-center text-sm text-red-700">
            {tr("The list of SOPs could not be loaded.")}{" "}
            <button type="button" className="font-medium underline" onClick={() => setAttempt((a) => a + 1)}>{tr("Try again")}</button>
          </p>
        )}
        {state === "ready" && documents.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{debounced ? tr("No matching SOP") : tr("No SOP available")}</p>}
        {state === "ready" && documents.length > 0 && <ul>{documents.map(row)}</ul>}
        {total.pages > 1 && (
          <TablePagination currentPage={page} totalPages={total.pages} totalItems={total.items} itemsPerPage={PAGE_SIZE} onPageChange={setPage} isLoading={state === "loading"} showItemsPerPageSelector={false} />
        )}
      </div>
    </div>
  );
}
