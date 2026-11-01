import { useEffect, useState } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { METHOD_LABEL } from "@/features/training-activities/shared/trainingLabels";
import { trainingLegacyApi, type TrainingLegacyNumberInfo } from "@/services/api/trainingActivities";
import { ProposedParticipantsField, type ProposedPerson } from "@/features/training-activities/shared/ProposedParticipantsField";
import { TrainingFileDropzone } from "@/features/training-activities/shared/TrainingFileDropzone";

/** What the person enters about the paper training of one revision (besides the Training Number and the completion date, which are fields of the section itself). */
export interface LegacyTrainingEvidenceValue {
  /** What the paper record says the training was: its topic, its trainer (as written) and its mode. */
  topic: string;
  trainer: string;
  method: string;
  trainees: ProposedPerson[];
  scan: File | null;
  notEvidenced: boolean;
  noEvidenceReason: string;
}

export const emptyLegacyTrainingEvidence = (): LegacyTrainingEvidenceValue => ({ topic: "", trainer: "", method: "", trainees: [], scan: null, notEvidenced: false, noEvidenceReason: "" });

/** The state of the paper Training Number that the form needs to validate: it joins evidence already on file, or it cannot be used. */
export interface LegacyNumberState {
  joins: boolean;
  problem: string;
}

/**
 * The paper training of one revision, in the Legacy Import form: the persons who were trained (same screen as the training step of a new document) and the scan of the paper record
 * (APD.0108 or APD.0117) or the declaration that it is lost. Nobody else verifies it: the person who imports signs the import. A Training Number that another document already carries (one paper record for several SOPs) joins
 * the evidence that is on file: nothing is attached again.
 */
export function LegacyTrainingEvidence({
  revisionLabel,
  trainingNumber,
  value,
  onChange,
  onNumberState,
  showValidation,
}: {
  revisionLabel: string;
  trainingNumber: string;
  value: LegacyTrainingEvidenceValue;
  onChange: (value: LegacyTrainingEvidenceValue) => void;
  onNumberState: (state: LegacyNumberState) => void;
  showValidation: boolean;
}) {
  const number = trainingNumber.trim();
  const [info, setInfo] = useState<TrainingLegacyNumberInfo | null>(null);

  // What the system knows about the number typed (after the person stops typing).
  useEffect(() => {
    if (!number) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      trainingLegacyApi
        .numberInfo(number)
        .then((result) => {
          if (!cancelled) setInfo(result);
        })
        .catch(() => {
          if (!cancelled) setInfo(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [number]);

  const joins = Boolean(info?.exists && info.legacy && info.evidenceStatus);
  const problem = info?.exists && !info.legacy
    ? `Training Number ${number} was issued by Training Management; the number of a paper record cannot be the same.`
    : info?.usedElsewhere
      ? `Training Number ${number} is already used by another record.`
      : "";
  useEffect(() => {
    onNumberState({ joins, problem });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joins, problem]);

  const set = (patch: Partial<LegacyTrainingEvidenceValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" data-testid="legacy-training-evidence">
      <div>
        <h4 className="text-sm font-semibold text-slate-800">Paper training record of revision {revisionLabel}</h4>
        <p className="text-xs text-slate-500">
          The training was done on paper before the system. Attach the scan of the record and say who was trained. The people are taken to have been trained when you sign the import.
        </p>
      </div>
      {problem && <WarningBanner variant="error" description={problem} />}
      {joins && info && (
        <WarningBanner
          variant="info"
          description={`Training Number ${number} is already filed with ${(info.documents ?? []).map((d) => `${d.documentNumber} Rev ${d.revisionNumber}`).join(", ") || "another document"} (${
            "filed"
          }${info.traineeCount ? `, ${info.traineeCount} trained` : ""}). This revision is linked to it; the scan and the people are not entered again.`}
        />
      )}
      {!joins && !problem && (
        <>
          <Checkbox
            id={`legacy-lost-${revisionLabel}`}
            checked={value.notEvidenced}
            onChange={(checked) => set({ notEvidenced: Boolean(checked), scan: checked ? null : value.scan, trainees: checked ? [] : value.trainees })}
            label="The paper record is lost (declare that there is no evidence)"
          />
          {value.notEvidenced ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`legacy-lost-reason-${revisionLabel}`}>
                Why there is no evidence <span className="text-red-500">*</span>
              </label>
              <textarea
                id={`legacy-lost-reason-${revisionLabel}`}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={value.noEvidenceReason}
                onChange={(e) => set({ noEvidenceReason: e.target.value })}
              />
              {showValidation && !value.noEvidenceReason.trim() && <p className="mt-1 text-xs text-red-600">Say why there is no evidence.</p>}
            </div>
          ) : (
            <>
              {number && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`legacy-topic-${revisionLabel}`}>
                      Training Topic <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={`legacy-topic-${revisionLabel}`}
                      type="text"
                      maxLength={255}
                      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={value.topic}
                      placeholder="What was taught, as written on the paper record"
                      onChange={(e) => set({ topic: e.target.value })}
                    />
                    {showValidation && !value.topic.trim() && <p className="mt-1 text-xs text-red-600">Training Topic is required.</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`legacy-trainer-${revisionLabel}`}>
                      Trainer <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={`legacy-trainer-${revisionLabel}`}
                      type="text"
                      maxLength={255}
                      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={value.trainer}
                      placeholder="Name of the trainer as written on the paper record"
                      onChange={(e) => set({ trainer: e.target.value })}
                    />
                    {showValidation && !value.trainer.trim() && <p className="mt-1 text-xs text-red-600">Trainer is required.</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Mode <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={value.method}
                      onChange={(v) => set({ method: String(v) })}
                      options={Object.entries(METHOD_LABEL).map(([key, label]) => ({ label, value: key }))}
                      placeholder="Select mode..."
                      enableSearch={false}
                    />
                    {showValidation && !value.method && <p className="mt-1 text-xs text-red-600">Mode is required.</p>}
                  </div>
                </div>
              )}
              <WarningBanner
                variant="warning"
                description="A scan that is stored cannot be deleted or replaced (the record store is locked). Check that it is the right file before you import."
              />
              <TrainingFileDropzone
                label="Scan of the paper training record (APD.0108 or APD.0117)"
                required
                accept=".pdf"
                maxMb={20}
                hint="PDF only (max 20 MB)"
                file={value.scan}
                onChange={(file) => set({ scan: file })}
              />
              {showValidation && !value.scan && <p className="-mt-2 text-xs text-red-600">Attach the scan, or declare that the paper record is lost.</p>}
              {number ? (
                <ProposedParticipantsField
                  pending={value.trainees}
                  onPendingChange={(people) => set({ trainees: people })}
                  labels={{
                    title: "Persons who were trained",
                    description: "The people who were at the paper training, chosen among the users of the system. They get their training record when you sign the import.",
                    localNotice: "The people chosen here are kept with the import. A person who is no longer in the system cannot be chosen and gets no record.",
                    emptyTitle: "Nobody chosen",
                    emptyDescription: "Use Add Participants to choose the people who were trained.",
                    modalTitle: "Persons who were trained",
                  }}
                />
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  The persons who were trained can be named only when the Training Number of the paper record is entered.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
