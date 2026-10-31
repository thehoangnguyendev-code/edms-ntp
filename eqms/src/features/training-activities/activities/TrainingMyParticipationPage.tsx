import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { myTrainingApi } from "@/services/api/myTraining";
import { trainingActivitiesApi, trainingError, type TrainingMyParticipation } from "@/services/api/trainingActivities";
import { day, statusChange, trainingBreadcrumbs, when } from "../shared/trainingLabels";
import { useTrainingBack } from "../shared/useTrainingBack";

/**
 * The screen where an employee reads the training that was given to them and confirms the reading with an electronic signature (self-reading). It needs only the permission to see one's own training and shows
 * only what the employee needs: the activity itself lists the other people and their results, so it is not opened to the employee.
 */
export function TrainingMyParticipationPage() {
  const { participantId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = useTrainingBack("/training-management/my-training/tasks");
  const { showToast } = useToast();
  const [mine, setMine] = useState<TrainingMyParticipation>();
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);

  const load = useCallback(() => {
    myTrainingApi.participation(participantId).then(setMine).catch((e) => setError(trainingError(e)));
  }, [participantId]);
  useEffect(load, [load]);

  const confirm = async (signatureToken: string, reason?: string) => {
    try {
      await trainingActivitiesApi.confirmRead(participantId, signatureToken, reason);
      setSigning(false);
      showToast({ type: "success", title: "Reading confirmed", message: "Your electronic signature was recorded." });
      load();
    } catch (e) {
      setSigning(false);
      showToast({ type: "error", title: "The reading was not confirmed", message: trainingError(e) });
      load();
    }
  };

  const title = "Self-Reading";
  const crumbs = trainingBreadcrumbs(navigate, "myTasks", title);
  const confirmed = mine?.state === "READ_CONFIRMED";
  const links = (mine?.materials ?? []).filter((m) => m.linkUrl);
  const files = (mine?.materials ?? []).filter((m) => !m.linkUrl);

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={title} breadcrumbItems={crumbs} actions={<Button size="sm" variant="outline" onClick={goBack}>Back</Button>} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!mine && !error && <SectionLoading text="Loading…" />}

      {mine && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6" aria-label="Training">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-semibold text-slate-900">{mine.trainingNumber}</span>
              {confirmed ? <Badge color="emerald">You confirmed the reading</Badge> : mine.canConfirmRead ? <Badge color="amber">Waiting for your signature</Badge> : <Badge color="slate">Not open for your signature</Badge>}
            </div>
            <p className="mt-2 text-sm text-slate-700">{mine.trainingTopics ?? "—"}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Due date</dt><dd className="text-slate-900">{day(mine.dueDate)}</dd></div>
              <div><dt className="text-slate-500">Scheduled</dt><dd className="text-slate-900">{day(mine.scheduledOn)}</dd></div>
              {mine.documentNumber && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Document</dt>
                  <dd className="text-slate-900">{mine.documentNumber}{mine.documentName ? ` — ${mine.documentName}` : ""}{mine.revisionNumber ? ` (revision ${mine.revisionNumber})` : ""}</dd>
                </div>
              )}
              {confirmed && <div><dt className="text-slate-500">Confirmed on</dt><dd className="text-slate-900">{when(mine.readConfirmedAt)}</dd></div>}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6" aria-label="Material to read">
            <h2 className="text-sm font-semibold text-slate-900">Material to read</h2>
            {mine.revisionId && (
              <p className="mt-2 text-sm text-slate-700">
                Read the document in Document Control:{" "}
                <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/documents/revisions/${mine.revisionId}`)}>{mine.documentNumber}</button>
              </p>
            )}
            {links.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {links.map((m) => (
                  <li key={m.id}><a className="font-medium text-emerald-600 hover:underline" href={m.linkUrl ?? "#"} target="_blank" rel="noopener noreferrer">{m.title}</a></li>
                ))}
              </ul>
            )}
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {files.map((m) => <li key={m.id}>{m.title} <span className="text-slate-500">(ask the trainer for the file)</span></li>)}
              </ul>
            )}
            {!mine.revisionId && links.length === 0 && files.length === 0 && <p className="mt-2 text-sm text-slate-600">The trainer has not attached a document or a link. Ask the trainer where the training is.</p>}
          </section>

          {mine.canConfirmRead && (
            <div className="flex justify-end"><Button onClick={() => setSigning(true)}>I have read and understood</Button></div>
          )}
          {!mine.canConfirmRead && !confirmed && <p className="text-sm text-slate-600">This training is not open for your signature now: it is closed, or it is not a self-reading.</p>}
          <ESignatureModal
            isOpen={signing}
            onClose={() => setSigning(false)}
            onConfirm={async (d: { signatureToken: string; reason?: string }) => confirm(d.signatureToken, d.reason)}
            actionTitle="Confirm Self-Reading"
            changes={statusChange("Invited", "Read and understood", "Self-reading")}
            meaningDisplayName="Self-reading Confirmed"
            meaningCode="TRAINING_READ_CONFIRMED"
            targetDetails={{ code: mine.trainingNumber, title: mine.trainingTopics ?? "", revision: mine.revisionNumber ?? "" }}
          />
        </>
      )}
    </div>
  );
}
