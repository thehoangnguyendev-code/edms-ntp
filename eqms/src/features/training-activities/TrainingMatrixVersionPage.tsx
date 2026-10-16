import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { documentApi } from "@/services/api/documents";
import { trainingError, trainingMatrixApi, type TrainingMatrixRow, type TrainingMatrixVersion, type TrainingPerson, type TrainingTopic } from "@/services/api/trainingActivities";
import { day, trainingBreadcrumbs } from "./trainingLabels";
import { ReadonlyField, ReadonlyGrid, TabBlock, TrainingDetailLayout } from "./TrainingDetailLayout";

const GROUP_LABEL: Record<string, string> = { FACTORY_GENERAL: "General (factory)", DEPARTMENT_GENERAL: "General (department)", SOP: "SOP" };
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", PENDING_APPROVAL: "Waiting for approval", EFFECTIVE: "Effective", OBSOLETE: "Obsolete" };

const MATRIX_STEPS = [
  { status: "DRAFT", label: "Draft" },
  { status: "PENDING_APPROVAL", label: "Waiting for approval" },
  { status: "EFFECTIVE", label: "Effective" },
];

type Dialog = "addTopic" | "addDocument" | "submit" | "reject" | "upgrade" | undefined;

/** One version of a department matrix: rows are topics or documents, columns are positions. A version is edited only as a draft; after approval it never changes. */
export function TrainingMatrixVersionPage() {
  const { versionId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [version, setVersion] = useState<TrainingMatrixVersion>();
  const [rows, setRows] = useState<TrainingMatrixRow[]>([]);
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("general");
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<{ title: string; code: string; name: string; run: (token: string) => Promise<TrainingMatrixVersion> }>();
  const [busy, setBusy] = useState(false);

  const apply = useCallback((v: TrainingMatrixVersion) => {
    setVersion(v);
    setRows(v.rows);
    setReason(v.changeReason ?? "");
    setDirty(false);
  }, []);
  useEffect(() => {
    setError("");
    trainingMatrixApi.version(versionId).then(apply).catch((e) => setError(trainingError(e)));
  }, [versionId, apply]);

  const run = async (action: () => Promise<TrainingMatrixVersion>, done: string, then?: (v: TrainingMatrixVersion) => void) => {
    setBusy(true);
    try {
      const v = await action();
      apply(v);
      showToast({ type: "success", title: done, message: v.matrixCode });
      setDialog(undefined);
      then?.(v);
      return true;
    } catch (e) {
      showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const title = "Training Matrix Version Details";
  const crumbs = trainingBreadcrumbs(navigate, "matrices", title);
  const positions = useMemo(() => version?.positions ?? [], [version]);

  if (!version) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Loading matrix…" />}
      </div>
    );
  }
  const caps = version.capabilities;
  const editing = caps.edit;
  const toggle = (rowIndex: number, positionId: string) => {
    setRows(rows.map((r, i) => (i !== rowIndex ? r : { ...r, positionIds: r.positionIds.includes(positionId) ? r.positionIds.filter((p) => p !== positionId) : [...r.positionIds, positionId] })));
    setDirty(true);
  };
  const body = () => ({
    version: version.version,
    changeReason: reason.trim() || undefined,
    rows: rows.map((r) => ({ group: r.rowGroup, topicId: r.topicId ?? null, documentId: r.documentId ?? null, annualRequired: r.annualRequired, note: r.note ?? null, positionIds: r.positionIds })),
  });
  const rowTitle = (r: TrainingMatrixRow) => (r.topicId ? `${r.topicCode} — ${r.topicName}` : `${r.documentNumber} — ${r.documentName}`);

  type Line = { row: TrainingMatrixRow; index: number };
  const matrixColumns: DataTableColumn<Line>[] = [
    { id: "no", header: "No.", cell: (x) => x.index + 1 },
    { id: "group", header: "Group", cell: (x) => GROUP_LABEL[x.row.rowGroup] },
    { id: "topic", header: "Topic or SOP", cell: (x) => <div className="max-w-80 whitespace-normal">{rowTitle(x.row)}</div> },
    {
      id: "annual",
      header: "Annual",
      cell: (x) => <input type="checkbox" aria-label="Annual training" checked={x.row.annualRequired} disabled={!editing} onChange={(e) => { setRows(rows.map((r, k) => (k === x.index ? { ...r, annualRequired: e.target.checked } : r))); setDirty(true); }} />,
    },
    ...positions.map<DataTableColumn<Line>>((p) => ({
      id: `pos-${p.id}`,
      header: p.name,
      cell: (x) => <input type="checkbox" aria-label={p.name} checked={x.row.positionIds.includes(p.id)} disabled={!editing} onChange={() => toggle(x.index, p.id)} />,
    })),
    ...(editing
      ? [{ id: "remove", header: "", cell: (x: Line) => <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { setRows(rows.filter((_r, k) => k !== x.index)); setDirty(true); }}>Remove</button> }]
      : []),
  ];

  const footer = (
    <>
      <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(`/training-management/matrices/${version.matrixId}`)}>All versions</Button>
      {editing && <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" loading={busy} disabled={!dirty && reason === (version.changeReason ?? "")} onClick={() => void run(() => trainingMatrixApi.save(version.id, body()), "Draft saved")}>Save draft</Button>}
      {caps.submit && <Button size="sm" variant="default" className="whitespace-nowrap" disabled={busy || rows.length === 0} onClick={() => (dirty ? showToast({ type: "info", title: "Save the draft first", message: "" }) : setDialog("submit"))}>Send for approval</Button>}
      {caps.approve && <Button size="sm" variant="default" className="whitespace-nowrap" onClick={() => setSign({ title: "Approve matrix", code: "TRAINING_MATRIX_APPROVED", name: "Training Matrix Approved", run: (t) => trainingMatrixApi.approve(version.id, version.version, t) })}>Approve</Button>}
      {caps.reject && <Button size="sm" variant="destructive" className="whitespace-nowrap" onClick={() => setDialog("reject")}>Reject</Button>}
      {caps.upgrade && <Button size="sm" variant="default" className="whitespace-nowrap" onClick={() => setDialog("upgrade")}>New version</Button>}
    </>
  );
  const obsolete = version.status === "OBSOLETE";
  const steps = obsolete ? [...MATRIX_STEPS.map((x) => x.label).slice(0, 3), "Obsolete"] : MATRIX_STEPS.slice(0, 3).map((x) => x.label);
  const stepIndex = obsolete ? 3 : Math.max(0, MATRIX_STEPS.findIndex((x) => x.status === version.status));
  const tabs: TabItem[] = [{ id: "general", label: "General Information" }, { id: "matrix", label: "Matrix", count: rows.length }, { id: "audit", label: "Audit Trail" }];

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={crumbs}
        onBack={() => navigate("/training-management/matrices")}
        steps={steps}
        currentStepIndex={stepIndex}
        terminalProgressStep="Effective"
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-matrix-detail-tab"
        footer={footer}
      >
        {tab === "general" && (
          <div className="space-y-4">
            <ReadonlyGrid>
              <ReadonlyField label="Matrix" value={version.matrixCode} />
              <ReadonlyField label="Version" value={String(version.versionNo)} />
              <ReadonlyField label="Department" value={version.departmentName} />
              <ReadonlyField label="Status" value={STATUS_LABEL[version.status]} />
              <ReadonlyField label="Waiting for" value={version.approvers.filter((a) => a.status === "PENDING").map((a) => a.assigneeName).join(", ")} />
              <ReadonlyField label="Effective since" value={version.status === "EFFECTIVE" ? day(version.approvers.find((a) => a.status === "DONE")?.completedAt) : ""} />
              {version.rejectReason && version.status === "DRAFT" && <ReadonlyField label="Last rejection" value={version.rejectReason} wide />}
              {!editing && <ReadonlyField label="What changed in this version" value={version.changeReason} wide />}
            </ReadonlyGrid>
            {editing && (
              <FormField label="What changed in this version" required={version.versionNo > 1}>
                <Textarea rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setDirty(true); }} />
              </FormField>
            )}
          </div>
        )}
        {tab === "matrix" && (
          <TabBlock title="Matrix" action={editing ? <div className="flex gap-2"><Button size="sm" variant="outline-emerald" onClick={() => setDialog("addTopic")}>Add topic</Button><Button size="sm" variant="outline-emerald" onClick={() => setDialog("addDocument")}>Add SOP</Button></div> : undefined}>
            {positions.length === 0 ? (
              <p className="p-4 text-sm text-amber-700">This department has no position yet. Positions are managed in the dictionaries.</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No row yet.</p>
            ) : (
              <DataTable rows={rows.map((r, i) => ({ row: r, index: i }))} getRowKey={(x) => `${x.row.topicId ?? x.row.documentId}`} columns={matrixColumns} />
            )}
          </TabBlock>
        )}
        {tab === "audit" && <AuditTrailTab entityId={version.id} entityType="TRAINING_MATRIX" />}
      </TrainingDetailLayout>

      {dialog === "addTopic" && <AddTopicDialog department={version.departmentId} onClose={() => setDialog(undefined)} onAdd={(t, group) => { setRows([...rows, { rowGroup: group, topicId: t.id, topicCode: t.code, topicName: t.name, annualRequired: false, positionIds: [] }]); setDirty(true); setDialog(undefined); }} existing={rows} />}
      {dialog === "addDocument" && <AddDocumentDialog onClose={() => setDialog(undefined)} existing={rows} onAdd={(d) => { setRows([...rows, { rowGroup: "SOP", documentId: d.id, documentNumber: d.documentNumber, documentName: d.documentName, annualRequired: false, positionIds: [] }]); setDirty(true); setDialog(undefined); }} />}
      {dialog === "submit" && <SubmitDialog versionId={version.id} busy={busy} onClose={() => setDialog(undefined)} onSubmit={(approver) => { setDialog(undefined); setSign({ title: "Send matrix for approval", code: "TRAINING_MATRIX_PREPARED", name: "Training Matrix Prepared", run: (t) => trainingMatrixApi.submit(version.id, version.version, t, approver) }); }} />}
      {dialog === "reject" && (
        <RejectDialog busy={busy} onClose={() => setDialog(undefined)} onReject={(why) => run(() => trainingMatrixApi.reject(version.id, version.version, why), "Version sent back to draft")} />
      )}
      <FormModal isOpen={dialog === "upgrade"} onClose={() => setDialog(undefined)} title="Start a new version" description="A copy of this version is opened as a draft. This version stays effective until the new one is approved." confirmText="Start" isLoading={busy} size="md"
        onConfirm={() => void run(() => trainingMatrixApi.upgrade(version.matrixId), "New version started", (v) => navigate(`/training-management/matrix-versions/${v.id}`))}>
        <p className="text-sm text-slate-600">Only one version can be prepared at a time.</p>
      </FormModal>
      <ESignatureModal
        isOpen={!!sign}
        onClose={() => setSign(undefined)}
        onConfirm={async (data: { signatureToken: string }) => { if (sign) { const ok = await run(() => sign.run(data.signatureToken), sign.title); if (ok) setSign(undefined); } }}
        actionTitle={sign?.title}
        meaningDisplayName={sign?.name}
        meaningCode={sign?.code}
        targetDetails={{ code: version.matrixCode, title: version.departmentName, revision: String(version.versionNo) }}
      />
    </>
  );
}

function AddTopicDialog({ department, existing, onClose, onAdd }: { department: string; existing: TrainingMatrixRow[]; onClose: () => void; onAdd: (t: TrainingTopic, group: "FACTORY_GENERAL" | "DEPARTMENT_GENERAL") => void }) {
  const [topics, setTopics] = useState<TrainingTopic[]>([]);
  const [id, setId] = useState("");
  useEffect(() => { trainingMatrixApi.topics(undefined, true).then(setTopics).catch(() => setTopics([])); }, []);
  const usable = topics.filter((t) => !existing.some((r) => r.topicId === t.id) && (t.scope !== "DEPARTMENT_GENERAL" || t.departmentId === department));
  const chosen = usable.find((t) => t.id === id);
  return (
    <FormModal isOpen onClose={onClose} title="Add a topic" description="Standard topics are kept in Training Administration. A SOP is added with Add SOP." confirmText="Add" confirmDisabled={!chosen} size="md" onConfirm={() => chosen && onAdd(chosen, chosen.scope === "FACTORY_GENERAL" ? "FACTORY_GENERAL" : "DEPARTMENT_GENERAL")}>
      <FormField label="Topic" required>
        <Select value={id} onChange={setId} options={usable.map((t) => ({ label: `${t.code} — ${t.name}`, value: t.id }))} placeholder="Choose a topic" />
      </FormField>
    </FormModal>
  );
}

function AddDocumentDialog({ existing, onClose, onAdd }: { existing: TrainingMatrixRow[]; onClose: () => void; onAdd: (d: { id: string; documentNumber: string; documentName: string }) => void }) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [docs, setDocs] = useState<Record<string, { id: string; documentNumber: string; documentName: string }>>({});
  const [id, setId] = useState("");
  const search = useCallback(async (query: string) => {
    const page = await documentApi.getDocumentsPage({ search: query, page: 1, limit: 20 } as never);
    const list = (page.data as unknown as { id: string; documentNumber: string; documentName: string }[]).filter((d) => !existing.some((r) => r.documentId === d.id));
    setDocs((old) => ({ ...old, ...Object.fromEntries(list.map((d) => [d.id, d])) }));
    const mapped = list.map((d) => ({ label: `${d.documentNumber} — ${d.documentName}`, value: d.id }));
    setOptions(mapped);
    return mapped;
  }, [existing]);
  useEffect(() => { void search(""); }, [search]);
  return (
    <FormModal isOpen onClose={onClose} title="Add a SOP" description="The row applies to the revision of the document that is effective at the time." confirmText="Add" confirmDisabled={!docs[id]} size="md" onConfirm={() => docs[id] && onAdd(docs[id])}>
      <FormField label="Document" required>
        <Select value={id} onChange={setId} options={options} onSearch={search} placeholder="Search a document" />
      </FormField>
    </FormModal>
  );
}

function SubmitDialog({ versionId, busy, onClose, onSubmit }: { versionId: string; busy: boolean; onClose: () => void; onSubmit: (approver: string) => void }) {
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState("");
  const search = useCallback(async (query: string) => {
    const page = await trainingMatrixApi.eligibleApprovers(versionId, query);
    setPeople(page.data);
    setLoaded(true);
    return page.data.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }));
  }, [versionId]);
  useEffect(() => { void search(""); }, [search]);
  return (
    <FormModal isOpen onClose={onClose} title="Send for approval" description="Choose who approves this version. Only people the system found eligible are listed: they hold the approval permission, are in this department, and are not you." confirmText="Continue to signature" isLoading={busy} confirmDisabled={!id} size="md" onConfirm={() => onSubmit(id)}>
      {loaded && people.length === 0 ? (
        <p className="text-sm text-amber-700">No eligible person was found. A person needs the permission to approve matrices in this department.</p>
      ) : (
        <Select label="Approver" value={id} onChange={setId} options={people.map((p) => ({ label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`, value: p.id }))} onSearch={search} placeholder="Search by name" />
      )}
    </FormModal>
  );
}

function RejectDialog({ busy, onClose, onReject }: { busy: boolean; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormModal isOpen onClose={onClose} title="Reject this version" description="The version goes back to draft with your reason." confirmText="Reject" confirmVariant="destructive" isLoading={busy} confirmDisabled={!reason.trim()} size="md" onConfirm={() => onReject(reason.trim())}>
      <FormField label="Reason" required><Input value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
    </FormModal>
  );
}
