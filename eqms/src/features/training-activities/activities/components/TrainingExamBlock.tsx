import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { Badge } from "@/components/ui/badge/Badge";
import { trainingExamApi, type TrainingExamDefinition } from "@/services/api/trainingActivities";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { LedgerList, LedgerNote, LedgerRow } from "./workspace/ledger";
import { tr, trFormat } from "@/i18n";

const KIND_LABEL = {
  SINGLE: "One right answer",
  MULTI: "Several right answers",
  TRUE_FALSE: "True or false",
} as const;

/**
 * The test of APD.0009 taken in the system, shown read only. A test is no longer written in the system for an activity (only an approved assessment of the library is put into a training); this shows
 * the ones that were written before, which the trainees still take. A trainee never receives the key.
 */
export function TrainingExamBlock({
  activityId,
  hideKey = false,
  bare = false,
  onSummary,
}: {
  activityId: string;
  /** The Session Workspace shows the questions, their kind and points only: no choices and never which answer is right, whoever looks at it. */
  hideKey?: boolean;
  /** The Session Workspace: a plain list under the tab of the step, with no block title of its own. */
  bare?: boolean;
  /** Tells the screen how many questions the test has, once it is loaded. */
  onSummary?: (questions: number | undefined) => void;
}) {
  const [exam, setExam] = useState<TrainingExamDefinition>();
  const load = useCallback(() => {
    trainingExamApi
      .get(activityId)
      .then(setExam)
      .catch(() => setExam(undefined));
  }, [activityId]);
  useEffect(load, [load]);
  useEntityChanged(["TRAINING"], load);
  const questionCount = exam?.questions.length;
  useEffect(() => { onSummary?.(questionCount ? questionCount : undefined); }, [questionCount, onSummary]);
  if (!exam || exam.questions.length === 0) return null;
  const total = exam.questions.reduce((sum, q) => sum + Number(q.points), 0);
  const showKey = exam.canSeeKey && !hideKey;
  if (bare) {
    return (
      <div className="space-y-2">
        <LedgerNote>
          {tr("Trainees answer in the system and it is graded automatically.")}
          <span className="block">{`${exam.questions.length} question${exam.questions.length === 1 ? "" : "s"} · ${total} point${total === 1 ? "" : "s"}${exam.minutes ? ` · ${exam.minutes} minutes` : " · no time limit"}`}</span>
        </LedgerNote>
        <LedgerList>
          {exam.questions.map((q) => (
            <LedgerRow
              key={q.id}
              title={<>{q.qNo}. {q.prompt}{q.image && <img src={q.image} alt={`Picture of question ${q.qNo}`} className="mt-2 max-h-48 max-w-full rounded border border-slate-200 bg-white object-contain" />}</>}
              state={`${KIND_LABEL[q.kind]} · ${trFormat("{points} pt", { points: q.points })}`}
            />
          ))}
        </LedgerList>
      </div>
    );
  }
  return (
    <TabBlock title={tr("Test in the system")} count={exam.questions.length} hint={tr("Trainees answer in the system and it is graded automatically. A test is no longer written in the system: it cannot be changed.")}>
      <p className="px-4 pt-3 text-xs text-slate-500">
        {`${total} point${total === 1 ? "" : "s"}${exam.minutes ? ` · ${exam.minutes} minutes` : " · no time limit"}`}
      </p>
      {hideKey ? (
        <ol className="divide-y divide-slate-100 pt-2">
          {exam.questions.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
              <span className="min-w-0 flex-1 basis-56 break-words text-sm font-medium text-slate-900">{q.qNo}. {q.prompt}</span>
              <Badge color="slate">{KIND_LABEL[q.kind]} · {trFormat("{points} pt", { points: q.points })}</Badge>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="space-y-3 p-4">
          {exam.questions.map((q) => (
            <li key={q.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {q.qNo}. {q.prompt}
                </span>
                <Badge color="slate">
                  {KIND_LABEL[q.kind]} · {trFormat("{points} pt", { points: q.points })}
                </Badge>
              </div>
              {q.image && <img src={q.image} alt={`Picture of question ${q.qNo}`} className="mt-2 max-h-48 max-w-full rounded border border-slate-200 bg-white object-contain" />}
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {q.options.map((o) => (
                  <li
                    key={o.id}
                    className={`flex items-start gap-2 ${showKey && q.correct?.includes(o.id) ? "font-medium text-emerald-700" : "text-slate-600"}`}
                  >
                    <span className="w-5 shrink-0">{o.id}.</span>
                    <span className="min-w-0 break-words">{o.text}</span>
                    {showKey && q.correct?.includes(o.id) && <Badge color="emerald">{tr("Right")}</Badge>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </TabBlock>
  );
}
