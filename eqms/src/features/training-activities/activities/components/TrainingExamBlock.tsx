import { QuestionImageField } from "@/features/training-activities/assessments/QuestionImageField";
import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { RadioGroup } from "@/components/ui/radio";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import {
  trainingError,
  trainingExamApi,
  type ExamQuestion,
  type TrainingExamDefinition,
} from "@/services/api/trainingActivities";
import { Input, Textarea } from "../../shared/TrainingFields";
import { TabBlock } from "../../shared/TrainingDetailLayout";
import { LedgerList, LedgerNote, LedgerRow } from "./workspace/ledger";
import { tr, trFormat } from "@/i18n";

const KIND_LABEL = {
  SINGLE: "One right answer",
  MULTI: "Several right answers",
  TRUE_FALSE: "True or false",
} as const;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Draft = {
  kind: ExamQuestion["kind"];
  prompt: string;
  options: string[];
  correct: string[];
  points: string;
  image: string;
};
const blank = (): Draft => ({
  kind: "SINGLE",
  prompt: "",
  options: ["", ""],
  correct: [],
  points: "1",
  image: "",
});

/**
 * The test of APD.0009 taken in the system. The trainer writes the questions with the training content; the reviewer and the approver see them with the key; after the content is approved they
 * cannot change. A trainee never receives the key.
 */
export function TrainingExamBlock({
  activityId,
  editable,
  hideKey = false,
  bare = false,
  onSummary,
}: {
  activityId: string;
  editable: boolean;
  /** The Session Workspace shows the questions, their kind and points only: no choices and never which answer is right, whoever looks at it. */
  hideKey?: boolean;
  /** The Session Workspace: a plain list under the tab of the step, with no block title of its own. */
  bare?: boolean;
  /** Tells the screen how many questions the test has, once it is loaded. */
  onSummary?: (questions: number | undefined) => void;
}) {
  const { showToast } = useToast();
  const [exam, setExam] = useState<TrainingExamDefinition>();
  const [editing, setEditing] = useState(false);
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
  if (!exam || (exam.questions.length === 0 && !(editable && exam.canEdit)))
    return null;
  const total = exam.questions.reduce((sum, q) => sum + Number(q.points), 0);
  const showKey = exam.canSeeKey && !hideKey;
  if (bare) {
    return (
      <div className="space-y-2">
        <LedgerNote>
          {tr("Trainees answer in the system and it is graded automatically.")}{!exam.canEdit ? " Approved: it cannot be changed." : ""}
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
    <>
      <TabBlock
        title={tr("Test in the system")}
        count={exam.questions.length}
        hint={`Trainees answer in the system and it is graded automatically.${!exam.canEdit && exam.questions.length > 0 ? " Approved: it cannot be changed." : ""}`}
        action={
          editable && exam.canEdit ? (
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => setEditing(true)}
            >
              {exam.questions.length ? "Edit the test" : "Write the test"}
            </Button>
          ) : undefined
        }
      >
        {exam.questions.length > 0 && (
          <p className="px-4 pt-3 text-xs text-slate-500">
            {`${total} point${total === 1 ? "" : "s"}${exam.minutes ? ` · ${exam.minutes} minutes` : " · no time limit"}`}
          </p>
        )}
        {hideKey && exam.questions.length > 0 && (
          <ol className="divide-y divide-slate-100 pt-2">
            {exam.questions.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1 basis-56 break-words text-sm font-medium text-slate-900">{q.qNo}. {q.prompt}</span>
                <Badge color="slate">{KIND_LABEL[q.kind]} · {trFormat("{points} pt", { points: q.points })}</Badge>
              </li>
            ))}
          </ol>
        )}
        {!hideKey && exam.questions.length > 0 && (
          <ol className="space-y-3 p-4">
            {exam.questions.map((q) => (
              <li
                key={q.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
              >
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
                      {showKey && q.correct?.includes(o.id) && (
                        <Badge color="emerald">{tr("Right")}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </TabBlock>
      {editing && (
        <ExamEditor
          activityId={activityId}
          exam={exam}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setExam(next);
            setEditing(false);
            showToast({ type: "success", title: tr("Test saved"), message: "" });
          }}
        />
      )}
    </>
  );
}

function ExamEditor({
  activityId,
  exam,
  onClose,
  onSaved,
}: {
  activityId: string;
  exam: TrainingExamDefinition;
  onClose: () => void;
  onSaved: (next: TrainingExamDefinition) => void;
}) {
  const { showToast } = useToast();
  const [minutes, setMinutes] = useState(
    exam.minutes ? String(exam.minutes) : "",
  );
  const [items, setItems] = useState<Draft[]>(
    exam.questions.length
      ? exam.questions.map((q) => ({
          kind: q.kind,
          prompt: q.prompt,
          options:
            q.kind === "TRUE_FALSE" ? ["", ""] : q.options.map((o) => o.text),
          correct: q.correct ?? [],
          points: String(q.points),
          image: q.image ?? "",
        }))
      : [blank()],
  );
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Draft>) =>
    setItems((list) => list.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const valid = (d: Draft) => {
    if (!d.prompt.trim() || !(Number(d.points) > 0)) return false;
    if (d.kind === "TRUE_FALSE") return d.correct.length === 1;
    return (
      d.options.length >= 2 &&
      d.options.every((o) => o.trim()) &&
      d.correct.length >= 1 &&
      (d.kind === "SINGLE"
        ? d.correct.length === 1
        : d.correct.length < d.options.length)
    );
  };
  const ok =
    items.length > 0 &&
    items.every(valid) &&
    (minutes === "" || (Number(minutes) >= 1 && Number(minutes) <= 480));
  const save = async () => {
    setBusy(true);
    try {
      onSaved(
        await trainingExamApi.save(activityId, {
          minutes: minutes === "" ? null : Number(minutes),
          questions: items.map((d) => ({
            kind: d.kind,
            prompt: d.prompt.trim(),
            options:
              d.kind === "TRUE_FALSE"
                ? []
                : d.options.map((text, i) => ({ id: LETTERS[i], text })),
            correct: d.correct,
            points: Number(d.points),
            image: d.image || null,
          })),
        }),
      );
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The test was not saved"),
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => void save()}
      title={tr("Write the Test")}
      description={tr("Mark the right answers. After the content is reviewed and approved the questions cannot be changed.")}
      confirmText="Save the test"
      isLoading={busy}
      confirmDisabled={!ok}
      size="xl"
    >
      <div className="space-y-4">
        <FormField label={tr("Time limit in minutes (leave empty for none)")}>
          <Input
            type="number"
            min={1}
            max={480}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </FormField>
        {items.map((d, i) => (
          <section
            key={i}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
            aria-label={`Question ${i + 1}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">
                {tr("Question")} {i + 1}
              </h4>
              {items.length > 1 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setItems(items.filter((_x, k) => k !== i))}
                >
                  <IconTrash className="mr-1 h-4 w-4" />
                  {tr("Remove")}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Select
                  label={tr("Kind")}
                  value={d.kind}
                  enableSearch={false}
                  onChange={(v) =>
                    set(i, {
                      kind: v,
                      correct: [],
                      options:
                        v === "TRUE_FALSE"
                          ? ["", ""]
                          : d.options.length >= 2
                            ? d.options
                            : ["", ""],
                    })
                  }
                  options={Object.entries(KIND_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
              <FormField label={tr("Points")}>
                <Input
                  type="number"
                  min={0.5}
                  step="0.5"
                  max={100}
                  value={d.points}
                  onChange={(e) => set(i, { points: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label={tr("Question")} required>
              <Textarea
                rows={2}
                maxLength={2000}
                value={d.prompt}
                onChange={(e) => set(i, { prompt: e.target.value })}
              />
            </FormField>
            <FormField label={tr("Picture")}>
              <QuestionImageField value={d.image} onChange={(image) => set(i, { image })} />
            </FormField>
            {d.kind === "TRUE_FALSE" ? (
              <RadioGroup
                label={tr("The right answer")}
                name={`tf-${i}`}
                layout="horizontal"
                value={d.correct[0] ?? ""}
                onChange={(v) => set(i, { correct: [String(v)] })}
                options={[
                  { label: "True", value: "A" },
                  { label: "False", value: "B" },
                ]}
              />
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">
                  {tr("Answers (tick the right")} {d.kind === "SINGLE" ? tr("one") : tr("ones")}
                  )
                </div>
                {d.options.map((text, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <Checkbox
                      checked={d.correct.includes(LETTERS[k])}
                      onChange={(c) =>
                        set(i, {
                          correct:
                            d.kind === "SINGLE"
                              ? c
                                ? [LETTERS[k]]
                                : []
                              : c
                                ? [...d.correct, LETTERS[k]]
                                : d.correct.filter((x) => x !== LETTERS[k]),
                        })
                      }
                      aria-label={`Answer ${LETTERS[k]} is right`}
                    />
                    <span className="w-5 text-sm text-slate-500">
                      {LETTERS[k]}.
                    </span>
                    <Input
                      value={text}
                      maxLength={500}
                      aria-label={`Answer ${LETTERS[k]}`}
                      onChange={(e) =>
                        set(i, {
                          options: d.options.map((o, m) =>
                            m === k ? e.target.value : o,
                          ),
                        })
                      }
                    />
                    {d.options.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Remove answer ${LETTERS[k]}`}
                        className="text-slate-400 hover:text-red-600"
                        onClick={() =>
                          set(i, {
                            options: d.options.filter((_o, m) => m !== k),
                            correct: d.correct
                              .filter((x) => x !== LETTERS[k])
                              .map((x) =>
                                LETTERS.indexOf(x) > k
                                  ? LETTERS[LETTERS.indexOf(x) - 1]
                                  : x,
                              ),
                          })
                        }
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {d.options.length < (d.kind === "SINGLE" ? 6 : 8) && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => set(i, { options: [...d.options, ""] })}
                  >
                    <IconPlus className="mr-1 h-4 w-4" />
                  {tr("Add an Answer")}
                  </Button>
                )}
              </div>
            )}
          </section>
        ))}
        {items.length < 100 && (
          <Button
            variant="default"
            onClick={() => setItems([...items, blank()])}
          >
            <IconPlus className="mr-1 h-4 w-4" />
            {tr("Add a Question")}
          </Button>
        )}
      </div>
    </FormModal>
  );
}
