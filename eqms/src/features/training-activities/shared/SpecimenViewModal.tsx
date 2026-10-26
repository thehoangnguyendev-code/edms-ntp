import { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingError, trainingSpecimenApi } from "@/services/api/trainingActivities";
import { day } from "./trainingLabels";

/**
 * The specimen signature in force of a person (FRM.0007), opened beside the scan that is being checked against the paper: the person who checks compares the signature by eye. Nothing is
 * compared by the system. The server decides whether the person who asks may see it and writes each opening of an image in the Audit Trail.
 */
export function SpecimenViewModal({ personId, personName, onClose }: { personId: string; personName: string; onClose: () => void }) {
  const [state, setState] = useState<{ loading: boolean; error?: string; none?: boolean; versionNo?: number; effectiveDate?: string; urls: string[] }>({ loading: true, urls: [] });

  useEffect(() => {
    let live = true;
    const made: string[] = [];
    (async () => {
      try {
        const current = await trainingSpecimenApi.current(personId);
        if (!current.id) { if (live) setState({ loading: false, none: true, urls: [] }); return; }
        const blobs = [await trainingSpecimenApi.image(current.id, 1), ...(current.hasSecond ? [await trainingSpecimenApi.image(current.id, 2)] : [])];
        const urls = blobs.map((b) => URL.createObjectURL(b));
        made.push(...urls);
        if (live) setState({ loading: false, versionNo: current.versionNo, effectiveDate: current.effectiveDate, urls });
      } catch (e) {
        if (live) setState({ loading: false, error: trainingError(e), urls: [] });
      }
    })();
    return () => { live = false; setTimeout(() => made.forEach((u) => URL.revokeObjectURL(u)), 0); };
  }, [personId]);

  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={`Specimen signature: ${personName}`} confirmText="Close" showCancel={false} size="lg"
      description={state.versionNo ? `Version ${state.versionNo}, in force since ${state.effectiveDate ? day(state.effectiveDate) : "—"}. Compare it by eye with the signature on the paper.` : undefined}>
      {state.loading && <SectionLoading text="Opening the specimen signature…" />}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.none && <p className="text-sm text-slate-600">This person has no approved specimen signature.</p>}
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
    </FormModal>
  );
}
