import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "./TrainingFields";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { trainingError, trainingJobsApi, type TrainingEligibilityItem, type TrainingJobDetail, type TrainingJobDuty, type TrainingPerson } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs, when } from "./trainingLabels";
import { ReadonlyField, ReadonlyGrid, TabBlock, TrainingDetailLayout } from "./TrainingDetailLayout";

const JOB_STEPS = [
  { status: "DRAFT", label: "Draft" },
  { status: "PENDING_RECEIVER", label: "Waiting for the employee" },
  { status: "EFFECTIVE", label: "Effective" },
];

type Dialog = "exception" | "cancel" | undefined;
interface SignRequest { title: string; code: string; name: string; run: (token: string) => Promise<TrainingJobDetail> }

/** One job assignment: the facts, the duties, the matrix check, and the two signatures. */
export function TrainingJobDetailPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [job, setJob] = useState<TrainingJobDetail>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ directSuperiorTitle: "", subordinateTitles: "", substituteTitle: "", changeReason: "", jurisdiction: "" });
  const [duties, setDuties] = useState<TrainingJobDuty[]>([]);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);

  const apply = useCallback((j: TrainingJobDetail) => {
    setJob(j);
    setForm({ directSuperiorTitle: j.directSuperiorTitle ?? "", subordinateTitles: j.subordinateTitles ?? "", substituteTitle: j.substituteTitle ?? "", changeReason: j.changeReason ?? "", jurisdiction: j.jurisdiction ?? "" });
    setDuties(j.duties);
    setDirty(false);
  }, []);
  useEffect(() => { trainingJobsApi.get(jobId).then(apply).catch((e) => setError(trainingError(e))); }, [jobId, apply]);

  const run = async (action: () => Promise<TrainingJobDetail>, done: string) => {
    setBusy(true);
    try {
      apply(await action());
      showToast({ type: "success", title: done, message: "" });
      setDialog(undefined);
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const title = "Job Assignment Details";
  const crumbs = trainingBreadcrumbs(navigate, "jobs", title);
  if (!job) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading…" />}
      </div>
    );
  }
  const caps = job.capabilities;
  const body = () => ({ ...form, duties, version: job.version });
  const tabs: TabItem[] = [{ id: "overview", label: "General Information" }, { id: "duties", label: "Duties", count: duties.length }, { id: "matrix", label: "Matrix Check" }, { id: "approvals", label: "Signatures" }, { id: "audit", label: "Audit Trail" }];
  const eligibility = job.eligibility;
  const itemColumns: DataTableColumn<TrainingEligibilityItem>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "title", header: "Required training", cell: (i) => <div className="max-w-80 whitespace-normal">{i.code ? `${i.code} — ` : ""}{i.title}</div> },
    { id: "annual", header: "Annual", cell: (i) => (i.annualRequired ? "Yes" : "No") },
    { id: "last", header: "Last trained", cell: (i) => day(i.lastDone) },
    { id: "status", header: "Status", cell: (i) => (i.lastDone ? <Badge color="emerald">Trained</Badge> : <Badge color="red">Not trained</Badge>) },
  ];
  const editable = caps.edit;

  const footer = (
    <>
      {editable && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} disabled={!dirty} onClick={() => void run(() => trainingJobsApi.update(job.id, body()), "Draft saved")}>Save draft</Button>}
      {caps.requestException && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setDialog("exception")}>Request exception</Button>}
      {caps.approveException && <Button size="sm" variant="default" className="whitespace-nowrap" onClick={() => setSign({ title: "Approve exception", code: "TRAINING_JOB_EXCEPTION_APPROVED", name: "Job Assignment Exception Approved", run: (t) => trainingJobsApi.approveException(job.id, t) })}>Approve exception</Button>}
      {caps.submit && <Button size="sm" variant="default" className="whitespace-nowrap" disabled={dirty} onClick={() => setSign({ title: "Assign job", code: "TRAINING_JOB_ASSIGNED", name: "Job Assigned", run: (t) => trainingJobsApi.submit(job.id, job.version, t) })}>Sign and send</Button>}
      {caps.accept && <Button size="sm" variant="default" className="whitespace-nowrap" onClick={() => setSign({ title: "Accept job assignment", code: "TRAINING_JOB_ACCEPTED", name: "Job Accepted", run: (t) => trainingJobsApi.accept(job.id, job.version, t) })}>Accept</Button>}
      {caps.cancel && <Button size="sm" variant="destructive" className="whitespace-nowrap" onClick={() => setDialog("cancel")}>Cancel</Button>}
    </>
  );
  const cancelled = job.status === "CANCELLED";
  const superseded = job.status === "SUPERSEDED";
  const steps = cancelled ? ["Draft", "Waiting for the employee", "Effective", "Cancelled"] : superseded ? ["Draft", "Waiting for the employee", "Effective", "Replaced"] : JOB_STEPS.map((x) => x.label);
  const stepIndex = cancelled || superseded ? 3 : Math.max(0, JOB_STEPS.findIndex((x) => x.status === job.status));

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={crumbs}
        onBack={() => navigate("/training-management/job-assignments")}
        steps={steps}
        currentStepIndex={stepIndex}
        terminalProgressStep="Draft"
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-job-detail-tab"
        footer={footer}
      >
        {tab === "overview" && (
          <div className="space-y-6">
            <ReadonlyGrid>
              <ReadonlyField label="Employee" value={job.personName} />
              <ReadonlyField label="Position" value={job.positionName} />
              <ReadonlyField label="Department" value={job.departmentName} />
              <ReadonlyField label="Type" value={job.caseType === "INITIAL" ? "Initial" : `Change (from ${job.previousPositionName ?? "—"})`} />
              <ReadonlyField label="Issue" value={String(job.issueNo)} />
              <ReadonlyField label="Effective" value={day(job.effectiveAt)} />
              {job.assignorTitle && <ReadonlyField label="Assigned by (title)" value={job.assignorTitle} wide />}
              {job.cancelReason && <ReadonlyField label="Reason for cancelling" value={job.cancelReason} wide />}
            </ReadonlyGrid>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {([["directSuperiorTitle", "Direct superior"], ["subordinateTitles", "Subordinates"], ["substituteTitle", "Substitute"], ["jurisdiction", "Jurisdiction"]] as const).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <Input value={form[key]} disabled={!editable} onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setDirty(true); }} />
                </FormField>
              ))}
              {(job.caseType === "CHANGE" || form.changeReason) && (
                <div className="md:col-span-2">
                  <FormField label="Reason for the change" required={job.caseType === "CHANGE"}>
                    <Textarea rows={2} value={form.changeReason} disabled={!editable} onChange={(e) => { setForm({ ...form, changeReason: e.target.value }); setDirty(true); }} />
                  </FormField>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "duties" && (
          <TabBlock title="Duties" action={editable ? <Button size="sm" variant="outline-emerald" onClick={() => { setDuties([...duties, { responsibility: "", description: "" }]); setDirty(true); }}>Add duty</Button> : undefined}>
            {duties.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No duty yet.</p>
            ) : (
              <div className="space-y-3 p-3">
                {duties.map((d, i) => (
                  <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_2fr_auto]">
                    <Input placeholder="Responsibility" maxLength={500} value={d.responsibility} disabled={!editable} onChange={(e) => { setDuties(duties.map((x, k) => (k === i ? { ...x, responsibility: e.target.value } : x))); setDirty(true); }} />
                    <Input placeholder="Description" value={d.description ?? ""} disabled={!editable} onChange={(e) => { setDuties(duties.map((x, k) => (k === i ? { ...x, description: e.target.value } : x))); setDirty(true); }} />
                    {editable && <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { setDuties(duties.filter((_x, k) => k !== i)); setDirty(true); }}>Remove</button>}
                  </div>
                ))}
              </div>
            )}
          </TabBlock>
        )}

        {tab === "matrix" && (
          <div className="space-y-4">
            {eligibility ? (
              <TabBlock title="Training required by the matrix" action={eligibility.matrixMissing ? <Badge color="amber">No effective matrix</Badge> : eligibility.complete ? <Badge color="emerald">Complete</Badge> : <Badge color="red">{eligibility.missingCount} not trained</Badge>}>
                {eligibility.matrixMissing ? (
                  <p className="p-4 text-sm text-amber-700">The department has no effective matrix. An exception is needed to go ahead.</p>
                ) : (
                  <DataTable rows={eligibility.items} getRowKey={(i) => `${i.code}|${i.title}`} columns={itemColumns} emptyState={<p className="p-4 text-sm text-slate-500">The matrix requires no training for this position.</p>} />
                )}
              </TabBlock>
            ) : <p className="text-sm text-slate-500">No matrix check for this assignment.</p>}
            {job.exceptionReason && (
              <ReadonlyGrid>
                <ReadonlyField label="Exception reason" value={job.exceptionReason} wide />
                <ReadonlyField label="Exception status" value={job.exceptionApprovedBy ? "Approved" : `Waiting for ${job.approvers.filter((a) => a.status === "PENDING").map((a) => a.assigneeName).join(", ") || "an approver"}`} wide />
              </ReadonlyGrid>
            )}
          </div>
        )}

        {tab === "approvals" && (
          <TabBlock title="Signatures">
            <DataTable
              rows={job.approvers}
              getRowKey={(a) => a.id}
              columns={[
                { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
                { id: "who", header: "Person", cell: (a) => a.assigneeName },
                { id: "status", header: "Status", cell: (a) => a.status.toLowerCase() },
                { id: "at", header: "Date", cell: (a) => when(a.completedAt ?? a.assignedAt) },
              ] as DataTableColumn<(typeof job.approvers)[number]>[]}
              emptyState={<p className="p-4 text-sm text-slate-500">No signature requested yet.</p>}
            />
          </TabBlock>
        )}

        {tab === "audit" && <AuditTrailTab entityId={job.id} entityType="TRAINING_JOB_ASSIGNMENT" />}
      </TrainingDetailLayout>

      {dialog === "exception" && <ExceptionDialog jobId={job.id} busy={busy} onClose={() => setDialog(undefined)} onSave={(reason, approver) => run(() => trainingJobsApi.requestException(job.id, reason, approver), "Exception requested")} />}
      <ReasonDialog open={dialog === "cancel"} busy={busy} onClose={() => setDialog(undefined)} onSave={(reason) => run(() => trainingJobsApi.cancel(job.id, job.version, reason), "Assignment cancelled")} />
      <ESignatureModal
        isOpen={!!sign}
        onClose={() => setSign(undefined)}
        onConfirm={async (data: { signatureToken: string }) => { if (sign) { const ok = await run(() => sign.run(data.signatureToken), sign.title); if (ok) setSign(undefined); } }}
        actionTitle={sign?.title}
        meaningDisplayName={sign?.name}
        meaningCode={sign?.code}
        targetDetails={{ code: job.personName, title: job.positionName, revision: String(job.issueNo) }}
      />
    </>
  );
}

function ReasonDialog({ open, busy, onClose, onSave }: { open: boolean; busy: boolean; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen={open} onClose={onClose} onConfirm={() => onSave(reason.trim())} title="Cancel job assignment" description="The reason stays in the record." confirmText="Cancel assignment" confirmVariant="destructive" isLoading={busy} confirmDisabled={!reason.trim()} size="md">
      <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
    </FormModal>
  );
}

function ExceptionDialog({ jobId, busy, onClose, onSave }: { jobId: string; busy: boolean; onClose: () => void; onSave: (reason: string, approver: string) => void }) {
  const [reason, setReason] = useState("");
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState("");
  const search = useCallback(async (query: string) => {
    const page = await trainingJobsApi.eligibleApprovers(jobId, query);
    setPeople(page.data);
    setLoaded(true);
    return page.data.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }));
  }, [jobId]);
  useEffect(() => { void search(""); }, [search]);
  return (
    <FormModal isOpen onClose={onClose} onConfirm={() => onSave(reason.trim(), id)} title="Request an exception" description="The person goes ahead before the training is complete only if the person you choose approves, with a signature." confirmText="Request" isLoading={busy} confirmDisabled={!reason.trim() || !id} size="md">
      <div className="grid gap-4">
        <FormField label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
        {loaded && people.length === 0 ? (
          <p className="text-sm text-amber-700">No eligible approver was found.</p>
        ) : (
          <Select label="Approver" value={id} onChange={setId} options={people.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} onSearch={search} placeholder="Search by name" />
        )}
      </div>
    </FormModal>
  );
}
