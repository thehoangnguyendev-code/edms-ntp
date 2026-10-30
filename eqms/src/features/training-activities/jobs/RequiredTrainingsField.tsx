import { useEffect, useMemo, useState } from "react";
import { StatusBadge, type StatusType } from "@/components/ui/badge/Badge";
import { useDebounce } from "@/hooks/useDebounce";
import { documentApi } from "@/services/api/documents";
import { TransferPicker } from "../shared/TransferPicker";

/** A training that is required: a Training Topic as it was written (kind TOPIC, the text is the title) or a SOP of Document Control (kind DOCUMENT, with its id). */
export interface PickedTraining { kind: "TOPIC" | "DOCUMENT"; id: string; code: string; title: string; status?: string | null }

/** What was ticked, split the way the server takes it: the topics as text and the documents by id. */
export const pickedIds = (list: PickedTraining[]) => ({
  topics: list.filter((p) => p.kind === "TOPIC").map((p) => p.title),
  documentIds: list.filter((p) => p.kind === "DOCUMENT").map((p) => p.id),
});

const keyOf = (p: PickedTraining) => `${p.kind}:${p.id}`;
const statusOf = (status?: string | null) => (status ?? "effective").toString().toLowerCase().replace(/ /g, "") as StatusType;

const badge = (p: PickedTraining) => p.kind === "DOCUMENT"
  ? <StatusBadge status={statusOf(p.status)} size="xs" className="mt-0.5 shrink-0" />
  : <span className="mt-0.5 shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">Training Topic</span>;

/**
 * Other trainings that the person must have completed before the Work Position is given (SOP.0003 5.3.8), besides the ones the matrix requires for it: a SOP of Document Control, or a Training
 * Topic written here. Only SOPs in effect can be chosen. Picked as the related documents of a document are (see TransferPicker). The server checks them against the training records of the person
 * at once and again when the assignment is signed.
 */
export function RequiredTrainingsField({ value, onChange, disabled }: { value: PickedTraining[]; onChange: (next: PickedTraining[]) => void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<PickedTraining[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    setLoading(true);
    documentApi.getDocumentsPage({ search: debounced, status: "EFFECTIVE", page: 1, limit: 20 } as never)
      .then((page) => (page.data as unknown as { id: string; documentNumber: string; documentName: string; status?: string }[])
        .map((d) => ({ kind: "DOCUMENT" as const, id: d.id, code: d.documentNumber, title: d.documentName, status: d.status })))
      .catch(() => [] as PickedTraining[])
      .then((found) => { if (!cancelled) setDocuments(found); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, disabled]);

  const chosen = useMemo(() => new Set(value.map(keyOf)), [value]);
  const typed = query.trim().replace(/\s+/g, " ");
  const available = useMemo(() => {
    const topic: PickedTraining[] = typed && !value.some((v) => v.kind === "TOPIC" && v.title.toLowerCase() === typed.toLowerCase()) ? [{ kind: "TOPIC", id: typed, code: "", title: typed }] : [];
    return [...topic, ...documents.filter((d) => !chosen.has(keyOf(d)))];
  }, [typed, value, documents, chosen]);

  return (
    <TransferPicker<PickedTraining>
      noun="trainings"
      available={available}
      selected={value}
      getKey={keyOf}
      getTitle={(p) => p.title}
      getSearchText={(p) => `${p.code} ${p.title}`}
      getTooltip={(p) => p.code || undefined}
      renderBadge={badge}
      onAdd={(items) => onChange([...value, ...items.filter((i) => !chosen.has(keyOf(i)))])}
      onRemove={(keys) => onChange(value.filter((p) => !keys.includes(keyOf(p))))}
      query={query}
      onQueryChange={setQuery}
      availableSearchPlaceholder="Search a SOP, or type a Training Topic..."
      loading={loading}
      emptyAvailable={(q) => (q ? "No matching SOP" : "No SOP available")}
      emptySelected="No trainings selected: only the training that the matrix requires for the Work Position is checked."
      readOnly={disabled}
    />
  );
}
