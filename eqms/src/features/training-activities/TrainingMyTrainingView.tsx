import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { trainingActivitiesApi, trainingError, trainingJobsApi, trainingRecordsApi, type TrainingMyApproval, type TrainingTask } from "@/services/api/trainingActivities";
import { METHOD_LABEL, STATUS_COLOR, STATUS_LABEL, STEP_LABEL, day, trainingBreadcrumbs, TRAINING_PAGES } from "./trainingLabels";
import { TrainingRecordsTable } from "./TrainingRecordsTable";

/** My Training: what the person has to do, the steps waiting for their signature, and their own training records. Always the person who is logged in. */
export function TrainingMyTrainingView() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("todo");
  const [tasks, setTasks] = useState<TrainingTask[]>();
  const [approvals, setApprovals] = useState<TrainingMyApproval[]>();
  const [error, setError] = useState("");

  useEffect(() => {
    trainingRecordsApi.tasks().then(setTasks).catch((e) => { setError(trainingError(e)); setTasks([]); });
    // Steps assigned to me, and job assignments waiting for my own signature as the employee.
    Promise.all([
      trainingActivitiesApi.myApprovals().catch(() => [] as TrainingMyApproval[]),
      trainingJobsApi.list({ status: "PENDING_RECEIVER", limit: 20 }).then((page) => page.data).catch(() => []),
    ]).then(([steps, jobs]) =>
      setApprovals([
        ...steps,
        ...jobs.map((j) => ({ id: `job-${j.id}`, stepCode: "MATRIX_APPROVE" as const, objectType: "TRAINING_JOB_ASSIGNMENT", objectId: j.id, activityId: null, trainingNumber: `JA #${j.issueNo}`, title: `Job assignment: ${j.positionName}`, status: "PLANNED" as const, assignedAt: j.createdAt })),
      ]),
    );
  }, []);

  const tabs: TabItem[] = [
    { id: "todo", label: "To do", count: tasks?.length },
    { id: "sign", label: "Waiting for my signature", count: approvals?.length },
    { id: "records", label: "My records" },
  ];
  const open = (id: string) => navigate(`/training-management/activities/${id}`);
  const openApproval = (a: TrainingMyApproval) => navigate(a.objectType === "TRAINING_MATRIX_VERSION" ? `/training-management/matrix-versions/${a.objectId}` : a.objectType === "TRAINING_JOB_ASSIGNMENT" ? `/training-management/job-assignments/${a.objectId}` : a.objectType === "TRAINING_SPECIMEN_SIGNATURE" ? "/training-management/specimen-signatures" : a.objectType === "TRAINING_RECORD_EXPORT" ? "/training-management/record-exports" : a.objectType === "TRAINING_TRAINER_EXCEPTION" && a.activityId ? `/training-management/activities/${a.activityId}` : a.objectType === "TRAINING_LEGACY_EVIDENCE" ? "/training-management/legacy-evidence" : a.objectType === "TRAINING_REQUIREMENT" ? `/training-management/requirements/${a.objectId}` : `/training-management/activities/${a.objectId}`);
  const taskColumns: DataTableColumn<TrainingTask>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "number", header: "Training Number", cell: (t) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => open(t.activityId)}>{t.trainingNumber}</button> },
    { id: "title", header: "Title", cell: (t) => <div className="max-w-80 whitespace-normal">{t.title}</div> },
    { id: "topics", header: "Topics", cell: (t) => <div className="max-w-80 whitespace-normal">{t.topics ?? "—"}</div> },
    { id: "method", header: "Method", cell: (t) => METHOD_LABEL[t.method] ?? t.method },
    { id: "when", header: "Scheduled", cell: (t) => day(t.scheduledOn) },
    { id: "due", header: "Due", cell: (t) => day(t.dueDate) },
    { id: "status", header: "Status", cell: (t) => <Badge color={STATUS_COLOR[t.status] ?? "slate"}>{STATUS_LABEL[t.status] ?? t.status}</Badge> },
  ];
  const approvalColumns: DataTableColumn<TrainingMyApproval>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_r, i) => i + 1 },
    { id: "number", header: "Training Number", cell: (a) => <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => openApproval(a)}>{a.trainingNumber}</button> },
    { id: "title", header: "Title", cell: (a) => <div className="max-w-80 whitespace-normal">{a.title}</div> },
    { id: "step", header: "Step", cell: (a) => (a.objectType === "TRAINING_JOB_ASSIGNMENT" && a.id.startsWith("job-") ? "Accept your job assignment" : STEP_LABEL[a.stepCode] ?? a.stepCode) },
    { id: "status", header: "Status", cell: (a) => STATUS_LABEL[a.status] ?? a.status.replace(/_/g, " ").toLowerCase() },
    { id: "since", header: "Waiting since", cell: (a) => day(a.assignedAt) },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.myTraining.title} breadcrumbItems={trainingBreadcrumbs(navigate, "myTraining")} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <TabNav tabs={tabs} activeTab={tab} onChange={setTab} variant="underline" />
      {tab === "todo" && (tasks ? (
        <DataTable rows={tasks} getRowKey={(t) => t.participantId} columns={taskColumns} emptyState={<TableEmptyState title="Nothing to do" description="Trainings you are invited to will appear here." />} />
      ) : <SectionLoading text="Loading…" />)}
      {tab === "sign" && (approvals ? (
        <DataTable rows={approvals} getRowKey={(a) => a.id} columns={approvalColumns} emptyState={<TableEmptyState title="Nothing waiting" description="Review and approval steps assigned to you will appear here." />} />
      ) : <SectionLoading text="Loading…" />)}
      {tab === "records" && <TrainingRecordsTable mine />}
    </div>
  );
}
