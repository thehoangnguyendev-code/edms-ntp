import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingAssessmentsApi, trainingError, type AssessmentKind, type TrainingActivityDetail, type TrainingAssessmentChoice, type TrainingSession } from "@/services/api/trainingActivities";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { when } from "../../shared/trainingLabels";
import { ASSESSMENT_KIND_LABEL } from "../../assessments/TrainingAssessmentListView";
import { tr, trFormat } from "@/i18n";

/**
 * The test or the checklist of the session (APD.0009) taken from the library of Training Assessments. The activity keeps a frozen copy of the approved version it chooses, so a later version
 * never changes a test that was already printed. The trainer prints the copies, with the name of each trainee already written, before the training starts. It can be chosen or taken off
 * only until the content is reviewed, like a file is uploaded.
 */
export function TrainingAssessmentChoiceBlock({ activity, session, editable, onChanged }: { activity: TrainingActivityDetail; /** The session the choice is for (each session has its own test or checklist); left out for the activity as a whole. */ session?: TrainingSession; editable: boolean; onChanged: (next: TrainingActivityDetail) => void }) {
  const { showToast } = useToast();
  const [choosing, setChoosing] = useState(false);
  const [options, setOptions] = useState<TrainingAssessmentChoice[]>([]);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const own = session?.assessment;
  const chosen = session
    ? (own ? { name: own.name, code: own.defCode, revision: own.defRevision ?? "", kind: own.kind, itemCount: own.itemCount ?? 0, maxScore: own.maxScore ?? null, chosenByName: own.chosenByName ?? null, chosenAt: own.chosenAt ?? null, shared: own.shared } : undefined)
    : activity.assessment ? { ...activity.assessment, shared: false } : undefined;
  const methods = session ? [session.assessmentMethod] : activity.sessions.filter((s) => s.status !== "CANCELLED").map((s) => s.assessmentMethod);
  const several = activity.sessions.filter((s) => s.status !== "CANCELLED").length > 1;
  // A test needs a session assessed by a Test, a checklist one assessed by a Checklist.
  const kinds: AssessmentKind[] = [...(methods.includes("TEST") ? (["QUESTIONS"] as const) : []), ...(methods.includes("CHECKLIST") ? (["CHECKLIST"] as const) : [])];

  const search = useCallback(async (query: string) => {
    const list = await trainingAssessmentsApi.approved(query || undefined, kinds.length === 1 ? kinds[0] : undefined);
    const usable = list.filter((a) => kinds.includes(a.kind));
    setOptions(usable);
    return usable.map((a) => ({ value: a.id, label: `${a.name} (${a.code} ${a.revisionNumber})` }));
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
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const pick = options.find((o) => o.id === picked);
  return (
    <>
      <TabBlock
        title={session && several ? `${tr("Assessment from the library")} · ${tr("Session")} ${session.sessionNo}` : tr("Assessment from the library")}
        action={editable ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline-emerald" onClick={() => setChoosing(true)}>{chosen ? "Change Assessment" : "Choose Assessment"}</Button>
            {chosen && <Button size="sm" variant="outline" loading={busy} onClick={() => void run(() => trainingAssessmentsApi.unchoose(activity.id, session && chosen && !chosen.shared ? session.id : undefined), "Assessment taken off")}>{tr("Remove")}</Button>}
          </div>
        ) : undefined}
      >
        {chosen ? (
          <div className="space-y-1 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{chosen.name}</span>
              <Badge color="emerald">{chosen.code} {chosen.revision}</Badge>
              <Badge color="slate">{ASSESSMENT_KIND_LABEL[chosen.kind] ?? chosen.kind}</Badge>
              {chosen.shared && <Badge color="amber">{tr("Chosen for all sessions")}</Badge>}
            </div>
            <div className="text-slate-600">{chosen.kind === "CHECKLIST" ? trFormat("{count} line(s), no score. Chosen by {name}{when}.", { count: chosen.itemCount, name: chosen.chosenByName ?? "—", when: chosen.chosenAt ? `, ${when(chosen.chosenAt)}` : "" }) : trFormat("{count} question(s), total {score} point(s). Chosen by {name}{when}.", { count: chosen.itemCount, score: chosen.maxScore, name: chosen.chosenByName ?? "—", when: chosen.chosenAt ? `, ${when(chosen.chosenAt)}` : "" })}</div>
            <div className="text-xs text-slate-500">{tr("Its content was written into the form APD.0009 as the exam file and the answer key below (training topic from this activity). They cannot be edited here; a later version of the assessment in the library does not change them. Remove takes both files off.")}</div>
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-500">{tr("Choose an effective test or checklist from the library: its exam file and answer key (form APD.0009) appear below. Only an approved assessment can be put into a training.")}</p>
        )}
      </TabBlock>
      <FormModal
        isOpen={choosing}
        onClose={() => setChoosing(false)}
        onConfirm={() => void run(() => trainingAssessmentsApi.choose(activity.id, picked, session?.id), "Assessment chosen")}
        title={tr("Choose an Assessment")}
        description={tr("Only effective assessments are listed. Its content is written into the enabled form APD.0009 as the exam file and the answer key of this activity; the title of the assessment is not written in the form.")}
        confirmText="Choose"
        isLoading={busy}
        confirmDisabled={!picked}
        size="md"
      >
        <FormField label={tr("Assessment")} required>
          <Select value={picked} onChange={setPicked} options={options.map((o) => ({ value: o.id, label: `${o.name} (${o.code} ${o.revisionNumber})` }))} onSearch={search} placeholder={tr("Search by assessment name or number")} />
        </FormField>
            {pick && <p className="mt-3 text-xs text-slate-600">{ASSESSMENT_KIND_LABEL[pick.kind]} · {trFormat("{count} items", { count: pick.itemCount })}{pick.kind === "CHECKLIST" ? "" : trFormat(" · total {score} points", { score: pick.maxScore })}</p>}
        {choosing && options.length === 0 && <p className="mt-3 text-sm text-amber-700">{tr("No effective assessment of the right type was found. It is written and approved in Training Programme, Training Assessments.")}</p>}
      </FormModal>
    </>
  );
}

/**
 * With several sessions the Assessment tab opens on "All": each session with the test or the checklist it chose, and a button that goes to that session. Only a session assessed by a test or a
 * checklist needs one.
 */
export function SessionAssessmentList({ sessions, editable, onPick }: { sessions: TrainingSession[]; editable: boolean; onPick: (sessionId: string) => void }) {
  return (
    <TabBlock title={tr("Assessment of each session")} count={sessions.length}>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {sessions.map((s) => {
          const needs = s.assessmentMethod === "TEST" || s.assessmentMethod === "CHECKLIST";
          const word = s.assessmentMethod === "CHECKLIST" ? tr("checklist") : tr("test");
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900">{tr("Session")} {s.sessionNo} · {s.topics[0]?.topicText ?? "—"}</div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {!needs ? tr("No test or checklist is needed for this session.") : s.assessment ? `${s.assessment.name} (${s.assessment.defCode} ${s.assessment.defRevision ?? ""})${s.assessment.shared ? ` · ${tr("Chosen for all sessions")}` : ""}` : <span className="text-amber-700">{trFormat("No {word} chosen yet", { word })}</span>}
                </div>
              </div>
              {needs && <Button size="sm" variant="outline-emerald" onClick={() => onPick(s.id)}>{editable ? (s.assessment ? tr("Change") : tr("Choose")) : tr("Open")}</Button>}
            </li>
          );
        })}
      </ul>
    </TabBlock>
  );
}
