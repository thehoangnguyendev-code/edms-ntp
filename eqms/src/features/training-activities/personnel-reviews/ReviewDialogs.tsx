import { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingError, trainingReviewsApi, type TrainingPersonnelReview, type TrainingReviewClasses, type TrainingReviewRequirement } from "@/services/api/trainingActivities";
import { WorkPositionChecklist } from "../jobs/WorkPositionChecklist";
import { tr, trPlural } from "@/i18n";

/** Chooses the Job Roles the review prepares the person for: the training of each comes from its column of the matrix (DEC-TRAINING-2026-11-27-01 B1). */
export function JobRolesDialog({ review, busy, onClose, onSave }: { review: TrainingPersonnelReview; busy: boolean; onClose: () => void; onSave: (ids: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>(review.jobRoleIds ?? []);
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave(picked)} title={tr("Job Roles of the Person")} confirmText="Save" isLoading={busy} size="2xl"
      description={tr("Each Job Role adds the training of its column of the matrix to the checklist. Roles the person already holds, and those of a job assignment being signed, are counted without being ticked.")}>
      {!review.matrixDepartmentId ? (
        <p className="text-sm text-amber-700">{tr("The department of the person is not in the list of departments, so it has no Work Position to choose.")}</p>
      ) : (
        <WorkPositionChecklist departmentId={review.matrixDepartmentId} selectedIds={picked} excludedIds={[]} onToggle={(p) => setPicked((old) => (old.includes(p.id) ? old.filter((x) => x !== p.id) : [...old, p.id]))} />
      )}
    </FormModal>
  );
}

/** After an absence the reviewer chooses, from the matrix of the position, what is trained again (B7.3). */
export function RetrainingDialog({ review, busy, onClose, onSave }: { review: TrainingPersonnelReview; busy: boolean; onClose: () => void; onSave: (keys: string[]) => void }) {
  const [lines, setLines] = useState<TrainingReviewRequirement[]>();
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    trainingReviewsApi.requirements(review.id).then((l) => { setLines(l); setPicked(l.filter((x) => review.items.some((i) => i.checkType === "TRAINING" && i.status !== "NOT_NEEDED" && ((i.documentNumber && i.documentNumber === x.documentNumber) || (i.topicText && i.topicText === x.topicText)))).map((x) => x.key)); }).catch(() => setLines([]));
  }, [review.id, review.items]);
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave(picked)} title={tr("Training to Repeat After the Absence")} confirmText="Save" isLoading={busy} size="2xl"
      description={tr("Choose what the person trains again. A line is done only when a training record exists after the return date. Choose nothing and give a reason in Review the training record if nothing has to be repeated.")}>
      {!lines ? <SectionLoading text="Loading…" /> : lines.length === 0 ? (
        <p className="text-sm text-amber-700">{tr("The matrix has no training for this person yet. Choose a Job Role first.")}</p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {lines.map((l) => (
            <Checkbox key={l.key} id={`review-retrain-${l.key}`} checked={picked.includes(l.key)} onChange={(on) => setPicked((old) => (on ? [...old, l.key] : old.filter((x) => x !== l.key)))}
              label={`${l.documentNumber ? `${l.documentNumber} — ` : ""}${l.title}`} />
          ))}
        </div>
      )}
    </FormModal>
  );
}

/** Where the person learns what is still missing: an open initial class, a new one, or a new one copied from an earlier class (B3, B3.1). */
export function ClassDialog({ review, busy, onClose, onChanged }: { review: TrainingPersonnelReview; busy: boolean; onClose: () => void; onChanged: (next: TrainingPersonnelReview & { createdActivityId?: string }) => void }) {
  const [data, setData] = useState<TrainingReviewClasses>();
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  useEffect(() => { trainingReviewsApi.classes(review.id).then(setData).catch((e) => { setError(trainingError(e)); setData({ open: [], earlier: [], canCreate: false }); }); }, [review.id]);
  const act = async (key: string, run: () => Promise<TrainingPersonnelReview & { createdActivityId?: string }>) => {
    setWorking(key);
    setError("");
    try { onChanged(await run()); } catch (e) { setError(trainingError(e)); } finally { setWorking(""); }
  };
  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={tr("Arrange Training")} confirmText={tr("Close")} showCancel={false} isLoading={busy} size="2xl"
      description={tr("Put the person in a class that teaches what is still missing. Several people can join one class while its list is not confirmed.")}>
      {!data ? <SectionLoading text="Loading…" /> : (
        <div className="space-y-5 text-sm">
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {data.open.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-semibold text-slate-900">{tr("Suggested: join an open class")}</h3>
              {(
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {data.open.map((c) => (
                    <li key={c.activityId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0"><span className="font-medium text-emerald-700">{c.trainingNumber}</span> <span className="text-slate-600">{c.trainingTopics}</span> <Badge color="blue" size="sm">{trPlural(c.covers ?? 0, "{count} line", "{count} lines")}</Badge></div>
                      {c.listed ? <Badge color="emerald" size="sm">{tr("Already on its list")}</Badge> : <Button size="sm" loading={working === c.activityId} onClick={() => void act(c.activityId, () => trainingReviewsApi.addToClass(review.id, c.activityId))}>{tr("Add to this class")}</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="space-y-2">
            <h3 className="font-semibold text-slate-900">{data.open.length > 0 ? tr("Or make a new class") : tr("Suggested: make a new class")}</h3>
            {!data.canCreate ? <p className="text-amber-700">{tr("Only a person who gives Training Numbers (Quality Assurance) can make an initial class.")}</p> : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={data.open.length > 0 ? "outline-emerald" : "default"} loading={working === "new"} onClick={() => void act("new", () => trainingReviewsApi.createClass(review.id))}>{tr("Create a class from the matrix")}</Button>
                </div>
                {data.earlier.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-slate-600">{tr("Or copy an earlier class: its sessions, trainers, materials and assessment. Dates, people, signatures and results are not copied.")}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1"><Select aria-label={tr("Earlier class")} value={copyFrom} onChange={setCopyFrom} placeholder={tr("Choose an earlier class")} options={data.earlier.map((c) => ({ value: c.activityId, label: `${c.trainingNumber} — ${c.trainingTopics}` }))} /></div>
                      <Button size="sm" variant="outline-emerald" disabled={!copyFrom}  loading={working === "copy"} onClick={() => void act("copy", () => trainingReviewsApi.createClass(review.id, copyFrom))}>{tr("Create a copy")}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </FormModal>
  );
}
