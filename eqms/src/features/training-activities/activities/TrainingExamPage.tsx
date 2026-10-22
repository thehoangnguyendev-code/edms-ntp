import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { RadioGroup } from "@/components/ui/radio";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingExamApi, type TrainingExamAttemptView, type TrainingExamMine, type TrainingExamSummary } from "@/services/api/trainingActivities";
import { trainingBreadcrumbs, when } from "../shared/trainingLabels";

const isOpen = (a: TrainingExamMine["attempt"]): a is TrainingExamAttemptView => !!a && "questions" in a;

/** The test of APD.0009 taken in the system: questions without the key, a clock when there is a time limit, a signature at the end, and the result the system graded. */
export function TrainingExamPage() {
  const { participantId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [mine, setMine] = useState<TrainingExamMine>();
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  const load = useCallback(() => { trainingExamApi.mine(participantId).then(setMine).catch((e) => setError(trainingError(e))); }, [participantId]);
  useEffect(load, [load]);

  const attempt = mine && isOpen(mine.attempt) ? mine.attempt : undefined;
  useEffect(() => {
    if (!attempt?.dueAt) { setLeft(null); return; }
    const due = new Date(attempt.dueAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((due - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt?.dueAt]);

  const start = async () => {
    setBusy(true);
    try {
      await trainingExamApi.start(participantId);
      setAnswers({});
      load();
    } catch (e) {
      showToast({ type: "error", title: "The test did not start", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const submit = async (signatureToken: string) => {
    if (!attempt) return;
    try {
      setMine(await trainingExamApi.submit(attempt.attemptId, { answers, signatureToken }));
      setSigning(false);
      showToast({ type: "success", title: "Test submitted", message: "" });
    } catch (e) {
      setSigning(false);
      showToast({ type: "error", title: "The test was not submitted", message: trainingError(e) });
      load();
    }
  };

  const title = "Training Test";
  const crumbs = trainingBreadcrumbs(navigate, "myTraining", title);
  const done = mine && mine.attempt && !isOpen(mine.attempt) ? (mine.attempt as TrainingExamSummary) : undefined;
  const clock = left == null ? "" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  const answered = attempt ? attempt.questions.filter((q) => (answers[q.id] ?? []).length > 0).length : 0;

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={title} breadcrumbItems={crumbs} actions={<Button size="sm" variant="outline" onClick={() => navigate("/training-management/my-training")}>Back</Button>} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!mine && !error && <SectionLoading text="Loading…" />}

      {mine && done && (
        <section className="rounded-xl border border-slate-200 bg-white p-6" aria-label="Result">
          <div className="flex flex-wrap items-center gap-3">
            <Badge color={mine.result === "PASSED" ? "emerald" : mine.result === "FAILED" ? "red" : "amber"}>{mine.result === "PASSED" ? "Passed" : mine.result === "FAILED" ? "Not passed" : done.status === "EXPIRED" ? "Time ran out" : "Waiting"}</Badge>
            {done.status === "SUBMITTED" && <span className="text-2xl font-semibold text-slate-900">{done.percent}%</span>}
          </div>
          {done.status === "SUBMITTED" ? (
            <p className="mt-3 text-sm text-slate-600">You scored {done.scoreObtained} of {done.scoreMax} points, attempt {done.attemptNo}, submitted {when(done.submittedAt)}. The result is in your training record when QA confirms the training.{mine.result === "FAILED" ? " Your trainer will arrange the retraining." : ""}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">The time for attempt {done.attemptNo} ran out. Ask your trainer to release the test again.</p>
          )}
          {mine.canStart && <div className="mt-4"><Button onClick={() => void start()} loading={busy}>Start the test again</Button></div>}
        </section>
      )}

      {mine && !attempt && !done && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          {mine.canStart ? (
            <>
              <p className="text-sm text-slate-700">You may take the test now. Answer every question, then sign. If there is a time limit the clock starts when you press Start, and the test cannot be taken again unless your trainer releases it.</p>
              <div className="mt-4"><Button onClick={() => void start()} loading={busy}>Start the test</Button></div>
            </>
          ) : (
            <p className="text-sm text-slate-600">The test is not open for you. Your trainer opens it by marking you present at the session.</p>
          )}
        </section>
      )}

      {attempt && (
        <>
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm text-slate-700">Attempt {attempt.attemptNo} · {answered} of {attempt.questions.length} answered</span>
            {left != null && <span role="timer" aria-live="off" className={`font-mono text-lg ${left <= 60 ? "text-red-700" : "text-slate-900"}`}>{clock}</span>}
          </div>
          <ol className="space-y-4">
            {attempt.questions.map((q) => (
              <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-medium text-slate-900">{q.qNo}. {q.prompt}</p><Badge color="slate">{q.points} pt{q.kind === "MULTI" ? " · tick all that apply" : ""}</Badge></div>
                <div className="mt-3">
                  {q.kind === "MULTI" ? (
                    <div className="space-y-2">
                      {q.options.map((o) => (
                        <Checkbox key={o.id} label={`${o.id}. ${o.text}`} checked={(answers[q.id] ?? []).includes(o.id)} onChange={(c) => setAnswers({ ...answers, [q.id]: c ? [...(answers[q.id] ?? []), o.id] : (answers[q.id] ?? []).filter((x) => x !== o.id) })} />
                      ))}
                    </div>
                  ) : (
                    <RadioGroup name={`q-${q.id}`} value={(answers[q.id] ?? [])[0] ?? ""} onChange={(v) => setAnswers({ ...answers, [q.id]: [String(v)] })} options={q.options.map((o) => ({ label: q.kind === "TRUE_FALSE" ? o.text : `${o.id}. ${o.text}`, value: o.id }))} />
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex justify-end"><Button onClick={() => setSigning(true)} disabled={busy}>Finish and sign</Button></div>
          <ESignatureModal isOpen={signing} onClose={() => setSigning(false)} onConfirm={async (d: { signatureToken: string }) => submit(d.signatureToken)} actionTitle="Sign the completed test"
            meaningDisplayName="Assessment Signed" meaningCode="TRAINING_ASSESSMENT_SIGNED" targetDetails={{ code: `Attempt ${attempt.attemptNo}`, title: "Training test", revision: "" }} />
        </>
      )}
    </div>
  );
}
