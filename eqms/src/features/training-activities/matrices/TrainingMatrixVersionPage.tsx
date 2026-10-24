import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Input, Textarea } from "../shared/TrainingFields";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { documentApi } from "@/services/api/documents";
import {
  trainingError,
  trainingMatrixApi,
  type TrainingMatrixRow,
  type TrainingMatrixVersion,
  type TrainingPerson,
  type TrainingTopic,
} from "@/services/api/trainingActivities";
import { day, saveBlob, trainingBreadcrumbs, statusChange } from "../shared/trainingLabels";
import {
  ReadonlyField,
  ReadonlyGrid,
  TrainingDetailLayout,
} from "../shared/TrainingDetailLayout";
import { TrainingMatrixGrid } from "./components/TrainingMatrixGrid";
import { TrainingMatrixVersionsPanel } from "./TrainingMatrixVersionsPanel";
import { trainingFollowUpApi } from "@/services/api/trainingActivities";
import { useTrainingBack } from "../shared/useTrainingBack";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  EFFECTIVE: "Effective",
  OBSOLETE: "Obsolete",
};

const NEXT_STEP: Record<string, string> = {
  DRAFT: "This version is a draft. Edit the matrix, save it, then submit it for approval with an electronic signature.",
  PENDING_APPROVAL: "This version is waiting for the approver. It cannot be changed until it is approved or sent back.",
  EFFECTIVE: "This version is in use: it tells who must be trained on what. To change the matrix, start a new version.",
  OBSOLETE: "This version was replaced by a newer one and stays as history. It cannot be changed.",
};

const MATRIX_STEPS = [
  { status: "DRAFT", label: "Draft" },
  { status: "PENDING_APPROVAL", label: "Pending Approval" },
  { status: "EFFECTIVE", label: "Effective" },
];

type Dialog =
  | "addTopic"
  | "addDocument"
  | "submit"
  | "reject"
  | "upgrade"
  | undefined;

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
  const { hasPermission } = usePermissions();
  const goBack = useTrainingBack(hasPermission("training.scope.all") ? "/training-management/matrix" : "/training-management/my-training");
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = ["matrix", "general", "audit"].includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "matrix";
  const setTab = (id: string) => setSearchParams({ tab: id }, { replace: true });
  const [dialog, setDialog] = useState<Dialog>();
  const [sign, setSign] = useState<{
    title: string;
    code: string;
    name: string;
    changes: ReturnType<typeof statusChange>;
    run: (token: string) => Promise<TrainingMatrixVersion>;
  }>();
  const [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState<{ rows: TrainingMatrixRow[]; versionNo: number }>();

  const apply = useCallback((v: TrainingMatrixVersion) => {
    setVersion(v);
    setRows(v.rows);
    setReason(v.changeReason ?? "");
    setDirty(false);
  }, []);
  const refetch = useCallback(() => {
    setError("");
    trainingMatrixApi
      .version(versionId)
      .then(apply)
      .catch((e) => setError(trainingError(e)));
  }, [versionId, apply]);
  useEffect(refetch, [refetch]);
  const unsaved = useRef(false);
  unsaved.current = dirty;
  useEntityChanged(["TRAINING"], () => {
    if (!unsaved.current) refetch();
  });

  const run = async (
    action: () => Promise<TrainingMatrixVersion>,
    done: string,
    then?: (v: TrainingMatrixVersion) => void,
  ) => {
    setBusy(true);
    try {
      const v = await action();
      apply(v);
      showToast({ type: "success", title: done, message: v.matrixCode });
      setDialog(undefined);
      then?.(v);
      return true;
    } catch (e) {
      showToast({
        type: "error",
        title: "The action was not done",
        message: trainingError(e),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  // A version being prepared or waiting for approval is shown against the version before it, so that what changed stands out.
  const versionNo = version?.versionNo;
  const status = version?.status;
  const matrixId = version?.matrixId;
  useEffect(() => {
    setBaseline(undefined);
    if (!versionId || !matrixId || !versionNo || versionNo < 2 || (status !== "DRAFT" && status !== "PENDING_APPROVAL")) return;
    let alive = true;
    trainingMatrixApi.versions(matrixId)({ page: 1, limit: 100 })
      .then((page) => page.data.find((v) => v.id === versionId)?.previousId)
      .then((previousId) => (previousId ? trainingMatrixApi.version(previousId) : undefined))
      .then((previous) => { if (alive && previous) setBaseline({ rows: previous.rows, versionNo: previous.versionNo }); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [versionId, matrixId, versionNo, status]);

  // SOP.0003 5.3.1: documents issued or revised whose effect on the matrix is not assessed, or whose matrix update is not done yet.
  const departmentOfVersion = version?.departmentId;
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    setWaiting(0);
    if (!departmentOfVersion || !hasPermission("training.matrix.view")) return;
    let alive = true;
    trainingFollowUpApi.documentTrainingsSummary(departmentOfVersion).then((s) => { if (alive) setWaiting(s.pending + s.matrixUpdatePending); }).catch(() => undefined);
    return () => { alive = false; };
  }, [departmentOfVersion, version?.version]);

  const title = "Training Matrix";
  const crumbs = trainingBreadcrumbs(navigate, "matrices", title);
  const positions = useMemo(() => version?.positions ?? [], [version]);

  if (!version) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} breadcrumbItems={crumbs} />
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : (
          <SectionLoading text="Loading matrix…" />
        )}
      </div>
    );
  }
  const caps = version.capabilities;
  const editing = caps.edit;
  const toggle = (rowIndex: number, positionId: string) => {
    setRows(
      rows.map((r, i) =>
        i !== rowIndex
          ? r
          : {
              ...r,
              positionIds: r.positionIds.includes(positionId)
                ? r.positionIds.filter((p) => p !== positionId)
                : [...r.positionIds, positionId],
            },
      ),
    );
    setDirty(true);
  };
  const body = () => ({
    version: version.version,
    changeReason: reason.trim() || undefined,
    rows: rows.map((r) => ({
      group: r.rowGroup,
      topicId: r.topicId ?? null,
      documentId: r.documentId ?? null,
      annualRequired: r.annualRequired,
      note: r.note ?? null,
      positionIds: r.positionIds,
    })),
  });

  const footer = (
    <>
      {editing && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          loading={busy}
          disabled={!dirty && reason === (version.changeReason ?? "")}
          onClick={() =>
            void run(
              () => trainingMatrixApi.save(version.id, body()),
              "Draft saved",
            )
          }
        >
          Save draft
        </Button>
      )}
      {caps.submit && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          disabled={busy || rows.length === 0}
          onClick={() =>
            dirty
              ? showToast({
                  type: "info",
                  title: "Save the draft first",
                  message: "",
                })
              : setDialog("submit")
          }
        >
          Submit for Approval
        </Button>
      )}
      {caps.approve && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() =>
            setSign({
              title: "Complete Approval of the Matrix",
              changes: statusChange("Pending Approval", "Effective"),
              code: "TRAINING_MATRIX_APPROVED",
              name: "Training Matrix Approved",
              run: (t) =>
                trainingMatrixApi.approve(version.id, version.version, t),
            })
          }
        >
          Complete Approval
        </Button>
      )}
      {caps.reject && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() => setDialog("reject")}
        >
          Reject
        </Button>
      )}
      {(version.status === "EFFECTIVE" || version.status === "OBSOLETE") && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() =>
            void trainingMatrixApi
              .print(version.id)
              .then((b) =>
                saveBlob(b, `${version.matrixCode}-v${version.versionNo}.pdf`),
              )
              .catch((e) =>
                showToast({
                  type: "error",
                  title: "The PDF could not be printed",
                  message: trainingError(e),
                }),
              )
          }
        >
          Print PDF
        </Button>
      )}
      {caps.upgrade && (
        <Button
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
          onClick={() => setDialog("upgrade")}
        >
          New version
        </Button>
      )}
    </>
  );
  const obsolete = version.status === "OBSOLETE";
  const steps = obsolete
    ? [...MATRIX_STEPS.map((x) => x.label).slice(0, 3), "Obsolete"]
    : MATRIX_STEPS.slice(0, 3).map((x) => x.label);
  const stepIndex = obsolete
    ? 3
    : Math.max(
        0,
        MATRIX_STEPS.findIndex((x) => x.status === version.status),
      );
  const tabs: TabItem[] = [
    { id: "matrix", label: "Matrix", count: rows.length },
    { id: "general", label: "General Information" },
    { id: "audit", label: "Audit Trail" },
  ];

  return (
    <>
      <TrainingDetailLayout
        title={title}
        breadcrumbItems={crumbs}
        onBack={goBack}
        steps={steps}
        currentStepIndex={stepIndex}
        terminalProgressStep="Effective"
        tabs={tabs}
        activeTab={tab}
        onTab={setTab}
        tabLayoutId="training-matrix-detail-tab"
        footer={footer}
        repeatFooterInHeader
        afterFooter={
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <TabNav tabs={[{ id: "versions", label: "Matrix Versions" }]} activeTab="versions" onChange={() => undefined} variant="simple-underline" />
            <div className="p-4 md:p-5">
              <TrainingMatrixVersionsPanel matrixId={version.matrixId} currentVersionId={version.id} />
            </div>
          </div>
        }
      >
        <p className="mb-3 text-sm text-slate-700">{NEXT_STEP[version.status]}</p>
        {waiting > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {waiting} new or revised document{waiting === 1 ? "" : "s"} of this department {waiting === 1 ? "waits" : "wait"} for the matrix to be assessed or updated.{" "}
            <button type="button" className="font-medium underline" onClick={() => navigate("/training-management/document-trainings")}>Open Document Trainings</button>
          </p>
        )}
        {tab === "general" && (
          <div className="space-y-4">
            <ReadonlyGrid>
              <ReadonlyField label="Matrix" value={version.matrixCode} />
              <ReadonlyField
                label="Version"
                value={String(version.versionNo)}
              />
              <ReadonlyField
                label="Department"
                value={version.departmentName}
              />
              <ReadonlyField
                label="Status"
                value={STATUS_LABEL[version.status]}
              />
              <ReadonlyField
                label="Pending With"
                value={version.approvers
                  .filter((a) => a.status === "PENDING")
                  .map((a) => a.assigneeName)
                  .join(", ")}
              />
              <ReadonlyField
                label="Effective since"
                value={
                  version.status === "EFFECTIVE"
                    ? day(
                        version.approvers.find((a) => a.status === "DONE")
                          ?.completedAt,
                      )
                    : ""
                }
              />
              {version.rejectReason && version.status === "DRAFT" && (
                <ReadonlyField
                  label="Last rejection"
                  value={version.rejectReason}
                  wide
                />
              )}
              {!editing && (
                <ReadonlyField
                  label="What changed in this version"
                  value={version.changeReason}
                  wide
                />
              )}
            </ReadonlyGrid>
            {editing && (
              <FormField
                label="What changed in this version"
                required={version.versionNo > 1}
              >
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setDirty(true);
                  }}
                />
              </FormField>
            )}
          </div>
        )}
        {tab === "matrix" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Matrix</h3>
              <div className="flex flex-wrap gap-2">
                {hasPermission("training.admin.manage") && (
                  <>
                    <Button size="sm" variant="outline-emerald" onClick={() => navigate(ROUTES.SETTINGS.TRAINING_ADMINISTRATION.TOPICS)}>Manage topics</Button>
                    <Button size="sm" variant="outline-emerald" onClick={() => navigate(ROUTES.SETTINGS.TRAINING_ADMINISTRATION.PERSON_POSITIONS)}>Assign positions</Button>
                  </>
                )}
              {editing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline-emerald"
                    onClick={() => setDialog("addTopic")}
                  >
                    Add topic
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-emerald"
                    onClick={() => setDialog("addDocument")}
                  >
                    Add SOP
                  </Button>
                </>
              ) : undefined}
              </div>
            </div>
            {positions.length === 0 ? (
              <p className="p-4 text-sm text-amber-700">
                This department has no position yet. Positions are managed in
                the dictionaries.
              </p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No row yet.</p>
            ) : (
              <TrainingMatrixGrid
                rows={rows}
                positions={positions}
                editing={editing}
                baseline={baseline?.rows}
                baselineNo={baseline?.versionNo}
                onToggle={toggle}
                onAnnual={(index, annual) => {
                  setRows(
                    rows.map((r, k) =>
                      k === index ? { ...r, annualRequired: annual } : r,
                    ),
                  );
                  setDirty(true);
                }}
                onRemove={(index) => {
                  setRows(rows.filter((_r, k) => k !== index));
                  setDirty(true);
                }}
              />
            )}
          </div>
        )}
        {tab === "audit" && (
          <AuditTrailTab entityId={version.id} entityType="TRAINING_MATRIX" />
        )}
      </TrainingDetailLayout>

      {dialog === "addTopic" && (
        <AddTopicDialog
          department={version.departmentId}
          onClose={() => setDialog(undefined)}
          onAdd={(t, group) => {
            setRows([
              ...rows,
              {
                rowGroup: group,
                topicId: t.id,
                topicCode: t.code,
                topicName: t.name,
                annualRequired: false,
                positionIds: [],
              },
            ]);
            setDirty(true);
            setDialog(undefined);
          }}
          existing={rows}
        />
      )}
      {dialog === "addDocument" && (
        <AddDocumentDialog
          onClose={() => setDialog(undefined)}
          existing={rows}
          onAdd={(d) => {
            setRows([
              ...rows,
              {
                rowGroup: "SOP",
                documentId: d.id,
                documentNumber: d.documentNumber,
                documentName: d.documentName,
                annualRequired: false,
                positionIds: [],
              },
            ]);
            setDirty(true);
            setDialog(undefined);
          }}
        />
      )}
      {dialog === "submit" && (
        <SubmitDialog
          versionId={version.id}
          busy={busy}
          onClose={() => setDialog(undefined)}
          onSubmit={(approver) => {
            setDialog(undefined);
            setSign({
              title: "Send Matrix for Approval",
              changes: statusChange("Draft", "Pending Approval"),
              code: "TRAINING_MATRIX_PREPARED",
              name: "Training Matrix Prepared",
              run: (t) =>
                trainingMatrixApi.submit(
                  version.id,
                  version.version,
                  t,
                  approver,
                ),
            });
          }}
        />
      )}
      {dialog === "reject" && (
        <RejectDialog
          busy={busy}
          onClose={() => setDialog(undefined)}
          onReject={(why) =>
            run(
              () => trainingMatrixApi.reject(version.id, version.version, why),
              "Version sent back to draft",
            )
          }
        />
      )}
      <FormModal
        isOpen={dialog === "upgrade"}
        onClose={() => setDialog(undefined)}
        title="Start a New Version"
        description="A copy of this version is opened as a draft. This version stays effective until the new one is approved."
        confirmText="Start"
        isLoading={busy}
        size="md"
        onConfirm={() =>
          void run(
            () => trainingMatrixApi.upgrade(version.matrixId),
            "New version started",
            (v) => navigate(`/training-management/matrix/${v.id}`),
          )
        }
      >
        <p className="text-sm text-slate-600">
          Only one version can be prepared at a time.
        </p>
      </FormModal>
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
          code: version.matrixCode,
          title: version.departmentName,
          revision: String(version.versionNo),
        }}
      />
    </>
  );
}

function AddTopicDialog({
  department,
  existing,
  onClose,
  onAdd,
}: {
  department: string;
  existing: TrainingMatrixRow[];
  onClose: () => void;
  onAdd: (
    t: TrainingTopic,
    group: "FACTORY_GENERAL" | "DEPARTMENT_GENERAL",
  ) => void;
}) {
  const [topics, setTopics] = useState<TrainingTopic[]>([]);
  const [id, setId] = useState("");
  useEffect(() => {
    trainingMatrixApi
      .topics(undefined, true)
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);
  const usable = topics.filter(
    (t) =>
      !existing.some((r) => r.topicId === t.id) &&
      (t.scope !== "DEPARTMENT_GENERAL" || t.departmentId === department),
  );
  const chosen = usable.find((t) => t.id === id);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title="Add a Topic"
      description="Standard topics are kept in Training Administration. A SOP is added with Add SOP."
      confirmText="Add"
      confirmDisabled={!chosen}
      size="md"
      onConfirm={() =>
        chosen &&
        onAdd(
          chosen,
          chosen.scope === "FACTORY_GENERAL"
            ? "FACTORY_GENERAL"
            : "DEPARTMENT_GENERAL",
        )
      }
    >
      <FormField label="Topic" required>
        <Select
          value={id}
          onChange={setId}
          options={usable.map((t) => ({
            label: `${t.code} — ${t.name}`,
            value: t.id,
          }))}
          placeholder="Choose a topic"
        />
      </FormField>
    </FormModal>
  );
}

function AddDocumentDialog({
  existing,
  onClose,
  onAdd,
}: {
  existing: TrainingMatrixRow[];
  onClose: () => void;
  onAdd: (d: {
    id: string;
    documentNumber: string;
    documentName: string;
  }) => void;
}) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [docs, setDocs] = useState<
    Record<string, { id: string; documentNumber: string; documentName: string }>
  >({});
  const [id, setId] = useState("");
  const search = useCallback(
    async (query: string) => {
      const page = await documentApi.getDocumentsPage({
        search: query,
        page: 1,
        limit: 20,
      } as never);
      const list = (
        page.data as unknown as {
          id: string;
          documentNumber: string;
          documentName: string;
        }[]
      ).filter((d) => !existing.some((r) => r.documentId === d.id));
      setDocs((old) => ({
        ...old,
        ...Object.fromEntries(list.map((d) => [d.id, d])),
      }));
      const mapped = list.map((d) => ({
        label: `${d.documentNumber} — ${d.documentName}`,
        value: d.id,
      }));
      setOptions(mapped);
      return mapped;
    },
    [existing],
  );
  useEffect(() => {
    void search("");
  }, [search]);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title="Add a SOP"
      description="The row applies to the revision of the document that is effective at the time."
      confirmText="Add"
      confirmDisabled={!docs[id]}
      size="md"
      onConfirm={() => docs[id] && onAdd(docs[id])}
    >
      <FormField label="Document" required>
        <Select
          value={id}
          onChange={setId}
          options={options}
          onSearch={search}
          placeholder="Search a document"
        />
      </FormField>
    </FormModal>
  );
}

function SubmitDialog({
  versionId,
  busy,
  onClose,
  onSubmit,
}: {
  versionId: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (approver: string) => void;
}) {
  const [people, setPeople] = useState<TrainingPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [id, setId] = useState("");
  const search = useCallback(
    async (query: string) => {
      const page = await trainingMatrixApi.eligibleApprovers(versionId, query);
      setPeople(page.data);
      setLoaded(true);
      return page.data.map((p) => ({
        label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
        value: p.id,
      }));
    },
    [versionId],
  );
  useEffect(() => {
    void search("");
  }, [search]);
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title="Send for Approval"
      description="Choose who approves this version. Only people the system found eligible are listed: they hold the approval permission, are in this department, and are not you."
      confirmText="Continue to signature"
      isLoading={busy}
      confirmDisabled={!id}
      size="md"
      onConfirm={() => onSubmit(id)}
    >
      {loaded && people.length === 0 ? (
        <p className="text-sm text-amber-700">
          No eligible person was found. A person needs the permission to approve
          matrices in this department.
        </p>
      ) : (
        <Select
          label="Approver"
          value={id}
          onChange={setId}
          options={people.map((p) => ({
            label: `${p.fullName}${p.position ? ` — ${p.position}` : ""}`,
            value: p.id,
          }))}
          onSearch={search}
          placeholder="Search by name"
        />
      )}
    </FormModal>
  );
}

function RejectDialog({
  busy,
  onClose,
  onReject,
}: {
  busy: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <FormModal
      isOpen
      onClose={onClose}
      title="Reject This Version"
      description="The version goes back to draft with your reason."
      confirmText="Reject"
      confirmVariant="destructive"
      isLoading={busy}
      confirmDisabled={!reason.trim()}
      size="md"
      onConfirm={() => onReject(reason.trim())}
    >
      <FormField label="Reason" required>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
    </FormModal>
  );
}
