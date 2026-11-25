import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { trainingError, trainingFilesApi, type TrainingPaperEvidence } from "@/services/api/trainingActivities";
import { SpecimenSignaturePanel } from "../../shared/SpecimenSignaturePanel";
import { saveBlob } from "../../shared/trainingLabels";
import { tr } from "@/i18n";

const WORD = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * One scanned test of a person, with the specimen signature of that person on the right, so the signature on the paper can be compared by eye. The server decides who may open the scan or the
 * specimen and writes each view and each download in the Audit Trail.
 */
export function TrainingScanReviewModal({ activityId, personId, personName, evidence, fileName, onClose }: {
  activityId: string; personId: string; personName: string; evidence: TrainingPaperEvidence; fileName: string; onClose: () => void;
}) {
  const { showToast } = useToast();
  const [state, setState] = useState<{ loading: boolean; url?: string; error?: string }>({ loading: evidence.contentType !== WORD });

  useEffect(() => {
    if (evidence.contentType === WORD) return;
    let live = true;
    let made: string | undefined;
    trainingFilesApi.personEvidenceFile(personId, activityId, evidence.id, true)
      .then((blob) => {
        made = URL.createObjectURL(blob);
        if (live) setState({ loading: false, url: made });
        else URL.revokeObjectURL(made);
      })
      .catch((e) => { if (live) setState({ loading: false, error: trainingError(e) }); });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [personId, activityId, evidence.id, evidence.contentType]);

  const download = async () => {
    try {
      saveBlob(await trainingFilesApi.personEvidenceFile(personId, activityId, evidence.id, false), fileName);
    } catch (e) {
      showToast({ type: "error", title: tr("The file could not be downloaded"), message: trainingError(e) });
    }
  };

  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={onClose}
      title={fileName}
      confirmText="Close"
      showCancel={false}
      size="2xl"
      className="max-w-6xl backdrop-blur-none"
      footerExtra={<Button size="sm" variant="outline" onClick={() => void download()}>{tr("Download Scan")}</Button>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {state.loading && <SectionLoading text="Opening the scan…" />}
          {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          {evidence.contentType === WORD ? (
            <OnlyOfficeDocumentViewer key={evidence.id} revisionId={evidence.id} watchForChanges={false} height="68dvh"
              loadConfig={() => trainingFilesApi.personEvidenceViewConfig(personId, activityId, evidence.id)} />
          ) : state.url && (evidence.contentType?.startsWith("image/")
            ? <img src={state.url} alt={fileName} className="mx-auto max-h-[68dvh] max-w-full rounded-lg border border-slate-200 object-contain" />
            : <DocumentPdfViewer fileUrl={state.url} height="68dvh" minHeight="420px" forceHideDownloadAndPrint />)}
        </div>
        <aside aria-label={tr("Specimen signature")} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 lg:self-start">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{tr("Specimen signature")}</h3>
            <p className="text-xs text-slate-500">{personName}</p>
          </div>
          <SpecimenSignaturePanel personId={personId} personName={personName} stacked />
        </aside>
      </div>
    </FormModal>
  );
}
