import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconPlus, IconTrash } from "@tabler/icons-react";
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
import { PdfPreviewModal } from "@/features/documents/shared/components/PdfPreviewModal";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import {
  trainingAssessmentsApi,
  trainingCodeText,
  trainingError,
  type AssessmentItemKind,
  type AssessmentKind,
  type TrainingAssessmentDetail,
  type TrainingAssessmentSave,
} from "@/services/api/trainingActivities";
import { Input, Textarea } from "../shared/TrainingFields";
import { statusChange, trainingBreadcrumbs, when } from "../shared/trainingLabels";
import { ReadonlyField, ReadonlyGrid, TrainingDetailLayout } from "../shared/TrainingDetailLayout";
import { useTrainingBack } from "../shared/useTrainingBack";
import { ASSESSMENT_KIND_LABEL, ASSESSMENT_STATUS_LABEL } from "./TrainingAssessmentListView";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const QUESTION_KIND_LABEL: Record<string, string> = { SINGLE: "One right answer", MULTI: "Several right answers", TRUE_FALSE: "True or false", ESSAY: "Essay (marked by hand)" };

/** A question or a line, and an answer, carry a key of their own so that dragging them in the list keeps each one's content and ticks. */
export interface Opt { key: string; text: string }
export interface Draft { id: string; kind: AssessmentItemKind; prompt: string; options: Opt[]; correct: string[]; points: string; modelAnswer: string }
let keySeed = 0;
const newKey = () => `k${++keySeed}`;
const opts = (texts: string[]): Opt[] => texts.map((text) => ({ key: newKey(), text }));
const blank = (kind: AssessmentKind): Draft =>
  kind === "CHECKLIST"
    ? { id: newKey(), kind: "CHECK", prompt: "", options: [], correct: ["CORRECT"], points: "1", modelAnswer: "" }
    : { id: newKey(), kind: "SINGLE", prompt: "", options: opts(["", ""]), correct: [], points: "1", modelAnswer: "" };

/** The answers of a question after a drag. The ticks follow their answers: the letters are those of the new order. */
export function reorderAnswers(d: Draft, next: Opt[]): Draft {
  const correct = d.correct.map((letter) => {
    const key = d.options[LETTERS.indexOf(letter)]?.key;
    const at = next.findIndex((o) => o.key === key);
    return at >= 0 ? LETTERS[at] : letter;
  });
  return { ...d, options: next, correct };
}

/** The same rules the server applies; the server refuses anything else with a stable code. A checklist line has no points. */
export const itemValid = (d: Draft) => {
  if (!d.prompt.trim()) return false;
  if (d.kind !== "CHECK") {
    const points = Number(d.points);
    if (!(points > 0) || points > 100) return false;
  }
  switch (d.kind) {
    case "SINGLE": return d.options.length >= 2 && d.options.every((o) => o.text.trim()) && d.correct.length === 1;
    case "MULTI": return d.options.length >= 2 && d.options.every((o) => o.text.trim()) && d.correct.length >= 1;
    case "TRUE_FALSE": return d.correct.length === 1;
    case "CHECK": return d.correct.length === 1;
    default: return true;
  }
};

/**
 * Sets the total score of a test and shares it among the questions in proportion to the points they have now (equally when they have none), in hundredths, so that the points add up to the total
 * exactly. Null when the total is too small to give every question at least one hundredth.
 */
export function distributePoints(items: Draft[], total: number): string[] | null {
  const cents = Math.round(total * 100);
  const n = items.length;
  if (!Number.isFinite(cents) || n === 0 || cents < n) return null;
  const old = items.map((d) => Math.max(Number(d.points) || 0, 0));
  const sum = old.reduce((a, b) => a + b, 0);
  const weights = sum > 0 ? old : old.map(() => 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const alloc = weights.map((w) => Math.max(1, Math.floor((cents * w) / weightSum)));
  let diff = cents - alloc.reduce((a, b) => a + b, 0);
  const order = weights.map((_w, i) => i).sort((a, b) => weights[b] - weights[a]);
  for (let guard = 0; diff !== 0 && guard < cents + n; guard++) {
    const i = order[guard % n];
    if (diff > 0) { alloc[i]++; diff--; } else if (alloc[i] > 1) { alloc[i]--; diff++; }
  }
  return diff === 0 ? alloc.map((c) => String(c / 100)) : null;
}

const STEPS = ["Draft", "Pending Approval", "Effective"];
const STEP_OF: Record<string, number> = { DRAFT: 0, PENDING_APPROVAL: 1, EFFECTIVE: 2, SUPERSEDED: 3 };

/** One Training Assessment of the library (APD.0009): a test of questions or a checklist. A draft is written here and sent for approval; another person signs it into Effective; a change is a new version. */
export function TrainingAssessmentDetailPage({ isNew = false }: { isNew?: boolean }) {
  const { assessmentId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = useTrainingBack("/training-management/assessments");
  const { showToast } = useToast();
  const [detail, setDetail] = useState<TrainingAssessmentDetail>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [head, setHead] = useState<{ title: string; kind: AssessmentKind }>({ title: "", kind: "QUESTIONS" });
  const [items, setItems] = useState<Draft[]>([blank("QUESTIONS")]);
  const [dirty, setDirty] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<"delete" | "return">();
  const [reason, setReason] = useState("");
  const [signing, setSigning] = useState(false);
  const [totalText, setTotalText] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; key: boolean }>();
  // The paper opened in the window is released with the window.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const apply = useCallback((d: TrainingAssessmentDetail) => {
    setDetail(d);
    setHead({ title: d.title, kind: d.kind });
    setItems(d.items.map((i) => ({ id: newKey(), kind: i.kind, prompt: i.prompt, options: i.kind === "TRUE_FALSE" ? [] : opts(i.options.map((o) => o.text)), correct: i.correct, points: String(i.points), modelAnswer: i.modelAnswer ?? "" })));
    setDirty(false);
    setTotalText(null);
  }, []);
  const refetch = useCallback(() => { trainingAssessmentsApi.get(assessmentId).then(apply).catch((e) => setError(trainingError(e))); }, [assessmentId, apply]);
  useEffect(() => { if (!isNew) refetch(); }, [isNew, refetch]);
  // A change made by someone else refreshes the page, but never over what is being typed.
  const typing = useRef(false);
  typing.current = dirty;
  useEntityChanged(["TRAINING"], () => { if (!typing.current && !isNew) refetch(); });

  const caps = detail?.capabilities;
  const editable = isNew || Boolean(caps?.edit);
  const checklist = head.kind === "CHECKLIST";
  const title = isNew ? "New Training Assessment" : "Training Assessment Details";
  const crumbs = trainingBreadcrumbs(navigate, "assessments", title);

  if (!isNew && !detail) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading…" />}
      </div>
    );
  }

  const setItem = (i: number, patch: Partial<Draft>) => { setItems((list) => list.map((d, k) => (k === i ? { ...d, ...patch } : d))); setDirty(true); };
  /** A drag of the questions or the lines: the list comes back in its new order (the rows are told apart by their key). */
  const dragItems = (next: { id: string }[]) => setItems(next.map((n) => items.find((d) => d.id === n.id) as Draft));
  const dragAnswers = (i: number, next: { id: string }[]) => {
    const d = items[i];
    setItem(i, reorderAnswers(d, next.map((n) => d.options.find((o) => o.key === n.id) as Opt)));
  };
  const total = items.reduce((sum, d) => sum + (Number(d.points) > 0 ? Number(d.points) : 0), 0);
  const totalShown = totalText ?? String(Math.round(total * 100) / 100);
  const applyTotal = () => {
    const wanted = Number(totalText);
    setTotalText(null);
    if (totalText == null || !Number.isFinite(wanted) || wanted <= 0) return;
    const shared = distributePoints(items, wanted);
    if (!shared) { showToast({ type: "error", title: "The total score was not changed", message: "Every question needs at least 0.01 point." }); return; }
    setItems(items.map((d, k) => ({ ...d, points: shared[k] })));
    setDirty(true);
  };
  const valid = head.title.trim().length > 0 && items.length > 0 && items.every(itemValid);
  const body = (): TrainingAssessmentSave => ({
    version: detail?.version,
    title: head.title.trim(),
    kind: head.kind,
    items: items.map((d) => ({
      kind: d.kind,
      prompt: d.prompt.trim(),
      options: d.kind === "SINGLE" || d.kind === "MULTI" ? d.options.map((o) => ({ text: o.text.trim() })) : [],
      correct: d.kind === "ESSAY" ? [] : d.correct,
      points: d.kind === "CHECK" ? 1 : Number(d.points),
      modelAnswer: d.kind === "ESSAY" && d.modelAnswer.trim() ? d.modelAnswer.trim() : undefined,
    })),
  });

  /** The paper drawn from what is in the editor now (saved or not), in the project PDF viewer; with the key it is the paper of the trainer. */
  const openPreview = async (key: boolean) => {
    setBusy(true);
    try {
      const { items: previewItems } = body();
      const blob = await trainingAssessmentsApi.preview({ title: head.title.trim(), kind: head.kind, items: previewItems, key, code: detail?.code, versionNo: detail?.versionNo });
      setPreview({ url: URL.createObjectURL(blob), key });
    } catch (e) {
      showToast({ type: "error", title: "The preview could not be made", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const run = async (action: () => Promise<TrainingAssessmentDetail>, done: string) => {
    setBusy(true);
    try {
      const next = await action();
      showToast({ type: "success", title: done, message: `${next.code} v${next.versionNo}` });
      if (isNew) navigate(`/training-management/assessments/${next.id}`, { replace: true });
      else apply(next);
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const answerReason = async () => {
    if (!detail || !asking) return;
    if (asking === "return") {
      if (await run(() => trainingAssessmentsApi.returnToDraft(detail.id, reason.trim()), "Returned to draft")) setAsking(undefined);
      return;
    }
    setBusy(true);
    try {
      await trainingAssessmentsApi.remove(detail.id, reason.trim());
      showToast({ type: "success", title: "Draft deleted", message: detail.code });
      navigate("/training-management/assessments", { replace: true });
    } catch (e) {
      showToast({ type: "error", title: "The draft was not deleted", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  /** One question or line, with its answers; the answers are dragged in their own list. */
  const renderItem = (d: Draft, i: number) => (
    <section className="space-y-3" aria-label={`${checklist ? "Line" : "Question"} ${i + 1}`}>
      <div className="flex h-9 items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{checklist ? "Line" : "Question"} {i + 1}</h4>
        {editable && items.length > 1 && <Button size="sm" variant="outline" onClick={() => { setItems(items.filter((_x, k) => k !== i)); setDirty(true); }}><IconTrash className="mr-1 h-4 w-4" />Remove</Button>}
      </div>
      {!checklist && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Select label="Kind" value={d.kind} enableSearch={false} disabled={!editable}
              onChange={(v) => setItem(i, { kind: v, correct: [], options: v === "SINGLE" || v === "MULTI" ? (d.options.length >= 2 ? d.options : opts(["", ""])) : [] })}
              options={Object.entries(QUESTION_KIND_LABEL).map(([value, label]) => ({ value: value as AssessmentItemKind, label }))} />
          </div>
          <FormField label="Points"><Input type="number" min={0.01} step="0.5" max={100} value={d.points} disabled={!editable} onChange={(e) => setItem(i, { points: e.target.value })} /></FormField>
        </div>
      )}
      <FormField label={checklist ? "Line to check" : "Question"} required><Textarea rows={2} maxLength={2000} value={d.prompt} disabled={!editable} onChange={(e) => setItem(i, { prompt: e.target.value })} /></FormField>
      {d.kind === "CHECK" && (
        <RadioGroup label="The key: what the person must tick" name={`check-${i}`} layout="horizontal" value={d.correct[0] ?? ""} disabled={!editable} onChange={(v) => setItem(i, { correct: [String(v)] })}
          options={[{ label: "Correct (Đúng)", value: "CORRECT" }, { label: "Incorrect (Không đúng)", value: "INCORRECT" }]} />
      )}
      {d.kind === "TRUE_FALSE" && (
        <RadioGroup label="The right answer" name={`tf-${i}`} layout="horizontal" value={d.correct[0] ?? ""} disabled={!editable} onChange={(v) => setItem(i, { correct: [String(v)] })} options={[{ label: "True", value: "A" }, { label: "False", value: "B" }]} />
      )}
      {(d.kind === "SINGLE" || d.kind === "MULTI") && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-700">Answers (tick the right {d.kind === "SINGLE" ? "one" : "ones"})</div>
          {editable ? (
            <DraggableReorderList
              plain
              items={d.options.map((o, k) => ({ id: o.key, label: `answer ${LETTERS[k]}` }))}
              onReorder={(next) => dragAnswers(i, next)}
              renderItem={(row) => {
                const k = d.options.findIndex((o) => o.key === row.id);
                return k < 0 ? null : answerRow(d, i, k);
              }}
            />
          ) : (
            <div className="space-y-2">{d.options.map((o, k) => <div key={o.key}>{answerRow(d, i, k)}</div>)}</div>
          )}
          {editable && d.options.length < LETTERS.length && <Button size="sm" variant="default" onClick={() => setItem(i, { options: [...d.options, { key: newKey(), text: "" }] })}><IconPlus className="mr-1 h-4 w-4" />Add an answer</Button>}
        </div>
      )}
      {d.kind === "ESSAY" && (
        <FormField label="Model answer or marking guide (for the trainer only, never printed for the trainees)"><Textarea rows={3} maxLength={4000} value={d.modelAnswer} disabled={!editable} onChange={(e) => setItem(i, { modelAnswer: e.target.value })} /></FormField>
      )}
      {editable && !itemValid(d) && <div><Badge color="amber">Not complete</Badge></div>}
    </section>
  );
  const answerRow = (d: Draft, i: number, k: number) => (
    <div className="flex items-center gap-2">
      <Checkbox checked={d.correct.includes(LETTERS[k])} disabled={!editable} aria-label={`Answer ${LETTERS[k]} is right`}
        onChange={(c) => setItem(i, { correct: d.kind === "SINGLE" ? (c ? [LETTERS[k]] : []) : c ? [...d.correct, LETTERS[k]] : d.correct.filter((x) => x !== LETTERS[k]) })} />
      <span className="w-5 text-sm text-slate-500">{LETTERS[k]}.</span>
      <Input value={d.options[k].text} maxLength={500} aria-label={`Answer ${LETTERS[k]}`} disabled={!editable} onChange={(e) => setItem(i, { options: d.options.map((o, m) => (m === k ? { ...o, text: e.target.value } : o)) })} />
      {editable && d.options.length > 2 && (
        <button type="button" aria-label={`Remove answer ${LETTERS[k]}`} className="rounded p-1 text-slate-400 hover:text-red-600"
          onClick={() => setItem(i, { options: d.options.filter((_o, m) => m !== k), correct: d.correct.filter((x) => x !== LETTERS[k]).map((x) => (LETTERS.indexOf(x) > k ? LETTERS[LETTERS.indexOf(x) - 1] : x)) })}>
          <IconTrash className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const tabs: TabItem[] = [{ id: "overview", label: "General Information" }, { id: "items", label: checklist ? "Checklist Lines" : "Questions", count: items.length }, ...(isNew ? [] : [{ id: "audit", label: "Audit Trail" }])];
  const superseded = detail?.status === "SUPERSEDED";
  const steps = superseded ? [...STEPS, "Replaced"] : STEPS;
  const stepIndex = detail ? (STEP_OF[detail.status] ?? 0) : 0;
  const footer = (
    <>
      <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} disabled={!valid} title={!valid ? "Complete the title and every question or line to see the preview." : "See the paper as it is printed"} onClick={() => void openPreview(false)}>Preview</Button>
      {editable && (
        <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} disabled={!dirty || !valid}
          title={!valid ? "Every question or line needs its text and its answers; a question needs points above zero." : undefined}
          onClick={() => void run(() => (isNew ? trainingAssessmentsApi.create(body()) : trainingAssessmentsApi.update(detail!.id, body())), isNew ? "Draft created" : "Draft saved")}>
          {isNew ? "Create draft" : "Save draft"}
        </Button>
      )}
      {caps?.submit && <Button size="sm" className="whitespace-nowrap" loading={busy} disabled={dirty} title={dirty ? "Save the draft first." : undefined} onClick={() => void run(() => trainingAssessmentsApi.submit(detail!.id), "Sent for approval")}>Submit for Approval</Button>}
      {caps?.approve && <Button size="sm" className="whitespace-nowrap" onClick={() => setSigning(true)}>Approve</Button>}
      {caps?.returnToDraft && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => { setReason(""); setAsking("return"); }}>Return to Draft</Button>}
      {caps?.newVersion && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} onClick={() => void run(() => trainingAssessmentsApi.newVersion(detail!.id), "New version created")}>New Version</Button>}
      {caps?.delete && <Button size="sm" variant="destructive" className="whitespace-nowrap" onClick={() => { setReason(""); setAsking("delete"); }}>Delete Draft</Button>}
    </>
  );

  return (
    <>
      <TrainingDetailLayout title={title} breadcrumbItems={crumbs} onBack={goBack} steps={steps} currentStepIndex={stepIndex} terminalProgressStep="Draft" tabs={tabs} activeTab={tab} onTab={setTab} tabLayoutId="training-assessment-detail-tab" footer={footer}>
        {tab === "overview" && (
          <div className="space-y-6">
            {!isNew && detail?.approveBlocker && (
              <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">You cannot approve this assessment: {trainingCodeText(detail.approveBlocker)}</p>
            )}
            {!isNew && detail && (
            <ReadonlyGrid>
                <>
                  <ReadonlyField label="Code" value={`${detail.code} v${detail.versionNo}`} />
                  <ReadonlyField label="Status" value={ASSESSMENT_STATUS_LABEL[detail.status] ?? detail.status} />
                  <ReadonlyField label="Created By" value={detail.createdByName} />
                  <ReadonlyField label="Last Changed By" value={`${detail.updatedByName}, ${when(detail.updatedAt)}`} />
                  {detail.submittedByName && detail.status !== "DRAFT" && <ReadonlyField label="Submitted By" value={detail.submittedByName} />}
                  {detail.approvedAt && <ReadonlyField label="Approved By" value={`${detail.approvedByName}, ${when(detail.approvedAt)}`} />}
                  <ReadonlyField label="Used By Activities" value={String(detail.usedByActivities)} />
                </>
            </ReadonlyGrid>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <div className="md:col-span-2">
                <FormField label="Title" required hint="Only to recognise the assessment in the library. It is not written in the form."><Input value={head.title} maxLength={255} disabled={!editable} placeholder="Kiểm tra đào tạo SOP.0006" onChange={(e) => { setHead({ ...head, title: e.target.value }); setDirty(true); }} /></FormField>
              </div>
              <FormField label="Type" required>
                <Select
                  value={head.kind}
                  enableSearch={false}
                  disabled={!isNew}
                  onChange={(v) => { setHead({ ...head, kind: v }); setItems([blank(v)]); setTotalText(null); setDirty(true); }}
                  options={Object.entries(ASSESSMENT_KIND_LABEL).map(([value, label]) => ({ value: value as AssessmentKind, label }))}
                />
              </FormField>
              {!checklist && (
                <FormField label="Total Score">
                  <Input type="number" min={0.01} step="0.5" value={totalShown} disabled={!editable} aria-label="Total Score"
                    onChange={(e) => setTotalText(e.target.value)} onBlur={applyTotal} onKeyDown={(e) => { if (e.key === "Enter") applyTotal(); }} />
                </FormField>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {checklist
                ? "A checklist has no score: each line is ticked Correct or Incorrect, and the person passes only when every line is as the key says."
                : "Changing the Total Score shares it among the questions, in proportion to their points (see the tab Questions); changing the points of a question changes the total. An essay is marked by hand on the paper and the total score is typed in the Results step."}
              {" "}An effective version never changes: a change is a new version. An activity that uses it keeps its own copy.
            </p>
          </div>
        )}

        {tab === "items" && (
          <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{checklist ? `Checklist lines (${items.length})` : `Questions (${items.length}, total ${Math.round(total * 100) / 100} point${total === 1 ? "" : "s"})`}</h3>
            {editable && items.length < 200 ? <Button size="sm" variant="default" onClick={() => { setItems([...items, blank(head.kind)]); setDirty(true); }}><IconPlus className="mr-1 h-4 w-4" />{checklist ? "Add a line" : "Add a question"}</Button> : undefined}
          </div>
            <div>
              {editable ? (
                <DraggableReorderList
                  alignTop
                  items={items.map((d, i) => ({ id: d.id, label: `${checklist ? "Line" : "Question"} ${i + 1}` }))}
                  onReorder={dragItems}
                  renderItem={(row) => {
                    const i = items.findIndex((d) => d.id === row.id);
                    return i < 0 ? null : renderItem(items[i], i);
                  }}
                />
              ) : (
                <div className="space-y-2">{items.map((d, i) => <div key={d.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">{renderItem(d, i)}</div>)}</div>
              )}
            </div>
          </div>
        )}

        {tab === "audit" && detail && <AuditTrailTab entityId={detail.id} entityType="TRAINING_ASSESSMENT" />}
      </TrainingDetailLayout>

      {preview && (
        <PdfPreviewModal
          title={preview.key ? "Preview: answer key" : "Preview: test paper"}
          description={preview.key ? "For the trainer only: the right answers are marked. It is never handed out." : "The content in the enabled form APD.0009, as an activity gets it. The training topic is a sample line here; the name of each trainee, the Training Number and the date are on the cover page when it is printed for a session."}
          fileUrl={preview.url}
          onClose={() => setPreview(undefined)}
          footerExtra={<Button size="sm" variant="outline" loading={busy} onClick={() => void openPreview(!preview.key)}>{preview.key ? "Show the test paper" : "Show the answer key"}</Button>}
        />
      )}
      <FormModal
        isOpen={!!asking}
        onClose={() => setAsking(undefined)}
        onConfirm={() => void answerReason()}
        title={asking === "return" ? "Return to Draft" : "Delete Draft"}
        description={asking === "return" ? "The assessment goes back to the designer, who can change it and send it again. The reason stays in the Audit Trail." : "Only a draft can be deleted. The reason stays in the Audit Trail."}
        confirmText={asking === "return" ? "Return" : "Delete"}
        confirmVariant={asking === "return" ? "default" : "destructive"}
        isLoading={busy}
        confirmDisabled={!reason.trim()}
        size="md"
      >
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </FormModal>
      <ESignatureModal
        isOpen={signing}
        onClose={() => setSigning(false)}
        onConfirm={async (data: { signatureToken: string }) => {
          const ok = await run(() => trainingAssessmentsApi.approve(detail!.id, data.signatureToken), "Assessment approved");
          if (ok) setSigning(false);
        }}
        actionTitle="Approve the training assessment"
        changes={statusChange("Pending Approval", "Effective", "Training assessment")}
        meaningDisplayName="Training Assessment Approved"
        meaningCode="TRAINING_ASSESSMENT_APPROVED"
        targetDetails={{ code: detail ? `${detail.code} v${detail.versionNo}` : "", title: head.title, revision: "" }}
      />
    </>
  );
}
