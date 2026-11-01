import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingError, trainingSpecimenApi } from "@/services/api/trainingActivities";
import { day } from "./trainingLabels";

/**
 * The specimen signature in force of a person (FRM.0007), opened beside the scan that is being checked against the paper: the person who checks compares the signature by eye. Nothing is
 * compared by the system. The server decides whether the person who asks may see it and writes each opening of an image in the Audit Trail.
 */
export function SpecimenViewModal({ personId, personName, onClose }: { personId: string; personName: string; onClose: () => void }) {
  const [state, setState] = useState<{ loading: boolean; error?: string; none?: boolean; versionNo?: number; effectiveDate?: string; urls: string[]; watermarked?: boolean }>({ loading: true, urls: [] });
  // The pictures as they were uploaded, to compare the strokes; opening them is written to the Audit Trail by the server.
  const [original, setOriginal] = useState(false);

  useEffect(() => {
    let live = true;
    const made: string[] = [];
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    (async () => {
      try {
        const current = await trainingSpecimenApi.current(personId);
        if (!current.id) { if (live) setState({ loading: false, none: true, urls: [] }); return; }
        const variant = original ? "original" : "shown";
        const blobs = [await trainingSpecimenApi.image(current.id, 1, variant), ...(current.hasSecond ? [await trainingSpecimenApi.image(current.id, 2, variant)] : [])];
        const urls = blobs.map((b) => URL.createObjectURL(b));
        made.push(...urls);
        if (live) setState({ loading: false, versionNo: current.versionNo, effectiveDate: current.effectiveDate, urls, watermarked: current.watermarked });
      } catch (e) {
        if (live) setState({ loading: false, error: trainingError(e), urls: [] });
      }
    })();
    return () => { live = false; setTimeout(() => made.forEach((u) => URL.revokeObjectURL(u)), 0); };
  }, [personId, original]);

  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={`Specimen signature: ${personName}`} confirmText="Close" showCancel={false} size="lg"
      description={state.versionNo ? `Version ${state.versionNo}, current since ${state.effectiveDate ? day(state.effectiveDate) : "—"}. Compare it by eye with the signature on the paper.` : undefined}>
      {state.loading && <SectionLoading text="Opening the specimen signature…" />}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.none && <p className="text-sm text-slate-600">This person has no specimen signature record.</p>}
      {state.urls.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {state.urls.map((url, i) => (
            <figure key={url} className="rounded-lg border border-slate-200 bg-white p-2">
              <img src={url} alt={`${i === 0 ? "First" : "Second"} signature of ${personName}`} className="mx-auto max-h-40 object-contain" />
              <figcaption className="mt-1 text-center text-xs text-slate-500">{i === 0 ? "1st signature" : "2nd signature"}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {state.watermarked && (state.urls.length > 0 || state.loading) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{original ? "Showing the pictures as they were uploaded." : "Showing the pictures with the watermark."} Opening the original is recorded in the Audit Trail.</p>
          <Button type="button" size="sm" variant="outline" disabled={state.loading} onClick={() => setOriginal((value) => !value)}>{original ? "Show With Watermark" : "Show Original"}</Button>
        </div>
      )}
    </FormModal>
  );
}
