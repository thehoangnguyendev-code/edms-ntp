import { useCallback, useEffect, useState } from "react";
import { Select } from "@/components/ui/select/Select";
import { documentApi } from "@/services/api/documents";
import { trainingMatrixApi } from "@/services/api/trainingActivities";

export interface PickedTraining { kind: "TOPIC" | "DOCUMENT"; id: string; code: string; title: string }

/** The ids of the trainings that were ticked, split the way the server takes them. */
export const pickedIds = (list: PickedTraining[]) => ({
  topicIds: list.filter((p) => p.kind === "TOPIC").map((p) => p.id),
  documentIds: list.filter((p) => p.kind === "DOCUMENT").map((p) => p.id),
});

/**
 * Other trainings that the person must have completed before the Job Role is given (SOP.0003 5.3.8), besides the ones the matrix requires for it: a topic or a SOP (the Training Title
 * of an activity). They are ticked here; the server checks them against the training records of the person at once and again when the assignment is signed.
 */
export function RequiredTrainingsField({ value, onChange, disabled }: { value: PickedTraining[]; onChange: (next: PickedTraining[]) => void; disabled?: boolean }) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [known, setKnown] = useState<Record<string, PickedTraining>>({});
  const search = useCallback(async (query: string) => {
    const [topics, documents] = await Promise.all([
      trainingMatrixApi.topics(query || undefined, true).catch(() => []),
      documentApi.getDocumentsPage({ search: query, page: 1, limit: 20 } as never).then((page) => page.data as unknown as { id: string; documentNumber: string; documentName: string }[]).catch(() => []),
    ]);
    const found: PickedTraining[] = [
      ...topics.slice(0, 20).map((t) => ({ kind: "TOPIC" as const, id: t.id, code: t.code, title: t.name })),
      ...documents.map((d) => ({ kind: "DOCUMENT" as const, id: d.id, code: d.documentNumber, title: d.documentName })),
    ].filter((p) => !value.some((v) => v.kind === p.kind && v.id === p.id));
    setKnown((old) => ({ ...old, ...Object.fromEntries(found.map((p) => [`${p.kind}:${p.id}`, p])) }));
    const mapped = found.map((p) => ({ label: `${p.kind === "TOPIC" ? "Topic" : "SOP"}: ${p.code} — ${p.title}`, value: `${p.kind}:${p.id}` }));
    setOptions(mapped);
    return mapped;
  }, [value]);
  useEffect(() => { if (!disabled) void search(""); }, [disabled, search]);
  return (
    <div className="space-y-2">
      {!disabled && (
        <Select value="" onChange={(v) => { const p = known[v]; if (p) onChange([...value, p]); }} options={options} onSearch={search} placeholder="Search a topic or a SOP to add" />
      )}
      {value.length === 0 ? (
        <p className="text-xs text-slate-500">None: only the training that the matrix requires for the Job Role is checked.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((p) => (
            <li key={`${p.kind}:${p.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-800">
              <span>{p.kind === "TOPIC" ? "Topic" : "SOP"}: {p.code ? `${p.code} — ` : ""}{p.title}</span>
              {!disabled && <button type="button" aria-label={`Remove ${p.title}`} className="text-slate-500 hover:text-red-600" onClick={() => onChange(value.filter((x) => !(x.kind === p.kind && x.id === p.id)))}>×</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
