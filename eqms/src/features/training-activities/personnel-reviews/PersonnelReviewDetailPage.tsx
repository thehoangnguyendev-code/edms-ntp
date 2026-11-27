import { useViewState } from "@/hooks/useViewState";
import { useCallback, useEffect, useState } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useNavigate, useParams } from "react-router-dom";
import { ScanSearch } from "lucide-react";
import { IconPencilMinus } from "@tabler/icons-react";
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
import { trainingError, trainingReviewsApi, type TrainingPersonnelReview, type TrainingReviewItem } from "@/services/api/trainingActivities";
import { Textarea } from "../shared/TrainingFields";
import { TrainingScannedTestsModal } from "../shared/TrainingScannedTestsModal";
import { day, trainingBreadcrumbs, when, statusChange } from "../shared/trainingLabels";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { ReadonlyField, ReadonlyGrid, TabBlock, TrainingDetailLayout } from "../shared/TrainingDetailLayout";
import { TrainingPersonRelatedCard } from "../shared/TrainingPersonRelatedCard";
import { trFormat, tr } from "@/i18n";
import { REVIEW_KIND_LABEL, REVIEW_STATUS_LABEL } from "./personnelReviewLabels";
import { useTrainingBack } from "../shared/useTrainingBack";
import { useTrainingRowMenu } from "../shared/useTrainingRowMenu";
import { ClassDialog, JobRolesDialog, RetrainingDialog } from "./ReviewDialogs";

const ITEM_STATUS = { PENDING: "Pending", DONE: "Done", NOT_NEEDED: "Not needed" } as const;
const ITEM_COLOR = { PENDING: "amber", DONE: "emerald", NOT_NEEDED: "slate" } as const;
const EVENT_DATE_LABEL: Record<string, string> = { NEW_HIRE: "Start Date", ABSENCE_RETURN: "Return Date", DEPT_TRANSFER: "Transfer Date", LOCATION_TRANSFER: "Transfer Date" };
const GROUP_LABEL: Record<string, string> = { FACTORY_GENERAL: "Whole factory", DEPARTMENT_GENERAL: "Whole department", SOP: "Procedures of the position" };

/** One training review of a person: the facts, the checklist of the SOP, and the signature that closes it. */
export function PersonnelReviewDetailPage() {
  const { reviewId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = useTrainingBack("/training-management/personnel-reviews");
  const { showToast } = useToast();
  const [review, setReview] = useState<TrainingPersonnelReview>();
  const [error, setError] = useState("");
  const [tab, setTab] = useViewState("PersonnelReviewDetailPage.tab", "overview");
  const [editing, setEditing] = useState<TrainingReviewItem>();
  const [scans, setScans] = useState<string>();
  const [dialog, setDialog] = useState<"roles" | "retrain" | "class" | "">("");
  const [signing, setSigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [changingCloser, setChangingCloser] = useState(false);
  const [newCloserId, setNewCloserId] = useState("");
  const [closerOptions, setClosersOptions] = useState<{ label: string; value: string }[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(() => { trainingReviewsApi.get(reviewId).then(setReview).catch((e) => setError(trainingError(e))); }, [reviewId]);
  useEffect(refetch, [refetch]);
  useEntityChanged(["TRAINING"], refetch);
  const run = useCallback(async (action: () => Promise<TrainingPersonnelReview>, done: string) => {
    setBusy(true);
    try {
      setReview(await action());
      showToast({ type: "success", title: done, message: "" });
      return true;
    } catch (e) {
      showToast({ type: "error", title: tr("The action was not done"), message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const rows = (review?.items ?? []).map((item) => ({ ...item, id: item.itemCode }));
  const rowMenu = useTrainingRowMenu(rows, (i) => {
    const edit = Boolean(review?.capabilities.editItems);
    return [
      ...(edit ? [{ label: "Update", icon: <IconPencilMinus className="h-4 w-4" />, onClick: () => setEditing(i) }] : []),
      ...(i.activityId ? [{ label: "View scanned tests", icon: <ScanSearch className="h-4 w-4" />, onClick: () => setScans(i.activityId ?? undefined) }] : []),
    ];
  });

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
  const tabs: TabItem[] = [{ id: "overview", label: tr("General Information") }, { id: "checklist", label: "Checklist", count: review.items.length }, { id: "audit", label: tr("Audit Trail") }];
  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { id: "no", header: "No.", locked: true, cell: (_i, n) => n + 1 },
    { id: "item", header: "To do", cell: (i) => <div className="max-w-80 whitespace-normal"><div className="font-medium text-slate-900">{tr(i.label)}</div>{i.hint && <div className="text-xs text-slate-500">{tr(i.hint)}</div>}{i.rowGroup && <div className="text-xs text-slate-400">{tr(GROUP_LABEL[i.rowGroup] ?? i.rowGroup)}</div>}</div> },
    { id: "status", header: "State", cell: (i) => <Badge color={ITEM_COLOR[i.status]}>{ITEM_STATUS[i.status]}</Badge> },
    { id: "activity", header: "Training", cell: (i) => (i.activityId ? <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/training-management/activities/${i.activityId}`)}>{i.trainingNumber}</button> : i.checkType === "TRAINING" ? <span className="text-slate-400">{tr("not linked")}</span> : "—") },
    {
      id: "lastTrained",
      header: tr("Last trained"),
      cell: (i) => (i.checkType !== "TRAINING" ? "—" : (
        <div className="whitespace-nowrap">
          <div>{day(i.lastDone)}</div>
          {(i.requirementStatus === "UPDATE_NEEDED" || i.requirementStatus === "DUE") && <Badge color="amber" size="sm">{tr(i.requirementStatus === "DUE" ? "Annual training due" : "New revision not trained")}</Badge>}
        </div>
      )),
    },
    {
      id: "system",
      header: tr("System check"),
      cell: (i) => (i.systemCheck ? (
        <div className="max-w-72 whitespace-normal">
          <Badge color={i.systemCheck.found ? "emerald" : "amber"}>{i.systemCheck.found ? tr("Found") : tr("Not yet")}</Badge>
          <div className="mt-1 text-xs text-slate-600">{i.systemCheck.parts.map((p) => trFormat(p.template, p.values)).join(" ")}</div>
        </div>
      ) : "—"),
    },
    { id: "note", header: "Description", cell: (i) => <div className="max-w-64 whitespace-normal text-xs text-slate-600">{i.note ?? "—"}</div> },
    { id: "done", header: "Done by", cell: (i) => (i.doneByName ? <div><div>{i.doneByName}</div><div className="text-xs text-slate-500">{when(i.doneAt)}</div></div> : "—") },
  ];
  const searchClosers = async (query: string) => {
    const page = await trainingReviewsApi.eligibleClosers(review.personUserId, query).catch(() => undefined);
    const mapped = (page?.data ?? []).filter((p) => p.id !== review.closerUserId).map((p) => ({ label: `${p.fullName}${p.employeeCode ? ` (${p.employeeCode})` : ""}`, value: p.id }));
    setClosersOptions(mapped);
    return mapped;
  };
  const footer = (
    <>
      {caps.close && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setSigning(true)}>{tr("Close review")}</Button>}
      {caps.changeCloser && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => { setReason(""); setNewCloserId(""); void searchClosers(""); setChangingCloser(true); }}>{tr("Change Closer")}</Button>}
      {caps.cancel && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => { setReason(""); setCancelling(true); }}>{tr("Cancel")}</Button>}
      {/* the commands of the checklist show on its tab only */}
      {tab === "checklist" && caps.editItems && (
        <>
          {review.kind === "ABSENCE_RETURN" && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog("retrain")}>{tr("Choose training to repeat")}</Button>}
          {review.kind !== "ABSENCE_RETURN" && review.items.some((i) => i.checkType === "TRAINING" && i.status === "PENDING" && !i.activityId) && (
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog("class")}>{tr("Arrange training")}</Button>
          )}
          <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog("roles")}>{tr("Change Job Role")}</Button>
        </>
      )}
    </>
  );

  return (
    <>
      <TrainingDetailLayout title={title} breadcrumbItems={crumbs} onBack={goBack} workflow={review.workflow}
        tabs={tabs} activeTab={tab} onTab={setTab} tabLayoutId="training-review-detail-tab" footer={footer} repeatFooterInHeader afterFooter={<TrainingPersonRelatedCard personId={review.personUserId} />}>
        {review.readyToClose && (
          <p role="status" className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {tr("Every item is settled.")} {review.closerName ? trFormat("{name} must check the review and sign to close it.", { name: review.closerName }) : tr("A person who may close the review must check it and sign.")}
          </p>
        )}
        {tab === "overview" && (
          <ReadonlyGrid>
            <ReadonlyField label={tr("Employee")} value={`${review.fullName}${review.employeeCode ? ` (${review.employeeCode})` : ""}`} />
            <ReadonlyField label={tr("Department")} value={review.department} />
            <ReadonlyField label={tr("Created Time")} value={when(review.createdAt)} />
            <ReadonlyField label={tr("Opened By")} value={review.createdByName} />
            <ReadonlyField label={tr("Event")} value={REVIEW_KIND_LABEL[review.kind]} />
            <ReadonlyField label={tr("Status")} value={REVIEW_STATUS_LABEL[review.status]} />
            <ReadonlyField label={EVENT_DATE_LABEL[review.kind] ?? "Event Date"} value={day(review.eventDate)} />
            <ReadonlyField label={tr("Person Who Closes The Review")} value={review.closerName ?? review.closedByName ?? (review.status === "OPEN" ? tr("Anyone who may (no person was chosen)") : "")} />
            {review.kind === "ABSENCE_RETURN" && (
              <>
                <ReadonlyField label={tr("Absent from")} value={day(review.absenceFrom)} />
                <ReadonlyField label={tr("Absent until")} value={`${day(review.absenceTo)} ${tr(review.absenceOverSixMonths ? "(more than six months)" : "(six months or less)")}`} />
              </>
            )}
            {(review.kind === "DEPT_TRANSFER" || review.kind === "LOCATION_TRANSFER") && (
              <>
                <ReadonlyField label={review.kind === "LOCATION_TRANSFER" ? tr("Previous site / department") : tr("Previous department")} value={review.departmentFrom} />
                <ReadonlyField label={review.kind === "LOCATION_TRANSFER" ? tr("New site / department") : tr("New department")} value={review.departmentTo} />
              </>
            )}
            <ReadonlyField label={tr("Description")} wide>
              <textarea rows={3} readOnly value={review.note ?? ""} placeholder="—" className={CONTROL_STATE_CLASSES.readonlyTextarea} />
            </ReadonlyField>
            {review.closedByName && <ReadonlyField label={tr("Closed by")} value={`${review.closedByName} (${day(review.closedAt)})`} />}
            {review.cancelReason && <ReadonlyField label={tr("Cancelled because")} value={review.cancelReason} wide />}
          </ReadonlyGrid>
        )}
        {tab === "checklist" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{tr("The training lines come from the matrix and are done when a training record exists; the specimen signature, job assignment and record handover are done when the system finds them. Only the other lines are marked by a person. Set a line aside with the reason when it is not needed. The review is closed by someone other than the employee, with a signature, when no line is pending.")}</p>
            <TabBlock title={tr("Checklist")}>
              <DataTable rows={rows} getRowKey={(i) => i.id} columns={columns} action={rowMenu.action} />
            </TabBlock>
            {rowMenu.node}
          </div>
        )}
        {tab === "audit" && <AuditTrailTab entityId={review.id} entityType="TRAINING_PERSONNEL_REVIEW" />}
      </TrainingDetailLayout>

      {scans && <TrainingScannedTestsModal personId={review.personUserId} activityId={scans} onClose={() => setScans(undefined)} />}
      {dialog === "roles" && <JobRolesDialog review={review} busy={busy} onClose={() => setDialog("")} onSave={async (ids) => { if (await run(() => trainingReviewsApi.setJobRoles(review.id, ids), tr("Job Roles saved"))) setDialog(""); }} />}
      {dialog === "retrain" && <RetrainingDialog review={review} busy={busy} onClose={() => setDialog("")} onSave={async (keys) => { if (await run(() => trainingReviewsApi.setRetraining(review.id, keys), tr("Training to repeat saved"))) setDialog(""); }} />}
      {dialog === "class" && <ClassDialog review={review} busy={busy} onClose={() => setDialog("")} onChanged={(next) => { setReview(next); setDialog(""); showToast({ type: "success", title: tr("Initial training class"), message: "" }); }} />}
      {editing && <ItemDialog item={editing} personName={review.fullName} busy={busy} onClose={() => setEditing(undefined)}
        onSave={async (body) => { if (await run(() => trainingReviewsApi.item(review.id, editing.itemCode, body), "Item updated")) setEditing(undefined); }} />}
      <FormModal isOpen={changingCloser} onClose={() => setChangingCloser(false)}
        onConfirm={async () => { if (await run(() => trainingReviewsApi.changeCloser(review.id, newCloserId, reason.trim()), "Closer changed")) setChangingCloser(false); }}
        title={tr("Change the Person Who Closes the Review")} description={tr("Use it when the person is away, has left or no longer holds the permission. The reason and both people stay on record.")} confirmText="Change" isLoading={busy}
        confirmDisabled={!newCloserId || !reason.trim()} size="md">
        <div className="space-y-4">
          <FormField label={tr("New person")} required><Select value={newCloserId} onChange={setNewCloserId} options={closerOptions} onSearch={searchClosers} placeholder={tr("Search by name")} /></FormField>
          <FormField label={tr("Reason")} required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
        </div>
      </FormModal>
      <FormModal isOpen={cancelling} onClose={() => setCancelling(false)} onConfirm={async () => { if (await run(() => trainingReviewsApi.cancel(review.id, reason.trim()), "Review cancelled")) setCancelling(false); }}
        title={tr("Cancel the Review")} description={tr("The review stays on record with your reason.")} confirmText={tr("Cancel review")} confirmVariant="destructive" isLoading={busy} confirmDisabled={!reason.trim()} size="md">
        <FormField label={tr("Reason")} required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </FormModal>
      <ESignatureModal isOpen={signing} onClose={() => setSigning(false)} onConfirm={async (d: { signatureToken: string }) => { if (await run(() => trainingReviewsApi.close(review.id, d.signatureToken), "Review closed")) setSigning(false); }}
        actionTitle="Close the Personnel Training Review" changes={statusChange("Open", "Closed")} meaningDisplayName="Personnel Training Review Closed" meaningCode="TRAINING_REVIEW_CLOSED" targetDetails={{ code: `Review ${review.reviewNo}`, title: review.fullName, revision: "" }} />
    </>
  );
}

function ItemDialog({ item, personName, busy, onClose, onSave }: { item: TrainingReviewItem; personName: string; busy: boolean; onClose: () => void; onSave: (body: { status: string; activityId?: string | null; note?: string | null }) => void }) {
  const [status, setStatus] = useState<string>(item.status);
  const [note, setNote] = useState(item.note ?? "");
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave({ status, note: note.trim() || null })} title={tr(item.label)} description={`${trFormat("For {name}.", { name: personName })} ${item.hint ? tr(item.hint) : ""}`}
      confirmText="Save" isLoading={busy} confirmDisabled={status === "NOT_NEEDED" && !note.trim()} size="xl">
      <div className="grid gap-4">
        <FormField label={tr("State")} required><Select value={status} enableSearch={false} onChange={setStatus} options={Object.entries(ITEM_STATUS).filter(([value]) => value !== "DONE" || item.canMarkDone !== false).map(([value, label]) => ({ value, label }))} /></FormField>
        <FormField label={status === "NOT_NEEDED" ? tr("Reason it is not needed") : "Description"} required={status === "NOT_NEEDED"}><Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
      </div>
    </FormModal>
  );
}
