import { useEffect, useState, type ReactNode } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingFormsApi, trainingSpecimenApi, type TrainingFormFormat, type TrainingSpecimen } from "@/services/api/trainingActivities";
import { Textarea } from "../shared/TrainingFields";
import { saveBlob, statusChange } from "../shared/trainingLabels";

/**
 * What a person can do with one specimen signature, shared by the list and by the details screen: open its images, download the form FRM.0007, confirm it with a signature, or reject it with a
 * reason. `onChanged` is called after a confirmation or a rejection, so the screen reloads. `modals` must be rendered once by the screen.
 */
export function useSpecimenActions(onChanged: () => void): {
  view: (s: TrainingSpecimen) => Promise<void>;
  downloadForm: (s: TrainingSpecimen, format: TrainingFormFormat) => Promise<void>;
  askConfirm: (s: TrainingSpecimen) => void;
  askReject: (s: TrainingSpecimen) => void;
  modals: ReactNode;
} {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ title: string; urls: string[] }>();
  const [rejecting, setRejecting] = useState<{ id: string; reason: string }>();
  const [sign, setSign] = useState<TrainingSpecimen>();

  useEffect(() => () => { viewing?.urls.forEach((u) => URL.revokeObjectURL(u)); }, [viewing]);

  const view = async (s: TrainingSpecimen) => {
    try {
      const blobs = [await trainingSpecimenApi.image(s.id, 1), ...(s.hasSecond ? [await trainingSpecimenApi.image(s.id, 2)] : [])];
      setViewing({ title: `${s.fullName}, version ${s.versionNo}`, urls: blobs.map((b) => URL.createObjectURL(b)) });
    } catch (e) {
      showToast({ type: "error", title: "The image could not be opened", message: trainingError(e) });
    }
  };
  /** The specimen signatures of the person in the form FRM.0007, as Word or PDF. */
  const downloadForm = async (s: TrainingSpecimen, format: TrainingFormFormat) => {
    try {
      saveBlob(await trainingFormsApi.specimen(s.personUserId, format), `FRM.0007-${s.employeeCode ?? s.fullName}.${format}`);
    } catch (e) {
      showToast({ type: "error", title: "The form was not exported", message: trainingError(e) });
    }
  };
  const doConfirm = async (token: string) => {
    if (!sign) return;
    setBusy(true);
    try {
      await trainingSpecimenApi.confirm(sign.id, token);
      showToast({ type: "success", title: "Specimen signature approved", message: sign.fullName });
      setSign(undefined);
      onChanged();
    } catch (e) {
      showToast({ type: "error", title: "The confirmation failed", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const doReject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await trainingSpecimenApi.reject(rejecting.id, rejecting.reason.trim());
      setRejecting(undefined);
      onChanged();
    } catch (e) {
      showToast({ type: "error", title: "The rejection failed", message: trainingError(e) });
    } finally {
      setBusy(false);
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
      <FormModal isOpen={!!rejecting} onClose={() => setRejecting(undefined)} onConfirm={() => void doReject()} title="Reject Specimen Signature" confirmText="Reject" confirmVariant="destructive" isLoading={busy} confirmDisabled={!rejecting?.reason.trim()} size="md">
        <FormField label="Reason" required>
          <Textarea rows={3} value={rejecting?.reason ?? ""} onChange={(e) => rejecting && setRejecting({ ...rejecting, reason: e.target.value })} />
        </FormField>
      </FormModal>
      <ESignatureModal
        isOpen={!!sign}
        onClose={() => setSign(undefined)}
        onConfirm={async (d: { signatureToken: string }) => doConfirm(d.signatureToken)}
        actionTitle="Confirm Specimen Signature"
        changes={statusChange("Pending Confirmation", "Approved")}
        meaningDisplayName="Specimen Signature Approved"
        meaningCode="TRAINING_SPECIMEN_APPROVED"
        targetDetails={{ code: sign?.fullName ?? "", title: "Specimen signature", revision: String(sign?.versionNo ?? "") }}
      />
    </>
  );

  return { view, downloadForm, askConfirm: setSign, askReject: (s) => setRejecting({ id: s.id, reason: "" }), modals };
}
