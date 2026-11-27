import { useViewState } from "@/hooks/useViewState";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { PersonTitlePicker } from "./PersonTitlePicker";
import { TrainingPersonName } from "../shared/TrainingPersonName";
import { WorkPositionsPreview } from "./WorkPositionsPreview";
import { useCallback, useEffect, useState, useRef } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../shared/TrainingFields";
import { RequiredTrainingsField, pickedIds, type PickedTraining } from "./RequiredTrainingsField";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { FormDownloadButtons } from "../shared/FormDownloadButtons";
import { PaperPrintButton } from "../shared/PaperPrintButton";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import {
  trainingError,
  trainingFormsApi,
  trainingJobsApi,
  type TrainingEligibilityItem,
  type TrainingJobDetail,
  type TrainingJobDuty,
  type TrainingPerson,
} from "@/services/api/trainingActivities";
import {
  day,
  trainingBreadcrumbs,
  when,
  statusChange,
} from "../shared/trainingLabels";
import {
  ReadonlyField,
  ReadonlyGrid,
  TabBlock,
  TrainingDetailLayout,
} from "../shared/TrainingDetailLayout";
import { TrainingPersonRelatedCard } from "../shared/TrainingPersonRelatedCard";
import { TrainingCopyBlock } from "../shared/TrainingCopyBlock";
import {
  SignatureFields,
  type SignatureRecord,
} from "@/features/documents/shared/components/SignatureFields";
import { useTrainingBack } from "../shared/useTrainingBack";

import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { tr, trFormat } from "@/i18n";

type Dialog = "exception" | "cancel" | undefined;
interface SignRequest {
  title: string;
  code: string;
  name: string;
  changes: ReturnType<typeof statusChange>;
  run: (token: string) => Promise<TrainingJobDetail>;
}

/** Part 4 of the form as it is written on paper: the Vietnamese text, the English one in italic under it, one row for each duty. */
function DutiesTable({ duties }: { duties: TrainingJobDuty[] }) {
  const cell = (vn?: string | null, en?: string | null) => (
    <>
      {(vn ?? "").split(/\r?\n/).filter((l) => l.trim()).map((l, i) => <p key={`v${i}`}>{l}</p>)}
      {(en ?? "").split(/\r?\n/).filter((l) => l.trim()).map((l, i) => <p key={`e${i}`} className="italic text-slate-600">{l}</p>)}
    </>
  );
  return (
    <div className="overflow-x-auto">
      <TableMarkup.Root className="w-full border-collapse text-sm">
        <TableMarkup.Head>
          <TableMarkup.Row className="bg-slate-50 text-left">
            <TableMarkup.HeaderCell className="w-1/2 border border-slate-200 px-3 py-2 font-semibold">{tr("Trách nhiệm /")} <span className="italic">{tr("Responsibility")}</span></TableMarkup.HeaderCell>
            <TableMarkup.HeaderCell className="w-1/2 border border-slate-200 px-3 py-2 font-semibold">{tr("Mô tả công việc /")} <span className="italic">{tr("Job description")}</span></TableMarkup.HeaderCell>
          </TableMarkup.Row>
        </TableMarkup.Head>
        <TableMarkup.Body>
          {duties.map((d, i) => (
            <TableMarkup.Row key={i} className="align-top">
              <TableMarkup.Cell className="space-y-1 border border-slate-200 px-3 py-2">{cell(d.responsibility, d.responsibilityEn)}</TableMarkup.Cell>
              <TableMarkup.Cell className="space-y-1 border border-slate-200 px-3 py-2">{cell(d.description, d.descriptionEn)}</TableMarkup.Cell>
            </TableMarkup.Row>
          ))}
        </TableMarkup.Body>
      </TableMarkup.Root>
    </div>
  );
}

/** One job assignment: the facts, the duties, the matrix check, and the two signatures. */
export function TrainingJobDetailPage() {
  const { jobId = "" } = useParams();
  const goBack = useTrainingBack("/training-management/job-assignments");
  const { showToast } = useToast();
  const [job, setJob] = useState<TrainingJobDetail>();
  const [error, setError] = useState("");
  const [tab, setTab] = useViewState("TrainingJobDetailPage.tab", "overview");
  const [form, setForm] = useState({
    directSuperiorTitle: "",
    subordinateTitles: "",
    substituteTitle: "",
    changeReason: "",
    jurisdiction: "",
  });
  const [duties, setDuties] = useState<TrainingJobDuty[]>([]);
  const [required, setRequired] = useState<PickedTraining[]>([]);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<SignRequest>();
  const [busy, setBusy] = useState(false);

  const apply = useCallback((j: TrainingJobDetail) => {
    setJob(j);
    setForm({
      directSuperiorTitle: j.directSuperiorTitle ?? "",
      subordinateTitles: j.subordinateTitles ?? "",
      substituteTitle: j.substituteTitle ?? "",
      changeReason: j.changeReason ?? "",
      jurisdiction: j.jurisdiction ?? "",
    });
    setDuties(j.duties);
    setRequired((j.requiredItems ?? []).map((r) => ({ kind: r.topicText ? "TOPIC" as const : "DOCUMENT" as const, id: (r.topicText ?? r.documentId) as string, code: r.code ?? "", title: r.title })));
    setDirty(false);
  }, []);
  const refetch = useCallback(() => {
    trainingJobsApi
      .get(jobId)
      .then(apply)
      .catch((e) => setError(trainingError(e)));
  }, [jobId, apply]);
  useEffect(refetch, [refetch]);
  const editing = useRef(false);
  editing.current = dirty;
  useEntityChanged(["TRAINING"], () => {
    if (!editing.current) refetch();
  });

  const run = async (
    action: () => Promise<TrainingJobDetail>,
    done: string,
  ) => {
    setBusy(true);
    try {
      apply(await action());
      showToast({ type: "success", title: done, message: "" });
      setDialog(undefined);
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

  const title = "Job Assignment Details";
  // Leaving with changes that were not saved asks first (Back, the breadcrumb, the sidebar, a reload).
  const { go, confirmLeave, modal: leaveModal } = useLeaveGuard(dirty, title, "the previous page");
  const crumbs = trainingBreadcrumbs(go, "jobs", title);
  if (!job) {
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
  const caps = job.capabilities;
  const body = () => ({ ...form, duties, version: job.version, requiredTopics: pickedIds(required).topics, requiredDocumentIds: pickedIds(required).documentIds });
  const tabs: TabItem[] = [
    { id: "overview", label: tr("General Information") },
    { id: "duties", label: "Duties", count: duties.length },
    { id: "matrix", label: tr("Matrix Check") },
    { id: "signatures", label: tr("Signatures") },
    { id: "audit", label: tr("Audit Trail") },
  ];
  const eligibility = job.eligibility;
  // The Signatures tab reads like the one of a document: "<Action> By" and "<Action> On (Date - Time)", read-only. The exception is shown only when one was asked for.
  const signed = (meaning: string) =>
    (job.signatures ?? []).filter((s) => s.meaning === meaning).at(-1);
  const signatureRecords: SignatureRecord[] = [
    {
      code: "TRAINING_JOB_ASSIGNED",
      by: "Assigned By",
      on: "Assigned On (Date - Time)",
    },
    ...(job.exceptionReason || signed("TRAINING_JOB_EXCEPTION_APPROVED")
      ? [
          {
            code: "TRAINING_JOB_EXCEPTION_APPROVED",
            by: "Exception Approved By",
            on: "Exception Approved On (Date - Time)",
          },
        ]
      : []),
    {
      code: "TRAINING_JOB_ACCEPTED",
      by: "Accepted By",
      on: "Accepted On (Date - Time)",
    },
  ].map((f) => ({
    actionBy: f.by,
    actionByName: signed(f.code)?.fullName ?? "",
    actionOn: f.on,
    actionOnValue: signed(f.code)?.signedAt ?? "",
  }));
  const itemColumns: DataTableColumn<TrainingEligibilityItem>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    {
      id: "title",
      header: tr("Required training"),
      cell: (i) => (
        <div className="max-w-80 whitespace-normal">
          {i.code ? `${i.code} — ` : ""}
          {i.title}
        </div>
      ),
    },
    {
      id: "annual",
      header: "Annual",
      cell: (i) => (i.annualRequired ? "Yes" : "No"),
    },
    { id: "role", header: tr("Work Position"), cell: (i) => i.jobRoleName ?? "—" },
    { id: "source", header: tr("Required by"), cell: (i) => (i.source === "CHOSEN" ? tr("Ticked for this assignment") : i.source === "FACTORY" ? tr("All employees (Quality Assurance)") : "Matrix") },
    { id: "last", header: tr("Last trained"), cell: (i) => day(i.lastDone) },
    {
      id: "status",
      header: "Status",
      cell: (i) =>
        i.status === "UPDATE_NEEDED" ? (
          <Badge color="amber">{tr("New revision not trained")}</Badge>
        ) : i.status === "DUE" ? (
          <Badge color="amber">{tr("Annual training due")}</Badge>
        ) : i.lastDone ? (
          <Badge color="emerald">{tr("Trained")}</Badge>
        ) : (
          <Badge color="red">{tr("Not trained")}</Badge>
        ),
    },
  ];
  const editable = caps.edit;

  const footer = (
    <>
      {editable && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          loading={busy}
          disabled={!dirty}
          onClick={() =>
            void run(
              () => trainingJobsApi.update(job.id, body()),
              "Draft saved",
            )
          }
        >
          {tr("Save Draft")}
        </Button>
      )}
      {caps.requestException && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() => setDialog("exception")}
        >
          {tr("Request Exception")}
        </Button>
      )}
      {caps.approveException && (
        <Button
          size="sm"
          variant="default"
          className="whitespace-nowrap"
          onClick={() =>
            setSign({
              title: tr("Complete Approval of the Exception"),
              code: "TRAINING_JOB_EXCEPTION_APPROVED",
              name: "Job Assignment Exception Approved",
              changes: statusChange(
                "Exception requested",
                "Exception approved",
                "Exception",
              ),
              run: (t) => trainingJobsApi.approveException(job.id, t),
            })
          }
        >
          {tr("Complete Approval")}
        </Button>
      )}
      {caps.submit && (
        <Button
          size="sm"
          variant="default"
          className="whitespace-nowrap"
          disabled={dirty}
          onClick={() =>
            setSign({
              title: tr("Assign Job"),
              code: "TRAINING_JOB_ASSIGNED",
              name: "Job Assigned",
              changes: statusChange("Draft", "Pending Employee Acceptance"),
              run: (t) => trainingJobsApi.submit(job.id, job.version, t),
            })
          }
        >
          {tr("Sign and Send")}
        </Button>
      )}
      {caps.accept && (
        <Button
          size="sm"
          variant="default"
          className="whitespace-nowrap"
          onClick={() =>
            setSign({
              title: tr("Accept Job Assignment"),
              code: "TRAINING_JOB_ACCEPTED",
              name: "Job Accepted",
              changes: statusChange("Pending Employee Acceptance", "Effective"),
              run: (t) => trainingJobsApi.accept(job.id, job.version, t),
            })
          }
        >
          {tr("Accept")}
        </Button>
      )}
      {caps.cancel && (
        <PaperPrintButton
          items={[
            {
              key: job.id,
              load: (format, reason) =>
                trainingFormsApi.jobAssignmentPaper(job.id, format, reason),
              fileName: (format) =>
                `APD.0024-${job.personName}-${job.issueNo}-paper.${format}`,
            },
          ]}
        />
      )}
      {job.status !== "CANCELLED" && (
        <FormDownloadButtons
          label={tr("The job assignment")}
          load={(format) => trainingFormsApi.jobAssignment(job.id, format)}
          fileName={(format) =>
            `APD.0024-${job.personName}-${job.issueNo}.${format}`
          }
        />
      )}
      {caps.cancel && (
        <Button
          size="sm"
          variant="destructive"
          className="whitespace-nowrap"
          onClick={() => setDialog("cancel")}
        >
          {tr("Cancel")}
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
        workflow={job.workflow}
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-job-detail-tab"
        footer={footer}
        afterFooter={
          <TrainingPersonRelatedCard
            personId={job.personUserId}
            extraTabs={
              job.status === "EFFECTIVE"
                ? [
                    {
                      id: "copies",
                      label: tr("Copies Sent To Departments"),
                      node: (
                        <TrainingCopyBlock
                          type="job-assignment"
                          objectId={job.id}
                          title=""
                        />
                      ),
                    },
                  ]
                : []
            }
          />
        }
      >
        {tab === "overview" && (
          <div className="space-y-6">
            <ReadonlyGrid>
              <ReadonlyField label={tr("Employee")} value={job.personName} />
              <ReadonlyField label={(job.roles?.length ?? 0) > 1 ? tr("Work Positions") : tr("Work Position")} wide>
                <div className="min-h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2"><WorkPositionsPreview assignmentId={job.id} personName={job.personName} positions={job.roles} fallback={job.positionName} limit={4} /></div>
              </ReadonlyField>
              <ReadonlyField label={tr("Department")} value={job.departmentName} />
              <ReadonlyField
                label={tr("Type")}
                value={
                  job.caseType === "INITIAL"
                    ? tr("Initial")
                    : trFormat("Change (from {position})", { position: job.previousPositionName ?? "—" })
                }
              />
              <ReadonlyField label={tr("Issue")} value={String(job.issueNo)} />
              <ReadonlyField label={tr("Effective")} value={day(job.effectiveAt)} />
              {job.assignorTitle && (
                <ReadonlyField
                  label={tr("Assigned by (title)")}
                  value={job.assignorTitle}
                  wide
                />
              )}
              {job.cancelReason && (
                <ReadonlyField
                  label={tr("Reason for cancelling")}
                  value={job.cancelReason}
                  wide
                />
              )}
            </ReadonlyGrid>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {(
                [
                  ["directSuperiorTitle", "Job title of direct superior", false],
                  ["subordinateTitles", "Job title of subordinates", true],
                  ["substituteTitle", "Substitute in absence", false],
                ] as const
              ).map(([key, label, multiple]) => (
                <FormField key={key} label={label}>
                  <PersonTitlePicker
                    label={label}
                    value={form[key]}
                    multiple={multiple}
                    disabled={!editable}
                    onChange={(v) => {
                      setForm({ ...form, [key]: v });
                      setDirty(true);
                    }}
                  />
                </FormField>
              ))}
              <FormField label={tr("Jurisdiction")}>
                <Input
                  value={form.jurisdiction}
                  disabled={!editable}
                  onChange={(e) => {
                    setForm({ ...form, jurisdiction: e.target.value });
                    setDirty(true);
                  }}
                />
              </FormField>
              {(job.caseType === "CHANGE" || form.changeReason) && (
                <div className="md:col-span-2">
                  <FormField
                    label={tr("Reason for the change")}
                    required={job.caseType === "CHANGE"}
                  >
                    <Textarea
                      rows={2}
                      value={form.changeReason}
                      disabled={!editable}
                      onChange={(e) => {
                        setForm({ ...form, changeReason: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "duties" && (
          <TabBlock
            title={tr("Duties")}
            action={
              editable ? (
                <Button
                  size="sm"
                  variant="outline-emerald"
                  onClick={() => {
                    setDuties([
                      ...duties,
                      { responsibility: "", description: "" },
                    ]);
                    setDirty(true);
                  }}
                >
                  {tr("Add duty")}
                </Button>
              ) : undefined
            }
          >
            {duties.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">{tr("No duty yet.")}</p>
            ) : editable ? (
              <div className="divide-y divide-slate-100">
                <p className="p-3 text-xs text-slate-600">{tr("Part 4 of the form APD.0024. Write the Vietnamese text and, under it, the English one: the Word file has the English in italic under the Vietnamese. One box can hold several lines (one paragraph for each line).")}</p>
                {duties.map((d, i) => {
                  const set = (patch: Partial<TrainingJobDuty>) => { setDuties(duties.map((x, k) => (k === i ? { ...x, ...patch } : x))); setDirty(true); };
                  return (
                    <div key={i} className="space-y-3 p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">{tr("Duty")} {i + 1}</h4>
                        <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { setDuties(duties.filter((_x, k) => k !== i)); setDirty(true); }}>{tr("Remove")}</button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FormField label={tr("Responsibility (Vietnamese)")} required><Textarea rows={4} maxLength={2000} value={d.responsibility} onChange={(e) => set({ responsibility: e.target.value })} /></FormField>
                        <FormField label={tr("Responsibility (English)")}><Textarea rows={4} maxLength={2000} value={d.responsibilityEn ?? ""} onChange={(e) => set({ responsibilityEn: e.target.value })} /></FormField>
                        <FormField label={tr("Job description (Vietnamese)")}><Textarea rows={4} maxLength={4000} value={d.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></FormField>
                        <FormField label={tr("Job description (English)")}><Textarea rows={4} maxLength={4000} value={d.descriptionEn ?? ""} onChange={(e) => set({ descriptionEn: e.target.value })} /></FormField>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <DutiesTable duties={duties} />
            )}
          </TabBlock>
        )}

        {tab === "matrix" && (
          <div className="space-y-4">
            <TabBlock title={tr("Other trainings required before the Work Position is given")} count={required.length}>
              <div className="space-y-3 p-4 md:p-5">
                <RequiredTrainingsField value={required} disabled={!editable} showChosen onChange={(next) => { setRequired(next); setDirty(true); }} />
                {editable && <p className="text-xs text-slate-600">{tr("Save the draft to check them against the training records of the person.")}</p>}
              </div>
            </TabBlock>
            {(eligibility?.openSuspensions ?? 0) > 0 && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {tr("The work of this person is suspended after a failed assessment (")}{eligibility?.openSuspensions}{tr("). It is a flag only: the assignment is not blocked. See Training Compliance, Work suspensions.")}
              </p>
            )}
            {eligibility ? (
              <TabBlock
                title={tr("Training required by the matrix")}
                action={
                  eligibility.matrixMissing ? (
                    <Badge color="amber">{tr("No effective matrix")}</Badge>
                  ) : eligibility.complete ? (
                    <Badge color="emerald">{tr("Complete")}</Badge>
                  ) : (
                    <Badge color="red">
                      {eligibility.missingCount} {tr("not trained")}
                    </Badge>
                  )
                }
              >
                {eligibility.matrixMissing ? (
                  <p className="p-4 text-sm text-amber-700">
                    {tr("The department has no effective matrix. An exception is needed to go ahead.")}
                  </p>
                ) : (
                  <DataTable
                    rows={eligibility.items}
                    getRowKey={(i) => `${i.code}|${i.title}`}
                    columns={itemColumns}
                    emptyState={
                      <p className="p-4 text-sm text-slate-500">
                        {tr("The matrix requires no training for this Work Position.")}
                      </p>
                    }
                  />
                )}
              </TabBlock>
            ) : (
              <p className="text-sm text-slate-500">
                {tr("No matrix check for this assignment.")}
              </p>
            )}
            {job.exceptionReason && (
              <ReadonlyGrid>
                <ReadonlyField
                  label={tr("Exception reason")}
                  value={job.exceptionReason}
                  wide
                />
                <ReadonlyField
                  label={tr("Exception status")}
                  value={
                    job.exceptionApprovedBy
                      ? "Approved"
                      : `Pending with ${
                          job.approvers
                            .filter((a) => a.status === "PENDING")
                            .map((a) => a.assigneeName)
                            .join(", ") || "an approver"
                        }`
                  }
                  wide
                />
              </ReadonlyGrid>
            )}
          </div>
        )}

        {tab === "signatures" && <SignatureFields records={signatureRecords} />}

        {tab === "audit" && (
          <AuditTrailTab
            entityId={job.id}
            entityType="TRAINING_JOB_ASSIGNMENT"
          />
        )}
      </TrainingDetailLayout>

      {dialog === "exception" && (
        <ExceptionDialog
          jobId={job.id}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSave={(reason, approver) =>
            run(
              () => trainingJobsApi.requestException(job.id, reason, approver),
              "Exception requested",
            )
          }
        />
      )}
      <ReasonDialog
        open={dialog === "cancel"}
        busy={busy}
        onClose={() => setDialog(undefined)}
        onSave={(reason) =>
          run(
            () => trainingJobsApi.cancel(job.id, job.version, reason),
            "Assignment cancelled",
          )
        }
      />
      <ESignatureModal
        isOpen={!!sign}
        onClose={() => setSign(undefined)}
        onConfirm={async (data: { signatureToken: string }) => {
          if (sign) {
            const ok = await run(
              () => sign.run(data.signatureToken),
              sign.title,
            );
            if (ok) setSign(undefined);
          }
        }}
        actionTitle={sign?.title}
        changes={sign?.changes}
        meaningDisplayName={sign?.name}
        meaningCode={sign?.code}
        targetDetails={{
          code: job.personName,
          title: job.positionName,
          revision: String(job.issueNo),
        }}
      />
      {leaveModal}
    </>
  );
}

function ReasonDialog({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <FormModal
      isOpen={open}
      onClose={onClose}
      onConfirm={() => onSave(reason.trim())}
      title={tr("Cancel Job Assignment")}
      description={tr("The reason stays in the record.")}
      confirmText={tr("Cancel assignment")}
      confirmVariant="destructive"
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
  );
}

function ExceptionDialog({
  jobId,
  busy,
  onClose,
  onSave,
}: {
  jobId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (reason: string, approver: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState("");
  const search = useCallback(
    async (query: string) => {
      const page = await trainingJobsApi.eligibleApprovers(jobId, query);
      setPeople(page.data);
      setLoaded(true);
      return page.data.map((p) => ({
        label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
        value: p.id,
      }));
    },
    [jobId],
  );
  useEffect(() => {
    void search("");
  }, [search]);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={() => onSave(reason.trim(), id)}
      title={tr("Request an Exception")}
      description={tr("The person goes ahead before the training is complete only if the person you choose approves, with a signature.")}
      confirmText="Request"
      isLoading={busy}
      confirmDisabled={!reason.trim() || !id}
      size="md"
    >
      <div className="grid gap-4">
        <FormField label={tr("Reason")} required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        {loaded && people.length === 0 ? (
          <p className="text-sm text-amber-700">
            {tr("No eligible approver was found.")}
          </p>
        ) : (
          <Select
            label={tr("Approver")}
            value={id}
            onChange={setId}
            options={people.map((p) => ({
              label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
              value: p.id,
            }))}
            onSearch={search}
            placeholder={tr("Search by name")}
          />
        )}
      </div>
    </FormModal>
  );
}
