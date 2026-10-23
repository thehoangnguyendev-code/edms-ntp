import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { trainingActivitiesApi, trainingError, trainingReviewsApi, type TrainingGap, type TrainingPersonMatrixGaps, type TrainingPersonnelReview, type TrainingReviewItem } from "@/services/api/trainingActivities";
import { Textarea } from "../shared/TrainingFields";
import { TrainingScannedTestsModal } from "../shared/TrainingScannedTestsModal";
import { day, trainingBreadcrumbs, when, statusChange } from "../shared/trainingLabels";
import { ReadonlyField, ReadonlyGrid, TabBlock, TrainingDetailLayout } from "../shared/TrainingDetailLayout";
import { REVIEW_KIND_LABEL, REVIEW_STATUS_LABEL } from "./PersonnelReviewListView";

const ITEM_STATUS = { PENDING: "Pending", DONE: "Done", NOT_NEEDED: "Not needed" } as const;
const ITEM_COLOR = { PENDING: "amber", DONE: "emerald", NOT_NEEDED: "slate" } as const;
/** A review ends in one of two ways: closed with a signature, or cancelled. The stepper always shows all three; the end that was not taken is striped. */
const STEPS = ["Open", "Closed", "Cancelled"];
const GAP_LABEL: Record<string, string> = { MISSING: "Not trained", DUE: "Annual training due", OK: "Trained" };
const GAP_COLOR: Record<string, "red" | "amber" | "emerald"> = { MISSING: "red", DUE: "amber", OK: "emerald" };

/** One training review of a person: the facts, the checklist of the SOP, and the signature that closes it. */
export function PersonnelReviewDetailPage() {
  const { reviewId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [review, setReview] = useState<TrainingPersonnelReview>();
  const [gaps, setGaps] = useState<TrainingPersonMatrixGaps>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState<TrainingReviewItem>();
  const [scans, setScans] = useState<string>();
  const [signing, setSigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(() => { trainingReviewsApi.get(reviewId).then(setReview).catch((e) => setError(trainingError(e))); }, [reviewId]);
  useEffect(refetch, [refetch]);
  // The gaps follow the record of the person, which changes when a training is completed elsewhere.
  useEffect(() => { trainingReviewsApi.matrixGaps(reviewId).then(setGaps).catch(() => setGaps(undefined)); }, [reviewId, review?.items]);
  useEntityChanged(["TRAINING"], refetch);
  const run = useCallback(async (action: () => Promise<TrainingPersonnelReview>, done: string) => {
    setBusy(true);
    try {
      setReview(await action());
      showToast({ type: "success", title: done, message: "" });
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const title = "Training Review Details";
  const crumbs = trainingBreadcrumbs(navigate, "reviews", title);
  if (!review) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading…" />}
      </div>
    );
  }
  const caps = review.capabilities;
  // Creates the training activity the item asks for, links it, and opens it to add the session and the list.
  const startTraining = async (item: TrainingReviewItem) => {
    setBusy(true);
    try {
      const next = await trainingReviewsApi.createTraining(review.id, item.itemCode);
      setReview(next);
      navigate(`/training-management/activities/${next.createdActivityId}/edit`);
    } catch (e) {
      showToast({ type: "error", title: "The training was not created", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };
  const tabs: TabItem[] = [{ id: "overview", label: "General Information" }, { id: "checklist", label: "Checklist", count: review.items.length }, { id: "gaps", label: "Matrix Gaps", count: gaps ? gaps.missing + gaps.due : undefined }, { id: "audit", label: "Audit Trail" }];
  const columns: DataTableColumn<TrainingReviewItem>[] = [
    { id: "no", header: "No.", locked: true, cell: (_i, n) => n + 1 },
    { id: "item", header: "To do", cell: (i) => <div className="max-w-80 whitespace-normal"><div className="font-medium text-slate-900">{i.label}</div><div className="text-xs text-slate-500">{i.hint}</div></div> },
    { id: "status", header: "State", cell: (i) => <Badge color={ITEM_COLOR[i.status]}>{ITEM_STATUS[i.status]}</Badge> },
    { id: "activity", header: "Training", cell: (i) => (i.activityId ? <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${i.activityId}`)}>{i.trainingNumber}</button> : i.canLink ? <span className="text-slate-400">not linked</span> : "—") },
    {
      id: "system",
      header: "System check",
      cell: (i) => (i.systemCheck ? (
        <div className="max-w-72 whitespace-normal">
          <Badge color={i.systemCheck.found ? "emerald" : "amber"}>{i.systemCheck.found ? "Found" : "Not yet"}</Badge>
          <div className="mt-1 text-xs text-slate-600">{i.systemCheck.text}</div>
        </div>
      ) : "—"),
    },
    { id: "note", header: "Note", cell: (i) => <div className="max-w-64 whitespace-normal text-xs text-slate-600">{i.note ?? "—"}</div> },
    { id: "done", header: "Done by", cell: (i) => (i.doneByName ? <div><div>{i.doneByName}</div><div className="text-xs text-slate-500">{when(i.doneAt)}</div></div> : "—") },
    {
      id: "actions",
      header: "",
      cell: (i) => (caps.editItems || i.activityId ? (
        <div className="flex flex-wrap gap-2">
          {caps.editItems && <Button size="sm" variant="outline" onClick={() => setEditing(i)}>Update</Button>}
          {caps.editItems && i.canLink && !i.activityId && i.status === "PENDING" && <Button size="sm" variant="outline-emerald" disabled={busy} onClick={() => void startTraining(i)}>Create training</Button>}
          {i.activityId && <Button size="sm" variant="outline" onClick={() => setScans(i.activityId ?? undefined)}>View scanned tests</Button>}
        </div>
      ) : null),
    },
  ];
  const footer = (
    <>
      {caps.close && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setSigning(true)}>Close review</Button>}
      {caps.cancel && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => { setReason(""); setCancelling(true); }}>Cancel</Button>}
    </>
  );

  return (
    <>
      <TrainingDetailLayout title={title} breadcrumbItems={crumbs} onBack={() => navigate("/training-management/personnel-reviews")} steps={STEPS} currentStepIndex={review.status === "OPEN" ? 0 : review.status === "CLOSED" ? 1 : 2} terminalProgressStep="Open" skippedSteps={review.status === "CLOSED" ? ["Cancelled"] : undefined}
        tabs={tabs} activeTab={tab} onTab={setTab} tabLayoutId="training-review-detail-tab" footer={footer}>
        {tab === "overview" && (
          <ReadonlyGrid>
            <ReadonlyField label="Employee" value={`${review.fullName}${review.employeeCode ? ` (${review.employeeCode})` : ""}`} />
            <ReadonlyField label="Department" value={review.department} />
            <ReadonlyField label="Created Time" value={when(review.createdAt)} />
            <ReadonlyField label="Opened By" value={review.createdByName} />
            <ReadonlyField label="Event" value={REVIEW_KIND_LABEL[review.kind]} />
            <ReadonlyField label="Status" value={REVIEW_STATUS_LABEL[review.status]} />
            <ReadonlyField label="Event Date" value={day(review.eventDate)} />
            {review.kind === "ABSENCE_RETURN" && <ReadonlyField label="Absent" value={`${day(review.absenceFrom)} to ${day(review.absenceTo)}${review.absenceOverSixMonths ? " (more than six months)" : " (six months or less)"}`} wide />}
            {(review.departmentFrom || review.departmentTo) && <ReadonlyField label="Transfer" value={`${review.departmentFrom ?? "—"} to ${review.departmentTo ?? "—"}`} wide />}
            {review.note && <ReadonlyField label="Note" value={review.note} wide />}
            {review.closedByName && <ReadonlyField label="Closed by" value={`${review.closedByName} (${day(review.closedAt)})`} />}
            {review.cancelReason && <ReadonlyField label="Cancelled because" value={review.cancelReason} wide />}
          </ReadonlyGrid>
        )}
        {tab === "checklist" && (
          <TabBlock title="Checklist of the SOP">
            <p className="px-4 py-3 text-xs text-slate-500">Each item is done by people, not by the system. Mark it done, or not needed with the reason, and link the training that was organised. The review is closed by someone other than the employee, with a signature, when no item is pending.</p>
            <DataTable rows={review.items} getRowKey={(i) => i.itemCode} columns={columns} />
          </TabBlock>
        )}
        {tab === "gaps" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              What the effective matrix of the department asks for the position of {review.fullName}, and where the person stands. Use it to decide the additional training
              (SOP.0003 5.3.11). It shows the record; the decision stays with the head of department and the assigned employee.
            </p>
            {gaps === undefined ? <SectionLoading text="Loading the matrix…" /> : gaps.required === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-sm text-slate-600">
                Nothing to compare: the person has no position set for training, or the department has no effective matrix yet.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="text-slate-600">Position: <span className="font-medium text-slate-900">{gaps.positionName ?? "—"}</span></span>
                  <span className="text-slate-600">Trained: <span className="font-semibold text-slate-900">{gaps.done}</span> of {gaps.required}</span>
                  <span className="text-slate-600">Not trained: <span className="font-semibold text-red-700">{gaps.missing}</span></span>
                  <span className="text-slate-600">Annual training due: <span className="font-semibold text-amber-700">{gaps.due}</span></span>
                </div>
                <TabBlock title="Training of the matrix">
                  <DataTable
                    rows={gaps.gaps}
                    getRowKey={(g, i) => `${g.code ?? ""}|${g.title}|${i}`}
                    columns={[
                      { id: "rowNo", header: "No.", locked: true, cell: (_g, i) => i + 1 },
                      { id: "topic", header: "Required training", cell: (g) => <div className="max-w-96 whitespace-normal">{g.code ? `${g.code} — ` : ""}{g.title}</div> },
                      { id: "annual", header: "Annual", cell: (g) => (g.annualRequired ? "Yes" : "No") },
                      { id: "last", header: "Last trained", cell: (g) => day(g.lastDone) },
                      { id: "status", header: "Status", cell: (g) => <Badge color={GAP_COLOR[g.status]}>{GAP_LABEL[g.status]}</Badge> },
                    ] as DataTableColumn<TrainingGap>[]}
                  />
                </TabBlock>
              </>
            )}
            <div>
              <Button size="sm" variant="outline" onClick={() => navigate(`/training-management/records?search=${encodeURIComponent(review.employeeCode ?? review.fullName)}`)}>Open the training records of this person</Button>
            </div>
          </div>
        )}
        {tab === "audit" && <AuditTrailTab entityId={review.id} entityType="TRAINING_PERSONNEL_REVIEW" />}
      </TrainingDetailLayout>

      {scans && <TrainingScannedTestsModal personId={review.personUserId} activityId={scans} onClose={() => setScans(undefined)} />}
      {editing && <ItemDialog item={editing} personName={review.fullName} busy={busy} onClose={() => setEditing(undefined)}
        onSave={async (body) => { if (await run(() => trainingReviewsApi.item(review.id, editing.itemCode, body), "Item updated")) setEditing(undefined); }} />}
      <FormModal isOpen={cancelling} onClose={() => setCancelling(false)} onConfirm={async () => { if (await run(() => trainingReviewsApi.cancel(review.id, reason.trim()), "Review cancelled")) setCancelling(false); }}
        title="Cancel the review" description="The review stays on record with your reason." confirmText="Cancel review" confirmVariant="destructive" isLoading={busy} confirmDisabled={!reason.trim()} size="md">
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </FormModal>
      <ESignatureModal isOpen={signing} onClose={() => setSigning(false)} onConfirm={async (d: { signatureToken: string }) => { if (await run(() => trainingReviewsApi.close(review.id, d.signatureToken), "Review closed")) setSigning(false); }}
        actionTitle="Close the personnel training review" changes={statusChange("Open", "Closed")} meaningDisplayName="Personnel Training Review Closed" meaningCode="TRAINING_REVIEW_CLOSED" targetDetails={{ code: `Review ${review.reviewNo}`, title: review.fullName, revision: "" }} />
    </>
  );
}

function ItemDialog({ item, personName, busy, onClose, onSave }: { item: TrainingReviewItem; personName: string; busy: boolean; onClose: () => void; onSave: (body: { status: string; activityId?: string | null; note?: string | null }) => void }) {
  const [status, setStatus] = useState<string>(item.status);
  const [note, setNote] = useState(item.note ?? "");
  const [activityId, setActivityId] = useState(item.activityId ?? "");
  const [options, setOptions] = useState<{ label: string; value: string }[]>(item.activityId && item.trainingNumber ? [{ label: `${item.trainingNumber} — ${item.trainingTitle ?? ""}`, value: item.activityId }] : []);
  const search = useCallback(async (query: string) => {
    const page = await trainingActivitiesApi.list({ search: query, limit: 20, page: 1 }).catch(() => ({ data: [] }));
    const mapped = page.data.map((a) => ({ label: `${a.trainingNumber} — ${a.trainingTitle}`, value: a.id }));
    setOptions(mapped);
    return mapped;
  }, []);
  useEffect(() => { if (item.canLink) void search(""); }, [item.canLink, search]);
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave({ status, activityId: item.canLink ? activityId || null : null, note: note.trim() || null })} title={item.label} description={`For ${personName}. ${item.hint}`}
      confirmText="Save" isLoading={busy} confirmDisabled={status === "NOT_NEEDED" && !note.trim()} size="md">
      <div className="grid gap-4">
        <FormField label="State" required><Select value={status} enableSearch={false} onChange={setStatus} options={Object.entries(ITEM_STATUS).map(([value, label]) => ({ value, label }))} /></FormField>
        {item.canLink && <FormField label="Training organised for it (the employee must be on its list)"><Select value={activityId} onChange={setActivityId} options={options} onSearch={search} placeholder="Search a training by number or title" /></FormField>}
        <FormField label={status === "NOT_NEEDED" ? "Reason it is not needed" : "Note"} required={status === "NOT_NEEDED"}><Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
      </div>
    </FormModal>
  );
}
