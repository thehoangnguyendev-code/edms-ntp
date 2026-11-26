import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../shared/TrainingFields";
import { TrainingMonthField } from "../shared/TrainingDateField";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { useToast } from "@/components/ui/toast/Toast";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { SignaturesTab } from "@/features/documents/document-detail/tabs/SignaturesTab";
import { documentApi } from "@/services/api/documents";
import {
  trainingError, trainingFormsApi, trainingMatrixApi, trainingRequirementsApi, type TrainingPerson, type TrainingRequirementDetail, type TrainingRequirementLine, type TrainingSuggestion, type TrainingTopic,
} from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs, when, statusChange, STATUS_LABEL, STATUS_COLOR } from "../shared/trainingLabels";
import { FormDownloadButtons } from "../shared/FormDownloadButtons";
import { ReadonlyField, ReadonlyGrid, TrainingDetailLayout } from "../shared/TrainingDetailLayout";
import { TrainingCopiesPanel } from "../shared/TrainingCopiesPanel";
import { REQUIREMENT_STATUS_LABEL } from "./TrainingRequirementListView";
import { useTrainingBack } from "../shared/useTrainingBack";
import { tr, trFormat, getCatalogLanguage } from "@/i18n";

const LINE_LABEL: Record<string, string> = { PLANNED: "Planned", POSTPONED: "Postponed", IN_PROGRESS: "In Progress", DONE: "Done", OVERDUE: "Overdue" };
const LINE_COLOR: Record<string, "blue" | "amber" | "emerald" | "red"> = { PLANNED: "blue", POSTPONED: "amber", IN_PROGRESS: "amber", DONE: "emerald", OVERDUE: "red" };
/** Once an activity is opened for the line, the line shows the status of that activity (the same words as its own page); before that, the status of the plan itself. */
export function LineStatus({ line }: { line: { lineStatus: string; activityId?: string | null; activityStatus?: string | null } }) {
  const activity = line.activityId && line.activityStatus && line.activityStatus !== "CANCELLED" ? line.activityStatus : null;
  if (activity) return <Badge color={STATUS_COLOR[activity] ?? "slate"}>{STATUS_LABEL[activity] ?? activity}</Badge>;
  return <Badge color={LINE_COLOR[line.lineStatus]}>{LINE_LABEL[line.lineStatus]}</Badge>;
}
/** A month as MM/yyyy (the planned month of a line). */
const monthText = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;
/** The month right after a month (yyyy-MM-dd), as MM/yyyy. */
const nextMonthText = (value: string) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return `${String(month % 12 + 1).padStart(2, "0")}/${month === 12 ? year + 1 : year}`;
};


type DraftLine = { plannedMonth: string; topicText?: string | null; documentId?: string | null; title: string; code?: string | null };
type Dialog = "addTopic" | "addDocument" | "submit" | "review" | "reject" | { postpone: string } | { qa: string } | undefined;
/** The toast of a done action: a title and one sentence with the number of the requirement, never an empty body. */
const doneNotice = (title: string, template: string) => (r: TrainingRequirementDetail) => ({ title: tr(title), message: trFormat(template, { number: r.requestNo }) });
interface SignRequest { title: string; message: string; code: string; name: string; changes: ReturnType<typeof statusChange>; run: (token: string) => Promise<TrainingRequirementDetail> }

export type RequirementMode = "view" | "edit" | "review" | "approve" | "track";
const MODE_TITLE: Record<RequirementMode, string> = { view: "Training Requirement Details", edit: "Edit Training Requirement", review: "Review Training Requirement", approve: "Approve Training Requirement", track: "Follow Training Requirement" };
/** What each screen may do. Details only shows; the server still decides every action. */
const MODE_CAPS: Record<RequirementMode, string[]> = { view: [], edit: ["edit", "submit"], review: ["review", "reject"], approve: ["approve", "reject"], track: ["postpone", "openActivity", "qaSign"] };
const limitCaps = (raw: TrainingRequirementDetail["capabilities"], mode: RequirementMode) => {
  const allowed = new Set(MODE_CAPS[mode]);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, allowed.has(k) && v])) as TrainingRequirementDetail["capabilities"];
};

/** One training requirement: the lines (a month and a topic or document), the three signatures, and what was done after approval. */
export function TrainingRequirementDetailPage({ mode = "view" }: { mode?: RequirementMode }) {
  const { requirementId = "" } = useParams();
  const goBack = useTrainingBack("/training-management/requirements");
  const { showToast } = useToast();
  const [req, setReq] = useState<TrainingRequirementDetail>();
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(mode === "edit" || mode === "track" ? "lines" : "overview");
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);
  const [qaComment, setQaComment] = useState("");

  const apply = useCallback((r: TrainingRequirementDetail) => {
    setReq(r);
    setLines(r.lines.map((l) => ({ plannedMonth: l.plannedMonth.slice(0, 10), topicText: l.topicText, documentId: l.documentId, title: l.title, code: l.code })));
    setDirty(false);
  }, []);
  const refetch = useCallback(() => { trainingRequirementsApi.get(requirementId).then(apply).catch((e) => setError(trainingError(e))); }, [requirementId, apply]);
  useEffect(refetch, [refetch]);
  // A change made by someone else refreshes the screen, but never over what the person is typing.
  const editing = useRef(false);
  editing.current = dirty;
  useEntityChanged(["TRAINING"], () => { if (!editing.current) refetch(); });

  const run = async (action: () => Promise<TrainingRequirementDetail>, done: (result: TrainingRequirementDetail) => { title: string; message: string }) => {
    setBusy(true);
    try {
      const result = await action();
      apply(result);
      const notice = done(result);
      showToast({ type: "success", title: notice.title, message: notice.message });
      setDialog(undefined);
      return true;
    } catch (e) {
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const title = MODE_TITLE[mode];
  // Leaving with lines that were not saved asks first (Back, the breadcrumb, a link, the sidebar, a reload).
  const { go, confirmLeave, modal: leaveModal } = useLeaveGuard(dirty, title, "the previous page");
  const crumbs = trainingBreadcrumbs(go, "requirements", title);
  const tabs: TabItem[] = [{ id: "overview", label: tr("General Information") }, { id: "lines", label: "Lines", count: req?.lines.length }, { id: "signatures", label: tr("Signatures") }, { id: "audit", label: tr("Audit Trail") }];

  const lineColumns: DataTableColumn<TrainingRequirementLine>[] = useMemo(() => {
    if (!req) return [];
    const caps = limitCaps(req.capabilities, mode);
    return [
      { id: "no", header: "No.", cell: (l) => l.lineNo },
      { id: "month", header: tr("Planned month"), cell: (l) => (
        <div className="whitespace-normal">
              {l.postponedFrom ? <div className="text-xs text-slate-500">{tr("Approved month:")} {monthText(l.postponedFrom)}</div> : null}
          <div>{l.postponedFrom ? "Current month: " : ""}{monthText(l.plannedMonth)}</div>
              {l.postponedFrom ? <div className="text-xs text-amber-700">{tr("Postponed:")} {l.postponeReason}</div> : null}
          {l.beyondSopWindow ? <Badge color="amber">{tr("Beyond SOP window")}</Badge> : null}
        </div>
      ) },
      { id: "title", header: tr("Training Topic or SOP"), cell: (l) => <div className="max-w-80 whitespace-normal">{l.code ? `${l.code} — ` : ""}{l.title}</div> },
      { id: "activity", header: tr("Training Number"), cell: (l) => (l.activityId ? <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => go(`/training-management/activities/${l.activityId}`)}>{l.trainingNumber}</button> : "—") },
      { id: "status", header: "Status", cell: (l) => <LineStatus line={l} /> },
      { id: "qa", header: "QA", cell: (l) => (l.qaSignedAt ? <div className="max-w-60 whitespace-normal">{l.qaSignedByName} ({day(l.qaSignedAt)}){l.qaComment ? `: ${l.qaComment}` : ""}</div> : "—") },
      {
        id: "actions",
        header: "Action",
        cell: (l) => (
          <div className="flex flex-wrap gap-2">
            {caps.openActivity && (!l.activityId || l.activityStatus === "CANCELLED") && <Button size="sm" onClick={() => void run(() => trainingRequirementsApi.openActivity(l.id), (result) => {
              const opened = result.lines.find((x) => x.id === l.id);
              return {
                title: tr("Training opened"),
                message: trFormat("Training {number} was opened for {topic}, due at the end of {month}. Continue in Training Activities.", { number: opened?.trainingNumber ?? "", topic: `${l.code ? `${l.code} — ` : ""}${l.title}`, month: monthText(l.plannedMonth) }),
              };
            })}>{tr("Open training")}</Button>}
            {caps.postpone && !l.postponedFrom && (!l.activityId || l.activityStatus === "CANCELLED") && l.lineStatus !== "DONE" && <Button size="sm" onClick={() => setDialog({ postpone: l.id })}>{tr("Postpone")}</Button>}
            {caps.qaSign && l.activityStatus === "COMPLETED" && !l.qaSignedAt && <Button size="sm" onClick={() => { setQaComment(""); setDialog({ qa: l.id }); }}>{tr("QA sign")}</Button>}
          </div>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req, mode, getCatalogLanguage()]);

  if (!req) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading…" />}
      </div>
    );
  }
  const caps = limitCaps(req.capabilities, mode);
  const body = () => ({ version: req.version, lines: lines.map((l) => ({ plannedMonth: l.plannedMonth, topicText: l.topicText ?? null, documentId: l.documentId ?? null })) });
  // Each pair is filled by the server only when the signed action succeeded: the preparer when the requirement is sent for review, then the reviewer, then the approver.
  const signatureRecords = [
    { actionBy: "Prepared By", actionByName: req.preparedAt && req.status !== "DRAFT" ? req.preparedByName ?? "" : "", actionOn: "Prepared On (Date - Time)", actionOnValue: req.preparedAt && req.status !== "DRAFT" ? req.preparedAt : "" },
    { actionBy: "Reviewed By", actionByName: req.reviewedAt ? req.reviewedByName ?? "" : "", actionOn: "Reviewed On (Date - Time)", actionOnValue: req.reviewedAt ?? "" },
    { actionBy: "Approved By", actionByName: req.approvedAt ? req.approvedByName ?? "" : "", actionOn: "Approved On (Date - Time)", actionOnValue: req.approvedAt ?? "" },
  ];
  const postponing = typeof dialog === "object" && "postpone" in dialog ? req.lines.find((x) => x.id === dialog.postpone) : undefined;
  const postponeHelp = postponing
    ? trFormat("The line moves from {from} to {to}, the month right after the registered one (SOP.0003 5.3.6). It cannot be moved further or a second time.", { from: monthText(postponing.plannedMonth), to: nextMonthText(postponing.plannedMonth) })
    : "";
  const pending = req.approvers.filter((a) => a.status === "PENDING").map((a) => a.assigneeName).join(", ");
  const editLineColumns: DataTableColumn<DraftLine>[] = [
    { id: "no", header: "No.", locked: true, cell: (_l, i) => i + 1 },
    { id: "month", header: tr("Planned month"), cell: (l, i) => (
      <div className="w-44">
        <TrainingMonthField
          value={l.plannedMonth}
          min={`${req.year}-01`}
          max={`${req.year}-12`}
          onChange={(next) => { if (!next) return; setLines(lines.map((x, k) => (k === i ? { ...x, plannedMonth: next } : x))); setDirty(true); }}
        />
      </div>
    ) },
    { id: "title", header: tr("Training Topic or SOP"), cell: (l) => <div className="max-w-xl whitespace-normal">{l.code ? `${l.code} — ` : ""}{l.title}</div> },
  ];

  const footer = (
    <>
      {caps.edit && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} disabled={!dirty} onClick={() => void run(() => trainingRequirementsApi.save(req.id, body()), doneNotice("Draft saved", "The lines of requirement {number} were saved. Send it for review when it is ready."))}>{tr("Save draft")}</Button>}
      {caps.submit && <Button size="sm" variant="default" className="whitespace-nowrap" disabled={dirty || lines.length === 0} onClick={() => setDialog("submit")}>{tr("Send for review")}</Button>}
      {caps.review && <Button size="sm" variant="default" className="whitespace-nowrap" onClick={() => setDialog("review")}>{tr("Review")}</Button>}
      {caps.approve && <Button size="sm" variant="default" className="whitespace-nowrap" onClick={() => setSign({ title: tr("Complete Approval of the Requirement"), message: "Requirement {number} was approved. Its lines can now be opened as trainings.", code: "TRAINING_REQUIREMENT_APPROVED", name: "Training Requirement Approved", changes: statusChange("Pending Approval", "Approved"), run: (t) => trainingRequirementsApi.approve(req.id, req.version, t) })}>{tr("Complete Approval")}</Button>}
      {req.status === "APPROVED" && (
        <FormDownloadButtons label={tr("The requirement")} load={(format) => trainingFormsApi.requirement(req.id, format)} fileName={(format) => `${req.requestNo.replace(/\//g, "-")}-APD.0118.${format}`} />
      )}
      {caps.reject && <Button size="sm" variant="destructive" className="whitespace-nowrap" onClick={() => setDialog("reject")}>{tr("Reject")}</Button>}
    </>
  );

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={crumbs}
        onBack={() => confirmLeave(goBack)}
        workflow={req.workflow}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-requirement-detail-tab"
        footer={footer}
        repeatFooterInHeader
        afterFooter={tab === "overview" && req.status === "APPROVED" ? <TrainingCopiesPanel type="requirement" objectId={req.id} /> : undefined}
      >
        {tab === "overview" && (
          <ReadonlyGrid>
            <ReadonlyField label={tr("Request Number")} value={req.requestNo} />
            <ReadonlyField label={tr("Status")} value={tr(REQUIREMENT_STATUS_LABEL[req.status])} />
            <ReadonlyField label={tr("Created Time")} value={when(req.createdAt)} />
            <ReadonlyField label={tr("Opened By")} value={req.createdByName} />
            <ReadonlyField label={tr("Year")} value={String(req.year)} />
            <ReadonlyField label={tr("Department")} value={req.departmentName} />
            <ReadonlyField label={tr("Due By")} value={day(req.dueBy)} />
            {pending && <ReadonlyField label={tr("Pending With")} value={pending} wide />}
            {req.rejectReason && req.status === "DRAFT" && <ReadonlyField label={tr("Last rejection")} value={req.rejectReason} wide />}
          </ReadonlyGrid>
        )}
        {tab === "lines" && (caps.edit ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="outline-emerald" onClick={() => setDialog("addTopic")}>{tr("Add Topic")}</Button>
              <Button size="sm" variant="outline-emerald" onClick={() => setDialog("addDocument")}>{tr("Add SOP")}</Button>
            </div>
            <DataTable
              rows={lines}
              getRowKey={(l, i) => `${i}|${l.topicText ?? l.documentId}`}
              columns={editLineColumns}
              action={{
                header: tr("Action"),
                cell: (_l, i) => <Button size="sm" variant="destructive" onClick={() => { setLines(lines.filter((_x, k) => k !== i)); setDirty(true); }}>{tr("Remove")}</Button>,
              }}
              emptyState={<p className="p-6 text-center text-sm text-slate-500">{tr("No line yet. Add a Training Topic or a SOP, or take the annual topics of the matrix.")}</p>}
            />
          </div>
        ) : (
          <DataTable rows={req.lines} getRowKey={(l) => l.id} columns={lineColumns} emptyState={<p className="p-6 text-center text-sm text-slate-500">{tr("No line.")}</p>} />
        ))}
        {tab === "signatures" && <SignaturesTab records={signatureRecords} />}
        {tab === "audit" && <AuditTrailTab entityId={req.id} entityType="TRAINING_REQUIREMENT" />}
      </TrainingDetailLayout>

      {(dialog === "addTopic") && <AddTopicDialog year={req.year} lines={lines} onClose={() => setDialog(undefined)} onAdd={(l) => { setLines([...lines, l]); setDirty(true); setDialog(undefined); }} requirementId={req.id} departmentId={req.departmentId} />}
      {dialog === "addDocument" && <AddDocumentDialog year={req.year} onClose={() => setDialog(undefined)} onAdd={(l) => { setLines([...lines, l]); setDirty(true); setDialog(undefined); }} />}
      {(dialog === "submit" || dialog === "review") && (
        <NextPersonDialog requirementId={req.id} step={dialog === "submit" ? "REQUIREMENT_REVIEW" : "REQUIREMENT_APPROVE"} busy={busy} onClose={() => setDialog(undefined)}
          onPick={(personId) => {
            setDialog(undefined);
            if (dialog === "submit") setSign({ title: tr("Send Requirement for Review"), message: "Requirement {number} was sent for review.", code: "TRAINING_REQUIREMENT_PREPARED", name: "Training Requirement Prepared", changes: statusChange("Draft", "Pending Review"), run: (t) => trainingRequirementsApi.submit(req.id, req.version, t, personId) });
            else setSign({ title: tr("Review Requirement"), message: "Requirement {number} was reviewed and sent for approval.", code: "TRAINING_REQUIREMENT_REVIEWED", name: "Training Requirement Reviewed", changes: statusChange("Pending Review", "Pending Approval"), run: (t) => trainingRequirementsApi.review(req.id, req.version, t, personId) });
          }} />
      )}
      <ReasonDialog open={dialog === "reject"} title={tr("Reject Requirement")} help={tr("It goes back to draft with your reason.")} confirmText="Reject" destructive busy={busy} onClose={() => setDialog(undefined)} onSave={(reason) => run(() => trainingRequirementsApi.reject(req.id, req.version, reason), doneNotice("Sent back to draft", "Requirement {number} went back to draft with your reason."))} />
      <ReasonDialog open={typeof dialog === "object" && "postpone" in dialog} title={tr("Postpone to the Next Month")} help={postponeHelp} confirmText="Postpone" busy={busy} onClose={() => setDialog(undefined)}
        onSave={(reason) => { const lineId = (dialog as { postpone: string }).postpone; return run(() => trainingRequirementsApi.postpone(lineId, reason), (r) => {
          const moved = r.lines.find((x) => x.id === lineId);
          return { title: tr("Line postponed"), message: trFormat("The line moved from {from} to {to}. The old month and the reason stay on the line.", { from: moved?.postponedFrom ? monthText(moved.postponedFrom) : "", to: moved ? monthText(moved.plannedMonth) : "" }) };
        }); }} />
      <FormModal isOpen={typeof dialog === "object" && "qa" in dialog} onClose={() => setDialog(undefined)} title={tr("QA Signature for the Line")} description={tr("The training of this line is completed. Your signature confirms it.")} confirmText={tr("Continue to Signature")} size="md"
        onConfirm={() => { const lineId = (dialog as { qa: string }).qa; setDialog(undefined); setSign({ title: tr("Sign the Line"), message: "The line of requirement {number} was signed by QA.", code: "TRAINING_COMPLETED", name: "Training Completed", changes: statusChange("Not signed by QA", "Signed by QA", "QA signature of the line"), run: (t) => trainingRequirementsApi.qaSign(lineId, t, qaComment.trim() || undefined) }); }}>
        <FormField label={tr("Comment")}><Textarea rows={3} value={qaComment} onChange={(e) => setQaComment(e.target.value)} /></FormField>
      </FormModal>
      <ESignatureModal isOpen={!!sign} onClose={() => setSign(undefined)} onConfirm={async (d: { signatureToken: string }) => { if (sign) { const ok = await run(() => sign.run(d.signatureToken), (r) => ({ title: sign.title, message: trFormat(sign.message, { number: r.requestNo }) })); if (ok) setSign(undefined); } }}
        actionTitle={sign?.title} changes={sign?.changes} meaningDisplayName={sign?.name} meaningCode={sign?.code} targetDetails={{ code: req.requestNo, title: `Training requirement ${req.year}`, revision: "" }} />
      {leaveModal}
    </>
  );
}

function ReasonDialog({ open, title, help, confirmText, destructive, busy, onClose, onSave }: { open: boolean; title: string; help: string; confirmText: string; destructive?: boolean; busy: boolean; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen={open} onClose={onClose} onConfirm={() => onSave(reason.trim())} title={title} description={help} confirmText={confirmText} confirmVariant={destructive ? "destructive" : "default"} isLoading={busy} confirmDisabled={!reason.trim()} size="md">
      <FormField label={tr("Reason")} required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
    </FormModal>
  );
}

function NextPersonDialog({ requirementId, step, busy, onClose, onPick }: { requirementId: string; step: "REQUIREMENT_REVIEW" | "REQUIREMENT_APPROVE"; busy: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState("");
  const search = useCallback(async (query: string) => {
    const page = await trainingRequirementsApi.eligibleApprovers(requirementId, step, query);
    setPeople(page.data);
    setLoaded(true);
    return page.data.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }));
  }, [requirementId, step]);
  useEffect(() => { void search(""); }, [search]);
  const review = step === "REQUIREMENT_REVIEW";
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onPick(id)} title={review ? tr("Choose who reviews") : tr("Choose who approves")}
      description={review ? tr("The reviewer is not you. Only people the system found eligible are listed.") : tr("The approver is neither the preparer nor you.")} confirmText={tr("Continue to Signature")} isLoading={busy} confirmDisabled={!id} size="md">
      {loaded && people.length === 0 ? <p className="text-sm text-amber-700">{tr("No eligible person was found.")}</p> : <Select label={tr("Person")} value={id} onChange={setId} options={people.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} onSearch={search} placeholder={tr("Search by name")} />}
    </FormModal>
  );
}

function AddTopicDialog({ year, lines, requirementId, departmentId, onClose, onAdd }: { year: number; lines: DraftLine[]; requirementId: string; departmentId: string; onClose: () => void; onAdd: (l: DraftLine) => void }) {
  const [suggestions, setSuggestions] = useState<TrainingSuggestion[]>([]);
  const [text, setText] = useState("");
  const [month, setMonth] = useState(`${year}-01-01`);
  useEffect(() => {
    trainingRequirementsApi.suggestions(year, departmentId).then(setSuggestions).catch(() => setSuggestions([]));
  }, [year, departmentId, requirementId]);
  const clean = text.trim().replace(/\s+/g, " ");
  const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
  const fromSuggestion = suggestions.filter((s) => !lines.some((l) => same(s.topicText, l.topicText) || (s.documentId && l.documentId === s.documentId)));
  return (
    <FormModal isOpen onClose={onClose} title={tr("Add a Training Topic")} confirmText="Add" confirmDisabled={!clean || lines.some((l) => same(l.topicText, clean))} size="md" onConfirm={() => onAdd({ plannedMonth: month, topicText: clean, title: clean, code: undefined })}>
      <div className="grid gap-4">
        <TrainingMonthField label={`${tr("Month")} *`} value={month} min={`${year}-01`} max={`${year}-12`} onChange={(v) => v && setMonth(v)} />
        <FormField label={tr("Training Topic")} required><Input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} /></FormField>
        {fromSuggestion.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="mb-2 font-medium">{tr("Annual Training Topics of the matrix not yet planned this year")}</div>
            <ul className="space-y-1">
              {fromSuggestion.map((s) => (
                <li key={`${s.topicText}|${s.documentId}`} className="flex items-center justify-between gap-2">
                  <span>{s.code ? `${s.code} — ` : ""}{s.title}</span>
                  <Button size="sm" variant="default" onClick={() => onAdd({ plannedMonth: month, topicText: s.topicText, documentId: s.documentId, title: s.title, code: s.code })}>{tr("Add")}</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </FormModal>
  );
}

function AddDocumentDialog({ year, onClose, onAdd }: { year: number; onClose: () => void; onAdd: (l: DraftLine) => void }) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [docs, setDocs] = useState<Record<string, { id: string; documentNumber: string; documentName: string }>>({});
  const [id, setId] = useState("");
  const [month, setMonth] = useState(`${year}-01-01`);
  const search = useCallback(async (query: string) => {
    const page = await documentApi.getDocumentsPage({ search: query, page: 1, limit: 20 } as never);
    const list = page.data as unknown as { id: string; documentNumber: string; documentName: string }[];
    setDocs((old) => ({ ...old, ...Object.fromEntries(list.map((d) => [d.id, d])) }));
    const mapped = list.map((d) => ({ label: `${d.documentNumber} — ${d.documentName}`, value: d.id }));
    setOptions(mapped);
    return mapped;
  }, []);
  useEffect(() => { void search(""); }, [search]);
  const doc = docs[id];
  return (
    <FormModal isOpen onClose={onClose} title={tr("Add a SOP")} confirmText="Add" confirmDisabled={!doc} size="md" onConfirm={() => doc && onAdd({ plannedMonth: month, documentId: doc.id, title: doc.documentName, code: doc.documentNumber })}>
      <div className="grid gap-4">
        <TrainingMonthField label={`${tr("Month")} *`} value={month} min={`${year}-01`} max={`${year}-12`} onChange={(v) => v && setMonth(v)} />
        <FormField label={tr("Document")} required><Select value={id} onChange={setId} options={options} onSearch={search} placeholder={tr("Search a document")} /></FormField>
      </div>
    </FormModal>
  );
}
