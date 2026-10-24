import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingAssessmentsApi, trainingError, type AssessmentKind, type TrainingActivityDetail, type TrainingAssessmentChoice } from "@/services/api/trainingActivities";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { when } from "../../shared/trainingLabels";
import { ASSESSMENT_KIND_LABEL } from "../../assessments/TrainingAssessmentListView";

/**
 * The test or the checklist of the session (APD.0009) taken from the library of Training Assessments. The activity keeps a frozen copy of the approved version it chooses, so a later version
 * never changes a test that was already printed. The trainer prints the copies, with the name of each trainee already written, before the training starts. It can be chosen or taken off
 * only until the content is reviewed, like a file is uploaded.
 */
export function TrainingAssessmentChoiceBlock({ activity, editable, onChanged }: { activity: TrainingActivityDetail; editable: boolean; onChanged: (next: TrainingActivityDetail) => void }) {
  const { showToast } = useToast();
  const [choosing, setChoosing] = useState(false);
  const [options, setOptions] = useState<TrainingAssessmentChoice[]>([]);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = activity.assessment;
  const methods = activity.sessions.filter((s) => s.status !== "CANCELLED").map((s) => s.assessmentMethod);
  // A test needs a session assessed by a Test, a checklist one assessed by a Checklist.
  const kinds: AssessmentKind[] = [...(methods.includes("TEST") ? (["QUESTIONS"] as const) : []), ...(methods.includes("CHECKLIST") ? (["CHECKLIST"] as const) : [])];

  const search = useCallback(async (query: string) => {
    const list = await trainingAssessmentsApi.approved(query || undefined, kinds.length === 1 ? kinds[0] : undefined);
    const usable = list.filter((a) => kinds.includes(a.kind));
    setOptions(usable);
    return usable.map((a) => ({ value: a.id, label: `${a.title} (${a.code} v${a.versionNo})` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kinds.join("|")]);
  useEffect(() => { if (choosing) void search(""); }, [choosing, search]);

  if (kinds.length === 0 || (!chosen && !editable)) return null;
  const run = async (action: () => Promise<TrainingActivityDetail>, done: string) => {
    setBusy(true);
    try {
      onChanged(await action());
      showToast({ type: "success", title: done, message: "" });
      setChoosing(false);
      setPicked("");
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const pick = options.find((o) => o.id === picked);
  return (
    <>
      <TabBlock
        title="Assessment from the library"
        action={editable ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline-emerald" onClick={() => setChoosing(true)}>{chosen ? "Change Assessment" : "Choose Assessment"}</Button>
            {chosen && <Button size="sm" variant="outline" loading={busy} onClick={() => void run(() => trainingAssessmentsApi.unchoose(activity.id), "Assessment taken off")}>Remove</Button>}
          </div>
        ) : undefined}
      >
        {chosen ? (
          <div className="space-y-1 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{chosen.title}</span>
              <Badge color="emerald">{chosen.code} v{chosen.version}</Badge>
              <Badge color="slate">{ASSESSMENT_KIND_LABEL[chosen.kind] ?? chosen.kind}</Badge>
            </div>
            <div className="text-slate-600">{chosen.itemCount} {chosen.kind === "CHECKLIST" ? "line(s), no score" : `question(s), total ${chosen.maxScore} point(s)`}. Chosen by {chosen.chosenByName ?? "—"}{chosen.chosenAt ? `, ${when(chosen.chosenAt)}` : ""}.</div>
            <div className="text-xs text-slate-500">Frozen copy: a later version of the assessment does not change it. The trainer prints the test copies and the answer key from the Sessions tab once the training is notified.</div>
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-500">No assessment chosen. Choose an effective test or checklist from the library, or upload the file below.</p>
        )}
      </TabBlock>
      <FormModal
        isOpen={choosing}
        onClose={() => setChoosing(false)}
        onConfirm={() => void run(() => trainingAssessmentsApi.choose(activity.id, picked), "Assessment chosen")}
        title="Choose an Assessment"
        description="Only effective assessments are listed. The activity keeps its own copy of the version you choose."
        confirmText="Choose"
        isLoading={busy}
        confirmDisabled={!picked}
        size="md"
      >
        <FormField label="Assessment" required>
          <Select value={picked} onChange={setPicked} options={options.map((o) => ({ value: o.id, label: `${o.title} (${o.code} v${o.versionNo})` }))} onSearch={search} placeholder="Search by title or code" />
        </FormField>
        {pick && <p className="mt-3 text-xs text-slate-600">{ASSESSMENT_KIND_LABEL[pick.kind]} · {pick.itemCount} item(s){pick.kind === "CHECKLIST" ? "" : ` · total ${pick.maxScore} point(s)`}</p>}
        {choosing && options.length === 0 && <p className="mt-3 text-sm text-amber-700">No effective assessment of the right type was found. It is written and approved in Training Programme, Training Assessments.</p>}
      </FormModal>
    </>
  );
}
