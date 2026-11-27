import { useEffect, useState } from "react";
import { Link2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Input } from "../../shared/TrainingFields";
import { trainingError, trainingFilesApi } from "@/services/api/trainingActivities";
import { tr, trFormat } from "@/i18n";

type Item = Awaited<ReturnType<typeof trainingFilesApi.library>>[number];

/**
 * The materials of earlier trainings that can be used again: slides of the company rules, of the safety talk, of a procedure. Using one copies it into this training, so the
 * content of this training is still reviewed and approved before the people are notified (SOP.0003 5.3.5). Nothing is typed again and the earlier training is not changed.
 */
export function MaterialLibraryDialog({ activityId, sessionId, onClose, onAdded }: { activityId: string; sessionId?: string; onClose: () => void; onAdded: (files: Awaited<ReturnType<typeof trainingFilesApi.fromLibrary>>) => void }) {
  const [items, setItems] = useState<Item[]>();
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => { trainingFilesApi.library(search).then(setItems).catch((e) => { setError(trainingError(e)); setItems([]); }); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const add = async (m: Item) => {
    setWorking(m.id);
    setError("");
    try { onAdded(await trainingFilesApi.fromLibrary(activityId, m.id, sessionId)); } catch (e) { setError(trainingError(e)); } finally { setWorking(""); }
  };
  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={tr("Add from an Earlier Training")} confirmText={tr("Close")} showCancel={false} size="2xl"
      description={tr("Use a file or a link of an earlier training. It is copied into this training; the content is still reviewed and approved.")}>
      <div className="space-y-3">
        <Input value={search} placeholder={tr("Search title, file or Training Number…")} onChange={(e) => setSearch(e.target.value)} aria-label={tr("Search the materials")} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {!items ? <SectionLoading text="Loading…" /> : items.length === 0 ? <p className="text-sm text-slate-500">{tr("No earlier material was found.")}</p> : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {items.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-start gap-2">
                  {m.linkUrl ? <Link2 className="mt-0.5 h-4 w-4 flex-none text-slate-500" aria-hidden="true" /> : <FileText className="mt-0.5 h-4 w-4 flex-none text-slate-500" aria-hidden="true" />}
                  <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900">{m.title}</div><div className="truncate text-xs text-slate-500">{trFormat("From {number}", { number: m.trainingNumber })} · {m.trainingTopics}</div></div>
                </div>
                <Button size="sm" variant="outline-emerald" loading={working === m.id} onClick={() => void add(m)}>{tr("Add")}</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormModal>
  );
}
