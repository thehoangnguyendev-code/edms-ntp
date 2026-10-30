import { useEffect, useState, type ReactNode } from "react";
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
  const [viewing, setViewing] = useState<{ title: string; urls: string[] }>();

  useEffect(() => () => { viewing?.urls.forEach((u) => URL.revokeObjectURL(u)); }, [viewing]);

  const view = async (s: TrainingSpecimen) => {
    try {
      const blobs = [await trainingSpecimenApi.image(s.id, 1), ...(s.hasSecond ? [await trainingSpecimenApi.image(s.id, 2)] : [])];
      setViewing({ title: `${s.fullName}, version ${s.versionNo}`, urls: blobs.map((b) => URL.createObjectURL(b)) });
    } catch (e) {
      showToast({ type: "error", title: "The image could not be opened", message: trainingError(e) });
    }
  };
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
          </div>
        )}
      </FormModal>
    </>
  );

  return { view, modals };
}
