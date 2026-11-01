import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingSpecimenApi, type TrainingSpecimen } from "@/services/api/trainingActivities";

/**
 * What a person can do with one specimen signature record, shared by the list and by the details screen: open the scans. `modals` must be rendered once by the screen.
 */
export function useSpecimenActions(): {
  view: (s: TrainingSpecimen) => Promise<void>;
  modals: ReactNode;
} {
  const { showToast } = useToast();
  const [viewing, setViewing] = useState<{ title: string; urls: string[]; specimen: TrainingSpecimen; original: boolean }>();

  useEffect(() => () => { viewing?.urls.forEach((u) => URL.revokeObjectURL(u)); }, [viewing]);

  /** Opens the pictures the screens show, or with `original` the pictures as they were uploaded (a watermark was stamped on the others). */
  const open = async (s: TrainingSpecimen, original: boolean) => {
    try {
      const variant = original ? "original" : "shown";
      const blobs = [await trainingSpecimenApi.image(s.id, 1, variant), ...(s.hasSecond ? [await trainingSpecimenApi.image(s.id, 2, variant)] : [])];
      setViewing({ title: `${s.fullName}, version ${s.versionNo}`, urls: blobs.map((b) => URL.createObjectURL(b)), specimen: s, original });
    } catch (e) {
      showToast({ type: "error", title: "The image could not be opened", message: trainingError(e) });
    }
  };
  const view = (s: TrainingSpecimen) => open(s, false);
  const modals = (
    <>
      <FormModal isOpen={!!viewing} onClose={() => setViewing(undefined)} onConfirm={() => setViewing(undefined)} title={viewing?.title} showCancel={false} confirmText="Close" size="md">
        {viewing && (
          <div className="grid gap-4">
            {viewing.urls.map((url, i) => (
              <figure key={url} className="space-y-1">
                <figcaption className="text-xs font-medium text-slate-600">{i === 0 ? "1st signature" : "2nd signature"}</figcaption>
                <img src={url} alt={i === 0 ? "1st specimen signature" : "2nd specimen signature"} className="mx-auto max-h-48 max-w-full rounded border border-slate-200 bg-white" />
              </figure>
            ))}
            {viewing.urls.length === 1 && <p className="text-xs text-slate-500">This version was made before the form asked for two signatures, so it has the 1st only.</p>}
            {viewing.specimen.watermarked && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{viewing.original ? "Showing the pictures as they were uploaded." : "Showing the pictures with the watermark."} Opening the original is recorded in the Audit Trail.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void open(viewing.specimen, !viewing.original)}>{viewing.original ? "Show With Watermark" : "Show Original"}</Button>
              </div>
            )}
          </div>
        )}
      </FormModal>
    </>
  );

  return { view, modals };
}
