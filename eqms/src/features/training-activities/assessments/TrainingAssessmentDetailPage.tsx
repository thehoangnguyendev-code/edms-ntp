import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconAlertTriangle, IconChevronDown, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DraggableReorderList } from "@/components/ui/draggable-reorder-list/DraggableReorderList";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { RadioGroup } from "@/components/ui/radio";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { AssessmentPreviewModal } from "./AssessmentPreviewModal";
import { QuestionImageField } from "./QuestionImageField";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AssessmentPaperPane } from "./AssessmentPaperPane";
import { useServerWorkflow } from "@/components/ui/workflow-stepper/useServerWorkflow";
import {
  trainingAssessmentsApi,
  trainingWorkflowApi,
  trainingCodeText,
  trainingError,
  type AssessmentItemKind,
  type AssessmentKind,
  type EssayNumbering,
  type TrainingAssessmentDetail,
  type TrainingAssessmentSave,
} from "@/services/api/trainingActivities";
import { Input, Textarea } from "../shared/TrainingFields";
import {
  statusChange,
  trainingBreadcrumbs,
  when,
} from "../shared/trainingLabels";
import {
  ReadonlyField,
  ReadonlyGrid,
  TrainingDetailLayout,
} from "../shared/TrainingDetailLayout";
import { useTrainingBack } from "../shared/useTrainingBack";
import { AssessmentRevisionsCard } from "./AssessmentRevisionsCard";
import {
  ASSESSMENT_KIND_LABEL,
  ASSESSMENT_STATUS_LABEL,
} from "./TrainingAssessmentListView";
import { tr, trFormat, trPlural } from "@/i18n";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const QUESTION_KIND_LABEL: Record<string, string> = {
  SINGLE: "One right answer",
  MULTI: "Several right answers",
  TRUE_FALSE: "True or false",
  ESSAY: "Essay (marked by hand)",
};

/** A question or a line, and an answer, carry a key of their own so that dragging them in the list keeps each one's content and ticks. */
export interface Opt {
  key: string;
  text: string;
}
/** How the answers of a question are laid out in the form: one under the other, or in two columns. */
export type OptionLayout = "VERTICAL" | "TWO_COLUMNS";
/** The ruled lines an essay question gets in the form when its author does not choose a number. */
export const DEFAULT_ANSWER_LINES = 8;
export interface Draft {
  id: string;
  kind: AssessmentItemKind;
  prompt: string;
  options: Opt[];
  correct: string[];
  points: string;
  modelAnswer: string;
  optionLayout: OptionLayout;
  answerLines: string;
  /** A picture under the question (a data URL); a test only. */
  image?: string;
}
let keySeed = 0;
const newKey = () => `k${++keySeed}`;
const opts = (texts: string[]): Opt[] =>
  texts.map((text) => ({ key: newKey(), text }));
/** A new test is out of 10 points (the scale of APD.0009: "7 of 10"): the questions share it equally until the person sets the points or the total by hand. */
export const DEFAULT_TOTAL_SCORE = 10;

const blank = (kind: AssessmentKind): Draft =>
  kind === "CHECKLIST"
    ? {
        id: newKey(),
        kind: "CHECK",
        prompt: "",
        options: [],
        correct: ["CORRECT"],
        points: "1",
        modelAnswer: "",
        optionLayout: "VERTICAL",
        answerLines: "",
        image: "",
      }
    : {
        id: newKey(),
        kind: "SINGLE",
        prompt: "",
        options: opts(["", ""]),
        correct: [],
        points: "1",
        modelAnswer: "",
        optionLayout: "VERTICAL",
        answerLines: "",
        image: "",
      };

/** The answers of a question after a drag. The ticks follow their answers: the letters are those of the new order. */
export function reorderAnswers(d: Draft, next: Opt[]): Draft {
  const correct = d.correct.map((letter) => {
    const key = d.options[LETTERS.indexOf(letter)]?.key;
    const at = next.findIndex((o) => o.key === key);
    return at >= 0 ? LETTERS[at] : letter;
  });
  return { ...d, options: next, correct };
}

/**
 * What is still missing in a question or a line, in words for the person who writes it (empty when it is complete). The same rules the server applies; the server refuses anything else with a
 * stable code. A checklist line has no points.
 */
export const itemIssues = (d: Draft): string[] => {
  const issues: string[] = [];
  if (!d.prompt.trim()) issues.push(d.kind === "CHECK" ? tr("The line is empty") : tr("The question text is missing"));
  if (d.kind !== "CHECK") {
    const points = Number(d.points);
    if (!(points > 0) || points > 100) issues.push("The points must be above 0 and not more than 100");
  }
  switch (d.kind) {
    case "SINGLE":
    case "MULTI":
      if (d.options.length < 2) issues.push("At least two answers are needed");
      d.options.forEach((o, k) => {
        if (!o.text.trim()) issues.push(`Answer ${LETTERS[k]} is empty`);
      });
      if (d.kind === "SINGLE" ? d.correct.length !== 1 : d.correct.length < 1) {
        issues.push(d.kind === "SINGLE" ? tr("The right answer is not ticked") : tr("No right answer is ticked"));
      }
      break;
    case "TRUE_FALSE":
    case "CHECK":
      if (d.correct.length !== 1) issues.push("The right answer is not chosen");
      break;
    case "ESSAY":
      if (
        d.answerLines.trim() !== "" &&
        !(Number.isInteger(Number(d.answerLines)) && Number(d.answerLines) >= 1 && Number(d.answerLines) <= 30)
      ) {
        issues.push("The lines to write on: a whole number from 1 to 30");
      }
      break;
    default:
      break;
  }
  return issues;
};
export const itemValid = (d: Draft) => itemIssues(d).length === 0;

/**
 * Sets the total score of a test and shares it among the questions in proportion to the points they have now (equally when they have none), in hundredths, so that the points add up to the total
 * exactly. Null when the total is too small to give every question at least one hundredth.
 */
export function distributePoints(
  items: Draft[],
  total: number,
): string[] | null {
  const cents = Math.round(total * 100);
  const n = items.length;
  if (!Number.isFinite(cents) || n === 0 || cents < n) return null;
  const old = items.map((d) => Math.max(Number(d.points) || 0, 0));
  const sum = old.reduce((a, b) => a + b, 0);
  const weights = sum > 0 ? old : old.map(() => 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const alloc = weights.map((w) =>
    Math.max(1, Math.floor((cents * w) / weightSum)),
  );
  let diff = cents - alloc.reduce((a, b) => a + b, 0);
  const order = weights
    .map((_w, i) => i)
    .sort((a, b) => weights[b] - weights[a]);
  for (let guard = 0; diff !== 0 && guard < cents + n; guard++) {
    const i = order[guard % n];
    if (diff > 0) {
      alloc[i]++;
      diff--;
    } else if (alloc[i] > 1) {
      alloc[i]--;
      diff++;
    }
  }
  return diff === 0 ? alloc.map((c) => String(c / 100)) : null;
}


/** One Training Assessment of the library (APD.0009): a test of questions or a checklist. A draft is written here and sent for approval; another person signs it into Effective; a change is a new version. */
export function TrainingAssessmentDetailPage({
  isNew = false,
}: {
  isNew?: boolean;
}) {
  const { assessmentId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = useTrainingBack("/training-management/assessments");
  const { showToast } = useToast();
  const [detail, setDetail] = useState<TrainingAssessmentDetail>();
  // A new assessment has no record yet, so the server gives the stepper of a new one; a saved one carries its own.
  const newWorkflow = useServerWorkflow(isNew ? "training:ASSESSMENT" : null, () => trainingWorkflowApi.newRecord("ASSESSMENT"));
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [head, setHead] = useState<{
    name: string;
    kind: AssessmentKind;
    duration: string;
    essayNumbering: EssayNumbering;
  }>({ name: "", kind: "QUESTIONS", duration: "", essayNumbering: "CONTINUE" });
  const [items, setItems] = useState<Draft[]>([{ ...blank("QUESTIONS"), points: String(DEFAULT_TOTAL_SCORE) }]);
  // while it is true (a new test, not set by hand) adding or taking out a question shares the total again, equally
  const [autoTotal, setAutoTotal] = useState(true);
  const [wantedTotal, setWantedTotal] = useState(DEFAULT_TOTAL_SCORE);
  // `dirty` is what Save needs (a new test starts so); `edited` is what the person has changed, which is what leaving without saving would lose.
  const [dirty, setDirtyState] = useState(isNew);
  const [edited, setEdited] = useState(false);
  // Counts what happens to the content (a change by the person, a load from the server): a paper made at another number does not show what is in the editor now.
  const [edits, setEdits] = useState(0);
  const setDirty = useCallback((value: boolean) => { setDirtyState(value); setEdited(value); if (value) setEdits((n) => n + 1); }, []);
  // Beside the questions the paper has a column of its own; under that width the questions and the paper are two tabs.
  const wide = useMediaQuery("(min-width: 1440px)");
  const [pane, setPane] = useState<"edit" | "paper">("edit");
  // The questions that are folded to one line (by their key); every question starts open, and a new one opens.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleItem = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<"delete" | "return">();
  const [reason, setReason] = useState("");
  const [signing, setSigning] = useState(false);
  const [totalText, setTotalText] = useState<string | null>(null);
  // The preview has a state of its own: it is only the drawing of a paper by the document server and must not make the other buttons look busy.
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ url: string }>();

  const apply = useCallback((d: TrainingAssessmentDetail) => {
    setDetail(d);
    setHead({
      name: d.name,
      kind: d.kind,
      duration: d.durationMinutes ? String(d.durationMinutes) : "",
      essayNumbering: d.essayNumbering === "RESTART" ? "RESTART" : "CONTINUE",
    });
    setItems(
      d.items.map((i) => ({
        id: newKey(),
        kind: i.kind,
        prompt: i.prompt,
        options:
          i.kind === "TRUE_FALSE" ? [] : opts(i.options.map((o) => o.text)),
        correct: i.correct,
        points: String(i.points),
        modelAnswer: i.modelAnswer ?? "",
        optionLayout:
          i.optionLayout === "TWO_COLUMNS" ? "TWO_COLUMNS" : "VERTICAL",
        answerLines: i.answerLines ? String(i.answerLines) : "",
        image: i.image ?? "",
      })),
    );
    setDirty(false);
    setEdits((n) => n + 1);
    setTotalText(null);
  }, []);
  const refetch = useCallback(() => {
    trainingAssessmentsApi
      .get(assessmentId)
      .then(apply)
      .catch((e) => setError(trainingError(e)));
  }, [assessmentId, apply]);
  useEffect(() => {
    if (!isNew) refetch();
  }, [isNew, refetch]);
  // A change made by someone else refreshes the page, but never over what is being typed.
  const typing = useRef(false);
  typing.current = dirty;
  useEntityChanged(["TRAINING"], () => {
    if (!typing.current && !isNew) refetch();
  });

  const caps = detail?.capabilities;
  const editable = isNew || Boolean(caps?.edit);
  const checklist = head.kind === "CHECKLIST";
  const title = isNew
    ? tr("New Training Assessment")
    : tr("Training Assessment Details");
  // Leaving with changes that were not saved asks first (Back, the breadcrumb, the sidebar, a reload); the moves after a Save or a delete are not leaves.
  const { go, confirmLeave, modal: leaveModal } = useLeaveGuard(edited, title, "the previous page");
  const crumbs = trainingBreadcrumbs(go, "assessments", title);

  if (!isNew && !detail) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : (
          <SectionLoading text="Loading…" />
        )}
      </div>
    );
  }

  const setItem = (i: number, patch: Partial<Draft>) => {
    setItems((list) => list.map((d, k) => (k === i ? { ...d, ...patch } : d)));
    if (patch.points !== undefined) setAutoTotal(false);
    setDirty(true);
  };
  /** The questions of a new test share the total equally (nothing is changed when the points were set by hand, in a saved test or in a checklist). */
  const shareEqually = (list: Draft[]) => {
    if (!isNew || !autoTotal || head.kind === "CHECKLIST") return list;
    const shared = distributePoints(list.map((d) => ({ ...d, points: "1" })), wantedTotal);
    return shared ? list.map((d, k) => ({ ...d, points: shared[k] })) : list;
  };
  /** A drag of the questions or the lines: the list comes back in its new order (the rows are told apart by their key). */
  const dragItems = (next: { id: string }[]) =>
    setItems(next.map((n) => items.find((d) => d.id === n.id) as Draft));
  const dragAnswers = (i: number, next: { id: string }[]) => {
    const d = items[i];
    setItem(
      i,
      reorderAnswers(
        d,
        next.map((n) => d.options.find((o) => o.key === n.id) as Opt),
      ),
    );
  };
  const total = items.reduce(
    (sum, d) => sum + (Number(d.points) > 0 ? Number(d.points) : 0),
    0,
  );
  const totalShown = totalText ?? String(Math.round(total * 100) / 100);
  const applyTotal = () => {
    const wanted = Number(totalText);
    setTotalText(null);
    if (totalText == null || !Number.isFinite(wanted) || wanted <= 0) return;
    const shared = distributePoints(items, wanted);
    if (!shared) {
      showToast({
        type: "error",
        title: tr("The total score was not changed"),
        message: tr("Every question needs at least 0.01 point."),
      });
      return;
    }
    setItems(items.map((d, k) => ({ ...d, points: shared[k] })));
    setWantedTotal(wanted);
    setDirty(true);
  };
  const incompleteItems = items.flatMap((d, i) => (itemIssues(d).length ? [i] : []));
  const incomplete = incompleteItems.length;
  const firstIncomplete = incompleteItems[0] ?? -1;
  const durationValid =
    head.duration.trim() === "" ||
    (Number.isInteger(Number(head.duration)) &&
      Number(head.duration) >= 1 &&
      Number(head.duration) <= 480);
  const valid =
    head.name.trim().length > 0 &&
    items.length > 0 &&
    items.every(itemValid) &&
    durationValid;
  const body = (): TrainingAssessmentSave => ({
    version: detail?.version,
    name: head.name.trim(),
    kind: head.kind,
    durationMinutes: head.duration.trim() ? Number(head.duration) : undefined,
    essayNumbering: head.essayNumbering,
    items: items.map((d) => ({
      kind: d.kind,
      prompt: d.prompt.trim(),
      options:
        d.kind === "SINGLE" || d.kind === "MULTI"
          ? d.options.map((o) => ({ text: o.text.trim() }))
          : [],
      correct: d.kind === "ESSAY" ? [] : d.correct,
      points: d.kind === "CHECK" ? 1 : Number(d.points),
      modelAnswer:
        d.kind === "ESSAY" && d.modelAnswer.trim()
          ? d.modelAnswer.trim()
          : undefined,
      optionLayout:
        d.kind === "SINGLE" || d.kind === "MULTI" ? d.optionLayout : undefined,
      answerLines:
        d.kind === "ESSAY" && d.answerLines.trim()
          ? Number(d.answerLines)
          : undefined,
      image: d.kind !== "CHECK" && d.image ? d.image : undefined,
    })),
  });

  /** The paper drawn from what is in the editor now (saved or not), in the project PDF viewer; with the key it is the paper of the trainer. Nothing is stored. */
  const makePaper = async (paper: "test" | "key" | "both") => {
    const { items: previewItems, durationMinutes, essayNumbering } = body();
    const blob = await trainingAssessmentsApi.preview({
      name: head.name.trim(),
      kind: head.kind,
      durationMinutes,
      essayNumbering,
      items: previewItems,
      key: paper === "key",
      sideBySide: paper === "both" || undefined,
      code: detail?.code,
      revisionNumber: detail?.revisionNumber,
    });
    return URL.createObjectURL(blob);
  };
  const openPreview = async () => {
    setPreviewing(true);
    try {
      setPreview({ url: await makePaper("test") });
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The preview could not be made"),
        message: trainingError(e),
      });
    } finally {
      setPreviewing(false);
    }
  };
  const run = async (
    action: () => Promise<TrainingAssessmentDetail>,
    done: string,
  ) => {
    setBusy(true);
    try {
      const next = await action();
      showToast({
        type: "success",
        title: done,
        message: `${next.code} ${next.revisionNumber}`,
      });
      if (isNew)
        navigate(`/training-management/assessments/${next.id}`, {
          replace: true,
        });
      else apply(next);
      return true;
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The action was not done"),
        message: trainingError(e),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const answerReason = async () => {
    if (!detail || !asking) return;
    if (asking === "return") {
      if (
        await run(
          () => trainingAssessmentsApi.returnToDraft(detail.id, reason.trim()),
          "Returned to draft",
        )
      )
        setAsking(undefined);
      return;
    }
    setBusy(true);
    try {
      await trainingAssessmentsApi.remove(detail.id, reason.trim());
      showToast({
        type: "success",
        title: tr("Draft deleted"),
        message: detail.code,
      });
      navigate("/training-management/assessments", { replace: true });
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The draft was not deleted"),
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };

  /** One question or line, with its answers; the answers are dragged in their own list. */
  const renderItem = (d: Draft, i: number) => (
    <section
      id={`assessment-item-${i}`}
      className="space-y-3"
      aria-label={`${checklist ? "Line" : "Question"} ${i + 1}`}
    >
      <div className="flex min-h-9 items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={!collapsed.has(d.id)}
          aria-controls={`assessment-item-body-${i}`}
          onClick={() => toggleItem(d.id)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <IconChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${collapsed.has(d.id) ? "-rotate-90" : ""}`}
          />
          <h4 className="shrink-0 text-sm font-semibold text-slate-900">
            {checklist ? "Line" : "Question"} {i + 1}
          </h4>
          {collapsed.has(d.id) && (
            <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-500">
              {!checklist && (
                <span className="hidden shrink-0 sm:inline">
                  {QUESTION_KIND_LABEL[d.kind] ?? d.kind} ·
                </span>
              )}
              <span className={`truncate ${d.prompt.trim() ? "text-slate-700" : "italic"}`}>
                {d.prompt.trim() || tr("No text yet")}
              </span>
              {!checklist && (
                <span className="shrink-0 tabular-nums">
                  · {d.points || 0} {tr("points")}
                </span>
              )}
              {itemIssues(d).length > 0 && (
                <IconAlertTriangle
                  className="h-4 w-4 shrink-0 text-amber-600"
                  aria-label={tr("Not complete")}
                />
              )}
            </span>
          )}
        </button>
        {editable && items.length > 1 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setItems(shareEqually(items.filter((_x, k) => k !== i)));
              setDirty(true);
            }}
          >
            <IconTrash className="mr-1 h-4 w-4" />
            {tr("Remove")}
          </Button>
        )}
      </div>
      {!collapsed.has(d.id) && (
      <div id={`assessment-item-body-${i}`} className="space-y-3">
      {!checklist && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Select
              label={tr("Kind")}
              value={d.kind}
              enableSearch={false}
              disabled={!editable}
              onChange={(v) =>
                setItem(i, {
                  kind: v,
                  correct: [],
                  options:
                    v === "SINGLE" || v === "MULTI"
                      ? d.options.length >= 2
                        ? d.options
                        : opts(["", ""])
                      : [],
                })
              }
              options={Object.entries(QUESTION_KIND_LABEL).map(
                ([value, label]) => ({
                  value: value as AssessmentItemKind,
                  label,
                }),
              )}
            />
          </div>
          <FormField label={tr("Points")}>
            <Input
              type="number"
              min={0.01}
              step="0.5"
              max={100}
              value={d.points}
              disabled={!editable}
              onChange={(e) => setItem(i, { points: e.target.value })}
            />
          </FormField>
        </div>
      )}
      <FormField label={checklist ? tr("Line to check") : "Question"} required>
        <Textarea
          rows={2}
          maxLength={2000}
          value={d.prompt}
          disabled={!editable}
          onChange={(e) => setItem(i, { prompt: e.target.value })}
        />
      </FormField>
      {d.kind !== "CHECK" && (
        <QuestionImageField value={d.image ?? ""} disabled={!editable} onChange={(image) => setItem(i, { image })} />
      )}
      {d.kind === "CHECK" && (
        <RadioGroup
          label={tr("The key: what the person must tick")}
          name={`check-${i}`}
          layout="horizontal"
          value={d.correct[0] ?? ""}
          disabled={!editable}
          onChange={(v) => setItem(i, { correct: [String(v)] })}
          options={[
            { label: "Correct (Đúng)", value: "CORRECT" },
            { label: "Incorrect (Không đúng)", value: "INCORRECT" },
          ]}
        />
      )}
      {d.kind === "TRUE_FALSE" && (
        <RadioGroup
          label={tr("The right answer")}
          name={`tf-${i}`}
          layout="horizontal"
          value={d.correct[0] ?? ""}
          disabled={!editable}
          onChange={(v) => setItem(i, { correct: [String(v)] })}
          options={[
            { label: "True", value: "A" },
            { label: "False", value: "B" },
          ]}
        />
      )}
      {(d.kind === "SINGLE" || d.kind === "MULTI") && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-800">
                  {tr("Answers (tick the right")} {d.kind === "SINGLE" ? tr("one") : tr("ones")})
          </div>
          {editable ? (
            <DraggableReorderList
              plain
              items={d.options.map((o, k) => ({
                id: o.key,
                label: `answer ${LETTERS[k]}`,
              }))}
              onReorder={(next) => dragAnswers(i, next)}
              renderItem={(row) => {
                const k = d.options.findIndex((o) => o.key === row.id);
                return k < 0 ? null : answerRow(d, i, k);
              }}
            />
          ) : (
            <div className="space-y-2">
              {d.options.map((o, k) => (
                <div key={o.key}>{answerRow(d, i, k)}</div>
              ))}
            </div>
          )}
          {editable && d.options.length < LETTERS.length && (
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                setItem(i, {
                  options: [...d.options, { key: newKey(), text: "" }],
                })
              }
            >
              <IconPlus className="mr-1 h-4 w-4" />
              {tr("Add an Answer")}
            </Button>
          )}
          <RadioGroup
            label={tr("Answers in the form")}
            name={`layout-${i}`}
            layout="horizontal"
            value={d.optionLayout}
            disabled={!editable}
            onChange={(v) =>
              setItem(i, {
                optionLayout: v === "TWO_COLUMNS" ? "TWO_COLUMNS" : "VERTICAL",
              })
            }
            options={[
              { label: tr("One under the other"), value: "VERTICAL" },
              { label: tr("Two columns"), value: "TWO_COLUMNS" },
            ]}
          />
        </div>
      )}
      {d.kind === "ESSAY" && (
        <FormField
          label={`Lines to write on (1 to 30, empty: ${DEFAULT_ANSWER_LINES})`}
          hint={tr("The form is ruled with this number of light lines under the question.")}
          error={
            d.answerLines.trim() !== "" &&
            !(Number(d.answerLines) >= 1 && Number(d.answerLines) <= 30)
              ? `Enter a whole number from 1 to 30, or leave it empty for ${DEFAULT_ANSWER_LINES} lines.`
              : undefined
          }
        >
          <Input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={d.answerLines}
            disabled={!editable}
            placeholder={String(DEFAULT_ANSWER_LINES)}
            aria-label={tr("Lines to write on")}
            onChange={(e) =>
              setItem(i, { answerLines: e.target.value.replace(/\D/g, "") })
            }
          />
        </FormField>
      )}
      {d.kind === "ESSAY" && (
        <FormField label={tr("Model answer or marking guide (for the trainer only, never printed for the trainees)")}>
          <Textarea
            rows={3}
            maxLength={4000}
            value={d.modelAnswer}
            disabled={!editable}
            onChange={(e) => setItem(i, { modelAnswer: e.target.value })}
          />
        </FormField>
      )}
      {editable && itemIssues(d).length > 0 && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <p className="font-medium">{tr("Not complete")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {itemIssues(d).map((issue) => (
              <li key={issue}>{tr(issue)}</li>
            ))}
          </ul>
        </div>
      )}
      </div>
      )}
    </section>
  );
  const answerRow = (d: Draft, i: number, k: number) => (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
        d.correct.includes(LETTERS[k])
          ? "bg-emerald-50 ring-1 ring-emerald-200"
          : ""
      }`}
    >
      <Checkbox
        checked={d.correct.includes(LETTERS[k])}
        disabled={!editable}
        aria-label={`Answer ${LETTERS[k]} is right`}
        onChange={(c) =>
          setItem(i, {
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
      />
      <span className="w-5 text-sm text-slate-500">{LETTERS[k]}.</span>
      <Input
        value={d.options[k].text}
        maxLength={500}
        aria-label={`Answer ${LETTERS[k]}`}
        disabled={!editable}
        onChange={(e) =>
          setItem(i, {
            options: d.options.map((o, m) =>
              m === k ? { ...o, text: e.target.value } : o,
            ),
          })
        }
      />
      {d.correct.includes(LETTERS[k]) && (
        <span className="hidden shrink-0 text-xs font-medium text-emerald-700 sm:inline">
          {tr("Correct")}
        </span>
      )}
      {editable && d.options.length > 2 && (
        <button
          type="button"
          aria-label={`Remove answer ${LETTERS[k]}`}
          className="rounded p-1 text-slate-400 hover:text-red-600"
          onClick={() =>
            setItem(i, {
              options: d.options.filter((_o, m) => m !== k),
              correct: d.correct
                .filter((x) => x !== LETTERS[k])
                .map((x) =>
                  LETTERS.indexOf(x) > k ? LETTERS[LETTERS.indexOf(x) - 1] : x,
                ),
            })
          }
        >
          <IconTrash className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const tabs: TabItem[] = [
    { id: "overview", label: tr("General Information") },
    {
      id: "items",
      label: checklist ? tr("Checklist Lines") : "Questions",
      count: items.length,
    },
    ...(isNew ? [] : [{ id: "audit", label: tr("Audit Trail") }]),
  ];
  const previewButton = (
    <Button
      size="sm"
      variant="outline-emerald"
      className="whitespace-nowrap"
      loading={previewing}
      disabled={!valid || busy}
      title={
        !valid
          ? tr("Complete the assessment name and every question or line to see the preview.")
          : tr("See the paper as it is printed")
      }
      onClick={() => void openPreview()}
    >
      {tr("Preview")}
    </Button>
  );
  const upgradeRevisionButton = caps?.upgradeRevision ? (
    <Button
      size="sm"
      variant="outline-emerald"
      className="whitespace-nowrap"
      loading={busy}
      disabled={previewing}
      onClick={() =>
        void run(
          () => trainingAssessmentsApi.upgradeRevision(detail!.id),
          "Revision upgraded",
        )
      }
    >
      {tr("Upgrade Revision")}
    </Button>
  ) : null;
  const headerExtra = (
    <>
      {previewButton}
      {upgradeRevisionButton}
    </>
  );
  const footer = (
    <>
      {previewButton}
      {editable && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          loading={busy}
          disabled={!dirty || !valid}
          title={
            !valid
              ? tr("Every question or line needs its text and its answers; a question needs points above zero.")
              : undefined
          }
          onClick={() =>
            void run(
              () =>
                isNew
                  ? trainingAssessmentsApi.create(body())
                  : trainingAssessmentsApi.update(detail!.id, body()),
              isNew ? tr("Draft created") : tr("Draft saved"),
            )
          }
        >
          {isNew ? tr("Create Draft") : tr("Save Draft")}
        </Button>
      )}
      {caps?.submit && (
        <Button
          size="sm"
          className="whitespace-nowrap"
          loading={busy}
          disabled={dirty}
          title={dirty ? tr("Save the draft first.") : undefined}
          onClick={() =>
            void run(
              () => trainingAssessmentsApi.submit(detail!.id),
              "Sent for approval",
            )
          }
        >
          {tr("Submit for Approval")}
        </Button>
      )}
      {caps?.approve && (
        <Button
          size="sm"
          className="whitespace-nowrap"
          onClick={() => setSigning(true)}
        >
          {tr("Complete Approval")}
        </Button>
      )}
      {caps?.returnToDraft && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() => {
            setReason("");
            setAsking("return");
          }}
        >
          {tr("Return to Draft")}
        </Button>
      )}
      {upgradeRevisionButton}
      {caps?.delete && (
        <Button
          size="sm"
          variant="destructive"
          className="whitespace-nowrap"
          onClick={() => {
            setReason("");
            setAsking("delete");
          }}
        >
          {tr("Delete Draft")}
        </Button>
      )}
    </>
  );

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={crumbs}
        onBack={() => confirmLeave(goBack)}
        workflow={detail ? detail.workflow : newWorkflow}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-assessment-detail-tab"
        footer={footer}
        headerExtra={headerExtra}
        afterFooter={
          tab === "overview" && !isNew && detail ? (
            <AssessmentRevisionsCard
              assessmentId={detail.id}
              signature={`${detail.status}:${detail.revisionNumber}:${detail.updatedAt}`}
            />
          ) : undefined
        }
      >
        {tab === "overview" && (
          <div className="space-y-6">
            {!isNew && detail?.approveBlocker && (
              <p
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                {tr("You cannot approve this assessment:")}{" "}
                {trainingCodeText(detail.approveBlocker)}
              </p>
            )}
            {!isNew && detail && (
              <ReadonlyGrid>
                <>
                  <ReadonlyField
                    label={tr("Assessment Number")}
                    value={detail.code}
                  />
                  <ReadonlyField
                    label={tr("Assessment Revision")}
                    value={detail.revisionNumber}
                  />
                  <ReadonlyField
                    label={tr("Status")}
                    value={
                      ASSESSMENT_STATUS_LABEL[detail.status] ?? detail.status
                    }
                  />
                  <ReadonlyField
                    label={tr("Created By")}
                    value={detail.createdByName}
                  />
                  <ReadonlyField
                    label={tr("Last Changed By")}
                    value={`${detail.updatedByName}, ${when(detail.updatedAt)}`}
                  />
                  {detail.submittedByName && detail.status !== "DRAFT" && (
                    <ReadonlyField
                      label={tr("Submitted By")}
                      value={detail.submittedByName}
                    />
                  )}
                  {detail.approvedAt && (
                    <ReadonlyField
                      label={tr("Approved By")}
                      value={`${detail.approvedByName}, ${when(detail.approvedAt)}`}
                    />
                  )}
                  <ReadonlyField
                    label={tr("Used By Activities")}
                    value={String(detail.usedByActivities)}
                  />
                </>
              </ReadonlyGrid>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {isNew && (
                <FormField
                  label={tr("Assessment Number")}
                  hint={tr("The system issues it when the draft is created, by the rule of Training Code Rules.")}
                >
                  <Input readOnly value="" placeholder={tr("Auto-generated after save")} />
                </FormField>
              )}
              <div className={isNew ? undefined : "md:col-span-2"}>
                <FormField
                  label={tr("Assessment Name")}
                  required
                  hint={tr("Only to recognise the assessment in the library. It is not written in the form.")}
                >
                  <Input
                    value={head.name}
                    maxLength={255}
                    disabled={!editable}
                    placeholder={tr("Kiểm tra đào tạo SOP.0006")}
                    onChange={(e) => {
                      setHead({ ...head, name: e.target.value });
                      setDirty(true);
                    }}
                  />
                </FormField>
              </div>
              <FormField label={tr("Type")} required>
                <Select
                  value={head.kind}
                  enableSearch={false}
                  disabled={!isNew}
                  onChange={(v) => {
                    setHead({ ...head, kind: v });
                    setItems([v === "CHECKLIST" ? blank(v) : { ...blank(v), points: String(wantedTotal) }]);
                    setAutoTotal(true);
                    setTotalText(null);
                    setDirty(true);
                  }}
                  options={Object.entries(ASSESSMENT_KIND_LABEL).map(
                    ([value, label]) => ({
                      value: value as AssessmentKind,
                      label,
                    }),
                  )}
                />
              </FormField>
              <FormField
                label={tr("Test duration (minutes)")}
                hint={tr("Written in the form as the test duration. Leave empty to write it by hand.")}
              >
                <Input
                  type="number"
                  min={1}
                  max={480}
                  step={1}
                  value={head.duration}
                  disabled={!editable}
                  aria-label={tr("Test duration")}
                  onChange={(e) => {
                    setHead({ ...head, duration: e.target.value });
                    setDirty(true);
                  }}
                />
              </FormField>
              {!checklist && (
                <FormField
                  label={tr("Numbering of the essay questions")}
                  hint={tr("In the form, Part II can go on after the last multiple-choice question or start again at question 1.")}
                >
                  <RadioGroup
                    label=""
                    name="essay-numbering"
                    layout="horizontal"
                    value={head.essayNumbering}
                    disabled={!editable}
                    onChange={(v) => {
                      setHead({
                        ...head,
                        essayNumbering:
                          v === "RESTART" ? "RESTART" : "CONTINUE",
                      });
                      setDirty(true);
                    }}
                    options={[
                      { label: tr("Continue the numbers"), value: "CONTINUE" },
                      { label: tr("Start again at 1"), value: "RESTART" },
                    ]}
                  />
                </FormField>
              )}
              {!checklist && (
                <FormField label={tr("Total Score")}>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.5"
                    value={totalShown}
                    disabled={!editable}
                    aria-label={tr("Total Score")}
                    onChange={(e) => setTotalText(e.target.value)}
                    onBlur={applyTotal}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyTotal();
                    }}
                  />
                </FormField>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {checklist
                ? tr("A checklist has no score: each line is ticked Correct or Incorrect, and the person passes only when every line is as the key says.")
                : tr("Changing the Total Score shares it among the questions, in proportion to their points (see the tab Questions); changing the points of a question changes the total. An essay is marked by hand on the paper and the total score is typed in the Results step.")}{" "}
              {tr("An effective version never changes: a change is a new version. An activity that uses it keeps its own copy.")}
            </p>
          </div>
        )}

        {tab === "items" && (
          <div
            className={
              wide
                ? "grid grid-cols-[minmax(0,1fr)_minmax(0,520px)] items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,620px)] min-[1800px]:grid-cols-[minmax(0,1fr)_minmax(0,720px)]"
                : "space-y-4"
            }
          >
            {!wide && (
              <TabNav
                tabs={[
                  { id: "edit", label: checklist ? tr("Checklist Lines") : "Questions" },
                  { id: "paper", label: "Paper" },
                ]}
                activeTab={pane}
                onChange={(id) => setPane(id === "paper" ? "paper" : "edit")}
                layoutId="training-assessment-items-pane"
                variant="simple-underline"
              />
            )}
            {(wide || pane === "edit") && (
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  {checklist
                    ? trFormat("Checklist lines ({count})", { count: items.length })
                    : trFormat("Questions ({count}, total {points})", { count: items.length, points: trPlural(Math.round(total * 100) / 100, "{count} point", "{count} points") })}
                </h3>
                {editable && firstIncomplete >= 0 && (
                  <button
                    type="button"
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    onClick={() => {
                      // a question that is folded opens first, so that what is missing can be seen
                      setCollapsed((previous) => {
                        const next = new Set(previous);
                        next.delete(items[firstIncomplete].id);
                        return next;
                      });
                      setTimeout(
                        () =>
                          document
                            .getElementById(`assessment-item-${firstIncomplete}`)
                            ?.scrollIntoView?.({ behavior: "smooth", block: "center" }),
                        0,
                      );
                    }}
                  >
                    <Badge color="amber">
                      {incomplete} {tr("not complete")}: {checklist ? "Line" : "Question"} {firstIncomplete + 1}
                    </Badge>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {items.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={() =>
                      setCollapsed(
                        collapsed.size < items.length
                          ? new Set(items.map((d) => d.id))
                          : new Set(),
                      )
                    }
                  >
                    {collapsed.size < items.length ? tr("Collapse all") : tr("Expand all")}
                  </Button>
                )}
                {editable && items.length < 200 ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setItems(shareEqually([...items, blank(head.kind)]));
                      setDirty(true);
                    }}
                  >
                    <IconPlus className="mr-1 h-4 w-4" />
                    {checklist ? tr("Add a Line") : tr("Add a Question")}
                  </Button>
                ) : undefined}
              </div>
            </div>
            <div>
              {editable ? (
                <DraggableReorderList
                  alignTop
                  items={items.map((d, i) => ({
                    id: d.id,
                    label: `${checklist ? "Line" : "Question"} ${i + 1}`,
                  }))}
                  onReorder={dragItems}
                  renderItem={(row) => {
                    const i = items.findIndex((d) => d.id === row.id);
                    return i < 0 ? null : renderItem(items[i], i);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  {items.map((d, i) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                    >
                      {renderItem(d, i)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            )}
            {(wide || pane === "paper") && (
              <aside className={wide ? "sticky top-4 min-w-0" : "min-w-0"} aria-label={tr("Paper")}>
                <AssessmentPaperPane
                  make={(paper) => makePaper(paper)}
                  ready={valid}
                  blockedReason="Complete the assessment name and every question or line to see the preview."
                  revision={edits}
                />
              </aside>
            )}
          </div>
        )}

        {tab === "audit" && detail && (
          <AuditTrailTab
            entityId={detail.id}
            entityType="TRAINING_ASSESSMENT"
          />
        )}
      </TrainingDetailLayout>

      {preview && (
        <AssessmentPreviewModal
          title={`Preview: ${head.name.trim() || "Training Assessment"}`}
          description={
            checklist
              ? tr("The checklist in the enabled form APD.0009, as an activity gets it; the answer key is for the trainer only and is never handed out.")
              : tr("The test in the enabled form APD.0009, as an activity gets it; the answer key is for the trainer only and is never handed out. The training topic is a sample line here; the name of each trainee, the Training Number and the date are written when it is printed for a session.")
          }
          firstUrl={preview.url}
          load={(paper) => makePaper(paper)}
          onClose={() => setPreview(undefined)}
        />
      )}
      <FormModal
        isOpen={!!asking}
        onClose={() => setAsking(undefined)}
        onConfirm={() => void answerReason()}
        title={asking === "return" ? tr("Return to Draft") : tr("Delete Draft")}
        description={
          asking === "return"
            ? tr("The assessment goes back to the designer, who can change it and send it again. The reason stays in the Audit Trail.")
            : tr("Only a draft can be deleted. The reason stays in the Audit Trail.")
        }
        confirmText={asking === "return" ? "Return" : "Delete"}
        confirmVariant={asking === "return" ? "default" : "destructive"}
        isLoading={busy}
        confirmDisabled={!reason.trim()}
        size="md"
      >
        <FormField label={tr("Reason")} required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </FormModal>
      <ESignatureModal
        isOpen={signing}
        onClose={() => setSigning(false)}
        onConfirm={async (data: { signatureToken: string }) => {
          const ok = await run(
            () =>
              trainingAssessmentsApi.approve(detail!.id, data.signatureToken),
            "Assessment approved",
          );
          if (ok) setSigning(false);
        }}
        actionTitle="Approve the training assessment"
        changes={statusChange(
          "Pending Approval",
          "Effective",
          "Training assessment",
        )}
        meaningDisplayName="Training Assessment Approved"
        meaningCode="TRAINING_ASSESSMENT_APPROVED"
        targetDetails={{
          code: detail?.code ?? "",
          title: head.name,
          revision: detail?.revisionNumber ?? "",
        }}
      />
      {leaveModal}
    </>
  );
}
